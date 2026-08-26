/**
 * The Gruvs — Data Flow Engine v2
 * Centralised data layer: caching, real-time, optimistic updates, managers for
 * every domain (Feed, Trending, Vibe, RSVP, Bookmark, User, Notification,
 * CheckIn, Analytics, Calendar, Route, Score).
 */

import { supabase, isSupabaseEnabled } from './supabase';
import { resilient, resilientRead, isSchemaMiss, withTimeout } from '../utils/resilience';
import { sanitizeSearch } from '../utils/sanitize';
import { logError } from '../utils/logError';
import { log } from '../utils/log';
import { ALL_CATEGORIES } from '../constants/AllCategories';
import { LocationService } from './locationService';
import { SecurityService } from './securityService';
import { VibeEquityLedger } from './vibeEquityLedger';
import { VibeEconomyEngine } from './revenueEngine';
import { NotificationService } from './notificationService';
import { heatScore as canonicalHeatScore } from '../utils/heatScore';
import { getXpLevel } from '../utils/vibeLevel';
import { rankEventResults, rankUserResults } from '../utils/searchRelevance';
import { secureCode } from '../utils/secureId';

// ── Database Pre-parsing / Normalization ──────────────────────────────────
export const normalizeEvent = (event) => {
  if (!event) return event;
  const parsed = { ...event };
  if (parsed.age_min !== undefined) parsed.age_restriction = parsed.age_min;
  if (parsed.media && typeof parsed.media === 'string') {
    try { parsed.media = JSON.parse(parsed.media); } catch { parsed.media = null; }
  }
  if (parsed.media_urls && typeof parsed.media_urls === 'string') {
    try { parsed.media_urls = JSON.parse(parsed.media_urls); } catch { parsed.media_urls = null; }
  }
  if (parsed.price && typeof parsed.price === 'string' && parsed.price.trim().startsWith('{')) {
    try { parsed.price = JSON.parse(parsed.price); } catch {}
  }
  if (parsed.rsvp_tiers && typeof parsed.rsvp_tiers === 'string') {
    try { parsed.rsvp_tiers = JSON.parse(parsed.rsvp_tiers); } catch { parsed.rsvp_tiers = null; }
  }
  if (parsed.schedule && typeof parsed.schedule === 'string') {
    try { parsed.schedule = JSON.parse(parsed.schedule); } catch { parsed.schedule = null; }
  }
  if (parsed.tags && typeof parsed.tags === 'string') {
    try { parsed.tags = JSON.parse(parsed.tags); } catch { parsed.tags = null; }
  }
  return parsed;
};

export const normalizeEvents = (events) => {
  if (!events) return [];
  if (Array.isArray(events)) {
    return events.map(normalizeEvent);
  }
  return normalizeEvent(events);
};

// Map from AllCategories group → CATEGORY_CONFIG parent key
const GROUP_TO_CAT_KEY = {
  'Music':           'music',
  'Nightlife':       'nightlife',
  'Sport':           'sport',
  'Arts & Culture':  'art',
  'Food & Drink':    'food',
  'Gaming':          'gaming',
  'Education':       'edu',
  'Business':        'biz',
  'Dance':           'dance',
  'Fitness & Wellness': 'wellness',
  'Fashion & Beauty': 'fashion',
  'Travel':          'travel',
  'Technology':      'gaming',
  'Science':         'science',
  'Faith':           'religion',
  'Family':          'kids',
  'Civic':           'politics',
  'Social':          'dating',
  'Health':          'health',
  'Markets':         'market',
  'Cars & Motors':   'cars',
  'Books & Writing': 'books',
  'Hobbies':         'crafts',
  'Virtual':         'virtual',
};

// Build reverse map: CATEGORY_CONFIG key → all AllCategories sub-keys in that group
export const CAT_KEY_TO_SUBCATS = {};
(ALL_CATEGORIES || []).forEach(c => {
  const parent = GROUP_TO_CAT_KEY[c.group];
  if (parent) {
    if (!CAT_KEY_TO_SUBCATS[parent]) CAT_KEY_TO_SUBCATS[parent] = new Set([parent]);
    CAT_KEY_TO_SUBCATS[parent].add(c.key);
  }
});

// ── Explicit subcategory sets for CATEGORY_CONFIG keys not covered by GROUP_TO_CAT_KEY ──
// These ensure clicking "Comedy", "Film", "Party", etc. returns relevant events
const _extend = (key, ...keys) => {
  if (!CAT_KEY_TO_SUBCATS[key]) CAT_KEY_TO_SUBCATS[key] = new Set([key]);
  keys.forEach(k => CAT_KEY_TO_SUBCATS[key].add(k));
};
_extend('comedy',     'standup','improv','comedy_night','karaoke','open_mic','sketch');
_extend('film',       'film','cinema','documentary','shortfilm','animation','videography');
_extend('photography','photography','streetphotog','portraitphotog','film_photog','videography');
_extend('dance',      'dance','ballet','contemporary','hiphop_dance','breakdance','streetdance',
                      'afrobeats_dance','amapiano_dance','gqom_dance','kizomba','zouk','twerking',
                      'linedance','swing','waltz','tango','tap_dance','bollywood_dance','kathak',
                      'flamenco','irish_dance','danceworkshop','dancebattle','dancesocial');
_extend('fitness',    'fitness','hiit','crossfit','zumba','aerobics','spin','barre','calisthenics',
                      'bootcamp','kidsfitness','sportsday','fun_run');
_extend('yoga',       'yoga','hotfyoga','hatha','vinyasa','kundalini','ashtanga','pilates','taichi','qigong');
_extend('wellness',   'wellness','meditation','mindfulness','breathwork','stretching','spa','nutrition',
                      'mentalhealth','therapy_group','detox','reiki','massage','cold_therapy','sauna',
                      'naturopathy','acupuncture','fasting');
_extend('beauty',     'beauty','makeup','skincare','haircare','nailart','locs','naturalhai',
                      'barbershop','tattoo','piercing','wellness_beauty');
_extend('esports',    'esports','esports_sport','gaming','lan_party','gaming_tourney','retro_gaming',
                      'tabletop','boardgames','cardgames','poker','chess_event','vrgaming',
                      'mobile_gaming','speedrun','minecraft','cosplay_gaming','streamer');
_extend('gaming',     'gaming','esports','lan_party','gaming_tourney','retro_gaming','tabletop',
                      'boardgames','cardgames','vrgaming','mobile_gaming','speedrun','streamer',
                      'puzzles','minecraft','hackathon','coding','webdev','mobiledev','ai',
                      'blockchain','crypto','web3','cybersecurity','data_science','robotics',
                      'ar_vr','gaming_dev','techworkshop','techtalks');
_extend('startup',    'startup','pitch','accelerator','entrepreneurship','youthbiz','fintech',
                      'healthtech','edtech','cleantech','spacetech','product','open_source');
_extend('networking', 'networking','meetup','speed_dating','singles_night','dating');
_extend('conference', 'conference','summit','seminar','masterclass','techtalks','panel');
_extend('workshop',   'workshop','masterclass','techworkshop','danceworkshop','tutorial',
                      'study_group','mentoring','coaching');
_extend('festival',   'festival','festival_music','foodfestival','rave','club_night');
_extend('party',      'party','birthday','anniversary','rooftop','pool_party','beach_party',
                      'garden_party','house_party','housewarming','graduation_party','vip_event');
_extend('culture',    'culture','heritage','museum','history','archaeology','cultural_tour',
                      'indigenous','traditional','interfaith');
_extend('nightlife',  'nightlife','bar_night','lounge','jazz_bar','karaoke_bar','trivia_night',
                      'game_night','movie_night','drag','burlesque','comedy_night','club_night');
_extend('mental',     'mentalhealth','therapy_group','mental_wellness','therapy','mindfulness',
                      'breathwork','grief','addiction');
_extend('parenting',  'parenting','babies','toddlers','playdate','homeschool','storytime');
_extend('seniors',    'seniors');
_extend('lgbtq',      'lgbtq','pride');
_extend('cooking',    'cooking','baking','pastry','masterchef','kidscooking','coffee','coffee_cupping',
                      'tea','cheesetasting','chocolate');
_extend('wine',       'wine_tasting','beer','cocktails','whiskey','gin','nonalcoholic','bubbletea');
_extend('motorsport', 'motorsport','karting','f1','classic_cars','offroad','motorbikes','trucks','carshow');
_extend('cars',       'cars','carshow','carwash','motorsport','karting','f1','classic_cars',
                      'offroad','motorbikes','trucks');
_extend('anime',      'anime','manga','cosplay','cosplay_gaming');
_extend('poetry',     'poetry','spoken_word','storytelling','open_mic');
_extend('standup',    'standup','comedy','improv','comedy_night');
_extend('art',        'art','painting','drawing','sculpture','photography','film','cinema',
                      'theatre','musicaltheatre','improv','standup','comedy','poetry','spoken_word',
                      'gallery','exhibition','artwalk','mural','graffiti','digitalart','nft_art',
                      'animation','manga','cosplay','craft','pottery','ceramics','glassblowing',
                      'jewellery','candle_making','origami','knitting','crochet','sewing',
                      'embroidery','woodwork','leatherwork','printmaking','calligraphy');
_extend('religion',   'religion','christianity','islam','judaism','hinduism','buddhism',
                      'traditional','interfaith','prayer','bible_study','retreat','crusade',
                      'eid','diwali','hanukkah','christmas','easter','ramadan','passover',
                      'navratri','gospel','gospel_praise');
_extend('politics',   'politics','activist','protest','townhall','election','panel','petition',
                      'human_rights','gender_rights','environment','climate','clean_up',
                      'tree_planting','food_drive','indigenous','social_justice');
_extend('health',     'health','medicine','mental_wellness','therapy','rehab','fundraise_health',
                      'blood_drive','hiv_aids','cancer','diabetes','womens_health','mens_health',
                      'reproductive','addiction','grief','disability','autism');
_extend('travel',     'travel','adventure','camping','glamping','roadtrip','backpacking',
                      'safaari','beachtrip','island_hopping','cruise','citybreak','voluntourism',
                      'cultural_tour','food_tour','wine_tour','motorcycle','trekkings','skydiving',
                      'bungee','paragliding','whitewater','spelunking','stargazing','birdwatching',
                      'wildflowers','sunrise_hike','night_hike');
_extend('science',    'science_event','astronomy','physics','biology','chemistry','geology',
                      'marine','wildlife','conservation','nature','gardening','urban_farming',
                      'composting','beekeeping','animals','pets','dogs','cats','horses');
_extend('books',      'books','bookclub','author_talk','creative_writing','journalism',
                      'publishing','blogging','zine','comics','screenwriting');
_extend('crafts',     'craft','pottery','ceramics','glassblowing','jewellery','candle_making',
                      'origami','knitting','crochet','sewing','embroidery','woodwork',
                      'leatherwork','printmaking','calligraphy','magic','circus','juggling',
                      'kite_flying','model_making','drone_racing','rc_cars','foraging',
                      'numismatics','stamps','antiques','escape_room','murder_mystery',
                      'tarot','astrology','zodiac');
_extend('virtual',    'virtual','webinar','livestream','podcast','online_course',
                      'virtual_concert','virtual_tour','online_party','discord','zoom_event','clubhouse');
_extend('property',   'realestate','housewarming');
_extend('edu',        'edu','school','university','graduation','lecture','tutorial','study_group',
                      'debate','quiz','science','mathematics','languages','english','afrikaans',
                      'zulu','xhosa','french','arabic','mandarin','spanish','portuguese',
                      'swahili','sign_language','literacy','tutoring','eduwomen','stem','coding_kids');
_extend('market',     'market','crafts_market','artmarket','pop_up','car_boot','flea_market',
                      'fashion_market','tech_market','bookfair','plant_sale','food_swap',
                      'food','foodmarket','streetfood','braai','picnic');
_extend('food',       'food','restaurant','brunch','breakfast','lunch','dinner','supper',
                      'braai','picnic','streetfood','foodmarket','foodfestival','wine_tasting',
                      'beer','cocktails','coffee','coffee_cupping','tea','cooking','baking',
                      'pastry','vegan','vegetarian','sushi','halaal','kosher','african_food',
                      'asian_food','mediterranean','mexican_food','indian_food','masterchef',
                      'cheesetasting','chocolate','nonalcoholic','bubbletea');
_extend('kids',       'kids','parenting','babies','toddlers','playdate','kidsfitness',
                      'storytime','kidscooking','kidsart','kidssports','carnival','funfair',
                      'familydayout','homeschool','seniors','youth');
_extend('fashion',    'fashion','fashionshow','runway','streetstyle','vintage','thriftstore',
                      'sustainable_fashion','sneakers','luxury_fashion','menswear','womenswear',
                      'kidswear','jewellery_fashion','beauty','makeup','skincare','haircare',
                      'nailart','locs','naturalhai','barbershop','tattoo','piercing');
_extend('charity',    'charity','fundraiser','volunteering','neighbourhood','blood_drive',
                      'food_drive','tree_planting','clean_up','hiv_aids','cancer','disability');
_extend('dating',     'dating','speed_dating','singles_night','lgbtq','pride','social',
                      'meetup','party','birthday','anniversary','wedding','engagement',
                      'babyshower','reunion');

// ── INTELLIGENCE MONITORING (Autonomous Training) ──────────────────────────
export const IntelligenceMonitor = {
  async logSuccess(feature, duration) {
    if (__DEV__ && duration > 500) {
      log.warn(`[PerfAlert] ${feature} took ${duration}ms`);
    }
  },
  async logFailure(feature, error) {
    log.error(`[Intelligence] ${feature} failed`, error);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CACHE  (stale-while-revalidate, prefix invalidation, TTL guardrail)
// ─────────────────────────────────────────────────────────────────────────────
const CACHE = {};
const CACHE_TTL    = 300000; // 5 min default
const CACHE_MAX_AGE = 1800000; // 30 min hard cap — stale entries evicted regardless

const cache = {
  set(key, value, ttl = CACHE_TTL) {
    CACHE[key] = { value, ts: Date.now(), ttl };
  },
  get(key) {
    const entry = CACHE[key];
    if (!entry) return null;
    const age = Date.now() - entry.ts;
    if (age > entry.ttl) { delete CACHE[key]; return null; }
    return entry.value;
  },
  // Returns stale value even past TTL, but enforces 30-min hard cap
  getStale(key) {
    const entry = CACHE[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_MAX_AGE) { delete CACHE[key]; return null; }
    return entry.value;
  },
  invalidate(prefix) {
    Object.keys(CACHE).forEach(k => { if (k.startsWith(prefix)) delete CACHE[k]; });
  },
  clear() { Object.keys(CACHE).forEach(k => delete CACHE[k]); },
  // Periodic sweep of expired entries to prevent unbounded memory growth
  sweep() {
    const now = Date.now();
    Object.keys(CACHE).forEach(k => {
      if (now - CACHE[k].ts > CACHE_MAX_AGE) delete CACHE[k];
    });
  },
};

// Run sweep every 10 minutes — harmless background cleanup
if (typeof setInterval !== 'undefined' && process.env.NODE_ENV !== 'test') setInterval(() => cache.sweep(), 600000);


// ─────────────────────────────────────────────────────────────────────────────
// REQUEST DEDUPLICATION  (in-flight promise sharing)
// Prevents the same query from firing multiple times when multiple components
// mount simultaneously (e.g., 3 screens all calling TrendingManager.fetch()).
// ─────────────────────────────────────────────────────────────────────────────
const IN_FLIGHT = new Map();

function dedupe(key, fn) {
  if (IN_FLIGHT.has(key)) return IN_FLIGHT.get(key);
  const promise = fn().finally(() => IN_FLIGHT.delete(key));
  IN_FLIGHT.set(key, promise);
  return promise;
}

// ─────────────────────────────────────────────────────────────────────────────
// ONLINE STATUS UTILS
// ─────────────────────────────────────────────────────────────────────────────

// last_seen is the SINGLE source of truth for "online". The is_online flag alone
// can't be trusted: it's a boolean that only flips off if the app cleanly runs
// its teardown, so a crash/closed-tab/lost-network leaves it stuck true forever —
// which is exactly the "shows online when they're not" bug. So: no recent
// heartbeat → offline, no matter what the flag says. The flag only widens the
// freshness window slightly (a live app heartbeats every few minutes).
export const isOnline = (profile) => {
  if (!profile || !profile.last_seen) return false;
  const minsAgo = (Date.now() - new Date(profile.last_seen).getTime()) / 60000;
  if (!Number.isFinite(minsAgo) || minsAgo < 0) return false;
  return profile.is_online === true ? minsAgo <= 5 : minsAgo <= 3;
};

// ─────────────────────────────────────────────────────────────────────────────
// GEO UTILS
// ─────────────────────────────────────────────────────────────────────────────
export const GeoUtils = {
  getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED SCORING PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

// Wilson lower-bound score for binary positive/negative counts.
// Gives statistically sound ranking even with small sample sizes.
// n = total observations, p = positive fraction, z = 1.96 for 95% CI
function wilsonLowerBound(positives, total, z = 1.96) {
  if (total === 0) return 0;
  const p = positives / total;
  const z2 = z * z;
  const num = p + z2 / (2 * total) - z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  const den = 1 + z2 / total;
  return num / den;
}

// Exponential temporal decay: score * e^(-λ * hours)
// λ=0.08 → half-life ≈ 8.7 h (content freshness curve)
function expDecay(value, ageHours, lambda = 0.08) {
  return value * Math.exp(-lambda * ageHours);
}

// Gaussian peak at targetHours with σ spread — used for event imminence
// Returns [0,1]; max at t=targetHours, falls off symmetrically
function gaussianPeak(hoursUntil, targetHours = 20, sigma = 18) {
  const d = hoursUntil - targetHours;
  return Math.exp(-(d * d) / (2 * sigma * sigma));
}

// Inverse-square geographic proximity score in [0,1]
// Returns 1 at dist=0, ~0.5 at dist=σKm, approaches 0 at large distances
function geoProximityScore(distKm, sigmaKm = 8) {
  return 1 / (1 + (distKm * distKm) / (sigmaKm * sigmaKm));
}

// Logarithmic compression for large raw counts — avoids viral outliers dominating
function logCompress(value, scale = 10) {
  return scale * Math.log1p(value);
}

// Engagement velocity with momentum: current rate + acceleration term
// velocity = (count / ageH), momentum = velocity / ageH (second derivative signal)
function engagementMomentum(count, ageHours) {
  if (ageHours < 0.1) return logCompress(count, 8);
  const velocity = count / ageHours;
  const momentum = velocity / Math.max(1, ageHours); // acceleration
  return velocity * 3 + momentum * 12;
}

// Interest affinity score: multi-category weighted dot product
// Each matching category contributes, with primary interest weighted 2×
const INTEREST_HIERARCHY = {
  Music: ['Music', 'Nightlife', 'Entertainment'],
  Art: ['Art', 'Culture', 'Photography'],
  Tech: ['Tech', 'Business', 'Innovation'],
  Fashion: ['Fashion', 'Lifestyle', 'Art'],
  Nightlife: ['Nightlife', 'Music', 'Social'],
  Food: ['Food', 'Social', 'Culture'],
  Sports: ['Sports', 'Fitness', 'Outdoor'],
  Social: ['Social', 'Networking', 'Community'],
  Business: ['Business', 'Tech', 'Networking'],
};

function interestAffinityScore(category, userInterests) {
  if (!category || !userInterests.length) return 0;
  let score = 0;
  userInterests.forEach((interest, idx) => {
    const weight = 1 / (idx + 1); // primary interest = 1.0, secondary = 0.5, tertiary = 0.33
    if (interest === category) {
      score += 30 * weight; // direct match
    } else {
      const related = INTEREST_HIERARCHY[interest] || [];
      if (related.includes(category)) score += 12 * weight; // adjacent match
    }
  });
  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE ENGINE  (Vibe Score — used for feed ranking & profile display)
// ─────────────────────────────────────────────────────────────────────────────
export const ScoreEngine = {

  // Advanced multi-signal relevance score for a single event.
  // THE single event ranker (F1) — LandingPage no longer re-ranks behind it.
  // Anti-engagement by design: likes are buyable, people standing in a room
  // are not — so verified presence outweighs vibes, and imminence outweighs
  // both ("what's on tonight" beats "what was big last month").
  // Combines 10 orthogonal signals into a composite score.
  eventScore(event, {
    userInterests = [],
    followedIds = [],
    userLat,
    userLon,
    crossedPathIds = [],
    aiRecommendedIds = new Set(), // kept for API compatibility
  } = {}) {
    const now = Date.now();
    const ageH = Math.max(0.01, (now - new Date(event.created_at).getTime()) / 3600000);
    const vibes = event.vibe_count || 0;
    const going = event.going || 0;
    const totalEngagement = vibes + going;

    // ── SIGNAL 0: Over → never rank. LIVE → dominate.
    // (Absorbed from the retired utils/ranking rankFeed — the Drop query has no
    // date filter, so THIS is what keeps finished events out of the feed.)
    let liveBoost = 0;
    if (event.event_date) {
      const startMs = new Date(`${event.event_date}T${event.event_time || '20:00'}:00`).getTime();
      if (Number.isFinite(startMs)) {
        // An event runs ~8h past its start; multi-day events run to end_date.
        let overMs = startMs + 8 * 3600000;
        if (event.end_date) {
          const endMs = new Date(`${event.end_date}T23:59:00`).getTime();
          if (Number.isFinite(endMs)) overMs = Math.max(overMs, endMs);
        }
        if (now > overMs) return 0;          // it's over — never rank it
        if (now >= startMs) liveBoost = 30;  // LIVE NOW — the most useful thing we can show
      }
    }

    // ── SIGNAL 0b: Verified presence — the unfakeable signal.
    // Touch Downs are people physically in the room: unbuyable. Weighted so ~20
    // verified heads outrank any amount of likes.
    const here = Number(event.here_count ?? event.checkin_count ?? event.touchdown_count ?? 0) || 0;
    const presenceSignal = Math.log1p(Math.max(0, here)) * 18;

    // ── SIGNAL 1: Host trust prior (Bayesian weight)
    // social_integrity_score [0,200] treated as a prior on content quality.
    // Modelled as a multiplier centred at 1.0 (neutral), max 1.4 at SIS=200.
    const sis = event.profiles?.social_integrity_score || 50;
    const trustMultiplier = 0.8 + (Math.min(sis, 200) / 200) * 0.6; // [0.8, 1.4]

    // ── SIGNAL 2: Wilson lower-bound social proof
    // Treats (vibes + going) as positives, uses an impression proxy of max(total,10).
    // Prevents a 1-vibe event from outranking a 50-vibe event.
    const impressionProxy = Math.max(totalEngagement * 3, 10);
    const wilsonProof = wilsonLowerBound(totalEngagement, impressionProxy) * 80;

    // ── SIGNAL 3: Engagement velocity with momentum
    // Rewards rapidly accelerating engagement in the first 48h.
    // After 48h the momentum signal decays, leaving only the Wilson proof.
    const velocitySignal = ageH < 48 ? engagementMomentum(totalEngagement, ageH) : 0;

    // ── SIGNAL 4: Exponential content freshness decay
    // Content freshness decays with half-life ~8.7h.
    const freshness = expDecay(25, ageH, 0.08);

    // ── SIGNAL 5: Upcoming event temporal sweet-spot
    // Gaussian peak centred at 20h before the event, σ=18h.
    // Events too far away (>7 days) or already past score near 0.
    let imminenceSignal = 0;
    if (event.event_date) {
      const eventMs = new Date(`${event.event_date}T${event.event_time || '20:00'}:00`).getTime();
      const hoursUntil = (eventMs - now) / 3600000;
      if (hoursUntil >= -2 && hoursUntil <= 168) { // -2h to +7 days
        imminenceSignal = gaussianPeak(hoursUntil, 20, 18) * 35;
        // Extra urgency: < 6h away and still has spots
        if (hoursUntil > 0 && hoursUntil < 6) imminenceSignal += 20;
      }
    }

    // ── SIGNAL 6: Geographic inverse-square proximity
    // Score falls off as 1/(1 + dist²/σ²) with σ=8km.
    // No penalty beyond ~25km — just diminishing reward.
    let geoSignal = 0;
    if (userLat && userLon && event.lat && event.lon) {
      const distKm = GeoUtils.getDistance(userLat, userLon, event.lat, event.lon);
      geoSignal = geoProximityScore(distKm, 8) * 25;
    }

    // ── SIGNAL 7: Multi-dimensional interest affinity vector
    // Weighted dot product across interest hierarchy graph.
    const affinitySignal = interestAffinityScore(event.category, userInterests);

    // ── SIGNAL 8: Social graph network proximity
    // Weights: followed host > real-world path crossing > no connection.
    // Uses graded scoring rather than binary booleans.
    let networkSignal = 0;
    if (followedIds.includes(event.author_id)) networkSignal += 28;
    if (crossedPathIds.includes(event.author_id)) networkSignal += 22;
    // Mutual: both follow each other — approximated if host follows viewer (can't check without data)
    // Slight boost for high-engagement followed host signals
    if (followedIds.includes(event.author_id) && vibes > 10) networkSignal += 8;

    // ── SIGNAL 9: Ancillary quality signals
    const freeBoost = (!event.price || event.price === 0) ? 5 : 0;
    // Verified host small lift
    const verifiedBoost = event.profiles?.is_verified ? 6 : 0;
    // Logarithmic absolute social mass — compressed so mega-events don't bury everything
    const socialMass = logCompress(totalEngagement, 6);

    // ── COMPOSITE SCORE
    // Each signal is independent; trustMultiplier scales the whole bundle.
    let raw = wilsonProof + velocitySignal + freshness + imminenceSignal
      + geoSignal + affinitySignal + networkSignal
      + freeBoost + verifiedBoost + socialMass
      + presenceSignal + liveBoost;

    // NEW-HOST RESCUE (absorbed from the retired rankFeed): a first-time host
    // has no heat, no history, so no ranking, so no attendance, so no heat.
    // Break that loop deliberately or the platform can never grow a new host.
    if ((event.host_event_count ?? null) === 0) raw = Math.max(raw, 30);

    return raw * trustMultiplier;
  },

  // Heat score for trending — delegates to the ONE canonical heat definition
  // (utils/heatScore: verified presence + momentum + imminence). Clamped at 0
  // so a finished event's -Infinity sink never leaks into a displayed number.
  heatScore(event) {
    return Math.max(0, canonicalHeatScore(event));
  },

  // Compute and persist a user's Vibe Score
  async computeVibeScore(userId) {
    try {
      // Trigger Vibe Decay Protocol (Anti-Inflation)
      await supabase.rpc('apply_vibe_decay');
      await VibeEconomyEngine.getGlobalEconomicHealth(); // Check economic health

      const [posts, vibes, rsvps, checkins, follows, bookings] = await Promise.all([
        supabase.from('events').select('id', { count: 'estimated', head: true }).eq('author_id', userId),
        supabase.from('event_vibes').select('id', { count: 'estimated', head: true }).eq('user_id', userId),
        supabase.from('event_rsvps').select('event_id', { count: 'estimated', head: true }).eq('user_id', userId),
        supabase.from('live_checkins').select('id', { count: 'estimated', head: true }).eq('user_id', userId),
        supabase.from('follows').select('follower_id', { count: 'estimated', head: true }).eq('following_id', userId),
        supabase.from('service_bookings').select('id', { count: 'estimated', head: true }).eq('provider_id', userId).eq('status', 'completed'),
      ]);

      // Decay-weighted contribution scoring.
      // Each action type has a base value scaled by a logarithmic volume diminisher
      // so that 1000 vibes is not 1000x better than 1 vibe — compresses outliers.
      const p = posts.count || 0;
      const vi = vibes.count || 0;
      const r = rsvps.count || 0;
      const c = checkins.count || 0;
      const f = follows.count || 0;
      const b = bookings.count || 0;

      const score = Math.round(
        logCompress(p, 12) * 15 +    // Creating Gruvs — high authorship value
        logCompress(vi, 10) * 2 +    // Giving vibes — social engagement
        logCompress(r, 10) * 5 +     // Commitment — intent signal
        logCompress(c, 12) * 25 +    // Physical presence — highest trust signal
        logCompress(f, 14) * 20 +    // Community influence — reach multiplier
        logCompress(b, 16) * 50      // Economic utility — sovereign-tier signal
      );

      await supabase.from('profiles').update({ vibe_score: score }).eq('id', userId);

      // Check for Sovereign Milestones
      await RewardEngine.checkMilestones(userId);

      cache.invalidate(`profile_stats:${userId}`);
      return score;
    } catch { return 0; }
  },

  // Pattern: Dynamic Re-ranking logic for UI state
  reRank(events, context) {
    return [...events].sort((a, b) =>
      this.eventScore(b, context) - this.eventScore(a, context)
    );
  },

  /**
   * diversify — final re-rank pass over already-scored events (each carries
   * `_heatScore`). Three advances over a plain score-sort:
   *
   *  1. DIVERSITY (MMR-style): greedily pick the best event, then penalise the
   *     next ones that repeat its category or host, so the feed doesn't show
   *     five music events / five gruvs from one host back-to-back.
   *  2. EXPLORATION vs EXPLOITATION: events the user hasn't seen yet get a small
   *     novelty lift; ones they already dwelled on/opened (seenIds) are gently
   *     demoted so refreshes feel fresh (ε-greedy style, ε≈0.15).
   *  3. COLD-START: a brand-new user (no interests/follows) leans harder on
   *     heat + diversity so their first feed still feels alive.
   *
   * Pure + deterministic given inputs (seedable jitter), safe on any array.
   */
  diversify(events, { seenIds = new Set(), dwellById = new Map(), coldStart = false, categoryPenalty = 0.35, hostPenalty = 0.25, exploration = 0.15, maxPerHost = 2 } = {}) {
    if (!Array.isArray(events) || events.length < 3) return events || [];

    const scoreOf = (e) => (typeof e._heatScore === 'number' ? e._heatScore : 0);
    const maxScore = Math.max(1, ...events.map(scoreOf));

    // Pre-weight: novelty lift for unseen, dwell-aware demotion for seen
    // (Drop rule 15): lingering ≥8s or opening the detail = live interest →
    // keep it near the top; skimming past = a pass → demote harder.
    const pool = events.map((e) => {
      let w = scoreOf(e);
      const seen = seenIds.has(e.id);
      if (seen) {
        const d = dwellById.get(e.id);
        const engaged = !!d && ((d.dwellMs || 0) >= 8000 || d.opened);
        w *= engaged ? 0.85 : 0.5;
      } else w += maxScore * exploration * (coldStart ? 1.4 : 1); // explore the new
      return { e, base: w };
    });

    const picked = [];
    const usedCat = new Map();   // category → how many already placed
    const usedHost = new Map();  // author_id → how many already placed
    const remaining = pool.slice();

    while (remaining.length) {
      let bestIdx = 0;
      let bestVal = -Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const { e, base } = remaining[i];
        const catN = usedCat.get(e.category) || 0;
        const hostN = usedHost.get(e.author_id) || 0;
        // Repetition penalty grows with how many of the same we've already shown.
        const penalty = 1 - Math.min(0.85, catN * categoryPenalty + hostN * hostPenalty);
        let val = base * penalty;
        // ANTI-MONOPOLY (folded from the retired rankFeed): past a host's first
        // maxPerHost events, further ones are hard-demoted toward the back — a
        // promoter posting 20 nights can't bury every other scene. Demoted,
        // never deleted.
        if (hostN >= maxPerHost) val *= 0.05;
        if (val > bestVal) { bestVal = val; bestIdx = i; }
      }
      const { e } = remaining.splice(bestIdx, 1)[0];
      picked.push(e);
      usedCat.set(e.category, (usedCat.get(e.category) || 0) + 1);
      usedHost.set(e.author_id, (usedHost.get(e.author_id) || 0) + 1);
    }
    return picked;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FEED MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const FeedManager = {
  // Larger first page so the whole (currently small) catalogue lands in one fetch
  // — the drop feed never depends on flaky web infinite-scroll to show everything.
  PAGE_SIZE: 30,

  // Preload the next page in background so scroll feels instant
  prefetchPage(opts = {}) {
    const next = { ...opts, page: (opts.page || 0) + 1 };
    const dateKey = next.dateRange ? `${next.dateRange.from}_${next.dateRange.to}` : 'any';
    const key = `feed:${next.mode||'drop'}:${next.category||'all'}:${next.query||''}:${next.page}:${next.userId||'anon'}:${dateKey}`;
    if (!cache.get(key) && !cache.getStale(key)) {
      setTimeout(() => this.fetchPage(next).catch(() => {}), 800);
    }
  },

  async fetchPage({
    page = 0, category = 'all', query = '', mode = 'drop',
    userInterests = [], followedIds = [], userLat, userLon, userId = null,
    dateRange = null, refresh = false,
  } = {}) {
    const dateKey = dateRange ? `${dateRange.from}_${dateRange.to}` : 'any';
    const cacheKey = `feed:${mode}:${category}:${query}:${page}:${userId || 'anon'}:${dateKey}`;
    if (refresh) {
      cache.invalidate('feed:');
    }
    const stale = cache.getStale(cacheKey);
    const fresh = cache.get(cacheKey);
    if (fresh && !refresh) return fresh;
    if (stale) {
      this._revalidatePage({ page, category, query, mode, userInterests, followedIds, userLat, userLon, userId, dateRange }, cacheKey);
      return stale;
    }
    return dedupe(cacheKey, () => this._doFetchPage({ page, category, query, mode, userInterests, followedIds, userLat, userLon, userId, dateRange }, cacheKey));
  },

  async _doFetchPage({
    page = 0, category = 'all', query = '', mode = 'drop',
    userInterests = [], followedIds = [], userLat, userLon, userId = null,
    dateRange = null,
  } = {}, cacheKey) {

    // AI recommendations cache query removed
    const aiRecommendedIds = new Set();

    // "Mine" and "Upcoming" are meant to be COMPLETE lists (the host's own events /
    // the full upcoming catalogue), not an infinite-scroll discovery feed. Web
    // onEndReached is flaky, so a small page there means "not all my events show".
    // Pull a big single page for those modes so everything appears at once.
    const singlePage = (mode === 'mine' || mode === 'upcoming');
    const pageSize = singlePage ? 200 : this.PAGE_SIZE;

    // These modes are ONE page by design. If the list still asks for page 2+
    // (flaky onEndReached), don't hit the network: PostgREST answers an offset
    // past the last row with 416 Range Not Satisfiable, which spammed an error
    // on every load. There is nothing after page 0 here, so return empty.
    if (singlePage && page > 0) return [];

    // ── Tier helpers ──────────────────────────────────────────────────────────
    const buildBaseQuery = (select, opts = {}) => {
      const { count = 'estimated' } = opts;
      let q = supabase
        .from('events')
        .select(select, { count })
        .is('deleted_at', null)
        // null-safe: a row with status IS NULL must still show (NULL <> 'cancelled' is NULL in SQL)
        .or('status.is.null,status.neq.cancelled')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (category !== 'all') {
        const subCats = CAT_KEY_TO_SUBCATS[category];
        const catList = subCats && subCats.size > 0 ? [...subCats] : [category];
        // Use IN() — Supabase JS client encodes this as a POST-safe query
        q = q.in('category', catList);
      }
      if (dateRange?.from) q = q.gte('event_date', dateRange.from);
      if (dateRange?.to)   q = q.lte('event_date', dateRange.to);
      // "Upcoming" filters + ordering must come BEFORE the default created_at order
      // so PostgREST treats event_date as the primary sort column (first order wins).
      if (mode === 'upcoming') {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (!dateRange?.from) q = q.gte('event_date', todayStr);
        q = q.order('event_date', { ascending: true });
      } else if (query.trim()) {
        const s = sanitizeSearch(query);
        q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%,venue_name.ilike.%${s}%`).order('vibe_count', { ascending: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }
      // Following / mine author filters
      if (mode === 'following') {
        const ids = resolvedFollowedIds && resolvedFollowedIds.length ? resolvedFollowedIds : ['00000000-0000-0000-0000-000000000000'];
        q = q.in('author_id', ids);
      } else if (mode === 'mine') {
        q = q.eq('author_id', userId || '00000000-0000-0000-0000-000000000000');
      }
      return q;
    };

    // Resolve followed IDs once (shared across tiers)
    let resolvedFollowedIds = followedIds;
    if (mode === 'following' && userId && followedIds.length === 0) {
      try {
        const { data: followData } = await supabase.from('follows').select('following_id').eq('follower_id', userId).limit(200);
        resolvedFollowedIds = (followData || []).map(f => f.following_id);
      } catch { resolvedFollowedIds = []; }
    }

    const rankAndCache = async (data, count) => {
      // "Mine" / "Upcoming" are plain sorted lists — no heat re-rank.
      if (mode === 'mine') {
        const mineEvents = normalizeEvents((data || []).filter(e => !e.auto_hidden))
          .sort((a, b) => String(b.event_date || '').localeCompare(String(a.event_date || '')));
        const r = { events: mineEvents, total: count || 0, page, hasMore: data?.length === pageSize };
        cache.set(cacheKey, r);
        return r;
      }
      if (mode === 'upcoming') {
        const upcomingEvents = normalizeEvents((data || []).filter(e => !e.auto_hidden))
          .sort((a, b) => String(a.event_date || '').localeCompare(String(b.event_date || '')));
        const r = { events: upcomingEvents, total: count || 0, page, hasMore: data?.length === pageSize };
        cache.set(cacheKey, r);
        return r;
      }
      // Moderation: drop events auto-hidden by the trust-weighted report engine
      // (patch 25). Non-breaking pre-migration — auto_hidden is undefined on an
      // un-migrated DB, so nothing is filtered until the column + trigger exist.
      let events = normalizeEvents((data || []).filter(e => !e.auto_hidden));
      // SAFETY (Drop rule 26): events from people the viewer has BLOCKED or
      // MUTED never render. Blocking already gated DMs but the feed kept
      // showing the blocked host's events — that's the opposite of what a
      // block promises. Cached lists → ~zero cost after first load.
      if (userId) {
        try {
          const [blocked, muted] = await Promise.all([
            BlockManager.getBlockedIds(userId),
            MuteManager.getMutedIds(userId),
          ]);
          const hidden = new Set([...(blocked || []), ...(muted || [])]);
          if (hidden.size) events = events.filter(e => !hidden.has(e.author_id));
        } catch { /* never let safety filtering break the feed itself */ }
      }
      if (!query.trim()) {
        // Stamp heat scores so applyPersonalisedBoost can re-rank with them; add random jitter to shuffle drops.
        // eventScore returns 0 for FINISHED events — drop those here (the Drop
        // query has no date filter; this is the pipeline's "never show what's
        // over" gate, previously done by LandingPage's retired rankFeed pass).
        events = events
          .map(e => ({
            e,
            score: ScoreEngine.eventScore(e, { userInterests, followedIds: resolvedFollowedIds, userLat, userLon, aiRecommendedIds }),
          }))
          .filter(x => x.score > 0)
          .map(x => ({ ...x.e, _heatScore: x.score + (Math.random() - 0.5) * 80 }));
        events.sort((a, b) => b._heatScore - a._heatScore);
      } else {
        // B-sweep 3: in-feed SEARCH was ordered by vibe_count (fame-first) —
        // rank by real match relevance instead; non-matching fuzz drops out.
        const ranked = rankEventResults(query, events);
        if (ranked.length) events = ranked;
      }
      // AI recommendations assignment removed
      // Apply personalised traffic routing boost (non-blocking, best-effort)
      if (userId && page === 0) {
        try {
          const { applyPersonalisedBoost } = require('./personalizationEngine');
          events = await applyPersonalisedBoost(events, userId);
        } catch { /* silently skip — personalization is enhancement only */ }
      }
      // Final advance: diversity + explore/exploit re-rank (page 0 only, no search).
      if (page === 0 && !query.trim() && events.length > 3) {
        let seenIds = new Set();
        const dwellById = new Map();
        if (userId) {
          try {
            // Dwell-aware (Drop rule 15): HOW they saw it matters — an event they
            // lingered on or opened is live interest; one they skimmed past is a
            // pass. Falls back to ids-only if dwell columns aren't migrated.
            let { data: seen, error } = await supabase
              .from('event_views').select('event_id, dwell_ms, opened').eq('user_id', userId)
              .order('updated_at', { ascending: false }).limit(120);
            if (error) {
              ({ data: seen } = await supabase
                .from('event_views').select('event_id').eq('user_id', userId)
                .order('updated_at', { ascending: false }).limit(120));
            }
            (seen || []).forEach(r => {
              seenIds.add(r.event_id);
              dwellById.set(r.event_id, { dwellMs: r.dwell_ms || 0, opened: !!r.opened });
            });
          } catch { /* event_views may not be migrated — skip */ }
        }
        const coldStart = (userInterests?.length || 0) === 0 && resolvedFollowedIds.length === 0;
        events = ScoreEngine.diversify(events, { seenIds, dwellById, coldStart });

        // BOOSTED SLOT (Drop rule 37): a host holding an active ad token gets
        // ONE labeled "Promoted" placement at position 3 — a fixed slot, never
        // a ranking bribe (paid reach must not masquerade as organic heat).
        // Best-effort: RPC missing / no tokens → no slot, feed unchanged.
        if (userId && events.length > 4) {
          try {
            const { data: boosted } = await supabase.rpc('get_boosted_hosts');
            const boostedHosts = new Set((boosted || []).map(b => b.user_id));
            if (boostedHosts.size) {
              const SLOT = 2; // third card — visible without owning the top
              const idx = events.findIndex((e, i) => i > SLOT && boostedHosts.has(e.author_id));
              if (idx > SLOT) {
                const [promo] = events.splice(idx, 1);
                events.splice(SLOT, 0, { ...promo, _boosted: true });
              } else if (idx === -1 && events.slice(0, SLOT + 1).some(e => boostedHosts.has(e.author_id))) {
                // already organically high — label it, don't double-place
                events = events.map((e, i) => (i <= SLOT && boostedHosts.has(e.author_id)) ? { ...e, _boosted: true } : e);
              }
            }
          } catch { /* boosted slot is enhancement only */ }
        }
      }
      const result = { events, total: count || 0, page, hasMore: data?.length === this.PAGE_SIZE };
      cache.set(cacheKey, result);
      return result;
    };

    return resilientRead(
      // ── Tier 1 (Primary): full select with all profile joins ──────────────
      async () => {
        let q = buildBaseQuery('*, profiles!author_id(id, username, avatar_url, is_verified, is_online, last_seen, vibe_score)');
        if (mode === 'following') {
          if (resolvedFollowedIds.length === 0) return { events: [], total: 0, page, hasMore: false };
          q = q.in('author_id', resolvedFollowedIds);
        }
        const { data, error, count } = await q;
        if (error) throw error;
        return await rankAndCache(data, count);
      },
      // ── Tier 2 (Secondary): no profile join — lighter query ───────────────
      async () => {
        let q = buildBaseQuery('id, title, description, media, cover_url, vibe_count, rsvp_count, event_date, event_time, venue_name, category, author_id, lat, lon, price, created_at, is_verified, contact_phone, contact_email, age_min, age_max, tags, ticket_url, capacity, status, deleted_at, rsvp_tiers');
        if (mode === 'following' && resolvedFollowedIds.length > 0) q = q.in('author_id', resolvedFollowedIds);
        const { data, error, count } = await q;
        if (error) throw error;
        return await rankAndCache(data, count);
      },
      // ── Tier 3 (Tertiary): stale cache ────────────────────────────────────
      () => {
        const stale = cache.getStale(cacheKey);
        if (stale) return stale;
        throw new Error('cache miss');
      },
      // ── Mother escalation: empty safe result ──────────────────────────────
      { events: [], total: 0, page, hasMore: false },
      `FeedManager.fetchPage:${mode}`
    );
  },

  // Featured Gruv — pinned or highest scoring upcoming event
  async fetchFeatured({ userInterests = [], followedIds = [] } = {}) {
    const cacheKey = 'feed:featured';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const today = new Date().toISOString().split('T')[0];
    // The curator's OFFICIAL pick (is_featured) always wins; otherwise the
    // highest-scoring upcoming event. `is_featured` is an honest editorial flag
    // on a REAL event — it never fabricates likes/attendance (Truth Protocol).
    const pick = (data) => {
      if (!data?.length) return null;
      return [...data].sort((a, b) => {
        const fa = a.is_featured ? 1 : 0, fb = b.is_featured ? 1 : 0;
        if (fa !== fb) return fb - fa;
        return ScoreEngine.eventScore(b, { userInterests, followedIds })
             - ScoreEngine.eventScore(a, { userInterests, followedIds });
      })[0];
    };

    const result = await resilientRead(
      // Tier 1: full join with profile data
      async () => {
        const { data, error } = await supabase.from('events')
          .select('*, profiles!author_id(id, username, avatar_url, is_verified, vibe_score)')
          .gte('event_date', today).is('deleted_at', null).neq('status', 'cancelled')
          .order('vibe_count', { ascending: false }).limit(20);
        if (error) throw error;
        const best = pick(normalizeEvents(data));
        if (best) cache.set(cacheKey, best, 120000);
        return best;
      },
      // Tier 2: no profile join — lighter
      async () => {
        const { data, error } = await supabase.from('events')
          .select('id, title, description, media, vibe_count, going, event_date, event_time, venue_name, category, author_id, created_at, is_featured')
          .gte('event_date', today).is('deleted_at', null).neq('status', 'cancelled')
          .order('vibe_count', { ascending: false }).limit(20);
        if (error) throw error;
        return pick(normalizeEvents(data));
      },
      // Tier 3: stale cache
      () => { const s = cache.getStale(cacheKey); if (s) return s; throw new Error('miss'); },
      null,
      'FeedManager.fetchFeatured'
    );
    return result;
  },

  async searchAll(query) {
    if (!query.trim()) return { events: [], users: [] };
    const s = sanitizeSearch(query); // strip PostgREST .or() filter metacharacters

    return resilient(
      [
        // Tier 1: FTS + ilike + user search in parallel
        async () => {
          const [evRes, userRes, ftsRes] = await Promise.allSettled([
            supabase.from('events')
              .select('*, profiles!author_id(id, username, avatar_url)')
              .or(`title.ilike.%${s}%,description.ilike.%${s}%,category.ilike.%${s}%,venue_name.ilike.%${s}%,city.ilike.%${s}%`)
              .is('deleted_at', null).neq('status', 'cancelled')
              .order('vibe_count', { ascending: false }).limit(20),
            supabase.from('profiles')
              .select('id, username, display_name, avatar_url, bio, location, vibe_score')
              .or(`username.ilike.%${s}%,display_name.ilike.%${s}%,bio.ilike.%${s}%`).limit(10),
            supabase.rpc('search_events_fts', { search_query: s, limit_count: 20 }),
          ]);
          const ilikeEvents = evRes.status === 'fulfilled' ? normalizeEvents(evRes.value.data || []) : [];
          const users = userRes.status === 'fulfilled' ? (userRes.value.data || []) : [];
          const ftsEvents = ftsRes.status === 'fulfilled' && ftsRes.value.data?.length > 0 ? normalizeEvents(ftsRes.value.data) : null;
          const eventMap = new Map();
          (ftsEvents || ilikeEvents).forEach(e => eventMap.set(e.id, e));
          if (ftsEvents) ilikeEvents.forEach(e => { if (!eventMap.has(e.id)) eventMap.set(e.id, e); });

          // TYPO TOLERANCE: strict matching found nothing but the query looks
          // like a real word — pull a recent/upcoming candidate pool and fuzzy-
          // match client-side ("amapaino" still finds Amapiano night).
          let pool = [...eventMap.values()];
          if (pool.length === 0 && s.length >= 4) {
            try {
              const { data: fuzzPool } = await supabase.from('events')
                .select('id, title, description, media, cover_url, vibe_count, event_date, event_time, venue_name, category, city, author_id')
                .is('deleted_at', null).neq('status', 'cancelled')
                .gte('event_date', new Date(Date.now() - 86400000).toISOString().slice(0, 10))
                .order('created_at', { ascending: false }).limit(150);
              pool = normalizeEvents(fuzzPool || []);
            } catch { /* pool fetch is best-effort */ }
          }

          // RELEVANCE, not fame: best MATCH first (field-weighted + fuzzy),
          // upcoming above finished; vibe_count is only a tiebreak.
          let rankedEvents = rankEventResults(s, pool);
          // FTS can match stems our client scorer can't see ("dancing"→"danc").
          // Server said these matched — never let the re-ranker erase them.
          if (!rankedEvents.length && eventMap.size) rankedEvents = [...eventMap.values()];
          let rankedUsers = rankUserResults(s, users);
          if (!rankedUsers.length && users.length) rankedUsers = users;
          return {
            events: rankedEvents.slice(0, 20),
            users: rankedUsers.slice(0, 10),
          };
        },
        // Tier 2: ilike-only on events, no user search
        async () => {
          const { data, error } = await supabase.from('events')
            .select('id, title, media, vibe_count, event_date, venue_name, category')
            .or(`title.ilike.%${s}%,venue_name.ilike.%${s}%`)
            .is('deleted_at', null).neq('status', 'cancelled')
            .order('vibe_count', { ascending: false }).limit(15);
          if (error) throw error;
          return { events: normalizeEvents(data || []), users: [] };
        },
        // Tier 3: title-only prefix search
        async () => {
          const { data, error } = await supabase.from('events')
            .select('id, title, vibe_count, event_date, venue_name, category')
            .ilike('title', `%${s}%`).limit(10);
          if (error) throw error;
          return { events: normalizeEvents(data || []), users: [] };
        },
      ],
      {
        attemptsPerTier: 2,
        baseMs: 200,
        label: 'FeedManager.searchAll',
        onExhausted: () => ({ events: [], users: [] }),
        fallbackValue: { events: [], users: [] },
      }
    );
  },

  async fetchSingle(eventId) {
    const cacheKey = `event:${eventId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    return resilientRead(
      // Tier 1: full event + profile join
      async () => {
        const { data, error } = await supabase.from('events')
          .select('*, profiles!author_id(id, username, avatar_url, is_verified, is_online, last_seen, vibe_score)')
          .eq('id', eventId).single();
        if (error) throw error;
        const normalized = normalizeEvent(data);
        if (normalized) cache.set(cacheKey, normalized);
        return normalized;
      },
      // Tier 2: base event fields only
      async () => {
        const { data, error } = await supabase.from('events')
          .select('id, title, description, media, vibe_count, going, event_date, event_time, venue_name, category, author_id, lat, lon, price, created_at')
          .eq('id', eventId).single();
        if (error) throw error;
        return normalizeEvent(data);
      },
      // Tier 3: stale cache
      () => { const s = cache.getStale(cacheKey); if (s) return s; throw new Error('miss'); },
      null,
      `FeedManager.fetchSingle:${eventId}`
    );
  },

  // Background revalidation — updates cache silently, does NOT throw
  async _revalidatePage(opts, cacheKey) {
    try {
      const { page, category, query, mode, userInterests, followedIds, userLat, userLon, userId } = opts;
      let q = supabase
          .from('events')
          .select('*, profiles!author_id(id, username, avatar_url, is_verified, is_online, last_seen, vibe_score)', { count: 'estimated' })
          .is('deleted_at', null)
          .neq('status', 'cancelled')
          .range(page * this.PAGE_SIZE, (page + 1) * this.PAGE_SIZE - 1);
      if (category !== 'all') {
        const subCats = CAT_KEY_TO_SUBCATS[category];
        const catList = subCats && subCats.size > 0 ? [...subCats] : [category];
        q = q.in('category', catList);
      }
      if (query.trim()) {
        const s = sanitizeSearch(query); // strip PostgREST .or() filter metacharacters
        q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%,category.ilike.%${s}%,venue_name.ilike.%${s}%,city.ilike.%${s}%`).order('vibe_count', { ascending: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }
      const { data, count } = await q;
      if (!data) return;
      const normalizedData = normalizeEvents(data);
      let events = [...normalizedData].sort((a, b) =>
          ScoreEngine.eventScore(b, { userInterests, followedIds, userLat, userLon }) -
          ScoreEngine.eventScore(a, { userInterests, followedIds, userLat, userLon })
      );
      cache.set(cacheKey, { events, total: count || 0, page, hasMore: events.length === this.PAGE_SIZE }, CACHE_TTL);
    } catch { /* silent */ }
  },

  invalidate(eventId) {
    if (eventId) cache.invalidate(`event:${eventId}`);
    cache.invalidate('feed:');
    cache.invalidate('happening_now');
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TRENDING MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const TrendingManager = {
  async fetch(limit = 8) {
    const cacheKey = `trending:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    return dedupe(cacheKey, () => this._doFetch(limit, cacheKey));
  },

  async _doFetch(limit, cacheKey) {

    // Try the RPC first — falls back to a direct query if the function doesn't exist yet
    try {
      const { data } = await supabase.rpc('find_popular_spots', { limit_count: limit });
      if (data?.length > 0) { cache.set(cacheKey, data, 120000); return data; }
    } catch { /* RPC not yet deployed — use fallback below */ }

    // Fallback: pull candidate pool, rank by Wilson+velocity heat score
    try {
      const { data: events } = await supabase
        .from('events')
        .select('id, title, description, media, poster_mode, vibe_count, going, event_date, event_time, venue_name, category, created_at')
        .neq('status', 'cancelled')
        .is('deleted_at', null)
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('vibe_count', { ascending: false })
        .limit(limit * 4); // oversample so we can re-rank
      const normalizedEvents = normalizeEvents(events);
      if (normalizedEvents?.length > 0) {
        const ranked = [...normalizedEvents]
          .sort((a, b) => ScoreEngine.heatScore(b) - ScoreEngine.heatScore(a))
          .slice(0, limit);
        const mapped = ranked.map((e, i) => ({
          event_id: e.id,
          title: e.title,
          description: e.description || e.title,
          image: e.media?.[0]?.url || null,
          rsvp_count: e.going || 0,
          vibe_count: e.vibe_count || 0,
          heat: Math.round(ScoreEngine.heatScore(e)),
          rank: i + 1,
        }));
        cache.set(cacheKey, mapped, 120000);
        return mapped;
      }
    } catch (e) { logError('Leaderboard.primary', e); }

    return [];
  },

  // Set of event IDs that are "turning up" right now — recent engagement
  // velocity well above their city baseline (see get_hot_event_ids SQL).
  // Returns a Set for O(1) lookup per tile; empty Set if not deployed yet.
  async fetchHotIds() {
    const cacheKey = 'hot_event_ids';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase.rpc('get_hot_event_ids');
      const ids = new Set((data || []).map((r) => r.event_id));
      cache.set(cacheKey, ids, 120000); // 2 min — it's a "right now" signal
      return ids;
    } catch {
      return new Set(); // function not migrated / offline
    }
  },

  // "Rising Now" — events ACCELERATING right now (momentum), not just popular.
  // Returns event rows enriched with `_momentum` (× lift) and `_risingPct`
  // (e.g. +240%). Empty array if the RPC isn't deployed. (see get_rising_events)
  async fetchRising(limit = 12) {
    const cacheKey = `rising:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data: rows, error } = await supabase.rpc('get_rising_events', { p_limit: limit });
      if (error) throw error;
      const order = (rows || []).filter(r => r.event_id);
      if (order.length === 0) { cache.set(cacheKey, [], 120000); return []; }
      const ids = order.map(r => r.event_id);
      const momById = new Map(order.map(r => [r.event_id, Number(r.momentum) || 0]));
      const { data: evs } = await supabase.from('events')
        .select('*, profiles!author_id(username, avatar_url)')
        .in('id', ids)
        .is('deleted_at', null).neq('status', 'cancelled');
      const enriched = normalizeEvents(evs || [])
        .map(e => {
          const m = momById.get(e.id) || 0;
          return { ...e, _momentum: m, _risingPct: Math.round((m - 1) * 100) };
        })
        // preserve the RPC's momentum ordering
        .sort((a, b) => (momById.get(b.id) || 0) - (momById.get(a.id) || 0));
      cache.set(cacheKey, enriched, 120000); // 2 min — it's a "right now" signal
      return enriched;
    } catch {
      return []; // function not migrated / offline
    }
  },

  async fetchHappeningNow() {
    const cacheKey = 'happening_now';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const rank = (data) => (data || []).sort((a, b) => ScoreEngine.heatScore(b) - ScoreEngine.heatScore(a)).slice(0, 8);

    return resilientRead(
      // Tier 1: with profile join
      async () => {
        const { data, error } = await supabase.from('events')
          .select('*, profiles!author_id(username, avatar_url)')
          .gte('event_date', today).lte('event_date', tomorrow)
          .is('deleted_at', null).neq('status', 'cancelled')
          .order('vibe_count', { ascending: false }).limit(20);
        if (error) throw error;
        const events = rank(normalizeEvents(data));
        cache.set(cacheKey, events, 60000);
        return events;
      },
      // Tier 2: no profile join
      async () => {
        const { data, error } = await supabase.from('events')
          .select('id, title, media, poster_mode, vibe_count, going, event_date, event_time, venue_name, category, created_at')
          .gte('event_date', today).lte('event_date', tomorrow)
          .is('deleted_at', null).neq('status', 'cancelled')
          .order('vibe_count', { ascending: false }).limit(20);
        if (error) throw error;
        return rank(normalizeEvents(data));
      },
      // Tier 3: stale cache
      () => { const s = cache.getStale(cacheKey); if (s) return s; throw new Error('miss'); },
      [],
      'TrendingManager.fetchHappeningNow'
    );
  },

  async fetchThisWeek() {
    const cacheKey = 'this_week';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      // End of the current calendar week (Sunday), capped at 7 days out
      const endOfWeek = new Date(now);
      const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
      endOfWeek.setDate(now.getDate() + daysUntilSunday);
      const weekEnd = endOfWeek.toISOString().split('T')[0];
      const { data } = await supabase
        .from('events')
        .select('id, title, media, poster_mode, vibe_count, going, event_date, event_time, venue_name, category, created_at, profiles(username, avatar_url)')
        .gte('event_date', today)
        .lte('event_date', weekEnd)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .order('vibe_count', { ascending: false })
        .limit(20);
      // B-sweep 3: the week rail shows what's HOT this week, not most-liked —
      // rank the fetched pool by the canonical heat before caching.
      const result = (data || []).slice().sort((a, b) => canonicalHeatScore(b) - canonicalHeatScore(a));
      cache.set(cacheKey, result, 300000); // 5-min TTL
      return result;
    } catch { return []; }
  },

  // Returns { category: count } with a hard ceiling to avoid full scans
  async fetchCategoryCounts() {
    const cacheKey = 'category_counts';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('events')
        .select('category')
        .not('category', 'is', null)
        .limit(500); // cap — avoids full-table scans
      if (!data) return {};
      const counts = {};
      data.forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1; });
      cache.set(cacheKey, counts, 300000);
      return counts;
    } catch { return {}; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// VIBE MANAGER  (reactions on events)
// ─────────────────────────────────────────────────────────────────────────────
export const VibeManager = {
  // Returns true on success, 'self' if own event, null on failure
  async sendVibe(eventId, userId, authorId = null) {
    if (SecurityService.isThrottled(`vibe_${eventId}_${userId}`, 1000)) return true;
    if (!isSupabaseEnabled) { FeedManager.invalidate(eventId); return true; }

    // Self-vibe check — use passed authorId first to avoid extra round-trip
    const ownerId = authorId ?? (await supabase.from('events').select('author_id').eq('id', eventId).maybeSingle()).data?.author_id;
    if (ownerId === userId) return 'self';

    const result = await resilient(
      [
        // Tier 1: upsert with conflict resolution
        () => supabase.from('event_vibes').upsert({ event_id: eventId, user_id: userId }, { onConflict: 'event_id,user_id', ignoreDuplicates: true }),
        // Tier 2: plain insert (fallback if upsert fails on this DB version)
        () => supabase.from('event_vibes').insert({ event_id: eventId, user_id: userId }),
        // Tier 3: RPC increment — bypasses row insert entirely
        () => supabase.rpc('increment_vibe_count', { p_event_id: eventId, p_user_id: userId }),
      ],
      { attemptsPerTier: 3, baseMs: 300, label: 'VibeManager.sendVibe', fallbackValue: null }
    );
    if (result !== null) {
      FeedManager.invalidate(eventId);
      VibeEquityLedger.mintEquity(userId, 'SOCIAL_RESONANCE').catch(() => {});
      ScoreEngine.computeVibeScore(userId).catch(() => {});
      _notifyEventAuthor(eventId, userId, 'vibe').catch(() => {});
      return true;
    }
    log.error('VibeManager:sendVibe', 'all tiers exhausted');
    return null;
  },

  async removeVibe(eventId, userId) {
    if (!isSupabaseEnabled) { FeedManager.invalidate(eventId); return true; }

    const result = await resilient(
      [
        // Tier 1: delete by composite key
        () => supabase.from('event_vibes').delete().eq('event_id', eventId).eq('user_id', userId),
        // Tier 2: retry delete (transient failure)
        () => supabase.from('event_vibes').delete().eq('event_id', eventId).eq('user_id', userId),
        // Tier 3: RPC decrement — skip row delete entirely
        () => supabase.rpc('decrement_vibe_count', { p_event_id: eventId, p_user_id: userId }),
      ],
      { attemptsPerTier: 3, baseMs: 300, label: 'VibeManager.removeVibe', fallbackValue: null }
    );
    if (result !== null) { FeedManager.invalidate(eventId); return true; }
    log.error('VibeManager:removeVibe', 'all tiers exhausted');
    return null;
  },

  async getUserVibes(eventIds, userId) {
    if (!userId || !eventIds.length) return new Set();
    const cacheKey = `user_vibes:${userId}:${eventIds.slice(0, 3).join(',')}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('event_vibes')
        .select('event_id')
        .eq('user_id', userId)
        .in('event_id', eventIds);
      const result = new Set((data || []).map(v => v.event_id));
      cache.set(cacheKey, result, 30000);
      return result;
    } catch { return new Set(); }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RSVP MANAGER  (Locked In / Maybe / Not Going)
// ─────────────────────────────────────────────────────────────────────────────
export const RSVPManager = {
  async upsert(eventId, userId, status) {
    if (SecurityService.isThrottled(`rsvp_${eventId}_${userId}`, 1500)) return true;
    if (!isSupabaseEnabled) { FeedManager.invalidate(eventId); return true; }
    // SECURITY: prevent self-RSVP (organiser inflating own attendance)
    const { data: evt } = await supabase.from('events').select('author_id').eq('id', eventId).maybeSingle();
    if (evt?.author_id === userId) throw new Error('Organisers cannot RSVP to their own events.');

    const ok = await resilient(
      [
        // Tier 1: upsert with conflict key
        () => supabase.from('event_rsvps').upsert({ event_id: eventId, user_id: userId, status }, { onConflict: 'event_id,user_id' }),
        // Tier 2: delete old + insert fresh (avoids upsert constraints)
        async () => {
          await supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', userId);
          return supabase.from('event_rsvps').insert({ event_id: eventId, user_id: userId, status });
        },
        // Tier 3: RPC — server-side atomic upsert
        () => supabase.rpc('upsert_rsvp', { p_event_id: eventId, p_user_id: userId, p_status: status }),
      ],
      { attemptsPerTier: 3, baseMs: 350, label: 'RSVPManager.upsert', fallbackValue: false }
    );
    if (ok !== false) {
      cache.invalidate(`rsvp:${userId}`);
      FeedManager.invalidate(eventId);
      if (status === 'going') {
        _notifyEventAuthor(eventId, userId, 'rsvp').catch(() => {});
        ScoreEngine.computeVibeScore(userId).catch(() => {});
        // Refresh deep profile after each RSVP — throttled by the engine itself
        // require(), not import(): async chunks never register under
        // web.output:'single', so import() here silently never ran in prod.
        try {
          require('./personalizationEngine').computeUserDeepProfile(userId).catch(() => {});
        } catch { /* deep profile is best-effort */ }
      }
      return true;
    }
    return false;
  },

  async remove(eventId, userId) {
    const ok = await resilient(
      [
        // Tier 1: direct delete
        () => supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', userId),
        // Tier 2: update status to 'cancelled' (soft delete)
        () => supabase.from('event_rsvps').update({ status: 'cancelled' }).eq('event_id', eventId).eq('user_id', userId),
        // Tier 3: RPC remove
        () => supabase.rpc('remove_rsvp', { p_event_id: eventId, p_user_id: userId }),
      ],
      { attemptsPerTier: 3, baseMs: 300, label: 'RSVPManager.remove', fallbackValue: false }
    );
    if (ok !== false) { cache.invalidate(`rsvp:${userId}`); return true; }
    return false;
  },

  async getUserStatus(eventId, userId) {
    if (!userId) return null;
    try {
      const { data } = await supabase
        .from('event_rsvps')
        .select('status')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();
      return data?.status ?? null;
    } catch { return null; }
  },

  async getGoingCount(eventId) {
    try {
      // event_rsvps has NO `id` column (composite PK on event_id+user_id) — the
      // same trap that broke the follow button. Selecting `id` 400s, count comes
      // back undefined, and every event silently reported "0 going".
      const { count, error } = await supabase
        .from('event_rsvps')
        .select('event_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'going');
      if (error) { logError('RSVP.goingCount', error, { code: error.code }); return 0; }
      return count || 0;
    } catch (e) { logError('RSVP.goingCount', e); return 0; }
  },

  // Fetch all RSVPs for a user's events in one shot (for organiser dashboards)
  async getEventRSVPs(eventId) {
    const cacheKey = `rsvps:${eventId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('event_rsvps')
        .select('status, user_id, profiles(username, avatar_url)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(200);
      const result = data || [];
      cache.set(cacheKey, result, 60000);
      return result;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BOOKMARK MANAGER  (Saved Gruvs)
// ─────────────────────────────────────────────────────────────────────────────
export const BookmarkManager = {
  async toggle(eventId, userId, isSaved) {
    if (!isSupabaseEnabled) return !isSaved;
    try {
      if (isSaved) {
        await supabase.from('saved_events').delete().eq('event_id', eventId).eq('user_id', userId);
      } else {
        await supabase.from('saved_events').upsert({ event_id: eventId, user_id: userId });
      }
      cache.invalidate(`saved:${userId}`);
      return !isSaved;
    } catch { return isSaved; }
  },

  async getUserSaved(userId) {
    const cacheKey = `saved:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('saved_events')
        .select('event_id, events(id, title, event_date, category, media, vibe_count)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      const result = new Set((data || []).map(r => r.event_id));
      cache.set(cacheKey, result);
      return result;
    } catch { return new Set(); }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGER  (follow/unfollow, social graph, profile)
// ─────────────────────────────────────────────────────────────────────────────
export const UserManager = {
  async follow(followerId, followingId) {
    if (!isSupabaseEnabled) return true;
    // NOTE: the Supabase client resolves (not rejects) on errors — each tier MUST
    // inspect `error` and throw, otherwise an RLS denial looks like success and
    // the follow silently never saves.
    const res = await resilient(
      [
        // Tier 1: SECURITY DEFINER RPC — reliable, RLS-proof primary path
        async () => {
          const { error } = await supabase.rpc('follow_user', { p_follower_id: followerId, p_following_id: followingId });
          if (error) throw error;
          return true;
        },
        // Tier 2: upsert with conflict ignore (no-op if already following)
        async () => {
          const { error } = await supabase.from('follows').upsert({ follower_id: followerId, following_id: followingId }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true });
          if (error) throw error;
          return true;
        },
        // Tier 3: plain insert (if upsert syntax unsupported); ignore duplicate rows
        async () => {
          const { error } = await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId });
          if (error && !/duplicate|already exists|unique/i.test(error.message || '')) throw error;
          return true;
        },
      ],
      { attemptsPerTier: 2, baseMs: 300, label: 'UserManager.follow', fallbackValue: null }
    );
    if (res === null) throw new Error('Could not save follow — please try again.');
    cache.invalidate(`follows:${followerId}`);
    cache.invalidate(`followers:${followingId}`);
    _notify(followingId, followerId, 'follow', 'Someone locked in to your Gruvs', '').catch(() => {});
    ScoreEngine.computeVibeScore(followerId).catch(() => {});
    ScoreEngine.computeVibeScore(followingId).catch(() => {});
    return true;
  },

  async unfollow(followerId, followingId) {
    if (!isSupabaseEnabled) return true;
    const res = await resilient(
      [
        // Tier 1: SECURITY DEFINER RPC — reliable, RLS-proof primary path
        async () => {
          const { error } = await supabase.rpc('unfollow_user', { p_follower_id: followerId, p_following_id: followingId });
          if (error) throw error;
          return true;
        },
        // Tier 2: direct delete
        async () => {
          const { error } = await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId);
          if (error) throw error;
          return true;
        },
      ],
      { attemptsPerTier: 2, baseMs: 300, label: 'UserManager.unfollow', fallbackValue: null }
    );
    if (res === null) throw new Error('Could not unfollow — please try again.');
    cache.invalidate(`follows:${followerId}`);
    cache.invalidate(`followers:${followingId}`);
    return true;
  },

  async isFollowing(followerId, followingId) {
    if (!followerId || !followingId) return false;
    try {
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();
      return !!data;
    } catch { return false; }
  },

  async getFollowedIds(userId) {
    const cacheKey = `follows:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)
        .limit(2000);
      const result = (data || []).map(r => r.following_id);
      cache.set(cacheKey, result);
      return result;
    } catch { return []; }
  },

  async getFollowerCount(userId) {
    try {
      const { count } = await supabase
        .from('follows')
        .select('follower_id', { count: 'estimated', head: true })
        .eq('following_id', userId);
      return count || 0;
    } catch { return 0; }
  },

  async getProfile(userId) {
    const cacheKey = `profile:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    return resilientRead(
      // Tier 1: public profile fields (no sensitive columns)
      async () => {
        const { data, error } = await supabase.from('profiles')
          .select('id, username, display_name, avatar_url, bio, vibe_score, is_verified, is_online, last_seen, identity_mode, is_beacon_active, interests, location, career_title, is_discoverable, share_events, gender')
          .eq('id', userId).single();
        if (error) throw error;
        if (data) cache.set(cacheKey, data);
        return data;
      },
      // Tier 2: minimal public fields
      async () => {
        const { data, error } = await supabase.from('profiles')
          .select('id, username, display_name, avatar_url, bio, vibe_score, is_verified, is_online, last_seen')
          .eq('id', userId).single();
        if (error) throw error;
        return data;
      },
      // Tier 3: stale cache
      () => { const s = cache.getStale(cacheKey); if (s) return s; throw new Error('miss'); },
      null,
      `UserManager.getProfile:${userId}`
    );
  },

  async updateProfile(userId, updates) {
    // Sanitize user-provided text fields; strip _shield_* metadata before DB write
    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.display_name) sanitizedUpdates.display_name = SecurityService.sanitizeContent(sanitizedUpdates.display_name);
    if (sanitizedUpdates.bio)          sanitizedUpdates.bio          = SecurityService.sanitizeContent(sanitizedUpdates.bio);
    if (sanitizedUpdates.username)     sanitizedUpdates.username     = SecurityService.sanitizeContent(sanitizedUpdates.username);
    // Remove internal keys that must never reach the database
    delete sanitizedUpdates._shield_ts;
    delete sanitizedUpdates._shield_entropy;
    const payload = { ...sanitizedUpdates, updated_at: new Date().toISOString() };

    const data = await resilient(
      [
        // Tier 1: full update + return row
        async () => {
          const { data: d, error } = await supabase.from('profiles').update(payload).eq('id', userId).select().single();
          if (error) throw error;
          return d;
        },
        // Tier 2: update without select (fire-and-forget confirm)
        async () => {
          const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
          if (error) throw error;
          return { id: userId, ...payload };
        },
        // Tier 3: RPC update
        async () => {
          const { data: d, error } = await supabase.rpc('update_profile', { p_user_id: userId, p_updates: payload });
          if (error) throw error;
          return d || { id: userId, ...payload };
        },
      ],
      { attemptsPerTier: 3, baseMs: 400, label: 'UserManager.updateProfile', fallbackValue: null }
    );
    if (data) {
      cache.invalidate(`profile:${userId}`);
      cache.invalidate(`profile_stats:${userId}`);
    }
    return data;
  },

  // Upsert profile row — safe to call on every sign-in for new users
  async ensureProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      if (!data) {
        await supabase.from('profiles').insert({
          id: userId,
          username: `viber_${userId.slice(0, 8)}`,
          vibe_score: 0,
        });
      }
    } catch (e) { logError('Profile.ensureExists', e, { userId }); }
  },

  async getMutuals(userId) {
    if (!userId) return [];
    try {
      const followingIds = await this.getFollowedIds(userId);
      if (!followingIds.length) return [];
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId)
        .in('follower_id', followingIds);
      if (error) throw error;
      return (data || []).map(r => r.follower_id);
    } catch { return []; }
  },

  async getNeighborhoodVibers(userId, city) {
    if (!city) return [];
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, city, vibe_score, is_online, last_seen')
        .eq('city', city)
        .eq('is_discoverable', true)
        .neq('id', userId)
        .order('vibe_score', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const NotificationManager = {
  async fetch(userId, limit = 100) {
    if (!userId) return [];
    const cacheKey = `notifs:${userId}`;
    const stale = cache.getStale(cacheKey);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      const result = data || [];
      cache.set(cacheKey, result, 30000);
      return result;
    } catch { return stale || []; }
  },

  async markRead(notifId) {
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', notifId);
      return true;
    } catch { return false; }
  },

  async markAllRead(userId) {
    try {
      await supabase.from('notifications')
        .update({ read: true }).eq('recipient_id', userId).eq('read', false);
      cache.invalidate(`notifs:${userId}`);
      return true;
    } catch { return false; }
  },

  async getUnreadCount(userId) {
    if (!userId) return 0;
    try {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('read', false);
      return count || 0;
    } catch { return 0; }
  },

  // Subscribe to new notifications in real-time
  subscribe(userId, onNew) {
    const channel = supabase
      .channel(`notifs_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, payload => {
        cache.invalidate(`notifs:${userId}`);
        onNew?.(payload.new);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK-IN MANAGER  (Touch Down)
// ─────────────────────────────────────────────────────────────────────────────
export const CheckInManager = {
  async touchDown(eventId, userId, coords = {}, opts = {}) {
    // A replay from the offline queue must never be swallowed by the throttle:
    // it would report success without inserting, and the queue would then drop
    // the record — losing the exact Touch Down the queue exists to protect.
    if (!opts.replay && SecurityService.isThrottled(`touchdown_${eventId}_${userId}`, 5000)) return true;
    if (!isSupabaseEnabled) {
      FeedManager.invalidate(eventId);
      return true;
    }
    try {
      // Core columns always present; expires_at/identity_mode keep the live
      // "here now" count honest (auto-expiry) + ghost-aware. Send them when we
      // have them, but fall back to core-only if the DB isn't migrated yet so a
      // Touch Down never fails on an older schema.
      const core = {
        user_id: userId,
        event_id: eventId,
        lat: coords.lat ?? null,
        lon: coords.lon ?? null,
        // A queued check-in replays with the time it actually happened, not the
        // time the network came back — otherwise a Touch Down at 11pm in a dead
        // zone lands at 9am the next morning and the presence record is a lie.
        checked_in_at: opts.checkedInAt || new Date().toISOString(),
      };
      const full = { ...core };
      if (opts.expiresAt) full.expires_at = opts.expiresAt;
      if (opts.identityMode) full.identity_mode = opts.identityMode;

      // Idempotent + constraint-independent. Some live DBs lack the optional
      // columns (identity_mode) and/or the UNIQUE(user_id,event_id) the old upsert
      // relied on — both made Touch Down silently fail. So: if already here,
      // succeed; otherwise plain INSERT, falling back to core columns when the
      // optional ones aren't migrated, and treating a duplicate race as success.
      const { data: existing } = await supabase
        .from('live_checkins').select('id').eq('user_id', userId).eq('event_id', eventId).maybeSingle();
      if (!existing) {
        let { error } = await supabase.from('live_checkins').insert(full);
        if (error && /expires_at|identity_mode|column|schema cache/i.test(error.message || '')) {
          ({ error } = await supabase.from('live_checkins').insert(core));
        }
        if (error && /duplicate|unique|conflict/i.test(error.message || '')) error = null; // raced — already here
        if (error) { console.warn('[touchDown] insert failed:', error.message); logError('CheckIn.touchDown', error, { code: error.code }); throw error; }
      }

      // F2 — ONE vibe_score writer. The check-in row inserted above IS the
      // contribution signal: computeVibeScore counts live_checkins at the
      // highest weight and recomputes the score deterministically. The old
      // direct "+8" here was one of THREE writers clobbering each other.
      ScoreEngine.computeVibeScore(userId).catch(() => {});

      cache.invalidate(`profile:${userId}`);
      cache.invalidate(`profile_stats:${userId}`);

      // MINT EQUITY: Physical Presence
      VibeEquityLedger.mintEquity(userId, 'PHYSICAL_CHECKIN').catch(() => { });

      _notifyEventAuthor(eventId, userId, 'checkin').catch(() => { });

      // Check-ins are the highest-trust signal — always refresh deep profile
      try {
        require('./personalizationEngine').computeUserDeepProfile(userId).catch(() => {});
      } catch { /* deep profile is best-effort */ }

      return true;
    } catch (e) {
      logError('CheckIn.touchDown', e, { code: e?.code });
      return false;
    }
  },

  async hasCheckedIn(eventId, userId) {
    if (!userId) return false;
    try {
      const { data } = await supabase
        .from('live_checkins')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();
      return !!data;
    } catch { return false; }
  },

  async getLiveAttendees(eventId) {
    const cacheKey = `attendees:${eventId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('live_checkins')
        .select('user_id, checked_in_at, profiles(username, avatar_url, vibe_score)')
        .eq('event_id', eventId)
        .order('checked_in_at', { ascending: false })
        .limit(50);
      const result = data || [];
      cache.set(cacheKey, result, 30000);
      return result;
    } catch { return []; }
  },

  /**
   * Crossed Paths — people who keep touching down at the same events/venues as
   * the user, across their check-in history. Returned ranked from the person
   * they've crossed most often to the least.
   *
   * Tries the server-side `get_crossed_paths` RPC first (fast, privacy-safe);
   * falls back to a client-side aggregation so the feature works even before
   * the RPC is deployed. Ghost-mode check-ins are excluded — they're anonymous
   * by design and shouldn't surface as a recognisable familiar face.
   */
  async getCrossedPaths(userId, { lookback = 100, limit = 50 } = {}) {
    if (!userId || !isSupabaseEnabled) return [];

    // Block is absolute: never surface anyone the user has blocked. (The RPC also
    // excludes blocks server-side in BOTH directions once deployed; this is the
    // client-side guarantee + defence-in-depth before that SQL is run.)
    const blocked = new Set(await BlockManager.getBlockedIds(userId).catch(() => []));

    // ── Server-side RPC (preferred) ───────────────────────────────────────
    try {
      const { data, error } = await supabase.rpc('get_crossed_paths', {
        p_user_id: userId,
        p_limit: limit,
      });
      if (!error && Array.isArray(data)) {
        return data.map(r => ({
          id:           r.user_id,
          username:     r.username,
          display_name: r.display_name,
          avatar_url:   r.avatar_url,
          vibe_score:   r.vibe_score,
          is_online:    r.is_online,
          last_seen:    r.last_seen,
          is_verified:  r.is_verified,
          identity_mode: r.identity_mode,
          crossings:    Number(r.crossings) || 0,
          venues:       Array.isArray(r.venues) ? r.venues.filter(Boolean).slice(0, 4) : [],
          lastCrossedAt: r.last_crossed_at,
          // Ghosts are uncrossable — filter client-side too, in case the RPC doesn't.
        })).filter(r => !blocked.has(r.id) && r.identity_mode !== 'ghost');
      }
    } catch { /* fall through to client-side aggregation */ }

    // ── Client-side fallback ──────────────────────────────────────────────
    try {
      // 1. The user's own check-in history (most-recent events first)
      const { data: mine } = await supabase
        .from('live_checkins')
        .select('event_id, checked_in_at')
        .eq('user_id', userId)
        .order('checked_in_at', { ascending: false })
        .limit(lookback);

      const myEventIds = [...new Set((mine || []).map(r => r.event_id).filter(Boolean))];
      if (myEventIds.length === 0) return [];

      // 2. Everyone else who touched down at those same events
      const { data: others } = await supabase
        .from('live_checkins')
        .select('user_id, event_id, checked_in_at, identity_mode, profiles(id, username, display_name, avatar_url, vibe_score, is_online, last_seen, is_verified, identity_mode, is_discoverable, is_beacon_active)')
        .in('event_id', myEventIds)
        .neq('user_id', userId)
        .limit(3000);

      // 3. Event → venue/title labels for the "where you crossed" line
      const { data: evRows } = await supabase
        .from('events')
        .select('id, title, venue_name, city')
        .in('id', myEventIds);
      const evMap = new Map((evRows || []).map(e => [e.id, e]));

      // 4. Aggregate per person: distinct shared events, venues, last crossing
      const agg = new Map();
      for (const row of (others || [])) {
        if (!row.profiles) continue;
        if (blocked.has(row.user_id)) continue; // block is absolute
        const mode = row.identity_mode || row.profiles.identity_mode;
        if (mode === 'ghost') continue; // ghosts are uncrossable
        // Incognito (internal key 'celebrity') is hidden unless they Drop a Beacon.
        if (mode === 'celebrity' && !row.profiles.is_beacon_active) continue;
        // Privacy opt-out: users who turned off discoverability don't surface as
        // a crossed path either (consistent with Find Them). Only excludes an
        // explicit false so un-migrated/null profiles still appear.
        if (row.profiles.is_discoverable === false) continue;

        let a = agg.get(row.user_id);
        if (!a) {
          a = { profile: row.profiles, events: new Set(), venues: new Set(), lastCrossedAt: row.checked_in_at };
          agg.set(row.user_id, a);
        }
        a.events.add(row.event_id);
        const ev = evMap.get(row.event_id);
        const label = ev?.venue_name || ev?.title || ev?.city;
        if (label) a.venues.add(label);
        if (row.checked_in_at && (!a.lastCrossedAt || row.checked_in_at > a.lastCrossedAt)) {
          a.lastCrossedAt = row.checked_in_at;
        }
      }

      // 5. Rank most → least
      return [...agg.values()]
        .map(a => ({
          id:           a.profile.id,
          username:     a.profile.username,
          display_name: a.profile.display_name,
          avatar_url:   a.profile.avatar_url,
          vibe_score:   a.profile.vibe_score,
          is_online:    a.profile.is_online,
          last_seen:    a.profile.last_seen,
          is_verified:  a.profile.is_verified,
          identity_mode: a.profile.identity_mode,
          crossings:    a.events.size,
          venues:       [...a.venues].slice(0, 4),
          lastCrossedAt: a.lastCrossedAt,
        }))
        .sort((x, y) => (y.crossings - x.crossings) || (new Date(y.lastCrossedAt || 0) - new Date(x.lastCrossedAt || 0)))
        .slice(0, limit);
    } catch {
      return [];
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY MANAGER  (Nearby events & Vibers)
// ─────────────────────────────────────────────────────────────────────────────
export const DiscoveryManager = {
  // Find nearby events and re-rank by a geo×social composite.
  // Social boost: events hosted by followed users or path-crossed users are surfaced higher
  // even if slightly further away — because real-world social graph proximity matters more than
  // raw kilometres for event discovery.
  async findNearbyEvents(lat, lon, radiusKm = 25, { followedIds = [], crossedPathIds = [] } = {}) {
    const cacheKey = `nearby_events:${Math.round(lat * 10)}:${Math.round(lon * 10)}:${radiusKm}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase.rpc('find_nearby_events', {
        lat, lon, radius_km: radiusKm, limit_count: 40, // oversample for re-ranking
      });
      let events = data || [];
      if (events.length > 0 && (followedIds.length > 0 || crossedPathIds.length > 0)) {
        // Re-rank: composite of geo proximity + social graph proximity
        events = events.map(e => {
          const distKm = e.dist_km || e.distance_km || 0;
          const geo = geoProximityScore(distKm, 8) * 60;
          const social = followedIds.includes(e.author_id) ? 35
            : crossedPathIds.includes(e.author_id) ? 22 : 0;
          const heat = ScoreEngine.heatScore(e);
          return { ...e, _discovery_score: geo + social + heat * 0.4 };
        }).sort((a, b) => b._discovery_score - a._discovery_score).slice(0, 20);
      }
      if (events.length) cache.set(cacheKey, events);
      return events;
    } catch (error) {
      return [];
    }
  },

  async findNearbyVibers(userId, radius = 10) {
    if (!isSupabaseEnabled) return [];
    const cacheKey = `nearby_vibers:${userId}:${radius}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const coords = LocationService.getCached();
      if (!coords) return [];

      // Use the safe, fuzzed version of the nearby function
      const { data } = await supabase.rpc('get_safe_nearby_vibers', {
        u_lat: coords.lat,
        u_lon: coords.lon,
        radius_km: radius
      });

      if (data) cache.set(cacheKey, data);
      return data || [];
    } catch (error) {
      return [];
    }
  },

  async getEventAttendees(eventId, limit = 10) {
    if (!isSupabaseEnabled) return [];
    const cacheKey = `event_attendees:${eventId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('event_rsvps')
        .select('user_id, profiles(id, username, avatar_url, vibe_score)')
        .eq('event_id', eventId)
        .eq('status', 'going')
        .limit(limit);

      const attendees = (data || []).map(r => r.profiles).filter(Boolean);
      cache.set(cacheKey, attendees, 120000); // 2 min cache
      return attendees;
    } catch { return []; }
  },

  // "Rising Vibers" — people being followed RIGHT NOW (7-day follow velocity),
  // not all-time fame. This was the genuinely-missing trending-people model:
  // every "trending" people rail used to fall back to vibe_score DESC, which
  // shows the same five famous accounts forever. Velocity finds who's HOT this
  // week. Client-side aggregation over recent follow edges — cheap at current
  // scale, trivially movable to an RPC when the edges table grows.
  async fetchRisingPeople(limit = 6, { excludeIds = [] } = {}) {
    const cacheKey = `rising_people:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: edges, error } = await supabase.from('follows')
        .select('following_id, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(600);
      if (error) throw error;
      const counts = new Map();
      (edges || []).forEach(e => counts.set(e.following_id, (counts.get(e.following_id) || 0) + 1));
      (excludeIds || []).forEach(id => counts.delete(id));
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
      if (!top.length) return [];
      const { data: profiles } = await supabase.from('profiles')
        .select('id, username, avatar_url, is_verified, vibe_score, bio, identity_mode, is_beacon_active')
        .in('id', top);
      const ranked = (profiles || [])
        .map(p => ({ ...p, _risingFollows: counts.get(p.id) || 0 }))
        .sort((a, b) => b._risingFollows - a._risingFollows);
      cache.set(cacheKey, ranked, 300000); // 5 min — it's a "this week" signal
      return ranked;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const AnalyticsManager = {
  async getProfileStats(userId) {
    const cacheKey = `profile_stats:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    // Removed demo mode fallback.
    try {
      const [posts, saves, vibes, checkins, followers] = await Promise.all([
        supabase.from('events').select('id', { count: 'estimated', head: true }).eq('author_id', userId),
        supabase.from('saved_events').select('id', { count: 'estimated', head: true }).eq('user_id', userId),
        supabase.from('event_vibes').select('id', { count: 'estimated', head: true }).eq('user_id', userId),
        supabase.from('live_checkins').select('id', { count: 'estimated', head: true }).eq('user_id', userId),
        supabase.from('follows').select('follower_id', { count: 'estimated', head: true }).eq('following_id', userId),
      ]);
      const result = {
        gruvCount: posts.count || 0,
        savedCount: saves.count || 0,
        vibeCount: vibes.count || 0,
        touchDownCount: checkins.count || 0,
        followerCount: followers.count || 0,
      };
      cache.set(cacheKey, result);
      return result;
    } catch (error) {
      return { gruvCount: 0, savedCount: 0, vibeCount: 0, touchDownCount: 0, followerCount: 0 };
    }
  },

  // Per-event stats for organisers
  async getEventStats(eventId) {
    const cacheKey = `event_stats:${eventId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const [vibes, going, maybe, notGoing, checkins, echoes] = await Promise.all([
        supabase.from('event_vibes').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('event_rsvps').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'going'),
        supabase.from('event_rsvps').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'maybe'),
        supabase.from('event_rsvps').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'not_going'),
        supabase.from('live_checkins').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('echoes').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      ]);
      const goingCount = going.count || 0;
      const maybeCount = maybe.count || 0;
      const notGoingCount = notGoing.count || 0;
      const totalRsvps = goingCount + maybeCount + notGoingCount;
      const result = {
        vibes: vibes.count || 0,
        going: goingCount,
        maybe: maybeCount,
        notGoing: notGoingCount,
        touchDowns: checkins.count || 0,
        echoes: echoes.count || 0,
        conversionRate: totalRsvps > 0
          ? Math.round((checkins.count || 0) / totalRsvps * 100)
          : 0,
      };
      cache.set(cacheKey, result, 120000);
      return result;
    } catch { return null; }
  },

  /**
   * Get comprehensive stats for a service provider (Marketplace Dashboard).
   */
  async getProviderStats(userId) {
    if (!userId) return null;
    const cacheKey = `provider_stats:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const [bookings, reviews, node] = await Promise.all([
        supabase.from('service_bookings').select('amount_cents, status, created_at').eq('provider_id', userId).limit(500),
        supabase.from('service_reviews').select('rating, comment, created_at, reviewer:reviewer_id(username)').eq('provider_id', userId).order('created_at', { ascending: false }).limit(200),
        supabase.from('service_nodes').select('service_type, available').eq('user_id', userId).maybeSingle()
      ]);

      const completed = (bookings.data || []).filter(b => b.status === 'completed');
      const totalEarnings = completed.reduce((sum, b) => sum + (b.amount_cents / 100), 0);

      const ratings = reviews.data || [];
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;

      // Group earnings by day for the last 7 days
      const earningsByDay = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const ds = d.toISOString().split('T')[0];
        const dayTotal = completed
          .filter(b => b.created_at?.split('T')[0] === ds)
          .reduce((sum, b) => sum + (b.amount_cents / 100), 0);

        return {
          tick: d.toLocaleDateString('en-ZA', { weekday: 'short' }).slice(0, 2),
          value: dayTotal
        };
      });

      const result = {
        totalEarnings,
        totalBookings: (bookings.data || []).length,
        completedCount: completed.length,
        avgRating: avgRating.toFixed(1),
        reviewCount: ratings.length,
        recentReviews: ratings.slice(0, 5),
        earningsChart: earningsByDay,
        serviceType: node.data?.service_type || 'General',
        isAvailable: node.data?.available ?? false
      };

      cache.set(cacheKey, result, 60000);
      return result;
    } catch (e) {
      return null;
    }
  },

  // [M,T,W,T,F,S,S] Gruv posting activity for profile chart
  async getWeeklyActivity(userId) {
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from('events')
        .select('created_at')
        .eq('author_id', userId)
        .gte('created_at', weekAgo)
        .limit(500);
      const days = [0, 0, 0, 0, 0, 0, 0];
      (data || []).forEach(e => {
        const dow = new Date(e.created_at).getDay();
        days[dow === 0 ? 6 : dow - 1]++;
      });
      return days;
    } catch { return [0, 0, 0, 0, 0, 0, 0]; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const CalendarManager = {
  async fetchMonthEvents(year, month) {
    const cacheKey = `cal:${year}:${month}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

    // Removed demo mode fallback.
    try {
      const { data } = await supabase
        .from('events')
        .select('id, title, event_date, event_time, category, category_color, venue_name, going, vibe_count, media, price')
        .gte('event_date', from)
        .lte('event_date', to)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .order('event_date', { ascending: true })
        .limit(60);
      const result = normalizeEvents(data || []);
      cache.set(cacheKey, result);
      return result;
    } catch { return []; }
  },

  async fetchUpcoming(limit = 10) {
    const cacheKey = `upcoming:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('events')
        .select('id, title, event_date, event_time, category, category_color, venue_name, going, vibe_count, media, price')
        .gte('event_date', today)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .order('event_date', { ascending: true })
        .limit(limit);
      const result = normalizeEvents(data || []);
      cache.set(cacheKey, result);
      return result;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME MANAGER  (subscriptions with reconnect)
// ─────────────────────────────────────────────────────────────────────────────
export const RealtimeManager = {
  _subs: {},

  _isAvailable() {
    return isSupabaseEnabled && !!supabase;
  },

  subscribeToFeed(onInsert, onUpdate) {
    if (!this._isAvailable()) return () => { };
    this._add('feed_realtime', 'events_feed',
      supabase.channel('events_feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, p => {
          cache.invalidate('feed:');
          cache.invalidate('happening_now');
          onInsert?.(p.new);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, p => {
          cache.invalidate(`event:${p.new.id}`);
          cache.invalidate('feed:');
          onUpdate?.(p.new);
        })
    );
    return () => this._remove('feed_realtime');
  },

  subscribeToEvent(eventId, onChange) {
    if (!this._isAvailable()) return () => { };
    const key = `event_${eventId}`;
    this._add(key, key,
      supabase.channel(key)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `id=eq.${eventId}` }, p => {
          cache.invalidate(`event:${eventId}`);
          onChange?.(p.new);
        })
    );
    return () => this._remove(key);
  },

  // Live vibe count changes for an event (useful on EventDetail screen)
  subscribeToVibeCount(eventId, onChange) {
    if (!this._isAvailable()) return () => { };
    const key = `vibes_${eventId}`;
    this._add(key, key,
      supabase.channel(key)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'event_vibes',
          filter: `event_id=eq.${eventId}`,
        }, async () => {
          // Fetch fresh count instead of trusting incremental payload
          const { count } = await supabase
            .from('event_vibes')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', eventId);
          onChange?.(count || 0);
        })
    );
    return () => this._remove(key);
  },

  // Live Touch Down attendee count
  subscribeToAttendees(eventId, onChange) {
    if (!this._isAvailable()) return () => { };
    const key = `checkins_${eventId}`;
    this._add(key, key,
      supabase.channel(key)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'live_checkins',
          filter: `event_id=eq.${eventId}`,
        }, p => {
          cache.invalidate(`attendees:${eventId}`);
          onChange?.(p.new);
        })
    );
    return () => this._remove(key);
  },

  _add(key, channelName, channel) {
    this._remove(key);
    channel.subscribe((status) => {
      // Auto-reconnect on unexpected close
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setTimeout(() => channel.subscribe(), 3000);
      }
    });
    this._subs[key] = channel;
  },

  _remove(key) {
    if (this._subs[key]) {
      supabase.removeChannel(this._subs[key]);
      delete this._subs[key];
    }
  },

  removeAll() {
    Object.keys(this._subs).forEach(k => this._remove(k));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE MANAGER  (Gruv Journeys / Itineraries)
// ─────────────────────────────────────────────────────────────────────────────
export const RouteManager = {
  async createRoute(userId, title, description, color = '#00f2ff') {
    try {
      const { data, error } = await supabase
        .from('routes')
        .insert({ user_id: userId, title, description, color })
        .select()
        .single();
      if (error) throw error;
      cache.invalidate(`routes:${userId}`);
      return data;
    } catch { return null; }
  },

  async addStep(routeId, eventId, order, arrivalTime = null) {
    try {
      const { error } = await supabase
        .from('route_steps')
        .insert({ route_id: routeId, event_id: eventId, step_order: order, arrival_time: arrivalTime });
      if (error) throw error;
      cache.invalidate(`journey:${routeId}`);
      return true;
    } catch { return false; }
  },

  async getJourney(routeId) {
    const cacheKey = `journey:${routeId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('route_steps')
        .select('*, event:events(*)')
        .eq('route_id', routeId)
        .order('step_order', { ascending: true });
      if (data) cache.set(cacheKey, data);
      return data || [];
    } catch { return []; }
  },

  async getUserRoutes(userId) {
    const cacheKey = `routes:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('routes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (data) cache.set(cacheKey, data);
      return data || [];
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Send a notification to the author of an event (best-effort, never throws)
async function _notifyEventAuthor(eventId, actorId, type) {
  try {
    const { data: event } = await supabase
      .from('events')
      .select('author_id, title')
      .eq('id', eventId)
      .maybeSingle();
    if (!event?.author_id || event.author_id === actorId) return;
    const messages = {
      vibe: { title: 'New Vibe on your Gruv 🔥', body: `Someone Vibed "${event.title}"` },
      rsvp: { title: 'New RSVP on your Gruv', body: `Someone locked in to "${event.title}"` },
      checkin: { title: 'Someone Touched Down 📍', body: `A Vibe just Touched Down at "${event.title}"` },
    };
    const msg = messages[type];
    if (!msg) return;
    await _notify(event.author_id, actorId, type, msg.title, msg.body);
  } catch (e) { logError('Notify.host', e, { type }); }
}

async function _notify(recipientId, actorId, type, title, body, data = {}) {
  try {
    await NotificationService.send(recipientId, {
      type,
      title,
      body,
      actorId,
      eventId: data?.event_id || null,
      data,
    });
  } catch {
    try {
      await supabase.from('notifications').insert({
        recipient_id: recipientId,
        actor_id: actorId,
        event_id: data?.event_id || null,
        type,
        title,
        body,
        data,
        read: false,
      });
    } catch (e) { logError('Notify.insert', e, { type }); }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INVITE MANAGER  (invite people who share your name / surname / clan)
// ─────────────────────────────────────────────────────────────────────────────
export const InviteManager = {
  /**
   * findKin — find people who share the host's first name, surname or clan name.
   * Returns { groups: { firstName:[], surname:[], clan:[] }, all:[], terms }.
   * Case-insensitive; excludes the host; caps results.
   */
  async findKin(userId, { limit = 200 } = {}) {
    const empty = { groups: { firstName: [], surname: [], clan: [] }, all: [], terms: {} };
    if (!userId) return empty;
    try {
      // first_name/surname/clan_name stay readable (the family-tree search needs
      // them cross-user) — only email/push_token/phone/emergency_contacts/siblings
      // get locked. So a plain select is fine here.
      const { data: me } = await supabase
        .from('profiles').select('first_name, surname, clan_name').eq('id', userId).maybeSingle();
      const terms = {
        firstName: (me?.first_name || '').trim(),
        surname: (me?.surname || '').trim(),
        clan: (me?.clan_name || '').trim(),
      };
      if (!terms.firstName && !terms.surname && !terms.clan) return { ...empty, terms };

      const fetchBy = async (col, val) => {
        if (!val) return [];
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, first_name, surname, clan_name, vibe_score')
            .ilike(col, val)
            .neq('id', userId)
            .limit(limit);
          return data || [];
        } catch { return []; }
      };

      const [byFirst, bySur, byClan] = await Promise.all([
        fetchBy('first_name', terms.firstName),
        fetchBy('surname', terms.surname),
        fetchBy('clan_name', terms.clan),
      ]);

      // De-dupe across groups for the "all" list (a person may match more than one).
      const seen = new Set();
      const all = [];
      [...byFirst, ...bySur, ...byClan].forEach(p => {
        if (!seen.has(p.id)) { seen.add(p.id); all.push(p); }
      });

      return { groups: { firstName: byFirst, surname: bySur, clan: byClan }, all, terms };
    } catch {
      return empty;
    }
  },

  /**
   * inviteToEvent — send an event invite notification to each user.
   * Best-effort; returns the number successfully queued.
   */
  async inviteToEvent(eventId, eventTitle, recipientIds, hostId, hostName) {
    if (!eventId || !recipientIds?.length) return 0;
    const title = 'You\'re invited 🎉';
    const body = `${hostName || 'A host'} invited you to "${eventTitle || 'an event'}"`;
    let sent = 0;
    for (const rid of recipientIds) {
      if (!rid || rid === hostId) continue;
      try {
        await _notify(rid, hostId, 'event_invite', title, body, { event_id: eventId, event_title: eventTitle });
        sent++;
      } catch { /* skip this recipient */ }
    }
    return sent;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE MANAGER  (DM inbox, conversations, unread count)
// ─────────────────────────────────────────────────────────────────────────────
export const MessageManager = {
  // Fetch all conversations for user — one row per partner, sorted by latest message
  async getConversations(userId) {
    if (!userId) return [];
    const cacheKey = `convos:${userId}`;
    const stale = cache.getStale(cacheKey);
    const orFilter = `sender_id.eq.${userId},recipient_id.eq.${userId}`;
    try {
      // Time-boxed: a stalled request must not hang the Chats tab forever — it
      // rejects, we fall through to the lighter fallback / stale cache below.
      const { data, error } = await withTimeout(supabase
        .from('messages')
        .select(`
          id, sender_id, recipient_id, body, created_at, read_at,
          is_request, request_accepted, deleted_at,
          sender:profiles!messages_sender_id_fkey(id, username, avatar_url, is_online),
          recipient:profiles!messages_recipient_id_fkey(id, username, avatar_url, is_online)
        `)
        .or(orFilter)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(500), 12000, 'getConversations');
      if (error) throw error;

      const rows = data || [];
      // Block is absolute: conversations with people you blocked disappear
      // from the chats list too (their old threads shouldn't haunt the inbox).
      const blockedSet = new Set(await BlockManager.getBlockedIds(userId).catch(() => []));
      // Deduplicate — keep only latest message per conversation partner
      // Guard against deleted profiles (sender/recipient join returns null)
      const seen = {};
      const convos = [];
      for (const msg of rows) {
        const partnerId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
        const partner = msg.sender_id === userId ? msg.recipient : msg.sender;
        if (!partner) continue; // deleted account — skip
        if (blockedSet.has(partnerId)) continue; // blocked — thread hidden
        if (!seen[partnerId]) {
          seen[partnerId] = true;
          convos.push({ ...msg, partner, partnerId });
        }
      }
      cache.set(cacheKey, convos, 30000);
      return convos;
    } catch {
      // Resilient fallback: the rich select above throws if the FK constraints
      // aren't named messages_*_id_fkey or if is_request/deleted_at aren't on the
      // live table yet — which would make the WHOLE chats list vanish. Re-fetch
      // with only guaranteed columns and join partner profiles separately.
      try {
        const { data, error } = await withTimeout(supabase
          .from('messages')
          .select('id, sender_id, recipient_id, body, created_at')
          .or(orFilter)
          .order('created_at', { ascending: false })
          .limit(500), 12000, 'getConversations.fallback');
        if (error) throw error;
        const rows = (data || []).filter(m => !m.deleted_at); // deleted_at may be absent → kept
        const seen = {};
        const convos = [];
        const partnerIds = [];
        for (const msg of rows) {
          const partnerId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
          if (!partnerId || seen[partnerId]) continue;
          seen[partnerId] = true;
          partnerIds.push(partnerId);
          convos.push({ ...msg, partnerId });
        }
        if (partnerIds.length) {
          const { data: profs } = await withTimeout(supabase
            .from('profiles').select('id, username, avatar_url, is_online').in('id', partnerIds), 12000, 'getConversations.profiles');
          const byId = Object.fromEntries((profs || []).map(p => [p.id, p]));
          for (const c of convos) c.partner = byId[c.partnerId] || null;
        }
        const result = convos.filter(c => c.partner);
        cache.set(cacheKey, result, 30000);
        return result;
      } catch { return stale || []; }
    }
  },

  // Count unread DMs for the nav badge
  async getUnreadCount(userId) {
    if (!userId) return 0;
    const cacheKey = `dm_unread:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached !== null) return cached;
    try {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .is('read_at', null)
        .is('deleted_at', null);
      const n = count || 0;
      cache.set(cacheKey, n, 15000);
      return n;
    } catch { return 0; }
  },

  // Send a message — supports media, location, event shares, replies, and request logic.
  // Pass _pregenId to use a client-generated UUID as the DB row ID (enables optimistic + broadcast sync).
  async send(senderId, recipientId, body, options = {}) {
    if (SecurityService.isThrottled(`msg_${senderId}_${recipientId}`, 500)) {
      throw new Error('Please wait a moment before sending another message.');
    }
    const {
      messageType, type,
      mediaUrl = null,
      parent_id = null,
      event_id = null,
      latitude = null,
      longitude = null,
      _pregenId,
    } = options;
    const msgType = messageType || type || 'text';
    try {
      // BLOCK IS ABSOLUTE (Messaging pass): no DM crosses a block in EITHER
      // direction — not even as a request. (Server-side twin: the
      // block_gate_messages trigger in messages_block_gate.sql.)
      try {
        const { data: blockRow } = await supabase
          .from('user_blocks')
          .select('blocker_id')
          .or(
            `and(blocker_id.eq.${senderId},blocked_id.eq.${recipientId}),` +
            `and(blocker_id.eq.${recipientId},blocked_id.eq.${senderId})`
          )
          .limit(1)
          .maybeSingle();
        if (blockRow) throw new Error("You can't message this person.");
      } catch (e) {
        if (e?.message === "You can't message this person.") throw e;
        /* block-table lookup failed (offline/unmigrated) — fall through; the
           server trigger is the real gate */
      }

      // Sanitize message body
      const sanitizedBody = SecurityService.sanitizeContent(body);

      // Check if this conversation already has an accepted message.
      let accepted = false;
      try {
        const { data: prior } = await supabase
          .from('messages')
          .select('request_accepted')
          .or(
            `and(sender_id.eq.${senderId},recipient_id.eq.${recipientId}),` +
            `and(sender_id.eq.${recipientId},recipient_id.eq.${senderId})`
          )
          .eq('request_accepted', true)
          .limit(1)
          .maybeSingle();
        accepted = !!prior;
      } catch { accepted = false; }

      // Verified co-presence IS the warm introduction. If these two have actually
      // Touched Down at the same event, they have already met in the real world —
      // so this is not a cold DM and must not sit behind the request gate. This is
      // the one thing no other network can do: the intro is PROVEN, not claimed.
      if (!accepted) {
        try {
          const { haveMet } = require('./coPresence');
          if (await haveMet(senderId, recipientId)) accepted = true;
        } catch { /* messaging must never break on this */ }
      }

      const trimmedBody = (body || '').trim() || null;
      const msgPayload = {
        ...(_pregenId ? { id: _pregenId } : {}),
        sender_id: senderId, recipient_id: recipientId,
        body: (sanitizedBody || '').trim() || null,
        is_request: !accepted, request_accepted: accepted,
        message_type: msgType, media_url: mediaUrl,
        parent_id, event_id, latitude, longitude,
      };

      // Columns present on every messages-table version. If the richer columns
      // (event_id / latitude / is_request / parent_id / media_url …) aren't in
      // the live table, the full insert fails — but the message still delivers
      // via this core payload instead of being lost.
      // Only columns guaranteed on every messages-table version. message_type and
      // the rich columns are intentionally dropped here so a text message still
      // delivers even if those columns aren't migrated yet (see 14_messages_missing_columns.sql).
      const corePayload = {
        ...(_pregenId ? { id: _pregenId } : {}),
        sender_id: senderId, recipient_id: recipientId,
        body: msgPayload.body,
      };

      // Idempotency key (#46). Survives retries across every tier below, so a
      // flaky network can't double-post: the RPC returns the original row
      // instead of inserting a second one.
      const clientKey = _pregenId || `${senderId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
      msgPayload.client_key = clientKey;
      corePayload.client_key = clientKey;

      const data = await resilient(
        [
          // Tier 1: the validated send path. This is the ONLY tier that gets
          // server-side validation (length, type, empty-body, coordinate
          // sanity) and idempotency — sender is taken from auth.uid() inside
          // the RPC, never from a parameter. The direct-insert tiers below are
          // drift fallbacks for a DB that hasn't had messages_send_hardening
          // applied; they are not the intended path.
          async () => {
            const { data: d, error: e } = await supabase.rpc('send_message_v2', {
              p_recipient: recipientId,
              p_body: msgPayload.body,
              p_type: msgType,
              p_media_url: mediaUrl,
              p_event_id: event_id,
              p_parent_id: parent_id,
              p_client_key: clientKey,
              p_lat: latitude,
              p_lng: longitude,
            });
            if (e) throw e;
            if (!d) throw new Error('send_message_v2 returned no row');
            return Array.isArray(d) ? d[0] : d;
          },
          // Tier 2: full insert + return full row
          async () => {
            const { data: d, error: e } = await supabase.from('messages').insert(msgPayload).select().single();
            if (e) throw e;
            return d;
          },
          // Tier 3: full insert without select
          async () => {
            const { error: e } = await supabase.from('messages').insert(msgPayload);
            if (e) throw e;
            return { ...msgPayload, id: _pregenId || `local_${Date.now()}`, created_at: new Date().toISOString() };
          },
          // Tier 4: core columns only (+ select) — drops any not-yet-migrated columns
          async () => {
            const { data: d, error: e } = await supabase.from('messages').insert(corePayload).select().single();
            if (e) throw e;
            return d;
          },
          // Tier 5: core columns only, no select
          async () => {
            const { error: e } = await supabase.from('messages').insert(corePayload);
            if (e) throw e;
            return { ...corePayload, id: corePayload.id || `local_${Date.now()}`, created_at: new Date().toISOString() };
          },
          // (A sixth tier used to call an RPC named `send_message` with a
          //  client-supplied p_sender. That function does not exist on the
          //  database — the tier could only ever fail — and the signature was
          //  send-as-anyone by design. Removed, superseded by Tier 1.)
        ],
        { attemptsPerTier: 2, baseMs: 400, label: 'MessageManager.sendMessage' }
      );
      if (!data) throw new Error('Message send exhausted all tiers');

      cache.invalidate(`convos:${senderId}`);
      cache.invalidate(`convos:${recipientId}`);
      cache.invalidate(`dm_unread:${recipientId}`);

      const notifyText = msgType === 'image' ? 'Sent a photo'
        : msgType === 'location' ? 'Shared a location'
          : msgType === 'vibe_card' ? 'Sent a Vibe Card'
            : (trimmedBody || '').slice(0, 80);
      _notify(recipientId, senderId, 'message', 'New Message', notifyText, { sender_id: senderId }).catch(() => { });

      return data;
    } catch (e) { throw e; }
  },

  async markAsRead(messageId, userId) {
    try {
      await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', messageId).eq('recipient_id', userId).is('read_at', null);
      cache.invalidate(`dm_unread:${userId}`);
    } catch (e) { logError('DM.markAsRead', e, { messageId }); }
  },

  async sendTypingStatus(senderId, recipientId, isTyping) {
    try {
      const channel = supabase.channel(`typing_${recipientId}`);
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { senderId, isTyping }
      });
      supabase.removeChannel(channel);
    } catch { }
  },

  subscribeToTyping(userId, onTyping) {
    const channel = supabase
      .channel(`typing_${userId}`)
      .on('broadcast', { event: 'typing' }, payload => onTyping(payload.payload))
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  // Accept a conversation request
  async acceptRequest(conversationSenderId, recipientId) {
    try {
      await supabase
        .from('messages')
        .update({ request_accepted: true, is_request: false })
        .eq('sender_id', conversationSenderId)
        .eq('recipient_id', recipientId);
      cache.invalidate(`convos:${recipientId}`);
      cache.invalidate(`convos:${conversationSenderId}`);
      return true;
    } catch { return false; }
  },

  // Mark all messages from a sender as read
  async markRead(senderId, recipientId) {
    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_id', senderId)
        .eq('recipient_id', recipientId)
        .is('read_at', null);
      cache.invalidate(`dm_unread:${recipientId}`);
      cache.invalidate(`convos:${recipientId}`);
      return true;
    } catch { return false; }
  },

  // Fetch messages between two users
  async fetchThread(userA, userB, limit = 100) {
    const cacheKey = `thread:${[userA, userB].sort().join('_')}`;
    const stale = cache.getStale(cacheKey);
    const orFilter = `and(sender_id.eq.${userA},recipient_id.eq.${userB}),and(sender_id.eq.${userB},recipient_id.eq.${userA})`;
    try {
      // Tier 1: with the deleted_at filter.
      let { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(orFilter)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(limit);
      // Tier 2: a DB without the deleted_at column throws above — retry without
      // that filter and drop soft-deleted rows client-side, so the thread still
      // loads instead of vanishing.
      if (error) {
        ({ data, error } = await supabase
          .from('messages')
          .select('*')
          .or(orFilter)
          .order('created_at', { ascending: true })
          .limit(limit));
        if (error) throw error;
        data = (data || []).filter(m => !m.deleted_at);
      }
      const result = data || [];
      cache.set(cacheKey, result, 20000);
      return result;
    } catch { return stale || []; }
  },

  // Soft-delete a message
  async deleteMessage(messageId, userId) {
    try {
      await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('sender_id', userId);
      cache.invalidate('thread:');
      cache.invalidate('convos:');
      return true;
    } catch { return false; }
  },

  // React to a message with an emoji
  // Per-user emoji reactions live in the `reactions` JSONB map ({ userId: emoji }).
  // (The old code wrote a singular `reaction` column that never existed on the
  // DB, so reactions silently never persisted.) Reacting with the same emoji
  // again toggles it off. Returns the new map, or null on failure.
  async reactToMessage(messageId, emoji, userId) {
    if (!userId) return null;
    try {
      const { data: row } = await supabase
        .from('messages').select('reactions').eq('id', messageId).single();
      const map = (row && row.reactions && typeof row.reactions === 'object') ? { ...row.reactions } : {};
      if (map[userId] === emoji) delete map[userId];  // toggle off
      else map[userId] = emoji;
      const { error } = await supabase.from('messages').update({ reactions: map }).eq('id', messageId);
      if (error) throw error;
      return map;
    } catch (e) { logError('Message.react', e); return null; }
  },

  // Real-time subscription for DM unread badge
  subscribeUnreadCount(userId, onChange) {
    const channelName = `dm_unread_${userId}_${Math.random().toString(36).substr(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'messages',
        filter: `recipient_id=eq.${userId}`,
      }, () => {
        cache.invalidate(`dm_unread:${userId}`);
        cache.invalidate(`convos:${userId}`);
        this.getUnreadCount(userId).then(onChange);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const BlockManager = {
  // Both used a bare try/catch, which is not a fallback -- it's a bug.
  // Supabase does not throw on a query error, it RETURNS { error }, so the
  // catch here never fired: block()/unblock() reported success even when the
  // write silently failed (a bad column, an RLS denial, a dropped connection
  // after the request left the client). resilient() already unwraps that
  // {data,error} shape and treats error as a real failure (resilience.js),
  // which is the entire fix -- a user could previously believe they'd
  // blocked someone who was never actually blocked.
  async block(blockerId, blockedId) {
    const ok = await resilient(
      [
        () => supabase.from('user_blocks').upsert(
          { blocker_id: blockerId, blocked_id: blockedId },
          { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }
        ),
        // Fallback: delete any stale/conflicting row first, then a plain
        // insert -- covers the case where the upsert's onConflict target
        // itself is what's failing (e.g. a constraint-name drift).
        async () => {
          await supabase.from('user_blocks').delete()
            .eq('blocker_id', blockerId).eq('blocked_id', blockedId);
          return supabase.from('user_blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
        },
      ],
      { attemptsPerTier: 2, baseMs: 300, label: 'BlockManager.block', fallbackValue: null }
    );
    if (ok === null) return false;
    cache.invalidate(`blocks:${blockerId}`);
    return true;
  },

  async unblock(blockerId, blockedId) {
    const ok = await resilient(
      [
        () => supabase.from('user_blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId),
        () => supabase.from('user_blocks').delete().match({ blocker_id: blockerId, blocked_id: blockedId }),
      ],
      { attemptsPerTier: 2, baseMs: 300, label: 'BlockManager.unblock', fallbackValue: null }
    );
    if (ok === null) return false;
    cache.invalidate(`blocks:${blockerId}`);
    return true;
  },

  async isBlocked(blockerId, blockedId) {
    try {
      const { data } = await supabase
        .from('user_blocks').select('blocker_id')
        .eq('blocker_id', blockerId).eq('blocked_id', blockedId).maybeSingle();
      return !!data;
    } catch { return false; }
  },

  async getBlockedIds(userId) {
    const cacheKey = `blocks:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('user_blocks').select('blocked_id').eq('blocker_id', userId);
      const result = (data || []).map(r => r.blocked_id);
      cache.set(cacheKey, result);
      return result;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MUTE MANAGER  (soft "hide their content" — feed events + reels + stories)
// The gentler cousin of block: you still share DMs/crossed-paths, but their
// posts, reels and stories stay out of your discovery surfaces.
// ─────────────────────────────────────────────────────────────────────────────
export const MuteManager = {
  async mute(muterId, mutedId) {
    try {
      await supabase.from('muted_users').upsert(
        { user_id: muterId, muted_id: mutedId },
        { onConflict: 'user_id,muted_id', ignoreDuplicates: true }
      );
      cache.invalidate(`mutes:${muterId}`);
      return true;
    } catch { return false; }
  },

  async unmute(muterId, mutedId) {
    try {
      await supabase.from('muted_users').delete().eq('user_id', muterId).eq('muted_id', mutedId);
      cache.invalidate(`mutes:${muterId}`);
      return true;
    } catch { return false; }
  },

  async getMutedIds(userId) {
    const cacheKey = `mutes:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase.from('muted_users').select('muted_id').eq('user_id', userId);
      const result = (data || []).map(r => r.muted_id);
      cache.set(cacheKey, result);
      return result;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// REMINDER MANAGER  (event reminders — stored in DB, fired as local notifs)
// ─────────────────────────────────────────────────────────────────────────────
export const ReminderManager = {
  async set(userId, eventId, eventDate, eventTime, minutesBefore = 60) {
    try {
      const eventDateTime = new Date(`${eventDate}T${eventTime || '20:00'}:00`);
      const remindAt = new Date(eventDateTime.getTime() - minutesBefore * 60 * 1000);
      if (remindAt <= new Date()) return false; // already past

      const { error } = await supabase.from('event_reminders').upsert(
        { user_id: userId, event_id: eventId, remind_at: remindAt.toISOString(), minutes_before: minutesBefore },
        { onConflict: 'user_id,event_id' }
      );
      if (error) throw error;
      cache.invalidate(`reminders:${userId}`);
      return true;
    } catch { return false; }
  },

  async cancel(userId, eventId) {
    try {
      await supabase.from('event_reminders').delete().eq('user_id', userId).eq('event_id', eventId);
      cache.invalidate(`reminders:${userId}`);
      return true;
    } catch { return false; }
  },

  async hasReminder(userId, eventId) {
    try {
      const { data } = await supabase
        .from('event_reminders').select('id').eq('user_id', userId).eq('event_id', eventId).maybeSingle();
      return !!data;
    } catch { return false; }
  },

  async getUserReminders(userId) {
    const cacheKey = `reminders:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data } = await supabase
        .from('event_reminders')
        .select('*, event:events(id, title, event_date, event_time, venue_name)')
        .eq('user_id', userId).eq('sent', false)
        .order('remind_at', { ascending: true });
      const result = data || [];
      cache.set(cacheKey, result, 60000);
      return result;
    } catch { return []; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PRESENCE MANAGER  (online/offline status)
// ─────────────────────────────────────────────────────────────────────────────
export const PresenceManager = {
  _channel: null,
  _heartbeatTimer: null,

  async goOnline(userId) {
    if (!userId) return;
    try {
      await supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', userId);
      cache.invalidate(`profile:${userId}`);
      RetentionManager.logSession(userId).catch(() => { });
      // Log daily activity for streak tracking (fire-and-forget RPC).
      // supabase.rpc() returns a THENABLE, not a real Promise — it has .then but
      // NO .catch. Calling .catch threw a TypeError right here, which aborted the
      // rest of goOnline, so the heartbeat below never started: last_seen never
      // refreshed and streaks never recorded, for every user, every session.
      // (Caught by the client_errors telemetry.) .then(ok, err) is the safe form.
      supabase.rpc('record_daily_activity', { p_user: userId }).then(() => {}, () => {});
      // Heartbeat: refresh last_seen every 4 minutes so the 5-min window stays accurate
      if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = setInterval(async () => {
        try {
          await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId);
        } catch (e) { logError('Presence.heartbeat', e, { userId }); }
      }, 4 * 60 * 1000);
    } catch (e) { logError('Presence.goOnline', e, { userId }); }
  },

  async goOffline(userId) {
    if (!userId) return;
    if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
    try {
      await supabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', userId);
      cache.invalidate(`profile:${userId}`);
    } catch (e) { logError('Presence.goOffline', e, { userId }); }
  },

  // ── "I'm here" live presence beacon ──────────────────────────────────────
  // Broadcasts that the user is active RIGHT NOW at their location for a window
  // of time (default 60 min) so nearby vibers see them live. Auto-expires.
  async activateBeacon(userId, coords = {}, minutes = 60) {
    if (!userId) throw new Error('Sign in to go live.');
    const expires = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const payload = {
      is_beacon_active: true,
      is_online: true,
      last_seen: new Date().toISOString(),
      beacon_expires_at: expires,
    };
    if (coords?.lat != null && coords?.lon != null) { payload.lat = coords.lat; payload.lon = coords.lon; }
    const res = await resilient(
      [
        async () => { const { error } = await supabase.from('profiles').update(payload).eq('id', userId); if (error) throw error; return true; },
        // Fallback for DBs without beacon_expires_at yet — still flips the beacon on.
        async () => { const { beacon_expires_at: _x, ...core } = payload; const { error } = await supabase.from('profiles').update(core).eq('id', userId); if (error) throw error; return true; },
      ],
      { attemptsPerTier: 2, baseMs: 300, label: 'PresenceManager.activateBeacon', fallbackValue: null }
    );
    if (res === null) throw new Error('Could not go live — please try again.');
    cache.invalidate(`profile:${userId}`);
    return expires;
  },

  async deactivateBeacon(userId) {
    if (!userId) return;
    try {
      await supabase.from('profiles').update({ is_beacon_active: false, beacon_expires_at: null }).eq('id', userId);
    } catch {
      try { await supabase.from('profiles').update({ is_beacon_active: false }).eq('id', userId); } catch (e) { logError('Beacon.deactivate', e, { userId }); }
    }
    cache.invalidate(`profile:${userId}`);
  },

  // ── "I'm out — pull up" (A3: the Beacon PRODUCT) ──────────────────────────
  // activateBeacon flips the flag; nobody was ever TOLD. This is the product:
  // going live pings your MUTUALS (people you follow who follow you back —
  // a deliberate audience, never ambient broadcast) with where to pull up.
  // Truth Protocol: fires only on a real, user-initiated "go live".
  async dropBeacon(userId, { coords = {}, minutes = 60, placeLabel = null } = {}) {
    const expires = await this.activateBeacon(userId, coords, minutes);

    // Fan out to mutuals — bounded, best-effort, never blocks going live.
    (async () => {
      try {
        const [{ data: iFollow }, { data: followMe }] = await Promise.all([
          supabase.from('follows').select('following_id').eq('follower_id', userId).limit(500),
          supabase.from('follows').select('follower_id').eq('following_id', userId).limit(500),
        ]);
        const mine = new Set((iFollow || []).map(r => r.following_id));
        const mutuals = (followMe || []).map(r => r.follower_id).filter(id => mine.has(id)).slice(0, 50);
        if (!mutuals.length) return;

        const { data: me } = await supabase.from('profiles').select('username, display_name').eq('id', userId).maybeSingle();
        const name = me?.display_name || me?.username || 'A viber';
        const where = placeLabel ? ` at ${placeLabel}` : ' near you';
        await Promise.all(mutuals.map(rid =>
          _notify(rid, userId, 'beacon', `${name} is out — pull up 📍`,
            `${name} just went live${where}. Beacon is on for ${minutes} min.`).catch(() => {})
        ));
      } catch (e) { logError('Beacon.fanout', e, { userId }); }
    })();

    return expires;
  },

  // Subscribe to a specific user's online status changes
  subscribeToUser(userId, onChange) {
    const channel = supabase
      .channel(`presence_${userId}_${Math.random().toString(36).substr(2, 5)}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles',
        filter: `id=eq.${userId}`,
      }, payload => {
        onChange?.({ is_online: payload.new.is_online, last_seen: payload.new.last_seen });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CAPACITY MANAGER  (event max_attendees / sold-out)
// ─────────────────────────────────────────────────────────────────────────────
export const CapacityManager = {
  async getStatus(eventId) {
    try {
      const { data: event } = await supabase
        .from('events').select('max_attendees, capacity, is_sold_out').eq('id', eventId).single();
      if (!event) return { hasLimit: false, isSoldOut: false, spotsLeft: null };

      // Two capacity fields exist historically — treat either as the limit.
      const limit = event.max_attendees || event.capacity;
      if (!limit) return { hasLimit: false, isSoldOut: false, spotsLeft: null };
      // Capacity is a RESERVATION limit, so count going-RSVPs — not live_checkins
      // (physical arrivals). Counting check-ins reported full capacity available
      // pre-event (0 arrivals) even when the event was already RSVP-full.
      const { count } = await supabase
        .from('event_rsvps').select('event_id', { count: 'exact', head: true })
        .eq('event_id', eventId).eq('status', 'going');
      const spotsLeft = Math.max(0, limit - (count || 0));
      return { hasLimit: true, isSoldOut: event.is_sold_out || spotsLeft === 0, spotsLeft, capacity: limit };
    } catch { return { hasLimit: false, isSoldOut: false, spotsLeft: null }; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN MANAGER  (Missions)
// ─────────────────────────────────────────────────────────────────────────────
export const CampaignManager = {
  async fetchForBusiness(bizId) {
    if (!bizId) return [];
    const cacheKey = `campaigns:${bizId}`;
    const stale = cache.getStale(cacheKey);
    try {
      const { data } = await supabase
        .from('ad_campaigns')
        .select('*')
        .eq('business_id', bizId)
        .order('created_at', { ascending: false });
      const result = data || [];
      cache.set(cacheKey, result, 60000);
      return result;
    } catch { return stale || []; }
  },

  async updateStatus(campaignId, status) {
    try {
      const { error } = await supabase.from('ad_campaigns').update({ status }).eq('id', campaignId);
      if (error) throw error;
      cache.invalidate('campaigns:');
      return true;
    } catch { return false; }
  },

  async getPerformance(campaignId) {
    try {
      const { data } = await supabase
        .from('campaign_analytics')
        .select('event_type, created_at')
        .eq('campaign_id', campaignId);
      return data || [];
    } catch { return []; }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ECOSYSTEM MANAGER  (Business Partnerships)
// ─────────────────────────────────────────────────────────────────────────────
export const EcosystemManager = {
  async fetchPartners(bizId) {
    if (!bizId) return [];
    try {
      const { data } = await supabase
        .from('business_partnerships')
        .select('*, partner:partner_id(id, business_name, tagline, logo_url)')
        .eq('business_id', bizId);
      return data || [];
    } catch { return []; }
  },

  async requestPartnership(bizId, targetBizId, type = 'collaboration') {
    try {
      const { error } = await supabase.from('business_partnerships').insert({
        business_id: bizId,
        partner_id: targetBizId,
        status: 'pending',
        partnership_type: type
      });
      return !error;
    } catch { return false; }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOWING FEED  (events from users you follow)
// ─────────────────────────────────────────────────────────────────────────────
export const FollowingFeedManager = {
  async fetch(userId, page = 0, pageSize = 15) {
    if (!userId) return { events: [], hasMore: false };
    const cacheKey = `following_feed:${userId}:${page}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const followedIds = await UserManager.getFollowedIds(userId);
      if (!followedIds.length) return { events: [], hasMore: false };

      const { data } = await supabase
        .from('events')
        .select('*, profiles!author_id(id, username, avatar_url, is_verified, vibe_score)')
        .in('author_id', followedIds)
        .gte('event_date', new Date().toISOString().split('T')[0])
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      const result = { events: normalizeEvents(data || []), hasMore: (data || []).length === pageSize };
      cache.set(cacheKey, result, 60000);
      return result;
    } catch { return { events: [], hasMore: false }; }
  },
};

// ActivityFeedManager — defined below (merged with real-time feed manager)

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL CACHE CLEAR  (call on sign-out)
// ─────────────────────────────────────────────────────────────────────────────
export const clearAllCache = () => {
  cache.clear();
};

// ─────────────────────────────────────────────────────────────────────────────
// DEBOUNCE UTIL  (reuse across components without a separate import)
// ─────────────────────────────────────────────────────────────────────────────
export function debounce(fn, ms = 400) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// HOTSPOT MANAGER (PostGIS Heatmap Logic)
// ─────────────────────────────────────────────────────────────────────────────
export const HotspotManager = {
  async findHotspots(lat, lon, radiusKm = 10) {
    try {
      // RPC to find clusters of events or check-ins
      const { data } = await supabase.rpc('find_gruv_hotspots', {
        user_lat: lat, user_lon: lon, radius_m: radiusKm * 1000
      });
      return data || [];
    } catch { return []; }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL & AURA ENGINE (Gamification)
// ─────────────────────────────────────────────────────────────────────────────
export const LevelManager = {
  XP_MAP: {
    EVENT_POST: 100,
    RSVP: 20,
    CHECK_IN: 50,
    VIBE_GIVEN: 10,
    BOOKING_COMPLETE: 200,
  },

  calculateLevel(xp) {
    // F3 — ONE leveling curve: delegate to the canonical getXpLevel so the
    // level-up notification and the profile XP bar can never disagree again.
    return getXpLevel(xp).level;
  },

  async addXP(userId, action) {
    const amount = this.XP_MAP[action] || 10;
    try {
      const { data: prof } = await supabase.from('profiles').select('xp').eq('id', userId).single();
      const newXP = (prof?.xp || 0) + amount;
      await supabase.from('profiles').update({ xp: newXP }).eq('id', userId);

      const oldLevel = this.calculateLevel(prof?.xp || 0);
      const newLevel = this.calculateLevel(newXP);

      if (newLevel > oldLevel) {
        // Trigger Level Up Notification
        _notify(userId, userId, 'level_up', `Reached Level ${newLevel}!`, `You've unlocked new aura colors.`).catch(() => { });
      }
      return { xp: newXP, level: newLevel, leveledUp: newLevel > oldLevel };
    } catch { return null; }
  }
};

export const AuraService = {
  AURA_MAP: {
    'Music': '#00f2ff', // Cyan
    'Art': '#8b5cf6',   // Purple
    'Tech': '#06b6d4',  // Teal
    'Fashion': '#ec4899', // Pink
    'Nightlife': '#ef4444', // Red
    'Business': '#10b981', // Green
  },

  getAura(interests = []) {
    const primary = interests[0] || 'Social';
    return this.AURA_MAP[primary] || '#00f2ff';
  },

  getAuraGradients(interests = []) {
    const c1 = this.getAura(interests);
    const c2 = this.getAura(interests.slice(1)) || `${c1}50`;
    return [c1, c2];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RETENTION & STREAKS (Advanced User Logic)
// ─────────────────────────────────────────────────────────────────────────────
export const RetentionManager = {
  async logSession(userId) {
    if (!userId) return;
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const { data: prof } = await supabase.from('profiles').select('last_seen, current_streak').eq('id', userId).single();
      if (prof) {
        const last = prof.last_seen ? new Date(prof.last_seen).toISOString().split('T')[0] : null;
        let newStreak = prof.current_streak || 0;

        if (last !== today) {
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          const yestStr = yesterday.toISOString().split('T')[0];

          if (last === yestStr) newStreak += 1;
          else newStreak = 1;

          await supabase.from('profiles').update({
            last_seen: now.toISOString(),
            current_streak: newStreak
          }).eq('id', userId);

          // Check badges on login
          RewardEngine.checkMilestones(userId).catch(() => { });
        }
      }
    } catch (e) { logError('Retention.streak', e, { userId }); }
  },

  async getGlobalStats() {
    const cacheKey = 'global_stats';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    try {
      const [u, e, v] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('event_vibes').select('id', { count: 'exact', head: true }),
      ]);
      const res = { users: u.count, events: e.count, vibes: v.count };
      cache.set(cacheKey, res, 300000);
      return res;
    } catch { return { users: 0, events: 0, vibes: 0 }; }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REWARDS & BADGE ENGINE
// ─────────────────────────────────────────────────────────────────────────────
export const RewardEngine = {
  BADGES: [
    { id: 'vibe_starter', name: 'Vibe Starter', icon: '🔥', desc: 'First 5 vibes given' },
    { id: 'gruv_master', name: 'Gruv Master', icon: '👑', desc: 'Hosted 10+ events' },
    { id: 'loyal_viber', name: 'Loyal Viber', icon: '💎', desc: '7-day login streak' },
    { id: 'social_elite', name: 'Social Elite', icon: '✨', desc: 'SIS score of 100' },
  ],

  async checkMilestones(userId) {
    try {
      const { data: prof } = await supabase.from('profiles').select('id, badges, current_streak, social_integrity_score, vibe_score').eq('id', userId).single();
      if (!prof) return [];

      const earned = prof.badges || [];
      const newBadges = [];

      if (!earned.includes('loyal_viber') && (prof.current_streak || 0) >= 7) newBadges.push('loyal_viber');
      if (!earned.includes('social_elite') && (prof.social_integrity_score || 0) >= 100) newBadges.push('social_elite');

      if (newBadges.length > 0) {
        const updated = [...earned, ...newBadges];
        await supabase.from('profiles').update({ badges: updated }).eq('id', userId);
        return newBadges;
      }
      return [];
    } catch { return []; }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIORAL ENGINE  (deep activity analysis for Vibe Coach & retention)
// ─────────────────────────────────────────────────────────────────────────────
export const BehavioralEngine = {

  // Compare this week's activity to last week's — returns trend direction and delta
  _computeTrend(thisWeek, lastWeek) {
    if (lastWeek === 0 && thisWeek === 0) return { direction: 'flat', delta: 0, pct: 0 };
    if (lastWeek === 0) return { direction: 'up', delta: thisWeek, pct: 100 };
    const delta = thisWeek - lastWeek;
    const pct = Math.round((delta / lastWeek) * 100);
    return { direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', delta, pct };
  },

  // Activity decay score: recent actions weighted more than old ones.
  // Uses exponential half-life of 3.5 days so actions from 7 days ago carry ~25% weight.
  _decayWeightedScore(timestampedRows, nowMs = Date.now()) {
    const HALF_LIFE_MS = 3.5 * 86400000;
    return timestampedRows.reduce((sum, ts) => {
      const ageMs = nowMs - new Date(ts).getTime();
      return sum + Math.exp(-Math.LN2 * ageMs / HALF_LIFE_MS);
    }, 0);
  },

  // Cohort percentile: where does the user sit vs a sample of recent active profiles?
  // Returns { percentile: 0-100, label: string }
  _cohortPercentile(userScore, sampleScores) {
    if (!sampleScores.length) return { percentile: 50, label: 'average' };
    const below = sampleScores.filter(s => s < userScore).length;
    const percentile = Math.round((below / sampleScores.length) * 100);
    const label = percentile >= 90 ? 'top 10%'
      : percentile >= 75 ? 'top 25%'
      : percentile >= 50 ? 'above average'
      : percentile >= 25 ? 'below average'
      : 'bottom 25%';
    return { percentile, label };
  },

  // Primary entry point for Vibe Coach.
  // Returns { insight, tips, next_milestone, trend, cohort, decay_score, action_roi }
  async analyze(userId, profile) {
    if (!userId) return null;
    try {
      const now = Date.now();
      const since7d = new Date(now - 7 * 86400000).toISOString();
      const since14d = new Date(now - 14 * 86400000).toISOString();

      // Fetch this week + last week activity in parallel
      const [
        rsvpThis, vibeThis, checkinThis, echoThis, postThis,
        rsvpLast, vibeLast, checkinLast, echoLast, postLast,
        rsvpTs, checkinTs, vibeTs,
        peerSample,
      ] = await Promise.all([
        supabase.from('event_rsvps').select('event_id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since7d),
        supabase.from('event_vibes').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since7d),
        supabase.from('live_checkins').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('checked_in_at', since7d),
        supabase.from('echoes').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since7d),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('author_id', userId).gte('created_at', since7d),

        supabase.from('event_rsvps').select('event_id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since14d).lt('created_at', since7d),
        supabase.from('event_vibes').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since14d).lt('created_at', since7d),
        supabase.from('live_checkins').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('checked_in_at', since14d).lt('checked_in_at', since7d),
        supabase.from('echoes').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since14d).lt('created_at', since7d),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('author_id', userId).gte('created_at', since14d).lt('created_at', since7d),

        // Timestamps for decay weighting (capped to avoid unbounded fetch)
        supabase.from('event_rsvps').select('created_at').eq('user_id', userId).gte('created_at', since7d).limit(100),
        supabase.from('live_checkins').select('checked_in_at').eq('user_id', userId).gte('checked_in_at', since7d).limit(100),
        supabase.from('event_vibes').select('created_at').eq('user_id', userId).gte('created_at', since7d).limit(100),

        // Peer sample: vibe scores from recently active profiles (anonymised)
        supabase.from('profiles').select('vibe_score').not('vibe_score', 'is', null).gt('vibe_score', 0).order('last_seen', { ascending: false }).limit(80),
      ]);

      const tw = {
        rsvp: rsvpThis.count || 0, vibe: vibeThis.count || 0,
        checkin: checkinThis.count || 0, echo: echoThis.count || 0, post: postThis.count || 0,
      };
      const lw = {
        rsvp: rsvpLast.count || 0, vibe: vibeLast.count || 0,
        checkin: checkinLast.count || 0, echo: echoLast.count || 0, post: postLast.count || 0,
      };

      const thisTotal = tw.rsvp + tw.vibe + tw.checkin + tw.echo + tw.post;
      const lastTotal = lw.rsvp + lw.vibe + lw.checkin + lw.echo + lw.post;

      const trend = this._computeTrend(thisTotal, lastTotal);

      // Decay-weighted engagement momentum
      const rsvpTimes = (rsvpTs.data || []).map(r => r.created_at);
      const checkinTimes = (checkinTs.data || []).map(r => r.checked_in_at);
      const vibeTimes = (vibeTs.data || []).map(r => r.created_at);
      const decay_score = parseFloat(this._decayWeightedScore([...rsvpTimes, ...checkinTimes, ...vibeTimes]).toFixed(2));

      // Cohort percentile
      const peerScores = (peerSample.data || []).map(p => p.vibe_score || 0);
      const userScore = profile?.vibe_score || 0;
      const cohort = this._cohortPercentile(userScore, peerScores);

      // Profile completeness signals
      const hasAvatar = !!profile?.avatar_url;
      const hasBio = !!(profile?.bio?.trim());
      const hasInterests = (profile?.interests || []).length > 0;
      const followers = profile?.followers_count || 0;
      const streak = profile?.current_streak || 0;

      // Action ROI: which activity type gives most return per effort
      // Based on ScoreEngine.computeVibeScore weights (checkin=25, post=15, follow=20, rsvp=5, vibe=2)
      const action_roi = [];
      if (tw.checkin === 0) action_roi.push({ action: 'Touch Down at an event', pts_per_action: 25 });
      if (tw.post === 0) action_roi.push({ action: 'Post a Gruv', pts_per_action: 15 });
      if (tw.rsvp < 2) action_roi.push({ action: 'RSVP to upcoming Gruvs', pts_per_action: 5 });
      if (tw.vibe < 5) action_roi.push({ action: 'Send Vibes on events', pts_per_action: 2 });
      action_roi.sort((a, b) => b.pts_per_action - a.pts_per_action);

      // Tip generation with priority ranking (highest-impact first)
      const tips = [];

      // Critical: profile completeness (blocks discovery)
      if (!hasAvatar) tips.push({ priority: 10, text: 'Add a profile photo — vibers with photos get 3× more profile visits.' });
      if (!hasBio) tips.push({ priority: 9, text: 'Write a short bio so others know what Gruvs you live for.' });
      if (!hasInterests) tips.push({ priority: 8, text: 'Set your interests to unlock personalised feed ranking.' });

      // Trend-driven coaching
      if (trend.direction === 'down' && trend.pct < -30) {
        tips.push({ priority: 7, text: `Your activity dropped ${Math.abs(trend.pct)}% vs last week. A single RSVP or Touch Down will reverse the trend.` });
      } else if (trend.direction === 'up' && trend.pct > 20) {
        tips.push({ priority: 3, text: `You're up ${trend.pct}% from last week. Momentum is everything — keep it going.` });
      }

      // Streak coaching
      if (streak >= 7) tips.push({ priority: 2, text: `${streak}-day streak — you're earning the Loyal Viber badge. Don't break the chain.` });
      else if (streak > 0 && streak < 7) tips.push({ priority: 4, text: `${streak}-day streak — ${7 - streak} more days to unlock the Loyal Viber badge.` });

      // Cohort-driven coaching
      if (cohort.percentile < 30 && userScore > 0) {
        tips.push({ priority: 6, text: `You're in the ${cohort.label} of vibers. The gap to the top 50% is ${Math.max(0, peerScores[Math.floor(peerScores.length * 0.5)] - userScore)} pts.` });
      } else if (cohort.percentile >= 75) {
        tips.push({ priority: 1, text: `You're in the ${cohort.label} of all vibers. You're setting the standard.` });
      }

      // Highest-ROI action nudge
      if (action_roi[0]) {
        tips.push({ priority: 5, text: `Highest return this week: ${action_roi[0].action} (${action_roi[0].pts_per_action} pts/action).` });
      }

      // Social growth
      if (followers < 10) tips.push({ priority: 5, text: `You have ${followers} followers. Follow vibers whose taste matches yours — your feed improves with every connection.` });

      // Sort by priority, take top 4
      tips.sort((a, b) => b.priority - a.priority);
      const finalTips = tips.slice(0, 4).map(t => t.text);

      // Insight: decay_score-weighted narrative
      let insight;
      if (decay_score === 0) {
        insight = 'No activity this week. Your feed ranking drops when you go quiet — one action resets the clock.';
      } else if (decay_score < 1) {
        insight = `Low engagement momentum this week (${thisTotal} action${thisTotal !== 1 ? 's' : ''}). Your score is decaying — consistency compounds faster than bursts.`;
      } else if (decay_score < 3) {
        const trendWord = trend.direction === 'up' ? '↑ up' : trend.direction === 'down' ? '↓ down' : 'steady';
        insight = `${thisTotal} actions this week (${trendWord} ${Math.abs(trend.pct)}% vs last week). You're in the mix — push one more action to hit the momentum threshold.`;
      } else {
        insight = `Strong week — decay-weighted momentum of ${decay_score.toFixed(1)}. You're in the ${cohort.label} of all vibers right now.`;
      }

      // Next milestone
      let next_milestone = null;
      if (userScore < 100) next_milestone = `${100 - userScore} pts to Level 2`;
      else if (userScore < 500) next_milestone = `${500 - userScore} pts to Elite Viber`;
      else if (userScore < 2000) next_milestone = `${2000 - userScore} pts to Royal Viber`;
      else if (userScore < 10000) next_milestone = `${10000 - userScore} pts to Gruv Master`;

      return { insight, tips: finalTips, next_milestone, trend, cohort, decay_score, action_roi: action_roi.slice(0, 3) };
    } catch (e) {
      return null;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CHAT MANAGER  — real-time event chat with presence, pinning, moderation
// ─────────────────────────────────────────────────────────────────────────────
export const ChatManager = {
  _channels: new Map(),

  subscribe(eventId, onMessage, onPresence) {
    if (this._channels.has(eventId)) this.unsubscribe(eventId);
    const channel = supabase
      .channel(`event_chat:${eventId}`, { config: { presence: { key: eventId } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_chat_messages', filter: `event_id=eq.${eventId}` },
        payload => onMessage?.({ type: 'new', message: payload.new }))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'event_chat_messages', filter: `event_id=eq.${eventId}` },
        payload => onMessage?.({ type: 'update', message: payload.new }))
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        onPresence?.(Object.values(state).flat());
      })
      .subscribe();
    this._channels.set(eventId, channel);
    return () => this.unsubscribe(eventId);
  },

  async joinPresence(eventId, userId, username, avatarUrl) {
    const ch = this._channels.get(eventId);
    if (ch) await ch.track({ user_id: userId, username, avatar_url: avatarUrl, online_at: new Date().toISOString() });
  },

  async leavePresence(eventId) {
    const ch = this._channels.get(eventId);
    if (ch) await ch.untrack();
  },

  unsubscribe(eventId) {
    const ch = this._channels.get(eventId);
    if (ch) { supabase.removeChannel(ch); this._channels.delete(eventId); }
  },

  async fetchMessages(eventId, limit = 60) {
    const { data, error } = await supabase
      .from('event_chat_messages')
      .select('id, message, created_at, reply_to, pinned:is_pinned, deleted, user_id, profiles:user_id(id, username, avatar_url, is_verified)')
      .eq('event_id', eventId)
      .eq('deleted', false)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async send(eventId, userId, message, replyTo = null) {
    const { SecurityService } = require('./securityService');
    // Rate-limit: max 20 messages per 60s per user+event
    const rl = SecurityService.rateLimitCheck(`chat:${userId}:${eventId}`, { maxPerWindow: 20, windowMs: 60_000 });
    if (!rl.allowed) throw new Error(rl.message);
    // Spam gate
    if (SecurityService.isSpam(message)) throw new Error('Message flagged as spam. Try again with different content.');
    // Length + XSS strip
    const clean = SecurityService.validateTextInput(message, { field: 'Message', minLen: 1, maxLen: 500 });
    // Ban gate. This RPC did not exist on the database until
    // event_chat_hardening.sql, so the call errored, `canSend` came back
    // undefined, `=== false` was false, and every send fell straight through —
    // the gate was open by construction. It is a courtesy check so the UI can
    // explain itself; gate_event_chat_insert is what actually enforces it, so
    // an RPC failure here is surfaced rather than silently ignored.
    const { data: canSend, error: gateErr } = await supabase.rpc('can_send_chat', {
      p_user_id: userId, p_event_id: eventId,
    });
    // A schema-miss (RPC absent on an un-migrated DB) is tolerated — the
    // BEFORE INSERT trigger still enforces the ban, so failing closed here
    // would only break chat for everyone on a drifted database. Any other
    // error is a real failure and fails closed.
    if (canSend === false || (gateErr && !isSchemaMiss(gateErr))) {
      throw new Error('You are not allowed to chat in this event.');
    }
    const { data, error } = await supabase
      .from('event_chat_messages')
      .insert({ event_id: eventId, user_id: userId, message: clean, reply_to: replyTo })
      .select('id, message, created_at, reply_to, pinned:is_pinned, deleted, user_id')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteMessage(messageId) {
    const { error } = await supabase.from('event_chat_messages').update({ deleted: true }).eq('id', messageId);
    if (error) throw error;
  },

  async setPinned(messageId, pinned) {
    // The column is `is_pinned` — there is no `pinned` or `pinned_by` column, so
    // this UPDATE errored every time: pinning a chat message never worked.
    const { error } = await supabase.from('event_chat_messages')
      .update({ is_pinned: pinned }).eq('id', messageId);
    if (error) throw error;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY FEED MANAGER  — single query + Realtime subscription
// ─────────────────────────────────────────────────────────────────────────────
export const ActivityFeedManager = {
  _channel: null,

  async fetch(userId, { limit = 50, afterId = null } = {}) {
    let qb = supabase
      .from('activity_feed')
      .select('id, action_type, target_id, target_type, target_title, actor_username, actor_avatar, created_at, read')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (afterId) qb = qb.lt('id', afterId);
    const { data, error } = await qb;
    if (error) throw error;
    return data || [];
  },

  subscribe(userId, onActivity) {
    if (this._channel) { supabase.removeChannel(this._channel); this._channel = null; }
    this._channel = supabase
      .channel(`activity_feed:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_feed', filter: `recipient_id=eq.${userId}` },
        payload => onActivity?.(payload.new))
      .subscribe();
    return () => {
      if (this._channel) { supabase.removeChannel(this._channel); this._channel = null; }
    };
  },

  async markAllRead(userId) {
    await supabase.rpc('mark_activity_read', { p_user_id: userId });
  },

  async unreadCount(userId) {
    const { count } = await supabase
      .from('activity_feed')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('read', false);
    return count || 0;
  },

  // Legacy: what followed users are doing (used by CrewFeedScreen)
  async fetchActivity(userId, limit = 40) {
    if (!userId) return { liveNow: [], activity: [] };
    try {
      const followedIds = await UserManager.getFollowedIds(userId);
      if (!followedIds.length) return { liveNow: [], activity: [] };
      const [rsvpRes, checkinRes, vibeRes] = await Promise.all([
        supabase.from('event_rsvps')
          .select('user_id, event_id, status, created_at, profiles(username, avatar_url, is_online), events(id, title, event_date, media, venue_name, category, going)')
          .in('user_id', followedIds).eq('status', 'going').order('created_at', { ascending: false }).limit(limit),
        supabase.from('live_checkins')
          .select('user_id, event_id, checked_in_at, profiles(username, avatar_url, is_online), events(id, title, event_date, media, venue_name, category, going)')
          .in('user_id', followedIds).order('checked_in_at', { ascending: false }).limit(20),
        supabase.from('event_vibes')
          .select('user_id, event_id, created_at, profiles(username, avatar_url, is_online), events(id, title, event_date, media, venue_name, category, going)')
          .in('user_id', followedIds).order('created_at', { ascending: false }).limit(limit),
      ]);
      const toRow = (type, row, ts) => ({ id: `${type}-${row.user_id}-${row.event_id}-${ts}`, type, actor: row.profiles, event: row.events, timestamp: ts });
      const activity = [
        ...(rsvpRes.data || []).map(r => toRow('rsvp', r, r.created_at)),
        ...(checkinRes.data || []).map(r => toRow('checkin', r, r.checked_in_at)),
        ...(vibeRes.data || []).map(r => toRow('vibe', r, r.created_at)),
      ].filter(r => r.actor && r.event).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
      const liveNow = (checkinRes.data || []).filter(r => r.profiles?.is_online && r.events)
        .map(r => ({ actor: r.profiles, event: r.events, checkedInAt: r.checked_in_at }));
      return { liveNow, activity };
    } catch { return { liveNow: [], activity: [] }; }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST MANAGER  — event playlist with track voting + Realtime
// ─────────────────────────────────────────────────────────────────────────────
export const PlaylistManager = {
  _channels: new Map(),

  async getOrCreate(eventId, userId) {
    const { data, error } = await supabase.rpc('get_or_create_playlist', { p_event_id: eventId, p_user_id: userId });
    if (error) throw error;
    return data;
  },

  async fetchTracks(playlistId) {
    const { data, error } = await supabase
      .from('event_playlist_tracks')
      .select('id, track_id, platform, title, artist, thumbnail, duration_ms, votes, added_by, created_at, dedication, status, profiles:added_by(username, avatar_url)')
      .eq('playlist_id', playlistId)
      .order('votes', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addTrack(playlistId, userId, track, dedication = null) {
    const { data, error } = await supabase
      .from('event_playlist_tracks')
      .insert({ playlist_id: playlistId, added_by: userId, track_id: track.id, platform: track.platform, title: track.title, artist: track.artist, thumbnail: track.thumbnail || null, duration_ms: track.duration_ms || null, votes: 0, dedication: dedication?.trim() || null })
      .select('id, track_id, platform, title, artist, thumbnail, duration_ms, votes, added_by, created_at, dedication, status')
      .single();
    if (error) throw error;
    return data;
  },

  // DJ/host works the request list: 'requested' → 'played' (and back if mis-tapped).
  async setTrackStatus(trackRowId, status) {
    const { error } = await supabase
      .from('event_playlist_tracks')
      .update({ status })
      .eq('id', trackRowId);
    if (error) throw error;
  },

  async removeTrack(trackRowId, userId) {
    // userId passed so RLS `added_by = auth.uid()` is reinforced client-side too
    const qb = supabase.from('event_playlist_tracks').delete().eq('id', trackRowId);
    const { error } = userId ? await qb.eq('added_by', userId) : await qb;
    if (error) throw error;
  },

  async vote(trackRowId, userId) {
    const { error } = await supabase.rpc('vote_track', { p_track_id: trackRowId, p_user_id: userId });
    if (error) throw error;
  },

  async unvote(trackRowId, userId) {
    const { error } = await supabase.rpc('unvote_track', { p_track_id: trackRowId, p_user_id: userId });
    if (error) throw error;
  },

  async fetchUserVotes(playlistId, userId) {
    const { data: trackRows } = await supabase.from('event_playlist_tracks').select('id').eq('playlist_id', playlistId);
    const ids = (trackRows || []).map(r => r.id);
    if (!ids.length) return new Set();
    const { data } = await supabase.from('event_track_votes').select('track_id').in('track_id', ids).eq('user_id', userId);
    return new Set((data || []).map(r => r.track_id));
  },

  subscribe(playlistId, onChange) {
    if (this._channels.has(playlistId)) supabase.removeChannel(this._channels.get(playlistId));
    const ch = supabase
      .channel(`playlist_tracks:${playlistId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_playlist_tracks', filter: `playlist_id=eq.${playlistId}` },
        payload => onChange?.(payload))
      .subscribe();
    this._channels.set(playlistId, ch);
    return () => {
      if (this._channels.has(playlistId)) { supabase.removeChannel(this._channels.get(playlistId)); this._channels.delete(playlistId); }
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PULSE FEED MANAGER — event-less general community conversation
// ─────────────────────────────────────────────────────────────────────────────
export const PulseFeedManager = {
  async fetchPulseFeed(page = 0, limit = 20) {
    const { data, error } = await supabase
      .from('echoes')
      .select('id, body, created_at, likes, user_id, profiles:user_id(id, username, avatar_url, display_name, writing_style)')
      .is('event_id', null)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);
    if (error) throw error;
    return data || [];
  },

  async postPulseEcho(userId, body) {
    const { data, error } = await supabase
      .from('echoes')
      .insert({ user_id: userId, body, event_id: null })
      .select('id, body, created_at, likes, user_id, profiles:user_id(id, username, avatar_url, display_name, writing_style)')
      .single();
    if (error) throw error;
    return data;
  },

  async fetchReplies(parentEchoId) {
    const { data, error } = await supabase
      .from('echoes')
      .select('id, body, created_at, likes, user_id, parent_id, profiles:user_id(id, username, avatar_url, display_name, writing_style)')
      .eq('parent_id', parentEchoId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async postReply(userId, parentEchoId, body) {
    const { data, error } = await supabase
      .from('echoes')
      .insert({ user_id: userId, parent_id: parentEchoId, body, event_id: null })
      .select('id, body, created_at, likes, user_id, parent_id, profiles:user_id(id, username, avatar_url, display_name, writing_style)')
      .single();
    if (error) throw error;
    return data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GAMIFICATION ENGINE — Vibe Coins and Reputation Status System
// ─────────────────────────────────────────────────────────────────────────────
export const GamificationEngine = {
  async awardCoins(userId, actionType) {
    if (!userId) return 0;
    const rates = { rsvp: 10, checkin: 30, gallery_post: 50, pulse_post: 20 };
    const amount = rates[actionType] || 0;
    if (amount === 0) return 0;
    try {
      const { data: p } = await supabase.from('profiles').select('vibe_coins').eq('id', userId).single();
      const newCoins = (p?.vibe_coins || 0) + amount;
      const newStatus = this.getReputationStatus(newCoins);
      await supabase.from('profiles').update({ vibe_coins: newCoins, reputation_status: newStatus }).eq('id', userId);
      return newCoins;
    } catch { return 0; }
  },

  getReputationStatus(coins) {
    if (coins < 100) return 'Novice Viber';
    if (coins < 500) return 'Local Regular';
    return 'Neighborhood Legend';
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TICKET MANAGER — local QR reservation and validation
// ─────────────────────────────────────────────────────────────────────────────
export const TicketManager = {
  async reserveTicket(eventId, userId, rsvpId) {
    // A QR entry ticket is a CREDENTIAL. The old suffix was 4 random digits
    // (~9,000 guesses) on top of predictable event/user prefixes — brute-forceable
    // at a door. Use a CSPRNG token with real entropy instead.
    const tokenStr = `VIBE-TKT-${eventId.slice(0, 4).toUpperCase()}-${secureCode(3, 4)}`;
    const { data, error } = await supabase
      .from('ticket_tokens')
      // Schema is `token` + nullable `used_at` (NULL = unused). There is no
      // `token_str` / `used` column — using them 400'd every ticket call.
      .insert({ rsvp_id: rsvpId, user_id: userId, event_id: eventId, token: tokenStr })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getMyTickets(userId) {
    const { data, error } = await supabase
      .from('ticket_tokens')
      .select('*, events(id, title, event_date, event_time, venue_name, cover_image, cover_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /**
   * Validate a ticket AT THE DOOR. Returns { valid, reason, ticket }.
   *
   * The old version flipped `used:true` unconditionally, so the SAME ticket
   * scanned twice both read "valid" (double-entry), and any event's ticket
   * validated at any door. This is the atomic, replay-safe version:
   *
   *   • The update only matches an UNUSED ticket (`used_at IS NULL`), so the
   *     second scan flips zero rows — double-entry is impossible at the DB level,
   *     with no check-then-write race.
   *   • Optionally scoped to the event, so a ticket only opens its OWN door.
   *   • Distinguishes "already used" from "not a real ticket" for the host.
   */
  async validateTicket(tokenStr, eventId = null) {
    const token = String(tokenStr || '').trim();
    if (!token) return { valid: false, reason: 'empty', ticket: null };

    // Atomic claim: only an unused ticket transitions to used.
    let q = supabase
      .from('ticket_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)
      .is('used_at', null);
    if (eventId) q = q.eq('event_id', eventId);
    const { data, error } = await q.select('*, profiles:user_id(username, avatar_url), events(title)');
    if (error) { logError('Ticket.validate', error); return { valid: false, reason: 'error', ticket: null }; }

    if (data && data.length) return { valid: true, reason: 'ok', ticket: data[0] };

    // Nothing flipped — say WHY: already used, wrong event, or never existed.
    const { data: existing } = await supabase
      .from('ticket_tokens')
      .select('used_at, event_id')
      .eq('token', token)
      .maybeSingle();
    return ticketOutcome(existing, eventId);
  },
};

/**
 * Pure: given the existing ticket row (or null) after an atomic claim flipped
 * zero rows, explain WHY the door should reject it. Kept separate so the
 * decision is unit-tested even though the DB call around it isn't.
 */
export function ticketOutcome(existing, eventId = null) {
  if (!existing) return { valid: false, reason: 'not_found', ticket: null };
  if (eventId && existing.event_id !== eventId) return { valid: false, reason: 'wrong_event', ticket: null };
  return { valid: false, reason: 'already_used', ticket: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT MANAGER  (co-created events — the group chat plans, fills and launches
// an event together). Server-side RPCs are the only write path: attribution,
// claims, confirmation counts and the readiness checklist are all enforced in
// event_drafts.sql — the client just renders what the server says.
// ─────────────────────────────────────────────────────────────────────────────
export const DraftManager = {
  DRAFT_FIELDS: ['title', 'description', 'category', 'venue_name', 'location',
    'event_date', 'event_time', 'cover_url', 'price', 'capacity', 'min_age'],

  async create(crewId = null, title = null) {
    const { data, error } = await supabase.rpc('draft_create', { p_crew_id: crewId, p_title: title });
    if (error) { logError('Draft.create', error); throw error; }
    return data;
  },

  async fetchMine() {
    try {
      const { data } = await supabase
        .from('event_drafts')
        .select('*, event_draft_members(user_id, role, profiles:user_id(username, avatar_url))')
        .in('status', ['draft', 'shelved'])
        .order('updated_at', { ascending: false });
      return data || [];
    } catch (e) { logError('Draft.fetchMine', e); return []; }
  },

  async get(draftId) {
    const { data, error } = await supabase
      .from('event_drafts')
      .select('*, event_draft_members(user_id, role, profiles:user_id(username, avatar_url)), event_draft_confirms(user_id)')
      .eq('id', draftId)
      .maybeSingle();
    if (error) { logError('Draft.get', error); return null; }
    return data;
  },

  async addMember(draftId, userId) {
    const { error } = await supabase.rpc('draft_add_member', { p_draft: draftId, p_user: userId });
    if (error) { logError('Draft.addMember', error); throw error; }
  },

  // Value is always sent as text; the server casts per-field and rejects junk.
  async setField(draftId, field, value) {
    const { data, error } = await supabase.rpc('draft_set_field', {
      p_draft: draftId, p_field: field,
      p_value: value === null || value === undefined ? null : String(value),
    });
    if (error) { logError('Draft.setField', error); throw error; }
    return data;
  },

  async claimField(draftId, field) {
    const { error } = await supabase.rpc('draft_claim_field', { p_draft: draftId, p_field: field });
    if (error) { logError('Draft.claimField', error); throw error; }
  },

  // Returns the current confirmation count. Any edit voids all confirmations
  // server-side, so the UI should re-render the arm state from realtime.
  async confirmLaunch(draftId) {
    const { data, error } = await supabase.rpc('draft_confirm_launch', { p_draft: draftId });
    if (error) { logError('Draft.confirmLaunch', error); throw error; }
    return data;
  },

  // Resolves to the launched event id. Server enforces the checklist and the
  // confirmation quorum; a relaunch of an already-launched draft is a no-op
  // that returns the same event id.
  async launch(draftId) {
    const { data, error } = await supabase.rpc('draft_launch', { p_draft: draftId });
    if (error) { logError('Draft.launch', error); throw error; }
    cache.invalidate('feed:');
    return data;
  },

  async setStatus(draftId, status) {
    const { error } = await supabase.rpc('draft_set_status', { p_draft: draftId, p_status: status });
    if (error) { logError('Draft.setStatus', error); throw error; }
  },

  // "Run it back": fork a past event you hosted into a fresh pre-filled draft
  // (date intentionally blank — the server refuses to copy it).
  async forkEvent(eventId, crewId = null) {
    const { data, error } = await supabase.rpc('draft_fork_event', { p_event: eventId, p_crew_id: crewId });
    if (error) { logError('Draft.forkEvent', error); throw error; }
    return data;
  },

  // Past events the user could run back (hosted or co-hosted, already over).
  async fetchRunBackCandidates(userId, limit = 8) {
    try {
      const cutoff = new Date().toISOString();
      const [{ data: hosted }, { data: roles }] = await Promise.all([
        supabase.from('events')
          .select('id, title, event_date, venue_name, cover_url')
          .eq('author_id', userId).lt('date_time', cutoff)
          .order('date_time', { ascending: false }).limit(limit),
        supabase.from('event_roles')
          .select('events:event_id(id, title, event_date, venue_name, cover_url, date_time)')
          .eq('user_id', userId).eq('role', 'co_host').limit(limit),
      ]);
      const coHosted = (roles || []).map(r => r.events)
        .filter(e => e && e.date_time && e.date_time < cutoff);
      const seen = new Set();
      return [...(hosted || []), ...coHosted]
        .filter(e => e && !seen.has(e.id) && seen.add(e.id))
        .slice(0, limit);
    } catch (e) { logError('Draft.runBackCandidates', e); return []; }
  },

  // ── Shared prep tasks (feature 51) ─────────────────────────────────────
  async fetchTasks(draftId) {
    const { data, error } = await supabase
      .from('event_draft_tasks')
      .select('*')
      .eq('draft_id', draftId)
      .order('created_at', { ascending: true });
    if (error) { logError('Draft.fetchTasks', error); return []; }
    return data || [];
  },

  async addTask(draftId, title, assignTo = null) {
    const { data, error } = await supabase.rpc('draft_task_add',
      { p_draft: draftId, p_title: title, p_assign: assignTo });
    if (error) { logError('Draft.addTask', error); throw error; }
    return data;
  },

  async toggleTask(taskId, done) {
    const { data, error } = await supabase.rpc('draft_task_toggle', { p_task: taskId, p_done: done });
    if (error) { logError('Draft.toggleTask', error); throw error; }
    return data;
  },

  async assignTask(taskId, userId) {
    const { data, error } = await supabase.rpc('draft_task_assign', { p_task: taskId, p_user: userId });
    if (error) { logError('Draft.assignTask', error); throw error; }
    return data;
  },

  async deleteTask(taskId) {
    const { error } = await supabase.rpc('draft_task_delete', { p_task: taskId });
    if (error) { logError('Draft.deleteTask', error); throw error; }
  },

  subscribeTasks(draftId, onChange) {
    const channel = supabase
      .channel(`draft_tasks:${draftId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'event_draft_tasks', filter: `draft_id=eq.${draftId}` },
        () => onChange?.())
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  // The readiness checklist, mirrored client-side ONLY for rendering the
  // burn-down UI — draft_launch re-checks everything server-side.
  checklist(draft) {
    if (!draft) return [];
    return [
      { key: 'title', label: 'Name the event', done: !!draft.title },
      { key: 'event_date', label: 'Pick a date', done: !!draft.event_date },
      { key: 'location', label: 'Set the location', done: !!(draft.location || draft.venue_name) },
      { key: 'cover_url', label: 'Add a cover', done: !!draft.cover_url, optional: true },
      { key: 'description', label: 'Describe it', done: !!draft.description, optional: true },
    ];
  },

  // Live co-editing: one channel per open draft card. RLS decides who receives.
  subscribe(draftId, onChange) {
    const channel = supabase
      .channel(`event_draft:${draftId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'event_drafts', filter: `id=eq.${draftId}` },
        (payload) => onChange?.(payload.new))
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};
