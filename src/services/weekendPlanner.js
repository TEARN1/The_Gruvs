/**
 * weekendPlanner — proactively plans the user's next ~5 weekends + public
 * holidays. For each upcoming Saturday/Sunday/holiday it finds the best Gruv
 * near the user on that date and offers it as a SUGGESTION.
 *
 * Truth Protocol: this NEVER auto-RSVPs (that would fake intent/attendance).
 * It only suggests; the user taps "Plan it" to actually commit an RSVP.
 */
import { supabase } from './supabase';
import { holidaysBetween } from '../utils/holidays';

const DAY_MS = 24 * 60 * 60 * 1000;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * The dates worth planning across the next `weeks` weeks: every Sat & Sun, plus
 * any public holiday. Returns [{ date:'YYYY-MM-DD', label }] sorted ascending.
 */
export function getPlanSlots(weeks = 5, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + weeks * 7 * DAY_MS);
  const slots = new Map(); // date -> label

  // Weekends
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const d = new Date(t);
    const dow = d.getDay(); // 0 Sun, 6 Sat
    if (dow === 6) slots.set(ymd(d), 'Saturday');
    else if (dow === 0) slots.set(ymd(d), 'Sunday');
  }
  // Holidays (label wins over weekend label)
  for (const h of holidaysBetween(start, end)) slots.set(h.date, h.label);

  return [...slots.entries()]
    .filter(([date]) => date > ymd(now)) // only the future
    .map(([date, label]) => ({ date, label }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Build suggestions: the best nearby Gruv for each upcoming weekend/holiday the
 * user hasn't already RSVP'd to. Returns [{ date, label, event }] (event may be
 * null when nothing's on that day yet — surfaced as "nothing yet, post one?").
 *
 * @param {string}  userId
 * @param {{lat,lon}} coords     viewer location (optional; without it, skips distance)
 * @param {object}  opts         { weeks=5, radiusKm=40, max=5 }
 */
export async function suggestWeekendPlans(userId, coords, { weeks = 5, radiusKm = 40, max = 5 } = {}) {
  const slots = getPlanSlots(weeks);
  if (!slots.length) return [];
  const dates = slots.map(s => s.date);
  const minDate = dates[0], maxDate = dates[dates.length - 1];

  // Pull candidate events across the whole window in one query.
  let events = [];
  try {
    const { data } = await supabase
      .from('events')
      .select('id, title, venue_name, city, event_date, event_time, lat, lon, vibe_count, category, author_id, media, cover_url, price')
      .gte('event_date', minDate)
      .lte('event_date', maxDate)
      .is('deleted_at', null)
      .or('status.is.null,status.neq.cancelled')
      .limit(500);
    events = data || [];
  } catch { events = []; }

  // Exclude events the user already RSVP'd to (don't re-suggest a committed plan).
  let rsvpd = new Set();
  try {
    const { data } = await supabase.from('event_rsvps').select('event_id').eq('user_id', userId);
    rsvpd = new Set((data || []).map(r => r.event_id));
  } catch { /* best-effort */ }

  const pickFor = (date) => {
    const cands = events.filter(e =>
      e.event_date === date &&
      e.author_id !== userId &&        // not your own event
      !rsvpd.has(e.id)                 // not already planned
    );
    if (!cands.length) return null;
    const scored = cands.map(e => {
      const hasGeo = coords?.lat != null && e.lat != null && e.lon != null;
      const dist = hasGeo ? haversine(coords.lat, coords.lon, Number(e.lat), Number(e.lon)) : null;
      return { e, dist };
    }).filter(s => s.dist == null || s.dist <= radiusKm);
    if (!scored.length) return null;
    // Best = closest, then most vibed.
    scored.sort((a, b) => {
      if (a.dist != null && b.dist != null && Math.abs(a.dist - b.dist) > 3) return a.dist - b.dist;
      return (b.e.vibe_count || 0) - (a.e.vibe_count || 0);
    });
    return scored[0].e;
  };

  const used = new Set();

  // Roadmap fallback: when a weekend itself is empty, offer the closest event
  // AROUND it (±3 days) instead of a dead end — clearly labeled with its real
  // date so the suggestion stays honest.
  const pickNear = (date, maxDriftDays = 3) => {
    const target = new Date(`${date}T00:00:00`).getTime();
    const scored = events
      .filter(e => e.author_id !== userId && !rsvpd.has(e.id) && !used.has(e.id))
      .map(e => {
        const t = new Date(`${e.event_date}T00:00:00`).getTime();
        return { e, drift: Math.abs(t - target) / DAY_MS };
      })
      .filter(s => Number.isFinite(s.drift) && s.drift > 0 && s.drift <= maxDriftDays);
    if (!scored.length) return null;
    scored.sort((a, b) => a.drift - b.drift || (b.e.vibe_count || 0) - (a.e.vibe_count || 0));
    return scored[0].e;
  };

  const out = [];
  for (const slot of slots) {
    if (out.length >= max) break;
    const ev = pickFor(slot.date);
    if (ev && !used.has(ev.id)) { used.add(ev.id); out.push({ ...slot, event: ev }); }
    else if (!ev) {
      const near = pickNear(slot.date);
      if (near) used.add(near.id);
      out.push({ ...slot, event: null, nearby: near || null });
    }
  }
  // Prefer slots that actually have a plan (exact or roadmap); keep a couple of
  // truly-empty ones as host nudges.
  const withPlan = out.filter(s => s.event || s.nearby);
  const empty = out.filter(s => !s.event && !s.nearby).slice(0, 2);
  return [...withPlan, ...empty].sort((a, b) => a.date.localeCompare(b.date)).slice(0, max);
}

export default { getPlanSlots, suggestWeekendPlans };
