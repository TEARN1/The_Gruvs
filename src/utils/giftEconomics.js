// ── Gift economics ────────────────────────────────────────────────────────────
// The honest split TikTok hides. Given a gift in coins, show EXACTLY where the
// money goes: store tax → platform share → creator earnings. Transparency is the
// differentiator (see CREATOR_MONETIZATION.md). Pure + currency-agnostic — all
// amounts come back in the same unit as `coinPrice`.
//
// IMPORTANT: this is the DISPLAY / math layer only. No money moves here. Real
// top-ups and payouts require a licensed PSP as merchant-of-record; The Gruvs
// must never hold or transmit fiat itself.

export const DEFAULT_COIN_PRICE = 0.20;     // what a buyer pays per coin (beachhead unit)
export const DEFAULT_PLATFORM_SHARE = 0.50; // Gruvs' share of the NET (after any store tax)

// Platform store tax on in-app digital goods. Buying coins on the WEB avoids it.
export const STORE_CUT = {
  web: 0,
  ios: 0.30, android: 0.30,           // standard
  ios_reduced: 0.15, android_reduced: 0.15, // small-business / post-first-year
};

const clamp01 = (x) => Math.min(1, Math.max(0, Number(x) || 0));
const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100;

export function buildGiftBreakdown(coins, opts = {}) {
  const n = Math.max(0, Math.floor(Number(coins) || 0));
  const coinPrice = opts.coinPrice > 0 ? opts.coinPrice : DEFAULT_COIN_PRICE;
  const storeCut = clamp01(opts.storeCut ?? STORE_CUT[opts.channel] ?? STORE_CUT.web);
  const platformShare = clamp01(opts.platformShare ?? DEFAULT_PLATFORM_SHARE);

  const gross = round2(n * coinPrice);        // what the buyer actually paid
  const storeFee = round2(gross * storeCut);  // Apple / Google tax
  const net = round2(gross - storeFee);       // what reaches the platform
  const platformFee = round2(net * platformShare);
  const creatorEarns = round2(net - platformFee);
  const creatorPct = gross > 0 ? Math.round((creatorEarns / gross) * 100) : 0;

  return { coins: n, gross, storeFee, net, platformFee, creatorEarns, creatorPct, storeCut, platformShare };
}

/** One honest line for the gift sheet: "You pay R20 · host gets R10 (50%)". */
export function describeGift(coins, opts = {}, fmt = (v) => v.toFixed(2)) {
  const b = buildGiftBreakdown(coins, opts);
  return `You pay ${fmt(b.gross)} · host gets ${fmt(b.creatorEarns)} (${b.creatorPct}%)`;
}
