/**
 * The Gruvs — PersonalizationEngine v1
 *
 * A 12-signal deep behavioral profiler + traffic router + personal event
 * calendar generator. This engine studies every user's actions over time
 * and uses that model to route recurring Royal Vibe events to exactly the
 * right audience, and to build each user a personalised weekly/monthly/
 * yearly event plan.
 *
 * Signals computed per user
 * ──────────────────────────
 *  1. category_vector     — weighted affinity across all event categories
 *  2. subcategory_vector  — granular sub-cat preferences
 *  3. temporal_vector     — hour-of-day + day-of-week engagement patterns
 *  4. price_ceiling       — max they'll spend; derived from paid RSVP history
 *  5. avg_distance_km     — typical travel radius from home centroid
 *  6. social_mode         — solo / small / large crowd preference
 *  7. discovery_lag_days  — how far ahead they typically find events
 *  8. completion_rate     — RSVP → check-in conversion
 *  9. trend_sensitivity   — mainstream (0) ↔ niche (1)
 * 10. host_trust_threshold— minimum host integrity score to RSVP
 * 11. engagement_velocity — growth rate of recent activity vs 90-day avg
 * 12. cohort_tags         — AI-assigned lifestyle segments
 *
 * Traffic Routing Score (per event × user pair)
 * ──────────────────────────────────────────────
 *   score = cat_sim × 0.35
 *         + temporal_fit × 0.25
 *         + price_fit × 0.15
 *         + location_fit × 0.15
 *         + social_fit × 0.05
 *         + trust_fit × 0.05
 *   × completion_rate_weight
 *   × engagement_velocity_boost
 */

import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// DWELL-TIME SIGNAL  (TikTok-style watch time)
// ─────────────────────────────────────────────────────────────────────────────

// Local accumulator so we batch dwell instead of hammering the DB per card.
const _dwellBuffer = new Map(); // eventId → { ms, opened }
let _dwellFlushTimer = null;

/**
 * recordEventView — call when a user lingers on or opens an event.
 * @param {string} eventId
 * @param {number} dwellMs  — milliseconds the card was on screen
 * @param {boolean} opened  — did they open the detail
 * Buffers and flushes every ~6s (and dwell < 400ms is ignored as noise).
 */
export function recordEventView(eventId, dwellMs = 0, opened = false) {
  if (!eventId) return;
  if (dwellMs < 400 && !opened) return; // ignore fly-by glances
  const cur = _dwellBuffer.get(eventId) || { ms: 0, opened: false };
  cur.ms += Math.max(0, dwellMs);
  cur.opened = cur.opened || opened;
  _dwellBuffer.set(eventId, cur);
  if (!_dwellFlushTimer) _dwellFlushTimer = setTimeout(flushEventViews, 6000);
}

/** Flush buffered dwell to the DB via the atomic RPC (best-effort). */
export async function flushEventViews() {
  clearTimeout(_dwellFlushTimer);
  _dwellFlushTimer = null;
  if (_dwellBuffer.size === 0) return;
  const batch = [..._dwellBuffer.entries()];
  _dwellBuffer.clear();
  for (const [eventId, { ms, opened }] of batch) {
    try {
      await supabase.rpc('record_event_view', { p_event_id: eventId, p_dwell_ms: Math.round(ms), p_opened: opened });
    } catch { /* table/RPC may not be migrated yet — drop silently */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Haversine distance in km between two lat/lon pairs */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Cosine similarity between two plain objects treated as vectors */
function cosineSim(vecA, vecB) {
  const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  let dot = 0, normA = 0, normB = 0;
  keys.forEach(k => {
    const a = vecA[k] || 0;
    const b = vecB[k] || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  });
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Softmax-normalise an array of numbers */
function softmax(arr) {
  if (!arr.length) return arr;
  const max = Math.max(...arr);
  const exps = arr.map(v => Math.exp(v - max));
  const sum = exps.reduce((s, v) => s + v, 0);
  return exps.map(v => v / (sum || 1));
}

/** Given a list of ISO date strings, compute the next occurrence ≥ today */
function nextCustomDate(dates) {
  const today = new Date().toISOString().split('T')[0];
  const sorted = [...dates].sort();
  return sorted.find(d => d >= today) || sorted[sorted.length - 1] || null;
}

/** Compute the next occurrence date for a recurrence rule */
export function computeNextOccurrence(event, fromDate = new Date()) {
  const from = fromDate.toISOString().split('T')[0];

  if (event.recurrence_type === 'custom') {
    return nextCustomDate(event.recurrence_dates || []);
  }

  const base = new Date(event.event_date || from);
  const interval = event.recurrence_interval || 1;
  let candidate = new Date(base);

  // Advance until candidate >= from
  while (candidate.toISOString().split('T')[0] < from) {
    if (event.recurrence_type === 'daily') {
      candidate.setDate(candidate.getDate() + interval);
    } else if (event.recurrence_type === 'weekly') {
      candidate.setDate(candidate.getDate() + 7 * interval);
    } else if (event.recurrence_type === 'monthly') {
      candidate.setMonth(candidate.getMonth() + interval);
    } else if (event.recurrence_type === 'annually') {
      candidate.setFullYear(candidate.getFullYear() + 1);
    } else {
      break;
    }
  }

  const end = event.recurrence_end_date;
  const result = candidate.toISOString().split('T')[0];
  if (end && result > end) return null;
  return result;
}

/** Generate all upcoming occurrences of an event within a date window */
export function generateOccurrences(event, fromDate, toDate) {
  const from = (fromDate instanceof Date ? fromDate : new Date(fromDate)).toISOString().split('T')[0];
  const to = (toDate instanceof Date ? toDate : new Date(toDate)).toISOString().split('T')[0];

  if (!event.is_recurring) {
    const d = event.event_date || event.next_occurrence;
    return d && d >= from && d <= to ? [{ ...event, occurrence_date: d }] : [];
  }

  if (event.recurrence_type === 'custom') {
    return (event.recurrence_dates || [])
      .filter(d => d >= from && d <= to)
      .map(d => ({ ...event, occurrence_date: d }));
  }

  const occurrences = [];
  const base = new Date(event.event_date || from);
  const interval = event.recurrence_interval || 1;
  const end = event.recurrence_end_date ? new Date(event.recurrence_end_date) : new Date(toDate);
  let cursor = new Date(base);

  // rewind to first occurrence >= from
  while (cursor.toISOString().split('T')[0] < from) {
    if (event.recurrence_type === 'weekly') cursor.setDate(cursor.getDate() + 7 * interval);
    else if (event.recurrence_type === 'monthly') cursor.setMonth(cursor.getMonth() + interval);
    else if (event.recurrence_type === 'annually') cursor.setFullYear(cursor.getFullYear() + 1);
    else { cursor.setDate(cursor.getDate() + interval); }
  }

  while (cursor <= end && cursor.toISOString().split('T')[0] <= to) {
    occurrences.push({ ...event, occurrence_date: cursor.toISOString().split('T')[0] });
    if (event.recurrence_type === 'weekly') cursor.setDate(cursor.getDate() + 7 * interval);
    else if (event.recurrence_type === 'monthly') cursor.setMonth(cursor.getMonth() + interval);
    else if (event.recurrence_type === 'annually') cursor.setFullYear(cursor.getFullYear() + 1);
    else cursor.setDate(cursor.getDate() + interval);
    if (occurrences.length > 500) break; // safety cap
  }

  return occurrences;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEEP PROFILE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * computeUserDeepProfile
 *
 * Pulls ~90 days of activity for a user, computes all 12 signals, upserts
 * user_deep_profile. Safe to call after any meaningful user action.
 * Debounced in callers — typically runs once per session max.
 */
export async function computeUserDeepProfile(userId) {
  if (!userId) return null;

  const now = new Date();
  const since90 = new Date(now - 90 * 86400000).toISOString();
  const since30 = new Date(now - 30 * 86400000).toISOString();
  const today = now.toISOString().split('T')[0];

  try {
    // Fetch all signals in parallel
    const [
      rsvpRes,
      vibeRes,
      checkinRes,
      echoRes,
      savedRes,
      profileRes,
      recentRsvpRes,
      viewsRes,
    ] = await Promise.allSettled([
      supabase.from('event_rsvps')
        .select('status, created_at, events(category, categories, city, lat, lon, price_min, event_date, event_time, going)')
        .eq('user_id', userId)
        .gte('created_at', since90)
        .limit(200),
      supabase.from('event_vibes')
        .select('created_at, events(category, categories)')
        .eq('user_id', userId)
        .gte('created_at', since90)
        .limit(300),
      supabase.from('event_checkins')
        .select('created_at, event_id, events(category, city, lat, lon)')
        .eq('user_id', userId)
        .gte('created_at', since90)
        .limit(200),
      supabase.from('echoes')
        .select('created_at, body')
        .eq('user_id', userId)
        .gte('created_at', since90)
        .limit(200),
      supabase.from('saved_events')
        .select('created_at, events(category, categories)')
        .eq('user_id', userId)
        .gte('created_at', since90)
        .limit(100),
      supabase.from('profiles')
        .select('city, lat, lon, interests, vibe_score, social_integrity_score')
        .eq('id', userId)
        .single(),
      // Recent 30 days for velocity
      supabase.from('event_rsvps')
        // no `id` column on event_rsvps (composite PK) — selecting it 400s
        .select('event_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', since30),
      // Dwell-time signal — what they linger on / open (TikTok-style)
      supabase.from('event_views')
        .select('dwell_ms, opened, events(category, categories)')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(300),
    ]);

    const rsvps      = rsvpRes.status === 'fulfilled'      ? (rsvpRes.value.data || [])      : [];
    const vibes      = vibeRes.status === 'fulfilled'      ? (vibeRes.value.data || [])      : [];
    const checkins   = checkinRes.status === 'fulfilled'   ? (checkinRes.value.data || [])   : [];
    const echoes     = echoRes.status === 'fulfilled'      ? (echoRes.value.data || [])      : [];
    const saved      = savedRes.status === 'fulfilled'     ? (savedRes.value.data || [])     : [];
    const profile    = profileRes.status === 'fulfilled'   ? profileRes.value.data           : null;
    const recent30   = recentRsvpRes.status === 'fulfilled' ? (recentRsvpRes.value.count || 0) : 0;
    const views      = viewsRes.status === 'fulfilled'     ? (viewsRes.value.data || [])      : [];

    // ── 1 & 2. Category + subcategory vectors ────────────────────────────────
    // Weights: check-in = 4 (physical presence), RSVP = 2, vibe = 1.5, save = 1, echo = 1.2
    const catVec = {};
    const subVec = {};

    const addCatScore = (cat, subCats, weight) => {
      if (cat) catVec[cat] = (catVec[cat] || 0) + weight;
      (subCats || []).forEach(sc => {
        subVec[sc] = (subVec[sc] || 0) + weight * 0.8;
      });
    };

    checkins.forEach(c => addCatScore(c.events?.category, c.events?.categories, 4));
    rsvps.filter(r => r.status === 'going').forEach(r => addCatScore(r.events?.category, r.events?.categories, 2));
    vibes.forEach(v => addCatScore(v.events?.category, v.events?.categories, 1.5));
    saved.forEach(s => addCatScore(s.events?.category, s.events?.categories, 1));
    echoes.forEach(() => {}); // no category on echoes
    // Dwell-time (TikTok-style): weight ∝ how long they lingered (log-scaled so a
    // few long looks don't swamp everything) + a bump for opening the detail.
    views.forEach(vw => {
      const secs = (vw.dwell_ms || 0) / 1000;
      const dwellWeight = Math.min(2.5, Math.log10(1 + secs)) + (vw.opened ? 0.8 : 0);
      if (dwellWeight > 0) addCatScore(vw.events?.category, vw.events?.categories, dwellWeight);
    });
    // Interests from profile as a prior (weak signal)
    (profile?.interests || []).forEach(i => { catVec[i] = (catVec[i] || 0) + 0.5; });

    // Normalise vectors so scores sum to 1
    const catSum = Object.values(catVec).reduce((s, v) => s + v, 0) || 1;
    Object.keys(catVec).forEach(k => { catVec[k] = catVec[k] / catSum; });
    const subSum = Object.values(subVec).reduce((s, v) => s + v, 0) || 1;
    Object.keys(subVec).forEach(k => { subVec[k] = subVec[k] / subSum; });

    // ── 3. Temporal vector ────────────────────────────────────────────────────
    const hourBuckets = new Array(24).fill(0);
    const dayBuckets  = new Array(7).fill(0);

    const addTemporal = (isoStr) => {
      const d = new Date(isoStr);
      hourBuckets[d.getHours()]++;
      dayBuckets[d.getDay()]++;
    };

    checkins.forEach(c => addTemporal(c.created_at));
    rsvps.filter(r => r.status === 'going').forEach(r => addTemporal(r.created_at));
    vibes.forEach(v => addTemporal(v.created_at));

    const normHour = softmax(hourBuckets);
    const normDay  = softmax(dayBuckets);

    // ── 4. Price ceiling ──────────────────────────────────────────────────────
    const paidEvents = rsvps
      .filter(r => r.events?.price_min && r.events.price_min > 0)
      .map(r => r.events.price_min);
    const priceCeiling = paidEvents.length
      ? Math.round(Math.max(...paidEvents) * 1.2)  // 20% above max paid
      : 200;
    const avgSpend = paidEvents.length
      ? paidEvents.reduce((s, v) => s + v, 0) / paidEvents.length
      : 0;

    // ── 5. Geographic signals ─────────────────────────────────────────────────
    const homeLat = profile?.lat || null;
    const homeLon = profile?.lon || null;

    const distances = checkins
      .filter(c => c.events?.lat && c.events?.lon && homeLat && homeLon)
      .map(c => haversineKm(homeLat, homeLon, c.events.lat, c.events.lon));

    const avgDistanceKm = distances.length
      ? distances.reduce((s, v) => s + v, 0) / distances.length
      : 15;

    const cityCounts = {};
    checkins.forEach(c => { if (c.events?.city) cityCounts[c.events.city] = (cityCounts[c.events.city] || 0) + 1; });
    const preferredCities = Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c]) => c);

    // ── 6. Social mode ────────────────────────────────────────────────────────
    // Derive from event capacity / going count patterns
    const goingCounts = rsvps
      .filter(r => r.events?.going)
      .map(r => r.events.going);
    const avgGoing = goingCounts.length
      ? goingCounts.reduce((s, v) => s + v, 0) / goingCounts.length
      : 30;
    const socialMode =
      avgGoing < 15 ? 'small' :
      avgGoing < 60 ? 'mixed' :
      'large';

    // ── 7. Discovery lag ──────────────────────────────────────────────────────
    // Days between RSVP creation and event_date
    const lags = rsvps
      .filter(r => r.events?.event_date && r.created_at)
      .map(r => {
        const rsvpDate = new Date(r.created_at);
        const eventDate = new Date(r.events.event_date);
        return Math.max(0, (eventDate - rsvpDate) / 86400000);
      });
    const discoveryLagDays = lags.length
      ? lags.reduce((s, v) => s + v, 0) / lags.length
      : 5;

    // ── 8. Completion rate ────────────────────────────────────────────────────
    const goingRsvps = rsvps.filter(r => r.status === 'going').length;
    const completionRate = goingRsvps > 0
      ? Math.min(1, checkins.length / goingRsvps)
      : 0.5;

    // ── 9. Trend sensitivity ──────────────────────────────────────────────────
    // Low going count on attended events = niche (1), high = mainstream (0)
    const nichieness = goingCounts.length
      ? 1 - Math.min(1, avgGoing / 200)
      : 0.5;

    // ── 10. Host trust threshold ──────────────────────────────────────────────
    // Look at integrity scores of hosts whose events they attended
    // Approximate: default 50 — could be enriched with a join later
    const hostTrustThreshold = 50;

    // ── 11. Engagement velocity ───────────────────────────────────────────────
    const total90 = rsvps.length;
    const avg30Rate = recent30 / 30;
    const avg90Rate = total90 / 90;
    const engagementVelocity = avg90Rate > 0 ? avg30Rate / avg90Rate : 1;

    // ── 12. Cohort tags ───────────────────────────────────────────────────────
    const cohortTags = [];
    if (catVec['music'] > 0.2 || catVec['nightlife'] > 0.2) cohortTags.push('nightlife_junkie');
    if (catVec['wellness'] > 0.15 || catVec['fitness'] > 0.15) cohortTags.push('wellness_seeker');
    if (catVec['art'] > 0.15 || catVec['culture'] > 0.15) cohortTags.push('culture_vulture');
    if (catVec['food'] > 0.2 || catVec['market'] > 0.15) cohortTags.push('foodie');
    if (catVec['biz'] > 0.15 || catVec['networking'] > 0.15) cohortTags.push('networker');
    if (avgDistanceKm > 25) cohortTags.push('explorer');
    if (priceCeiling > 300) cohortTags.push('premium_spender');
    if (completionRate > 0.8) cohortTags.push('high_intent');
    if (engagementVelocity > 1.5) cohortTags.push('rising_star');
    if (nichieness > 0.7) cohortTags.push('niche_hunter');

    // Profile confidence: how much data we have (0–1)
    const profileConfidence = Math.min(1, (rsvps.length + checkins.length * 2 + vibes.length * 0.5) / 100);

    const deepProfile = {
      user_id: userId,
      hour_buckets: normHour,
      day_buckets: normDay,
      category_vector: catVec,
      subcategory_vector: subVec,
      price_ceiling: priceCeiling,
      price_floor: 0,
      avg_spend: avgSpend,
      avg_distance_km: avgDistanceKm,
      home_lat: homeLat,
      home_lon: homeLon,
      preferred_cities: preferredCities,
      social_mode: socialMode,
      avg_group_size: avgGoing,
      discovery_lag_days: discoveryLagDays,
      completion_rate: completionRate,
      rsvp_cancel_rate: goingRsvps > 0 ? Math.max(0, 1 - completionRate) : 0.1,
      avg_echo_sentiment: 0.7,
      trend_sensitivity: nichieness,
      host_trust_threshold: hostTrustThreshold,
      days_since_last_visit: 0,
      engagement_velocity: engagementVelocity,
      cohort_tags: cohortTags,
      profile_confidence: profileConfidence,
      last_computed: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabase.from('user_deep_profile').upsert(deepProfile);
    return deepProfile;
  } catch (e) {
    console.warn('[PersonalizationEngine] computeUserDeepProfile failed:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAFFIC ROUTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * routeRecurringEvent
 *
 * Called when a recurring (or any high-value) event is created/updated.
 * Scores every user with a deep_profile against the event and inserts
 * the top N matches into event_traffic_routes so the feed, notifications,
 * and AI planner can use them.
 *
 * @param {string} eventId
 * @param {object} eventData  — the event row (from events table)
 * @param {number} topN       — how many users to route (default 500)
 */
export async function routeRecurringEvent(eventId, eventData, topN = 500) {
  if (!eventId || !eventData) return;

  try {
    // Build event's own category vector for cosine similarity
    const eventCatVec = {};
    if (eventData.category) eventCatVec[eventData.category] = 1;
    (eventData.categories || []).forEach(c => {
      eventCatVec[c] = (eventCatVec[c] || 0) + 0.6;
    });
    const evCatSum = Object.values(eventCatVec).reduce((s, v) => s + v, 0) || 1;
    Object.keys(eventCatVec).forEach(k => { eventCatVec[k] /= evCatSum; });

    // Event temporal vector — when does it happen?
    const eventTemporalVec = new Array(24).fill(0);
    if (eventData.event_time) {
      const hour = parseInt(eventData.event_time.split(':')[0], 10);
      // Weight the 3-hour window around event start
      for (let h = -1; h <= 2; h++) {
        const idx = (hour + h + 24) % 24;
        eventTemporalVec[idx] = h === 0 ? 1 : h === 1 ? 0.7 : 0.4;
      }
    }

    const eventDayVec = new Array(7).fill(0);
    if (eventData.event_date) {
      const dow = new Date(eventData.event_date).getDay();
      eventDayVec[dow] = 1;
      // Recurring weekly — all matching days
      if (eventData.recurrence_type === 'weekly') {
        (eventData.recurrence_days || [dow]).forEach(d => { eventDayVec[d] = 1; });
      }
    }

    // Fetch all user deep profiles
    const { data: profiles } = await supabase
      .from('user_deep_profile')
      .select('*')
      .gt('profile_confidence', 0.1) // only users with meaningful data
      .limit(5000);

    if (!profiles?.length) return;

    const eventPricMin = eventData.price_min || 0;
    const eventLat = eventData.lat;
    const eventLon = eventData.lon;

    const scored = profiles.map(p => {
      // ── 1. Category similarity (35%) ───────────────────────────────────────
      const userCatVec = p.category_vector || {};
      const catScore = cosineSim(eventCatVec, userCatVec);

      // ── 2. Temporal fit (25%) ─────────────────────────────────────────────
      // Hour fit: dot product of event temporal vec and user hour_buckets
      const userHour = p.hour_buckets || new Array(24).fill(1 / 24);
      let hourFit = 0;
      eventTemporalVec.forEach((w, i) => { hourFit += w * (userHour[i] || 0); });

      // Day fit
      const userDay = p.day_buckets || new Array(7).fill(1 / 7);
      let dayFit = 0;
      eventDayVec.forEach((w, i) => { dayFit += w * (userDay[i] || 0); });

      const temporalScore = (hourFit * 0.6 + dayFit * 0.4);

      // ── 3. Price fit (15%) ────────────────────────────────────────────────
      const ceiling = p.price_ceiling || 200;
      let priceScore = 1;
      if (eventPricMin > ceiling) {
        priceScore = Math.max(0, 1 - (eventPricMin - ceiling) / ceiling);
      } else if (eventPricMin === 0) {
        // Free events get a bonus for price-sensitive users
        priceScore = 1 + (1 - (p.avg_spend || 0) / 500) * 0.2;
      }
      priceScore = Math.min(1, priceScore);

      // ── 4. Location fit (15%) ─────────────────────────────────────────────
      let locationScore = 0.5; // default when no coords
      if (eventLat && eventLon && p.home_lat && p.home_lon) {
        const distKm = haversineKm(p.home_lat, p.home_lon, eventLat, eventLon);
        const radius = p.avg_distance_km || 15;
        // Gaussian falloff: full score within radius, decays beyond
        locationScore = Math.exp(-0.5 * (distKm / (radius * 1.5)) ** 2);
      } else if (eventData.city && (p.preferred_cities || []).includes(eventData.city)) {
        locationScore = 0.9;
      }

      // ── 5. Social fit (5%) ────────────────────────────────────────────────
      const eventGoing = eventData.going || 20;
      const userMode = p.social_mode || 'mixed';
      let socialScore = 0.5;
      if (userMode === 'small' && eventGoing < 30) socialScore = 1;
      else if (userMode === 'large' && eventGoing > 80) socialScore = 1;
      else if (userMode === 'mixed') socialScore = 0.75;
      else socialScore = Math.max(0.2, 1 - Math.abs(eventGoing - (p.avg_group_size || 30)) / 100);

      // ── 6. Trust fit (5%) ────────────────────────────────────────────────
      const hostIntegrity = eventData.host_integrity || 70;
      const threshold = p.host_trust_threshold || 50;
      const trustScore = hostIntegrity >= threshold ? 1 : hostIntegrity / threshold;

      // ── Composite score ───────────────────────────────────────────────────
      const raw =
        catScore    * 0.35 +
        temporalScore * 0.25 +
        priceScore  * 0.15 +
        locationScore * 0.15 +
        socialScore * 0.05 +
        trustScore  * 0.05;

      // Multipliers
      const completionBoost = 0.7 + (p.completion_rate || 0.5) * 0.6;
      const velocityBoost   = Math.min(1.3, 0.85 + (p.engagement_velocity || 1) * 0.15);
      const finalScore = Math.min(1, raw * completionBoost * velocityBoost);

      return {
        event_id:      eventId,
        user_id:       p.user_id,
        route_score:   finalScore,
        cat_score:     catScore,
        temporal_score: temporalScore,
        price_score:   priceScore,
        location_score: locationScore,
        social_score:  socialScore,
        trust_score:   trustScore,
        route_reason:  buildRouteReason(catScore, temporalScore, locationScore, p),
      };
    });

    // Take topN by score
    const topRoutes = scored
      .sort((a, b) => b.route_score - a.route_score)
      .slice(0, topN);

    if (!topRoutes.length) return;

    // Upsert in batches of 100
    for (let i = 0; i < topRoutes.length; i += 100) {
      await supabase
        .from('event_traffic_routes')
        .upsert(topRoutes.slice(i, i + 100), { onConflict: 'event_id,user_id' });
    }

    return topRoutes.length;
  } catch (e) {
    console.warn('[PersonalizationEngine] routeRecurringEvent failed:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIENCE TARGETING ROUTER  (hard filters — "deliver to exactly these people")
// ─────────────────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();

/**
 * routeTargetedEvent
 *
 * When a host sets explicit audience criteria (events.audience), this surfaces
 * the event PROMINENTLY to the people who match — a wedding to the clan, a
 * deaf-community workshop to deaf users, a recruiter's gig to job seekers, etc.
 *
 * ⚠️ SAFETY — this PRIORITIZES, it does NOT hide the Gruv. The "hard match"
 * (every match_mode rule must pass) only decides who earns a high-score ROUTE
 * (a boost in feed/calendar/notifications) — NEVER who is allowed to SEE the
 * event. Public Gruvs stay visible and open to everyone (welcomes, never
 * excludes — see project safety rules). Do not turn this into a visibility filter.
 *
 * Only matches attributes the user voluntarily put on their own profile.
 *
 * @param {string} eventId
 * @param {object} audience   — the events.audience JSONB object
 * @param {object} eventGeo   — { lat, lon } of the event (for radius_km)
 * @param {number} cap        — max users to route (default 5000)
 * @returns {Promise<number>} how many people it reached
 */
export async function routeTargetedEvent(eventId, audience, eventGeo = {}, cap = 5000) {
  if (!eventId || !audience || typeof audience !== 'object') return 0;

  const mode = audience.match_mode === 'all' ? 'all' : 'any';
  const lc = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
  const lcArr = (a) => (Array.isArray(a) ? a.map(lc).filter(Boolean) : []);

  // Which filters did the host actually set?
  const f = {
    ageMin:   audience.age_min > 0 ? audience.age_min : null,
    ageMax:   audience.age_max > 0 ? audience.age_max : null,
    genders:  lcArr(audience.genders),
    clans:    lcArr(audience.clans),
    surnames: lcArr(audience.surnames),
    villages: lcArr(audience.villages),
    cities:   lcArr(audience.cities),
    langs:    lcArr(audience.languages),
    tags:     Array.isArray(audience.community_tags) ? audience.community_tags : [],
    radiusKm: audience.radius_km > 0 ? audience.radius_km : null,
    careers:  lcArr(audience.careers), // e.g. ['model','dj','event planner']
  };
  const activeFilters = [
    f.ageMin || f.ageMax ? 'age' : null,
    f.genders.length ? 'gender' : null,
    f.clans.length ? 'clan' : null,
    f.surnames.length ? 'surname' : null,
    f.villages.length ? 'village' : null,
    f.cities.length ? 'city' : null,
    f.langs.length ? 'lang' : null,
    f.tags.length ? 'tags' : null,
    f.radiusKm ? 'radius' : null,
    f.careers.length ? 'career' : null,
  ].filter(Boolean);
  if (!activeFilters.length) return 0; // nothing to target

  try {
    // Pull the candidate pool. We only need the targetable columns; cap keeps it
    // cheap. is_discoverable respects the user's own privacy switch.
    const { data: people } = await supabase
      .from('profiles')
      .select('id, gender, birth_year, clan_name, surname, home_village, city, languages, community_tags, career_title, is_discoverable')
      .eq('is_discoverable', true)
      .limit(20000);

    if (!people?.length) return 0;

    // Radius is resolved server-side. Pulling lat/lon here used to hand every
    // campaigning host a location dump of up to 20k users — coordinates are no
    // longer readable by clients at all (see lock_profile_coordinates.sql).
    // The RPC returns only the IDs inside the circle.
    let inRadius = null;
    if (f.radiusKm) {
      if (!eventGeo.lat || !eventGeo.lon) {
        inRadius = new Set(); // no event location → radius can't match anyone
      } else {
        const { data: near, error: radiusErr } = await supabase.rpc('profiles_within_radius', {
          p_lat: eventGeo.lat,
          p_lon: eventGeo.lon,
          p_radius_km: f.radiusKm,
          p_limit: 20000,
        });
        // Fail closed: if the radius check can't run, match nobody on distance
        // rather than silently ignoring the host's radius filter.
        inRadius = new Set(radiusErr || !near ? [] : near.map((r) => r.id));
      }
    }

    const passes = (p) => {
      const checks = [];
      if (f.ageMin || f.ageMax) {
        const age = p.birth_year ? CURRENT_YEAR - p.birth_year : null;
        checks.push(age != null && (!f.ageMin || age >= f.ageMin) && (!f.ageMax || age <= f.ageMax));
      }
      if (f.genders.length)  checks.push(f.genders.includes(lc(p.gender)));
      if (f.clans.length)    checks.push(f.clans.includes(lc(p.clan_name)));
      if (f.surnames.length) checks.push(f.surnames.includes(lc(p.surname)));
      if (f.villages.length) checks.push(f.villages.includes(lc(p.home_village)));
      if (f.cities.length)   checks.push(f.cities.includes(lc(p.city)));
      if (f.langs.length)    checks.push((p.languages || []).some((l) => f.langs.includes(lc(l))));
      if (f.tags.length)     checks.push((p.community_tags || []).some((t) => f.tags.includes(t)));
      if (f.careers.length) {
        const ct = lc(p.career_title);
        // substring match — host targets "model" → matches "fashion model"
        checks.push(!!ct && f.careers.some((c) => ct.includes(c) || c.includes(ct)));
      }
      if (f.radiusKm) checks.push(!!inRadius?.has(p.id));
      if (!checks.length) return false;
      return mode === 'all' ? checks.every(Boolean) : checks.some(Boolean);
    };

    const reason = `for you — ${describeTargetReason(activeFilters)}`;
    const matched = people.filter(passes).slice(0, cap).map((p) => ({
      event_id:   eventId,
      user_id:    p.id,
      route_score: 0.95,          // explicit targeting outranks soft signals
      route_reason: reason,
    }));

    if (!matched.length) return 0;

    for (let i = 0; i < matched.length; i += 100) {
      await supabase
        .from('event_traffic_routes')
        .upsert(matched.slice(i, i + 100), { onConflict: 'event_id,user_id' });
    }
    return matched.length;
  } catch (e) {
    console.warn('[PersonalizationEngine] routeTargetedEvent failed:', e.message);
    return 0;
  }
}

function describeTargetReason(active) {
  const names = {
    age: 'your age group', gender: 'you', clan: 'your clan', surname: 'your family name',
    village: 'your home area', city: 'your city', lang: 'your language',
    tags: 'your community', radius: 'nearby you', career: 'your profession',
  };
  const picked = active.map((k) => names[k]).filter(Boolean);
  return picked.length ? picked.slice(0, 2).join(' & ') : 'a match';
}

function buildRouteReason(catScore, temporalScore, locationScore, profile) {
  const reasons = [];
  if (catScore > 0.6) reasons.push('strong category match');
  else if (catScore > 0.3) reasons.push('category overlap');
  if (temporalScore > 0.5) reasons.push('matches typical active hours');
  if (locationScore > 0.7) reasons.push('within usual travel radius');
  if ((profile.completion_rate || 0) > 0.7) reasons.push('high-intent attendee');
  if ((profile.engagement_velocity || 1) > 1.3) reasons.push('trending engagement');
  return reasons.join(', ') || 'general interest signal';
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSONAL CALENDAR GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generatePersonalCalendar
 *
 * Returns a curated list of upcoming event occurrences for a user,
 * sorted by personalisation score. Covers all timeframes:
 *   'week'  — next 7 days
 *   'month' — next 30 days
 *   'year'  — next 365 days (max 50 events)
 *
 * Merges:
 *   1. Events already routed to this user (event_traffic_routes)
 *   2. Recurring events matching their category/city profile
 *   3. Their existing RSVPs
 */
export async function generatePersonalCalendar(userId, timeframe = 'week') {
  if (!userId) return [];

  const days = timeframe === 'year' ? 365 : timeframe === 'month' ? 30 : 7;
  const from = new Date();
  const to   = new Date(from.getTime() + days * 86400000);
  const fromStr = from.toISOString().split('T')[0];
  const toStr   = to.toISOString().split('T')[0];

  try {
    const [profileRes, routedRes, recurringRes, rsvpRes] = await Promise.allSettled([
      supabase.from('user_deep_profile').select('*').eq('user_id', userId).single(),
      supabase.from('event_traffic_routes')
        .select('route_score, route_reason, events(*, profiles!author_id(username, avatar_url))')
        .eq('user_id', userId)
        .gt('route_score', 0.3)
        .order('route_score', { ascending: false })
        .limit(100),
      supabase.from('events')
        .select('*, profiles!author_id(username, avatar_url)')
        .neq('status', 'cancelled')
        .lte('event_date', toStr)
        .limit(200),
      supabase.from('event_rsvps')
        .select('status, events(*, profiles!author_id(username, avatar_url))')
        .eq('user_id', userId)
        .in('status', ['going', 'maybe'])
        .limit(50),
    ]);

    const deepProfile  = profileRes.status === 'fulfilled'   ? profileRes.value.data    : null;
    const routedRows   = routedRes.status === 'fulfilled'     ? (routedRes.value.data || [])  : [];
    const recurringEvs = recurringRes.status === 'fulfilled'  ? (recurringRes.value.data || []) : [];
    const myRsvps      = rsvpRes.status === 'fulfilled'       ? (rsvpRes.value.data || []) : [];

    const calendarMap = new Map(); // occurrence_key → entry

    // ── Layer 1: Already-routed events (highest priority) ────────────────────
    routedRows.forEach(row => {
      const ev = row.events;
      if (!ev) return;
      const occurrences = generateOccurrences(ev, from, to);
      occurrences.forEach(occ => {
        const key = `${ev.id}:${occ.occurrence_date}`;
        calendarMap.set(key, {
          ...occ,
          _personalScore: row.route_score,
          _reason: row.route_reason,
          _source: 'routed',
        });
      });
    });

    // ── Layer 2: Recurring events matching profile ────────────────────────────
    if (deepProfile) {
      const userCatVec = deepProfile.category_vector || {};
      const userCities = deepProfile.preferred_cities || [];

      recurringEvs.forEach(ev => {
        const occurrences = generateOccurrences(ev, from, to);
        occurrences.forEach(occ => {
          const key = `${ev.id}:${occ.occurrence_date}`;
          if (calendarMap.has(key)) return; // already routed

          // Quick score without full routing
          const evCatVec = { [ev.category]: 1 };
          const catSim = cosineSim(evCatVec, userCatVec);
          const cityMatch = userCities.includes(ev.city) ? 0.3 : 0;
          const quickScore = catSim * 0.7 + cityMatch;

          if (quickScore > 0.15) {
            calendarMap.set(key, {
              ...occ,
              _personalScore: quickScore,
              _reason: catSim > 0.4 ? 'matches your vibe' : 'happening in your area',
              _source: 'recurring_match',
            });
          }
        });
      });
    }

    // ── Layer 3: Existing RSVPs (always include) ─────────────────────────────
    myRsvps.forEach(r => {
      const ev = r.events;
      if (!ev) return;
      const occurrences = generateOccurrences(ev, from, to);
      occurrences.forEach(occ => {
        const key = `${ev.id}:${occ.occurrence_date}`;
        calendarMap.set(key, {
          ...occ,
          _personalScore: 1,
          _reason: `you're ${r.status}`,
          _source: 'my_rsvp',
          _rsvpStatus: r.status,
        });
      });
    });

    // Sort by date, then by personal score
    const sorted = [...calendarMap.values()]
      .sort((a, b) => {
        const dateDiff = (a.occurrence_date || '').localeCompare(b.occurrence_date || '');
        if (dateDiff !== 0) return dateDiff;
        return (b._personalScore || 0) - (a._personalScore || 0);
      });

    return timeframe === 'year' ? sorted.slice(0, 50) : sorted;
  } catch (e) {
    console.warn('[PersonalizationEngine] generatePersonalCalendar failed:', e.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEED BOOST — inject routed events into an existing feed array
// ─────────────────────────────────────────────────────────────────────────────

/**
 * applyPersonalisedBoost
 *
 * Takes a sorted feed array and re-ranks it using the user's traffic routes.
 * Events that were explicitly routed to this user get a score multiplier.
 * Called inside FeedManager after the base sort.
 */
export async function applyPersonalisedBoost(events, userId) {
  if (!userId || !events?.length) return events;

  try {
    const eventIds = events.map(e => e.id);
    const [routesRes, collab] = await Promise.all([
      supabase.from('event_traffic_routes')
        .select('event_id, route_score')
        .eq('user_id', userId)
        .in('event_id', eventIds),
      collaborativeScores(userId, eventIds),
    ]);

    const routeMap = {};
    (routesRes.data || []).forEach(r => { routeMap[r.event_id] = r.route_score; });

    if (!Object.keys(routeMap).length && !Object.keys(collab).length) return events;

    // routed events get up to +80%, "people like you also liked" up to +50%.
    return [...events].sort((a, b) => {
      const scoreA = (a._heatScore || 0) * (1 + (routeMap[a.id] || 0) * 0.8 + (collab[a.id] || 0) * 0.5);
      const scoreB = (b._heatScore || 0) * (1 + (routeMap[b.id] || 0) * 0.8 + (collab[b.id] || 0) * 0.5);
      return scoreB - scoreA;
    });
  } catch {
    return events;
  }
}

/**
 * collaborativeScores — Instagram-style "people like you also liked".
 * Item-based collaborative filtering over event_vibes:
 *   1. find events I vibed
 *   2. find OTHER users who vibed those same events (my taste neighbours)
 *   3. tally which of the candidate events those neighbours also vibed
 * Returns { eventId: score 0..1 }. Best-effort; empty on any failure.
 */
export async function collaborativeScores(userId, candidateEventIds = []) {
  if (!userId || !candidateEventIds?.length) return {};
  try {
    // 1. My liked items
    const { data: mine } = await supabase
      .from('event_vibes').select('event_id').eq('user_id', userId).limit(300);
    const myItems = (mine || []).map(r => r.event_id);
    if (!myItems.length) return {};

    // 2. Taste neighbours — users who vibed the same events (cap for cost)
    const { data: neigh } = await supabase
      .from('event_vibes').select('user_id').in('event_id', myItems).neq('user_id', userId).limit(2000);
    const neighbourCounts = {};
    (neigh || []).forEach(r => { neighbourCounts[r.user_id] = (neighbourCounts[r.user_id] || 0) + 1; });
    const neighbours = Object.entries(neighbourCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 200).map(([u]) => u);
    if (!neighbours.length) return {};

    // 3. What those neighbours also vibed among the candidates
    const mySet = new Set(myItems);
    const { data: theirs } = await supabase
      .from('event_vibes').select('event_id, user_id')
      .in('event_id', candidateEventIds)
      .in('user_id', neighbours)
      .limit(5000);

    const tally = {};
    (theirs || []).forEach(r => {
      if (mySet.has(r.event_id)) return; // don't recommend what I already liked
      // weight by how strong a neighbour they are
      tally[r.event_id] = (tally[r.event_id] || 0) + (neighbourCounts[r.user_id] || 1);
    });

    const max = Math.max(1, ...Object.values(tally));
    const scores = {};
    Object.entries(tally).forEach(([id, v]) => { scores[id] = v / max; }); // normalise 0..1
    return scores;
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERIES FOLLOWER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export async function followSeries(seriesId, userId, notifyBeforeHours = 24) {
  if (!seriesId || !userId) return;
  const { error } = await supabase.from('event_series_followers')
    .upsert({ series_id: seriesId, user_id: userId, notify_before_hours: notifyBeforeHours },
             { onConflict: 'series_id,user_id' });
  return !error;
}

export async function unfollowSeries(seriesId, userId) {
  if (!seriesId || !userId) return;
  await supabase.from('event_series_followers')
    .delete().eq('series_id', seriesId).eq('user_id', userId);
}

export async function isFollowingSeries(seriesId, userId) {
  if (!seriesId || !userId) return false;
  const { data } = await supabase.from('event_series_followers')
    .select('id').eq('series_id', seriesId).eq('user_id', userId).maybeSingle();
  return !!data;
}

export async function getSeriesFollowers(seriesId) {
  const { data } = await supabase.from('event_series_followers')
    .select('user_id, notify_before_hours, profiles(username, avatar_url)')
    .eq('series_id', seriesId)
    .limit(1000);
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export default {
  computeUserDeepProfile,
  routeRecurringEvent,
  routeTargetedEvent,
  generatePersonalCalendar,
  applyPersonalisedBoost,
  collaborativeScores,
  recordEventView,
  flushEventViews,
  computeNextOccurrence,
  generateOccurrences,
  followSeries,
  unfollowSeries,
  isFollowingSeries,
  getSeriesFollowers,
};
