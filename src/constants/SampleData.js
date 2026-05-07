const now = new Date();
const daysFromNow = (d) => new Date(now.getTime() + d * 86400000).toISOString().split('T')[0];

// ── 10 reusable sample video URLs (Google public test bucket) ─────────────────
const VIDS = {
  v1:  { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',             type: 'video' },
  v2:  { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',           type: 'video' },
  v3:  { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',               type: 'video' },
  v4:  { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',          type: 'video' },
  v5:  { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',         type: 'video' },
  v6:  { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',                     type: 'video' },
  v7:  { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', type: 'video' },
  v8:  { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',               type: 'video' },
  v9:  { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',        type: 'video' },
  v10: { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',  type: 'video' },
};

// ── Helper to build Unsplash image objects ────────────────────────────────────
const img = (id, w = 1000) => ({ url: `https://images.unsplash.com/${id}?w=${w}&q=90`, type: 'image' });

export const SAMPLE_VIBERS = [
  { id: 'v1', username: 'TheOracle',     avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80',  distance_km: 1.2, interests: ['Tech', 'Music'],     rank: 'Grand Viber',  vibe_score: 8420,  is_online: true,  is_verified: true  },
  { id: 'v2', username: 'NeonQueen',     avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',  distance_km: 3.5, interests: ['Fashion', 'Nightlife'], rank: 'Royal Viber', vibe_score: 4100, is_online: false, is_verified: true  },
  { id: 'v3', username: 'SoulArchitect', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',  distance_km: 4.9, interests: ['Art', 'Design'],     rank: 'Elite Viber',  vibe_score: 2900,  is_online: true,  is_verified: false },
  { id: 'v4', username: 'PulseMaster',   avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80',  distance_km: 0.8, interests: ['Music', 'Fitness'],  rank: 'Vibe Lord',    vibe_score: 15600, is_online: true,  is_verified: true  },
  { id: 'v5', username: 'ZoeGroove',     avatar_url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80',  distance_km: 2.1, interests: ['Jazz', 'Culture'],   rank: 'Elite Viber',  vibe_score: 3700,  is_online: true,  is_verified: false },
  { id: 'v6', username: 'KingdomRun',    avatar_url: 'https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=200&q=80',  distance_km: 5.4, interests: ['Sport', 'Wellness'], rank: 'Royal Viber',  vibe_score: 6100,  is_online: false, is_verified: true  },
];

export const SAMPLE_EVENTS = [

  // ── 01 · Warehouse IX: Industrial Techno ─────────────────────────────────
  {
    id: 's-1',
    title: 'Warehouse IX: Industrial Techno',
    description: 'A 12-hour journey into the depths of sound. Raw, unfiltered, and uncompromising. Featuring international headliners.',
    address: '12 Fox St, City & Suburban, JHB',
    venue_name: 'Warehouse IX',
    event_date: daysFromNow(2),
    event_time: '22:00 – 10:00',
    media: [
      img('photo-1514525253161-7a46d19cd819'),
      img('photo-1470225620780-dba8ba36b745'),
      VIDS.v1,
    ],
    category: 'nightlife', category_color: '#7c3aed',
    price: 'R350', capacity: 1000, going: 842,
    vibe_count: 1240, echo_count: 56, reaction_count: 184,
    reactions_summary: '🔥⚡🙌', age_restriction: 21,
    created_at: new Date(now.getTime() - 7200000).toISOString(),
    profiles: SAMPLE_VIBERS[3],
  },

  // ── 02 · Rooftop Solstice Brunch ──────────────────────────────────────────
  {
    id: 's-2',
    title: 'Rooftop Solstice Brunch',
    description: 'Golden hour drinks, premium networking, and the best view of the Johannesburg skyline. All-white attire mandatory.',
    address: '155 West St, Sandown, Sandton',
    venue_name: 'Alto 234 Rooftop',
    event_date: daysFromNow(7),
    event_time: '12:00 – 19:00',
    media: [
      img('photo-1533174072545-7a4b6ad7a6c3'),
      img('photo-1516450360452-9312f5e86fc7'),
      img('photo-1511795409834-ef04bbd61622'),
      VIDS.v2,
    ],
    category: 'party', category_color: '#ec4899',
    price: 'R800', capacity: 200, going: 185,
    vibe_count: 3100, echo_count: 23, reaction_count: 450,
    reactions_summary: '❤️✨👑', age_restriction: 23,
    created_at: new Date(now.getTime() - 86400000).toISOString(),
    profiles: SAMPLE_VIBERS[1],
  },

  // ── 03 · Contemporary African Art Expo ───────────────────────────────────
  {
    id: 's-3',
    title: 'Contemporary African Art Expo',
    description: 'Showcasing 50+ emerging artists from across the continent. Wine tasting and live performance art included.',
    address: '147 Jan Smuts Ave, Parkwood',
    venue_name: 'The Goodman Gallery',
    event_date: daysFromNow(12),
    event_time: '10:00 – 17:00',
    media: [
      img('photo-1518998053502-5190a3915a25'),
      img('photo-1549490349-8643362247b5'),
      img('photo-1579783902614-a3fb3927b6a5'),
    ],
    category: 'art', category_color: '#f472b6',
    price: 'R150', capacity: 500, going: 320,
    vibe_count: 750, echo_count: 12, reaction_count: 98,
    reactions_summary: '🎨💎✨', age_restriction: 0,
    created_at: new Date(now.getTime() - 172800000).toISOString(),
    profiles: SAMPLE_VIBERS[2],
  },

  // ── 04 · Amapiano All-Stars Night ─────────────────────────────────────────
  {
    id: 's-4',
    title: 'Amapiano All-Stars Night',
    description: 'The biggest names in Amapiano converge for one legendary night. Log drums, piano riffs, and pure Joburg soul.',
    address: '1 Stadium Dr, Soweto',
    venue_name: 'Orlando Stadium',
    event_date: daysFromNow(5),
    event_time: '20:00 – 04:00',
    media: [
      img('photo-1493225457124-a3eb161ffa5f'),
      img('photo-1566737236500-c8ac43014a67'),
      img('photo-1429962714451-bb934ecdc4ec'),
      VIDS.v3,
    ],
    category: 'music', category_color: '#f59e0b',
    price: 'R450', capacity: 15000, going: 11200,
    vibe_count: 8900, echo_count: 203, reaction_count: 1240,
    reactions_summary: '🔥🎵🙌', age_restriction: 18,
    created_at: new Date(now.getTime() - 43200000).toISOString(),
    profiles: SAMPLE_VIBERS[0],
  },

  // ── 05 · Sandton Wine & Dine Festival ────────────────────────────────────
  {
    id: 's-5',
    title: 'Sandton Wine & Dine Festival',
    description: 'Over 60 restaurants, 200 wine estates, and live piano jazz. The most elegant culinary event in Joburg.',
    address: 'Sandton Convention Centre, Sandton',
    venue_name: 'Sandton Convention Centre',
    event_date: daysFromNow(14),
    event_time: '11:00 – 20:00',
    media: [
      img('photo-1558618666-fcd25c85cd64'),
      img('photo-1414235077428-338989a2e8c0'),
      img('photo-1517248135467-4c7edcad34c4'),
    ],
    category: 'food', category_color: '#10b981',
    price: 'R380', capacity: 3000, going: 2100,
    vibe_count: 2600, echo_count: 89, reaction_count: 330,
    reactions_summary: '🍷🍽️✨', age_restriction: 18,
    created_at: new Date(now.getTime() - 21600000).toISOString(),
    profiles: SAMPLE_VIBERS[4],
  },

  // ── 06 · Ultra Fitness Challenge ─────────────────────────────────────────
  {
    id: 's-6',
    title: 'Ultra Fitness Challenge JHB',
    description: 'A full-day outdoor fitness festival. HIIT zones, obstacle courses, nutrition expos, and pro athlete showcases.',
    address: 'Wanderers Stadium, Illovo',
    venue_name: 'Wanderers Stadium',
    event_date: daysFromNow(9),
    event_time: '06:00 – 16:00',
    media: [
      img('photo-1571019614242-c5c5dee9f50b'),
      img('photo-1534438327276-14e5300c3a48'),
      VIDS.v4,
    ],
    category: 'sport', category_color: '#22c55e',
    price: 'R200', capacity: 2500, going: 1890,
    vibe_count: 1750, echo_count: 44, reaction_count: 220,
    reactions_summary: '💪🏆🔥', age_restriction: 16,
    created_at: new Date(now.getTime() - 3600000).toISOString(),
    profiles: SAMPLE_VIBERS[5],
  },

  // ── 07 · Soweto Jazz & Blues Night ───────────────────────────────────────
  {
    id: 's-7',
    title: 'Soweto Jazz & Blues Night',
    description: 'Under the stars in the cradle of South African jazz. Legends and newcomers share a legendary stage.',
    address: 'Vilakazi St, Orlando West, Soweto',
    venue_name: 'Soweto Theatre Gardens',
    event_date: daysFromNow(3),
    event_time: '19:00 – 00:00',
    media: [
      img('photo-1520170350707-b2da59970118'),
      img('photo-1571266028243-e4733b0f0bb0'),
      img('photo-1508854710579-5cecc3a9ff17'),
      VIDS.v5,
    ],
    category: 'music', category_color: '#6366f1',
    price: 'R180', capacity: 800, going: 620,
    vibe_count: 980, echo_count: 31, reaction_count: 145,
    reactions_summary: '🎷🎶❤️', age_restriction: 0,
    created_at: new Date(now.getTime() - 10800000).toISOString(),
    profiles: SAMPLE_VIBERS[4],
  },

  // ── 08 · Cape Town Comedy Gala ────────────────────────────────────────────
  {
    id: 's-8',
    title: 'Cape Town Comedy Gala',
    description: 'South Africa\'s funniest comedians on one stage. Expect sold-out laughs and surprise celebrity appearances.',
    address: 'Lower Long St, Cape Town CBD',
    venue_name: 'Grand Arena, GrandWest',
    event_date: daysFromNow(18),
    event_time: '19:30 – 22:30',
    media: [
      img('photo-1527799820374-dcf8d9d4a388'),
      img('photo-1541899481282-d53bffe3c35d'),
      VIDS.v6,
    ],
    category: 'comedy', category_color: '#facc15',
    price: 'R290', capacity: 4000, going: 3650,
    vibe_count: 4200, echo_count: 118, reaction_count: 590,
    reactions_summary: '😂🤣🔥', age_restriction: 16,
    created_at: new Date(now.getTime() - 14400000).toISOString(),
    profiles: SAMPLE_VIBERS[2],
  },

  // ── 09 · Maboneng Street Art Walk ────────────────────────────────────────
  {
    id: 's-9',
    title: 'Maboneng Street Art Walk',
    description: 'A curated tour through Joburg\'s most vibrant creative district. Meet the muralists, see the studios, taste the culture.',
    address: '286 Fox St, Maboneng',
    venue_name: 'Maboneng Precinct',
    event_date: daysFromNow(4),
    event_time: '09:00 – 13:00',
    media: [
      img('photo-1547891654-e66ed7ebb968'),
      img('photo-1553356084-58ef4a67b2a7'),
      img('photo-1449844908441-8829872d2607'),
    ],
    category: 'art', category_color: '#a855f7',
    price: 'FREE', capacity: 100, going: 87,
    vibe_count: 460, echo_count: 9, reaction_count: 60,
    reactions_summary: '🎨🏙️✨', age_restriction: 0,
    created_at: new Date(now.getTime() - 5400000).toISOString(),
    profiles: SAMPLE_VIBERS[2],
  },

  // ── 10 · Tech Innovation Summit ──────────────────────────────────────────
  {
    id: 's-10',
    title: 'Tech Innovation Summit Africa',
    description: 'Two days of cutting-edge talks, AI demos, founder pitches, and networking with the continent\'s top builders.',
    address: 'Sandton Convention Centre',
    venue_name: 'Sandton Convention Centre',
    event_date: daysFromNow(21),
    event_time: '08:00 – 18:00',
    media: [
      img('photo-1540575467063-178a50c2df87'),
      img('photo-1531482615713-2afd69097998'),
      img('photo-1581091226825-a6a2a5aee158'),
      VIDS.v7,
    ],
    category: 'tech', category_color: '#3b82f6',
    price: 'R1200', capacity: 2000, going: 1540,
    vibe_count: 2100, echo_count: 76, reaction_count: 280,
    reactions_summary: '💡🚀🤖', age_restriction: 0,
    created_at: new Date(now.getTime() - 28800000).toISOString(),
    profiles: SAMPLE_VIBERS[0],
  },

  // ── 11 · Afro Beach Carnival ──────────────────────────────────────────────
  {
    id: 's-11',
    title: 'Afro Beach Carnival',
    description: 'Sun, sand, Afrobeats, and the best street food on the Durban beachfront. Three stages running simultaneously.',
    address: 'Ushaka Marine Drive, Durban',
    venue_name: 'North Beach, Durban',
    event_date: daysFromNow(10),
    event_time: '12:00 – 22:00',
    media: [
      img('photo-1507525428034-b723cf961d3e'),
      img('photo-1471623432079-b009d30b6729'),
      VIDS.v8,
    ],
    category: 'party', category_color: '#f97316',
    price: 'R250', capacity: 10000, going: 7800,
    vibe_count: 9400, echo_count: 312, reaction_count: 1800,
    reactions_summary: '🌊🔥🎶', age_restriction: 18,
    created_at: new Date(now.getTime() - 7200000).toISOString(),
    profiles: SAMPLE_VIBERS[1],
  },

  // ── 12 · Film Under the Stars ─────────────────────────────────────────────
  {
    id: 's-12',
    title: 'Film Under the Stars: Pan-African Cinema',
    description: 'A curated outdoor screening of award-winning African films. BYO blankets, wine, and good company.',
    address: 'Northgate Dome, Randburg',
    venue_name: 'Northgate Open-Air Cinema',
    event_date: daysFromNow(6),
    event_time: '19:00 – 23:00',
    media: [
      img('photo-1478720568477-152d9b164e26'),
      img('photo-1489599849927-2ee91cede3ba'),
      VIDS.v9,
    ],
    category: 'film', category_color: '#8b5cf6',
    price: 'R120', capacity: 600, going: 490,
    vibe_count: 720, echo_count: 28, reaction_count: 110,
    reactions_summary: '🎬🌙✨', age_restriction: 0,
    created_at: new Date(now.getTime() - 36000000).toISOString(),
    profiles: SAMPLE_VIBERS[4],
  },

  // ── 13 · Yoga & Wellness Retreat ─────────────────────────────────────────
  {
    id: 's-13',
    title: 'Sunrise Yoga & Wellness Retreat',
    description: 'A full weekend of guided yoga, meditation, breathwork, sound healing, and holistic nutrition workshops.',
    address: 'Cradle of Humankind, Maropeng',
    venue_name: 'Ubuntu Wellness Estate',
    event_date: daysFromNow(15),
    event_time: '06:00 – 18:00',
    media: [
      img('photo-1545389336-cf090694435e'),
      img('photo-1506126613408-eca07ce68773'),
    ],
    category: 'wellness', category_color: '#06b6d4',
    price: 'R650', capacity: 80, going: 67,
    vibe_count: 410, echo_count: 14, reaction_count: 72,
    reactions_summary: '🧘☀️💚', age_restriction: 0,
    created_at: new Date(now.getTime() - 50400000).toISOString(),
    profiles: SAMPLE_VIBERS[5],
  },

  // ── 14 · Kids Art & Play Day ──────────────────────────────────────────────
  {
    id: 's-14',
    title: 'Kids Art & Play Day',
    description: 'Immersive art stations, puppet theatre, face painting, storytelling and a creativity carnival for ages 2-12.',
    address: 'Rosebank Mall Rooftop, Johannesburg',
    venue_name: 'Rosebank Art Park',
    event_date: daysFromNow(8),
    event_time: '10:00 – 16:00',
    media: [
      img('photo-1474552226712-ac0f0961a954'),
      img('photo-1503454537195-1dcabb73ffb9'),
      img('photo-1551269901-5c2b72e2b724'),
    ],
    category: 'family', category_color: '#f59e0b',
    price: 'R80', capacity: 400, going: 310,
    vibe_count: 380, echo_count: 22, reaction_count: 88,
    reactions_summary: '👨‍👩‍👧🎨🌈', age_restriction: 0,
    created_at: new Date(now.getTime() - 18000000).toISOString(),
    profiles: SAMPLE_VIBERS[4],
  },

  // ── 15 · Heritage Cultural Festival ──────────────────────────────────────
  {
    id: 's-15',
    title: 'Heritage Day Cultural Festival',
    description: 'A celebration of South Africa\'s rainbow nation. Traditional food, dance, music, and storytelling from all 11 cultures.',
    address: 'Union Buildings Grounds, Pretoria',
    venue_name: 'Union Buildings Amphitheatre',
    event_date: daysFromNow(1),
    event_time: '09:00 – 18:00',
    media: [
      img('photo-1607827448387-a67db56383b6'),
      img('photo-1533777857889-4be7c70b33f7'),
      VIDS.v10,
    ],
    category: 'heritage', category_color: '#ef4444',
    price: 'FREE', capacity: 5000, going: 3900,
    vibe_count: 5600, echo_count: 141, reaction_count: 780,
    reactions_summary: '🇿🇦🥁✨', age_restriction: 0,
    created_at: new Date(now.getTime() - 900000).toISOString(),
    profiles: SAMPLE_VIBERS[0],
  },

  // ── 16 · Startup Founders Meetup ─────────────────────────────────────────
  {
    id: 's-16',
    title: 'Startup Founders Meetup JHB',
    description: 'Speed networking, investor pitches, product demos, and open discussion with 300+ founders from Joburg\'s startup scene.',
    address: 'The Campus, Bryanston',
    venue_name: 'The Campus, Bryanston',
    event_date: daysFromNow(11),
    event_time: '17:00 – 21:00',
    media: [
      img('photo-1551434678-e076c223a692'),
      img('photo-1454165804606-c3d57bc86b40'),
    ],
    category: 'business', category_color: '#3b82f6',
    price: 'R100', capacity: 300, going: 248,
    vibe_count: 560, echo_count: 33, reaction_count: 95,
    reactions_summary: '💼🚀🤝', age_restriction: 0,
    created_at: new Date(now.getTime() - 25200000).toISOString(),
    profiles: SAMPLE_VIBERS[3],
  },
];

export const SAMPLE_TRENDING = [
  {
    event_id: 's-11',
    address: 'North Beach, Durban',
    description: 'Afro Beach Carnival',
    category: 'party',
    rsvp_count: 7800,
    image: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400&q=80',
  },
  {
    event_id: 's-4',
    address: 'Orlando Stadium, Soweto',
    description: 'Amapiano All-Stars Night',
    category: 'music',
    rsvp_count: 11200,
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80',
  },
  {
    event_id: 's-2',
    address: 'Alto 234, Sandton',
    description: 'Rooftop Solstice Brunch',
    category: 'party',
    rsvp_count: 185,
    image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&q=80',
  },
  {
    event_id: 's-15',
    address: 'Union Buildings, Pretoria',
    description: 'Heritage Day Cultural Festival',
    category: 'heritage',
    rsvp_count: 3900,
    image: 'https://images.unsplash.com/photo-1607827448387-a67db56383b6?w=400&q=80',
  },
  {
    event_id: 's-8',
    address: 'Grand Arena, Cape Town',
    description: 'Cape Town Comedy Gala',
    category: 'comedy',
    rsvp_count: 3650,
    image: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=400&q=80',
  },
  {
    event_id: 's-10',
    address: 'Sandton Convention Centre',
    description: 'Tech Innovation Summit Africa',
    category: 'tech',
    rsvp_count: 1540,
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&q=80',
  },
  {
    event_id: 's-1',
    address: 'Warehouse IX, JHB',
    description: 'Industrial Techno Night',
    category: 'nightlife',
    rsvp_count: 842,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
  },
  {
    event_id: 's-6',
    address: 'Wanderers Stadium, JHB',
    description: 'Ultra Fitness Challenge',
    category: 'sport',
    rsvp_count: 1890,
    image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=80',
  },
];

export const SAMPLE_ROUTES = [
  {
    id: 'r-1',
    title: 'The Solstice Crawl',
    description: 'A premium journey from sunrise yoga to midnight warehouse vibes. The elite Saturday itinerary.',
    color: '#00f2ff',
    vibe_score: '4.2k',
    author: 'TheOracle',
    author_avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&q=80',
    steps: [
      { title: 'Sky Yoga',    icon: 'yoga'   },
      { title: 'Soul Brunch', icon: 'food'   },
      { title: 'Warehouse IX', icon: 'music' },
    ],
  },
  {
    id: 'r-2',
    title: 'Street Art & Bass',
    description: "Explore Maboneng's hidden galleries followed by a bass-heavy secret rooftop session.",
    color: '#bd00ff',
    vibe_score: '1.8k',
    author: 'SoulArchitect',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
    steps: [
      { title: 'Arts on Main', icon: 'palette'   },
      { title: 'Curated Hub',  icon: 'camera'    },
      { title: 'The Base',     icon: 'amplifier' },
    ],
  },
];
