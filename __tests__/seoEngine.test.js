/**
 * __tests__/seoEngine.test.js
 * Verification for Runtime SEO, Structured Data (Schema.org), Meta Tags & Deep Links
 */
import { Platform } from 'react-native';
import {
  setEventSeo,
  setProfileSeo,
  setServiceSeo,
  setTournamentSeo,
  clearEventSeo,
} from '../src/utils/seo';

// Mock DOM elements for test environment
class MockElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.attributes = {};
    this.children = [];
    this.textContent = '';
    this.id = '';
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
    if (name === 'id') this.id = String(val);
  }

  getAttribute(name) {
    if (name === 'id') return this.id;
    return this.attributes[name] ?? null;
  }

  appendChild(child) {
    this.children.push(child);
  }

  remove() {
    if (this.parent) {
      const idx = this.parent.children.indexOf(this);
      if (idx !== -1) this.parent.children.splice(idx, 1);
    }
  }

  querySelector(selector) {
    // Basic attribute selector match: meta[attr="key"]
    const attrMatch = selector.match(/meta\[([a-zA-Z0-9_-]+)="([^"]+)"\]/);
    if (attrMatch) {
      const [, attr, val] = attrMatch;
      return this.children.find(c => c.tagName === 'META' && c.attributes[attr] === val) || null;
    }
    const linkMatch = selector.match(/link\[rel="([^"]+)"\](?:\[hreflang="([^"]+)"\])?/);
    if (linkMatch) {
      const [, rel, hreflang] = linkMatch;
      return this.children.find(c => {
        if (c.tagName !== 'LINK' || c.attributes.rel !== rel) return false;
        if (hreflang && c.attributes.hreflang !== hreflang) return false;
        return true;
      }) || null;
    }
    return null;
  }
}

describe('SEO Engine — Schema.org & Meta Tags', () => {
  let headElement;

  beforeAll(() => {
    Platform.OS = 'web';
  });

  beforeEach(() => {
    headElement = new MockElement('head');
    global.document = {
      head: headElement,
      title: 'Initial Title',
      createElement: (tag) => {
        const el = new MockElement(tag);
        el.parent = headElement;
        return el;
      },
      getElementById: (id) => {
        return headElement.children.find(c => c.id === id) || null;
      },
      querySelector: (sel) => headElement.querySelector(sel),
    };
  });

  afterEach(() => {
    clearEventSeo();
  });

  test('setEventSeo generates valid Schema.org/Event and FAQPage JSON-LD', () => {
    const mockEvent = {
      id: 'event_seo_123',
      title: 'Amapiano All-Stars Live',
      description: 'Exclusive Amapiano groove with top DJs in Soweto.',
      event_date: '2026-12-16',
      event_time: '18:00',
      venue_name: 'Zone 6 Venue',
      city: 'Soweto',
      address: 'Diepkloof, Soweto',
      price: 150,
      currency: 'ZAR',
      cover_url: 'https://thegruvs.com/covers/amapiano.jpg',
      dress_code: 'Smart Casual / Drip',
      age_restriction: 18,
      performers: ['Kabza De Small', 'DJ Maphorisa'],
      organizer_name: 'Groove Collective',
    };

    setEventSeo(mockEvent);

    // Check document title
    expect(global.document.title).toContain('Amapiano All-Stars Live');

    // Check Meta Tags
    const ogTitle = global.document.head.querySelector('meta[property="og:title"]')?.getAttribute('content');
    expect(ogTitle).toBe('Amapiano All-Stars Live');

    const ogImage = global.document.head.querySelector('meta[property="og:image"]')?.getAttribute('content');
    expect(ogImage).toBe('https://thegruvs.com/covers/amapiano.jpg');

    const alPackage = global.document.head.querySelector('meta[property="al:android:package"]')?.getAttribute('content');
    expect(alPackage).toBe('com.thegruvs_tearn');

    const alUrl = global.document.head.querySelector('meta[property="al:android:url"]')?.getAttribute('content');
    expect(alUrl).toContain('thegruvs://events/');

    // Check JSON-LD
    const ldScript = global.document.getElementById('gruvs-seo-jsonld');
    expect(ldScript).not.toBeNull();
    const ldData = JSON.parse(ldScript.textContent);

    expect(ldData['@context']).toBe('https://schema.org');
    expect(ldData['@type']).toBe('Event');
    expect(ldData.name).toBe('Amapiano All-Stars Live');
    expect(ldData.location['@type']).toBe('Place');
    expect(ldData.location.name).toBe('Zone 6 Venue');
    expect(ldData.location.address.addressLocality).toBe('Soweto');
    expect(ldData.offers['@type']).toBe('Offer');
    expect(ldData.offers.price).toBe(150);
    expect(ldData.offers.priceCurrency).toBe('ZAR');
    expect(ldData.typicalAgeRange).toBe('18+');
    expect(ldData.performer).toHaveLength(2);
    expect(ldData.performer[0].name).toBe('Kabza De Small');

    // Check FAQ JSON-LD
    const faqScript = global.document.getElementById('gruvs-faq-jsonld');
    expect(faqScript).not.toBeNull();
    const faqData = JSON.parse(faqScript.textContent);
    expect(faqData['@type']).toBe('FAQPage');
    expect(faqData.mainEntity.length).toBeGreaterThan(0);
    expect(faqData.mainEntity[0].name).toContain('Amapiano All-Stars Live');
  });

  test('setProfileSeo generates Schema.org/Person or MusicGroup', () => {
    const artistProfile = {
      id: 'prof_artist_1',
      username: 'deejay_lerato',
      display_name: 'DJ Lerato',
      bio: 'Deep house and Afro-Tech DJ from Johannesburg.',
      avatar_url: 'https://thegruvs.com/avatars/lerato.jpg',
      is_artist: true,
      category: 'dj',
      instagram_url: 'https://instagram.com/djlerato',
    };

    setProfileSeo(artistProfile);

    expect(global.document.title).toContain('DJ Lerato');

    const ldScript = global.document.getElementById('gruvs-seo-jsonld');
    expect(ldScript).not.toBeNull();
    const ldData = JSON.parse(ldScript.textContent);

    expect(ldData['@type']).toBe('MusicGroup');
    expect(ldData.name).toBe('DJ Lerato');
    expect(ldData.description).toContain('Deep house');
    expect(ldData.sameAs).toContain('https://instagram.com/djlerato');
  });

  test('setServiceSeo generates Schema.org/Service for Hustlers and Vendors', () => {
    const service = {
      id: 'srv_braai_1',
      slug: 'shisanyama-braai',
      name: 'Kasi Spit Braai Masters',
      description: 'Gourmet spit braai and township grills for major events.',
      category: 'Catering',
      hourly_rate: 2500,
      price_range: 'R2,500 - R8,000',
      city: 'Midrand',
      provider_name: 'Sipho Braai Co',
    };

    setServiceSeo(service);

    expect(global.document.title).toContain('Kasi Spit Braai Masters');

    const ldScript = global.document.getElementById('gruvs-seo-jsonld');
    expect(ldScript).not.toBeNull();
    const ldData = JSON.parse(ldScript.textContent);

    expect(ldData['@type']).toBe('Service');
    expect(ldData.name).toBe('Kasi Spit Braai Masters');
    expect(ldData.provider['@type']).toBe('LocalBusiness');
    expect(ldData.provider.name).toBe('Sipho Braai Co');
    expect(ldData.provider.priceRange).toBe('R2,500 - R8,000');
    expect(ldData.areaServed.name).toBe('South Africa');
  });

  test('setTournamentSeo generates Schema.org/SportsEvent', () => {
    const match = {
      id: 'match_derby_1',
      title: 'Meadowlands Cup Semi-Final',
      sport: 'Soccer',
      venue_name: 'Nike Football Training Centre',
      city: 'Soweto',
      home_team: 'Soweto Stars',
      away_team: 'Orlando Tigers',
    };

    setTournamentSeo(match);

    expect(global.document.title).toContain('Meadowlands Cup Semi-Final');

    const ldScript = global.document.getElementById('gruvs-seo-jsonld');
    expect(ldScript).not.toBeNull();
    const ldData = JSON.parse(ldScript.textContent);

    expect(ldData['@type']).toBe('SportsEvent');
    expect(ldData.name).toBe('Meadowlands Cup Semi-Final');
    expect(ldData.sport).toBe('Soccer');
    expect(ldData.competitor).toHaveLength(2);
    expect(ldData.competitor[0].name).toBe('Soweto Stars');
  });

  test('clearEventSeo cleanly tears down JSON-LD and resets title', () => {
    setEventSeo({ id: 'test_1', title: 'Test Event' });
    expect(global.document.getElementById('gruvs-seo-jsonld')).not.toBeNull();

    clearEventSeo();
    expect(global.document.getElementById('gruvs-seo-jsonld')).toBeNull();
    expect(global.document.getElementById('gruvs-faq-jsonld')).toBeNull();
    expect(global.document.title).toBe('The Gruvs — Discover what’s on tonight');
  });
});
