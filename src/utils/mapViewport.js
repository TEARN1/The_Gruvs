/**
 * mapViewport — decide WHAT the map should load for where you're looking.
 *
 * The map used to fetch every upcoming event on earth (capped at 300) once, at
 * mount, and zones/reports within 15km of wherever you happened to start. Pan to
 * the next city and you were still looking at the first one's data, and the cap
 * silently truncated. A map that ignores its own viewport isn't a map, it's a
 * picture.
 *
 * So: fetch what's in view, plus a margin, and refetch only when the view
 * actually leaves what we already have. Pure and deterministic — the panning
 * rules are the easiest thing in the map to get subtly wrong, so they're tested
 * rather than eyeballed.
 */

/** Normalise a MapLibre LngLatBounds (or any {west,south,east,north}) to a bbox. */
export function toBbox(bounds) {
  if (!bounds) return null;
  if (typeof bounds.getWest === 'function') {
    return { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() };
  }
  const { west, south, east, north } = bounds;
  if ([west, south, east, north].every((n) => Number.isFinite(n))) return { west, south, east, north };
  return null;
}

/**
 * Grow a bbox by `factor` of its own size on each side. We fetch more than is
 * on screen so a nudge of the map doesn't trigger a round trip — the common
 * case (small pans) is served from data already in hand.
 */
export function padBbox(bbox, factor = 0.5) {
  if (!bbox) return null;
  const w = bbox.east - bbox.west;
  const h = bbox.north - bbox.south;
  return {
    west: bbox.west - w * factor,
    east: bbox.east + w * factor,
    south: Math.max(-90, bbox.south - h * factor),
    north: Math.min(90, bbox.north + h * factor),
  };
}

/** Is `inner` fully inside `outer`? */
export function contains(outer, inner) {
  if (!outer || !inner) return false;
  return (
    inner.west >= outer.west &&
    inner.east <= outer.east &&
    inner.south >= outer.south &&
    inner.north <= outer.north
  );
}

/**
 * Should we go back to the server?
 *
 * Yes when we've never fetched, when the view has moved outside what we fetched,
 * or when the user has zoomed OUT enough that the fetched area no longer covers
 * a meaningful share of the screen. Zooming IN never refetches — we already hold
 * a superset — which is what keeps pinch-zoom free.
 */
export function shouldRefetch(fetchedBbox, viewBbox, { zoomOutRatio = 2 } = {}) {
  if (!viewBbox) return false;
  if (!fetchedBbox) return true;
  if (!contains(fetchedBbox, viewBbox)) return true;

  const fetchedW = fetchedBbox.east - fetchedBbox.west;
  const viewW = viewBbox.east - viewBbox.west;
  // View got much smaller than what we hold (deep zoom-in) — still covered, but
  // we could be showing 300 pins for a whole province in one street. Not a
  // correctness problem, so no refetch; the caller re-queries on zoom-out only.
  if (viewW <= 0 || fetchedW <= 0) return false;
  return viewW / fetchedW > zoomOutRatio;
}

/** Rough metres-per-degree-longitude at a latitude — for a radius fallback. */
const M_PER_DEG_LAT = 111_320;

/**
 * Radius (metres) that covers a bbox from its centre. Some of our endpoints are
 * radius-based (zones_near, reports) rather than bbox-based, so the viewport
 * still drives them instead of a hardcoded 15km.
 */
export function bboxRadiusM(bbox) {
  if (!bbox) return 0;
  const latSpan = bbox.north - bbox.south;
  const lngSpan = bbox.east - bbox.west;
  const midLat = (bbox.north + bbox.south) / 2;
  const hLat = (latSpan / 2) * M_PER_DEG_LAT;
  const hLng = (lngSpan / 2) * M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180);
  return Math.round(Math.sqrt(hLat * hLat + hLng * hLng));
}

/** Centre of a bbox. */
export function bboxCenter(bbox) {
  if (!bbox) return null;
  return { lat: (bbox.north + bbox.south) / 2, lng: (bbox.east + bbox.west) / 2 };
}

export default { toBbox, padBbox, contains, shouldRefetch, bboxRadiusM, bboxCenter };
