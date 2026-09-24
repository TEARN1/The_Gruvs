/**
 * slug — human, shareable, indexable event URLs.
 *
 *   /event/8f3c1a9e-...-c2                          (what a crawler sees now)
 *   /e/amapiano-sunset-konka-soweto-8f3c1a          (what it should see)
 *
 * Google reads the URL. So does a person deciding whether to tap a link someone
 * forwarded them in a WhatsApp group — which is exactly how The Gruvs spreads.
 * The id stays on the end, so the URL is still unambiguous and can never collide.
 */

const deaccent = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "Amapiano Sunset!" → "amapiano-sunset" */
export function slugify(text, maxLen = 60) {
  const s = deaccent(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length <= maxLen) return s;
  // Cut on a word boundary — never leave a chopped-off half-word in a URL.
  return s.slice(0, maxLen).replace(/-[^-]*$/, '').replace(/-+$/, '');
}

/**
 * The canonical path for an event. Falls back gracefully: an event with no
 * title still gets a valid, unique URL rather than a broken one.
 *
 * Was `event.address || event.venue` — `venue` (bare) is never a persisted
 * event column (it only exists client-side on tour-stop drafts in
 * PostEventModal), so every URL silently lost the venue and fell straight to
 * `address`. Two real consequences: `venue_name` (the field actually shown
 * everywhere — EventDetailScreen, MapEventPreview) never made it into a URL at
 * all, and poster-mode events write the literal placeholder string
 * `'See poster'` into `address` when no address is entered — which was
 * leaking into event URLs as `/e/some-title-see-poster-8f3c1a9e`.
 */
const PLACEHOLDER_ADDRESS = 'See poster';

export function eventPath(event) {
  if (!event?.id) return '/';
  const address = event.address && event.address !== PLACEHOLDER_ADDRESS ? event.address : null;
  const parts = [event.title, event.venue_name || address, event.city].filter(Boolean).join(' ');
  const words = slugify(parts);
  const short = String(event.id).replace(/-/g, '').slice(0, 8);
  return words ? `/e/${words}-${short}` : `/e/${short}`;
}

/** Pull the event id back out of a slug path. */
export function idFromPath(path) {
  const m = String(path || '').match(/\/e\/(?:.*-)?([a-f0-9]{8,})$/i);
  return m ? m[1] : null;
}

export const eventUrl = (event, origin = 'https://thegruvs.com') => `${origin}${eventPath(event)}`;

export default { slugify, eventPath, idFromPath, eventUrl };
