// ── Nearest check-in target ───────────────────────────────────────────────────
// "You're near Taboo — Touch Down?" Given the user's saved/upcoming events and
// their current location, find the closest one they're physically AT (within
// range) and happening today — to nudge a Touch Down (the core verified-presence
// action). Pure. Returns the single best target, or null.

const R = 6371; // km
export function haversineKm(aLat, aLon, bLat, bLon) {
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLon = (bLon - aLon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function nearestCheckInTarget(events = [], coords = {}, opts = {}) {
  const { lat, lon } = coords || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const maxKm = opts.maxKm > 0 ? opts.maxKm : 0.5;          // "at the venue" radius
  const today = opts.today || ymd(new Date(opts.now || Date.now()));

  let best = null;
  for (const e of (Array.isArray(events) ? events : [])) {
    if (!e || !Number.isFinite(e.lat) || !Number.isFinite(e.lon)) continue;
    // happening today (or no date = ongoing/place)
    if (e.event_date && String(e.event_date).slice(0, 10) !== today) continue;
    const dist = haversineKm(lat, lon, Number(e.lat), Number(e.lon));
    if (dist > maxKm) continue;
    if (!best || dist < best.distanceKm) {
      best = { event: e, distanceKm: Math.round(dist * 1000) / 1000 };
    }
  }
  return best;
}
