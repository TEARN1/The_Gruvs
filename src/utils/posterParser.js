/**
 * posterParser — turn messy OCR text off an event poster into the exact fields
 * The Gruvs' "Post a Gruv" form needs, so a host uploads a flyer and reviews
 * pre-filled details instead of typing everything.
 *
 * Pure + deterministic (no AI, no network) → heavily unit-tested. OCR is
 * imperfect on stylised fonts, so every field is best-effort and returned with
 * a `fields` map of what we actually detected; the UI pre-fills those and lets
 * the host correct anything.
 *
 * Handles South-African conventions: DD/MM dates, Rand prices, `21h00` times,
 * SA cities, local ticketing sites, 18+/21+ gates.
 */

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_RE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

// The Gruvs is GLOBAL — South Africa is the launch market, not the scope. SA is
// listed in depth (suburb-level, because that's where the first hosts are), then
// the world's major event cities. Longest names are matched first so "cape town"
// can't be shadowed by a shorter entry.
const SA_CITIES = [
  // South Africa — deep, suburb level
  'johannesburg', 'joburg', 'jozi', 'sandton', 'soweto', 'midrand', 'randburg', 'roodepoort',
  'pretoria', 'centurion', 'tshwane', 'cape town', 'kaapstad', 'durban', 'ethekwini', 'umhlanga',
  'port elizabeth', 'gqeberha', 'bloemfontein', 'polokwane', 'nelspruit', 'mbombela', 'kimberley',
  'rustenburg', 'east london', 'pietermaritzburg', 'stellenbosch', 'kempton park', 'benoni',
  'boksburg', 'germiston', 'vereeniging', 'welkom', 'george', 'knysna', 'ballito', 'edenvale',
  'krugersdorp', 'vanderbijlpark', 'newcastle', 'witbank', 'emalahleni',
  // Africa
  'lagos', 'abuja', 'accra', 'nairobi', 'mombasa', 'kampala', 'dar es salaam', 'kigali',
  'addis ababa', 'cairo', 'casablanca', 'marrakech', 'dakar', 'abidjan', 'lusaka', 'harare',
  'gaborone', 'windhoek', 'maputo', 'kinshasa', 'douala', 'yaounde', 'luanda', 'port louis',
  // Europe
  'london', 'manchester', 'birmingham', 'glasgow', 'dublin', 'paris', 'marseille', 'lyon',
  'berlin', 'munich', 'hamburg', 'cologne', 'frankfurt', 'amsterdam', 'rotterdam', 'brussels',
  'madrid', 'barcelona', 'valencia', 'lisbon', 'porto', 'rome', 'milan', 'naples', 'vienna',
  'zurich', 'geneva', 'prague', 'warsaw', 'budapest', 'stockholm', 'oslo', 'copenhagen',
  'helsinki', 'athens', 'istanbul', 'ibiza', 'mykonos',
  // Americas
  'new york', 'brooklyn', 'los angeles', 'chicago', 'houston', 'miami', 'atlanta', 'boston',
  'san francisco', 'seattle', 'las vegas', 'austin', 'philadelphia', 'washington', 'detroit',
  'new orleans', 'toronto', 'vancouver', 'montreal', 'mexico city', 'sao paulo', 'rio de janeiro',
  'buenos aires', 'bogota', 'lima', 'santiago', 'kingston',
  // Asia-Pacific & Middle East
  'dubai', 'abu dhabi', 'doha', 'riyadh', 'tel aviv', 'mumbai', 'delhi', 'new delhi',
  'bangalore', 'bengaluru', 'goa', 'hyderabad', 'chennai', 'kolkata', 'karachi', 'lahore',
  'bangkok', 'singapore', 'kuala lumpur', 'jakarta', 'manila', 'hong kong', 'shanghai',
  'beijing', 'tokyo', 'osaka', 'seoul', 'taipei', 'sydney', 'melbourne', 'brisbane', 'perth',
  'auckland', 'wellington',
].sort((a, b) => b.length - a.length);
const VENUE_WORDS = /\b(club|lounge|arena|hall|centre|center|convention|park|rooftop|stadium|theatre|theater|bar|hotel|resort|gardens?|racecourse|amphitheatre|dome|grounds?|venue|palace|hub|studio|deck|yard|warehouse|estate|winery|vineyard|cafe|restaurant|market|expo)\b/i;
const TICKET_SITES = /(quicket|webtickets|computicket|howler|ticketpro|plankton|nutickets)\.?[a-z.]*/i;

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const titleCase = (s) => clean(s).replace(/\b\w/g, (c) => c.toUpperCase());
const pad = (n) => String(n).padStart(2, '0');

// ── Date ─────────────────────────────────────────────────────────────────────
// Returns 'YYYY-MM-DD' or null. Year is inferred to the next future occurrence
// when the poster omits it (as most do).
export function parseDate(text, now = new Date(), dateOrder = 'DMY') {
  const t = ' ' + text.toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1') + ' ';
  const thisYear = now.getFullYear();
  const inferYear = (mo, day) => {
    // choose the year (this or next) that isn't already in the past
    const candidate = new Date(thisYear, mo - 1, day);
    return candidate.getTime() < now.setHours(0, 0, 0, 0) ? thisYear + 1 : thisYear;
  };
  const mk = (y, mo, d) => {
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${pad(mo)}-${pad(d)}`;
  };

  // ISO: 2026-07-05
  let m = t.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return mk(+m[1], +m[2], +m[3]);

  // "5 July 2026" | "5 July" | "5th of July"
  m = t.match(new RegExp(`\\b(\\d{1,2})\\s*(?:of\\s+)?(${MONTH_RE})\\.?(?:\\s*,?\\s*(20\\d{2}))?`, 'i'));
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3)] || MONTHS[m[2]];
    const d = +m[1], y = m[3] ? +m[3] : inferYear(mo, d);
    const r = mk(y, mo, d); if (r) return r;
  }

  // "July 5, 2026" | "Jul 5"
  m = t.match(new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:\\s*,?\\s*(20\\d{2}))?`, 'i'));
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3)] || MONTHS[m[1]];
    const d = +m[2], y = m[3] ? +m[3] : inferYear(mo, d);
    const r = mk(y, mo, d); if (r) return r;
  }

  // Slash dates — the ONLY genuinely ambiguous format, and the one that silently
  // destroys an event. "05/07/2026" is 5 July in ZA/UK/NG, but 7 May in the US.
  // `dateOrder` comes from the host's country (GPS → locale → ZA); a US flyer is
  // read month-first, everyone else day-first.
  m = t.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (m) {
    const a = +m[1], b = +m[2];
    let d, mo;
    if (dateOrder === 'MDY') { mo = a; d = b; } else { d = a; mo = b; }
    // Whatever the convention, a value > 12 can only be the day — trust the
    // number over the convention (a typo'd order is better than an invalid date).
    if (mo > 12 && d <= 12) { const tmp = d; d = mo; mo = tmp; }
    let y = m[3] ? +m[3] : inferYear(mo, d);
    if (y < 100) y += 2000;
    const r = mk(y, mo, d); if (r) return r;
  }

  // Relative dates — the WhatsApp/Instagram case. A blast almost never carries
  // a calendar date; it says "this saturday" or just "FRIDAY". Only reached
  // when no explicit date matched, so an explicit date always wins.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const shift = (days) => { const d = new Date(today); d.setDate(d.getDate() + days); return iso(d); };

  if (/\b(tonight|today)\b/.test(t)) return shift(0);
  if (/\btomorrow\b/.test(t)) return shift(1);

  const wd = t.match(/\b(?:(this|next|coming)\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*day?\b/);
  if (wd) {
    const idx = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }[wd[2]];
    let delta = (idx - today.getDay() + 7) % 7;
    // "next friday" said ON a Friday means the one coming, not today.
    if (delta === 0 && wd[1] === 'next') delta = 7;
    return shift(delta);
  }
  return null;
}

// ── Time ─────────────────────────────────────────────────────────────────────
// Returns { start:{h,m}, end:{h,m}|null } or null.
export function parseTime(text) {
  const t = text.toLowerCase();
  const toHM = (raw) => {
    let mm = raw.match(/(\d{1,2})\s*[:h.]\s*(\d{2})?\s*(am|pm)?/);
    if (!mm) { mm = raw.match(/(\d{1,2})\s*(am|pm)/); if (mm) return norm(+mm[1], 0, mm[2]); return null; }
    return norm(+mm[1], mm[2] ? +mm[2] : 0, mm[3]);
  };
  const norm = (h, m, ap) => {
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h > 23 || m > 59) return null;
    return { h, m };
  };
  // range: "20h00 - 02h00", "8pm til 2am", "9pm to late"
  const range = t.match(/(\d{1,2}\s*[:h.]?\s*\d{0,2}\s*(?:am|pm)?)\s*(?:-|–|to|till?|til|until)\s*(\d{1,2}\s*[:h.]?\s*\d{0,2}\s*(?:am|pm)?)/);
  if (range) {
    const s = toHM(range[1]); const e = toHM(range[2]);
    if (s) return { start: s, end: e || null };
  }
  // single: prefer one prefixed by doors/from/start/@/time
  const cued = t.match(/(?:doors?|from|start(?:s|ing)?|time|@)\s*:?\s*(\d{1,2}\s*[:h.]?\s*\d{0,2}\s*(?:am|pm)?)/);
  if (cued) { const s = toHM(cued[1]); if (s) return { start: s, end: null }; }
  const any = t.match(/\b(\d{1,2}\s*[:h]\s*\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/);
  if (any) { const s = toHM(any[1]); if (s) return { start: s, end: null }; }
  return null;
}

// ── Price ────────────────────────────────────────────────────────────────────
/**
 * Currency tokens we accept on a poster, ANYWHERE in the world. The Gruvs is
 * global — South Africa is the launch market, not the scope — so a flyer saying
 * "$25", "£15", "€20", "₦5000" or "KSh 1500" must parse exactly like "R150".
 * Order matters: longer tokens first, so "R$" (Brazil) beats a bare "R".
 */
const CURRENCY_TOKEN = '(?:R\\$|GH₵|FCFA|CFA|KSh|TSh|USh|N\\$|A\\$|C\\$|E£|AED|ZK|DH|USD|EUR|GBP|ZAR|NGN|KES|INR|NAIRA|RAND|DOLLARS?|EUROS?|POUNDS?|RUPEES?|[R$€£₦₹₵₱¥])';

/**
 * "R1.500" is R1 500 (a thousands separator — common on SA/EU flyers), NOT R1.50.
 * Reading it as 1 is the difference between a R1 500 wine flight and a R1 one.
 * Rule: a dot followed by exactly 3 digits is a separator; 1-2 digits is cents.
 */
function randToNumber(raw) {
  const s = String(raw).replace(/[\s,]/g, '');
  const dot = s.match(/^(\d+)\.(\d{1,3})$/);
  if (dot) {
    if (dot[2].length === 3) return parseInt(dot[1] + dot[2], 10); // 1.500 → 1500
    return Math.round(parseFloat(s));                              // 1.50  → 2 (cents)
  }
  return parseInt(s, 10);
}

// Returns { amount:number|null, isFree:bool, fromPrice:bool }.
export function parsePrice(text) {
  const t = text.toLowerCase();
  if (/\b(free entry|free admission|no cover|entrance free|free event|gratis)\b/.test(t) ||
      /\bfree\b/.test(t) && !new RegExp(`${CURRENCY_TOKEN}\\s?\\d`, 'i').test(text)) {
    return { amount: 0, isFree: true, fromPrice: false };
  }
  // Any currency, not just Rand — The Gruvs is global; South Africa is only the
  // launch market. A symbol/code must START a word, otherwise the trailing R of
  // an ordinary word swallows the next number ("NO UNDE-R 18s" → R18), which
  // silently publishes a wrong price.
  const amounts = [];
  const re = new RegExp(`(?:^|[^a-z0-9])${CURRENCY_TOKEN}\\s?([\\d][\\d\\s,]*(?:\\.\\d{1,3})?)`, 'gi');
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = randToNumber(m[1]);
    if (Number.isFinite(n) && n > 0 && n < 10000000) amounts.push(n);
  }
  // Trailing-symbol styles too: "25 €", "5000 naira", "15 USD".
  const reAfter = new RegExp(`\\b([\\d][\\d\\s,]*(?:\\.\\d{1,3})?)\\s?${CURRENCY_TOKEN}\\b`, 'gi');
  while ((m = reAfter.exec(text)) !== null) {
    const n = randToNumber(m[1]);
    if (Number.isFinite(n) && n > 0 && n < 10000000) amounts.push(n);
  }
  if (!amounts.length) return { amount: null, isFree: false, fromPrice: false, vip: null, vvip: null };
  const min = Math.min(...amounts);
  const fromPrice = /\bfrom\b/.test(t) || amounts.length > 1;
  // Tiered pricing: pull the amount that sits right after a VIP / VVIP label.
  const labelled = (label) => {
    const m = text.match(new RegExp(`${label}[^\\d]{0,14}${CURRENCY_TOKEN}\\s?([\\d][\\d\\s,]*(?:\\.\\d{1,3})?)`, 'im'));
    if (!m) return null;
    const n = randToNumber(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const vvip = labelled('vvip');
  let vip = labelled('vip');
  if (vip && vvip && vip === vvip) vip = null; // the "vip" regex can catch the "vvip" line
  return { amount: min, isFree: false, fromPrice, vip, vvip };
}

// ── Category ─────────────────────────────────────────────────────────────────
const CATEGORY_HINTS = [
  ['nightlife', /\b(party|club|nightclub|rave|dj|djs|after ?party|turn ?up|lush|amapiano|house party|night out)\b/],
  ['music', /\b(concert|live music|gig|band|festival|acoustic|jazz|hip ?hop|rnb|album|tour|singer|orchestra|choir)\b/],
  ['sport', /\b(soccer|football|rugby|cricket|match|tournament|cup|league|netball|boxing|marathon|race|athletics|derby|fixture)\b/],
  ['comedy', /\b(comedy|stand ?up|comedian|open mic laughs?)\b/],
  ['art', /\b(art|exhibition|gallery|painting|sculpture|installation|artist showcase)\b/],
  ['food', /\b(food|market|tasting|braai|dinner|cuisine|halaal|halal|culinary|restaurant week|street food)\b/],
  ['biz', /\b(business|networking|expo|summit|conference|seminar|masterclass|pitch|entrepreneur|b2b|trade show)\b/],
  ['fashion', /\b(fashion|runway|couture|gala|showcase|model|style)\b/],
  ['dance', /\b(dance|ballet|choreo|dance battle|amapiano dance)\b/],
  ['wellness', /\b(wellness|yoga|meditation|retreat|healing|spa|mindful)\b/],
  ['festival', /\b(festival|fest|carnival|fiesta)\b/],
  ['film', /\b(film|movie|screening|cinema|premiere|documentary)\b/],
  ['edu', /\b(workshop|training|course|bootcamp|lecture|class|skills)\b/],
  ['dating', /\b(singles|speed dating|mingle|match|blind date|social mixer)\b/],
  ['property', /\b(property|real estate|investment seminar|homes? expo)\b/],
  ['tech', /\b(tech|technology|hackathon|ai|startup|coding|developer)\b/],
];
export function detectCategories(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  const hits = [];
  for (const [key, re] of CATEGORY_HINTS) if (re.test(t)) hits.push(key);
  return [...new Set(hits)].slice(0, 3);
}

// ── Power during load-shedding ('generator' | 'solar' | 'ups') ───────────────
export function parsePower(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  if (/\b(solar[- ]?powered|solar power|solar)\b/.test(t)) return 'solar';
  if (/\b(ups|inverter|battery backup)\b/.test(t)) return 'ups';
  if (/\b(generator|genny|back-?up power|load[- ]?shedding proof|loadshedding proof|power back-?up)\b/.test(t)) return 'generator';
  return null;
}

// ── "Good to know" tags (accessibility · sensory · vibe · safety) ────────────
// Keys MUST match src/constants/EventTags.js
const TAG_HINTS = [
  ['wheelchair',          /\b(wheelchair|wheel ?chair)\b/],
  ['accessible_restroom', /\b(accessible (restroom|toilet|bathroom))\b/],
  ['seating',             /\b(seating|seated|chairs provided)\b/],
  ['quiet_zone',          /\b(quiet zone|chill (zone|room)|calm space)\b/],
  ['strobe',              /\b(strobe|flashing lights)\b/],
  ['loud',                /\b(very loud|loud music|high volume)\b/],
  ['pyro',                /\b(pyro|pyrotechnics|fireworks|flames)\b/],
  ['sober_friendly',      /\b(sober[- ]?friendly|alcohol[- ]?free|no alcohol|dry event)\b/],
  ['all_ages',            /\b(all ages|family[- ]?friendly|kids welcome|child friendly)\b/],
  ['gated_parking',       /\b(gated parking|secure parking|safe parking)\b/],
  ['car_guards',          /\b(car guards?)\b/],
  ['uber_dropoff',        /\b(uber|bolt) (drop[- ]?off|friendly)\b|\buber drop\b/],
  ['eco_friendly',        /\b(eco[- ]?friendly|green event|zero waste|sustainable)\b/],
  ['near_transit',        /\b(near transit|gautrain|train station|taxi rank|public transport)\b/],
];
export function detectEventTags(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  return [...new Set(TAG_HINTS.filter(([, re]) => re.test(t)).map(([k]) => k))];
}

// ── Event format — must match EVENT_TYPES in PostEventModal ──────────────────
const FORMAT_HINTS = [
  ['Rave',        /\brave\b/],
  ['Festival',    /\b(festival|fest|carnival)\b/],
  ['Concert',     /\b(concert|live music|gig|band|tour)\b/],
  ['Conference',  /\b(conference|summit|expo|convention)\b/],
  ['Workshop',    /\b(workshop|masterclass|training|bootcamp|seminar|class)\b/],
  ['Competition', /\b(competition|tournament|cup|league|championship|contest)\b/],
  ['Market',      /\b(market|bazaar|fair|flea)\b/],
  ['Pop-Up',      /\b(pop[- ]?up)\b/],
  ['Retreat',     /\b(retreat|getaway)\b/],
  ['Meetup',      /\b(meet[- ]?up|networking|mixer)\b/],
  ['Party',       /\b(party|club night|after ?party|turn ?up)\b/],
  ['Social',      /\b(social|mingle|singles|hangout|picnic)\b/],
];
export function parseEventFormat(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  for (const [type, re] of FORMAT_HINTS) if (re.test(t)) return type;
  return '';
}

// ── Secret headliner ─────────────────────────────────────────────────────────
export function parseSecretAct(text) {
  const m = text.match(/(?:secret headliner|surprise (?:act|guest|headliner)|special guest|mystery guest)\s*[:\-–]\s*([^\n,.|]{2,60})/i);
  if (m) return clean(m[1]);
  // Mentioned but unnamed → flag it so the host knows to fill it in.
  if (/\b(secret headliner|surprise (act|guest|headliner)|mystery guest|special guest|tba headliner)\b/i.test(text)) return 'TBA';
  return '';
}

// ── Age range (min–max) ──────────────────────────────────────────────────────
// Only with an explicit age cue, so prices/times can never be misread as ages.
export function parseAgeRange(text) {
  const t = text.toLowerCase();
  let m = t.match(/\bages?\s*:?\s*(\d{2})\s*(?:-|–|to)\s*(\d{2})\b/);
  if (!m) m = t.match(/\b(\d{2})\s*(?:-|–|to)\s*(\d{2})\s*(?:years?|yrs?|year[- ]olds?|yo)\b/);
  if (m) {
    const min = +m[1], max = +m[2];
    if (min >= 13 && max <= 99 && min < max) return { min, max };
  }
  return { min: 0, max: 0 };
}

// ── OCR repair ───────────────────────────────────────────────────────────────
// Tesseract routinely misreads digits as letters on stylised poster fonts:
// R150 → "RI5O", 21:00 → "2I:OO". Left alone that yields a wrong price or a
// missing time. We only rewrite inside a *numeric context* (after an R, or in a
// clock token) and only when the token still contains at least one real digit —
// so ordinary words like ROOFTOP or LOUNGE are never touched.
const OCR_DIGIT = { O: '0', o: '0', Q: '0', D: '0', I: '1', l: '1', L: '1', i: '1', Z: '2', z: '2', S: '5', s: '5', B: '8', G: '6', T: '7', b: '6' };
const toDigits = (s) => s.replace(/[A-Za-z]/g, (c) => OCR_DIGIT[c] ?? c);
const hasDigit = (s) => /\d/.test(s);
export function normalizeOcr(raw) {
  let t = String(raw || '');
  // Prices: R150, R 1 500, R2.5k …
  t = t.replace(/\bR\s?([0-9OoQDIlLiZzSsBGTb]{2,})\b/g, (m, num) => (hasDigit(num) ? `R${toDigits(num)}` : m));
  // Clock tokens: 21:00, 2I:OO, 18h30
  t = t.replace(/\b([0-9OoQDIlLiZzSsBGTb]{1,2})\s*([:h])\s*([0-9OoQDIlLiZzSsBGTb]{2})\b/g, (m, h, sep, min) => {
    if (!hasDigit(h + min)) return m;
    const H = toDigits(h), M = toDigits(min);
    if (!/^\d{1,2}$/.test(H) || !/^\d{2}$/.test(M) || +H > 23 || +M > 59) return m;
    return `${H}${sep}${M}`;
  });
  return t;
}

// ── Ticket tiers beyond entry/VIP/VVIP (Early Bird, Phase 1, Table…) ────────
const TIER_NAME = /\b(early ?bird|phase\s*\d|presale|pre-?sale|general admission|general|standard|golden circle|table(?: booking)?|booth|group(?: of \d+)?|student|couples?|door|at the gate|gate|season pass|weekend pass|day pass)\b/i;
export function parseTiers(text) {
  const tiers = [];
  const seen = new Set();
  // Split on the separators SA flyers actually use, so one line can hold many.
  for (const chunk of String(text || '').split(/\n|·|\||•|,|\s{2,}/)) {
    const name = chunk.match(TIER_NAME);
    if (!name) continue;
    const amt = chunk.match(new RegExp(`(?:^|[^a-z0-9])${CURRENCY_TOKEN}\\s?(\\d[\\d\\s,]*(?:\\.\\d{1,3})?)`, 'i')) || chunk.match(/\b(\d{2,5})\b/);
    if (!amt) continue;
    const price = randToNumber(amt[1]);
    if (!Number.isFinite(price) || price <= 0 || price > 100000) continue;
    const label = clean(name[0]).replace(/\b\w/g, (c) => c.toUpperCase());
    const key = `${label.toLowerCase()}|${price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tiers.push({ name: label, price: String(price) });
  }
  return tiers.slice(0, 6);
}

// ── Lineup / running order → schedule slots ─────────────────────────────────
// "21:00 Kabza De Small" · "22h30 — DJ Maphorisa (live set)" · "23:00 - 00:00 Uncle Waffles"
export function parseLineup(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const l = clean(raw);
    const m = l.match(/^(\d{1,2})\s*[:h.]\s*(\d{2})\s*(?:(?:-|–|—|till|to)\s*\d{1,2}\s*[:h.]?\s*\d{0,2})?\s*[-–—:|·]?\s*(.+)$/i);
    if (!m) continue;
    const h = +m[1], min = +m[2];
    if (h > 23 || min > 59) continue;
    let act = clean(m[3]).replace(/^[-–—:|·]\s*/, '');
    const notes = (act.match(/\(([^)]{2,40})\)/) || [])[1] || '';
    act = clean(act.replace(/\([^)]*\)/g, ''));
    // A slot needs a real act name, not a leftover price or date fragment.
    if (act.length < 2 || act.length > 60) continue;
    if (/^R\s?\d/i.test(act) || !/[a-z]{2,}/i.test(act)) continue;
    if (DATE_WORDS.test(act)) continue;
    out.push({
      time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
      title: act,
      performer: act,
      notes,
    });
  }
  // One time on its own isn't a lineup — that's just the start time.
  return out.length >= 2 ? out.slice(0, 12) : [];
}
const DATE_WORDS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|mon|tue|wed|thu|fri|sat|sun)\w*\b/i;

// A line is "metadata" when its content is already captured as a structured
// field — keeping it in the description just makes the host delete it by hand.
const META_LINE = new RegExp([
  '(^|[^a-z])r\\s?\\d',                       // a Rand price (R must start a word)
  '\\bfree\\b', '\\bages?\\b.*\\d', '\\d{2}\\s*\\+',
  'https?://', 'www\\.', '@', '\\b0\\d{2}[\\s-]?\\d{3}[\\s-]?\\d{4}\\b',
  '\\btickets?\\b', '\\brsvp\\b', '\\bdoors?\\b', '\\bentry\\b', '\\bentrance\\b',
  '\\bcontact\\b', '\\binfo\\b', '\\bgates?\\s+open\\b',
  '\\b(generator|solar|inverter|load.?shedding)\\b',
  '\\b(wheelchair|parking|car guards?|strobe|sober|eco.?friendly)\\b',
  '\\bline.?up\\b',
  // Label lines ("VENUE: ...", "TIME: ...") — the value is already a field.
  '^(venue|location|where|when|time|date|price|cost|address)\\s*:',
  '^[^a-z0-9]+$',                             // pure decoration: "~~~", "***"
].join('|'), 'i');

// ── Contact / links ──────────────────────────────────────────────────────────
// Phones worldwide, not just +27. The Gruvs is global — a +44, +1 or +234 flyer
// must work exactly as well as a South African one. An international number
// wins; otherwise fall back to a local trunk-0 number.
const parsePhone = (t) => {
  const intl = t.match(/\+\d{1,3}[\s-]?(?:\(?\d{1,4}\)?[\s-]?){1,4}\d{2,4}/);
  if (intl && intl[0].replace(/\D/g, '').length >= 9) return intl[0].replace(/[\s\-().]/g, '');
  const local = t.match(/\b0\d{1,2}[\s-]?\d{3}[\s-]?\d{3,4}\b/);
  return local ? local[0].replace(/[\s-]/g, '') : null;
};
const parseEmail = (t) => { const m = t.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i); return m ? m[0] : null; };
const parseUrl = (t) => {
  let m = t.match(/https?:\/\/[^\s]+/i); if (m) return m[0].replace(/[.,)]+$/, '');
  m = t.match(TICKET_SITES); if (m) return 'https://' + m[0];
  return null;
};
const parseAge = (t) => {
  const m = t.toLowerCase().match(/\b(18|21|20|16)\s*\+|\bno under[- ]?(18|21|20|16)|over\s?(18|21)/);
  if (!m) return null;
  return +(m[1] || m[2] || m[3]);
};

// ── Venue / city / address ───────────────────────────────────────────────────
// Marketing copy is not a venue. "Rooftop rave with the best view in the city"
// contains a venue word ("rooftop") but is prose — filling it into the Venue
// field is worse than leaving the field empty for the host.
const PROSE_WORDS = /\b(with|come|join|we|us|our|your|you|best|biggest|don'?t|miss|bring|expect|enjoy|experience|featuring|presents|ready|get)\b/i;
const looksLikeProse = (s) => {
  const words = s.trim().split(/\s+/);
  return words.length > 5 && PROSE_WORDS.test(s);
};
// "R350 AT THE DOOR" is a PRICE, not a place. Ticket/entry words after an "at"
// cue are the single most common way the venue field gets a garbage value.
const NOT_A_VENUE = /^(the\s+)?(door|gate|entrance|gates|box office|late|night|sunset|sunrise)\b|\br\s?\d/i;
const asVenue = (s) => {
  const v = clean(String(s)).replace(/^[~*\-–—•|]+\s*/, '').replace(/[.!,;:]+$/, '');
  if (!v || v.length > 80) return null;
  if (!/[a-z]{2,}/i.test(v)) return null;          // needs real letters
  if (looksLikeProse(v)) return null;              // it's copy, not a place
  if (NOT_A_VENUE.test(v)) return null;            // it's a price/entry note
  return v;
};
function parseVenue(lines) {
  // Prefer an "@ Venue" / "at Venue" / "Venue:" cue, else a line that is
  // predominantly a venue name, else a line that looks like a street address.
  for (const l of lines) {
    const cue = l.match(/(?:^|\s)(?:@|at|venue|location|where)\s*:?\s*(.+)$/i);
    if (!cue) continue;
    const v = asVenue(cue[1]);
    if (v && (VENUE_WORDS.test(v) || /\d/.test(v) || v.split(' ').length <= 6)) return v;
  }
  for (const l of lines) {
    if (!VENUE_WORDS.test(l)) continue;
    const v = asVenue(l);
    // A bare keyword line is only a venue if it reads like a name, not a sentence.
    if (v && v.split(/\s+/).length <= 8) return v;
  }
  for (const l of lines) {
    if (!/\b(street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|blvd|boulevard)\b/i.test(l)) continue;
    const v = asVenue(l);
    if (v) return v;
  }
  // Last resort: a SHORT line that names a place ("KONKA SOWETO", "emmarentia
  // dam jhb"). Most SA venues aren't in any keyword list, but they're almost
  // always written next to the suburb/city — that's the signal.
  //
  // NEVER the first line: that's the headline slot on every flyer, and titles
  // routinely carry a place name ("SOWETO DERBY FUN DAY") — taking it as the
  // venue steals the title and leaves the title field to grab junk.
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (!parseCity(l)) continue;
    const v = asVenue(l);
    if (v && v.split(/\s+/).length <= 6 && !parseDate(l) && !parseTime(l)) return v;
  }
  return null;
}
// SA shorthand — how people ACTUALLY write it in a WhatsApp blast.
const CITY_ALIASES = {
  jhb: 'Johannesburg', joburg: 'Johannesburg', jozi: 'Johannesburg', jozi_: 'Johannesburg',
  cpt: 'Cape Town', kaapstad: 'Cape Town', dbn: 'Durban', pta: 'Pretoria',
  ethekwini: 'Durban', tshwane: 'Pretoria', mbombela: 'Nelspruit', gqeberha: 'Port Elizabeth',
};
// US cities read their slash-dates MONTH-first. Everywhere else on earth is
// day-first, so this set (not a country list) is all the exception we need.
const US_CITIES = new Set([
  'new york', 'brooklyn', 'los angeles', 'chicago', 'houston', 'miami', 'atlanta',
  'boston', 'san francisco', 'seattle', 'las vegas', 'austin', 'philadelphia',
  'washington', 'detroit', 'new orleans',
]);

/**
 * Remove the city from the end of a venue string, but ONLY when it is its own
 * comma-separated part. "The Bannister Hotel, Braamfontein, Johannesburg" →
 * "The Bannister Hotel, Braamfontein". A venue whose NAME contains the city
 * ("KONKA SOWETO") is left alone — that's its name, not a duplicate.
 */
export function stripTrailingCity(venue, city) {
  if (!venue || !city) return venue || '';
  const parts = venue.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return venue;
  if (parts[parts.length - 1].toLowerCase() === city.toLowerCase()) {
    return parts.slice(0, -1).join(', ');
  }
  return venue;
}

function parseCity(text) {
  const t = text.toLowerCase();
  // Whole-word match — `includes()` matched substrings inside other words.
  const hit = (name) => new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b`, 'i').test(t);
  for (const [alias, full] of Object.entries(CITY_ALIASES)) if (hit(alias)) return full;
  for (const c of SA_CITIES) if (hit(c)) return CITY_ALIASES[c] || titleCase(c);
  return null;
}

// ── Title ────────────────────────────────────────────────────────────────────
// Heuristic: the first substantial line near the top that isn't obviously
// metadata (date/time/price/url/venue). OCR loses font size, so we approximate.
const looksLikeMeta = (l) => {
  const s = l.toLowerCase();
  return (
    parseDate(l) || parseTime(l) ||
    /\br\s*\d/i.test(l) || /\bfree\b/.test(s) ||
    /https?:\/\/|www\.|@[a-z0-9._]+/.test(s) ||
    VENUE_WORDS.test(l) || /\b\d{2,}\b.*\b(street|road|ave|drive)\b/i.test(l) ||
    /^\s*(doors|tickets?|presented by|feat|featuring|line ?up|hosted by)/i.test(s) ||
    l.replace(/[^a-z]/gi, '').length < 3
  );
};
function parseTitle(lines, venue) {
  // The venue line is not the title. On a WhatsApp blast with no real title,
  // the venue is often the only short prominent line, and it was winning.
  // A sentence is not a title. A WhatsApp blast often has NO title at all, and
  // grabbing "bring your own food" as one is worse than leaving it blank for
  // the host to type — an empty field prompts them, a wrong one gets published.
  const isSentence = (l) => l.trim().split(/\s+/).length > 2 && PROSE_WORDS.test(l);
  const head = lines.slice(0, 8)
    .filter((l) => !looksLikeMeta(l) && l !== venue && !isSentence(l));
  if (!head.length) return null;
  // Prefer an all-caps / long prominent line among the first few; else the first.
  const scored = head.slice(0, 5).map((l, i) => {
    const caps = (l.match(/[A-Z]/g) || []).length / Math.max(1, l.replace(/\s/g, '').length);
    return { l, score: (l.length >= 6 ? 2 : 0) + caps * 2 - i * 0.5 };
  }).sort((a, b) => b.score - a.score);
  return clean(scored[0].l).slice(0, 90);
}

/**
 * Parse raw OCR text into event fields.
 * @returns {{ title, description, venue, address, city, date, time, endTime,
 *   price, isFree, fromPrice, phone, email, ticketUrl, ageMin, categories,
 *   fields:Object }} — `fields[name]=true` for each thing we actually detected.
 */
export function parsePosterText(rawText, now = new Date(), opts = {}) {
  const text = normalizeOcr(String(rawText || ''));
  const lines = text.split(/\r?\n/).map(clean).filter((l) => l.length > 0);
  const blob = lines.join('  ');

  const city = parseCity(blob);
  // The FLYER's own city beats the host's location: a New York poster is
  // month-first even when it's pasted by someone sitting in Johannesburg.
  const dateOrder = (city && US_CITIES.has(city.toLowerCase()))
    ? 'MDY'
    : (opts.dateOrder === 'MDY' ? 'MDY' : 'DMY');

  const date = parseDate(blob, now, dateOrder);
  const time = parseTime(blob);
  const price = parsePrice(text);
  const venueRaw = parseVenue(lines);
  // Don't repeat the city inside the Venue field — "The Bannister Hotel,
  // Braamfontein, Johannesburg" with City=Johannesburg means the host sees the
  // city twice and has to delete it. Strip it only when it's a trailing
  // comma-separated part (never from a name like "KONKA SOWETO").
  const venue = stripTrailingCity(venueRaw, city);
  const phone = parsePhone(blob);
  const email = parseEmail(blob);
  const ticketUrl = parseUrl(blob);
  const ageMin = parseAge(blob);
  const categories = detectCategories(blob);
  const title = parseTitle(lines, venueRaw);
  const powerBackup = parsePower(blob);
  const eventTags = detectEventTags(blob);
  const eventType = parseEventFormat(blob);
  const secretAct = parseSecretAct(text);
  const ageRange = parseAgeRange(blob);

  const tiers = parseTiers(text);
  const lineup = parseLineup(text);

  // description = the human copy ONLY. Anything already captured as a structured
  // field (prices, ages, contacts, links, tags, power, lineup slots) is dropped —
  // otherwise the host has to hand-delete it out of the description.
  // The venue line already IS the Venue field — echoing it back into the
  // Description made the host delete the address out of their own blurb.
  const lineupTimes = new Set(lineup.map((s) => s.time));
  const description = clean(
    lines
      .filter((l) => l !== title)
      .filter((l) => !(venueRaw && (l === venueRaw || l.includes(venueRaw))))
      .filter((l) => l.length > 12)
      .filter((l) => !META_LINE.test(l))
      .filter((l) => !parseDate(l) && !parseTime(l))
      .filter((l) => !lineupTimes.has(clean(l).slice(0, 5).replace('h', ':')))
      .join(' ')
  ).slice(0, 400);

  const fields = {};
  const set = (k, v) => { if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) fields[k] = true; };
  set('title', title); set('date', date); set('time', time); set('price', price.amount);
  set('venue', venue); set('city', city); set('phone', phone); set('email', email);
  set('ticketUrl', ticketUrl); set('categories', categories);
  set('powerBackup', powerBackup); set('eventTags', eventTags);
  set('eventType', eventType); set('secretAct', secretAct);
  set('extraTiers', tiers); set('lineup', lineup);
  if (price.isFree) fields.price = true;
  if (ageMin || ageRange.min) fields.age = true;

  return {
    title: title || '',
    description: description || '',
    venue: venue || '',
    address: venue || '',
    city: city || '',
    date,                                   // 'YYYY-MM-DD' | null
    time: time?.start || null,              // { h, m } | null
    endTime: time?.end || null,             // { h, m } | null
    price: price.amount,                    // number | null (entry / lowest)
    isFree: price.isFree,
    fromPrice: price.fromPrice,
    vipPrice: price.vip,                    // number | null
    vvipPrice: price.vvip,                  // number | null
    phone: phone || '',
    email: email || '',
    ticketUrl: ticketUrl || '',
    // Age: an explicit range ("ages 21-35") wins; else "18+" gives just the floor.
    ageMin: ageRange.min || ageMin || 0,
    ageMax: ageRange.max || 0,
    categories,
    eventType,                              // '' | one of EVENT_TYPES
    eventTags,                              // EVENT_TAGS keys ("Good to know")
    extraTiers: tiers,                      // [{ name, price }] — Early Bird, Phase 1, Table…
    lineup,                                 // [{ time, title, performer, notes }]
    powerBackup,                            // 'generator' | 'solar' | 'ups' | null
    secretAct: secretAct || '',             // '' | name | 'TBA'
    fields,                                 // what we actually detected
  };
}

export default {
  parsePosterText, parseDate, parseTime, parsePrice, detectCategories,
  parsePower, detectEventTags, parseEventFormat, parseSecretAct, parseAgeRange,
  parseTiers, parseLineup, normalizeOcr,
};
