/**
 * seo — make a Gruv legible to Google and to link previews.
 *
 * The app is a single-page app: every URL serves the same HTML shell, so search
 * engines and WhatsApp/Instagram link unfurlers see a generic page for EVERY
 * event. Google can execute JS, so writing real Event structured data into the
 * DOM when an event opens is enough to earn rich results ("Events" cards with
 * date, venue and price right in the search listing) — free, keyless, no SSR.
 *
 * Web-only and fully guarded: on native, or if anything is missing, it no-ops.
 * Nothing here may ever break rendering an event.
 */
import { Platform } from 'react-native';
import { eventInstant } from './tz';
import { eventUrl } from './slug';

const LD_ID = 'gruvs-event-jsonld';
const SITE = 'https://thegruvs.com';

const canDom = () =>
  Platform.OS === 'web' && typeof document !== 'undefined' && !!document.head;

const setMeta = (attr, key, content) => {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', String(content).slice(0, 300));
};

/** ISO-8601 instant for the event's start, in the VENUE's zone. */
const startIso = (event) => {
  const ms = eventInstant(event);
  return ms == null ? null : new Date(ms).toISOString();
};

/**
 * Publish schema.org/Event structured data + share meta for one event.
 * Call when an event screen opens; call clearEventSeo() when it closes.
 */
export function setEventSeo(event) {
  if (!canDom() || !event?.id) return;
  try {
    const title = event.title || 'A Gruv';
    const desc = (event.description || `${title} — find it on The Gruvs.`).slice(0, 300);
    // Human, readable URL — Google reads it, and so does the person deciding
    // whether to tap a link forwarded into a WhatsApp group.
    const url = eventUrl(event, SITE);
    const image = event.cover_url || event.cover_image || `${SITE}/icon-512.png`;
    const start = startIso(event);

    document.title = `${title} · The Gruvs`;
    setMeta('name', 'description', desc);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', 'article');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:image', image);

    // Only claim what we actually know — a wrong/invented field in structured
    // data is worse than an absent one (Google penalises mismatched markup).
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: title,
      description: desc,
      url,
      image: [image],
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    };
    if (start) ld.startDate = start;
    if (event.address || event.city) {
      ld.location = {
        '@type': 'Place',
        name: event.address || event.city,
        address: {
          '@type': 'PostalAddress',
          streetAddress: event.address || undefined,
          addressLocality: event.city || undefined,
        },
      };
    }
    if (event.price != null && Number(event.price) >= 0) {
      ld.offers = {
        '@type': 'Offer',
        price: Number(event.price),
        priceCurrency: event.currency || 'ZAR',
        availability: 'https://schema.org/InStock',
        url: event.ticket_url || url,
      };
    }

    let script = document.getElementById(LD_ID);
    if (!script) {
      script = document.createElement('script');
      script.id = LD_ID;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(ld);
  } catch {
    /* SEO must never break the page */
  }
}

/** Remove event-specific markup when leaving the screen. */
export function clearEventSeo() {
  if (!canDom()) return;
  try {
    document.getElementById(LD_ID)?.remove();
    document.title = 'The Gruvs — Discover what’s on tonight';
  } catch { /* no-op */ }
}

export default { setEventSeo, clearEventSeo };
