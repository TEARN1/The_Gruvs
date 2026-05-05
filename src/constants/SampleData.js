// 👑 High-End Professional Photography for "The Gruvs" Royal Edition
// Sourced from Unsplash for a "Real World" feel.

const now = new Date();
const daysFromNow = (d) => new Date(now.getTime() + d * 86400000).toISOString().split('T')[0];

export const SAMPLE_VIBERS = [
  { id: 'v1', username: 'TheOracle', avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80', distance_km: 1.2, interests: ['Tech', 'Music'], rank: 'Grand Viber', vibe_score: 8420, is_online: true, is_verified: true },
  { id: 'v2', username: 'NeonQueen', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80', distance_km: 3.5, interests: ['Fashion', 'Nightlife'], rank: 'Royal Viber', vibe_score: 4100, is_online: false, is_verified: true },
  { id: 'v3', username: 'SoulArchitect', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80', distance_km: 4.9, interests: ['Art', 'Design'], rank: 'Elite Viber', vibe_score: 2900, is_online: true, is_verified: false },
  { id: 'v4', username: 'PulseMaster', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80', distance_km: 0.8, interests: ['Music', 'Fitness'], rank: 'Vibe Lord', vibe_score: 15600, is_online: true, is_verified: true },
];

export const SAMPLE_EVENTS = [
  {
    id: 's-1',
    title: 'Warehouse IX: Industrial Techno',
    description: 'A 12-hour journey into the depths of sound. Raw, unfiltered, and uncompromising. Featuring international headliners.',
    address: '12 Fox St, City & Suburban, JHB',
    venue_name: 'Warehouse IX',
    event_date: daysFromNow(2),
    event_time: '22:00 – 10:00',
    media: [
      { url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1000&q=90', type: 'image' },
      { url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1000&q=90', type: 'image' }
    ],
    category: 'nightlife',
    category_color: '#7c3aed',
    price: 'R350',
    capacity: 1000,
    going: 842,
    vibe_count: 1240,
    echo_count: 56,
    reaction_count: 184,
    reactions_summary: '🔥⚡🙌',
    age_restriction: 21,
    interests: ['Music', 'Nightlife'],
    created_at: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
    profiles: SAMPLE_VIBERS[3]
  },
  {
    id: 's-2',
    title: 'Rooftop Solstice Brunch',
    description: 'Golden hour drinks, premium networking, and the best view of the Johannesburg skyline. All-white attire mandatory.',
    address: '155 West St, Sandown, Sandton',
    venue_name: 'Alto 234 Rooftop',
    event_date: daysFromNow(7),
    event_time: '12:00 – 19:00',
    media: [
      { url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1000&q=90', type: 'image' },
      { url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1000&q=90', type: 'image' }
    ],
    category: 'party',
    category_color: '#ec4899',
    price: 'R800',
    capacity: 200,
    going: 185,
    vibe_count: 3100,
    echo_count: 23,
    reaction_count: 450,
    reactions_summary: '❤️✨👑',
    age_restriction: 23,
    interests: ['Party', 'Networking'],
    created_at: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
    profiles: SAMPLE_VIBERS[1]
  },
  {
    id: 's-3',
    title: 'Contemporary African Art Expo',
    description: 'Showcasing 50+ emerging artists from across the continent. Wine tasting and live performance art included.',
    address: '147 Jan Smuts Ave, Parkwood',
    venue_name: 'The Goodman Gallery',
    event_date: daysFromNow(12),
    event_time: '10:00 – 17:00',
    media: [
      { url: 'https://images.unsplash.com/photo-1518998053502-5190a3915a25?w=1000&q=90', type: 'image' },
      { url: 'https://images.unsplash.com/photo-1549490349-8643362247b5?w=1000&q=90', type: 'image' }
    ],
    category: 'art',
    category_color: '#f472b6',
    price: 'R150',
    capacity: 500,
    going: 320,
    vibe_count: 750,
    echo_count: 12,
    reaction_count: 98,
    reactions_summary: '🎨💎✨',
    age_restriction: 0,
    interests: ['Art', 'Culture'],
    created_at: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(),
    profiles: SAMPLE_VIBERS[2]
  }
];

export const SAMPLE_TRENDING = [
  {
    event_id: 's-2',
    address: 'Alto 234, Sandton',
    description: 'Rooftop Solstice Brunch',
    category: 'party',
    rsvp_count: 185,
    image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&q=80'
  },
  {
    event_id: 's-1',
    address: 'Warehouse IX, JHB',
    description: 'Industrial Techno Night',
    category: 'nightlife',
    rsvp_count: 842,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80'
  }
];
