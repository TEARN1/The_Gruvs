/**
 * Currency display — "symbol/format only" (amounts are NOT converted).
 *
 * The app stores prices as plain numbers (historically South African Rand).
 * Based on the viewer's location we render that same number with the local
 * currency's symbol and grouping — e.g. 1500 shows as "R 1,500" in ZA, "$1,500"
 * in the US, "₦1,500" in NG. No exchange-rate maths is applied.
 */

// symbolSpace: put a thin space between symbol and number (reads better for
// word-ish symbols like R / KSh / CFA).
export const CURRENCIES = {
  ZAR: { code: 'ZAR', symbol: 'R',    name: 'South African Rand', symbolSpace: true },
  USD: { code: 'USD', symbol: '$',    name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€',    name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£',    name: 'British Pound' },
  NGN: { code: 'NGN', symbol: '₦',    name: 'Nigerian Naira' },
  KES: { code: 'KES', symbol: 'KSh',  name: 'Kenyan Shilling', symbolSpace: true },
  GHS: { code: 'GHS', symbol: 'GH₵',  name: 'Ghanaian Cedi', symbolSpace: true },
  EGP: { code: 'EGP', symbol: 'E£',   name: 'Egyptian Pound', symbolSpace: true },
  TZS: { code: 'TZS', symbol: 'TSh',  name: 'Tanzanian Shilling', symbolSpace: true },
  UGX: { code: 'UGX', symbol: 'USh',  name: 'Ugandan Shilling', symbolSpace: true },
  ZMW: { code: 'ZMW', symbol: 'ZK',   name: 'Zambian Kwacha', symbolSpace: true },
  BWP: { code: 'BWP', symbol: 'P',    name: 'Botswana Pula', symbolSpace: true },
  NAD: { code: 'NAD', symbol: 'N$',   name: 'Namibian Dollar', symbolSpace: true },
  MAD: { code: 'MAD', symbol: 'DH',   name: 'Moroccan Dirham', symbolSpace: true },
  XOF: { code: 'XOF', symbol: 'CFA',  name: 'West African CFA', symbolSpace: true },
  XAF: { code: 'XAF', symbol: 'FCFA', name: 'Central African CFA', symbolSpace: true },
  INR: { code: 'INR', symbol: '₹',    name: 'Indian Rupee' },
  AUD: { code: 'AUD', symbol: 'A$',   name: 'Australian Dollar' },
  CAD: { code: 'CAD', symbol: 'C$',   name: 'Canadian Dollar' },
  AED: { code: 'AED', symbol: 'AED',  name: 'UAE Dirham', symbolSpace: true },
  BRL: { code: 'BRL', symbol: 'R$',   name: 'Brazilian Real', symbolSpace: true },
};

export const DEFAULT_CURRENCY = CURRENCIES.ZAR;

// ISO 3166-1 alpha-2 country → currency code. Eurozone members all map to EUR.
const COUNTRY_TO_CURRENCY = {
  ZA: 'ZAR', US: 'USD', GB: 'GBP', NG: 'NGN', KE: 'KES', GH: 'GHS', EG: 'EGP',
  TZ: 'TZS', UG: 'UGX', ZM: 'ZMW', BW: 'BWP', NA: 'NAD', MA: 'MAD', IN: 'INR',
  AU: 'AUD', CA: 'CAD', AE: 'AED', BR: 'BRL',
  // West African CFA
  SN: 'XOF', CI: 'XOF', ML: 'XOF', BF: 'XOF', BJ: 'XOF', TG: 'XOF', NE: 'XOF',
  // Central African CFA
  CM: 'XAF', GA: 'XAF', CG: 'XAF', TD: 'XAF', CF: 'XAF',
  // Eurozone
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', PT: 'EUR', NL: 'EUR', BE: 'EUR',
  IE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR',
};

export const currencyForCountry = (countryCode) => {
  const code = COUNTRY_TO_CURRENCY[String(countryCode || '').toUpperCase()];
  return CURRENCIES[code] || DEFAULT_CURRENCY;
};

const groupThousands = (intStr) => intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * Format an amount in the given currency. Whole numbers show no decimals;
 * fractional amounts show two. The number itself is never converted.
 *
 * @param {number} amount
 * @param {object|string} currency  CURRENCIES entry or its code (default ZAR)
 * @param {object} [opts]
 * @param {boolean} [opts.decimals] force two decimals (e.g. for totals)
 */
export const formatPrice = (amount, currency = DEFAULT_CURRENCY, opts = {}) => {
  const c = (typeof currency === 'string' ? CURRENCIES[currency] : currency) || DEFAULT_CURRENCY;
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${c.symbol}${c.symbolSpace ? ' ' : ''}0`;

  const neg = n < 0;
  const abs = Math.abs(n);
  const forceDecimals = opts.decimals || Math.abs(abs % 1) > 1e-9;
  const fixed = forceDecimals ? abs.toFixed(2) : String(Math.round(abs));
  const [intPart, frac] = fixed.split('.');
  const body = groupThousands(intPart) + (frac ? `.${frac}` : '');
  return `${neg ? '-' : ''}${c.symbol}${c.symbolSpace ? ' ' : ''}${body}`;
};

// ── Active currency (module-global) ──────────────────────────────────────────
// CurrencyProvider keeps this in sync with the resolved/chosen currency so that
// the `money()` helper works the same in components, services and plain helper
// functions (where a React hook isn't available). It's resolved once at launch
// from GPS (cached), so by the time a price screen mounts it's already correct.
let _active = DEFAULT_CURRENCY;
let _rate = 1; // ZAR → active-currency rate (1 = no conversion / offline fallback)

export const setActiveCurrency = (currency) => {
  _active = (typeof currency === 'string' ? CURRENCIES[currency] : currency) || DEFAULT_CURRENCY;
};

// CurrencyProvider sets this from fxService once rates load. When it's 1 (ZAR,
// or offline) prices are shown symbol-only with no conversion.
export const setActiveRate = (rate) => { _rate = (typeof rate === 'number' && rate > 0) ? rate : 1; };

export const getActiveCurrency = () => _active;
export const getActiveRate = () => _rate;

/**
 * Format a stored (ZAR) amount in the viewer's active currency, converting via
 * the active FX rate. With rate 1 this is plain symbol/format only.
 */
export const money = (amount, opts) => {
  const n = Number(amount);
  const value = Number.isFinite(n) ? n * _rate : amount;
  return formatPrice(value, _active, opts);
};

export default CURRENCIES;