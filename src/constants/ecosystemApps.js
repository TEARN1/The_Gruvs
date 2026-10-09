/**
 * Ecosystem Apps — Single source of truth for the 3-pillar unified ecosystem:
 *  1. The Gruvs (Nightlife, Events, Culture, Truth Protocol)
 *  2. Excellency Academy (Engineering Craftsmanship, Architecture, Education)
 *  3. The Resident Crew (Verified Stays, Accommodation, Co-living)
 *
 * All three platforms share the same high-performance DigitalOcean V-Gruvs deployment,
 * Supabase auth/data infrastructure, and single-sign-on credentials.
 */

export const ECOSYSTEM_APPS = [
  {
    id: 'thegruvs',
    name: 'The Gruvs',
    domain: 'thegruvs.com',
    url: 'https://thegruvs.com',
    icon: 'zap',
    badge: '👑',
    tagline: 'Events, Nightlife & Social Culture',
    color: '#00f2ff',
  },
  {
    id: 'excellency',
    name: 'Excellency Academy',
    domain: 'excellencyacs.com',
    url: 'https://excellencyacs.com',
    icon: 'cpu',
    badge: '🏛️',
    tagline: 'Engineering Craftsmanship & Innovation',
    color: '#3b82f6',
  },
  {
    id: 'theresident',
    name: 'The Resident Crew',
    domain: 'theresidentcrew.com',
    url: 'https://theresidentcrew.com',
    icon: 'home',
    badge: '🏡',
    tagline: 'Verified Stays & Safe Co-living',
    color: '#fbbf24',
  },
];

export const ECOSYSTEM_DOMAINS = [
  'thegruvs.com',
  'www.thegruvs.com',
  'thegruvs.app',
  'excellencyacs.com',
  'www.excellencyacs.com',
  'theresidentcrew.com',
  'www.theresidentcrew.com',
];

export default { ECOSYSTEM_APPS, ECOSYSTEM_DOMAINS };
