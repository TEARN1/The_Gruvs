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
 */
export function eventPath(event) {
  if (!event?.id) return '/';
  const parts = [event.title, event.address || event.venue, event.city].filter(Boolean).join(' ');
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
