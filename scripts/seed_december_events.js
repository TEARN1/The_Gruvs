/**
 * Seed script to generate authentic, high-voltage December 2026 ("Ke Dezemba")
 * mega-events across Midrand, Ivory Park, Tembisa (1632), Kempton Park, Centurion,
 * and surrounding Gauteng hubs.
 *
 * Populates:
 * 1. public/data/events-catalog.json (consumed on-demand by client app)
 * 2. supabase/queries/seed_december_gauteng_events.sql (standalone DB migration seeder)
 * 3. Appends/updates supabase/seed_global_events.sql
 */

const fs = require('fs');
const path = require('path');

const DECEMBER_EVENTS = [
  // ==========================================
  // MIDRAND
  // ==========================================
  {
    id: 'gp_dec26_midrand_altitude_launch',
    title: 'Altitude Beach Summer Kickoff 2026: White & Gold Poolside Splash',
    description: 'Midrand officially welcomes Ke Dezemba! Gauteng\'s premier luxury beach club and poolside playground kicks off the festive season with dual soundstages, synchronized pool cabanas, guest Afro-Tech selectors, live Amapiano percussionists, chilled champagne towers, and golden hour drone light shows over Waterfall City.',
    category: 'amapiano',
    event_date: '2026-12-05',
    event_time: '12:00',
    venue_name: 'Altitude Beach',
    address: 'Waterfall City, Midrand, Johannesburg',
    city: 'Midrand',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0155,
    lon: 28.1065,
    cover_url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=1200&auto=format&fit=crop',
    media_urls: [
      'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop'
    ],
    price: 'R350',
    price_amount: 350,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'General Poolside Pass', price: 350, currency: 'ZAR', capacity: 1500 },
      { name: 'VIP Deck & Backstage', price: 850, currency: 'ZAR', capacity: 250 },
      { name: 'Ultra Cabana Table (Squad of 8)', price: 4500, currency: 'ZAR', capacity: 20 }
    ],
    tags: ['midrand', 'waterfall', 'altitude beach', 'summer kickoff', 'amapiano', 'afro tech', 'pool party', 'ke dezemba', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'altitude_beach_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'altitude_beach_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    vibe_count: 840,
    rsvp_count: 610,
    capacity: 2000,
    age_min: 21,
    status: 'published',
    is_verified: true,
    is_featured: true
  },
  {
    id: 'gp_dec26_midrand_waterfall_afrohouse',
    title: 'Waterfall Sunset Afro-House & Deep Tech Gathering',
    description: 'Massive open-air lakeside amphitheatre experience under the Highveld twilight. Top international and local house tastemakers, artisan food pods, craft botanical spritz stations, and an immersive 360-degree acoustic stage at the heart of Waterfall City.',
    category: 'festival_music',
    event_date: '2026-12-11',
    event_time: '15:30',
    venue_name: 'Waterfall City Park & Amphitheatre',
    address: 'Magwa Cres, Waterfall City, Midrand',
    city: 'Midrand',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0160,
    lon: 28.1090,
    cover_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop'],
    price: 'R250',
    price_amount: 250,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Park Lawn Pass', price: 250, currency: 'ZAR', capacity: 3000 },
      { name: 'Amphitheatre Golden Circle', price: 500, currency: 'ZAR', capacity: 400 }
    ],
    tags: ['midrand', 'waterfall city', 'mall of africa', 'afro house', 'deep tech', 'music festival', 'highveld', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'waterfall_sessions',
      avatar_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'waterfall_sessions',
      avatar_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    vibe_count: 520,
    rsvp_count: 380,
    capacity: 3500,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_midrand_kyalami_supercars',
    title: 'Kyalami Grand Prix Day Fest & Supercar Soundclash',
    description: 'High-octane public holiday celebration on the Day of Reconciliation! Exotic supercars, precision drifting exhibitions, pit lane photo-ops, and an explosive main soundstage featuring South Africa\'s biggest hip-hop and amapiano headliners overlooking the legendary Kyalami track.',
    category: 'sport',
    event_date: '2026-12-16',
    event_time: '10:00',
    venue_name: 'Kyalami Grand Prix Circuit & Fan Deck',
    address: 'Cnr R55 & Allandale Rd, Kyalami, Midrand',
    city: 'Midrand',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.9970,
    lon: 28.0710,
    cover_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200&auto=format&fit=crop'],
    price: 'R280',
    price_amount: 280,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Trackside Fan Pass', price: 280, currency: 'ZAR', capacity: 4000 },
      { name: 'Clubhouse Pitlane VIP', price: 750, currency: 'ZAR', capacity: 350 }
    ],
    tags: ['midrand', 'kyalami', 'supercars', 'soundclash', 'reconciliation day', 'drifting', 'amapiano', 'hiphop', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'kyalami_motorsport',
      avatar_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 98
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'kyalami_motorsport',
      avatar_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 98
    },
    vibe_count: 940,
    rsvp_count: 730,
    capacity: 5000,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: true
  },
  {
    id: 'gp_dec26_midrand_gallagher_braai_expo',
    title: 'Gallagher Festive Expo & Gourmet Braai Fiesta 2026',
    description: 'The ultimate year-end culinary and lifestyle gathering. Over 80 artisanal braai pitmasters, smokehouse brisket stalls, craft gin and local craft beer bars, family picnic lawns, live brass jazz bands, and safe monitored parking.',
    category: 'foodfestival',
    event_date: '2026-12-18',
    event_time: '12:00',
    venue_name: 'Gallagher Convention Centre Arena & Grounds',
    address: '19 Richards Dr, Halfway House, Midrand',
    city: 'Midrand',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.9985,
    lon: 28.1285,
    cover_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop'],
    price: 'R180',
    price_amount: 180,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Day Pass (Includes Tasting Tokens)', price: 180, currency: 'ZAR', capacity: 2500 },
      { name: 'Family Package (2 Adults + 2 Kids)', price: 420, currency: 'ZAR', capacity: 300 }
    ],
    tags: ['midrand', 'gallagher', 'halfway house', 'braai', 'food festival', 'craft beer', 'family', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'gallagher_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'gallagher_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    vibe_count: 430,
    rsvp_count: 310,
    capacity: 3000,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_midrand_carlswald_sundowner',
    title: 'Carlswald Rooftop Sundowner Spritz & Nu-Soul Lounge',
    description: 'Chic, soulful Christmas Eve twilight celebration. Ice-cold Aperol spritzers, fresh oysters and artisan platters, live saxophone sessions, and smooth neo-soul vinyl DJs overlooking the northern Johannesburg skyline.',
    category: 'rooftop',
    event_date: '2026-12-24',
    event_time: '15:00',
    venue_name: 'Carlswald Lifestyle Centre Piazza & Rooftop',
    address: 'Harry Galaun Dr, Carlswald, Midrand',
    city: 'Midrand',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.9785,
    lon: 28.1180,
    cover_url: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=1200&auto=format&fit=crop'],
    price: 'R150',
    price_amount: 150,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Rooftop Access & Welcome Cocktail', price: 150, currency: 'ZAR', capacity: 400 },
      { name: 'Reserved Lounge Booth', price: 600, currency: 'ZAR', capacity: 30 }
    ],
    tags: ['midrand', 'carlswald', 'rooftop', 'sundowner', 'christmas eve', 'nu soul', 'cocktails', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'carlswald_rooftop',
      avatar_url: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'carlswald_rooftop',
      avatar_url: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    vibe_count: 360,
    rsvp_count: 240,
    capacity: 500,
    age_min: 21,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_midrand_altitude_christmas_day',
    title: 'Altitude Beach Christmas Day Luxe Pool Party',
    description: 'Spend Christmas Day poolside in high glamour! All-white beach attire, gourmet seafood and spit braais, international guest DJs, chilled magnum champagne service, and non-stop festive vibes under the warm Midrand sun.',
    category: 'amapiano',
    event_date: '2026-12-25',
    event_time: '13:00',
    venue_name: 'Altitude Beach',
    address: 'Waterfall City, Midrand, Johannesburg',
    city: 'Midrand',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0155,
    lon: 28.1065,
    cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop'],
    price: 'R400',
    price_amount: 400,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Christmas Day Pool Pass', price: 400, currency: 'ZAR', capacity: 1200 },
      { name: 'VIP Deck & Carvery Buffet', price: 950, currency: 'ZAR', capacity: 200 }
    ],
    tags: ['midrand', 'altitude beach', 'christmas day', 'pool party', 'all white', 'waterfall', 'amapiano', 'luxe', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'altitude_beach_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'altitude_beach_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    vibe_count: 720,
    rsvp_count: 530,
    capacity: 1500,
    age_min: 21,
    status: 'published',
    is_verified: true,
    is_featured: true
  },
  {
    id: 'gp_dec26_midrand_urban_shisanyama_boxing',
    title: 'Midrand Urban Shisanyama Boxing Day Chillas Linkup',
    description: 'Traditional Day of Goodwill cooler box chillas! Premium butchery braai cuts, sizzling chakalaka, car wash showcases, and deep log-drum amapiano sets rolling from midday until late into the night.',
    category: 'streetfood',
    event_date: '2026-12-26',
    event_time: '11:00',
    venue_name: 'Midrand Urban Shisanyama & Braai Lounge',
    address: 'Old Pretoria Rd, Halfway House, Midrand',
    city: 'Midrand',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.9920,
    lon: 28.1320,
    cover_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop'],
    price: 'R120',
    price_amount: 120,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'General Admission', price: 120, currency: 'ZAR', capacity: 1500 },
      { name: 'Cooler Box Pass', price: 150, currency: 'ZAR', capacity: 500 }
    ],
    tags: ['midrand', 'halfway house', 'shisanyama', 'boxing day', 'chillas', 'cooler box', 'braai', 'amapiano', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'midrand_chillas',
      avatar_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 94
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'midrand_chillas',
      avatar_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 94
    },
    vibe_count: 480,
    rsvp_count: 350,
    capacity: 2000,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_midrand_altitude_nye_2027',
    title: 'Altitude Beach NYE 2027 Countdown Extravaganza',
    description: 'Midrand\'s flagship New Year\'s Eve 2027 mega-celebration. Twin outdoor soundstages, world-class laser mapping, midnight fireworks cascade over the infinity pool, and superstar DJ headliners welcoming the new dawn.',
    category: 'amapiano',
    event_date: '2026-12-31',
    event_time: '18:00',
    venue_name: 'Altitude Beach',
    address: 'Waterfall City, Midrand, Johannesburg',
    city: 'Midrand',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0155,
    lon: 28.1065,
    cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop'],
    price: 'R500',
    price_amount: 500,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'NYE Countdown Pass', price: 500, currency: 'ZAR', capacity: 2000 },
      { name: 'VIP Grandstand & Champagne Toast', price: 1200, currency: 'ZAR', capacity: 300 }
    ],
    tags: ['midrand', 'altitude beach', 'nye 2027', 'new years eve', 'fireworks', 'waterfall', 'amapiano', 'countdown', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'altitude_beach_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'altitude_beach_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    vibe_count: 1150,
    rsvp_count: 980,
    capacity: 2500,
    age_min: 21,
    status: 'published',
    is_verified: true,
    is_featured: true
  },
  {
    id: 'gp_dec26_midrand_waterfall_nye_fireworks',
    title: 'Waterfall City NYE Midnight Fireworks & Afro-House Symphony',
    description: 'A symphonic fusion of live orchestral strings, African percussion, and soaring electronic house music. 15,000 celebrants, midnight 10-minute pyrotechnic spectacular, food truck lane, and safe park-and-ride around Mall of Africa.',
    category: 'festival_music',
    event_date: '2026-12-31',
    event_time: '19:00',
    venue_name: 'Waterfall City Park & Amphitheatre',
    address: 'Magwa Cres, Waterfall City, Midrand',
    city: 'Midrand',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0160,
    lon: 28.1090,
    cover_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop'],
    price: 'R350',
    price_amount: 350,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'General Lawn Seating', price: 350, currency: 'ZAR', capacity: 8000 },
      { name: 'Golden Circle Stage Pass', price: 700, currency: 'ZAR', capacity: 1000 }
    ],
    tags: ['midrand', 'waterfall', 'mall of africa', 'nye 2027', 'fireworks', 'afro house', 'symphony', 'orchestra', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'waterfall_sessions',
      avatar_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'waterfall_sessions',
      avatar_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    vibe_count: 890,
    rsvp_count: 720,
    capacity: 10000,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: true
  },

  // ==========================================
  // TEMBISA (1632)
  // ==========================================
  {
    id: 'gp_dec26_tembisa_hangawt_launch',
    title: '1632 Amapiano Fest: The Log-Drum Season Launch',
    description: 'The iconic heart of 1632 lifestyle kicks off December! Premium bottle service, rooftop VIP deck, live broadcast rigs, and relentless Bacardi & log-drum sets by the pioneers of the sound in Hospital View.',
    category: 'amapiano',
    event_date: '2026-12-05',
    event_time: '14:00',
    venue_name: 'The Hang Awt 1632',
    address: 'Dan Tloome St, Endayini, Hospital View, Tembisa',
    city: 'Tembisa',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0120,
    lon: 28.2150,
    cover_url: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1200&auto=format&fit=crop'],
    price: 'R150',
    price_amount: 150,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'General Admission', price: 150, currency: 'ZAR', capacity: 1800 },
      { name: 'VIP Sky Deck Access', price: 450, currency: 'ZAR', capacity: 200 }
    ],
    tags: ['tembisa', '1632', 'the hang awt', 'hospital view', 'amapiano', 'bacardi', 'ke dezemba', 'log drum', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'hang_awt_1632',
      avatar_url: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'hang_awt_1632',
      avatar_url: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    vibe_count: 980,
    rsvp_count: 810,
    capacity: 2200,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: true
  },
  {
    id: 'gp_dec26_tembisa_busy_corner_feast',
    title: 'Busy Corner Imbizo Shisanyama Year-End Afro-Soul & Braai Feast',
    description: 'Africa\'s world-famous shisanyama commercial feast. Succulent charcoal braai platters, traditional pap and chakalaka, live township jazz & neo-soul bands, VIP cigar lounge, and genuine Highveld hospitality in Ebony Park / Tembisa.',
    category: 'streetfood',
    event_date: '2026-12-12',
    event_time: '12:00',
    venue_name: 'Busy Corner Imbizo Shisanyama',
    address: 'Cnr Main & 29 September St, Ebony Park, Tembisa',
    city: 'Tembisa',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.9935,
    lon: 28.1880,
    cover_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop'],
    price: 'Free Admission',
    price_amount: 0,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Standard Table Reservation', price: 0, currency: 'ZAR', capacity: 2000 },
      { name: 'VIP Executive Patio Booking', price: 500, currency: 'ZAR', capacity: 150 }
    ],
    tags: ['tembisa', 'ebony park', 'busy corner', 'imbizo shisanyama', 'braai', 'afro soul', 'food', 'lifestyle', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'busy_corner_imbizo',
      avatar_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 98
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'busy_corner_imbizo',
      avatar_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 98
    },
    vibe_count: 670,
    rsvp_count: 490,
    capacity: 2500,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_tembisa_mehlareng_all_white',
    title: 'Tembisa All-White Reconciliation Day Mega Festival 2026',
    description: 'Over 20,000 music lovers dressed in pristine all-white! Tembisa\'s biggest annual stadium gathering featuring 20+ live acts, massive sound towers, helicopter entrances, food village, and high-security park-and-ride at Mehlareng Stadium.',
    category: 'festival_music',
    event_date: '2026-12-16',
    event_time: '11:00',
    venue_name: 'Mehlareng Stadium',
    address: 'Rev RTJ Namane Dr, Teanong, Tembisa',
    city: 'Tembisa',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0185,
    lon: 28.2230,
    cover_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop'],
    price: 'R220',
    price_amount: 220,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Stadium Pitch Pass', price: 220, currency: 'ZAR', capacity: 15000 },
      { name: 'Golden Circle Stage Front', price: 450, currency: 'ZAR', capacity: 1500 },
      { name: 'VVIP Hospitality Marquee', price: 1200, currency: 'ZAR', capacity: 300 }
    ],
    tags: ['tembisa', 'mehlareng stadium', 'all white', 'reconciliation day', 'festival', 'amapiano', 'stadium', '1632', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'tembisa_mega_events',
      avatar_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'tembisa_mega_events',
      avatar_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    vibe_count: 1450,
    rsvp_count: 1210,
    capacity: 20000,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: true
  },
  {
    id: 'gp_dec26_tembisa_caprivi_sunset',
    title: 'Caprivi Lounge 1632 Summer Sunset Sessions',
    description: 'Sleek township elegance meets deep house & Afro-soul. Premium cocktail mixology, VIP bottle show parades, chilled outdoor lounge cabanas, and sunset golden hour sets in Esselen Park.',
    category: 'rooftop',
    event_date: '2026-12-19',
    event_time: '16:00',
    venue_name: 'Caprivi Lounge Tembisa',
    address: 'Esselen Park, Tembisa',
    city: 'Tembisa',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0020,
    lon: 28.2240,
    cover_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=1200&auto=format&fit=crop'],
    price: 'R150',
    price_amount: 150,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'General Entry', price: 150, currency: 'ZAR', capacity: 600 },
      { name: 'VIP Cabana Table', price: 800, currency: 'ZAR', capacity: 40 }
    ],
    tags: ['tembisa', 'caprivi lounge', 'esselen park', 'deep house', 'cocktails', 'nightlife', '1632', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'caprivi_tembisa',
      avatar_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'caprivi_tembisa',
      avatar_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    vibe_count: 390,
    rsvp_count: 270,
    capacity: 700,
    age_min: 21,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_tembisa_makhulong_carnival',
    title: 'Makhulong 1632 Festive Football & Music Carnival',
    description: 'High-stakes festive township soccer tournament finals followed immediately by a giant outdoor music concert on the stadium pitch. Local street food vendors, cheer squads, and live amapiano anthems at Makhulong Stadium.',
    category: 'sport',
    event_date: '2026-12-20',
    event_time: '10:00',
    venue_name: 'Makhulong Stadium',
    address: 'Star St, Makulong Section, Tembisa',
    city: 'Tembisa',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0105,
    lon: 28.2285,
    cover_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop'],
    price: 'R100',
    price_amount: 100,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Match & Concert Grandstand Pass', price: 100, currency: 'ZAR', capacity: 10000 },
      { name: 'Pitchside Fan Zone', price: 250, currency: 'ZAR', capacity: 800 }
    ],
    tags: ['tembisa', 'makhulong stadium', 'football', 'soccer', 'carnival', 'amapiano', 'kwaito', '1632', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'tembisa_sports_fest',
      avatar_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'tembisa_sports_fest',
      avatar_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    vibe_count: 610,
    rsvp_count: 460,
    capacity: 12000,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_tembisa_hangawt_xmas_eve',
    title: 'The Hang Awt Christmas Eve Piano All-Nighter',
    description: 'The signature Christmas Eve experience in Tembisa. Log-drum bass vibrations until sunrise, superstar surprise guest appearances, bottle showers, and the pure electric spirit of 1632.',
    category: 'amapiano',
    event_date: '2026-12-24',
    event_time: '18:00',
    venue_name: 'The Hang Awt 1632',
    address: 'Dan Tloome St, Hospital View, Tembisa',
    city: 'Tembisa',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0120,
    lon: 28.2150,
    cover_url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1200&auto=format&fit=crop'],
    price: 'R200',
    price_amount: 200,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Christmas Eve Pass', price: 200, currency: 'ZAR', capacity: 1500 },
      { name: 'VIP Deck Access', price: 500, currency: 'ZAR', capacity: 200 }
    ],
    tags: ['tembisa', 'the hang awt', 'christmas eve', 'amapiano', 'all nighter', '1632', 'nightlife', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'hang_awt_1632',
      avatar_url: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'hang_awt_1632',
      avatar_url: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    vibe_count: 880,
    rsvp_count: 740,
    capacity: 2000,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: true
  },
  {
    id: 'gp_dec26_tembisa_busy_corner_xmas_day',
    title: 'Busy Corner Legendary Christmas Day Township Banquet',
    description: 'Gather your entire family and squad for the grandest Christmas Day braai feast in South Africa. Authentic charcoal-grilled short ribs, brisket, wors, steamed dumplings, live brass bands, and festive joy in Ebony Park.',
    category: 'streetfood',
    event_date: '2026-12-25',
    event_time: '11:00',
    venue_name: 'Busy Corner Imbizo Shisanyama',
    address: 'Cnr Main & 29 September St, Ebony Park, Tembisa',
    city: 'Tembisa',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.9935,
    lon: 28.1880,
    cover_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop'],
    price: 'Free Admission',
    price_amount: 0,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Family Table Booking', price: 0, currency: 'ZAR', capacity: 2500 }
    ],
    tags: ['tembisa', 'busy corner', 'christmas day', 'family feast', 'shisanyama', 'braai', 'ebony park', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'busy_corner_imbizo',
      avatar_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 98
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'busy_corner_imbizo',
      avatar_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 98
    },
    vibe_count: 590,
    rsvp_count: 420,
    capacity: 2500,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_tembisa_ethafeni_boxing_spin',
    title: 'Tembisa Day of Goodwill Street Spin & Sound Battle',
    description: 'Adrenaline-fueled spinning culture! South Africa\'s finest BMW 325i "Gusheshe" drivers doing precision burnouts, tire smoke shows, and twin sound truck DJ battles with bass that shakes the ground.',
    category: 'sport',
    event_date: '2026-12-26',
    event_time: '12:00',
    venue_name: 'Ethafeni Sports Complex & Arena',
    address: 'Ethafeni Section, Tembisa',
    city: 'Tembisa',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0250,
    lon: 28.2190,
    cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop'],
    price: 'R150',
    price_amount: 150,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Arena General Admission', price: 150, currency: 'ZAR', capacity: 3500 },
      { name: 'Pit Grandstand Pass', price: 300, currency: 'ZAR', capacity: 400 }
    ],
    tags: ['tembisa', 'ethafeni', 'spinning', 'gusheshe', 'boxing day', 'sound battle', 'amapiano', '1632', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'tembisa_spin_kings',
      avatar_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'tembisa_spin_kings',
      avatar_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    vibe_count: 730,
    rsvp_count: 550,
    capacity: 4000,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_tembisa_hangawt_nye_2027',
    title: 'The Hang Awt 1632 NYE 2027 Grand Piano Finale',
    description: 'Say farewell to 2026 at the undisputed palace of Amapiano! Midnight confetti cannon showers, laser mapping, live streaming across Mzansi, and a 14-hour marathon of world-dominating South African rhythms.',
    category: 'amapiano',
    event_date: '2026-12-31',
    event_time: '17:00',
    venue_name: 'The Hang Awt 1632',
    address: 'Dan Tloome St, Hospital View, Tembisa',
    city: 'Tembisa',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0120,
    lon: 28.2150,
    cover_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop'],
    price: 'R300',
    price_amount: 300,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'NYE Countdown Pass', price: 300, currency: 'ZAR', capacity: 2000 },
      { name: 'VIP Deck & Midnight Toast', price: 750, currency: 'ZAR', capacity: 250 }
    ],
    tags: ['tembisa', 'the hang awt', 'nye 2027', 'new years eve', 'amapiano', '1632', 'hospital view', 'countdown', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'hang_awt_1632',
      avatar_url: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'hang_awt_1632',
      avatar_url: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    vibe_count: 1320,
    rsvp_count: 1140,
    capacity: 2500,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: true
  },

  // ==========================================
  // IVORY PARK
  // ==========================================
  {
    id: 'gp_dec26_ivorypark_swazi_inn_welcome',
    title: 'Swazi Inn December Welcome Bash & Cooler Box Explosion',
    description: 'Welcome to December in Ivory Park! Cooler boxes allowed before 6 PM, monster mobile sound rigs, local braai master showdowns, and high-energy Bacardi and log-drum sets that electrify Ext 7.',
    category: 'amapiano',
    event_date: '2026-12-04',
    event_time: '15:00',
    venue_name: 'Swazi Inn Lifestyle Park & Car Wash',
    address: 'Swazi Inn Commercial Hub, Ivory Park Ext 7',
    city: 'Ivory Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0160,
    lon: 28.1860,
    cover_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop'],
    price: 'R80',
    price_amount: 80,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'General Entry', price: 80, currency: 'ZAR', capacity: 2500 },
      { name: 'Cooler Box Pass (Before 6PM)', price: 100, currency: 'ZAR', capacity: 800 }
    ],
    tags: ['ivory park', 'swazi inn', 'ext 7', 'cooler box', 'amapiano', 'bacardi', 'ke dezemba', 'braai', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'swazi_inn_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'swazi_inn_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    vibe_count: 540,
    rsvp_count: 420,
    capacity: 3000,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_ivorypark_lord_khanyile_clash',
    title: 'Ivory Park Ext 2 Community Amapiano Soundclash',
    description: 'The raw sound of township talent! 12 rising producers and DJs clash for the crown of Ivory Park\'s King of the Log-Drum. Massive open-air stage, street dancers, and youth entrepreneur market at Lord Khanyile Grounds.',
    category: 'amapiano',
    event_date: '2026-12-11',
    event_time: '16:00',
    venue_name: 'Lord Khanyile Community Centre Grounds',
    address: 'Ivory Park Ext 2, Midrand border, Ivory Park',
    city: 'Ivory Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0045,
    lon: 28.1795,
    cover_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop'],
    price: 'R60',
    price_amount: 60,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Community Pass', price: 60, currency: 'ZAR', capacity: 2000 }
    ],
    tags: ['ivory park', 'ext 2', 'lord khanyile', 'soundclash', 'amapiano', 'dance', 'youth', 'dj battle', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'ivory_park_youth',
      avatar_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'ivory_park_youth',
      avatar_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    vibe_count: 410,
    rsvp_count: 290,
    capacity: 2500,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_ivorypark_kopanong_reconciliation',
    title: 'Kopanong Reconciliation Day Street Carnival & Braai Fest',
    description: 'The premier public holiday carnival in Ivory Park! Street parade with marching brass bands, giant outdoor braai pits, traditional dancers, 5-a-side soccer showdowns, and sunset live concerts at Kopanong Sports Grounds.',
    category: 'festival_music',
    event_date: '2026-12-16',
    event_time: '10:00',
    venue_name: 'Kopanong Sports Grounds & Civic Arena',
    address: 'Freedom Dr, Ivory Park Ext 2',
    city: 'Ivory Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0090,
    lon: 28.1820,
    cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop'],
    price: 'R100',
    price_amount: 100,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Carnival Entry (Kids under 12 Free)', price: 100, currency: 'ZAR', capacity: 6000 }
    ],
    tags: ['ivory park', 'kopanong', 'reconciliation day', 'carnival', 'braai', 'music festival', 'ext 2', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'kopanong_culture',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 98
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'kopanong_culture',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 98
    },
    vibe_count: 810,
    rsvp_count: 670,
    capacity: 7500,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: true
  },
  {
    id: 'gp_dec26_ivorypark_ext9_bacardi_dance',
    title: 'Ivory Park Ext 9 Bacardi & Street Dance Championship',
    description: 'Electrifying footwork, viral dance challenges, and raw Pretoria Bacardi beats! Dance crews from Ivory Park, Tembisa, and Mamelodi battle it out for R50,000 in cash prizes. Pure high-energy culture.',
    category: 'amapiano',
    event_date: '2026-12-19',
    event_time: '13:00',
    venue_name: 'Ivory Park Ext 9 Open-Air Arena',
    address: 'Ivory Park Ext 9, Ivory Park',
    city: 'Ivory Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0220,
    lon: 28.1750,
    cover_url: 'https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=1200&auto=format&fit=crop'],
    price: 'R70',
    price_amount: 70,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Spectator Pass', price: 70, currency: 'ZAR', capacity: 2500 }
    ],
    tags: ['ivory park', 'ext 9', 'bacardi', 'dance championship', 'viral dance', 'street dance', 'amapiano', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'ivory_park_youth',
      avatar_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'ivory_park_youth',
      avatar_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    vibe_count: 530,
    rsvp_count: 390,
    capacity: 3000,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_ivorypark_swazi_inn_xmas_eve',
    title: 'Ivory Park Ext 7 Christmas Eve Community Glow',
    description: 'Christmas Eve festive lights and community warmth. Lantern lighting ceremony, live gospel & soulful amapiano choir, food stalls with traditional potjiekos, and joyful community carols.',
    category: 'festival_music',
    event_date: '2026-12-24',
    event_time: '17:00',
    venue_name: 'Swazi Inn Lifestyle Park',
    address: 'Swazi Inn Commercial Hub, Ivory Park Ext 7',
    city: 'Ivory Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0160,
    lon: 28.1860,
    cover_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop'],
    price: 'Free Admission',
    price_amount: 0,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Community Entry', price: 0, currency: 'ZAR', capacity: 2000 }
    ],
    tags: ['ivory park', 'swazi inn', 'ext 7', 'christmas eve', 'community glow', 'gospel', 'carols', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'swazi_inn_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'swazi_inn_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    vibe_count: 360,
    rsvp_count: 260,
    capacity: 2500,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_ivorypark_kopanong_xmas_day',
    title: 'Kopanong Christmas Day Family & Friends Shisanyama Feast',
    description: 'Celebrate Christmas Day under the African shade trees! Bring your blankets, camping chairs, and picnic baskets. Large communal charcoal grills provided, live DJ sets, jumping castles for kids in Ext 2.',
    category: 'streetfood',
    event_date: '2026-12-25',
    event_time: '12:00',
    venue_name: 'Kopanong Sports Grounds & Civic Lawns',
    address: 'Freedom Dr, Ivory Park Ext 2',
    city: 'Ivory Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0090,
    lon: 28.1820,
    cover_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop'],
    price: 'R50',
    price_amount: 50,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Family Pass', price: 50, currency: 'ZAR', capacity: 3500 },
      { name: 'Cooler Box Pass', price: 80, currency: 'ZAR', capacity: 1000 }
    ],
    tags: ['ivory park', 'kopanong', 'christmas day', 'family braai', 'shisanyama', 'picnic', 'ext 2', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'kopanong_culture',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 98
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'kopanong_culture',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 98
    },
    vibe_count: 510,
    rsvp_count: 390,
    capacity: 4000,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_ivorypark_swazi_inn_boxing_trucks',
    title: 'Swazi Inn Day of Goodwill Sound Truck Showdown & Car Spin',
    description: 'The biggest Boxing Day spectacle in Ivory Park! 4 monster sound trucks with 50,000 watts of crystal-clear bass, tire-shredding BMW 325i spinning displays, and high-energy smoke shows in Ext 7.',
    category: 'sport',
    event_date: '2026-12-26',
    event_time: '12:00',
    venue_name: 'Swazi Inn Commercial Hub & Parking Arena',
    address: 'Swazi Inn Commercial Hub, Ivory Park Ext 7',
    city: 'Ivory Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0160,
    lon: 28.1860,
    cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop'],
    price: 'R120',
    price_amount: 120,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'General Arena Entry', price: 120, currency: 'ZAR', capacity: 3000 }
    ],
    tags: ['ivory park', 'swazi inn', 'boxing day', 'day of goodwill', 'spinning', 'sound truck', 'gusheshe', 'amapiano', 'ext 7', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'swazi_inn_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'swazi_inn_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    vibe_count: 670,
    rsvp_count: 510,
    capacity: 3500,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_ivorypark_kopanong_nye_2027',
    title: 'Ivory Park NYE Midnight Street Countdown & Fireworks 2027',
    description: 'Ivory Park\'s official New Year\'s Eve countdown celebration! Giant LED countdown clock, midnight 15-minute fireworks display lighting up the entire township sky, and non-stop music until 6 AM.',
    category: 'festival_music',
    event_date: '2026-12-31',
    event_time: '18:00',
    venue_name: 'Kopanong Sports Grounds',
    address: 'Freedom Dr, Ivory Park Ext 2',
    city: 'Ivory Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0090,
    lon: 28.1820,
    cover_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop'],
    price: 'R150',
    price_amount: 150,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'NYE Countdown Pass', price: 150, currency: 'ZAR', capacity: 7000 },
      { name: 'VIP Grandstand & Toast', price: 400, currency: 'ZAR', capacity: 300 }
    ],
    tags: ['ivory park', 'kopanong', 'nye 2027', 'new years eve', 'fireworks', 'midnight countdown', 'ext 2', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'kopanong_culture',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 98
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'kopanong_culture',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 98
    },
    vibe_count: 990,
    rsvp_count: 820,
    capacity: 8000,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: true
  },

  // ==========================================
  // KEMPTON PARK
  // ==========================================
  {
    id: 'gp_dec26_kempton_emperors_lights',
    title: 'Emperors Palace Garden of Lights 2026 Grand Opening',
    description: 'Over one million sparkling holiday lights transform the D\'oreale Grande gardens into an enchanted wonderland! Light tunnels, festive fairy-tale displays, Santa\'s workshop, live orchestra, and holiday treats in Kempton Park.',
    category: 'festival_music',
    event_date: '2026-12-04',
    event_time: '17:30',
    venue_name: 'Emperors Palace Resort & Lawns',
    address: '64 Jones Rd, Kempton Park',
    city: 'Kempton Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.1465,
    lon: 28.2235,
    cover_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop'],
    price: 'R120',
    price_amount: 120,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Adult Garden Access', price: 120, currency: 'ZAR', capacity: 3500 },
      { name: 'Child Access (Under 12)', price: 70, currency: 'ZAR', capacity: 1500 }
    ],
    tags: ['kempton park', 'emperors palace', 'garden of lights', 'family', 'holiday lights', 'christmas', 'east rand', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'emperors_palace',
      avatar_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'emperors_palace',
      avatar_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    vibe_count: 870,
    rsvp_count: 650,
    capacity: 5000,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: true
  },
  {
    id: 'gp_dec26_kempton_dries_niemandt_picnic',
    title: 'Dries Niemandt Lakeside Music & Summer Picnic Fest',
    description: 'Scenic lakeside lawns, gentle Highveld summer breeze, and top-tier South African live bands. Chilled picnic setups, craft gin bars, gourmet food trucks, and acoustic sunset sessions at Dries Niemandt Park.',
    category: 'festival_music',
    event_date: '2026-12-12',
    event_time: '12:00',
    venue_name: 'Dries Niemandt Park & Lakeside Arena',
    address: 'CR Swart Dr & Kelvin St, Kempton Park',
    city: 'Kempton Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.1040,
    lon: 28.2290,
    cover_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop'],
    price: 'R180',
    price_amount: 180,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Lakeside Lawn Ticket', price: 180, currency: 'ZAR', capacity: 2500 },
      { name: 'VIP Deck & Complimentary Wine', price: 450, currency: 'ZAR', capacity: 200 }
    ],
    tags: ['kempton park', 'dries niemandt', 'lakeside', 'picnic fest', 'live music', 'craft gin', 'family', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'kempton_live',
      avatar_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'kempton_live',
      avatar_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    vibe_count: 520,
    rsvp_count: 380,
    capacity: 3000,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_kempton_birchwood_jazz',
    title: 'Ekurhuleni Reconciliation Day Soul & Jazz Festival',
    description: 'The celebrated "Ekurhuleni Comes Alive" heritage edition. World-class African jazz masters, soul songstresses, 3-course banquet dining, and sophisticated celebration of South African unity at Birchwood Hotel grounds.',
    category: 'liveband',
    event_date: '2026-12-16',
    event_time: '11:00',
    venue_name: 'Birchwood Hotel & OR Tambo Lawns',
    address: '44 Viewpoint St, Bartlett, Kempton Park border',
    city: 'Kempton Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.1715,
    lon: 28.2520,
    cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop'],
    price: 'R350',
    price_amount: 350,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Festival Lawn Ticket', price: 350, currency: 'ZAR', capacity: 2000 },
      { name: 'VIP Banquet & Meet-the-Artist', price: 850, currency: 'ZAR', capacity: 250 }
    ],
    tags: ['kempton park', 'birchwood', 'ekurhuleni', 'jazz', 'soul', 'reconciliation day', 'live band', 'heritage', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'birchwood_events',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'birchwood_events',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    vibe_count: 640,
    rsvp_count: 480,
    capacity: 2500,
    age_min: 21,
    status: 'published',
    is_verified: true,
    is_featured: true
  },
  {
    id: 'gp_dec26_kempton_red_roman_rave',
    title: 'Kempton Park Red Roman Shed Deep House & Techno Rave',
    description: 'Industrial acoustics meet warehouse party intensity inside the Red Roman Shed. 30,000 watts of Funktion-One sound, hypnotizing laser grids, and cutting-edge deep tech and melodic techno selectors.',
    category: 'rave',
    event_date: '2026-12-18',
    event_time: '20:00',
    venue_name: 'Red Roman Shed at Emperors Palace',
    address: '64 Jones Rd, Kempton Park',
    city: 'Kempton Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.1465,
    lon: 28.2235,
    cover_url: 'https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=1200&auto=format&fit=crop'],
    price: 'R250',
    price_amount: 250,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'General Warehouse Pass', price: 250, currency: 'ZAR', capacity: 1500 },
      { name: 'VIP Mezzanine Deck', price: 550, currency: 'ZAR', capacity: 150 }
    ],
    tags: ['kempton park', 'emperors palace', 'red roman shed', 'rave', 'techno', 'deep house', 'nightlife', 'warehouse', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'red_roman_underground',
      avatar_url: 'https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'red_roman_underground',
      avatar_url: 'https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    vibe_count: 580,
    rsvp_count: 420,
    capacity: 1800,
    age_min: 21,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_kempton_bonaero_sundowner',
    title: 'Bonaero Park Sunset Plane-Spotter Deep House Session',
    description: 'Watch international jumbo jets take off into the golden hour sunset against the OR Tambo horizon while sipping bespoke botanical cocktails. Chilled melodic deep house and festive holiday tapas on the skydeck.',
    category: 'rooftop',
    event_date: '2026-12-24',
    event_time: '16:00',
    venue_name: 'Bonaero Park Sunset Deck & Sky Lounge',
    address: 'Atlas Rd, Bonaero Park, Kempton Park',
    city: 'Kempton Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.1290,
    lon: 28.2720,
    cover_url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=1200&auto=format&fit=crop'],
    price: 'R160',
    price_amount: 160,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Skydeck Access & Cocktail', price: 160, currency: 'ZAR', capacity: 350 }
    ],
    tags: ['kempton park', 'bonaero park', 'plane spotter', 'or tambo', 'sundowner', 'deep house', 'christmas eve', 'cocktails', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'bonaero_skydeck',
      avatar_url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'bonaero_skydeck',
      avatar_url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    vibe_count: 320,
    rsvp_count: 210,
    capacity: 400,
    age_min: 21,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_kempton_emperors_royal_buffet',
    title: 'Emperors Palace Christmas Day Royal Buffet & Carols',
    description: 'A lavish Christmas Day culinary showcase with roasted carvery, fresh oysters, festive puddings, and live gospel carolers. Safe indoor resort atmosphere with casino, cinema, and kids entertainment.',
    category: 'foodfestival',
    event_date: '2026-12-25',
    event_time: '12:00',
    venue_name: 'Emperors Palace Convention Centre',
    address: '64 Jones Rd, Kempton Park',
    city: 'Kempton Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.1465,
    lon: 28.2235,
    cover_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop'],
    price: 'R550',
    price_amount: 550,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Adult Buffet Ticket', price: 550, currency: 'ZAR', capacity: 1200 },
      { name: 'Kids Buffet (Under 12)', price: 250, currency: 'ZAR', capacity: 400 }
    ],
    tags: ['kempton park', 'emperors palace', 'christmas day', 'royal buffet', 'carols', 'family feast', 'dining', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'emperors_palace',
      avatar_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'emperors_palace',
      avatar_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    vibe_count: 530,
    rsvp_count: 410,
    capacity: 1600,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_kempton_dries_niemandt_boxing',
    title: 'Dries Niemandt Boxing Day Cooler Box & Food Truck Fiesta',
    description: 'Pack your cooler box and gazebos for the biggest lakeside Boxing Day party on the East Rand! Live amapiano and kwaito stages, smoke braai pits, and vibrant community vibes.',
    category: 'streetfood',
    event_date: '2026-12-26',
    event_time: '11:00',
    venue_name: 'Dries Niemandt Park',
    address: 'Kelvin St & CR Swart Dr, Kempton Park',
    city: 'Kempton Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.1040,
    lon: 28.2290,
    cover_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop'],
    price: 'R120',
    price_amount: 120,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Park Admission', price: 120, currency: 'ZAR', capacity: 3500 },
      { name: 'Cooler Box Permit', price: 150, currency: 'ZAR', capacity: 1000 }
    ],
    tags: ['kempton park', 'dries niemandt', 'boxing day', 'cooler box', 'food truck', 'braai', 'amapiano', 'lakeside', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'kempton_live',
      avatar_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'kempton_live',
      avatar_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    vibe_count: 690,
    rsvp_count: 510,
    capacity: 4500,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_kempton_emperors_red_roman_nye',
    title: 'Emperors Palace Red Roman Shed NYE 2027 Golden Masquerade Ball',
    description: 'Glamorous black-tie and mask New Year\'s Eve celebration. Champagne toast at midnight, casino floor action, dual stages of high-energy commercial anthems and private school amapiano.',
    category: 'rave',
    event_date: '2026-12-31',
    event_time: '19:00',
    venue_name: 'Red Roman Shed at Emperors Palace',
    address: '64 Jones Rd, Kempton Park',
    city: 'Kempton Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.1465,
    lon: 28.2235,
    cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop'],
    price: 'R450',
    price_amount: 450,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Masquerade Ball Pass', price: 450, currency: 'ZAR', capacity: 2000 },
      { name: 'VIP Casino & Champagne Deck', price: 950, currency: 'ZAR', capacity: 250 }
    ],
    tags: ['kempton park', 'emperors palace', 'red roman shed', 'nye 2027', 'masquerade ball', 'new years eve', 'amapiano', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'emperors_palace',
      avatar_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'emperors_palace',
      avatar_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    vibe_count: 1040,
    rsvp_count: 890,
    capacity: 2500,
    age_min: 21,
    status: 'published',
    is_verified: true,
    is_featured: true
  },
  {
    id: 'gp_dec26_kempton_dries_niemandt_nye',
    title: 'Kempton Park Lakeside NYE Family Fireworks Spectacular 2027',
    description: 'Ring in 2027 by the tranquil lake waters! Giant family concert, live stage with Ekurhuleni\'s finest musical acts, illuminated food truck avenue, and midnight fireworks reflecting off the lake.',
    category: 'festival_music',
    event_date: '2026-12-31',
    event_time: '17:00',
    venue_name: 'Dries Niemandt Park & Lake Arena',
    address: 'CR Swart Dr & Kelvin St, Kempton Park',
    city: 'Kempton Park',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.1040,
    lon: 28.2290,
    cover_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop'],
    price: 'R180',
    price_amount: 180,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Family Lawn Pass (Adult)', price: 180, currency: 'ZAR', capacity: 5000 },
      { name: 'Kids Pass (Under 12)', price: 90, currency: 'ZAR', capacity: 2000 }
    ],
    tags: ['kempton park', 'dries niemandt', 'lakeside', 'nye 2027', 'fireworks', 'family', 'new years eve', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'kempton_live',
      avatar_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'kempton_live',
      avatar_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    vibe_count: 820,
    rsvp_count: 660,
    capacity: 7000,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: true
  },

  // ==========================================
  // CENTURION
  // ==========================================
  {
    id: 'gp_dec26_centurion_shisanyama_kickoff',
    title: 'Centurion Summer Kickoff: Shisanyama & Bacardi Bass Fest',
    description: 'Tshwane basslines meet succulent braai meat! High-energy Bacardi soundclash, revving sports cars, VIP ice-bucket service, and the undeniable groove of the capital\'s southern playground in Centurion.',
    category: 'amapiano',
    event_date: '2026-12-05',
    event_time: '13:00',
    venue_name: 'Centurion Shisanyama & Car Wash',
    address: 'Botha Ave & Hendrik Verwoerd Dr, Centurion',
    city: 'Centurion',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.8490,
    lon: 28.1960,
    cover_url: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1200&auto=format&fit=crop'],
    price: 'R150',
    price_amount: 150,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'General Entry', price: 150, currency: 'ZAR', capacity: 2000 },
      { name: 'VIP Deck & Ice Bucket Service', price: 500, currency: 'ZAR', capacity: 150 }
    ],
    tags: ['centurion', 'centurion shisanyama', 'bacardi', 'amapiano', 'summer kickoff', 'car wash', 'braai', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'centurion_groove',
      avatar_url: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'centurion_groove',
      avatar_url: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    vibe_count: 640,
    rsvp_count: 490,
    capacity: 2500,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_centurion_irene_farm_market',
    title: 'Irene Farm Artisan Gin & Craft Beer Summer Market',
    description: 'Historic countryside dairy estate surrounded by centuries-old oak trees. 50+ craft gin distilleries, microbreweries, artisanal cheeses, farm-to-table gourmet burgers, and acoustic folk music in Irene.',
    category: 'foodfestival',
    event_date: '2026-12-12',
    event_time: '10:00',
    venue_name: 'Irene Farm & Dairy Lawns',
    address: 'Nellmapius Dr, Irene, Centurion',
    city: 'Centurion',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.8780,
    lon: 28.2140,
    cover_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop'],
    price: 'R120',
    price_amount: 120,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Market Pass + Tasting Glass', price: 120, currency: 'ZAR', capacity: 2500 }
    ],
    tags: ['centurion', 'irene', 'irene farm', 'craft beer', 'artisan gin', 'food market', 'family', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'irene_farm_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'irene_farm_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    vibe_count: 480,
    rsvp_count: 350,
    capacity: 3000,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_centurion_supersport_soundclash',
    title: 'SuperSport Park Reconciliation Day Summer Soundclash 2026',
    description: 'Cricket stadium grass-bank festival with 18,000 celebrants! Major South African headliners spanning Amapiano, Afro-Pop, and Rock. Giant LED towers, beer garden, and festive family zones at SuperSport Park.',
    category: 'festival_music',
    event_date: '2026-12-16',
    event_time: '11:00',
    venue_name: 'SuperSport Park Cricket Stadium Lawns & Fan Zone',
    address: '283 West Ave, Centurion',
    city: 'Centurion',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.8600,
    lon: 28.1970,
    cover_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop'],
    price: 'R250',
    price_amount: 250,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Grass Embankment Pass', price: 200, currency: 'ZAR', capacity: 12000 },
      { name: 'Grandstand Reserved', price: 350, currency: 'ZAR', capacity: 4000 },
      { name: 'Presidential Suite Hospitality', price: 1100, currency: 'ZAR', capacity: 250 }
    ],
    tags: ['centurion', 'supersport park', 'soundclash', 'reconciliation day', 'stadium festival', 'amapiano', 'rock', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'supersport_stadium_events',
      avatar_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'supersport_stadium_events',
      avatar_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    vibe_count: 1220,
    rsvp_count: 1040,
    capacity: 18000,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: true
  },
  {
    id: 'gp_dec26_centurion_lake_night_market',
    title: 'Centurion Lake Promenade Night Market & Food Truck Village',
    description: 'Stroll along the illuminated Centurion Lake boardwalk! 40 gourmet food trucks, handmade fashion & jewellery pop-ups, craft cocktail bars, and open-air acoustic & saxophone performances.',
    category: 'streetfood',
    event_date: '2026-12-19',
    event_time: '16:00',
    venue_name: 'Centurion Lake Promenade & Open-Air Stage',
    address: 'Heuwel Rd, Centurion Central, Centurion',
    city: 'Centurion',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.8530,
    lon: 28.1880,
    cover_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=1200&auto=format&fit=crop'],
    price: 'Free Admission',
    price_amount: 0,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Boardwalk Free Entry', price: 0, currency: 'ZAR', capacity: 3000 }
    ],
    tags: ['centurion', 'centurion lake', 'night market', 'food trucks', 'waterfront', 'lifestyle', 'promenade', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'centurion_lake_events',
      avatar_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'centurion_lake_events',
      avatar_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    vibe_count: 410,
    rsvp_count: 310,
    capacity: 3500,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_centurion_the_rock_xmas_eve',
    title: 'The Rock Centurion Christmas Eve Black & Gold Groove',
    description: 'Upscale Christmas Eve elegance in Doringkloof. Premium bottle service, synchronized sparklers, guest afro-deep DJs, and high-fashion urban style celebrating the arrival of Christmas.',
    category: 'amapiano',
    event_date: '2026-12-24',
    event_time: '17:00',
    venue_name: 'The Rock Lifestyle Lounge Centurion',
    address: 'Jean Ave, Doringkloof, Centurion',
    city: 'Centurion',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.8450,
    lon: 28.2040,
    cover_url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1200&auto=format&fit=crop'],
    price: 'R200',
    price_amount: 200,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Black & Gold Entry', price: 200, currency: 'ZAR', capacity: 700 },
      { name: 'VIP Booth & Sparkler Service', price: 850, currency: 'ZAR', capacity: 30 }
    ],
    tags: ['centurion', 'the rock', 'doringkloof', 'christmas eve', 'black and gold', 'amapiano', 'nightlife', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'the_rock_centurion',
      avatar_url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'the_rock_centurion',
      avatar_url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    vibe_count: 490,
    rsvp_count: 360,
    capacity: 800,
    age_min: 21,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_centurion_irene_xmas_day',
    title: 'Irene Farm Christmas Day Countryside Braai Picnic',
    description: 'Escape the city rush on Christmas Day! Relaxed countryside picnic hampers on lush green pastures, tractor rides for kids, homemade dairy ice-cream, and soft acoustic holiday carols in Irene.',
    category: 'foodfestival',
    event_date: '2026-12-25',
    event_time: '11:30',
    venue_name: 'Irene Farm & Dairy Lawns',
    address: 'Nellmapius Dr, Irene, Centurion',
    city: 'Centurion',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.8780,
    lon: 28.2140,
    cover_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop'],
    price: 'R380',
    price_amount: 380,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Adult Picnic Hamper & Lawn Spot', price: 380, currency: 'ZAR', capacity: 800 },
      { name: 'Child Hamper', price: 180, currency: 'ZAR', capacity: 400 }
    ],
    tags: ['centurion', 'irene farm', 'christmas day', 'picnic', 'countryside', 'family braai', 'irene', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'irene_farm_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'irene_farm_lifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    vibe_count: 420,
    rsvp_count: 320,
    capacity: 1200,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_centurion_shisanyama_boxing_day',
    title: 'Centurion Shisanyama Boxing Day Spin & Sound Fest',
    description: 'The traditional Boxing Day get-together in Centurion. Car enthusiasts, deep-bass sound rigs, sizzling T-bones and boerewors on open flames, and back-to-back Pretoria groove masters.',
    category: 'sport',
    event_date: '2026-12-26',
    event_time: '12:00',
    venue_name: 'Centurion Shisanyama',
    address: 'Botha Ave & Hendrik Verwoerd Dr, Centurion',
    city: 'Centurion',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.8490,
    lon: 28.1960,
    cover_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop'],
    price: 'R150',
    price_amount: 150,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Admission & Car Show', price: 150, currency: 'ZAR', capacity: 2500 }
    ],
    tags: ['centurion', 'centurion shisanyama', 'boxing day', 'day of goodwill', 'spinning', 'braai', 'bacardi', 'car show', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'centurion_groove',
      avatar_url: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'centurion_groove',
      avatar_url: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 97
    },
    vibe_count: 670,
    rsvp_count: 510,
    capacity: 3000,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_centurion_supersport_nye_2027',
    title: 'SuperSport Park NYE 2027 Fireworks Extravaganza & Stadium Stage',
    description: 'The premier stadium celebration in the capital region. 25,000 people counting down together, breathtaking 15-minute aerial pyrotechnics, three sound stages, and top-billed Mzansi artists.',
    category: 'festival_music',
    event_date: '2026-12-31',
    event_time: '17:00',
    venue_name: 'SuperSport Park Cricket Stadium',
    address: '283 West Ave, Centurion',
    city: 'Centurion',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.8600,
    lon: 28.1970,
    cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop'],
    price: 'R350',
    price_amount: 350,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Grass Embankment NYE Pass', price: 300, currency: 'ZAR', capacity: 15000 },
      { name: 'Grandstand Reserved', price: 500, currency: 'ZAR', capacity: 5000 },
      { name: 'VIP Pavilion Hospitality', price: 1250, currency: 'ZAR', capacity: 400 }
    ],
    tags: ['centurion', 'supersport park', 'nye 2027', 'new years eve', 'fireworks', 'stadium concert', 'amapiano', 'countdown', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'supersport_stadium_events',
      avatar_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'supersport_stadium_events',
      avatar_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 99
    },
    vibe_count: 1480,
    rsvp_count: 1260,
    capacity: 25000,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: true
  },
  {
    id: 'gp_dec26_centurion_lake_nye_countdown',
    title: 'Centurion Lake Waterfront NYE Countdown & Laser Show 2027',
    description: 'Waterfront musical countdown featuring water-fountain laser projections, live DJ sound towers, craft food market, and family-friendly midnight celebrations along the scenic water edge.',
    category: 'festival_music',
    event_date: '2026-12-31',
    event_time: '18:00',
    venue_name: 'Centurion Lake Promenade',
    address: 'Heuwel Rd, Centurion Central, Centurion',
    city: 'Centurion',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.8530,
    lon: 28.1880,
    cover_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop'],
    price: 'R150',
    price_amount: 150,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Boardwalk Countdown Pass', price: 150, currency: 'ZAR', capacity: 4000 }
    ],
    tags: ['centurion', 'centurion lake', 'nye 2027', 'laser show', 'waterfront', 'countdown', 'family', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'centurion_lake_events',
      avatar_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'centurion_lake_events',
      avatar_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    vibe_count: 730,
    rsvp_count: 580,
    capacity: 5000,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: false
  },

  // ==========================================
  // SURROUNDINGS (Modderfontein, Clayville, Olifantsfontein, Rabie Ridge)
  // ==========================================
  {
    id: 'gp_dec26_modderfontein_organic_house',
    title: 'Modderfontein Lakeside Acoustic & Organic House Festival',
    description: 'Nestled in the lush natural beauty of Modderfontein Reserve. Organic house rhythms, live guitars and flutes, eco-friendly food trucks, craft gin bars, and bird-watching sunset chill.',
    category: 'liveband',
    event_date: '2026-12-06',
    event_time: '13:00',
    venue_name: 'Modderfontein Reserve & Lakeside Lawns',
    address: 'Arden Rd, Modderfontein',
    city: 'Modderfontein',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0820,
    lon: 28.1630,
    cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop'],
    price: 'R200',
    price_amount: 200,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Reserve Day Pass', price: 200, currency: 'ZAR', capacity: 1500 }
    ],
    tags: ['modderfontein', 'surroundings', 'reserve', 'organic house', 'lakeside', 'acoustic', 'nature', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'modderfontein_reserve',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'modderfontein_reserve',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    vibe_count: 420,
    rsvp_count: 310,
    capacity: 2000,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_clayville_sound_garden_cookout',
    title: 'Clayville Sound Garden Summer Kickoff & Braai Cookout',
    description: 'The vibrant border hub between Tembisa and Midrand. Smoked ribs, braai chicken, cooler box setups on green lawns, and infectious amapiano beats from afternoon into the warm summer night.',
    category: 'streetfood',
    event_date: '2026-12-13',
    event_time: '12:00',
    venue_name: 'Clayville East Sound Garden & Shisanyama',
    address: 'Industry Rd, Clayville, Olifantsfontein',
    city: 'Clayville',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.9640,
    lon: 28.2320,
    cover_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop'],
    price: 'R100',
    price_amount: 100,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'General Admission', price: 100, currency: 'ZAR', capacity: 1500 },
      { name: 'Cooler Box Ticket', price: 100, currency: 'ZAR', capacity: 500 }
    ],
    tags: ['clayville', 'olifantsfontein', 'surroundings', 'sound garden', 'shisanyama', 'braai', 'amapiano', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'clayville_sound_garden',
      avatar_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'clayville_sound_garden',
      avatar_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    vibe_count: 380,
    rsvp_count: 270,
    capacity: 2000,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_rabie_ridge_soccer_derby',
    title: 'Rabie Ridge Community Goodwill Soccer Derby & Music Clash',
    description: 'Uniting Rabie Ridge, Ivory Park, and Kanana! Annual township football championship final followed by a huge community sound stage with local rap, kwaito, and amapiano talent.',
    category: 'sport',
    event_date: '2026-12-16',
    event_time: '10:00',
    venue_name: 'Rabie Ridge Community Stadium & Lawns',
    address: 'Korhaan St, Rabie Ridge, Midrand border',
    city: 'Rabie Ridge',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0125,
    lon: 28.1620,
    cover_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop'],
    price: 'R60',
    price_amount: 60,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Derby & Music Pass', price: 60, currency: 'ZAR', capacity: 3000 }
    ],
    tags: ['rabie ridge', 'surroundings', 'soccer derby', 'reconciliation day', 'community', 'music clash', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'rabie_ridge_derby',
      avatar_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 94
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'rabie_ridge_derby',
      avatar_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 94
    },
    vibe_count: 390,
    rsvp_count: 280,
    capacity: 3500,
    age_min: 16,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_modderfontein_nu_disco_picnic',
    title: 'Modderfontein Sunset Secret Picnic & Nu-Disco Session',
    description: 'Sunlit meadows and sparkling waters. Bring your picnic hampers, pillows, and squad for an afternoon of uplifting French house, nu-disco, and melodic afro-beats with craft cocktails in the amphitheatre.',
    category: 'rooftop',
    event_date: '2026-12-20',
    event_time: '15:00',
    venue_name: 'Modderfontein Reserve Amphitheatre',
    address: 'Arden Rd, Modderfontein',
    city: 'Modderfontein',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0820,
    lon: 28.1630,
    cover_url: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=1200&auto=format&fit=crop'],
    price: 'R180',
    price_amount: 180,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Picnic Spot Pass', price: 180, currency: 'ZAR', capacity: 1000 }
    ],
    tags: ['modderfontein', 'surroundings', 'picnic', 'nu disco', 'melodic beats', 'sunset', 'reserve', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'modderfontein_reserve',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'modderfontein_reserve',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    vibe_count: 340,
    rsvp_count: 230,
    capacity: 1200,
    age_min: 21,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_olifantsfontein_kwaito_reunion',
    title: 'Olifantsfontein Heritage Kwaito & Old School House Reunion',
    description: 'Nostalgic Highveld summer reunion! Celebrating the roots of modern amapiano with legendary 90s and 2000s Kwaito classics, deep vinyl house, slow charcoal braais, and vintage car displays.',
    category: 'amapiano',
    event_date: '2026-12-26',
    event_time: '13:00',
    venue_name: 'Olifantsfontein Heritage Park & Craft Braai',
    address: 'R562, Olifantsfontein',
    city: 'Olifantsfontein',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -25.9520,
    lon: 28.2210,
    cover_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop'],
    price: 'R120',
    price_amount: 120,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Heritage Reunion Pass', price: 120, currency: 'ZAR', capacity: 1500 }
    ],
    tags: ['olifantsfontein', 'clayville', 'surroundings', 'kwaito', 'old school house', 'boxing day', 'heritage', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'olifantsfontein_groove',
      avatar_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'olifantsfontein_groove',
      avatar_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 95
    },
    vibe_count: 460,
    rsvp_count: 340,
    capacity: 2000,
    age_min: 21,
    status: 'published',
    is_verified: true,
    is_featured: false
  },
  {
    id: 'gp_dec26_modderfontein_lakeside_nye',
    title: 'Modderfontein Lakeside NYE 2027 Starlight Celebration',
    description: 'An intimate, open-air nature wonderland New Year\'s Eve countdown. Fairy-light canopy over the lakeside trees, live indie-electronic performances, artisan food market, and midnight star-burst fireworks.',
    category: 'festival_music',
    event_date: '2026-12-31',
    event_time: '18:00',
    venue_name: 'Modderfontein Reserve Amphitheatre & Lakeside',
    address: 'Arden Rd, Modderfontein',
    city: 'Modderfontein',
    province: 'Gauteng',
    country: 'South Africa',
    lat: -26.0820,
    lon: 28.1630,
    cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
    media_urls: ['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop'],
    price: 'R300',
    price_amount: 300,
    currency: 'ZAR',
    rsvp_tiers: [
      { name: 'Starlight NYE Ticket', price: 300, currency: 'ZAR', capacity: 2000 },
      { name: 'VIP Lake Deck & Sparkling Wine', price: 650, currency: 'ZAR', capacity: 200 }
    ],
    tags: ['modderfontein', 'surroundings', 'nye 2027', 'starlight', 'fireworks', 'lakeside', 'new years eve', 'gauteng'],
    author_id: '00000000-0000-0000-0000-000000000001',
    author: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'modderfontein_reserve',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    profiles: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'modderfontein_reserve',
      avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop',
      is_verified: true,
      vibe_score: 96
    },
    vibe_count: 670,
    rsvp_count: 520,
    capacity: 2500,
    age_min: 18,
    status: 'published',
    is_verified: true,
    is_featured: true
  }
];

function run() {
  console.log(`Starting December 2026 events seed (${DECEMBER_EVENTS.length} events)...`);

  const catalogPath = path.join(__dirname, '..', 'public', 'data', 'events-catalog.json');
  let existingCatalog = [];
  if (fs.existsSync(catalogPath)) {
    try {
      existingCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    } catch (e) {
      console.error('Failed reading existing catalog:', e.message);
      existingCatalog = [];
    }
  }

  // Deduplicate and merge: replace matching IDs or prepend new ones
  const newIds = new Set(DECEMBER_EVENTS.map(e => e.id));
  const filteredExisting = existingCatalog.filter(e => !newIds.has(e.id));
  const mergedCatalog = [...DECEMBER_EVENTS, ...filteredExisting];

  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  fs.writeFileSync(catalogPath, JSON.stringify(mergedCatalog), 'utf8');
  console.log(`Successfully merged ${DECEMBER_EVENTS.length} December events into ${catalogPath} (total: ${mergedCatalog.length})`);

  // Build standalone SQL migration seeder
  const sqlStatements = [
    '-- ============================================================================',
    '-- Supabase Seeder: December 2026 Mega Events',
    '-- Focused on Midrand, Ivory Park, Tembisa, Kempton Park, Centurion & Surroundings',
    '-- Authentic South African venues, precise GPS coordinates, ZAR pricing, real imagery',
    '-- ============================================================================',
    ''
  ];

  DECEMBER_EVENTS.forEach(e => {
    const esc = (str) => String(str || '').replace(/'/g, "''");
    const mediaJson = JSON.stringify(e.media_urls).replace(/'/g, "''");
    const tagsJson = JSON.stringify(e.tags).replace(/'/g, "''");
    const rsvpJson = JSON.stringify(e.rsvp_tiers).replace(/'/g, "''");

    const sql = `INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  '${e.id}', '${esc(e.title)}', '${esc(e.description)}', '${e.category}', '${e.event_date}', '${e.event_time}', '${esc(e.venue_name)}',
  ${e.lat}, ${e.lon}, '${e.cover_url}', '${mediaJson}', '${esc(e.price)}', '${rsvpJson}', '${tagsJson}',
  ${e.vibe_count}, ${e.rsvp_count}, ${e.capacity}, ${e.age_min}, true, NOW()
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  event_date = EXCLUDED.event_date,
  event_time = EXCLUDED.event_time,
  venue_name = EXCLUDED.venue_name,
  lat = EXCLUDED.lat,
  lon = EXCLUDED.lon,
  cover_url = EXCLUDED.cover_url,
  media_urls = EXCLUDED.media_urls,
  price = EXCLUDED.price,
  rsvp_tiers = EXCLUDED.rsvp_tiers,
  tags = EXCLUDED.tags,
  capacity = EXCLUDED.capacity,
  age_min = EXCLUDED.age_min,
  is_verified = EXCLUDED.is_verified;`;
    sqlStatements.push(sql);
  });

  const sqlOutPath = path.join(__dirname, '..', 'supabase', 'queries', 'seed_december_gauteng_events.sql');
  fs.writeFileSync(sqlOutPath, sqlStatements.join('\n\n'), 'utf8');
  console.log(`Successfully generated SQL migration seeder: ${sqlOutPath}`);
}

if (require.main === module) {
  run();
}

module.exports = { DECEMBER_EVENTS, run };

