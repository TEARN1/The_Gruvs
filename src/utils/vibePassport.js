// ── The Vibe Passport ─────────────────────────────────────────────────────────
// What a Viber has "collected" by SHOWING UP. Stamps are earned only by real
// Touch Downs, so the whole collection is unfakeable proof you live the life.
// Pure; takes the user's Touch Down history.
//
//   touchDowns: [{ venue_name?, city?, category?, checked_in_at? }]
//
// Returns ranked venues / cities / scenes (most-visited first), the regulars
// (venues you keep returning to), and earned badges.

const GLOBETROTTER_CITIES = 3; // distinct cities for the Globetrotter badge
const REGULAR_VISITS = 3;      // visits to a venue to count as a "regular"

export function buildVibePassport(touchDowns = []) {
  const list = Array.isArray(touchDowns) ? touchDowns : [];

  const venues = new Map();
  const cities = new Map();
  const scenes = new Map();
  const add = (map, key) => {
    const k = typeof key === 'string' ? key.trim() : '';
    if (k) map.set(k, (map.get(k) || 0) + 1);
  };
  for (const td of list) {
    if (!td) continue;
    add(venues, td.venue_name);
    add(cities, td.city);
    add(scenes, td.category);
  }

  const rank = (map) =>
    [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const rankedVenues = rank(venues);
  const rankedCities = rank(cities);

  const badges = [];
  if (list.length >= 1) badges.push({ key: 'first_touchdown', label: 'First Touch Down' });
  if (rankedCities.length >= GLOBETROTTER_CITIES) {
    badges.push({ key: 'globetrotter', label: `Globetrotter · ${rankedCities.length} cities` });
  }

  return {
    totalTouchDowns: list.length,
    venues: rankedVenues,
    cities: rankedCities,
    scenes: rank(scenes),
    regulars: rankedVenues.filter((v) => v.count >= REGULAR_VISITS),
    badges,
  };
}
