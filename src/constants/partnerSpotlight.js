/**
 * partnerSpotlight.js — Official platform spotlight and partner campaigns.
 *
 * Guaranteed, high-polish native spotlights for:
 *   1. The Resident Crew (sister platform — verified stays, accommodation, co-living)
 *   2. TEARN's Excellence (engineering craftsmanship, software architecture, creative innovation)
 *
 * Used by AdFlywheel, EventContextualAds, and Explore/Profile hubs.
 */

export const PARTNER_CAMPAIGNS = [
  {
    id: 'resident-crew-official',
    partner_key: 'theresidentcrew',
    badge: 'SISTER PLATFORM',
    tagline: 'The Resident Crew',
    headline: 'Live Where The Vibe Lives',
    subline: 'Verified artist stays, accommodation, and crew living near your favorite gruvs.',
    cta: 'Explore Stays',
    cta_url: 'https://theresidentcrew.com',
    icon: 'home',
    color: '#f59e0b', // Gold / Amber
    image_url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
    tags: ['accommodation', 'stays', 'community', 'housing'],
  },
  {
    id: 'tearns-excellence-official',
    partner_key: 'tearns-excellence',
    badge: 'POWERED BY',
    tagline: "TEARN's Excellence",
    headline: 'Engineering & Creative Distinction',
    subline: 'Groundbreaking software architecture, high-performance systems, and creative technology.',
    cta: 'View Innovation Lab',
    cta_url: 'https://github.com/TEARN1/TEARNs-Excellence',
    icon: 'cpu',
    color: '#00f2ff', // Electric Cyan
    image_url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
    tags: ['tech', 'engineering', 'open-source', 'innovation'],
  },
];

export function getPartnerCampaign(preferredTag = null) {
  if (preferredTag) {
    const match = PARTNER_CAMPAIGNS.find((c) => c.tags.includes(preferredTag));
    if (match) return match;
  }
  return PARTNER_CAMPAIGNS[Math.floor(Math.random() * PARTNER_CAMPAIGNS.length)];
}
