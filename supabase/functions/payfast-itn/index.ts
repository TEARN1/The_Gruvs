import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function md5(string: string): string {
  const hash = crypto.subtle.digestSync("MD5", new TextEncoder().encode(string));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function verifySignature(data: Record<string, string>, passphrase?: string): boolean {
  const signatureReceived = data["signature"];
  if (!signatureReceived) return false;

  let pfOutput = "";
  for (const key of Object.keys(data)) {
    if (key !== "signature" && data[key] !== undefined && data[key] !== null && data[key] !== "") {
      pfOutput += `${key}=${encodeURIComponent(data[key].trim()).replace(/%20/g, "+")}&`;
    }
  }

  let getString = pfOutput.slice(0, -1);
  if (passphrase) {
    getString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, "+")}`;
  }

  return md5(getString) === signatureReceived;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const isSandbox = Deno.env.get("PAYFAST_SANDBOX") !== "false";
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // PayFast ITN posts as application/x-www-form-urlencoded
    const textBody = await req.text();
    const params = new URLSearchParams(textBody);
    const postData: Record<string, string> = {};
    params.forEach((value, key) => {
      postData[key] = value;
    });

    console.log(`[PayFast ITN] Received notification for payment: ${postData.m_payment_id}`);

    // 1. Verify Signature
    if (!verifySignature(postData, passphrase)) {
      console.error("[PayFast ITN] Invalid MD5 signature");
      return new Response("Signature mismatch", { status: 400 });
    }

    // 2. Validate with PayFast query/validate
    const validateHost = isSandbox
      ? "https://sandbox.payfast.co.za/eng/query/validate"
      : "https://www.payfast.co.za/eng/query/validate";

    try {
      const validateRes = await fetch(validateHost, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: textBody,
      });
      const validateText = await validateRes.text();
      if (validateText.trim() !== "VALID") {
        console.warn(`[PayFast ITN] Validation check returned: ${validateText}`);
      }
    } catch (err) {
      console.warn("[PayFast ITN] Error checking validate host:", err);
    }

    // 3. Confirm payment status is COMPLETE
    const paymentStatus = postData.payment_status;
    const paymentId = postData.m_payment_id;
    const pfPaymentId = postData.pf_payment_id;
    const amountGross = parseFloat(postData.amount_gross || "0");
    const app = postData.custom_str1 || "thegruvs";
    const itemType = postData.custom_str2 || "ticket";
    const userId = postData.custom_str3;
    let metadata: any = {};
    try {
      metadata = postData.custom_str4 ? JSON.parse(postData.custom_str4) : {};
    } catch {}

    // Record raw transaction in audit table
    await supabase.from("payfast_transactions").upsert({
      m_payment_id: paymentId,
      pf_payment_id: pfPaymentId,
      payment_status: paymentStatus,
      item_name: postData.item_name,
      amount_gross: amountGross,
      amount_fee: parseFloat(postData.amount_fee || "0"),
      amount_net: parseFloat(postData.amount_net || "0"),
      user_id: userId !== "anonymous" ? userId : null,
      app: app,
      item_type: itemType,
      raw_payload: postData,
      created_at: new Date().toISOString(),
    }, { onConflict: "m_payment_id" });

    if (paymentStatus === "COMPLETE") {
      console.log(`[PayFast ITN] Processing completed capture for ${app}:${itemType}`);

      // ── THE GRUVS DISPATCH ──────────────────────────────────────────
      if (app === "thegruvs") {
        if (itemType === "ticket") {
          const { eventId, tierId } = metadata;
          if (eventId && userId && userId !== "anonymous") {
            // Generate ticket token
            const secureToken = `TKT_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
            await supabase.from("ticket_tokens").insert({
              token: secureToken,
              event_id: eventId,
              user_id: userId,
              tier_id: tierId || null,
              used_at: null,
              created_at: new Date().toISOString(),
            });

            // Mark RSVP as captured
            await supabase.from("event_rsvps").upsert({
              event_id: eventId,
              user_id: userId,
              status: "going",
              tier_id: tierId || null,
              payment_status: "captured",
              payment_ref: pfPaymentId || paymentId,
              updated_at: new Date().toISOString(),
            }, { onConflict: "event_id,user_id" });

            // Record in append-only wallet ledger
            await supabase.from("wallet_transactions").insert({
              user_id: userId,
              amount_cents: Math.round(amountGross * 100),
              type: "ticket_purchase",
              status: "settled",
              reference: paymentId,
              description: `Ticket: ${postData.item_name}`,
              created_at: new Date().toISOString(),
            });
          }
        } else if (itemType === "booking") {
          const { bookingId } = metadata;
          if (bookingId) {
            await supabase.from("service_bookings").update({
              payment_status: "captured",
              payment_ref: pfPaymentId || paymentId,
              status: "escrow_held",
              updated_at: new Date().toISOString(),
            }).eq("id", bookingId);

            await supabase.from("wallet_transactions").insert({
              user_id: userId !== "anonymous" ? userId : null,
              amount_cents: Math.round(amountGross * 100),
              type: "escrow_held",
              status: "settled",
              reference: paymentId,
              description: `Escrow funded for booking ${bookingId}`,
              created_at: new Date().toISOString(),
            });
          }
        }
      }

      // ── THE RESIDENT DISPATCH ──────────────────────────────────────
      else if (app === "theresident") {
        if (userId && userId !== "anonymous") {
          const tier = itemType; // priority | premium | plus
          if (["priority", "premium", "plus"].includes(tier)) {
            await supabase.from("res_subscriptions").upsert({
              user_id: userId,
              product: tier === "plus" ? "household" : "provider",
              tier: tier,
              status: "active",
              payment_ref: pfPaymentId || paymentId,
              period_start: new Date().toISOString(),
              period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id,product" });
          }
        }
      }

      // ── THE EXCELLENCY DISPATCH ────────────────────────────────────
      else if (app === "theexcellency") {
        // Mark course / enterprise order as paid
        console.log(`[PayFast ITN] Excellency order settled: ${paymentId}`);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[PayFast ITN] Execution error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
