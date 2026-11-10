// Starts a PayFast payment for a signed-in Gruvs user.
//
// The browser says what it wants to buy; this function decides the price from
// the database, takes the buyer from the sign-in token, records the order in
// payfast_transactions (PENDING, with the expected amount) and signs the
// request. payfast-itn later fulfils only that recorded order.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ITEM_TYPES,
  bookingPriceCents,
  chosenAmountCents,
  payfastConfig,
  processUrl,
  safeReturnUrl,
  safeText,
  signatureString,
  ticketPriceCents,
} from "../_shared/payfastCore.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function md5(text: string): string {
  const hash = crypto.subtle.digestSync("MD5", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let config;
  try {
    config = payfastConfig(Deno.env.toObject());
  } catch (err) {
    console.error("[PayFast checkout] not configured:", (err as Error).message);
    return json(503, { error: "Online payment is not set up yet. Nothing was charged." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // The buyer is whoever is signed in, never a user id from the request body.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    auth: { persistSession: false },
  });
  const { data: auth } = await userClient.auth.getUser();
  const user = auth?.user;
  if (!user) return json(401, { error: "Sign in to pay." });

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Bad request" });
  }
  const itemType = String(body.itemType || "");
  if (!ITEM_TYPES.includes(itemType)) return json(400, { error: "This item cannot be paid for." });
  const meta = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let cents: number | null = null;
  let itemId = "";
  let itemName = "";
  let details: Record<string, unknown> = {};

  if (itemType === "ticket") {
    const { data: ev } = await admin.from("events").select("id,title,rsvp_tiers").eq("id", meta.eventId).maybeSingle();
    cents = ev ? ticketPriceCents(ev.rsvp_tiers, meta.tierId) : null;
    if (ev && cents) {
      const tier = (ev.rsvp_tiers as any[]).find((t) => String(t?.id) === String(meta.tierId));
      itemId = `${ev.id}_${tier.id}`;
      itemName = safeText(`${ev.title} — ${tier.name || "Ticket"}`, 100);
      details = { eventId: ev.id, tierId: String(tier.id), waitlist: Boolean(meta.waitlist) };
    }
  } else if (itemType === "booking") {
    const { data: booking } = await admin
      .from("service_bookings")
      .select("id,amount_cents,payment_status")
      .eq("id", meta.bookingId)
      .maybeSingle();
    cents = bookingPriceCents(booking);
    if (booking && cents) {
      itemId = booking.id;
      itemName = "Service booking";
      details = { bookingId: booking.id };
    }
  } else {
    // A pitch-in or a business boost: the buyer chooses the amount, within
    // bounds, and paying switches nothing on by itself (payfast-itn records it).
    cents = chosenAmountCents(body.amountZar);
    itemId = clip(body.itemId, 100);
    itemName = safeText(body.itemName || "Gruvs payment", 100) || "Gruvs payment";
    details = {
      eventId: meta.eventId ? clip(meta.eventId, 64) : undefined,
      tableId: meta.tableId ? clip(meta.tableId, 64) : undefined,
      businessId: meta.businessId ? clip(meta.businessId, 64) : undefined,
      tierName: meta.tierName ? clip(meta.tierName, 40) : undefined,
    };
  }
  if (!cents) return json(400, { error: "This item cannot be paid for." });

  const paymentId = `GRV-${itemType.slice(0, 3).toUpperCase()}-${crypto.randomUUID()}`;

  // Record the order first: the notification is checked against it.
  const { error: insertError } = await admin.from("payfast_transactions").insert({
    m_payment_id: paymentId,
    payment_status: "PENDING",
    user_id: user.id,
    app: "thegruvs",
    item_type: itemType,
    item_id: itemId,
    item_name: itemName,
    expected_amount_cents: cents,
    order_details: details,
  });
  if (insertError) {
    console.error("[PayFast checkout] could not record the order:", insertError.message);
    return json(503, { error: "Online payment is not available right now. Nothing was charged." });
  }

  const name = safeText(user.user_metadata?.full_name || user.user_metadata?.username || "Gruvs Member", 100).split(" ");
  const fallbackReturn = `https://thegruvs.com/payment/success?payment_id=${paymentId}`;
  const fallbackCancel = `https://thegruvs.com/payment/cancelled?payment_id=${paymentId}`;

  // Field order matters: PayFast signs them in this documented order.
  const fields: Record<string, string> = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: safeReturnUrl(body.returnUrl, fallbackReturn),
    cancel_url: safeReturnUrl(body.cancelUrl, fallbackCancel),
    notify_url: `${supabaseUrl}/functions/v1/payfast-itn`,
    name_first: name[0] || "Gruvs",
    name_last: name.slice(1).join(" ") || "Member",
    email_address: user.email || "",
    m_payment_id: paymentId,
    amount: (cents / 100).toFixed(2),
    item_name: itemName,
    item_description: safeText(body.itemDescription || itemName, 255),
    custom_str1: "thegruvs",
    custom_str2: itemType,
    custom_str3: user.id,
  };
  for (const k of Object.keys(fields)) if (!fields[k]) delete fields[k];
  fields.signature = md5(signatureString(fields, config.passphrase));

  return json(200, {
    success: true,
    paymentUrl: `${processUrl(config.sandbox)}?${new URLSearchParams(fields).toString()}`,
    paymentId,
    fields,
  });
});
