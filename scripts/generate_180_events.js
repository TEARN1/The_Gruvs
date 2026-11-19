/**
 * generate_180_events.js
 * Generates SQL seed file for 180 South African events across 6 months:
 * December 2026, January 2027, February 2027, March 2027, April 2027, May 2027.
 * Each month has exactly:
 * - 20 Big Events (Festivals, Amapiano, Afro-Tech, Hip-Hop, Concerts, Culture, Beach & Rooftop Parties)
 * - 10 Business Events (Tech Summits, Mining/Energy, FinTech, VC/SME, Real Estate, Leadership Forums)
 */

const fs = require('fs');
const path = require('path');

const AUTHOR_ID = 'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c';

const VENUES = {
  sandton_cc: { name: 'Sandton Convention Centre', address: '161 Maude Street, Sandton', city: 'Johannesburg', lat: -26.1065, lon: 28.0531 },
  gallagher: { name: 'Gallagher Convention Centre', address: '19 Richards Drive, Midrand', city: 'Midrand', lat: -26.0028, lon: 28.1287 },
  cticc: { name: 'Cape Town International Convention Centre (CTICC)', address: '1 Lower Long Street, Cape Town', city: 'Cape Town', lat: -33.9161, lon: 18.4285 },
  durban_icc: { name: 'Durban ICC', address: '45 Bram Fischer Road, Durban Central', city: 'Durban', lat: -29.8524, lon: 31.0286 },
  sunbet_arena: { name: 'SunBet Arena at Time Square', address: '209 Aramist Avenue, Menlyn, Pretoria', city: 'Pretoria', lat: -25.7877, lon: 28.2798 },
  cabo_beach: { name: 'Cabo Beach Club', address: '12 S Arm Road, Victoria & Alfred Waterfront, Cape Town', city: 'Cape Town', lat: -33.9022, lon: 18.4243 },
  altitude_beach: { name: 'Altitude Beach', address: 'Fourways Mall, Ruby Close, Fourways', city: 'Johannesburg', lat: -26.0175, lon: 28.0069 },
  zone6: { name: 'Zone 6 Venue', address: 'Warehouse 28, Blackwood Street, Diepkloof Zone 6, Soweto', city: 'Soweto', lat: -26.2483, lon: 27.9351 },
  konka: { name: 'Konka Soweto', address: 'Modjadji Street, Pimville Zone 1, Soweto', city: 'Soweto', lat: -26.2736, lon: 27.8972 },
  fnb_stadium: { name: 'FNB Stadium', address: 'Soccer City Avenue, Nasrec', city: 'Johannesburg', lat: -26.2348, lon: 27.9824 },
  kirstenbosch: { name: 'Kirstenbosch National Botanical Garden', address: 'Rhodes Drive, Newlands, Cape Town', city: 'Cape Town', lat: -33.9877, lon: 18.4326 },
  the_marc: { name: 'The Marc Sandton', address: '129 Rivonia Road, Sandton', city: 'Johannesburg', lat: -26.1042, lon: 28.0558 },
  the_station: { name: 'The Station Parkhurst', address: '24 4th Avenue, Parkhurst', city: 'Johannesburg', lat: -26.1384, lon: 28.0163 },
  kyalami: { name: 'Kyalami Grand Prix Circuit', address: 'R55 & Allandale Road, Kyalami, Midrand', city: 'Midrand', lat: -25.9981, lon: 28.0689 },
  spier: { name: 'Spier Wine Farm', address: 'R310 Baden Powell Drive, Stellenbosch', city: 'Stellenbosch', lat: -33.9723, lon: 18.7825 },
  eyadini: { name: 'Eyadini Lounge', address: '3 Peace Haven Place, Umlazi, Durban', city: 'Durban', lat: -29.9675, lon: 30.8872 },
  maxs_lifestyle: { name: 'Max\'s Lifestyle Village', address: 'V1328 Mbe Road, Umlazi, Durban', city: 'Durban', lat: -29.9691, lon: 30.8856 },
  shimmy: { name: 'Shimmy Beach Club', address: '12 S Arm Road, V&A Waterfront, Cape Town', city: 'Cape Town', lat: -33.9038, lon: 18.4293 },
  boardwalk: { name: 'The Boardwalk Gqeberha', address: 'Beach Road, Summerstrand, Gqeberha', city: 'Gqeberha', lat: -33.9858, lon: 25.6586 },
  menlyn_maine: { name: 'Menlyn Maine Central Square', address: 'Amarand Avenue, Waterkloof Glen, Pretoria', city: 'Pretoria', lat: -25.7865, lon: 28.2812 },
  rosebank_zone: { name: 'The Zone @ Rosebank', address: '177 Oxford Road, Rosebank', city: 'Johannesburg', lat: -26.1465, lon: 28.0416 },
  constitution_hill: { name: 'Constitution Hill Human Rights Precinct', address: '11 Kotze Street, Braamfontein', city: 'Johannesburg', lat: -26.1896, lon: 28.0425 },
  grand_africa: { name: 'Grand Africa Café & Beach', address: 'Haul Road, V&A Waterfront, Granger Bay, Cape Town', city: 'Cape Town', lat: -33.9018, lon: 18.4191 },
  moses_mabhida: { name: 'Moses Mabhida Stadium Peoples Park', address: '44 Isaiah Ntshangase Road, Stamford Hill, Durban', city: 'Durban', lat: -29.8291, lon: 31.0305 },
  waterfall_park: { name: 'Waterfall City Park', address: 'Corner Magwa & Lone Creek Cres, Waterfall City, Midrand', city: 'Midrand', lat: -26.0152, lon: 28.1091 },
  tigers_milk_kloof: { name: 'Tiger\'s Milk Kloof Street', address: '55 Kloof Street, Gardens, Cape Town', city: 'Cape Town', lat: -33.9298, lon: 18.4112 }
};

const MUSIC_IMAGES = [
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80'
];

const BIZ_IMAGES = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80'
];

// Helper to escape SQL single quotes
function sqlEsc(str) {
  if (!str) return "''";
  return `'${String(str).replace(/'/g, "''")}'`;
}

// ── DATA DEFINITIONS FOR THE 6 MONTHS ───────────────────────────────

const MONTH_DATA = [
  // ── DECEMBER 2026 ──────────────────────────────────────────────────
  {
    month: '2026-12',
    name: 'December 2026',
    bigEvents: [
      {
        title: 'Ke Dezemba Amapiano Explosive Launch',
        desc: 'Kick off the iconic Ke Dezemba holiday season with a powerhouse Amapiano lineup featuring South Africa\'s premier producers and DJs. Massive sound, festival lighting, outdoor dance floor, and high-energy VIP table packages.',
        venue: VENUES.zone6,
        date: '2026-12-04',
        time: '18:00',
        price: '{"early_bird":"150","general":"250","vip":"650","table":"4500"}',
        capacity: 4000,
        tags: ['amapiano', 'festivals', 'nightlife', 'ke dezemba', 'soweto']
      },
      {
        title: 'Shimmy Sunset White & Gold Rave',
        desc: 'Experience pure Atlantic bliss at Shimmy Beach Club with world-class Afro-tech and deep house beats right by the water. Strictly white and gold summer chic attire. Premium cocktails and signature beach cabana bottle service.',
        venue: VENUES.shimmy,
        date: '2026-12-05',
        time: '15:00',
        price: 'From R300',
        capacity: 1800,
        tags: ['afro-tech', 'beach club', 'cape town', 'summer', 'nightlife']
      },
      {
        title: 'Altitude Beach Dezemba Fest',
        desc: 'Fourways turns into the ultimate summer oasis. Pool party vibes, live percussionists, top amapiano and hip-hop spinners, luxury daybeds, and illuminated evening swimming.',
        venue: VENUES.altitude_beach,
        date: '2026-12-06',
        time: '13:00',
        price: '{"general":"200","vip":"500","cabana":"6000"}',
        capacity: 1500,
        tags: ['pool party', 'amapiano', 'fourways', 'johannesburg', 'day party']
      },
      {
        title: 'Konka Summer Anthem Weekend',
        desc: 'The benchmark of Soweto luxury nightlife. Elite bottle parades, surprise international guest appearances, and relentless basslines throughout the weekend.',
        venue: VENUES.konka,
        date: '2026-12-11',
        time: '20:00',
        price: 'From R350',
        capacity: 1200,
        tags: ['konka', 'soweto', 'luxury nightlife', 'vip', 'amapiano']
      },
      {
        title: 'Durban All-White Beach Extravaganza',
        desc: 'Moses Mabhida Peoples Park transforms into an epic coastal summer festival. 12 hours of non-stop house, gqom, and afro-tech, with ocean breezes and stunning firework showcases.',
        venue: VENUES.moses_mabhida,
        date: '2026-12-12',
        time: '14:00',
        price: '{"general":"180","golden_circle":"450","vip":"850"}',
        capacity: 5000,
        tags: ['durban', 'all-white', 'gqom', 'afro-tech', 'festival']
      },
      {
        title: 'SunBet Arena Afro-Tech Symphony',
        desc: 'A fusion of classical strings and pulsating Afro-Tech rhythms featuring a 40-piece live orchestra collaborating with South Africa\'s legendary electronic producers.',
        venue: VENUES.sunbet_arena,
        date: '2026-12-13',
        time: '19:00',
        price: '{"tier_1":"350","tier_2":"550","vip_box":"1200"}',
        capacity: 6500,
        tags: ['afro-tech', 'live orchestra', 'pretoria', 'concert', 'sunbet arena']
      },
      {
        title: 'Kirstenbosch Summer Sunset: Soul & Afro-Jazz',
        desc: 'Lush greenery, mountain backdrops, and picnic baskets. Bring family and friends to experience live soul, afro-jazz, and neo-soul performances under the Cape Town summer sky.',
        venue: VENUES.kirstenbosch,
        date: '2026-12-13',
        time: '16:00',
        price: 'From R220',
        capacity: 3500,
        tags: ['jazz', 'soul', 'kirstenbosch', 'cape town', 'picnic']
      },
      {
        title: 'Soweto Street Food & Craft Beer Festival',
        desc: 'Celebrating authentic South African street culinary culture: gourmet kotas, sizzling mogodu, artisanal craft beers, live acoustic stages, and artisanal pop-up markets.',
        venue: VENUES.zone6,
        date: '2026-12-16',
        time: '11:00',
        price: 'From R100',
        capacity: 2500,
        tags: ['food', 'craft beer', 'soweto', 'reconciliation day', 'culture']
      },
      {
        title: 'Cabo Beach Sunset Electronic Odyssey',
        desc: 'Deep melodic house and techno right on the waterfront edge. World-renowned selectors, breathtaking sunset over Table Mountain, and refined Mediterranean dining.',
        venue: VENUES.cabo_beach,
        date: '2026-12-18',
        time: '16:00',
        price: 'From R350',
        capacity: 2000,
        tags: ['cabo beach', 'melodic techno', 'cape town', 'waterfront', 'sunset']
      },
      {
        title: 'Eyadini December Shisanyama Spectacular',
        desc: 'The heartbeat of Umlazi. World-class braai meat, ice-cold beverages, red carpet entrances, and Durban\'s biggest musical celebrities lighting up the main stage.',
        venue: VENUES.eyadini,
        date: '2026-12-19',
        time: '12:00',
        price: 'From R150',
        capacity: 3000,
        tags: ['shisanyama', 'eyadini', 'durban', 'lifestyle', 'gqom']
      },
      {
        title: 'The Station Parkhurst Rooftop Summer Jam',
        desc: 'Joburg northern suburbs skyline, craft gin bars, gourmet burgers, and sun-drenched deep house sets transitioning into electrifying party rhythms after dark.',
        venue: VENUES.the_station,
        date: '2026-12-19',
        time: '15:00',
        price: 'From R120',
        capacity: 600,
        tags: ['rooftop', 'parkhurst', 'johannesburg', 'deep house', 'craft gin']
      },
      {
        title: 'Spier Secret Vineyard Sunset Soiree',
        desc: 'An intimate, luxurious celebration in the heart of Stellenbosch. Award-winning organic wines paired with farm-to-table small plates and live jazz trios as dusk settles over the Helderberg.',
        venue: VENUES.spier,
        date: '2026-12-20',
        time: '17:00',
        price: 'R450 (includes wine tasting)',
        capacity: 450,
        tags: ['stellenbosch', 'wine tasting', 'jazz', 'fine dining', 'winelands']
      },
      {
        title: 'FNB Stadium Ke Dezemba SuperFest',
        desc: 'The biggest stadium gathering in Africa this December. Over 50 artists across 3 mega-stages: Amapiano Arena, Afro-House Colosseum, and Hip Hop Thunderdome.',
        venue: VENUES.fnb_stadium,
        date: '2026-12-23',
        time: '14:00',
        price: '{"general":"250","golden_circle":"600","vip_lounge":"1800"}',
        capacity: 25000,
        tags: ['stadium', 'superfest', 'amapiano', 'hiphop', 'fnb stadium']
      },
      {
        title: 'Christmas Eve Waterfront Moonlight Ball',
        desc: 'Celebrate Christmas Eve on the water at Grand Africa Café & Beach. Romantic candlelit tables on the sand, champagne towers, live acoustic serenades, and festive culinary specials.',
        venue: VENUES.grand_africa,
        date: '2026-12-24',
        time: '19:00',
        price: 'R650 (includes festive welcome drink)',
        capacity: 800,
        tags: ['christmas eve', 'grand africa', 'cape town', 'beach', 'festive']
      },
      {
        title: 'Christmas Day Family Garden Feast',
        desc: 'A joyful Christmas Day gathering surrounded by lush botanical beauty at Walter Sisulu Gardens. Live carols, children\'s entertainment zone, braai stations, and shaded picnic areas.',
        venue: VENUES.waterfall_park,
        date: '2026-12-25',
        time: '11:00',
        price: 'From R150',
        capacity: 1500,
        tags: ['christmas day', 'family', 'waterfall', 'midrand', 'picnic']
      },
      {
        title: 'Boxing Day Pool & Beats Extravaganza',
        desc: 'Recover and reignite the holiday momentum at Altitude Beach. Chilled house sessions, refreshing cocktails, pool volleyball, and afternoon live DJ showcases.',
        venue: VENUES.altitude_beach,
        date: '2026-12-26',
        time: '12:00',
        price: 'From R220',
        capacity: 1600,
        tags: ['boxing day', 'altitude beach', 'pool party', 'fourways', 'summer']
      },
      {
        title: 'Gqeberha Coastal Summer Sunset Festival',
        desc: 'Eastern Cape\'s premier festive gathering along the Boardwalk. Fresh ocean air, top national headliners, local craft food trucks, and unforgettable seaside vibes.',
        venue: VENUES.boardwalk,
        date: '2026-12-27',
        time: '15:00',
        price: 'From R180',
        capacity: 2000,
        tags: ['gqeberha', 'boardwalk', 'eastern cape', 'beach festival']
      },
      {
        title: 'Max\'s Lifestyle Festive Sunday Shisanyama',
        desc: 'Sundays in Umlazi are an international cultural phenomenon. Experience VIP treatment, elite luxury sports car parades, premium cuts, and the finest Durban house DJs.',
        venue: VENUES.maxs_lifestyle,
        date: '2026-12-27',
        time: '13:00',
        price: 'From R150',
        capacity: 2500,
        tags: ['maxs lifestyle', 'umlazi', 'durban', 'shisanyama', 'sunday groove']
      },
      {
        title: 'Cabo Beach Club NYE White & Silver Gala',
        desc: 'Say goodbye to 2026 and welcome 2027 in supreme style. Multi-tiered VIP platforms, international electronic guest DJs, midnight champagne toast, and private beachfront fireworks.',
        venue: VENUES.cabo_beach,
        date: '2026-12-31',
        time: '18:00',
        price: '{"general":"750","vip":"1800","table":"15000"}',
        capacity: 2200,
        tags: ['nye', 'new years eve', 'cabo beach', 'cape town', 'fireworks']
      },
      {
        title: 'Konka Soweto 2027 Midnight Countdown',
        desc: 'The most anticipated New Year\'s Eve celebration in Johannesburg. Unrivalled audio-visual production, star-studded VIP guests, bottle parades, and a historic midnight drop into 2027.',
        venue: VENUES.konka,
        date: '2026-12-31',
        time: '20:00',
        price: '{"general":"450","vip":"1200","table":"20000"}',
        capacity: 1500,
        tags: ['nye', 'new years eve', 'konka', 'soweto', 'countdown']
      }
    ],
    bizEvents: [
      {
        title: 'Southern Africa Year-End Business & Tech Gala',
        desc: 'An executive gala dinner uniting leaders in fintech, telecommunications, and venture capital. Celebrate annual milestones, recognize industry innovators, and build key partnerships for 2027.',
        venue: VENUES.sandton_cc,
        date: '2026-12-02',
        time: '18:30',
        price: 'R1,200',
        capacity: 500,
        tags: ['business', 'gala', 'networking', 'sandton', 'executive']
      },
      {
        title: 'Township Economy & Retail Entrepreneurship Expo',
        desc: 'Connecting township entrepreneurs, spaza shop owners, and franchisors with FMCG suppliers, fintech payment providers, and government enterprise funding programs.',
        venue: VENUES.zone6,
        date: '2026-12-03',
        time: '09:00',
        price: 'Free (RSVP Required)',
        capacity: 800,
        tags: ['township economy', 'sme', 'retail', 'entrepreneurship', 'soweto']
      },
      {
        title: 'Gauteng Commercial Real Estate & Investment Summit',
        desc: 'Keynote panels exploring mixed-use precinct developments, logistics hubs, and green building financing across Johannesburg and Pretoria. High-level networking with property REITs.',
        venue: VENUES.the_marc,
        date: '2026-12-08',
        time: '08:30',
        price: 'R850',
        capacity: 350,
        tags: ['property', 'real estate', 'investment', 'sandton', 'finance']
      },
      {
        title: 'Western Cape Tech & Venture Showcase',
        desc: 'Connecting early-stage tech founders across Africa with angel syndicates and venture capital funds. 15 selected startups pitch live on stage for pre-seed and seed funding rounds.',
        venue: VENUES.cticc,
        date: '2026-12-09',
        time: '10:00',
        price: 'From R450',
        capacity: 400,
        tags: ['startups', 'venture capital', 'tech', 'cape town', 'pitch']
      },
      {
        title: 'Africa Trade & Port Logistics Round-Table',
        desc: 'High-level policy and maritime logistics symposium addressing supply chain resilience, border modernization, and AfCFTA trade corridor acceleration.',
        venue: VENUES.durban_icc,
        date: '2026-12-10',
        time: '09:00',
        price: 'R950',
        capacity: 300,
        tags: ['logistics', 'trade', 'maritime', 'durban', 'afcfta']
      },
      {
        title: 'Midrand SME Cloud & Digital Mastery Workshop',
        desc: 'Hands-on practical masterclasses for small and medium business owners: implementing cloud POS, CRM automation, online marketing funnels, and secure digital payments.',
        venue: VENUES.gallagher,
        date: '2026-12-14',
        time: '09:30',
        price: 'R250',
        capacity: 250,
        tags: ['sme', 'cloud', 'digital transformation', 'midrand', 'workshop']
      },
      {
        title: 'Pretoria Public-Private Infrastructure Forum',
        desc: 'Convening municipal stakeholders, engineering contractors, and private financiers to deliberate on water, energy, and smart transit infrastructure deployment for the capital.',
        venue: VENUES.menlyn_maine,
        date: '2026-12-15',
        time: '08:30',
        price: 'R750',
        capacity: 300,
        tags: ['infrastructure', 'pretoria', 'public private partnership', 'energy']
      },
      {
        title: 'Women in African Tech & Leadership Breakfast',
        desc: 'Inspiring keynote speeches, fireside chats, and structured networking with top female C-suite executives, tech founders, and venture partners from across the continent.',
        venue: VENUES.sandton_cc,
        date: '2026-12-17',
        time: '08:00',
        price: 'R450',
        capacity: 350,
        tags: ['women in tech', 'leadership', 'networking', 'sandton', 'breakfast']
      },
      {
        title: 'Africa Hospitality & Tourism Leaders Forum',
        desc: 'Preparing Southern Africa\'s tourism ecosystem for the 2027 international travel season: direct bookings strategies, sustainable hotel operations, and luxury eco-safaris.',
        venue: VENUES.cticc,
        date: '2026-12-18',
        time: '09:00',
        price: 'R600',
        capacity: 400,
        tags: ['hospitality', 'tourism', 'travel', 'cape town', 'conferences']
      },
      {
        title: 'FinTech Africa 2027 Strategy & Regulatory Briefing',
        desc: 'An authoritative year-end briefing on open banking standards, digital asset regulation, mobile money interoperability, and cross-border remittances in Sub-Saharan Africa.',
        venue: VENUES.the_marc,
        date: '2026-12-22',
        time: '14:00',
        price: 'R550',
        capacity: 280,
        tags: ['fintech', 'banking', 'payments', 'regulation', 'sandton']
      }
    ]
  },

  // ── JANUARY 2027 ───────────────────────────────────────────────────
  {
    month: '2027-01',
    name: 'January 2027',
    bigEvents: [
      {
        title: 'New Year\'s Day Sunrise Beach Rave',
        desc: 'Greet the first sunrise of 2027 on the warm sand of Grand Africa Beach. Uplifting progressive house, ambient chillout lounge, artisan coffee stations, and refreshing mimosa bars.',
        venue: VENUES.grand_africa,
        date: '2027-01-01',
        time: '06:00',
        price: 'From R250',
        capacity: 1500,
        tags: ['new years day', 'sunrise', 'cape town', 'house music', 'beach']
      },
      {
        title: 'Soweto New Year Kickoff Celebration',
        desc: 'Start 2027 with massive vibrations in the heart of Soweto. Top amapiano DJs, premium braai meat, ice-cold drinks, and thousands of joyous music lovers.',
        venue: VENUES.zone6,
        date: '2027-01-01',
        time: '14:00',
        price: 'From R150',
        capacity: 3500,
        tags: ['new years day', 'soweto', 'amapiano', 'zone 6', 'party']
      },
      {
        title: 'Cabo Summer Sessions: Deep Oceanic',
        desc: 'Cape Town summer at its peak. International guest DJs, luxury oceanfront loungers, artisanal sushi platters, and pure deep melodic rhythms through golden hour.',
        venue: VENUES.cabo_beach,
        date: '2027-01-02',
        time: '14:00',
        price: 'From R300',
        capacity: 1800,
        tags: ['cabo beach', 'deep house', 'summer', 'cape town', 'vip']
      },
      {
        title: 'Durban Summer Beach Jam',
        desc: 'Enjoy KwaZulu-Natal\'s golden summer weather with live Afro-pop, gqom, and amapiano on the oceanfront. Beach volleyball, food vendors, and non-stop dancing.',
        venue: VENUES.moses_mabhida,
        date: '2027-01-03',
        time: '12:00',
        price: 'From R120',
        capacity: 4000,
        tags: ['durban', 'beach party', 'gqom', 'summer', 'live music']
      },
      {
        title: 'Altitude January Sun-Drenched Sessions',
        desc: 'Recharge your summer spirit by the pool. High-energy house sets, sparkling champagne bottles, daybed comfort, and beautiful Joburg weather.',
        venue: VENUES.altitude_beach,
        date: '2027-01-08',
        time: '14:00',
        price: 'From R200',
        capacity: 1400,
        tags: ['pool party', 'altitude beach', 'fourways', 'house music']
      },
      {
        title: 'Kirstenbosch Summer Sunset: Indie & Folk Harmony',
        desc: 'Pack your favorite picnic basket and settle onto the soft slopes of Kirstenbosch for an enchanting evening of acoustic folk, indie rock, and vocal harmonies.',
        venue: VENUES.kirstenbosch,
        date: '2027-01-10',
        time: '16:30',
        price: 'From R220',
        capacity: 3500,
        tags: ['kirstenbosch', 'indie', 'folk', 'cape town', 'sunset concert']
      },
      {
        title: 'Rosebank Street Culture & Sneaker Festival',
        desc: 'Where streetwear, rare sneaker trades, hip-hop cyphers, and urban graffiti artists collide. Pop-up boutiques, skate ramps, and live DJ battles.',
        venue: VENUES.rosebank_zone,
        date: '2027-01-15',
        time: '11:00',
        price: 'R100',
        capacity: 2000,
        tags: ['streetwear', 'sneakers', 'hip-hop', 'rosebank', 'johannesburg']
      },
      {
        title: 'Pretoria House Music Odyssey',
        desc: 'A massive celebration of deep soulful house and barcadi sounds at SunBet Arena. Incredible acoustics, laser visuals, and South Africa\'s finest selectors.',
        venue: VENUES.sunbet_arena,
        date: '2027-01-16',
        time: '18:00',
        price: '{"general":"220","vip":"550"}',
        capacity: 5500,
        tags: ['pretoria', 'house music', 'sunbet arena', 'nightlife']
      },
      {
        title: 'Stellenbosch Summer Wine & Acoustic Chill',
        desc: 'Spend a sun-drenched Saturday afternoon relaxing on Spier\'s scenic estate. Sip award-winning chenin blanc, taste artisan cheeses, and listen to soothing live acoustic sets.',
        venue: VENUES.spier,
        date: '2027-01-16',
        time: '13:00',
        price: 'R280',
        capacity: 600,
        tags: ['stellenbosch', 'wine', 'acoustic', 'spier', 'relax']
      },
      {
        title: 'Parkhurst Summer Sunset Social',
        desc: 'Vibrant sidewalk dining, craft cocktails, and curated afro-tech music in the trendy suburb of Parkhurst. Mingle with creatives, foodies, and trendsetters.',
        venue: VENUES.the_station,
        date: '2027-01-17',
        time: '15:00',
        price: 'From R120',
        capacity: 500,
        tags: ['parkhurst', 'social', 'craft cocktails', 'johannesburg', 'rooftop']
      },
      {
        title: 'Konka January Elite Soiree',
        desc: 'The party never stops at Konka. Experience premier VIP hospitality, signature bottle service, and an explosive roster of superstar Amapiano DJs.',
        venue: VENUES.konka,
        date: '2027-01-22',
        time: '20:00',
        price: 'From R300',
        capacity: 1200,
        tags: ['konka', 'soweto', 'amapiano', 'vip', 'nightlife']
      },
      {
        title: 'Shimmy Electronic Summer Wave',
        desc: 'Top European and African progressive house producers light up Shimmy Beach Club. Unbeatable oceanfront dance floor and stunning views of Table Bay.',
        venue: VENUES.shimmy,
        date: '2027-01-23',
        time: '16:00',
        price: 'From R320',
        capacity: 1800,
        tags: ['shimmy beach', 'electronic', 'cape town', 'beach party']
      },
      {
        title: 'Umlazi Summer Beats & Shisanyama',
        desc: 'Live music, smoky ribs, traditional chakalaka, and infectious energy at Eyadini Lounge. The ultimate Durban weekend experience.',
        venue: VENUES.eyadini,
        date: '2027-01-23',
        time: '13:00',
        price: 'From R150',
        capacity: 2800,
        tags: ['durban', 'shisanyama', 'eyadini', 'lifestyle']
      },
      {
        title: 'Kirstenbosch Summer Sunset: Cape Reggae Fest',
        desc: 'Positive vibrations and roots reggae rhythms in the botanical gardens. Bring blankets, gather with friends, and dance as the sun sets behind Table Mountain.',
        venue: VENUES.kirstenbosch,
        date: '2027-01-24',
        time: '16:00',
        price: 'From R220',
        capacity: 3500,
        tags: ['reggae', 'kirstenbosch', 'cape town', 'live music', 'outdoor']
      },
      {
        title: 'Waterfall City Beats & Bites Carnival',
        desc: 'Midrand\'s vibrant outdoor festival featuring 30 gourmet food trucks, craft microbreweries, pop-up cocktail bars, and an all-day live DJ stage.',
        venue: VENUES.waterfall_park,
        date: '2027-01-29',
        time: '12:00',
        price: 'From R120',
        capacity: 2200,
        tags: ['waterfall city', 'midrand', 'food festival', 'craft beer', 'music']
      },
      {
        title: 'Kyalami Trackside Summer Music Fest',
        desc: 'High-speed supercars by day, high-octane music festival by night. Experience exhilarating drift demonstrations followed by top live electronic and hip-hop acts.',
        venue: VENUES.kyalami,
        date: '2027-01-30',
        time: '14:00',
        price: '{"general":"250","pit_lane_vip":"750"}',
        capacity: 4500,
        tags: ['kyalami', 'motorsport', 'music festival', 'midrand', 'nightlife']
      },
      {
        title: 'Cabo Beach Club Sunset Sessions',
        desc: 'Sunset lovers unite for an exquisite Cape Town Saturday afternoon. Chilled champagne, fresh coastal breeze, and hypnotic melodic grooves.',
        venue: VENUES.cabo_beach,
        date: '2027-01-30',
        time: '15:00',
        price: 'From R300',
        capacity: 1800,
        tags: ['cabo beach', 'sunset', 'cape town', 'deep house']
      },
      {
        title: 'Max\'s Lifestyle Sunday Soul Experience',
        desc: 'The gold standard of Sunday soul, jazz, and lifestyle entertainment in Durban. Sumptuous braai cuts, luxury cars, and unforgettable warm coastal hospitality.',
        venue: VENUES.maxs_lifestyle,
        date: '2027-01-31',
        time: '12:00',
        price: 'From R150',
        capacity: 2500,
        tags: ['maxs lifestyle', 'durban', 'soul music', 'shisanyama']
      },
      {
        title: 'Gqeberha Beachfront Sunday Vibes',
        desc: 'Sun, surf, and sensational music along Summerstrand beach. Local food vendors, beach cricket, and a sunset live acoustic concert.',
        venue: VENUES.boardwalk,
        date: '2027-01-31',
        time: '13:00',
        price: 'From R100',
        capacity: 1500,
        tags: ['gqeberha', 'eastern cape', 'beachfront', 'sunday session']
      },
      {
        title: 'Braamfontein Rooftop Summer Jam',
        desc: 'Joburg\'s trendiest young creatives, digital artists, and sound innovators gather for an elevated rooftop experience with panoramic views of the Nelson Mandela Bridge.',
        venue: VENUES.constitution_hill,
        date: '2027-01-31',
        time: '15:00',
        price: 'From R120',
        capacity: 1000,
        tags: ['braamfontein', 'rooftop', 'art', 'johannesburg', 'hiphop']
      }
    ],
    bizEvents: [
      {
        title: 'Southern Africa 2027 Economic & Tech Outlook',
        desc: 'Chief economists, central bankers, and corporate treasurers discuss GDP projections, currency trajectories, and digital economy growth drivers for 2027.',
        venue: VENUES.sandton_cc,
        date: '2027-01-12',
        time: '08:30',
        price: 'R850',
        capacity: 450,
        tags: ['economy', 'banking', 'macroeconomics', 'sandton', 'business']
      },
      {
        title: 'AI & Enterprise Automation Summit 2027',
        desc: 'Exploring how generative AI, machine learning pipelines, and intelligent automation are driving operational transformation across financial services, healthcare, and retail in Africa.',
        venue: VENUES.gallagher,
        date: '2027-01-14',
        time: '09:00',
        price: 'R950',
        capacity: 600,
        tags: ['ai', 'automation', 'enterprise tech', 'midrand', 'conference']
      },
      {
        title: 'Silicon Cape Startup Kickoff & Angel Day',
        desc: 'Cape Town\'s leading tech founders, mentors, and angel investors meet to explore funding strategies, go-to-market scaling, and international expansion.',
        venue: VENUES.cticc,
        date: '2027-01-18',
        time: '10:00',
        price: 'R350',
        capacity: 350,
        tags: ['startups', 'silicon cape', 'angel investment', 'cape town']
      },
      {
        title: 'Renewable Energy & Battery Storage Summit',
        desc: 'Addressing South Africa\'s rapid commercial solar adoption, utility-scale battery storage, wheeling regulations, and private power purchase agreements (PPAs).',
        venue: VENUES.the_marc,
        date: '2027-01-20',
        time: '09:00',
        price: 'R1,100',
        capacity: 300,
        tags: ['renewable energy', 'solar', 'grid storage', 'sandton', 'green tech']
      },
      {
        title: 'eCommerce Africa Logistics & Payments Forum',
        desc: 'A comprehensive one-day forum covering last-mile courier logistics, parcel locker networks, instant EFT integration, and payment fraud prevention.',
        venue: VENUES.sandton_cc,
        date: '2027-01-21',
        time: '09:30',
        price: 'R700',
        capacity: 400,
        tags: ['ecommerce', 'logistics', 'fintech', 'retail', 'sandton']
      },
      {
        title: 'Durban Manufacturing & Export Excellence Conference',
        desc: 'Accelerating industrial productivity, automotive supply chain resilience, and maritime export opportunities through the Port of Durban.',
        venue: VENUES.durban_icc,
        date: '2027-01-25',
        time: '08:30',
        price: 'R750',
        capacity: 350,
        tags: ['manufacturing', 'export', 'durban', 'trade', 'supply chain']
      },
      {
        title: 'SME Tax & Compliance Masterclass 2027',
        desc: 'Practical, actionable guidance for South African small business owners on SARS compliance, turnover tax, VAT registration, and claiming tax incentives.',
        venue: VENUES.menlyn_maine,
        date: '2027-01-26',
        time: '09:00',
        price: 'R250',
        capacity: 250,
        tags: ['sme', 'tax', 'sars', 'compliance', 'pretoria']
      },
      {
        title: 'Venture Capital Africa Investor Breakfast',
        desc: 'Private round-table for general partners, institutional LPs, and family offices managing tech and growth equity portfolios across the African continent.',
        venue: VENUES.the_marc,
        date: '2027-01-27',
        time: '08:00',
        price: 'Invitation / R800',
        capacity: 150,
        tags: ['venture capital', 'private equity', 'sandton', 'investors']
      },
      {
        title: 'Healthcare Innovation & MedTech Expo',
        desc: 'Showcasing digital health diagnostics, telemedicine platforms, pharmacy supply chain tech, and health insurance automation across Southern Africa.',
        venue: VENUES.cticc,
        date: '2027-01-28',
        time: '09:00',
        price: 'R650',
        capacity: 450,
        tags: ['healthcare', 'medtech', 'telemedicine', 'cape town', 'expo']
      },
      {
        title: 'Cybersecurity & Cloud Resilience Congress',
        desc: 'Defending African enterprises against ransomware, identity theft, and data breaches. Live penetration testing demos, zero trust architecture, and POPIA audits.',
        venue: VENUES.sandton_cc,
        date: '2027-01-29',
        time: '09:00',
        price: 'R900',
        capacity: 400,
        tags: ['cybersecurity', 'cloud', 'popia', 'data protection', 'sandton']
      }
    ]
  },

  // ── FEBRUARY 2027 ──────────────────────────────────────────────────
  {
    month: '2027-02',
    name: 'February 2027',
    bigEvents: [
      {
        title: 'Ultra Summer Warmup Rooftop Fiesta',
        desc: 'Get warmed up for the massive festival month ahead. Deep bass, uplifting electro, and panoramic sunset views across the Johannesburg cityscape.',
        venue: VENUES.the_station,
        date: '2027-02-05',
        time: '17:00',
        price: 'From R150',
        capacity: 650,
        tags: ['rooftop', 'electronic', 'parkhurst', 'johannesburg', 'warmup']
      },
      {
        title: 'Cabo Beach Club Sunset Afro-Tech',
        desc: 'Electrifying beats right on the Atlantic coastline. VIP bottle service, fresh oysters, craft cocktails, and world-class underground selectors.',
        venue: VENUES.cabo_beach,
        date: '2027-02-06',
        time: '15:00',
        price: 'From R300',
        capacity: 1800,
        tags: ['cabo beach', 'afro-tech', 'cape town', 'summer', 'sunset']
      },
      {
        title: 'SunBet Arena Symphony of Amapiano',
        desc: 'A transcendent musical production pairing live strings, horns, and choral arrangements with the biggest Amapiano hits of the decade.',
        venue: VENUES.sunbet_arena,
        date: '2027-02-06',
        time: '19:00',
        price: '{"tier_1":"300","tier_2":"500","vip":"950"}',
        capacity: 6500,
        tags: ['amapiano', 'live orchestra', 'pretoria', 'sunbet arena', 'concert']
      },
      {
        title: 'Kirstenbosch Summer Sunset: Afro-Soul Romance',
        desc: 'Treat your loved ones to an open-air concert beneath Table Mountain. World-class Afro-soul and RnB vocalists perform as the twilight fades into evening.',
        venue: VENUES.kirstenbosch,
        date: '2027-02-07',
        time: '16:30',
        price: 'From R220',
        capacity: 3500,
        tags: ['kirstenbosch', 'afro-soul', 'rnb', 'cape town', 'romantic']
      },
      {
        title: 'Altitude Beach Pre-Valentine Pool Party',
        desc: 'Love is in the air at Joburg\'s favorite beach club. Heart-shaped pool floats, specialty pink champagne cocktails, and infectious party beats all day long.',
        venue: VENUES.altitude_beach,
        date: '2027-02-12',
        time: '14:00',
        price: 'From R220',
        capacity: 1500,
        tags: ['pool party', 'valentines', 'altitude beach', 'fourways', 'party']
      },
      {
        title: 'Shimmy Valentine Sunset Cruise & Rave',
        desc: 'Exclusive harbour boat cruise followed by an explosive Valentine\'s Eve beach party at Shimmy. Romantic beachfront dining and euphoric dance tracks.',
        venue: VENUES.shimmy,
        date: '2027-02-13',
        time: '16:00',
        price: '{"party_only":"350","cruise_and_party":"950"}',
        capacity: 1600,
        tags: ['valentines', 'shimmy beach', 'cape town', 'boat cruise', 'nightlife']
      },
      {
        title: 'Konka Valentine Red & Black Night',
        desc: 'Soweto\'s most glamorous Valentine party. Strictly red and black dress code, extravagant VIP tables, celebrity guests, and non-stop luxury energy.',
        venue: VENUES.konka,
        date: '2027-02-13',
        time: '20:00',
        price: 'From R350',
        capacity: 1200,
        tags: ['valentines', 'konka', 'soweto', 'luxury nightlife', 'vip']
      },
      {
        title: 'Valentine Candlelit Beach Dinner & Acoustic Night',
        desc: 'Treat your partner to an unforgettable Valentine\'s Day at Grand Africa Café. Private tables on the beach, 4-course gourmet dinner, and intimate live acoustic ballads.',
        venue: VENUES.grand_africa,
        date: '2027-02-14',
        time: '18:30',
        price: 'R850 per person (includes 4-course menu)',
        capacity: 600,
        tags: ['valentines', 'grand africa', 'cape town', 'fine dining', 'couples']
      },
      {
        title: 'Spier Valentine Wine & Chocolate Soiree',
        desc: 'An exquisite evening exploring artisanal single-origin chocolate pairings with Spier\'s vintage red wines, accompanied by a live violin and cello duo.',
        venue: VENUES.spier,
        date: '2027-02-14',
        time: '17:00',
        price: 'R550 per couple',
        capacity: 400,
        tags: ['valentines', 'stellenbosch', 'wine pairing', 'chocolate', 'romantic']
      },
      {
        title: 'Zone 6 Lovers & Friends Amapiano Jam',
        desc: 'The biggest post-Valentine community party in Soweto. Bring your crew or partner for sensational music, incredible food, and unforgettable memories.',
        venue: VENUES.zone6,
        date: '2027-02-19',
        time: '18:00',
        price: 'From R150',
        capacity: 3500,
        tags: ['amapiano', 'soweto', 'zone 6', 'party', 'nightlife']
      },
      {
        title: 'Eyadini Valentine Coast Weekend',
        desc: 'Durban\'s liveliest weekend gathering with sizzling shisanyama, top coastal DJs, and authentic KZN party vibes under the warm February sky.',
        venue: VENUES.eyadini,
        date: '2027-02-20',
        time: '12:00',
        price: 'From R150',
        capacity: 2500,
        tags: ['durban', 'eyadini', 'shisanyama', 'weekend', 'lifestyle']
      },
      {
        title: 'Kyalami Night Track Festival & Drifting',
        desc: 'Adrenaline and music collide. Pro drift tandem battles illuminated under stadium floodlights, followed by a massive live DJ stage at the clubhouse.',
        venue: VENUES.kyalami,
        date: '2027-02-20',
        time: '16:00',
        price: 'From R220',
        capacity: 4000,
        tags: ['drifting', 'kyalami', 'motorsport', 'midrand', 'night festival']
      },
      {
        title: 'Kirstenbosch Summer Sunset: Jazz in the Park',
        desc: 'Contemporary and traditional Cape Jazz greats light up the natural amphitheatre of Kirstenbosch. Unwind with friends on the rolling green lawns.',
        venue: VENUES.kirstenbosch,
        date: '2027-02-21',
        time: '16:00',
        price: 'From R220',
        capacity: 3500,
        tags: ['jazz', 'kirstenbosch', 'cape town', 'live concert']
      },
      {
        title: 'Rosebank Streetwear & Hip Hop Showcase',
        desc: 'Live rap battles, beat-making showcases, exclusive sneaker releases, and live graffiti mural creation in the heart of Rosebank.',
        venue: VENUES.rosebank_zone,
        date: '2027-02-26',
        time: '14:00',
        price: 'R120',
        capacity: 1800,
        tags: ['hiphop', 'streetwear', 'rosebank', 'graffiti', 'culture']
      },
      {
        title: 'Cabo Beach Club Sunset Melodic Grooves',
        desc: 'Experience pure melodic magic right on the waterfront. Top national selectors deliver smooth, driving basslines as the sun dips into the ocean.',
        venue: VENUES.cabo_beach,
        date: '2027-02-27',
        time: '15:00',
        price: 'From R300',
        capacity: 1800,
        tags: ['cabo beach', 'melodic techno', 'cape town', 'sunset']
      },
      {
        title: 'Pretoria Craft Gin & Food Truck Carnival',
        desc: 'Taste over 50 artisanal South African craft gins, craft tonics, and international street food creations on the lawns of Menlyn Maine.',
        venue: VENUES.menlyn_maine,
        date: '2027-02-27',
        time: '11:00',
        price: 'From R150',
        capacity: 2500,
        tags: ['craft gin', 'food trucks', 'pretoria', 'menlyn', 'lifestyle']
      },
      {
        title: 'Altitude Beach February Finale Pool Fest',
        desc: 'Close out February with an epic poolside bash. Synchronized swimmers, percussionists, live vocalists, and the hottest amapiano heaters.',
        venue: VENUES.altitude_beach,
        date: '2027-02-27',
        time: '13:00',
        price: 'From R220',
        capacity: 1500,
        tags: ['altitude beach', 'fourways', 'pool party', 'amapiano']
      },
      {
        title: 'Max\'s Lifestyle Sunday Vibe Session',
        desc: 'The benchmark of KZN township tourism and VIP culture. Enjoy world-renowned hospitality, legendary braai feasts, and top-tier music.',
        venue: VENUES.maxs_lifestyle,
        date: '2027-02-28',
        time: '12:00',
        price: 'From R150',
        capacity: 2500,
        tags: ['maxs lifestyle', 'durban', 'sunday', 'shisanyama']
      },
      {
        title: 'Gqeberha Boardwalk Sunset Social',
        desc: 'Coastal breezes, acoustic pop sets, and delicious local seafood along the Boardwalk pier. The perfect way to round off the month.',
        venue: VENUES.boardwalk,
        date: '2027-02-28',
        time: '14:00',
        price: 'From R100',
        capacity: 1600,
        tags: ['gqeberha', 'boardwalk', 'eastern cape', 'sunset']
      },
      {
        title: 'Braamfontein Sunset Electronic Session',
        desc: 'Cutting-edge electronic music on the historic grounds of Constitution Hill. Stunning architectural lighting and underground sonic exploration.',
        venue: VENUES.constitution_hill,
        date: '2027-02-28',
        time: '16:00',
        price: 'From R150',
        capacity: 1200,
        tags: ['braamfontein', 'electronic', 'constitution hill', 'johannesburg']
      }
    ],
    bizEvents: [
      {
        title: 'African Mining & Energy Leaders Executive Indaba',
        desc: 'High-level dialogue on critical minerals, mining ESG compliance, local beneficiation, and private renewable power integration for African mining operations.',
        venue: VENUES.sandton_cc,
        date: '2027-02-02',
        time: '08:30',
        price: 'R1,500',
        capacity: 650,
        tags: ['mining', 'energy', 'esg', 'sandton', 'indaba']
      },
      {
        title: 'African Venture Capital & Private Equity Summit',
        desc: 'Connecting global institutional asset allocators with African GP managers deploying capital into technology, consumer goods, and climate infrastructure.',
        venue: VENUES.cticc,
        date: '2027-02-04',
        time: '09:00',
        price: 'R1,200',
        capacity: 500,
        tags: ['venture capital', 'private equity', 'cape town', 'investors']
      },
      {
        title: 'SME Funding & Growth Capital Expo 2027',
        desc: 'Direct matchmaking between bank loan officers, angel syndicates, DFIs, and growing South African SMEs looking for working capital and equipment finance.',
        venue: VENUES.gallagher,
        date: '2027-02-09',
        time: '09:00',
        price: 'Free (Registration Required)',
        capacity: 800,
        tags: ['sme funding', 'finance', 'midrand', 'growth', 'business']
      },
      {
        title: 'Commercial Property & Green Building Conference',
        desc: 'Exploring net-zero building designs, edge-certified developments, solar rooftop wheeling, and the future of flexible office spaces in South Africa.',
        venue: VENUES.the_marc,
        date: '2027-02-11',
        time: '09:00',
        price: 'R850',
        capacity: 350,
        tags: ['property', 'green building', 'real estate', 'sandton']
      },
      {
        title: 'FinTech Africa Payments & Cross-Border Remittances',
        desc: 'Keynote panels detailing instant settlement networks, stablecoin-assisted trade settlement, and reduction of remittance friction across SADC corridors.',
        venue: VENUES.sandton_cc,
        date: '2027-02-16',
        time: '09:00',
        price: 'R900',
        capacity: 450,
        tags: ['fintech', 'remittances', 'payments', 'sadc', 'banking']
      },
      {
        title: 'Durban Port Supply Chain & Maritime Tech Forum',
        desc: 'Showcasing digital cargo tracking, container terminal automation, and customs single-window efficiency improvements at the Port of Durban.',
        venue: VENUES.durban_icc,
        date: '2027-02-18',
        time: '08:30',
        price: 'R750',
        capacity: 350,
        tags: ['maritime', 'logistics', 'durban', 'shipping', 'ports']
      },
      {
        title: 'Southern Africa Agri-Tech & Food Security Expo',
        desc: 'Highlighting precision agriculture, satellite soil mapping, drought-resilient crops, and solar-powered irrigation tech for commercial and smallholder farmers.',
        venue: VENUES.spier,
        date: '2027-02-23',
        time: '09:00',
        price: 'R500',
        capacity: 300,
        tags: ['agritech', 'agriculture', 'stellenbosch', 'food security']
      },
      {
        title: 'Women in Corporate Governance & Board Leadership',
        desc: 'High-impact masterclass on King IV compliance, audit committee effectiveness, board diversity, and stakeholder capitalism for current and aspiring female directors.',
        venue: VENUES.the_marc,
        date: '2027-02-24',
        time: '08:30',
        price: 'R650',
        capacity: 250,
        tags: ['governance', 'leadership', 'boardroom', 'sandton', 'women']
      },
      {
        title: 'Pretoria Automotive & Manufacturing Summit',
        desc: 'Examining South Africa\'s transition to electric vehicle (EV) manufacturing, battery component sourcing, and supply chain readiness in the automotive sector.',
        venue: VENUES.menlyn_maine,
        date: '2027-02-25',
        time: '09:00',
        price: 'R800',
        capacity: 350,
        tags: ['automotive', 'ev', 'manufacturing', 'pretoria']
      },
      {
        title: 'Digital Marketing & Social Commerce Conclave 2027',
        desc: 'Leading digital agencies, performance marketers, and brand managers explore TikTok shop integration, influencer contract standards, and AI creative workflows.',
        venue: VENUES.rosebank_zone,
        date: '2027-02-26',
        time: '09:30',
        price: 'R450',
        capacity: 300,
        tags: ['digital marketing', 'social commerce', 'rosebank', 'advertising']
      }
    ]
  },

  // ── MARCH 2027 ─────────────────────────────────────────────────────
  {
    month: '2027-03',
    name: 'March 2027',
    bigEvents: [
      {
        title: 'Autumn Beats Outdoor Festival',
        desc: 'Embrace the golden tones of early autumn with a high-energy outdoor music festival featuring South Africa\'s top house and amapiano royalty.',
        venue: VENUES.waterfall_park,
        date: '2027-03-05',
        time: '13:00',
        price: 'From R180',
        capacity: 3000,
        tags: ['festivals', 'waterfall city', 'amapiano', 'midrand', 'outdoor']
      },
      {
        title: 'Cabo Beach Club Sunset House Groove',
        desc: 'As autumn arrives in the Cape, enjoy clear skies and sublime oceanic views paired with world-class deep house and coastal dining.',
        venue: VENUES.cabo_beach,
        date: '2027-03-06',
        time: '15:00',
        price: 'From R300',
        capacity: 1800,
        tags: ['cabo beach', 'house music', 'cape town', 'sunset', 'autumn']
      },
      {
        title: 'SunBet Arena Afro-Tech Masters',
        desc: 'An immersive visual and sonic celebration of South African electronic music, featuring mind-bending 3D projections and bone-rattling bass.',
        venue: VENUES.sunbet_arena,
        date: '2027-03-06',
        time: '18:00',
        price: '{"tier_1":"250","tier_2":"450","vip":"850"}',
        capacity: 6500,
        tags: ['afro-tech', 'sunbet arena', 'pretoria', 'electronic', 'visuals']
      },
      {
        title: 'Kirstenbosch Summer Sunset: Cape Town Philharmonic Pop Classics',
        desc: 'The prestigious Cape Town Philharmonic Orchestra performs an uplifting, accessible program of pop, film, and Broadway classics on the botanical lawn.',
        venue: VENUES.kirstenbosch,
        date: '2027-03-07',
        time: '16:00',
        price: 'From R250',
        capacity: 4000,
        tags: ['orchestra', 'kirstenbosch', 'cape town', 'classical', 'picnic']
      },
      {
        title: 'Altitude Beach Autumn Sunset Bash',
        desc: 'Fourways turns up the heat with poolside VIP daybeds, live saxophone accompaniment over deep house rhythms, and signature cocktail buckets.',
        venue: VENUES.altitude_beach,
        date: '2027-03-12',
        time: '14:00',
        price: 'From R220',
        capacity: 1500,
        tags: ['altitude beach', 'pool party', 'deep house', 'fourways']
      },
      {
        title: 'Shimmy Electronic Horizon Festival',
        desc: 'A 10-hour dance marathon on the water featuring local underground techno and progressive house selectors. Spectacular harbor views and laser effects.',
        venue: VENUES.shimmy,
        date: '2027-03-13',
        time: '14:00',
        price: 'From R320',
        capacity: 1800,
        tags: ['shimmy beach', 'techno', 'cape town', 'electronic', 'harbour']
      },
      {
        title: 'Konka Autumn High-Energy Soiree',
        desc: 'The gold standard of Soweto luxury. World-class bottle shows, supreme sound reinforcement, and surprise star performances all night long.',
        venue: VENUES.konka,
        date: '2027-03-13',
        time: '20:00',
        price: 'From R350',
        capacity: 1200,
        tags: ['konka', 'soweto', 'amapiano', 'vip', 'nightlife']
      },
      {
        title: 'Eyadini Shisanyama & Gqom Sunday',
        desc: 'Durban\'s liveliest weekend tradition. Savour flame-grilled meats and traditional sides while top KZN DJs play the finest gqom and amapiano.',
        venue: VENUES.eyadini,
        date: '2027-03-14',
        time: '12:00',
        price: 'From R150',
        capacity: 2600,
        tags: ['eyadini', 'durban', 'gqom', 'shisanyama', 'sunday']
      },
      {
        title: 'Soweto Human Rights Weekend Cultural Fiesta',
        desc: 'Commemorating South Africa\'s human rights journey with live poetry, historic theatre, acoustic soul stages, and craft food stalls in Diepkloof.',
        venue: VENUES.zone6,
        date: '2027-03-19',
        time: '16:00',
        price: 'From R150',
        capacity: 3500,
        tags: ['human rights', 'soweto', 'zone 6', 'culture', 'live music']
      },
      {
        title: 'Constitution Hill Human Rights Festival & Concert',
        desc: 'A weekend of truth, freedom, and music at Constitution Hill. Three outdoor music stages, film screenings, artisan book markets, and human rights dialogues.',
        venue: VENUES.constitution_hill,
        date: '2027-03-20',
        time: '10:00',
        price: 'Free / R100 for evening concert',
        capacity: 5000,
        tags: ['constitution hill', 'human rights', 'festival', 'braamfontein', 'freedom']
      },
      {
        title: 'Kyalami Autumn Supercar Parade & Track Fest',
        desc: 'Exotic Italian, British, and German supercars roar around the Kyalami Grand Prix Circuit, followed by a sunset music festival and food village.',
        venue: VENUES.kyalami,
        date: '2027-03-20',
        time: '12:00',
        price: '{"general":"250","paddock_pass":"650"}',
        capacity: 4500,
        tags: ['supercars', 'kyalami', 'midrand', 'motorsport', 'festival']
      },
      {
        title: 'Human Rights Day Sunset Concert Kirstenbosch',
        desc: 'Celebrate Human Rights Day in Cape Town with South Africa\'s most beloved musical icons playing folk, freedom songs, and uplifting afro-pop.',
        venue: VENUES.kirstenbosch,
        date: '2027-03-21',
        time: '16:00',
        price: 'From R220',
        capacity: 4000,
        tags: ['human rights day', 'kirstenbosch', 'cape town', 'freedom songs', 'concert']
      },
      {
        title: 'Grand Africa Café Autumn Beach Party',
        desc: 'Kick off your shoes and dance on the sand at Granger Bay. Superb seafood, chilled rosé, and world-class house selectors playing till the stars come out.',
        venue: VENUES.grand_africa,
        date: '2027-03-21',
        time: '15:00',
        price: 'From R250',
        capacity: 1200,
        tags: ['grand africa', 'cape town', 'beach party', 'autumn', 'house music']
      },
      {
        title: 'Spier Autumn Harvest & Jazz Picnic',
        desc: 'Celebrate the end of grape harvest season in Stellenbosch. Fresh seasonal produce, newly bottled wines, grape stomping activities, and live gypsy jazz.',
        venue: VENUES.spier,
        date: '2027-03-22',
        time: '11:00',
        price: 'R350',
        capacity: 650,
        tags: ['harvest', 'stellenbosch', 'wine', 'jazz', 'spier']
      },
      {
        title: 'Parkhurst Autumn Craft Beer & Gin Fest',
        desc: 'Sample over 30 small-batch craft beers and gins from Gauteng\'s leading micro-distilleries, accompanied by gourmet burger pop-ups and live acoustic duos.',
        venue: VENUES.the_station,
        date: '2027-03-26',
        time: '16:00',
        price: 'From R120',
        capacity: 600,
        tags: ['craft beer', 'gin', 'parkhurst', 'johannesburg', 'tasting']
      },
      {
        title: 'Cabo Beach Club Sunset Finale',
        desc: 'Cape Town\'s finest waterfront party experience. Exceptional sushi, champagne sparklers, and world-class underground electronic music.',
        venue: VENUES.cabo_beach,
        date: '2027-03-27',
        time: '15:00',
        price: 'From R300',
        capacity: 1800,
        tags: ['cabo beach', 'cape town', 'sunset', 'electronic', 'vip']
      },
      {
        title: 'Menlyn Maine Autumn Fashion & Music Night',
        desc: 'Top South African fashion designers unveil their autumn/winter ready-to-wear collections on an outdoor runway, accompanied by live DJ sets and champagne lounges.',
        venue: VENUES.menlyn_maine,
        date: '2027-03-27',
        time: '18:00',
        price: '{"runway_seat":"250","front_row_vip":"650"}',
        capacity: 1500,
        tags: ['fashion', 'pretoria', 'menlyn', 'runway', 'cocktails']
      },
      {
        title: 'Max\'s Lifestyle Autumn Shisanyama Sunday',
        desc: 'The best place to spend a Sunday in Durban. Impeccable service, mouth-watering cuts of meat, and high-fashion local flair.',
        venue: VENUES.maxs_lifestyle,
        date: '2027-03-28',
        time: '12:00',
        price: 'From R150',
        capacity: 2500,
        tags: ['maxs lifestyle', 'durban', 'shisanyama', 'lifestyle']
      },
      {
        title: 'Gqeberha Oceanfront Autumn Breeze Fest',
        desc: 'Live music on the beach, local artisanal craft stalls, fresh seafood braais, and family-friendly beach games along the Boardwalk.',
        venue: VENUES.boardwalk,
        date: '2027-03-28',
        time: '12:00',
        price: 'From R100',
        capacity: 1500,
        tags: ['gqeberha', 'boardwalk', 'eastern cape', 'beach festival']
      },
      {
        title: 'Rosebank Art & Vinyl Evening Market',
        desc: 'Browse rare vintage vinyl records, contemporary African art prints, and handcrafted ceramics while enjoying craft cocktails and live ambient soul sets.',
        venue: VENUES.rosebank_zone,
        date: '2027-03-31',
        time: '17:00',
        price: 'Free / R50 tasting ticket',
        capacity: 1200,
        tags: ['art market', 'vinyl', 'rosebank', 'johannesburg', 'culture']
      }
    ],
    bizEvents: [
      {
        title: 'Africa FinTech & Digital Banking Summit 2027',
        desc: 'Convening African commercial banks, neobanks, payment switches, and regulators to debate credit scoring algorithms, API aggregation, and CBDC rollouts.',
        venue: VENUES.sandton_cc,
        date: '2027-03-03',
        time: '08:30',
        price: 'R1,100',
        capacity: 650,
        tags: ['fintech', 'banking', 'digital payments', 'sandton', 'summit']
      },
      {
        title: 'AI in Healthcare & Life Sciences Congress',
        desc: 'Examining AI-driven diagnostics, clinical trial acceleration, genomic sequencing, and automated patient intake systems for Southern African healthcare providers.',
        venue: VENUES.cticc,
        date: '2027-03-09',
        time: '09:00',
        price: 'R850',
        capacity: 400,
        tags: ['ai', 'healthcare', 'life sciences', 'cape town', 'medical']
      },
      {
        title: 'Gauteng Infrastructure & Municipal Bond Summit',
        desc: 'Uniting pension funds, sovereign wealth funds, and infrastructure developers to discuss municipal debt instruments and infrastructure delivery.',
        venue: VENUES.gallagher,
        date: '2027-03-11',
        time: '09:00',
        price: 'R950',
        capacity: 450,
        tags: ['infrastructure', 'bonds', 'municipal finance', 'midrand']
      },
      {
        title: 'Silicon Cape Investor Demo Day 2027',
        desc: 'The premier graduation showcase for top-tier African tech startups. Founders present their operational metrics, growth traction, and open funding rounds.',
        venue: VENUES.cticc,
        date: '2027-03-16',
        time: '14:00',
        price: 'R400',
        capacity: 350,
        tags: ['demo day', 'startups', 'venture capital', 'cape town']
      },
      {
        title: 'Africa Retail & Supply Chain Expo',
        desc: 'Transforming consumer goods retail: automated distribution centres, cold-chain monitoring, predictive demand forecasting, and omnichannel loyalty apps.',
        venue: VENUES.sandton_cc,
        date: '2027-03-18',
        time: '09:00',
        price: 'R700',
        capacity: 500,
        tags: ['retail', 'supply chain', 'logistics', 'sandton', 'expo']
      },
      {
        title: 'Durban Ocean Economy & Maritime Trade Summit',
        desc: 'Maximizing the economic potential of Southern Africa\'s blue economy: offshore aquaculture, naval engineering, port digitalization, and eco-tourism.',
        venue: VENUES.durban_icc,
        date: '2027-03-23',
        time: '08:30',
        price: 'R800',
        capacity: 350,
        tags: ['maritime', 'blue economy', 'trade', 'durban', 'shipping']
      },
      {
        title: 'SME Exporting & Global E-Commerce Workshop',
        desc: 'Practical step-by-step guidance on international shipping protocols, customs clearance, forex hedging, and listing on global digital marketplaces.',
        venue: VENUES.the_marc,
        date: '2027-03-24',
        time: '09:30',
        price: 'R300',
        capacity: 250,
        tags: ['sme', 'export', 'ecommerce', 'sandton', 'trade']
      },
      {
        title: 'Pretoria Cyber Defense & Government Tech Forum',
        desc: 'Dedicated to public sector cybersecurity, critical national infrastructure defense, secure government cloud adoption, and national digital ID platforms.',
        venue: VENUES.menlyn_maine,
        date: '2027-03-25',
        time: '09:00',
        price: 'R750',
        capacity: 300,
        tags: ['cybersecurity', 'govtech', 'digital id', 'pretoria']
      },
      {
        title: 'Clean Energy & Green Hydrogen Southern Africa',
        desc: 'Assessing electrolyzer deployment, export corridor developments, water desalination needs, and off-take agreements for green ammonia and hydrogen.',
        venue: VENUES.sandton_cc,
        date: '2027-03-30',
        time: '08:30',
        price: 'R1,200',
        capacity: 400,
        tags: ['green hydrogen', 'clean energy', 'decarbonization', 'sandton']
      },
      {
        title: 'Women in Private Equity & Angel Investing Masterclass',
        desc: 'Hands-on training and peer exchange for women angels and venture scouts: term sheet negotiation, cap table hygiene, and valuation methodologies.',
        venue: VENUES.the_marc,
        date: '2027-03-31',
        time: '14:00',
        price: 'R450',
        capacity: 200,
        tags: ['women in finance', 'angel investing', 'private equity', 'sandton']
      }
    ]
  },

  // ── APRIL 2027 ─────────────────────────────────────────────────────
  {
    month: '2027-04',
    name: 'April 2027',
    bigEvents: [
      {
        title: 'Easter Weekend Amapiano Super Jam',
        desc: 'Kick off the Easter long weekend with 8 hours of blistering Amapiano beats at Zone 6 Venue. Elite DJ lineups, state-of-the-art CO2 jets, and VIP lounges.',
        venue: VENUES.zone6,
        date: '2027-04-02',
        time: '18:00',
        price: 'From R180',
        capacity: 3500,
        tags: ['easter', 'amapiano', 'soweto', 'zone 6', 'long weekend']
      },
      {
        title: 'Shimmy Easter Sunset Ocean Rave',
        desc: 'Celebrate Easter by the Atlantic ocean. Top international deep house headliners, sunset beach dance floor, craft cocktails, and VIP waterfront cabanas.',
        venue: VENUES.shimmy,
        date: '2027-04-03',
        time: '15:00',
        price: 'From R320',
        capacity: 1800,
        tags: ['easter', 'shimmy beach', 'cape town', 'house music', 'rave']
      },
      {
        title: 'Altitude Beach Easter Saturday Pool Gala',
        desc: 'Fourways\' biggest long-weekend celebration. Sun-soaked daybeds, signature champagne sprays, live percussionists, and pulsating house tracks.',
        venue: VENUES.altitude_beach,
        date: '2027-04-03',
        time: '13:00',
        price: 'From R220',
        capacity: 1500,
        tags: ['easter', 'altitude beach', 'fourways', 'pool party']
      },
      {
        title: 'Easter Sunday Family Picnic & Jazz',
        desc: 'A blissful Easter Sunday on the green lawns of Spier Wine Farm. Artisan picnic baskets, chocolate egg hunts for kids, and soothing live jazz for adults.',
        venue: VENUES.spier,
        date: '2027-04-04',
        time: '11:00',
        price: 'R350 per adult (includes picnic basket)',
        capacity: 800,
        tags: ['easter sunday', 'family', 'stellenbosch', 'spier', 'picnic']
      },
      {
        title: 'Easter Monday Sunset Chill at Grand Africa',
        desc: 'Wrap up the long weekend barefoot on the sand with a glass of crisp wine, fresh seafood, and uplifting sunset house music.',
        venue: VENUES.grand_africa,
        date: '2027-04-05',
        time: '15:00',
        price: 'From R220',
        capacity: 1200,
        tags: ['easter monday', 'grand africa', 'cape town', 'beach', 'sunset']
      },
      {
        title: 'Konka April Saturday Extravaganza',
        desc: 'The undisputed epicentre of Soweto nightlife. High-end luxury bottle service, star-studded VIP guests, and the hottest amapiano releases.',
        venue: VENUES.konka,
        date: '2027-04-10',
        time: '20:00',
        price: 'From R350',
        capacity: 1200,
        tags: ['konka', 'soweto', 'amapiano', 'vip', 'nightlife']
      },
      {
        title: 'Cabo Beach Sunset Electronic Odyssey',
        desc: 'Deep progressive sounds, ocean breezes, and panoramic views of Table Mountain as twilight sweeps across the Cape Town waterfront.',
        venue: VENUES.cabo_beach,
        date: '2027-04-10',
        time: '16:00',
        price: 'From R300',
        capacity: 1800,
        tags: ['cabo beach', 'cape town', 'electronic', 'sunset']
      },
      {
        title: 'Eyadini Coastal Sunday Shisanyama',
        desc: 'Durban\'s finest braai meat, ice-cold beverages, red carpet arrivals, and the latest gqom and house hits setting the rhythm.',
        venue: VENUES.eyadini,
        date: '2027-04-11',
        time: '12:00',
        price: 'From R150',
        capacity: 2500,
        tags: ['eyadini', 'durban', 'shisanyama', 'sunday session']
      },
      {
        title: 'SunBet Arena Afro-Soul & RnB Night',
        desc: 'An intimate yet massive evening featuring South Africa\'s most celebrated RnB and Soul vocalists backed by full live bands and string sections.',
        venue: VENUES.sunbet_arena,
        date: '2027-04-16',
        time: '19:00',
        price: '{"tier_1":"280","tier_2":"480","vip":"900"}',
        capacity: 6500,
        tags: ['rnb', 'afro-soul', 'sunbet arena', 'pretoria', 'live vocals']
      },
      {
        title: 'Kyalami Autumn Track Days & DJ Festival',
        desc: 'High-performance track action followed by a vibrant open-air festival featuring craft food trucks, driving simulators, and live DJ stages.',
        venue: VENUES.kyalami,
        date: '2027-04-17',
        time: '12:00',
        price: 'From R220',
        capacity: 4000,
        tags: ['kyalami', 'motorsport', 'midrand', 'festival']
      },
      {
        title: 'Waterfall City Street Food & Craft Gin Fest',
        desc: 'Midrand\'s favourite foodie gathering. Taste international gourmet creations, sip craft gins, and dance to live acoustic and afro-house sets.',
        venue: VENUES.waterfall_park,
        date: '2027-04-17',
        time: '11:00',
        price: 'From R120',
        capacity: 2500,
        tags: ['waterfall city', 'food festival', 'craft gin', 'midrand']
      },
      {
        title: 'Kirstenbosch Autumn Sunset: Contemporary Folk',
        desc: 'Crisp autumn air and warm acoustic guitars. Unwind with friends on the gentle slopes of Kirstenbosch as the evening shadows lengthen.',
        venue: VENUES.kirstenbosch,
        date: '2027-04-18',
        time: '16:00',
        price: 'From R220',
        capacity: 3500,
        tags: ['kirstenbosch', 'folk', 'cape town', 'live music']
      },
      {
        title: 'Rosebank Street Art & Sneaker Clash',
        desc: 'Live sneaker customisation battles, street dance showcases, hip-hop cyphers, and exclusive merch drops in the trendiest precinct in Joburg.',
        venue: VENUES.rosebank_zone,
        date: '2027-04-23',
        time: '13:00',
        price: 'R100',
        capacity: 1800,
        tags: ['sneakers', 'streetwear', 'rosebank', 'hiphop', 'art']
      },
      {
        title: 'The Station Parkhurst Autumn Rooftop Beats',
        desc: 'Joburg skyline views, artisan cocktails, and deep progressive house tracks as autumn settles over Parkhurst.',
        venue: VENUES.the_station,
        date: '2027-04-24',
        time: '16:00',
        price: 'From R120',
        capacity: 600,
        tags: ['rooftop', 'parkhurst', 'johannesburg', 'deep house']
      },
      {
        title: 'Cabo Beach Club Sunset Sessions',
        desc: 'Sensational waterfront sunset vibes. International guest DJs, luxury ocean loungers, artisan sushi, and deep melodic house.',
        venue: VENUES.cabo_beach,
        date: '2027-04-24',
        time: '15:00',
        price: 'From R300',
        capacity: 1800,
        tags: ['cabo beach', 'cape town', 'house music', 'sunset']
      },
      {
        title: 'Freedom Day Eve All-Star Amapiano Festival',
        desc: 'Celebrate South Africa\'s democracy with an all-night Amapiano festival at FNB Stadium Stadium precinct. Over 25 powerhouse performers.',
        venue: VENUES.fnb_stadium,
        date: '2027-04-26',
        time: '16:00',
        price: '{"general":"200","vip":"550","vvip":"1200"}',
        capacity: 12000,
        tags: ['freedom day', 'amapiano', 'fnb stadium', 'festival', 'johannesburg']
      },
      {
        title: 'Freedom Day Freedom Songs & Heritage Concert',
        desc: 'Commemorating 33 years of South African freedom at Constitution Hill. Iconic legacy artists perform freedom anthems, jazz, and traditional choral music.',
        venue: VENUES.constitution_hill,
        date: '2027-04-27',
        time: '12:00',
        price: 'Free entry (RSVP required)',
        capacity: 5000,
        tags: ['freedom day', 'constitution hill', 'heritage', 'braamfontein', 'concert']
      },
      {
        title: 'Freedom Day Beach Festival Durban',
        desc: 'A massive celebration of music, culture, and coastal sunshine at Moses Mabhida Peoples Park. Food trucks, beach sports, and top KZN headliners.',
        venue: VENUES.moses_mabhida,
        date: '2027-04-27',
        time: '11:00',
        price: 'From R120',
        capacity: 4500,
        tags: ['freedom day', 'durban', 'festival', 'beach', 'music']
      },
      {
        title: 'Gqeberha Boardwalk Freedom Sunset Fest',
        desc: 'Celebrate Freedom Day along the Eastern Cape shoreline with live bands, family fun activities, and delicious seafood braais.',
        venue: VENUES.boardwalk,
        date: '2027-04-27',
        time: '13:00',
        price: 'From R100',
        capacity: 1800,
        tags: ['freedom day', 'gqeberha', 'boardwalk', 'eastern cape']
      },
      {
        title: 'Max\'s Lifestyle Freedom Celebration Shisanyama',
        desc: 'Freedom Day celebration in true Umlazi style. Impeccable hospitality, VIP treatment, luxury supercars, and top-tier Durban house DJs.',
        venue: VENUES.maxs_lifestyle,
        date: '2027-04-27',
        time: '12:00',
        price: 'From R150',
        capacity: 2500,
        tags: ['freedom day', 'maxs lifestyle', 'durban', 'shisanyama']
      }
    ],
    bizEvents: [
      {
        title: 'South African Property Buyers & Investment Expo',
        desc: 'Showcasing high-yield residential developments, student accommodation projects, buy-to-let financing, and off-plan investment strategies across SA.',
        venue: VENUES.sandton_cc,
        date: '2027-04-06',
        time: '09:00',
        price: 'Free (RSVP Required)',
        capacity: 800,
        tags: ['real estate', 'property', 'investment', 'sandton', 'expo']
      },
      {
        title: 'Africa Sustainability, ESG & Carbon Markets Forum',
        desc: 'Exploring voluntary carbon credits, renewable wheeling tariffs, water conservation tech, and corporate biodiversity reporting for African multinationals.',
        venue: VENUES.the_marc,
        date: '2027-04-08',
        time: '08:30',
        price: 'R850',
        capacity: 350,
        tags: ['esg', 'sustainability', 'carbon credits', 'sandton']
      },
      {
        title: 'Western Cape Wine Export & Trade Conference',
        desc: 'Accelerating direct-to-consumer digital wine exports, exploring tariff adjustments under bilateral trade pacts, and modernizing bulk wine logistics.',
        venue: VENUES.spier,
        date: '2027-04-13',
        time: '09:00',
        price: 'R600',
        capacity: 300,
        tags: ['wine trade', 'export', 'stellenbosch', 'agriculture', 'logistics']
      },
      {
        title: 'SME Cybersecurity & Data Compliance Workshop',
        desc: 'Actionable guidance on securing business customer databases, enforcing multi-factor authentication, and avoiding crippling ransomware payments.',
        venue: VENUES.gallagher,
        date: '2027-04-15',
        time: '09:30',
        price: 'R250',
        capacity: 300,
        tags: ['cybersecurity', 'sme', 'popia', 'midrand', 'workshop']
      },
      {
        title: 'Africa Venture Capital LP-GP Symposium 2027',
        desc: 'Exclusive, closed-door gathering connecting international pension funds and DFIs with general partners investing across African tech and infrastructure.',
        venue: VENUES.cticc,
        date: '2027-04-20',
        time: '09:00',
        price: 'Invitation / R1,200',
        capacity: 350,
        tags: ['venture capital', 'private equity', 'cape town', 'investors']
      },
      {
        title: 'Durban Port Logistics & Rail Freight Conclave',
        desc: 'Addressing port concession progress, Transnet rail corridor revitalization, smart crane technology, and border turnaround speed for maritime trade.',
        venue: VENUES.durban_icc,
        date: '2027-04-21',
        time: '08:30',
        price: 'R750',
        capacity: 350,
        tags: ['freight', 'rail', 'maritime', 'logistics', 'durban']
      },
      {
        title: 'Pretoria GovTech & Smart Public Services Summit',
        desc: 'Reviewing citizen digital identity adoption, municipal e-billing portals, automated licensing, and smart streetlight IoT sensor deployments.',
        venue: VENUES.menlyn_maine,
        date: '2027-04-22',
        time: '09:00',
        price: 'R700',
        capacity: 300,
        tags: ['govtech', 'smart cities', 'iot', 'pretoria']
      },
      {
        title: 'Franchising & Business Expansion Expo 2027',
        desc: 'Connecting proven fast-food, retail, fitness, and automotive franchise brands with prospective franchisees, bank funders, and leasing agents.',
        venue: VENUES.sandton_cc,
        date: '2027-04-28',
        time: '09:00',
        price: 'R350',
        capacity: 600,
        tags: ['franchising', 'business expansion', 'retail', 'sandton']
      },
      {
        title: 'Digital Health & HealthTech Southern Africa',
        desc: 'Demonstrating electronic health record interoperability, remote patient tele-monitoring, and automated medical scheme claims validation.',
        venue: VENUES.the_marc,
        date: '2027-04-29',
        time: '09:00',
        price: 'R650',
        capacity: 280,
        tags: ['healthtech', 'telemedicine', 'medical schemes', 'sandton']
      },
      {
        title: 'Southern Africa Media, Advertising & AdTech Summit',
        desc: 'Exploring retail media networks, connected TV ad spending, cookieless programmatic advertising, and local content monetization in Africa.',
        venue: VENUES.rosebank_zone,
        date: '2027-04-30',
        time: '09:30',
        price: 'R500',
        capacity: 300,
        tags: ['advertising', 'adtech', 'media', 'rosebank', 'marketing']
      }
    ]
  },

  // ── MAY 2027 ───────────────────────────────────────────────────────
  {
    month: '2027-05',
    name: 'May 2027',
    bigEvents: [
      {
        title: 'May Day Workers Celebration Music Concert',
        desc: 'Celebrate Workers\' Day with an energetic open-air festival featuring brass bands, choral groups, afro-pop royalty, and amapiano powerhouses in Soweto.',
        venue: VENUES.zone6,
        date: '2027-05-01',
        time: '12:00',
        price: 'From R100',
        capacity: 4000,
        tags: ['workers day', 'may day', 'soweto', 'zone 6', 'concert']
      },
      {
        title: 'Shimmy Autumn Sunset Session',
        desc: 'Soak up the serene autumn ocean breeze at Shimmy Beach Club. Soulful house, delicious tapas, crisp wine, and panoramic views of Table Bay harbour.',
        venue: VENUES.shimmy,
        date: '2027-05-02',
        time: '15:00',
        price: 'From R250',
        capacity: 1500,
        tags: ['shimmy beach', 'autumn', 'soulful house', 'cape town']
      },
      {
        title: 'Altitude Beach Autumn Warmup Party',
        desc: 'Fourways keeps the vibes heated. Heated outdoor pool, cozy fire pits, signature cocktails, and high-energy amapiano tracks.',
        venue: VENUES.altitude_beach,
        date: '2027-05-07',
        time: '16:00',
        price: 'From R200',
        capacity: 1200,
        tags: ['altitude beach', 'fourways', 'fire pits', 'amapiano']
      },
      {
        title: 'SunBet Arena Winter Awakening Rave',
        desc: 'Indoor warmth, booming subwoofers, and spectacular laser production. Top international and local techno and house producers rock Pretoria.',
        venue: VENUES.sunbet_arena,
        date: '2027-05-08',
        time: '19:00',
        price: '{"tier_1":"250","tier_2":"450","vip":"800"}',
        capacity: 6500,
        tags: ['rave', 'techno', 'sunbet arena', 'pretoria', 'electronic']
      },
      {
        title: 'Stellenbosch Autumn Red Wine Festival',
        desc: 'Sample the finest full-bodied Cabernet Sauvignon, Pinotage, and Shiraz vintages from over 25 premier Stellenbosch wine estates, paired with artisan cheeses and live acoustic jazz.',
        venue: VENUES.spier,
        date: '2027-05-08',
        time: '11:00',
        price: 'R350 (includes tasting glass & tokens)',
        capacity: 800,
        tags: ['wine festival', 'pinotage', 'stellenbosch', 'spier', 'autumn']
      },
      {
        title: 'Mother\'s Day Sunset Botanical Concert',
        desc: 'Honor Mom with an unforgettable Sunday concert at Kirstenbosch. Classical crossover vocalists, acoustic soul serenades, and lush garden surroundings.',
        venue: VENUES.kirstenbosch,
        date: '2027-05-09',
        time: '15:30',
        price: 'From R250 (free for children under 6)',
        capacity: 3500,
        tags: ['mothers day', 'kirstenbosch', 'family', 'cape town', 'concert']
      },
      {
        title: 'Konka May Luxury Saturday',
        desc: 'The heartbeat of VIP South African nightlife. Elite champagne presentations, star-studded crowds, and unforgettable DJ performances.',
        venue: VENUES.konka,
        date: '2027-05-14',
        time: '20:00',
        price: 'From R350',
        capacity: 1200,
        tags: ['konka', 'soweto', 'amapiano', 'vip', 'nightlife']
      },
      {
        title: 'Cabo Beach Club Sunset Beats',
        desc: 'Cape Town waterfront elegance. Fresh coastal oysters, chilled champagne, and mesmerizing deep house grooves on the waterfront deck.',
        venue: VENUES.cabo_beach,
        date: '2027-05-15',
        time: '15:00',
        price: 'From R280',
        capacity: 1600,
        tags: ['cabo beach', 'cape town', 'sunset', 'deep house']
      },
      {
        title: 'Eyadini Shisanyama & Afro-House Jam',
        desc: 'Authentic Durban township energy. Sizzling meat, top coastal DJs, and vibrant fashion in Umlazi.',
        venue: VENUES.eyadini,
        date: '2027-05-15',
        time: '12:00',
        price: 'From R150',
        capacity: 2500,
        tags: ['eyadini', 'durban', 'shisanyama', 'afro-house']
      },
      {
        title: 'The Station Parkhurst Cozy Winter Rooftop',
        desc: 'Heated rooftop canopies, artisanal mulled wine, gourmet comfort food, and warm deep melodic house tunes in Parkhurst.',
        venue: VENUES.the_station,
        date: '2027-05-16',
        time: '15:00',
        price: 'From R120',
        capacity: 500,
        tags: ['rooftop', 'parkhurst', 'winter warm-up', 'house music']
      },
      {
        title: 'Kyalami Winter Endurance Fest',
        desc: 'Motorsport excitement under crisp autumn skies. Circuit racing, paddock tours, karting competitions, and live music stages.',
        venue: VENUES.kyalami,
        date: '2027-05-21',
        time: '12:00',
        price: 'From R200',
        capacity: 4000,
        tags: ['motorsport', 'kyalami', 'midrand', 'racing', 'festival']
      },
      {
        title: 'Rosebank Winter Street Food & Craft Market',
        desc: 'Warm up with hot ramen, sizzling gourmet burgers, spicy churros, artisanal ciders, and live acoustic music in Rosebank.',
        venue: VENUES.rosebank_zone,
        date: '2027-05-22',
        time: '11:00',
        price: 'R80',
        capacity: 1800,
        tags: ['street food', 'craft market', 'rosebank', 'johannesburg']
      },
      {
        title: 'Grand Africa Café Cozy Beach Sunset',
        desc: 'Cozy indoor fireplaces, heated beach cabanas, fresh coastal seafood, and chilled ambient beats on the Granger Bay shoreline.',
        venue: VENUES.grand_africa,
        date: '2027-05-22',
        time: '16:00',
        price: 'From R220',
        capacity: 1000,
        tags: ['grand africa', 'cape town', 'beach', 'sunset', 'cozy']
      },
      {
        title: 'Max\'s Lifestyle Sunday Soul & Shisanyama',
        desc: 'Durban\'s Sunday tradition. Legendary hospitality, prime cuts of meat, luxury cars, and soothing soul music in Umlazi.',
        venue: VENUES.maxs_lifestyle,
        date: '2027-05-23',
        time: '12:00',
        price: 'From R150',
        capacity: 2500,
        tags: ['maxs lifestyle', 'durban', 'sunday soul', 'shisanyama']
      },
      {
        title: 'Africa Day Eve Unity Fest Soweto',
        desc: 'Celebrate African unity and creativity with an explosive continent-wide lineup of Afrobeats, Amapiano, Soukous, and Highlife performers.',
        venue: VENUES.zone6,
        date: '2027-05-24',
        time: '18:00',
        price: 'From R180',
        capacity: 3800,
        tags: ['africa day', 'afrobeats', 'amapiano', 'soweto', 'zone 6']
      },
      {
        title: 'Africa Day Grand Cultural Carnival',
        desc: 'A massive celebration of African music, traditional dance, fashion showcases, and culinary treasures at Constitution Hill. Pan-African unity at its best.',
        venue: VENUES.constitution_hill,
        date: '2027-05-25',
        time: '11:00',
        price: 'Free entry (RSVP Required)',
        capacity: 6000,
        tags: ['africa day', 'constitution hill', 'pan-african', 'heritage', 'carnival']
      },
      {
        title: 'Africa Day Coastal Jam Durban',
        desc: 'Celebrating Africa Day on the Durban beachfront with live music from across Southern and East Africa, craft markets, and delicious street cuisine.',
        venue: VENUES.moses_mabhida,
        date: '2027-05-25',
        time: '12:00',
        price: 'From R120',
        capacity: 4500,
        tags: ['africa day', 'durban', 'moses mabhida', 'live concert']
      },
      {
        title: 'Gqeberha Boardwalk Africa Day Showcase',
        desc: 'Celebrate Africa Day along the Eastern Cape coastline with traditional drum circles, marimba bands, and local craft vendors.',
        venue: VENUES.boardwalk,
        date: '2027-05-25',
        time: '12:00',
        price: 'From R80',
        capacity: 1500,
        tags: ['africa day', 'gqeberha', 'boardwalk', 'eastern cape']
      },
      {
        title: 'Menlyn Maine Winter Wine & Dine Gala',
        desc: 'A lavish culinary showcase pairing Pretoria\'s top chefs with award-winning winemakers. 5-course tasting menu, live jazz quintet, and charity auction.',
        venue: VENUES.menlyn_maine,
        date: '2027-05-28',
        time: '18:30',
        price: 'R650 per person',
        capacity: 600,
        tags: ['wine and dine', 'fine dining', 'pretoria', 'menlyn', 'jazz']
      },
      {
        title: 'Altitude Beach May Finale Night Swim',
        desc: 'Warm pool water, heated poolside lamps, steaming cocktails, and a blistering amapiano DJ set closing out May in Fourways.',
        venue: VENUES.altitude_beach,
        date: '2027-05-29',
        time: '17:00',
        price: 'From R200',
        capacity: 1400,
        tags: ['altitude beach', 'night swim', 'fourways', 'amapiano', 'party']
      }
    ],
    bizEvents: [
      {
        title: 'African Enterprise Technology & Cloud Summit 2027',
        desc: 'The premier enterprise tech summit gathering CIOs, CISOs, and cloud architects to discuss sovereign cloud, hybrid deployments, and enterprise AI safety.',
        venue: VENUES.sandton_cc,
        date: '2027-05-04',
        time: '08:30',
        price: 'R1,100',
        capacity: 650,
        tags: ['enterprise tech', 'cloud', 'cio', 'sandton', 'summit']
      },
      {
        title: 'Africa Trade & AfCFTA Implementation Forum',
        desc: 'Unlocking cross-border value chains under the African Continental Free Trade Area: tariff dismantlement, trade dispute resolution, and export financing.',
        venue: VENUES.durban_icc,
        date: '2027-05-06',
        time: '09:00',
        price: 'R850',
        capacity: 400,
        tags: ['afcfta', 'trade', 'export', 'durban', 'logistics']
      },
      {
        title: 'SME Accounting, Cash Flow & Payroll Masterclass',
        desc: 'Practical, high-impact strategies for small business owners: cash flow forecasting, debtor management, cloud payroll automation, and UIF compliance.',
        venue: VENUES.gallagher,
        date: '2027-05-11',
        time: '09:00',
        price: 'R250',
        capacity: 300,
        tags: ['sme', 'accounting', 'payroll', 'midrand', 'finance']
      },
      {
        title: 'Southern Africa Industrial Robotics & Automation Expo',
        desc: 'Showcasing robotic assembly lines, cobots for packaging, automated guided vehicles (AGVs), and predictive machine maintenance.',
        venue: VENUES.sandton_cc,
        date: '2027-05-13',
        time: '09:00',
        price: 'R600',
        capacity: 500,
        tags: ['robotics', 'automation', 'manufacturing', 'sandton', 'expo']
      },
      {
        title: 'Silicon Cape FinTech & WealthTech Showcase',
        desc: 'Spotlighting robo-advisory platforms, fractional investment apps, digital pensions, and algorithmic wealth management designed for African consumers.',
        venue: VENUES.cticc,
        date: '2027-05-18',
        time: '10:00',
        price: 'R400',
        capacity: 350,
        tags: ['wealthtech', 'fintech', 'startups', 'cape town']
      },
      {
        title: 'Commercial Real Estate Logistics & Warehousing Summit',
        desc: 'Addressing the surge in e-commerce fulfillment hubs, high-bay cold storage facilities, and industrial park land acquisitions across Gauteng.',
        venue: VENUES.the_marc,
        date: '2027-05-19',
        time: '09:00',
        price: 'R800',
        capacity: 300,
        tags: ['real estate', 'logistics', 'warehousing', 'sandton']
      },
      {
        title: 'Pretoria Clean Energy & EV Infrastructure Forum',
        desc: 'Focusing on high-speed DC charging corridors, grid connection approvals, and commercial fleet electrification for logistics operators.',
        venue: VENUES.menlyn_maine,
        date: '2027-05-20',
        time: '09:00',
        price: 'R750',
        capacity: 350,
        tags: ['clean energy', 'ev charging', 'fleet', 'pretoria']
      },
      {
        title: 'Africa Day Young Business Leaders & Innovators Dialogue',
        desc: 'A prestigious Africa Day forum celebrating under-35 African entrepreneurs, venture builders, and social innovators shaping the continent\'s economic future.',
        venue: VENUES.constitution_hill,
        date: '2027-05-25',
        time: '14:00',
        price: 'Free entry (Application Required)',
        capacity: 400,
        tags: ['africa day', 'young leaders', 'entrepreneurship', 'braamfontein']
      },
      {
        title: 'Women in Science, Engineering & Mining Forum',
        desc: 'Fostering mentorship, talent pipelines, and leadership acceleration for women across engineering, geological surveys, and mineral extraction.',
        venue: VENUES.sandton_cc,
        date: '2027-05-26',
        time: '08:30',
        price: 'R550',
        capacity: 300,
        tags: ['women in stem', 'mining', 'engineering', 'sandton']
      },
      {
        title: 'Digital Trust, AI Ethics & POPIA Governance Conclave',
        desc: 'Navigating algorithmic bias, synthetic data usage, automated credit decisioning, and regulatory audit readiness under South African data law.',
        venue: VENUES.the_marc,
        date: '2027-05-27',
        time: '09:00',
        price: 'R700',
        capacity: 250,
        tags: ['ai ethics', 'popia', 'data governance', 'sandton']
      }
    ]
  }
];

function generateSql() {
  const sqlStatements = [];
  sqlStatements.push(`-- Seed 180 South African Events: Dec 2026 – May 2027`);
  sqlStatements.push(`-- 6 Months x (20 Big Events + 10 Business Events) = 180 Total`);
  sqlStatements.push(`-- Author: The Gruvs Platform Admin`);
  sqlStatements.push(`\n`);

  let totalCount = 0;
  let musicImgIdx = 0;
  let bizImgIdx = 0;

  for (const monthItem of MONTH_DATA) {
    sqlStatements.push(`-- =========================================================================`);
    sqlStatements.push(`-- ${monthItem.name}: 20 Big Events + 10 Business Events`);
    sqlStatements.push(`-- =========================================================================\n`);

    // 20 Big Events
    for (const ev of monthItem.bigEvents) {
      totalCount++;
      const img = MUSIC_IMAGES[musicImgIdx % MUSIC_IMAGES.length];
      musicImgIdx++;

      const isPaid = !ev.price.toLowerCase().includes('free');
      const tagsSql = `ARRAY[${ev.tags.map(t => sqlEsc(t)).join(', ')}]`;

      sqlStatements.push(`
INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  '${AUTHOR_ID}'::uuid,
  ${sqlEsc(ev.title)},
  ${sqlEsc(ev.desc)},
  'music',
  ${tagsSql},
  ${sqlEsc(ev.venue.name)},
  ${sqlEsc(ev.venue.address)},
  ${sqlEsc(ev.venue.city)},
  'ZA',
  'Africa/Johannesburg',
  ${ev.venue.lat},
  ${ev.venue.lon},
  ${ev.venue.lat},
  ${ev.venue.lon},
  '${ev.date}'::date,
  '${ev.time}',
  ${sqlEsc(ev.price)},
  ${isPaid},
  ${ev.capacity || 1000},
  true,
  'published',
  false,
  ${sqlEsc(img)},
  ARRAY[${sqlEsc(img)}]
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = ${sqlEsc(ev.title)} AND event_date = '${ev.date}'::date AND deleted_at IS NULL
);`);
    }

    // 10 Business Events
    for (const ev of monthItem.bizEvents) {
      totalCount++;
      const img = BIZ_IMAGES[bizImgIdx % BIZ_IMAGES.length];
      bizImgIdx++;

      const isPaid = !ev.price.toLowerCase().includes('free');
      const tagsSql = `ARRAY[${ev.tags.map(t => sqlEsc(t)).join(', ')}]`;

      sqlStatements.push(`
INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  '${AUTHOR_ID}'::uuid,
  ${sqlEsc(ev.title)},
  ${sqlEsc(ev.desc)},
  'biz',
  ${tagsSql},
  ${sqlEsc(ev.venue.name)},
  ${sqlEsc(ev.venue.address)},
  ${sqlEsc(ev.venue.city)},
  'ZA',
  'Africa/Johannesburg',
  ${ev.venue.lat},
  ${ev.venue.lon},
  ${ev.venue.lat},
  ${ev.venue.lon},
  '${ev.date}'::date,
  '${ev.time}',
  ${sqlEsc(ev.price)},
  ${isPaid},
  ${ev.capacity || 500},
  true,
  'published',
  false,
  ${sqlEsc(img)},
  ARRAY[${sqlEsc(img)}]
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = ${sqlEsc(ev.title)} AND event_date = '${ev.date}'::date AND deleted_at IS NULL
);`);
    }
  }

  const outPath = path.join(__dirname, '..', 'supabase', 'seed_180_events_dec_may.sql');
  fs.writeFileSync(outPath, sqlStatements.join('\n'), 'utf8');
  console.log(`[generate_180_events] Successfully generated ${totalCount} events across 6 months into: ${outPath}`);
}

generateSql();
