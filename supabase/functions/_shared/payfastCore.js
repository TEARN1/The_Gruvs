// PayFast rules shared by the payfast-checkout and payfast-itn edge functions.
//
// Plain JavaScript with no Deno or Node APIs, so __tests__/payfastCore.test.js
// tests exactly what runs in production. The functions pass in what needs the
// runtime (environment variables, MD5).
//
// The rules:
// - Test (sandbox) mode only when PAYFAST_SANDBOX is "true". Otherwise live,
//   which needs real merchant details and a passphrase, or payment is refused.
// - The server sets the price and the buyer; the browser only says what it
//   wants to buy. The order is recorded before the buyer goes to PayFast.
// - A notification fulfils that recorded order only when the signature, the
//   merchant and the exact amount match, and only once.

export const SANDBOX_MERCHANT_ID = '10000100';
export const SANDBOX_MERCHANT_KEY = '46f0cd694581a';
/** PayFast's published passphrase for its public sandbox merchant. */
export const SANDBOX_PASSPHRASE = 'jt7NOE43FZPn';

/** What the browser may ask to pay for. */
export const ITEM_TYPES = ['ticket', 'booking', 'pitchin', 'business_boost'];

/** Items whose payment switches something on by itself; the rest are only recorded. */
export const FULFILLED_ITEM_TYPES = ['ticket', 'booking'];

/** Bounds for amounts the buyer chooses (a table pitch-in, a business boost). */
export const CHOSEN_MIN_CENTS = 500;
export const CHOSEN_MAX_CENTS = 1000000;

export class PayFastNotConfigured extends Error {
  constructor(message) {
    super(message);
    this.name = 'PayFastNotConfigured';
  }
}

/**
 * Reads the PayFast settings from an object of environment variables.
 * Throws PayFastNotConfigured when live mode lacks real details.
 */
export function payfastConfig(env) {
  const get = (k) => String((env && env[k]) || '').trim();
  const sandbox = get('PAYFAST_SANDBOX').toLowerCase() === 'true';
  const merchantId = get('PAYFAST_MERCHANT_ID');
  const merchantKey = get('PAYFAST_MERCHANT_KEY');
  const passphrase = get('PAYFAST_PASSPHRASE');

  if (sandbox) {
    return {
      sandbox: true,
      merchantId: merchantId || SANDBOX_MERCHANT_ID,
      merchantKey: merchantKey || SANDBOX_MERCHANT_KEY,
      passphrase: passphrase || SANDBOX_PASSPHRASE,
    };
  }
  if (!merchantId || !merchantKey || merchantId === SANDBOX_MERCHANT_ID || merchantKey === SANDBOX_MERCHANT_KEY) {
    throw new PayFastNotConfigured('Live PayFast needs PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY (set PAYFAST_SANDBOX=true for test mode).');
  }
  // Without a passphrase anyone could sign a notification.
  if (!passphrase || passphrase === SANDBOX_PASSPHRASE) {
    throw new PayFastNotConfigured('Live PayFast needs its own PAYFAST_PASSPHRASE.');
  }
  return { sandbox: false, merchantId, merchantKey, passphrase };
}

export function processUrl(sandbox) {
  return sandbox ? 'https://sandbox.payfast.co.za/eng/process' : 'https://www.payfast.co.za/eng/process';
}

export function validateUrl(sandbox) {
  return sandbox ? 'https://sandbox.payfast.co.za/eng/query/validate' : 'https://www.payfast.co.za/eng/query/validate';
}

const pfEncode = (v) => encodeURIComponent(String(v).trim()).replace(/%20/g, '+');
// PHP's urlencode, which PayFast's PHP samples use, also encodes ! ' ( ) * ~.
const phpEncode = (v) => pfEncode(v).replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/**
 * Free text made safe to sign: JavaScript and PHP encode ' ( ) ! * ~
 * differently, so an event title holding one could fail PayFast's own check.
 * The apostrophe becomes a typographic one; the rest are dropped.
 */
export function safeText(text, max) {
  return String(text ?? '')
    .replace(/'/g, '\u2019')
    .replace(/[!*()~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * The string PayFast signs (MD5) for a payment request or a notification: the
 * fields in the order given, empty ones and "signature" left out, then the
 * passphrase.
 */
export function signatureString(fields, passphrase) {
  const parts = [];
  for (const key of Object.keys(fields)) {
    const value = fields[key];
    if (key === 'signature' || value === undefined || value === null || String(value) === '') continue;
    parts.push(`${key}=${pfEncode(value)}`);
  }
  if (passphrase) parts.push(`passphrase=${pfEncode(passphrase)}`);
  return parts.join('&');
}

/**
 * Whether a notice carries our signature. `fields` are [name, value] pairs in
 * the order PayFast sent them; md5 is passed in by the runtime. PayFast's own
 * samples keep empty fields in the signed string and some libraries leave them
 * out, and its JavaScript and PHP samples encode a few characters differently,
 * so each form is accepted. Every form needs the passphrase.
 */
export function notificationSignatureOk(fields, passphrase, md5) {
  const sig = fields.find(([k]) => k === 'signature');
  const given = String(sig ? sig[1] : '').trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(given) || !passphrase) return false;
  const rest = fields.filter(([k]) => k !== 'signature');
  for (const encode of [pfEncode, phpEncode]) {
    for (const keepEmpty of [true, false]) {
      const parts = rest.filter(([, v]) => keepEmpty || String(v) !== '').map(([k, v]) => `${k}=${encode(v)}`);
      parts.push(`passphrase=${encode(passphrase)}`);
      if (md5(parts.join('&')) === given) return true;
    }
  }
  return false;
}

/** Rand to cents, or NaN when it is not a plain amount. */
export function toCents(value) {
  if (value === null || value === undefined) return NaN;
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return NaN;
  return Math.round(Number(text) * 100);
}

/** A paid tier's price in cents from the event's own rsvp_tiers, or null. */
export function ticketPriceCents(rsvpTiers, tierId) {
  if (!Array.isArray(rsvpTiers) || tierId === undefined || tierId === null) return null;
  const tier = rsvpTiers.find((t) => t && String(t.id) === String(tierId));
  if (!tier) return null;
  const cents = toCents(tier.price);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

/** An unpaid booking's amount in cents from the booking itself, or null. */
export function bookingPriceCents(booking) {
  if (!booking) return null;
  if (['captured', 'paid', 'escrow_held'].includes(String(booking.payment_status || '').toLowerCase())) return null;
  const cents = Number(booking.amount_cents);
  return Number.isInteger(cents) && cents > 0 ? cents : null;
}

/** A buyer-chosen amount in cents, within bounds, or null. */
export function chosenAmountCents(amountZar) {
  const cents = toCents(amountZar);
  return Number.isFinite(cents) && cents >= CHOSEN_MIN_CENTS && cents <= CHOSEN_MAX_CENTS ? cents : null;
}

const RETURN_PREFIXES = ['https://thegruvs.com/', 'https://www.thegruvs.com/', 'thegruvs://'];

/** Where PayFast sends the buyer back: only our own site or app. */
export function safeReturnUrl(url, fallback) {
  const text = String(url || '');
  return RETURN_PREFIXES.some((p) => text.startsWith(p)) ? text.slice(0, 500) : fallback;
}

/**
 * Whether a notification may touch the recorded order.
 * Returns { ok: true } or { ok: false, status, reason }; { already: true } when
 * the order was fulfilled before (PayFast resends notifications).
 */
export function checkNotification({ params, config, order, signatureOk }) {
  if (!signatureOk) return { ok: false, status: 400, reason: 'Signature mismatch' };
  if (!params || params.merchant_id !== config.merchantId) return { ok: false, status: 400, reason: 'Wrong merchant' };
  if (!order) return { ok: false, status: 404, reason: 'Unknown order' };
  if (order.app && order.app !== 'thegruvs') return { ok: false, status: 400, reason: 'Not a Gruvs order' };
  const paid = toCents(params.amount_gross);
  if (!Number.isFinite(paid) || paid !== Number(order.expected_amount_cents)) {
    return { ok: false, status: 400, reason: 'Amount does not match the order' };
  }
  if (order.fulfilled_at) return { ok: true, already: true };
  return { ok: true };
}
