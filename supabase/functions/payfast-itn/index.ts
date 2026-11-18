// payfast-itn — PayFast's server-to-server payment notification (ITN).
//
// A ticket is issued only when ALL of these hold:
//   1. (live) the request comes from a PayFast IP
//   2. the MD5 signature matches (with the passphrase, if set)
//   3. PayFast's own /query/validate endpoint answers "VALID"
//   4. merchant_id is OURS
//   5. m_payment_id is an order we created, and amount_gross equals what WE
//      priced it at (payfast-checkout stored it from the event, not the client)
//   6. payment_status is COMPLETE
// It is idempotent: PayFast retries ITNs, and a completed order is never
// fulfilled twice (status check + unique ticket_tokens.order_id).
//
// Sandbox orders are recorded but do NOT issue real tickets unless the secret
// PAYFAST_SANDBOX_FULFIL=true is set (for an end-to-end test). Otherwise anyone
// could "pay" with PayFast's sandbox test card and get a real door ticket.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function md5(s: string): string {
  const hash = crypto.subtle.digestSync("MD5", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Signature over every posted field except `signature`, in the order received.
function signatureOk(pairs: [string, string][], passphrase: string): boolean {
  const received = pairs.find(([k]) => k === "signature")?.[1];
  if (!received) return false;
  let s = pairs
    .filter(([k, v]) => k !== "signature" && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, "+")}`)
    .join("&");
  if (passphrase) s += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, "+")}`;
  return md5(s) === received;
}

// PayFast's documented ITN source addresses.
const PAYFAST_IPS = new Set([
  ...Array.from({ length: 21 }, (_, i) => `3.163.${232 + i}.237`),
  ...Array.from({ length: 15 }, (_, i) => `197.97.145.${144 + i}`),
  ...Array.from({ length: 13 }, (_, i) => `41.74.179.${194 + i}`),
]);

function clientIp(req: Request): string {
  const raw = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0] || "";
  return raw.trim().replace(/^::ffff:/, "");
}

const SANDBOX_MERCHANT_ID = "10000100";

serve(async (req) => {
  // PayFast expects a 200 for anything we've consumed; non-200 makes it retry.
  // So: 200 once handled (including deliberate rejections we've recorded),
  // 4xx only for requests that aren't a usable ITN at all.
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const isSandbox = Deno.env.get("PAYFAST_SANDBOX") !== "false";
  const sandboxFulfil = Deno.env.get("PAYFAST_SANDBOX_FULFIL") === "true";
  const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";
  const ourMerchant = Deno.env.get("PAYFAST_MERCHANT_ID") || (isSandbox ? SANDBOX_MERCHANT_ID : "");
  if (!ourMerchant) return new Response("not_configured", { status: 503 });

  // 1. Source IP (live only — sandbox ITNs come from elsewhere).
  if (!isSandbox && Deno.env.get("PAYFAST_SKIP_IP_CHECK") !== "true") {
    const ip = clientIp(req);
    if (!PAYFAST_IPS.has(ip)) {
      console.warn(`[payfast-itn] rejected source IP ${ip}`);
      return new Response("forbidden", { status: 403 });
    }
  }

  const text = await req.text();
  const pairs = [...new URLSearchParams(text).entries()];
  const post = Object.fromEntries(pairs) as Record<string, string>;

  // 2. Signature
  if (!signatureOk(pairs, passphrase)) {
    console.warn("[payfast-itn] signature mismatch", post.m_payment_id);
    return new Response("bad_signature", { status: 400 });
  }

  // 3. Ask PayFast whether it really sent this.
  const validateUrl = isSandbox
    ? "https://sandbox.payfast.co.za/eng/query/validate"
    : "https://www.payfast.co.za/eng/query/validate";
  let verdict = "";
  try {
    const r = await fetch(validateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: text,
    });
    verdict = (await r.text()).trim();
  } catch (e) {
    console.error("[payfast-itn] validate call failed:", e);
    return new Response("validate_unreachable", { status: 502 }); // PayFast will retry
  }
  if (verdict !== "VALID") {
    console.warn(`[payfast-itn] PayFast validate said "${verdict}"`, post.m_payment_id);
    return new Response("not_valid", { status: 400 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const reject = async (orderId: string, reason: string) => {
    await admin.from("payfast_orders").update({
      status: "rejected", status_reason: reason, itn_payload: post, updated_at: new Date().toISOString(),
    }).eq("id", orderId).eq("status", "pending");
    console.warn(`[payfast-itn] order ${orderId} rejected: ${reason}`);
    return new Response("OK", { status: 200 });
  };

  // 4–5. Our order, our merchant, our price.
  const { data: order } = await admin
    .from("payfast_orders").select("*").eq("m_payment_id", post.m_payment_id || "").maybeSingle();
  if (!order) {
    console.warn("[payfast-itn] unknown m_payment_id", post.m_payment_id);
    return new Response("OK", { status: 200 }); // nothing of ours to update
  }
  if (order.status === "complete") return new Response("OK", { status: 200 }); // retry of a done ITN
  if (post.merchant_id !== ourMerchant) return reject(order.id, "merchant_mismatch");
  if (order.sandbox !== isSandbox) return reject(order.id, "mode_mismatch");
  const paidCents = Math.round(parseFloat(post.amount_gross || "0") * 100);
  if (paidCents !== order.amount_cents) return reject(order.id, `amount_mismatch:${paidCents}`);

  // 6. Status
  const status = post.payment_status;
  if (status === "CANCELLED" || status === "FAILED") {
    await admin.from("payfast_orders").update({
      status: status === "CANCELLED" ? "cancelled" : "failed",
      pf_payment_id: post.pf_payment_id || null, itn_payload: post, updated_at: new Date().toISOString(),
    }).eq("id", order.id).eq("status", "pending");
    return new Response("OK", { status: 200 });
  }
  if (status !== "COMPLETE") return new Response("OK", { status: 200 }); // e.g. PENDING; wait for the next ITN

  // Sandbox: record, don't issue a real ticket (unless explicitly testing).
  if (order.sandbox && !sandboxFulfil) {
    await admin.from("payfast_orders").update({
      status: "complete", status_reason: "sandbox_no_ticket",
      pf_payment_id: post.pf_payment_id || null, itn_payload: post, updated_at: new Date().toISOString(),
    }).eq("id", order.id).eq("status", "pending");
    return new Response("OK", { status: 200 });
  }

  // Fulfil. Unique ticket_tokens.order_id makes a duplicate insert fail safely.
  const token = `TKT-${crypto.randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase()}`;
  const { data: ticket, error: tErr } = await admin.from("ticket_tokens").insert({
    token, event_id: order.event_id, user_id: order.user_id, tier_id: order.tier_id, order_id: order.id,
  }).select("id").single();
  let ticketId = ticket?.id;
  if (tErr) {
    const { data: existing } = await admin.from("ticket_tokens").select("id").eq("order_id", order.id).maybeSingle();
    if (!existing) {
      console.error("[payfast-itn] ticket insert failed:", tErr.message);
      return new Response("ticket_failed", { status: 500 }); // PayFast retries
    }
    ticketId = existing.id;
  }

  const { error: rErr } = await admin.from("event_rsvps").upsert({
    event_id: order.event_id, user_id: order.user_id, status: "going",
    tier_id: order.tier_id, updated_at: new Date().toISOString(),
  }, { onConflict: "event_id,user_id" });
  if (rErr) console.error("[payfast-itn] rsvp upsert failed:", rErr.message); // ticket still stands

  await admin.from("payfast_orders").update({
    status: "complete", ticket_id: ticketId, pf_payment_id: post.pf_payment_id || null,
    itn_payload: post, updated_at: new Date().toISOString(),
  }).eq("id", order.id);

  return new Response("OK", { status: 200 });
});
