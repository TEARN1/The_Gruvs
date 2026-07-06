/**
 * tours.js — read helpers for Tours (multi-stop event series).
 *
 * A Tour is one identity (event_series) that owns N real event rows, each with
 * its own date/venue/coords, threaded by events.series_id + tour_stop_index.
 * Creation lives in PostEventModal; this module is the read/consume side that
 * was missing — without it a tour's stops flood the feed as N separate cards.
 */
import { supabase } from './supabase';

/**
 * collapseTourStops — one card per tour in a feed.
 *
 * A tour would otherwise show every stop as its own card. This groups events by
 * series_id and keeps a SINGLE representative stop per tour — the next upcoming
 * stop (or the most recent past one if all are done) — and annotates it so the
 * card can render "Tour · Stop n / N". Non-tour events pass through untouched
 * and original ordering is preserved (the survivor keeps the group's position).
 *
 * @param {Array} events
 * @param {number} [now=Date.now()]
 * @returns {Array} deduped list, tour survivors carrying _tour metadata
 */
export function collapseTourStops(events, now = Date.now()) {
  if (!Array.isArray(events) || events.length === 0) return events || [];

  const groups = new Map();        // series_id -> stop[]
  for (const e of events) {
    if (e?.series_id) {
      const arr = groups.get(e.series_id) || [];
      arr.push(e);
      groups.set(e.series_id, arr);
    }
  }
  if (groups.size === 0) return events; // nothing to collapse

  const dayMs = 86400000;
  const pickRepresentative = (stops) => {
    // Prefer the nearest UPCOMING stop; if none upcoming, the latest past one.
    const withTime = stops.map(s => ({ s, t: s.event_date ? new Date(`${String(s.event_date).slice(0, 10)}T${(s.event_time || '00:00')}:00`).getTime() : null }));
    const upcoming = withTime.filter(x => x.t != null && x.t >= now - dayMs).sort((a, b) => a.t - b.t);
    const chosen = upcoming[0] || withTime.filter(x => x.t != null).sort((a, b) => b.t - a.t)[0] || withTime[0];
    return chosen.s;
  };

  // Precompute survivor + metadata per series
  const meta = new Map();
  for (const [sid, stops] of groups) {
    const rep = pickRepresentative(stops);
    const cities = new Set(stops.map(s => (s.city || '').trim().toLowerCase()).filter(Boolean));
    meta.set(sid, {
      repId: rep.id,
      count: stops.length,
      cityCount: cities.size,
      index: rep.tour_stop_index || null,
    });
  }

  const emitted = new Set();
  const out = [];
  for (const e of events) {
    if (!e?.series_id) { out.push(e); continue; }
    const m = meta.get(e.series_id);
    if (!m || emitted.has(e.series_id)) continue;  // drop the other stops
    if (e.id !== m.repId) continue;                // wait for the representative
    emitted.add(e.series_id);
    out.push({ ...e, _tourStopCount: m.count, _tourCityCount: m.cityCount, _tourStopIndex: m.index, _isTourCard: true });
  }
  return out;
}

/** Fetch a tour's parent record (name, cover, route dates, counts). */
export async function getTour(seriesId) {
  if (!seriesId) return null;
  const { data } = await supabase
    .from('event_series')
    .select('id, creator_id, name, description, cover_url, category, stop_count, city_count, starts_on, ends_on')
    .eq('id', seriesId)
    .maybeSingle();
  return data || null;
}

/** Fetch every stop of a tour, ordered along the route. */
export async function getTourStops(seriesId) {
  if (!seriesId) return [];
  const { data } = await supabase
    .from('events')
    .select('id, title, city, address, lat, lon, event_date, event_time, tour_stop_index, cover_url, cover_image, price, going, capacity')
    .eq('series_id', seriesId)
    .order('tour_stop_index', { ascending: true })
    .order('event_date', { ascending: true });
  return data || [];
}
