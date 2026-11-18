// payfast-checkout — start a PayFast payment for a paid event ticket tier.
//
// Trust model: the app sends ONLY { eventId, tierId }. Who is paying comes from
// the caller's JWT; what it costs comes from events.rsvp_tiers on the server.
// The expected amount is stored in payfast_orders, and payfast-itn refuses any
// notification that doesn't match it. Nothing the client says about price,
// user or item is believed.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   PAYFAST_SANDBOX       "false" for live. Anything else = sandbox.
//   PAYFAST_MERCHANT_ID   required when live
//   PAYFAST_MERCHANT_KEY  required when live
//   PAYFAST_PASSPHRASE    strongly recommended (set the same one in PayFast)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// PayFast's public sandbox merchant — only ever used in sandbox mode.
const SANDBOX_MERCHANT_ID = "10000100";
const SANDBOX_MERCHANT_KEY = "46f0cd694581a";

function md5(s: string): string {
  const hash = crypto.subtle.digestSync("MD5", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// PayFast signature: fields in the order sent, URL-encoded with + for spaces.
function signature(data: [string, string][], passphrase: string): string {
  let s = data
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, "+")}`)
    .join("&");
  if (passphrase) s += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, "+")}`;
  return md5(s);
}

const SITE = "https://thegruvs.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const isSandbox = Deno.env.get("PAYFAST_SANDBOX") !== "false";
  const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID") || (isSandbox ? SANDBOX_MERCHANT_ID : "");
  const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY") || (isSandbox ? SANDBOX_MERCHANT_KEY : "");
  const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";
  if (!merchantId || !merchantKey) {
    // Live mode without credentials must never fall back to the demo merchant.
    return json({ error: "payments_not_configured" }, 503);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Who is paying: from the JWT only.
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: authData, error: authErr } = await admin.auth.getUser(jwt);
  const user = authData?.user;
  if (authErr || !user) return json({ error: "auth_required" }, 401);

  let body: { eventId?: string; tierId?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const eventId = String(body.eventId || "");
  const tierId = String(body.tierId || "");
  if (!/^[0-9a-f-]{36}$/i.test(eventId) || !tierId) return json({ error: "event_and_tier_required" }, 400);

  // What it costs: from the event row only.
  const { data: event, error: evErr } = await admin
    .from("events")
    .select("id, title, rsvp_tiers, deleted_at, status")
    .eq("id", eventId)
    .maybeSingle();
  if (evErr || !event || event.deleted_at || event.status === "cancelled") {
    return json({ error: "event_unavailable" }, 404);
  }
  const tiers = Array.isArray(event.rsvp_tiers) ? event.rsvp_tiers : [];
  const tier = tiers.find((t: { id?: unknown }) => String(t?.id) === tierId);
  const price = Number(tier?.price);
  if (!tier || !Number.isFinite(price) || price <= 0) return json({ error: "tier_not_for_sale" }, 400);
  const amountCents = Math.round(price * 100);
  if (amountCents < 500) return json({ error: "amount_below_minimum" }, 400); // PayFast minimum R5.00

  const mPaymentId = `GRV-${crypto.randomUUID()}`;
  const { error: orderErr } = await admin.from("payfast_orders").insert({
    m_payment_id: mPaymentId,
    user_id: user.id,
    event_id: event.id,
    tier_id: tierId,
    tier_name: String(tier.name || tierId).slice(0, 80),
    amount_cents: amountCents,
    sandbox: isSandbox,
  });
  if (orderErr) {
    console.error("[payfast-checkout] order insert failed:", orderErr.message);
    return json({ error: "order_failed" }, 500);
  }

  const meta = user.user_metadata || {};
  const fullName = String(meta.full_name || meta.username || "Gruvs Member").trim();
  const [first, ...rest] = fullName.split(/\s+/);
  const itemName = `${event.title} — ${tier.name || "Ticket"}`.slice(0, 100);

  // Order matters for the signature — keep PayFast's documented field order.
  const fields: [string, string][] = [
    ["merchant_id", merchantId],
    ["merchant_key", merchantKey],
    ["return_url", `${SITE}/payment/success?order=${mPaymentId}`],
    ["cancel_url", `${SITE}/payment/cancelled?order=${mPaymentId}`],
    ["notify_url", `${supabaseUrl}/functions/v1/payfast-itn`],
    ["name_first", (first || "Gruvs").slice(0, 100)],
    ["name_last", (rest.join(" ") || "Member").slice(0, 100)],
    ["email_address", String(user.email || "").slice(0, 100)],
    ["m_payment_id", mPaymentId],
    ["amount", (amountCents / 100).toFixed(2)],
    ["item_name", itemName],
  ];
  const sig = signature(fields, passphrase);
  const qs = new URLSearchParams([...fields.filter(([, v]) => v !== ""), ["signature", sig]]);
  const base = isSandbox ? "https://sandbox.payfast.co.za/eng/process" : "https://www.payfast.co.za/eng/process";

  return json({ paymentUrl: `${base}?${qs.toString()}`, paymentId: mPaymentId, sandbox: isSandbox });
});
