/**
 * contentAgeRating — deterministic, no-AI age rating for user-posted content.
 *
 * The Gruvs hides mature posts from younger users automatically: every reel /
 * echo / event caption is scored here and assigned a MINIMUM VIEWING AGE. The
 * feed then simply never shows a post to anyone younger than its floor — no
 * report needed, no message to the poster (per the product's safety stance:
 * visibility is curated quietly, age is the one hard line — see safety docs).
 *
 * Why keyword/heuristic and not an ML model: the app is solo-run on free infra
 * with NO AI / paid moderation APIs. This must run instantly, offline, on every
 * post and on-read as a fallback. So it's a transparent, testable rule engine.
 *
 * It is intentionally CONSERVATIVE about false positives (word boundaries, not
 * substrings — "grass" never trips "ass") but resistant to obvious obfuscation
 * (leetspeak + stretched letters are normalised before matching).
 */

// Minimum-viewing-age tiers. 13 is the baseline (general audience).
export const AGE_TIERS = { GENERAL: 13, TEEN: 16, ADULT: 18 };

// ── Signal lexicons by tier ────────────────────────────────────────────────
// Phrases may contain spaces; single tokens are matched on word boundaries.
// Keep these focused on real signals — over-listing creates false positives.
const ADULT_TERMS = {
  sexual: ['porn', 'pornhub', 'xxx', 'nsfw', 'nude', 'nudes', 'naked', 'sex tape', 'onlyfans', 'blowjob', 'handjob', 'cum', 'orgasm', 'masturbat', 'dildo', 'creampie', 'gangbang', 'escort', 'hookup for sex'],
  hard_drugs: ['cocaine', 'coke plug', 'heroin', 'meth', 'crystal meth', 'tik ', 'nyaope', 'whoonga', 'crack', 'lsd', 'mdma', 'ecstasy pills', 'ketamine', 'fentanyl', 'plug for drugs', 'drug plug'],
  weapons_sale: ['gun for sale', 'guns for sale', 'buy a gun', 'selling guns', 'ammo for sale', 'silencer'],
  graphic_violence: ['gore', 'beheading', 'snuff', 'dead body', 'mutilat'],
  hate: ['kill all', 'gas the', 'lynch'],
};
const TEEN_TERMS = {
  alcohol: ['vodka', 'whisky', 'whiskey', 'tequila', 'shots shots', 'getting drunk', 'wasted tonight', 'turn up drunk', 'booze', 'binge drink', 'hennessy', 'jagermeister', 'jager bomb'],
  soft_drugs: ['weed', 'zol', 'blunt', 'spliff', 'ganja', 'edibles', 'high af', 'stoned', 'vape', 'vaping', 'hookah', 'shisha', 'hubbly'],
  mild_sexual: ['twerk', 'thirst trap', 'lap dance', 'strip club', 'sugar daddy', 'sugar baby', 'lingerie'],
  gambling: ['betway', 'casino', 'place your bets', 'jackpot', 'gamble', 'betting odds'],
  strong_profanity: ['fuck', 'motherfucker', 'bitch', 'asshole', 'bullshit', 'dickhead', 'cunt', 'wanker'],
};

// ── Normalisation: defeat leetspeak + stretched letters before matching ──────
const LEET = { '@': 'a', '4': 'a', '3': 'e', '1': 'i', '0': 'o', '$': 's', '5': 's', '7': 't' };
export function normalizeForMatch(text) {
  if (!text) return '';
  let s = String(text).toLowerCase();
  s = s.replace(/[@4310$57]/g, ch => LEET[ch] || ch);    // leetspeak → letters
  s = s.replace(/(.)\1{2,}/g, '$1');                       // fuuuuck → fuck (stretched letters)
  s = s.replace(/[^a-z0-9\s]/g, ' ');                      // punctuation → space
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// Match a term: multiword → substring on normalised text; single word → boundary
// with tolerance for common inflections (fuck → fucking/fucked/fucker).
const hits = (norm, term) => {
  if (term.includes(' ')) return norm.includes(term.trim());
  return new RegExp(`\\b${term}(s|es|in|ing|ed|er|ers)?\\b`).test(norm);
};

const scanTier = (norm, lexicon) => {
  const categories = [];
  for (const [category, terms] of Object.entries(lexicon)) {
    if (terms.some(t => hits(norm, t))) categories.push(category);
  }
  return categories;
};

/**
 * Rate a piece of user content.
 * @param {string} text                     caption / body / title (+ description)
 * @param {object} [opts]
 * @param {number} [opts.declaredAgeRestriction]  event's legal age gate, if any (e.g. 18)
 * @returns {{ minAge:number, mature:boolean, severity:number, categories:string[], escalate:boolean }}
 *   minAge    — the floor; the feed hides this post from anyone younger.
 *   severity  — 0..1 confidence/severity (drives the moderator escalation).
 *   escalate  — worst-case adult content that should ALSO hit the review queue.
 */
export function rateContent(text, opts = {}) {
  const norm = normalizeForMatch(text);
  const adult = norm ? scanTier(norm, ADULT_TERMS) : [];
  const teen = norm ? scanTier(norm, TEEN_TERMS) : [];

  let minAge = AGE_TIERS.GENERAL;
  if (teen.length) minAge = AGE_TIERS.TEEN;
  if (adult.length) minAge = AGE_TIERS.ADULT;

  // A creator's declared legal gate (e.g. an 18+ event) can only raise the floor.
  const declared = Number(opts.declaredAgeRestriction) || 0;
  if (declared > minAge) minAge = declared;

  // Severity: adult categories weigh heaviest; multiple hits compound.
  const severity = Math.min(1, adult.length * 0.5 + teen.length * 0.15);
  // Escalate the genuinely harmful categories for human review (not mere profanity/alcohol).
  const HARMFUL = new Set(['sexual', 'hard_drugs', 'weapons_sale', 'graphic_violence', 'hate']);
  const escalate = adult.some(c => HARMFUL.has(c));

  return {
    minAge,
    mature: minAge >= AGE_TIERS.TEEN,
    severity: Math.round(severity * 100) / 100,
    categories: [...adult, ...teen],
    escalate,
  };
}

/** Can a viewer of `viewerAge` see content rated `minAge`?
 *  Unknown viewer age (no DOB) sees only GENERAL content — safe default. */
export function canView(viewerAge, minAge) {
  const floor = Number(minAge) || AGE_TIERS.GENERAL;
  if (floor <= AGE_TIERS.GENERAL) return true;
  if (viewerAge == null) return floor <= AGE_TIERS.GENERAL;
  return Number(viewerAge) >= floor;
}

/**
 * Filter a list of posts down to what `viewerAge` is allowed to see.
 * Uses each item's stored floor (`min_age`) when present, else rates its text
 * on the fly via `getText(item)` — so protection holds even before the DB
 * columns are migrated. Pass `getText` returning the item's caption/title/body.
 */
export function filterByViewerAge(items, viewerAge, getText = (i) => i?.caption || i?.body || i?.title || '') {
  if (!Array.isArray(items)) return items;
  return items.filter(it => {
    const floor = (it && it.min_age != null) ? Number(it.min_age) : rateContent(getText(it)).minAge;
    return canView(viewerAge, floor);
  });
}

export default { rateContent, canView, normalizeForMatch, filterByViewerAge, AGE_TIERS };
