/**
 * masonry — pure helpers for the Pinterest-style staggered event grid.
 *
 * Each event gets a deterministic aspect ratio derived from its id (so the
 * layout is stable across renders — no jumping), and items are packed into
 * the currently-shortest column, giving the staggered "layers" look.
 */

// Deterministic tiny hash — stable per event id.
export function hashId(id) {
  const s = String(id || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Varied card aspects (height = width * aspect). Posters lean tall.
const ASPECTS = [0.75, 0.95, 1.15, 1.35];
const POSTER_ASPECTS = [1.25, 1.4, 1.55];

export function aspectFor(event) {
  const pool = event?.poster_mode ? POSTER_ASPECTS : ASPECTS;
  return pool[hashId(event?.id) % pool.length];
}

/**
 * Pack events into `columns` staggered columns, always dropping the next item
 * into the shortest column (classic masonry). Returns an array of columns,
 * each a list of { event, aspect }.
 */
export function packMasonry(events = [], { columns = 2 } = {}) {
  const cols = Array.from({ length: Math.max(1, columns) }, () => ({ h: 0, items: [] }));
  for (const event of events) {
    if (!event?.id) continue;
    const aspect = aspectFor(event);
    let target = cols[0];
    for (const c of cols) if (c.h < target.h) target = c;
    target.items.push({ event, aspect });
    target.h += aspect + 0.18; // + fixed footprint for the caption strip
  }
  return cols.map(c => c.items);
}

/** First usable image URL for an event card (same chain the feed cards use). */
export function eventImageUrl(e = {}) {
  const m = e.media?.length ? e.media : (e.media_urls || []).map(u => ({ url: u }));
  const first = m.find(x => x?.url && !/\.(mp4|mov|m4v|webm)/i.test(x.url));
  return first?.url || e.cover_url || e.cover_image || e.image_url || null;
}

export default { packMasonry, aspectFor, hashId, eventImageUrl };
