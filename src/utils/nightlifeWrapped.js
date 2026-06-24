// ── Nightlife Wrapped ─────────────────────────────────────────────────────────
// A year's worth of verified real-world nights, recapped (#103). Built only from
// Touch Downs — every number is a place you actually were, never inflated. Pure.
//
// Each touch-down: { checked_in_at, venue, city, scene }.

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function topOf(counts) {
  let best = null, n = 0;
  for (const [k, v] of counts) if (v > n || (v === n && best !== null && k < best)) { best = k; n = v; }
  return best ? { name: best, count: n } : null;
}

export function buildWrapped(touchDowns = [], now = Date.now(), opts = {}) {
  const year = opts.year ?? new Date(now).getFullYear();
  const rows = (Array.isArray(touchDowns) ? touchDowns : []).filter((t) => {
    const d = t?.checked_in_at ? new Date(t.checked_in_at) : null;
    return d && !Number.isNaN(d.getTime()) && d.getFullYear() === year;
  });

  const total = rows.length;
  const venues = new Map(), cities = new Map(), scenes = new Map(), months = new Array(12).fill(0);
  for (const t of rows) {
    const v = t.venue || t.title, c = t.city, sc = t.scene || t.category;
    if (v)  venues.set(v, (venues.get(v) || 0) + 1);
    if (c)  cities.set(c, (cities.get(c) || 0) + 1);
    if (sc) scenes.set(sc, (scenes.get(sc) || 0) + 1);
    months[new Date(t.checked_in_at).getMonth()] += 1;
  }

  const busiestIdx = months.reduce((bi, n, i) => (n > months[bi] ? i : bi), 0);
  const busiestMonth = total > 0 ? { name: MONTHS[busiestIdx], count: months[busiestIdx] } : null;

  return {
    year,
    total,
    venueCount: venues.size,
    cityCount: cities.size,
    sceneCount: scenes.size,
    topVenue: topOf(venues),
    topScene: topOf(scenes),
    topCity: topOf(cities),
    busiestMonth,
    headline: total === 0
      ? `Your ${year} is a blank page — go write it`
      : `${total} verified night${total === 1 ? '' : 's'} out in ${year}`,
  };
}

/**
 * A flex-worthy share string for a Wrapped — real verified stats, not posts.
 * The viral artifact: recaps real-world living, not consumption.
 */
export function buildWrappedShareText(wrapped, opts = {}) {
  const w = wrapped || {};
  const url = opts.url || 'https://thegruvs.app';
  if (!w.total) return `Starting my ${w.year || ''} on The Gruvs — real nights, verified.\n${url}`.trim();

  const lines = [`🌃 My ${w.year} Nightlife Wrapped`, `🔥 ${w.total} verified night${w.total === 1 ? '' : 's'} out`];
  const places = [];
  if (w.venueCount) places.push(`${w.venueCount} venue${w.venueCount === 1 ? '' : 's'}`);
  if (w.cityCount)  places.push(`${w.cityCount} cit${w.cityCount === 1 ? 'y' : 'ies'}`);
  if (places.length) lines.push(`📍 ${places.join(' · ')}`);
  if (w.topVenue) lines.push(`🏠 Home base: ${w.topVenue.name}`);
  if (w.topScene) lines.push(`🎶 Scene: ${w.topScene.name}`);
  lines.push('— real nights, verified on The Gruvs');
  lines.push(url);
  return lines.join('\n');
}
