import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function md5(string: string): string {
  const hash = crypto.subtle.digestSync("MD5", new TextEncoder().encode(string));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateSignature(data: Record<string, string>, passphrase?: string): string {
  let pfOutput = "";
  for (const key of Object.keys(data)) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== "") {
      pfOutput += `${key}=${encodeURIComponent(data[key].trim()).replace(/%20/g, "+")}&`;
    }
  }

  let getString = pfOutput.slice(0, -1);
  if (passphrase) {
    getString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, "+")}`;
  }

  return md5(getString);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      app = "thegruvs",
      itemType = "ticket",
      itemId,
      itemName,
      itemDescription,
      amountZar,
      user,
      metadata = {},
      returnUrl,
      cancelUrl,
    } = await req.json();

    const isSandbox = Deno.env.get("PAYFAST_SANDBOX") !== "false";
    const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID") || (isSandbox ? "10000100" : "");
    const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY") || (isSandbox ? "46f0cd694581a" : "");
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";

    const baseUrl = isSandbox
      ? "https://sandbox.payfast.co.za/eng/process"
      : "https://www.payfast.co.za/eng/process";

    const paymentId = `GRV-${itemType.toUpperCase().slice(0, 3)}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const notifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/payfast-itn`;

    const fullName = (user?.name || "Gruvs Member").trim();
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "Gruvs";
    const lastName = nameParts.slice(1).join(" ") || "Member";

    const data: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl || `https://thegruvs.com/payment/success?payment_id=${paymentId}`,
      cancel_url: cancelUrl || `https://thegruvs.com/payment/cancelled?payment_id=${paymentId}`,
      notify_url: notifyUrl,
      name_first: firstName,
      name_last: lastName,
      email_address: user?.email || "guest@thegruvs.com",
      m_payment_id: paymentId,
      amount: Number(amountZar).toFixed(2),
      item_name: String(itemName || "Gruvs Access").slice(0, 100),
      item_description: String(itemDescription || itemName || "Gruvs Access").slice(0, 255),
      custom_str1: String(app),
      custom_str2: String(itemType),
      custom_str3: String(user?.id || "anonymous"),
      custom_str4: JSON.stringify({ itemId, ...metadata }).slice(0, 250),
    };

    // Calculate MD5 signature according to PayFast specification
    const signature = generateSignature(data, passphrase);
    data["signature"] = signature;

    const queryParams = new URLSearchParams();
    for (const [k, v] of Object.entries(data)) {
      queryParams.append(k, v);
    }

    const paymentUrl = `${baseUrl}?${queryParams.toString()}`;

    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl,
        paymentId,
        fields: data,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
