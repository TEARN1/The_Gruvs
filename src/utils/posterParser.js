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

const SA_CITIES = [
  'johannesburg', 'joburg', 'jozi', 'sandton', 'soweto', 'midrand', 'randburg', 'roodepoort',
  'pretoria', 'centurion', 'tshwane', 'cape town', 'kaapstad', 'durban', 'ethekwini', 'umhlanga',
  'port elizabeth', 'gqeberha', 'bloemfontein', 'polokwane', 'nelspruit', 'mbombela', 'kimberley',
  'rustenburg', 'east london', 'pietermaritzburg', 'stellenbosch', 'kempton park', 'benoni',
  'boksburg', 'germiston', 'vereeniging', 'welkom', 'george', 'knysna', 'ballito', 'edenvale',
  'krugersdorp', 'vanderbijlpark', 'newcastle', 'witbank', 'emalahleni',
];
const VENUE_WORDS = /\b(club|lounge|arena|hall|centre|center|convention|park|rooftop|stadium|theatre|theater|bar|hotel|resort|gardens?|racecourse|amphitheatre|dome|grounds?|venue|palace|hub|studio|deck|yard|warehouse|estate|winery|vineyard|cafe|restaurant|market|expo)\b/i;
const TICKET_SITES = /(quicket|webtickets|computicket|howler|ticketpro|plankton|nutickets)\.?[a-z.]*/i;

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const titleCase = (s) => clean(s).replace(/\b\w/g, (c) => c.toUpperCase());
const pad = (n) => String(n).padStart(2, '0');

// ── Date ─────────────────────────────────────────────────────────────────────
// Returns 'YYYY-MM-DD' or null. Year is inferred to the next future occurrence
// when the poster omits it (as most do).
export function parseDate(text, now = new Date()) {
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

  // DD/MM/YYYY or DD/MM/YY or DD-MM (SA order: day first)
  m = t.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (m) {
    let d = +m[1], mo = +m[2];
    if (mo > 12 && d <= 12) { const tmp = d; d = mo; mo = tmp; } // tolerate MM/DD
    let y = m[3] ? +m[3] : inferYear(mo, d);
    if (y < 100) y += 2000;
    const r = mk(y, mo, d); if (r) return r;
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
// Returns { amount:number|null, isFree:bool, fromPrice:bool }.
export function parsePrice(text) {
  const t = text.toLowerCase();
  if (/\b(free entry|free admission|no cover|entrance free|free event|gratis)\b/.test(t) ||
      /\bfree\b/.test(t) && !/\bR\s*\d/i.test(text)) {
    return { amount: 0, isFree: true, fromPrice: false };
  }
  // all Rand amounts
  const amounts = [];
  const re = /r\s*([\d][\d\s,]*)(?:\.\d{1,2})?/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1].replace(/[\s,]/g, ''), 10);
    if (Number.isFinite(n) && n > 0 && n < 1000000) amounts.push(n);
  }
  if (!amounts.length) return { amount: null, isFree: false, fromPrice: false };
  const min = Math.min(...amounts);
  const fromPrice = /\bfrom\b/.test(t) || amounts.length > 1;
  return { amount: min, isFree: false, fromPrice };
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

// ── Contact / links ──────────────────────────────────────────────────────────
const parsePhone = (t) => {
  const m = t.match(/(\+27|0)\s?[6-8]\d(?:[\s-]?\d){7}/);
  return m ? m[0].replace(/[\s-]/g, '') : null;
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
function parseVenue(lines) {
  // Prefer an "@ Venue" / "at Venue" / "Venue:" cue, else the first line with a
  // venue keyword, else a line that looks like a street address.
  for (const l of lines) {
    const cue = l.match(/(?:^|\s)(?:@|at|venue|location|where)\s*:?\s*(.+)$/i);
    if (cue && /[a-z]{2,}/i.test(cue[1]) && (VENUE_WORDS.test(cue[1]) || /\d/.test(cue[1]) || cue[1].split(' ').length <= 6)) {
      return clean(cue[1]);
    }
  }
  const kw = lines.find((l) => VENUE_WORDS.test(l) && l.length < 80);
  if (kw) return clean(kw);
  const addr = lines.find((l) => /\b(street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|blvd|boulevard)\b/i.test(l));
  return addr ? clean(addr) : null;
}
function parseCity(text) {
  const t = text.toLowerCase();
  for (const c of SA_CITIES) if (t.includes(c)) return titleCase(c === 'joburg' || c === 'jozi' ? 'Johannesburg' : c);
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
function parseTitle(lines) {
  const head = lines.slice(0, 8).filter((l) => !looksLikeMeta(l));
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
export function parsePosterText(rawText, now = new Date()) {
  const text = String(rawText || '');
  const lines = text.split(/\r?\n/).map(clean).filter((l) => l.length > 0);
  const blob = lines.join('  ');

  const date = parseDate(blob, now);
  const time = parseTime(blob);
  const price = parsePrice(text);
  const venue = parseVenue(lines);
  const city = parseCity(blob);
  const phone = parsePhone(blob);
  const email = parseEmail(blob);
  const ticketUrl = parseUrl(blob);
  const ageMin = parseAge(blob);
  const categories = detectCategories(blob);
  const title = parseTitle(lines);

  // description = the leftover human copy (exclude title + pure-metadata lines)
  const description = clean(
    lines.filter((l) => l !== title && !parseDate(l) && !parseTime(l) && l.length > 12 && !/https?:\/\//i.test(l)).join(' ')
  ).slice(0, 400);

  const fields = {};
  const set = (k, v) => { if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) fields[k] = true; };
  set('title', title); set('date', date); set('time', time); set('price', price.amount);
  set('venue', venue); set('city', city); set('phone', phone); set('email', email);
  set('ticketUrl', ticketUrl); set('ageMin', ageMin); set('categories', categories);
  if (price.isFree) fields.price = true;

  return {
    title: title || '',
    description: description || '',
    venue: venue || '',
    address: venue || '',
    city: city || '',
    date,                                   // 'YYYY-MM-DD' | null
    time: time?.start || null,              // { h, m } | null
    endTime: time?.end || null,             // { h, m } | null
    price: price.amount,                    // number | null
    isFree: price.isFree,
    fromPrice: price.fromPrice,
    phone: phone || '',
    email: email || '',
    ticketUrl: ticketUrl || '',
    ageMin: ageMin || 0,
    categories,
    fields,                                 // what we actually detected
  };
}

export default { parsePosterText, parseDate, parseTime, parsePrice, detectCategories };
