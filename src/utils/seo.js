/**
 * seo — Search Engine Optimization, Rich Structured Data & Link Previews for The Gruvs.
 *
 * Implements Google-compliant Schema.org JSON-LD structured data and Open Graph /
 * Twitter / App Links meta tags for:
 * 1. Events (schema.org/Event with performers, offers, status, age range, FAQ)
 * 2. Profiles / DJs / Artists (schema.org/Person or schema.org/MusicGroup)
 * 3. 28 Hustler & Event Services (schema.org/Service & schema.org/LocalBusiness)
 * 4. Sports & Tournaments (schema.org/SportsEvent)
 * 5. App Indexing & Deep Linking (Android App Links, Google Play App meta)
 *
 * Web-only & fully guarded: on native, or when DOM is absent, all functions cleanly no-op.
 * SEO operations will never throw or disrupt application rendering.
 */
import { Platform } from 'react-native';
import { eventInstant } from './tz';
import { eventUrl } from './slug';

const LD_ID = 'gruvs-seo-jsonld';
const LD_FAQ_ID = 'gruvs-faq-jsonld';
const SITE = 'https://thegruvs.com';
const PLAY_PACKAGE = 'com.thegruvs_tearn';
const APP_NAME = 'The Gruvs';

const canDom = () =>
  Platform.OS === 'web' && typeof document !== 'undefined' && !!document.head;

/** Helper to set or create a meta tag in document.head */
const setMeta = (attr, key, content) => {
  if (!canDom() || content == null) return;
  const str = String(content).trim();
  if (!str) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', str.slice(0, 500));
};

/** Helper to set or create link tags (e.g. canonical, alternate) */
const setLink = (rel, href, extra = {}) => {
  if (!canDom() || !href) return;
  let selector = `link[rel="${rel}"]`;
  if (extra.hreflang) selector += `[hreflang="${extra.hreflang}"]`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  for (const [k, v] of Object.entries(extra)) {
    el.setAttribute(k, v);
  }
};

/** Injects or updates a JSON-LD script element in document.head */
const injectJsonLd = (elementId, dataObj) => {
  if (!canDom() || !dataObj) return;
  try {
    let script = document.getElementById(elementId);
    if (!script) {
      script = document.createElement('script');
      script.id = elementId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(dataObj);
  } catch {
    /* Silent catch: SEO must never break runtime */
  }
};

/** Removes an injected JSON-LD script by ID */
const removeJsonLd = (elementId) => {
  if (!canDom()) return;
  try {
    document.getElementById(elementId)?.remove();
  } catch {
    /* no-op */
  }
};

/** ISO-8601 instant for event start */
const startIso = (event) => {
  const ms = eventInstant(event);
  return ms == null ? null : new Date(ms).toISOString();
};

/** Calculate ISO-8601 end time if available, otherwise default duration */
const endIso = (event, startMs) => {
  if (!event) return null;
  if (event.end_date) {
    try {
      const endD = new Date(`${event.end_date}T${event.end_time || '23:59:00'}`);
      if (!isNaN(endD.getTime())) return endD.toISOString();
    } catch {}
  }
  if (startMs) {
    // Default 5-hour duration for events
    return new Date(startMs + 5 * 3600000).toISOString();
  }
  return null;
};

/**
 * Maps event status string to official Schema.org EventStatusType
 */
const getEventStatus = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('cancel')) return 'https://schema.org/EventCancelled';
  if (s.includes('postpone')) return 'https://schema.org/EventPostponed';
  if (s.includes('resched')) return 'https://schema.org/EventRescheduled';
  if (s.includes('moved')) return 'https://schema.org/EventMovedOnline';
  return 'https://schema.org/EventScheduled';
};

/**
 * Extracts performer objects (DJs, artists, hosts) from event data
 */
const extractPerformers = (event) => {
  const performers = [];
  const seen = new Set();

  const add = (name, type = 'Person') => {
    const clean = String(name || '').trim();
    if (!clean || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    performers.push({
      '@type': type,
      name: clean,
    });
  };

  if (Array.isArray(event.performers)) {
    event.performers.forEach((p) => {
      if (typeof p === 'string') add(p);
      else if (p && p.name) add(p.name, p.type || 'Person');
    });
  }

  if (Array.isArray(event.lineup)) {
    event.lineup.forEach((item) => {
      if (typeof item === 'string') add(item);
      else if (item && (item.name || item.title)) add(item.name || item.title);
    });
  }

  if (Array.isArray(event.schedule)) {
    event.schedule.forEach((slot) => {
      if (slot && (slot.artist || slot.performer)) {
        add(slot.artist || slot.performer);
      }
    });
  }

  return performers.slice(0, 15);
};

// ── 1. Publish Schema.org/Event + Deep Linking Meta ─────────────────────────
/**
 * Publish schema.org/Event structured data + rich share meta for an event.
 * Call when an event screen opens; call clearEventSeo() when it closes.
 */
export function setEventSeo(event) {
  if (!canDom() || !event?.id) return;
  try {
    const title = event.title || 'A Gruv';
    const desc = (event.description || `${title} — find it on The Gruvs.`).slice(0, 300);
    const url = eventUrl(event, SITE);
    const image = event.cover_url || event.cover_image || (Array.isArray(event.media_urls) && event.media_urls[0]) || `${SITE}/icon-512.png`;
    const startMs = eventInstant(event);
    const start = startIso(event);
    const end = endIso(event, startMs);
    const slug = url.split('/events/')[1] || event.id;

    // Document Title & Core Meta
    document.title = `${title} · The Gruvs`;
    setMeta('name', 'description', desc);
    setLink('canonical', url);
    setLink('alternate', url, { hreflang: 'en-ZA' });
    setLink('alternate', url, { hreflang: 'x-default' });

    // Open Graph
    setMeta('property', 'og:site_name', APP_NAME);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:locale', 'en_ZA');

    // Twitter Card
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:site', '@thegruvs');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:image', image);

    // Android App Links & Deep Linking Meta
    setMeta('property', 'al:android:url', `thegruvs://events/${slug}`);
    setMeta('property', 'al:android:package', PLAY_PACKAGE);
    setMeta('property', 'al:android:app_name', APP_NAME);
    setMeta('property', 'al:web:url', url);
    setMeta('name', 'twitter:app:name:googleplay', APP_NAME);
    setMeta('name', 'twitter:app:id:googleplay', PLAY_PACKAGE);
    setMeta('name', 'twitter:app:url:googleplay', `thegruvs://events/${slug}`);

    // Regional Geo Meta
    setMeta('name', 'geo.region', 'ZA');
    if (event.city) setMeta('name', 'geo.placename', event.city);

    // Build Schema.org/Event
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: title,
      description: desc,
      url,
      image: [image],
      eventStatus: getEventStatus(event.status),
      eventAttendanceMode: event.is_online
        ? 'https://schema.org/OnlineEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode',
      inLanguage: 'en-ZA',
    };

    if (start) ld.startDate = start;
    if (end) ld.endDate = end;
    if (event.door_time || event.doors_open) ld.doorTime = event.door_time || event.doors_open;

    // Venue / Location with Geo Coordinates
    if (event.venue_name || event.address || event.city) {
      ld.location = {
        '@type': 'Place',
        name: event.venue_name || event.address || event.city,
        address: {
          '@type': 'PostalAddress',
          streetAddress: event.address || undefined,
          addressLocality: event.city || 'South Africa',
          addressCountry: 'ZA',
        },
      };
      if (event.lat && event.lon) {
        ld.location.geo = {
          '@type': 'GeoCoordinates',
          latitude: Number(event.lat),
          longitude: Number(event.lon),
        };
      }
    }

    // Age Policy
    if (event.age_restriction || event.age_min) {
      ld.typicalAgeRange = `${event.age_restriction || event.age_min}+`;
    }

    // Performers & DJs
    const performers = extractPerformers(event);
    if (performers.length > 0) {
      ld.performer = performers;
    }

    // Organizer
    ld.organizer = {
      '@type': 'Organization',
      name: event.organizer_name || event.host_name || APP_NAME,
      url: SITE,
    };

    // Ticket Offers & Pricing
    if (event.price === 'FREE' || event.price === 0) {
      ld.isAccessibleForFree = true;
      ld.offers = {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'ZAR',
        availability: 'https://schema.org/InStock',
        url,
      };
    } else if (event.price != null && !isNaN(Number(event.price))) {
      ld.offers = {
        '@type': 'Offer',
        price: Number(event.price),
        priceCurrency: event.currency || 'ZAR',
        availability: 'https://schema.org/InStock',
        url: event.ticket_url || url,
      };
    }

    injectJsonLd(LD_ID, ld);

    // Auto-generate Event FAQ Schema
    const venueName = event.venue_name || event.city || 'the venue';
    const dateFormatted = event.event_date || 'the scheduled date';
    const dressCode = event.dress_code || event.dressCode || 'Smart Casual';
    const faqData = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: `When and where is ${title}?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: `${title} is scheduled for ${dateFormatted} at ${venueName}. Directions and ticketing are available on The Gruvs.`,
          },
        },
        {
          '@type': 'Question',
          name: `How much are tickets for ${title}?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: event.price === 'FREE' || event.price === 0
              ? `${title} is free entry with RSVP.`
              : `Tickets for ${title} are ${event.price ? `R${event.price}` : 'available online through The Gruvs'}.`,
          },
        },
        {
          '@type': 'Question',
          name: `What is the dress code for ${title}?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: `The recommended dress code for ${title} is ${dressCode}.`,
          },
        },
      ],
    };
    injectJsonLd(LD_FAQ_ID, faqData);
  } catch {
    /* SEO must never break the page */
  }
}

// ── 2. Publish Schema.org/Person or MusicGroup for Profiles ─────────────────
/**
 * Publish structured data for DJs, performers, and organizers.
 */
export function setProfileSeo(profile) {
  if (!canDom() || !profile) return;
  try {
    const name = profile.display_name || profile.username || 'Gruvs Member';
    const bio = profile.bio || `${name}'s profile and upcoming sets on The Gruvs.`;
    const url = `${SITE}/profile/${profile.username || profile.id}`;
    const avatar = profile.avatar_url || `${SITE}/icon-512.png`;
    const isArtist = !!profile.is_artist || profile.category === 'dj' || profile.role === 'performer';

    document.title = `${name} · The Gruvs`;
    setMeta('name', 'description', bio.slice(0, 200));
    setLink('canonical', url);

    setMeta('property', 'og:title', name);
    setMeta('property', 'og:description', bio);
    setMeta('property', 'og:image', avatar);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', 'profile');

    const ld = {
      '@context': 'https://schema.org',
      '@type': isArtist ? 'MusicGroup' : 'Person',
      name,
      description: bio,
      image: avatar,
      url,
      sameAs: [
        profile.instagram_url,
        profile.twitter_url,
        profile.spotify_url,
      ].filter(Boolean),
    };

    injectJsonLd(LD_ID, ld);
    removeJsonLd(LD_FAQ_ID);
  } catch {
    /* silent catch */
  }
}

// ── 3. Publish Schema.org/Service for Hustlers & Business Vendors ────────────
/**
 * Publish structured data for the 28 event business categories.
 */
export function setServiceSeo(service) {
  if (!canDom() || !service) return;
  try {
    const title = service.name || service.title || 'Event Service';
    const desc = service.description || `${title} — event service available on The Gruvs.`;
    const url = `${SITE}/services/${service.slug || service.id}`;
    const image = service.cover_image || service.cover_url || `${SITE}/og-default.jpg`;

    document.title = `${title} · Event Services on The Gruvs`;
    setMeta('name', 'description', desc.slice(0, 200));
    setLink('canonical', url);

    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:url', url);

    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: title,
      description: desc,
      serviceType: service.category || 'Event Service',
      provider: {
        '@type': 'LocalBusiness',
        name: service.provider_name || title,
        image,
        priceRange: service.price_range || 'R500 - R10,000',
        address: {
          '@type': 'PostalAddress',
          addressLocality: service.city || 'Johannesburg',
          addressCountry: 'ZA',
        },
      },
      areaServed: {
        '@type': 'Country',
        name: 'South Africa',
      },
      offers: {
        '@type': 'Offer',
        price: service.hourly_rate || service.rate || '0',
        priceCurrency: 'ZAR',
        availability: 'https://schema.org/InStock',
        url,
      },
    };

    injectJsonLd(LD_ID, ld);
    removeJsonLd(LD_FAQ_ID);
  } catch {
    /* silent catch */
  }
}

// ── 4. Publish Schema.org/SportsEvent for Kasi Soccer & Tournaments ─────────
export function setTournamentSeo(tournament) {
  if (!canDom() || !tournament) return;
  try {
    const title = tournament.title || tournament.name || 'Sports Derby';
    const desc = tournament.description || `${title} — Live community sports on The Gruvs.`;
    const url = `${SITE}/sports/${tournament.slug || tournament.id}`;
    const image = tournament.cover_url || `${SITE}/og-default.jpg`;

    document.title = `${title} · Live Tournament | The Gruvs`;
    setMeta('name', 'description', desc.slice(0, 200));
    setLink('canonical', url);

    const ld = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: title,
      description: desc,
      sport: tournament.sport || 'Soccer',
      url,
      image: [image],
      location: {
        '@type': 'Place',
        name: tournament.venue_name || tournament.location || 'Local Grounds',
        address: {
          '@type': 'PostalAddress',
          addressLocality: tournament.city || 'South Africa',
          addressCountry: 'ZA',
        },
      },
    };

    if (tournament.home_team && tournament.away_team) {
      ld.competitor = [
        { '@type': 'SportsTeam', name: tournament.home_team },
        { '@type': 'SportsTeam', name: tournament.away_team },
      ];
    }

    injectJsonLd(LD_ID, ld);
    removeJsonLd(LD_FAQ_ID);
  } catch {
    /* silent catch */
  }
}

// ── 5. Teardown & Reset ─────────────────────────────────────────────────────
/** Remove event-specific markup when leaving the screen */
export function clearEventSeo() {
  if (!canDom()) return;
  try {
    removeJsonLd(LD_ID);
    removeJsonLd(LD_FAQ_ID);
    document.title = 'The Gruvs — Discover what’s on tonight';
  } catch {
    /* no-op */
  }
}

export const clearSeo = clearEventSeo;

export default {
  setEventSeo,
  setProfileSeo,
  setServiceSeo,
  setTournamentSeo,
  clearEventSeo,
  clearSeo,
};
