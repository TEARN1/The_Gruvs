// PayFast's notification (ITN) for Gruvs payments.
//
// Fulfils only an order payfast-checkout recorded, and only when:
// - the notice comes from PayFast's addresses (live mode),
// - its signature, merchant and exact amount match the recorded order,
// - PayFast's own validate service confirms it (any doubt: 503, PayFast retries),
// - the order was not fulfilled before (PayFast resends notices).
// The buyer, the item and the price come from the recorded order, never from
// the notice's custom fields.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkNotification, notificationSignatureOk, payfastConfig, toCents, validateUrl } from "../_shared/payfastCore.js";

function md5(text: string): string {
  const hash = crypto.subtle.digestSync("MD5", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const text = (status: number, body: string) => new Response(body, { status });

const PAYFAST_AWS_IPS = [
  "3.163.232.237",
  "3.163.233.237",
  "3.163.234.237",
  "3.163.235.237",
  "3.163.236.237",
  "3.163.237.237",
  "3.163.238.237",
  "3.163.239.237",
  "3.163.240.237",
  "3.163.241.237",
  "3.163.242.237",
  "3.163.243.237",
  "3.163.244.237",
  "3.163.245.237",
  "3.163.246.237",
  "3.163.247.237",
  "3.163.248.237",
  "3.163.249.237",
  "3.163.250.237",
  "3.163.251.237",
  "3.163.252.237"
];

const PAYFAST_LEGACY_IPS = [
  "197.97.145.144", "197.97.145.145", "197.97.145.146", "197.97.145.147", "197.97.145.148",
  "197.97.145.149", "197.97.145.150", "197.97.145.151", "197.97.145.152", "197.97.145.153",
  "197.97.145.154", "197.97.145.155", "197.97.145.156", "197.97.145.157", "197.97.145.158",
  "41.74.179.194", "41.74.179.195", "41.74.179.196", "41.74.179.197", "41.74.179.198",
  "41.74.179.199", "41.74.179.200", "41.74.179.201", "41.74.179.202", "41.74.179.203",
  "41.74.179.204", "41.74.179.205", "41.74.179.206"
];

const PAYFAST_WHITELIST = new Set([...PAYFAST_AWS_IPS, ...PAYFAST_LEGACY_IPS]);

function normalizeIp(ip: string): string {
  if (!ip) return "";
  let cleaned = ip.trim();
  if (cleaned.startsWith("::ffff:")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("[") && cleaned.includes("]:")) {
    cleaned = cleaned.slice(1, cleaned.indexOf("]:"));
  } else if (cleaned.includes(":") && cleaned.includes(".")) {
    cleaned = cleaned.split(":")[0];
  }
  return cleaned;
}

function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return normalizeIp(cfIp);
  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) return normalizeIp(xRealIp);
  const xForwarded = req.headers.get("x-forwarded-for");
  if (xForwarded) {
    const first = xForwarded.split(",")[0].trim();
    if (first) return normalizeIp(first);
  }
  return "unknown";
}

serve(async (req) => {
  if (req.method !== "POST") return text(405, "Method not allowed");

  let config;
  try {
    config = payfastConfig(Deno.env.toObject());
  } catch (err) {
    console.error("[PayFast ITN] not configured:", (err as Error).message);
    return text(503, "Not configured");
  }

  if (!config.sandbox && Deno.env.get("PAYFAST_SKIP_IP_CHECK") !== "true") {
    const ip = getClientIp(req);
    if (!PAYFAST_WHITELIST.has(ip)) {
      console.warn(`[PayFast ITN] refused: ${ip} is not a PayFast address`);
      return text(403, "Forbidden");
    }
  }

  const rawBody = await req.text();
  // Kept in the order received: the signature covers the fields in that order.
  const fields = [...new URLSearchParams(rawBody).entries()];
  const params: Record<string, string> = Object.fromEntries(fields);
  const signatureOk = notificationSignatureOk(fields, config.passphrase, md5);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const paymentId = String(params.m_payment_id || "");
  const { data: order } = paymentId
    ? await admin.from("payfast_transactions").select("*").eq("m_payment_id", paymentId).maybeSingle()
    : { data: null };

  const verdict = checkNotification({ params, config, order, signatureOk });
  if (!verdict.ok) {
    console.warn(`[PayFast ITN] refused ${paymentId}: ${verdict.reason}`);
    return text(verdict.status, verdict.reason);
  }

  // PayFast's own confirmation. Fail closed: PayFast retries on 503.
  try {
    const res = await fetch(validateUrl(config.sandbox), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
    });
    if (!res.ok) return text(503, "PayFast validation unavailable");
    if ((await res.text()).trim() !== "VALID") {
      console.warn(`[PayFast ITN] PayFast did not confirm ${paymentId}`);
      return text(400, "Not confirmed by PayFast");
    }
  } catch (err) {
    console.error("[PayFast ITN] validation unreachable:", err);
    return text(503, "PayFast validation unreachable");
  }

  if (verdict.already) return text(200, "OK");

  await admin
    .from("payfast_transactions")
    .update({
      pf_payment_id: params.pf_payment_id || null,
      payment_status: params.payment_status || "UNKNOWN",
      amount_gross: toCents(params.amount_gross) / 100,
      amount_fee: Number(params.amount_fee || 0),
      amount_net: Number(params.amount_net || 0),
      raw_payload: params,
    })
    .eq("m_payment_id", paymentId);

  if (params.payment_status !== "COMPLETE") return text(200, "OK");

  // Claim the order: only one notification fulfils it.
  const { data: claimed } = await admin
    .from("payfast_transactions")
    .update({ fulfilled_at: new Date().toISOString() })
    .eq("m_payment_id", paymentId)
    .is("fulfilled_at", null)
    .select("m_payment_id");
  if (!claimed || claimed.length === 0) return text(200, "OK");

  const details = (order.order_details || {}) as Record<string, string>;
  const userId = order.user_id as string;
  const ref = params.pf_payment_id || paymentId;
  const now = new Date().toISOString();

  if (order.item_type === "ticket" && details.eventId && userId) {
    await admin.from("ticket_tokens").insert({
      token: `TKT_${crypto.randomUUID()}`,
      event_id: details.eventId,
      user_id: userId,
      tier_id: details.tierId || null,
      used_at: null,
      created_at: now,
    });
    await admin.from("event_rsvps").upsert(
      {
        event_id: details.eventId,
        user_id: userId,
        status: "going",
        tier_id: details.tierId || null,
        payment_status: "captured",
        payment_ref: ref,
        updated_at: now,
      },
      { onConflict: "event_id,user_id" },
    );
    await admin.from("wallet_transactions").insert({
      user_id: userId,
      amount_cents: order.expected_amount_cents,
      type: "ticket_purchase",
      status: "settled",
      reference: paymentId,
      description: `Ticket: ${order.item_name || ""}`.slice(0, 200),
      created_at: now,
    });
  } else if (order.item_type === "booking" && details.bookingId) {
    await admin
      .from("service_bookings")
      .update({ payment_status: "captured", payment_ref: ref, status: "escrow_held", updated_at: now })
      .eq("id", details.bookingId);
    await admin.from("wallet_transactions").insert({
      user_id: userId || null,
      amount_cents: order.expected_amount_cents,
      type: "escrow_held",
      status: "settled",
      reference: paymentId,
      description: `Escrow funded for booking ${details.bookingId}`,
      created_at: now,
    });
  }
  // A pitch-in or a business boost is recorded above; nothing switches on by itself.

  return text(200, "OK");
});
