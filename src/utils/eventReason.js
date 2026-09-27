// ── Legible discovery (Truth Protocol) ───────────────────────────────────────
// Tell a Viber WHY a Gruv is on their radar, in one honest line — never a black
// box. Returns the single STRONGEST reason as { icon, label }, or null when
// nothing notable applies. Pure + null-safe so it's cheap to call per card.
//
// Priority — strongest real/social signal first:
//   1. Crew going     — your people are in (the pull that actually moves you)
//   2. Here now       — verified live crowd (the truest, unfakeable signal)
//   3. Rising near you — real buzz momentum
//   4. Distance       — it's close
//   5. Your scene     — taste match (self-declared interests only)
//   6. Timing         — tonight / this weekend

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function pickEventReason(event, ctx = {}) {
  if (!event) return null;
  const {
    userLat = null,
    userLon = null,
    userInterests = [],
    crewGoingCount = 0,
    now = Date.now(),
  } = ctx;

  // 1. Crew — the strongest social pull
  if (crewGoingCount > 0) {
    return { icon: 'users', label: `${crewGoingCount} of your Crew going` };
  }

  // 2. Here now — verified live presence (the truest signal)
  const here = Number(event.here_count ?? event.touchdown_count ?? 0);
  if (here >= 5) {
    return { icon: 'map-pin', label: `${here} here now` };
  }

  // 3. Rising — real buzz momentum
  const buzz = (Number(event.vibe_count) || 0) + (Number(event.going) || 0);
  if (buzz >= 30) {
    return { icon: 'trending-up', label: 'Rising near you' };
  }

  // 4. Proximity — it's close
  if (userLat != null && userLon != null && event.lat != null && event.lon != null) {
    const km = haversineKm(Number(userLat), Number(userLon), Number(event.lat), Number(event.lon));
    if (Number.isFinite(km) && km <= 3) {
      return { icon: 'navigation', label: km < 1 ? 'Right by you' : `${km.toFixed(1)}km away` };
    }
  }

  // 5. Your scene — self-declared taste match (never inferred from demographics)
  if (Array.isArray(userInterests) && userInterests.length) {
    const tags = Array.isArray(event.tags) ? event.tags : [];
    if (userInterests.includes(event.category) || tags.some((t) => userInterests.includes(t))) {
      return { icon: 'heart', label: 'Your scene' };
    }
  }

  // 6. Timing — tonight / this weekend
  if (event.event_date) {
    const start = new Date(`${event.event_date}T${event.event_time || '20:00'}`).getTime();
    if (Number.isFinite(start)) {
      const h = (start - now) / 3600000;
      if (h >= 0 && h <= 8) return { icon: 'clock', label: 'Tonight' };
      if (h > 8 && h <= 72) return { icon: 'clock', label: 'This weekend' };
    }
  }

  return null;
}
