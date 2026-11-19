-- Seed 180 South African Events: Dec 2026 – May 2027
-- 6 Months x (20 Big Events + 10 Business Events) = 180 Total
-- Author: The Gruvs Platform Admin


-- =========================================================================
-- December 2026: 20 Big Events + 10 Business Events
-- =========================================================================


INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Ke Dezemba Amapiano Explosive Launch',
  'Kick off the iconic Ke Dezemba holiday season with a powerhouse Amapiano lineup featuring South Africa''s premier producers and DJs. Massive sound, festival lighting, outdoor dance floor, and high-energy VIP table packages.',
  'music',
  ARRAY['amapiano', 'festivals', 'nightlife', 'ke dezemba', 'soweto'],
  'Zone 6 Venue',
  'Warehouse 28, Blackwood Street, Diepkloof Zone 6, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2483,
  27.9351,
  -26.2483,
  27.9351,
  '2026-12-04'::date,
  '18:00',
  '{"early_bird":"150","general":"250","vip":"650","table":"4500"}',
  true,
  4000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Ke Dezemba Amapiano Explosive Launch' AND event_date = '2026-12-04'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Shimmy Sunset White & Gold Rave',
  'Experience pure Atlantic bliss at Shimmy Beach Club with world-class Afro-tech and deep house beats right by the water. Strictly white and gold summer chic attire. Premium cocktails and signature beach cabana bottle service.',
  'music',
  ARRAY['afro-tech', 'beach club', 'cape town', 'summer', 'nightlife'],
  'Shimmy Beach Club',
  '12 S Arm Road, V&A Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9038,
  18.4293,
  -33.9038,
  18.4293,
  '2026-12-05'::date,
  '15:00',
  'From R300',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Shimmy Sunset White & Gold Rave' AND event_date = '2026-12-05'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Altitude Beach Dezemba Fest',
  'Fourways turns into the ultimate summer oasis. Pool party vibes, live percussionists, top amapiano and hip-hop spinners, luxury daybeds, and illuminated evening swimming.',
  'music',
  ARRAY['pool party', 'amapiano', 'fourways', 'johannesburg', 'day party'],
  'Altitude Beach',
  'Fourways Mall, Ruby Close, Fourways',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.0175,
  28.0069,
  -26.0175,
  28.0069,
  '2026-12-06'::date,
  '13:00',
  '{"general":"200","vip":"500","cabana":"6000"}',
  true,
  1500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Altitude Beach Dezemba Fest' AND event_date = '2026-12-06'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Konka Summer Anthem Weekend',
  'The benchmark of Soweto luxury nightlife. Elite bottle parades, surprise international guest appearances, and relentless basslines throughout the weekend.',
  'music',
  ARRAY['konka', 'soweto', 'luxury nightlife', 'vip', 'amapiano'],
  'Konka Soweto',
  'Modjadji Street, Pimville Zone 1, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2736,
  27.8972,
  -26.2736,
  27.8972,
  '2026-12-11'::date,
  '20:00',
  'From R350',
  true,
  1200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Konka Summer Anthem Weekend' AND event_date = '2026-12-11'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Durban All-White Beach Extravaganza',
  'Moses Mabhida Peoples Park transforms into an epic coastal summer festival. 12 hours of non-stop house, gqom, and afro-tech, with ocean breezes and stunning firework showcases.',
  'music',
  ARRAY['durban', 'all-white', 'gqom', 'afro-tech', 'festival'],
  'Moses Mabhida Stadium Peoples Park',
  '44 Isaiah Ntshangase Road, Stamford Hill, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.8291,
  31.0305,
  -29.8291,
  31.0305,
  '2026-12-12'::date,
  '14:00',
  '{"general":"180","golden_circle":"450","vip":"850"}',
  true,
  5000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Durban All-White Beach Extravaganza' AND event_date = '2026-12-12'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'SunBet Arena Afro-Tech Symphony',
  'A fusion of classical strings and pulsating Afro-Tech rhythms featuring a 40-piece live orchestra collaborating with South Africa''s legendary electronic producers.',
  'music',
  ARRAY['afro-tech', 'live orchestra', 'pretoria', 'concert', 'sunbet arena'],
  'SunBet Arena at Time Square',
  '209 Aramist Avenue, Menlyn, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7877,
  28.2798,
  -25.7877,
  28.2798,
  '2026-12-13'::date,
  '19:00',
  '{"tier_1":"350","tier_2":"550","vip_box":"1200"}',
  true,
  6500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'SunBet Arena Afro-Tech Symphony' AND event_date = '2026-12-13'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Kirstenbosch Summer Sunset: Soul & Afro-Jazz',
  'Lush greenery, mountain backdrops, and picnic baskets. Bring family and friends to experience live soul, afro-jazz, and neo-soul performances under the Cape Town summer sky.',
  'music',
  ARRAY['jazz', 'soul', 'kirstenbosch', 'cape town', 'picnic'],
  'Kirstenbosch National Botanical Garden',
  'Rhodes Drive, Newlands, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9877,
  18.4326,
  -33.9877,
  18.4326,
  '2026-12-13'::date,
  '16:00',
  'From R220',
  true,
  3500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Kirstenbosch Summer Sunset: Soul & Afro-Jazz' AND event_date = '2026-12-13'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Soweto Street Food & Craft Beer Festival',
  'Celebrating authentic South African street culinary culture: gourmet kotas, sizzling mogodu, artisanal craft beers, live acoustic stages, and artisanal pop-up markets.',
  'music',
  ARRAY['food', 'craft beer', 'soweto', 'reconciliation day', 'culture'],
  'Zone 6 Venue',
  'Warehouse 28, Blackwood Street, Diepkloof Zone 6, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2483,
  27.9351,
  -26.2483,
  27.9351,
  '2026-12-16'::date,
  '11:00',
  'From R100',
  true,
  2500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Soweto Street Food & Craft Beer Festival' AND event_date = '2026-12-16'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cabo Beach Sunset Electronic Odyssey',
  'Deep melodic house and techno right on the waterfront edge. World-renowned selectors, breathtaking sunset over Table Mountain, and refined Mediterranean dining.',
  'music',
  ARRAY['cabo beach', 'melodic techno', 'cape town', 'waterfront', 'sunset'],
  'Cabo Beach Club',
  '12 S Arm Road, Victoria & Alfred Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9022,
  18.4243,
  -33.9022,
  18.4243,
  '2026-12-18'::date,
  '16:00',
  'From R350',
  true,
  2000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cabo Beach Sunset Electronic Odyssey' AND event_date = '2026-12-18'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Eyadini December Shisanyama Spectacular',
  'The heartbeat of Umlazi. World-class braai meat, ice-cold beverages, red carpet entrances, and Durban''s biggest musical celebrities lighting up the main stage.',
  'music',
  ARRAY['shisanyama', 'eyadini', 'durban', 'lifestyle', 'gqom'],
  'Eyadini Lounge',
  '3 Peace Haven Place, Umlazi, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.9675,
  30.8872,
  -29.9675,
  30.8872,
  '2026-12-19'::date,
  '12:00',
  'From R150',
  true,
  3000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Eyadini December Shisanyama Spectacular' AND event_date = '2026-12-19'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'The Station Parkhurst Rooftop Summer Jam',
  'Joburg northern suburbs skyline, craft gin bars, gourmet burgers, and sun-drenched deep house sets transitioning into electrifying party rhythms after dark.',
  'music',
  ARRAY['rooftop', 'parkhurst', 'johannesburg', 'deep house', 'craft gin'],
  'The Station Parkhurst',
  '24 4th Avenue, Parkhurst',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1384,
  28.0163,
  -26.1384,
  28.0163,
  '2026-12-19'::date,
  '15:00',
  'From R120',
  true,
  600,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'The Station Parkhurst Rooftop Summer Jam' AND event_date = '2026-12-19'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Spier Secret Vineyard Sunset Soiree',
  'An intimate, luxurious celebration in the heart of Stellenbosch. Award-winning organic wines paired with farm-to-table small plates and live jazz trios as dusk settles over the Helderberg.',
  'music',
  ARRAY['stellenbosch', 'wine tasting', 'jazz', 'fine dining', 'winelands'],
  'Spier Wine Farm',
  'R310 Baden Powell Drive, Stellenbosch',
  'Stellenbosch',
  'ZA',
  'Africa/Johannesburg',
  -33.9723,
  18.7825,
  -33.9723,
  18.7825,
  '2026-12-20'::date,
  '17:00',
  'R450 (includes wine tasting)',
  true,
  450,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Spier Secret Vineyard Sunset Soiree' AND event_date = '2026-12-20'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'FNB Stadium Ke Dezemba SuperFest',
  'The biggest stadium gathering in Africa this December. Over 50 artists across 3 mega-stages: Amapiano Arena, Afro-House Colosseum, and Hip Hop Thunderdome.',
  'music',
  ARRAY['stadium', 'superfest', 'amapiano', 'hiphop', 'fnb stadium'],
  'FNB Stadium',
  'Soccer City Avenue, Nasrec',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.2348,
  27.9824,
  -26.2348,
  27.9824,
  '2026-12-23'::date,
  '14:00',
  '{"general":"250","golden_circle":"600","vip_lounge":"1800"}',
  true,
  25000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'FNB Stadium Ke Dezemba SuperFest' AND event_date = '2026-12-23'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Christmas Eve Waterfront Moonlight Ball',
  'Celebrate Christmas Eve on the water at Grand Africa Café & Beach. Romantic candlelit tables on the sand, champagne towers, live acoustic serenades, and festive culinary specials.',
  'music',
  ARRAY['christmas eve', 'grand africa', 'cape town', 'beach', 'festive'],
  'Grand Africa Café & Beach',
  'Haul Road, V&A Waterfront, Granger Bay, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9018,
  18.4191,
  -33.9018,
  18.4191,
  '2026-12-24'::date,
  '19:00',
  'R650 (includes festive welcome drink)',
  true,
  800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Christmas Eve Waterfront Moonlight Ball' AND event_date = '2026-12-24'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Christmas Day Family Garden Feast',
  'A joyful Christmas Day gathering surrounded by lush botanical beauty at Walter Sisulu Gardens. Live carols, children''s entertainment zone, braai stations, and shaded picnic areas.',
  'music',
  ARRAY['christmas day', 'family', 'waterfall', 'midrand', 'picnic'],
  'Waterfall City Park',
  'Corner Magwa & Lone Creek Cres, Waterfall City, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -26.0152,
  28.1091,
  -26.0152,
  28.1091,
  '2026-12-25'::date,
  '11:00',
  'From R150',
  true,
  1500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Christmas Day Family Garden Feast' AND event_date = '2026-12-25'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Boxing Day Pool & Beats Extravaganza',
  'Recover and reignite the holiday momentum at Altitude Beach. Chilled house sessions, refreshing cocktails, pool volleyball, and afternoon live DJ showcases.',
  'music',
  ARRAY['boxing day', 'altitude beach', 'pool party', 'fourways', 'summer'],
  'Altitude Beach',
  'Fourways Mall, Ruby Close, Fourways',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.0175,
  28.0069,
  -26.0175,
  28.0069,
  '2026-12-26'::date,
  '12:00',
  'From R220',
  true,
  1600,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Boxing Day Pool & Beats Extravaganza' AND event_date = '2026-12-26'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Gqeberha Coastal Summer Sunset Festival',
  'Eastern Cape''s premier festive gathering along the Boardwalk. Fresh ocean air, top national headliners, local craft food trucks, and unforgettable seaside vibes.',
  'music',
  ARRAY['gqeberha', 'boardwalk', 'eastern cape', 'beach festival'],
  'The Boardwalk Gqeberha',
  'Beach Road, Summerstrand, Gqeberha',
  'Gqeberha',
  'ZA',
  'Africa/Johannesburg',
  -33.9858,
  25.6586,
  -33.9858,
  25.6586,
  '2026-12-27'::date,
  '15:00',
  'From R180',
  true,
  2000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Gqeberha Coastal Summer Sunset Festival' AND event_date = '2026-12-27'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Max''s Lifestyle Festive Sunday Shisanyama',
  'Sundays in Umlazi are an international cultural phenomenon. Experience VIP treatment, elite luxury sports car parades, premium cuts, and the finest Durban house DJs.',
  'music',
  ARRAY['maxs lifestyle', 'umlazi', 'durban', 'shisanyama', 'sunday groove'],
  'Max''s Lifestyle Village',
  'V1328 Mbe Road, Umlazi, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.9691,
  30.8856,
  -29.9691,
  30.8856,
  '2026-12-27'::date,
  '13:00',
  'From R150',
  true,
  2500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Max''s Lifestyle Festive Sunday Shisanyama' AND event_date = '2026-12-27'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cabo Beach Club NYE White & Silver Gala',
  'Say goodbye to 2026 and welcome 2027 in supreme style. Multi-tiered VIP platforms, international electronic guest DJs, midnight champagne toast, and private beachfront fireworks.',
  'music',
  ARRAY['nye', 'new years eve', 'cabo beach', 'cape town', 'fireworks'],
  'Cabo Beach Club',
  '12 S Arm Road, Victoria & Alfred Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9022,
  18.4243,
  -33.9022,
  18.4243,
  '2026-12-31'::date,
  '18:00',
  '{"general":"750","vip":"1800","table":"15000"}',
  true,
  2200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cabo Beach Club NYE White & Silver Gala' AND event_date = '2026-12-31'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Konka Soweto 2027 Midnight Countdown',
  'The most anticipated New Year''s Eve celebration in Johannesburg. Unrivalled audio-visual production, star-studded VIP guests, bottle parades, and a historic midnight drop into 2027.',
  'music',
  ARRAY['nye', 'new years eve', 'konka', 'soweto', 'countdown'],
  'Konka Soweto',
  'Modjadji Street, Pimville Zone 1, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2736,
  27.8972,
  -26.2736,
  27.8972,
  '2026-12-31'::date,
  '20:00',
  '{"general":"450","vip":"1200","table":"20000"}',
  true,
  1500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Konka Soweto 2027 Midnight Countdown' AND event_date = '2026-12-31'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Southern Africa Year-End Business & Tech Gala',
  'An executive gala dinner uniting leaders in fintech, telecommunications, and venture capital. Celebrate annual milestones, recognize industry innovators, and build key partnerships for 2027.',
  'biz',
  ARRAY['business', 'gala', 'networking', 'sandton', 'executive'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2026-12-02'::date,
  '18:30',
  'R1,200',
  true,
  500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Southern Africa Year-End Business & Tech Gala' AND event_date = '2026-12-02'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Township Economy & Retail Entrepreneurship Expo',
  'Connecting township entrepreneurs, spaza shop owners, and franchisors with FMCG suppliers, fintech payment providers, and government enterprise funding programs.',
  'biz',
  ARRAY['township economy', 'sme', 'retail', 'entrepreneurship', 'soweto'],
  'Zone 6 Venue',
  'Warehouse 28, Blackwood Street, Diepkloof Zone 6, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2483,
  27.9351,
  -26.2483,
  27.9351,
  '2026-12-03'::date,
  '09:00',
  'Free (RSVP Required)',
  false,
  800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Township Economy & Retail Entrepreneurship Expo' AND event_date = '2026-12-03'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Gauteng Commercial Real Estate & Investment Summit',
  'Keynote panels exploring mixed-use precinct developments, logistics hubs, and green building financing across Johannesburg and Pretoria. High-level networking with property REITs.',
  'biz',
  ARRAY['property', 'real estate', 'investment', 'sandton', 'finance'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2026-12-08'::date,
  '08:30',
  'R850',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Gauteng Commercial Real Estate & Investment Summit' AND event_date = '2026-12-08'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Western Cape Tech & Venture Showcase',
  'Connecting early-stage tech founders across Africa with angel syndicates and venture capital funds. 15 selected startups pitch live on stage for pre-seed and seed funding rounds.',
  'biz',
  ARRAY['startups', 'venture capital', 'tech', 'cape town', 'pitch'],
  'Cape Town International Convention Centre (CTICC)',
  '1 Lower Long Street, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9161,
  18.4285,
  -33.9161,
  18.4285,
  '2026-12-09'::date,
  '10:00',
  'From R450',
  true,
  400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Western Cape Tech & Venture Showcase' AND event_date = '2026-12-09'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Africa Trade & Port Logistics Round-Table',
  'High-level policy and maritime logistics symposium addressing supply chain resilience, border modernization, and AfCFTA trade corridor acceleration.',
  'biz',
  ARRAY['logistics', 'trade', 'maritime', 'durban', 'afcfta'],
  'Durban ICC',
  '45 Bram Fischer Road, Durban Central',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.8524,
  31.0286,
  -29.8524,
  31.0286,
  '2026-12-10'::date,
  '09:00',
  'R950',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Africa Trade & Port Logistics Round-Table' AND event_date = '2026-12-10'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Midrand SME Cloud & Digital Mastery Workshop',
  'Hands-on practical masterclasses for small and medium business owners: implementing cloud POS, CRM automation, online marketing funnels, and secure digital payments.',
  'biz',
  ARRAY['sme', 'cloud', 'digital transformation', 'midrand', 'workshop'],
  'Gallagher Convention Centre',
  '19 Richards Drive, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -26.0028,
  28.1287,
  -26.0028,
  28.1287,
  '2026-12-14'::date,
  '09:30',
  'R250',
  true,
  250,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Midrand SME Cloud & Digital Mastery Workshop' AND event_date = '2026-12-14'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Pretoria Public-Private Infrastructure Forum',
  'Convening municipal stakeholders, engineering contractors, and private financiers to deliberate on water, energy, and smart transit infrastructure deployment for the capital.',
  'biz',
  ARRAY['infrastructure', 'pretoria', 'public private partnership', 'energy'],
  'Menlyn Maine Central Square',
  'Amarand Avenue, Waterkloof Glen, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7865,
  28.2812,
  -25.7865,
  28.2812,
  '2026-12-15'::date,
  '08:30',
  'R750',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Pretoria Public-Private Infrastructure Forum' AND event_date = '2026-12-15'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Women in African Tech & Leadership Breakfast',
  'Inspiring keynote speeches, fireside chats, and structured networking with top female C-suite executives, tech founders, and venture partners from across the continent.',
  'biz',
  ARRAY['women in tech', 'leadership', 'networking', 'sandton', 'breakfast'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2026-12-17'::date,
  '08:00',
  'R450',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Women in African Tech & Leadership Breakfast' AND event_date = '2026-12-17'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Africa Hospitality & Tourism Leaders Forum',
  'Preparing Southern Africa''s tourism ecosystem for the 2027 international travel season: direct bookings strategies, sustainable hotel operations, and luxury eco-safaris.',
  'biz',
  ARRAY['hospitality', 'tourism', 'travel', 'cape town', 'conferences'],
  'Cape Town International Convention Centre (CTICC)',
  '1 Lower Long Street, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9161,
  18.4285,
  -33.9161,
  18.4285,
  '2026-12-18'::date,
  '09:00',
  'R600',
  true,
  400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Africa Hospitality & Tourism Leaders Forum' AND event_date = '2026-12-18'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'FinTech Africa 2027 Strategy & Regulatory Briefing',
  'An authoritative year-end briefing on open banking standards, digital asset regulation, mobile money interoperability, and cross-border remittances in Sub-Saharan Africa.',
  'biz',
  ARRAY['fintech', 'banking', 'payments', 'regulation', 'sandton'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2026-12-22'::date,
  '14:00',
  'R550',
  true,
  280,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'FinTech Africa 2027 Strategy & Regulatory Briefing' AND event_date = '2026-12-22'::date AND deleted_at IS NULL
);
-- =========================================================================
-- January 2027: 20 Big Events + 10 Business Events
-- =========================================================================


INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'New Year''s Day Sunrise Beach Rave',
  'Greet the first sunrise of 2027 on the warm sand of Grand Africa Beach. Uplifting progressive house, ambient chillout lounge, artisan coffee stations, and refreshing mimosa bars.',
  'music',
  ARRAY['new years day', 'sunrise', 'cape town', 'house music', 'beach'],
  'Grand Africa Café & Beach',
  'Haul Road, V&A Waterfront, Granger Bay, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9018,
  18.4191,
  -33.9018,
  18.4191,
  '2027-01-01'::date,
  '06:00',
  'From R250',
  true,
  1500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'New Year''s Day Sunrise Beach Rave' AND event_date = '2027-01-01'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Soweto New Year Kickoff Celebration',
  'Start 2027 with massive vibrations in the heart of Soweto. Top amapiano DJs, premium braai meat, ice-cold drinks, and thousands of joyous music lovers.',
  'music',
  ARRAY['new years day', 'soweto', 'amapiano', 'zone 6', 'party'],
  'Zone 6 Venue',
  'Warehouse 28, Blackwood Street, Diepkloof Zone 6, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2483,
  27.9351,
  -26.2483,
  27.9351,
  '2027-01-01'::date,
  '14:00',
  'From R150',
  true,
  3500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Soweto New Year Kickoff Celebration' AND event_date = '2027-01-01'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cabo Summer Sessions: Deep Oceanic',
  'Cape Town summer at its peak. International guest DJs, luxury oceanfront loungers, artisanal sushi platters, and pure deep melodic rhythms through golden hour.',
  'music',
  ARRAY['cabo beach', 'deep house', 'summer', 'cape town', 'vip'],
  'Cabo Beach Club',
  '12 S Arm Road, Victoria & Alfred Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9022,
  18.4243,
  -33.9022,
  18.4243,
  '2027-01-02'::date,
  '14:00',
  'From R300',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cabo Summer Sessions: Deep Oceanic' AND event_date = '2027-01-02'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Durban Summer Beach Jam',
  'Enjoy KwaZulu-Natal''s golden summer weather with live Afro-pop, gqom, and amapiano on the oceanfront. Beach volleyball, food vendors, and non-stop dancing.',
  'music',
  ARRAY['durban', 'beach party', 'gqom', 'summer', 'live music'],
  'Moses Mabhida Stadium Peoples Park',
  '44 Isaiah Ntshangase Road, Stamford Hill, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.8291,
  31.0305,
  -29.8291,
  31.0305,
  '2027-01-03'::date,
  '12:00',
  'From R120',
  true,
  4000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Durban Summer Beach Jam' AND event_date = '2027-01-03'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Altitude January Sun-Drenched Sessions',
  'Recharge your summer spirit by the pool. High-energy house sets, sparkling champagne bottles, daybed comfort, and beautiful Joburg weather.',
  'music',
  ARRAY['pool party', 'altitude beach', 'fourways', 'house music'],
  'Altitude Beach',
  'Fourways Mall, Ruby Close, Fourways',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.0175,
  28.0069,
  -26.0175,
  28.0069,
  '2027-01-08'::date,
  '14:00',
  'From R200',
  true,
  1400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Altitude January Sun-Drenched Sessions' AND event_date = '2027-01-08'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Kirstenbosch Summer Sunset: Indie & Folk Harmony',
  'Pack your favorite picnic basket and settle onto the soft slopes of Kirstenbosch for an enchanting evening of acoustic folk, indie rock, and vocal harmonies.',
  'music',
  ARRAY['kirstenbosch', 'indie', 'folk', 'cape town', 'sunset concert'],
  'Kirstenbosch National Botanical Garden',
  'Rhodes Drive, Newlands, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9877,
  18.4326,
  -33.9877,
  18.4326,
  '2027-01-10'::date,
  '16:30',
  'From R220',
  true,
  3500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Kirstenbosch Summer Sunset: Indie & Folk Harmony' AND event_date = '2027-01-10'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Rosebank Street Culture & Sneaker Festival',
  'Where streetwear, rare sneaker trades, hip-hop cyphers, and urban graffiti artists collide. Pop-up boutiques, skate ramps, and live DJ battles.',
  'music',
  ARRAY['streetwear', 'sneakers', 'hip-hop', 'rosebank', 'johannesburg'],
  'The Zone @ Rosebank',
  '177 Oxford Road, Rosebank',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1465,
  28.0416,
  -26.1465,
  28.0416,
  '2027-01-15'::date,
  '11:00',
  'R100',
  true,
  2000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Rosebank Street Culture & Sneaker Festival' AND event_date = '2027-01-15'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Pretoria House Music Odyssey',
  'A massive celebration of deep soulful house and barcadi sounds at SunBet Arena. Incredible acoustics, laser visuals, and South Africa''s finest selectors.',
  'music',
  ARRAY['pretoria', 'house music', 'sunbet arena', 'nightlife'],
  'SunBet Arena at Time Square',
  '209 Aramist Avenue, Menlyn, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7877,
  28.2798,
  -25.7877,
  28.2798,
  '2027-01-16'::date,
  '18:00',
  '{"general":"220","vip":"550"}',
  true,
  5500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Pretoria House Music Odyssey' AND event_date = '2027-01-16'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Stellenbosch Summer Wine & Acoustic Chill',
  'Spend a sun-drenched Saturday afternoon relaxing on Spier''s scenic estate. Sip award-winning chenin blanc, taste artisan cheeses, and listen to soothing live acoustic sets.',
  'music',
  ARRAY['stellenbosch', 'wine', 'acoustic', 'spier', 'relax'],
  'Spier Wine Farm',
  'R310 Baden Powell Drive, Stellenbosch',
  'Stellenbosch',
  'ZA',
  'Africa/Johannesburg',
  -33.9723,
  18.7825,
  -33.9723,
  18.7825,
  '2027-01-16'::date,
  '13:00',
  'R280',
  true,
  600,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Stellenbosch Summer Wine & Acoustic Chill' AND event_date = '2027-01-16'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Parkhurst Summer Sunset Social',
  'Vibrant sidewalk dining, craft cocktails, and curated afro-tech music in the trendy suburb of Parkhurst. Mingle with creatives, foodies, and trendsetters.',
  'music',
  ARRAY['parkhurst', 'social', 'craft cocktails', 'johannesburg', 'rooftop'],
  'The Station Parkhurst',
  '24 4th Avenue, Parkhurst',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1384,
  28.0163,
  -26.1384,
  28.0163,
  '2027-01-17'::date,
  '15:00',
  'From R120',
  true,
  500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Parkhurst Summer Sunset Social' AND event_date = '2027-01-17'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Konka January Elite Soiree',
  'The party never stops at Konka. Experience premier VIP hospitality, signature bottle service, and an explosive roster of superstar Amapiano DJs.',
  'music',
  ARRAY['konka', 'soweto', 'amapiano', 'vip', 'nightlife'],
  'Konka Soweto',
  'Modjadji Street, Pimville Zone 1, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2736,
  27.8972,
  -26.2736,
  27.8972,
  '2027-01-22'::date,
  '20:00',
  'From R300',
  true,
  1200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Konka January Elite Soiree' AND event_date = '2027-01-22'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Shimmy Electronic Summer Wave',
  'Top European and African progressive house producers light up Shimmy Beach Club. Unbeatable oceanfront dance floor and stunning views of Table Bay.',
  'music',
  ARRAY['shimmy beach', 'electronic', 'cape town', 'beach party'],
  'Shimmy Beach Club',
  '12 S Arm Road, V&A Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9038,
  18.4293,
  -33.9038,
  18.4293,
  '2027-01-23'::date,
  '16:00',
  'From R320',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Shimmy Electronic Summer Wave' AND event_date = '2027-01-23'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Umlazi Summer Beats & Shisanyama',
  'Live music, smoky ribs, traditional chakalaka, and infectious energy at Eyadini Lounge. The ultimate Durban weekend experience.',
  'music',
  ARRAY['durban', 'shisanyama', 'eyadini', 'lifestyle'],
  'Eyadini Lounge',
  '3 Peace Haven Place, Umlazi, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.9675,
  30.8872,
  -29.9675,
  30.8872,
  '2027-01-23'::date,
  '13:00',
  'From R150',
  true,
  2800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Umlazi Summer Beats & Shisanyama' AND event_date = '2027-01-23'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Kirstenbosch Summer Sunset: Cape Reggae Fest',
  'Positive vibrations and roots reggae rhythms in the botanical gardens. Bring blankets, gather with friends, and dance as the sun sets behind Table Mountain.',
  'music',
  ARRAY['reggae', 'kirstenbosch', 'cape town', 'live music', 'outdoor'],
  'Kirstenbosch National Botanical Garden',
  'Rhodes Drive, Newlands, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9877,
  18.4326,
  -33.9877,
  18.4326,
  '2027-01-24'::date,
  '16:00',
  'From R220',
  true,
  3500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Kirstenbosch Summer Sunset: Cape Reggae Fest' AND event_date = '2027-01-24'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Waterfall City Beats & Bites Carnival',
  'Midrand''s vibrant outdoor festival featuring 30 gourmet food trucks, craft microbreweries, pop-up cocktail bars, and an all-day live DJ stage.',
  'music',
  ARRAY['waterfall city', 'midrand', 'food festival', 'craft beer', 'music'],
  'Waterfall City Park',
  'Corner Magwa & Lone Creek Cres, Waterfall City, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -26.0152,
  28.1091,
  -26.0152,
  28.1091,
  '2027-01-29'::date,
  '12:00',
  'From R120',
  true,
  2200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Waterfall City Beats & Bites Carnival' AND event_date = '2027-01-29'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Kyalami Trackside Summer Music Fest',
  'High-speed supercars by day, high-octane music festival by night. Experience exhilarating drift demonstrations followed by top live electronic and hip-hop acts.',
  'music',
  ARRAY['kyalami', 'motorsport', 'music festival', 'midrand', 'nightlife'],
  'Kyalami Grand Prix Circuit',
  'R55 & Allandale Road, Kyalami, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -25.9981,
  28.0689,
  -25.9981,
  28.0689,
  '2027-01-30'::date,
  '14:00',
  '{"general":"250","pit_lane_vip":"750"}',
  true,
  4500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Kyalami Trackside Summer Music Fest' AND event_date = '2027-01-30'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cabo Beach Club Sunset Sessions',
  'Sunset lovers unite for an exquisite Cape Town Saturday afternoon. Chilled champagne, fresh coastal breeze, and hypnotic melodic grooves.',
  'music',
  ARRAY['cabo beach', 'sunset', 'cape town', 'deep house'],
  'Cabo Beach Club',
  '12 S Arm Road, Victoria & Alfred Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9022,
  18.4243,
  -33.9022,
  18.4243,
  '2027-01-30'::date,
  '15:00',
  'From R300',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cabo Beach Club Sunset Sessions' AND event_date = '2027-01-30'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Max''s Lifestyle Sunday Soul Experience',
  'The gold standard of Sunday soul, jazz, and lifestyle entertainment in Durban. Sumptuous braai cuts, luxury cars, and unforgettable warm coastal hospitality.',
  'music',
  ARRAY['maxs lifestyle', 'durban', 'soul music', 'shisanyama'],
  'Max''s Lifestyle Village',
  'V1328 Mbe Road, Umlazi, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.9691,
  30.8856,
  -29.9691,
  30.8856,
  '2027-01-31'::date,
  '12:00',
  'From R150',
  true,
  2500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Max''s Lifestyle Sunday Soul Experience' AND event_date = '2027-01-31'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Gqeberha Beachfront Sunday Vibes',
  'Sun, surf, and sensational music along Summerstrand beach. Local food vendors, beach cricket, and a sunset live acoustic concert.',
  'music',
  ARRAY['gqeberha', 'eastern cape', 'beachfront', 'sunday session'],
  'The Boardwalk Gqeberha',
  'Beach Road, Summerstrand, Gqeberha',
  'Gqeberha',
  'ZA',
  'Africa/Johannesburg',
  -33.9858,
  25.6586,
  -33.9858,
  25.6586,
  '2027-01-31'::date,
  '13:00',
  'From R100',
  true,
  1500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Gqeberha Beachfront Sunday Vibes' AND event_date = '2027-01-31'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Braamfontein Rooftop Summer Jam',
  'Joburg''s trendiest young creatives, digital artists, and sound innovators gather for an elevated rooftop experience with panoramic views of the Nelson Mandela Bridge.',
  'music',
  ARRAY['braamfontein', 'rooftop', 'art', 'johannesburg', 'hiphop'],
  'Constitution Hill Human Rights Precinct',
  '11 Kotze Street, Braamfontein',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1896,
  28.0425,
  -26.1896,
  28.0425,
  '2027-01-31'::date,
  '15:00',
  'From R120',
  true,
  1000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Braamfontein Rooftop Summer Jam' AND event_date = '2027-01-31'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Southern Africa 2027 Economic & Tech Outlook',
  'Chief economists, central bankers, and corporate treasurers discuss GDP projections, currency trajectories, and digital economy growth drivers for 2027.',
  'biz',
  ARRAY['economy', 'banking', 'macroeconomics', 'sandton', 'business'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-01-12'::date,
  '08:30',
  'R850',
  true,
  450,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Southern Africa 2027 Economic & Tech Outlook' AND event_date = '2027-01-12'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'AI & Enterprise Automation Summit 2027',
  'Exploring how generative AI, machine learning pipelines, and intelligent automation are driving operational transformation across financial services, healthcare, and retail in Africa.',
  'biz',
  ARRAY['ai', 'automation', 'enterprise tech', 'midrand', 'conference'],
  'Gallagher Convention Centre',
  '19 Richards Drive, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -26.0028,
  28.1287,
  -26.0028,
  28.1287,
  '2027-01-14'::date,
  '09:00',
  'R950',
  true,
  600,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'AI & Enterprise Automation Summit 2027' AND event_date = '2027-01-14'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Silicon Cape Startup Kickoff & Angel Day',
  'Cape Town''s leading tech founders, mentors, and angel investors meet to explore funding strategies, go-to-market scaling, and international expansion.',
  'biz',
  ARRAY['startups', 'silicon cape', 'angel investment', 'cape town'],
  'Cape Town International Convention Centre (CTICC)',
  '1 Lower Long Street, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9161,
  18.4285,
  -33.9161,
  18.4285,
  '2027-01-18'::date,
  '10:00',
  'R350',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Silicon Cape Startup Kickoff & Angel Day' AND event_date = '2027-01-18'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Renewable Energy & Battery Storage Summit',
  'Addressing South Africa''s rapid commercial solar adoption, utility-scale battery storage, wheeling regulations, and private power purchase agreements (PPAs).',
  'biz',
  ARRAY['renewable energy', 'solar', 'grid storage', 'sandton', 'green tech'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2027-01-20'::date,
  '09:00',
  'R1,100',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Renewable Energy & Battery Storage Summit' AND event_date = '2027-01-20'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'eCommerce Africa Logistics & Payments Forum',
  'A comprehensive one-day forum covering last-mile courier logistics, parcel locker networks, instant EFT integration, and payment fraud prevention.',
  'biz',
  ARRAY['ecommerce', 'logistics', 'fintech', 'retail', 'sandton'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-01-21'::date,
  '09:30',
  'R700',
  true,
  400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'eCommerce Africa Logistics & Payments Forum' AND event_date = '2027-01-21'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Durban Manufacturing & Export Excellence Conference',
  'Accelerating industrial productivity, automotive supply chain resilience, and maritime export opportunities through the Port of Durban.',
  'biz',
  ARRAY['manufacturing', 'export', 'durban', 'trade', 'supply chain'],
  'Durban ICC',
  '45 Bram Fischer Road, Durban Central',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.8524,
  31.0286,
  -29.8524,
  31.0286,
  '2027-01-25'::date,
  '08:30',
  'R750',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Durban Manufacturing & Export Excellence Conference' AND event_date = '2027-01-25'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'SME Tax & Compliance Masterclass 2027',
  'Practical, actionable guidance for South African small business owners on SARS compliance, turnover tax, VAT registration, and claiming tax incentives.',
  'biz',
  ARRAY['sme', 'tax', 'sars', 'compliance', 'pretoria'],
  'Menlyn Maine Central Square',
  'Amarand Avenue, Waterkloof Glen, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7865,
  28.2812,
  -25.7865,
  28.2812,
  '2027-01-26'::date,
  '09:00',
  'R250',
  true,
  250,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'SME Tax & Compliance Masterclass 2027' AND event_date = '2027-01-26'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Venture Capital Africa Investor Breakfast',
  'Private round-table for general partners, institutional LPs, and family offices managing tech and growth equity portfolios across the African continent.',
  'biz',
  ARRAY['venture capital', 'private equity', 'sandton', 'investors'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2027-01-27'::date,
  '08:00',
  'Invitation / R800',
  true,
  150,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Venture Capital Africa Investor Breakfast' AND event_date = '2027-01-27'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Healthcare Innovation & MedTech Expo',
  'Showcasing digital health diagnostics, telemedicine platforms, pharmacy supply chain tech, and health insurance automation across Southern Africa.',
  'biz',
  ARRAY['healthcare', 'medtech', 'telemedicine', 'cape town', 'expo'],
  'Cape Town International Convention Centre (CTICC)',
  '1 Lower Long Street, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9161,
  18.4285,
  -33.9161,
  18.4285,
  '2027-01-28'::date,
  '09:00',
  'R650',
  true,
  450,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Healthcare Innovation & MedTech Expo' AND event_date = '2027-01-28'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cybersecurity & Cloud Resilience Congress',
  'Defending African enterprises against ransomware, identity theft, and data breaches. Live penetration testing demos, zero trust architecture, and POPIA audits.',
  'biz',
  ARRAY['cybersecurity', 'cloud', 'popia', 'data protection', 'sandton'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-01-29'::date,
  '09:00',
  'R900',
  true,
  400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cybersecurity & Cloud Resilience Congress' AND event_date = '2027-01-29'::date AND deleted_at IS NULL
);
-- =========================================================================
-- February 2027: 20 Big Events + 10 Business Events
-- =========================================================================


INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Ultra Summer Warmup Rooftop Fiesta',
  'Get warmed up for the massive festival month ahead. Deep bass, uplifting electro, and panoramic sunset views across the Johannesburg cityscape.',
  'music',
  ARRAY['rooftop', 'electronic', 'parkhurst', 'johannesburg', 'warmup'],
  'The Station Parkhurst',
  '24 4th Avenue, Parkhurst',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1384,
  28.0163,
  -26.1384,
  28.0163,
  '2027-02-05'::date,
  '17:00',
  'From R150',
  true,
  650,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Ultra Summer Warmup Rooftop Fiesta' AND event_date = '2027-02-05'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cabo Beach Club Sunset Afro-Tech',
  'Electrifying beats right on the Atlantic coastline. VIP bottle service, fresh oysters, craft cocktails, and world-class underground selectors.',
  'music',
  ARRAY['cabo beach', 'afro-tech', 'cape town', 'summer', 'sunset'],
  'Cabo Beach Club',
  '12 S Arm Road, Victoria & Alfred Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9022,
  18.4243,
  -33.9022,
  18.4243,
  '2027-02-06'::date,
  '15:00',
  'From R300',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cabo Beach Club Sunset Afro-Tech' AND event_date = '2027-02-06'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'SunBet Arena Symphony of Amapiano',
  'A transcendent musical production pairing live strings, horns, and choral arrangements with the biggest Amapiano hits of the decade.',
  'music',
  ARRAY['amapiano', 'live orchestra', 'pretoria', 'sunbet arena', 'concert'],
  'SunBet Arena at Time Square',
  '209 Aramist Avenue, Menlyn, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7877,
  28.2798,
  -25.7877,
  28.2798,
  '2027-02-06'::date,
  '19:00',
  '{"tier_1":"300","tier_2":"500","vip":"950"}',
  true,
  6500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'SunBet Arena Symphony of Amapiano' AND event_date = '2027-02-06'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Kirstenbosch Summer Sunset: Afro-Soul Romance',
  'Treat your loved ones to an open-air concert beneath Table Mountain. World-class Afro-soul and RnB vocalists perform as the twilight fades into evening.',
  'music',
  ARRAY['kirstenbosch', 'afro-soul', 'rnb', 'cape town', 'romantic'],
  'Kirstenbosch National Botanical Garden',
  'Rhodes Drive, Newlands, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9877,
  18.4326,
  -33.9877,
  18.4326,
  '2027-02-07'::date,
  '16:30',
  'From R220',
  true,
  3500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Kirstenbosch Summer Sunset: Afro-Soul Romance' AND event_date = '2027-02-07'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Altitude Beach Pre-Valentine Pool Party',
  'Love is in the air at Joburg''s favorite beach club. Heart-shaped pool floats, specialty pink champagne cocktails, and infectious party beats all day long.',
  'music',
  ARRAY['pool party', 'valentines', 'altitude beach', 'fourways', 'party'],
  'Altitude Beach',
  'Fourways Mall, Ruby Close, Fourways',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.0175,
  28.0069,
  -26.0175,
  28.0069,
  '2027-02-12'::date,
  '14:00',
  'From R220',
  true,
  1500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Altitude Beach Pre-Valentine Pool Party' AND event_date = '2027-02-12'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Shimmy Valentine Sunset Cruise & Rave',
  'Exclusive harbour boat cruise followed by an explosive Valentine''s Eve beach party at Shimmy. Romantic beachfront dining and euphoric dance tracks.',
  'music',
  ARRAY['valentines', 'shimmy beach', 'cape town', 'boat cruise', 'nightlife'],
  'Shimmy Beach Club',
  '12 S Arm Road, V&A Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9038,
  18.4293,
  -33.9038,
  18.4293,
  '2027-02-13'::date,
  '16:00',
  '{"party_only":"350","cruise_and_party":"950"}',
  true,
  1600,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Shimmy Valentine Sunset Cruise & Rave' AND event_date = '2027-02-13'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Konka Valentine Red & Black Night',
  'Soweto''s most glamorous Valentine party. Strictly red and black dress code, extravagant VIP tables, celebrity guests, and non-stop luxury energy.',
  'music',
  ARRAY['valentines', 'konka', 'soweto', 'luxury nightlife', 'vip'],
  'Konka Soweto',
  'Modjadji Street, Pimville Zone 1, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2736,
  27.8972,
  -26.2736,
  27.8972,
  '2027-02-13'::date,
  '20:00',
  'From R350',
  true,
  1200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Konka Valentine Red & Black Night' AND event_date = '2027-02-13'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Valentine Candlelit Beach Dinner & Acoustic Night',
  'Treat your partner to an unforgettable Valentine''s Day at Grand Africa Café. Private tables on the beach, 4-course gourmet dinner, and intimate live acoustic ballads.',
  'music',
  ARRAY['valentines', 'grand africa', 'cape town', 'fine dining', 'couples'],
  'Grand Africa Café & Beach',
  'Haul Road, V&A Waterfront, Granger Bay, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9018,
  18.4191,
  -33.9018,
  18.4191,
  '2027-02-14'::date,
  '18:30',
  'R850 per person (includes 4-course menu)',
  true,
  600,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Valentine Candlelit Beach Dinner & Acoustic Night' AND event_date = '2027-02-14'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Spier Valentine Wine & Chocolate Soiree',
  'An exquisite evening exploring artisanal single-origin chocolate pairings with Spier''s vintage red wines, accompanied by a live violin and cello duo.',
  'music',
  ARRAY['valentines', 'stellenbosch', 'wine pairing', 'chocolate', 'romantic'],
  'Spier Wine Farm',
  'R310 Baden Powell Drive, Stellenbosch',
  'Stellenbosch',
  'ZA',
  'Africa/Johannesburg',
  -33.9723,
  18.7825,
  -33.9723,
  18.7825,
  '2027-02-14'::date,
  '17:00',
  'R550 per couple',
  true,
  400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Spier Valentine Wine & Chocolate Soiree' AND event_date = '2027-02-14'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Zone 6 Lovers & Friends Amapiano Jam',
  'The biggest post-Valentine community party in Soweto. Bring your crew or partner for sensational music, incredible food, and unforgettable memories.',
  'music',
  ARRAY['amapiano', 'soweto', 'zone 6', 'party', 'nightlife'],
  'Zone 6 Venue',
  'Warehouse 28, Blackwood Street, Diepkloof Zone 6, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2483,
  27.9351,
  -26.2483,
  27.9351,
  '2027-02-19'::date,
  '18:00',
  'From R150',
  true,
  3500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Zone 6 Lovers & Friends Amapiano Jam' AND event_date = '2027-02-19'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Eyadini Valentine Coast Weekend',
  'Durban''s liveliest weekend gathering with sizzling shisanyama, top coastal DJs, and authentic KZN party vibes under the warm February sky.',
  'music',
  ARRAY['durban', 'eyadini', 'shisanyama', 'weekend', 'lifestyle'],
  'Eyadini Lounge',
  '3 Peace Haven Place, Umlazi, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.9675,
  30.8872,
  -29.9675,
  30.8872,
  '2027-02-20'::date,
  '12:00',
  'From R150',
  true,
  2500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Eyadini Valentine Coast Weekend' AND event_date = '2027-02-20'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Kyalami Night Track Festival & Drifting',
  'Adrenaline and music collide. Pro drift tandem battles illuminated under stadium floodlights, followed by a massive live DJ stage at the clubhouse.',
  'music',
  ARRAY['drifting', 'kyalami', 'motorsport', 'midrand', 'night festival'],
  'Kyalami Grand Prix Circuit',
  'R55 & Allandale Road, Kyalami, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -25.9981,
  28.0689,
  -25.9981,
  28.0689,
  '2027-02-20'::date,
  '16:00',
  'From R220',
  true,
  4000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Kyalami Night Track Festival & Drifting' AND event_date = '2027-02-20'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Kirstenbosch Summer Sunset: Jazz in the Park',
  'Contemporary and traditional Cape Jazz greats light up the natural amphitheatre of Kirstenbosch. Unwind with friends on the rolling green lawns.',
  'music',
  ARRAY['jazz', 'kirstenbosch', 'cape town', 'live concert'],
  'Kirstenbosch National Botanical Garden',
  'Rhodes Drive, Newlands, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9877,
  18.4326,
  -33.9877,
  18.4326,
  '2027-02-21'::date,
  '16:00',
  'From R220',
  true,
  3500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Kirstenbosch Summer Sunset: Jazz in the Park' AND event_date = '2027-02-21'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Rosebank Streetwear & Hip Hop Showcase',
  'Live rap battles, beat-making showcases, exclusive sneaker releases, and live graffiti mural creation in the heart of Rosebank.',
  'music',
  ARRAY['hiphop', 'streetwear', 'rosebank', 'graffiti', 'culture'],
  'The Zone @ Rosebank',
  '177 Oxford Road, Rosebank',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1465,
  28.0416,
  -26.1465,
  28.0416,
  '2027-02-26'::date,
  '14:00',
  'R120',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Rosebank Streetwear & Hip Hop Showcase' AND event_date = '2027-02-26'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cabo Beach Club Sunset Melodic Grooves',
  'Experience pure melodic magic right on the waterfront. Top national selectors deliver smooth, driving basslines as the sun dips into the ocean.',
  'music',
  ARRAY['cabo beach', 'melodic techno', 'cape town', 'sunset'],
  'Cabo Beach Club',
  '12 S Arm Road, Victoria & Alfred Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9022,
  18.4243,
  -33.9022,
  18.4243,
  '2027-02-27'::date,
  '15:00',
  'From R300',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cabo Beach Club Sunset Melodic Grooves' AND event_date = '2027-02-27'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Pretoria Craft Gin & Food Truck Carnival',
  'Taste over 50 artisanal South African craft gins, craft tonics, and international street food creations on the lawns of Menlyn Maine.',
  'music',
  ARRAY['craft gin', 'food trucks', 'pretoria', 'menlyn', 'lifestyle'],
  'Menlyn Maine Central Square',
  'Amarand Avenue, Waterkloof Glen, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7865,
  28.2812,
  -25.7865,
  28.2812,
  '2027-02-27'::date,
  '11:00',
  'From R150',
  true,
  2500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Pretoria Craft Gin & Food Truck Carnival' AND event_date = '2027-02-27'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Altitude Beach February Finale Pool Fest',
  'Close out February with an epic poolside bash. Synchronized swimmers, percussionists, live vocalists, and the hottest amapiano heaters.',
  'music',
  ARRAY['altitude beach', 'fourways', 'pool party', 'amapiano'],
  'Altitude Beach',
  'Fourways Mall, Ruby Close, Fourways',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.0175,
  28.0069,
  -26.0175,
  28.0069,
  '2027-02-27'::date,
  '13:00',
  'From R220',
  true,
  1500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Altitude Beach February Finale Pool Fest' AND event_date = '2027-02-27'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Max''s Lifestyle Sunday Vibe Session',
  'The benchmark of KZN township tourism and VIP culture. Enjoy world-renowned hospitality, legendary braai feasts, and top-tier music.',
  'music',
  ARRAY['maxs lifestyle', 'durban', 'sunday', 'shisanyama'],
  'Max''s Lifestyle Village',
  'V1328 Mbe Road, Umlazi, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.9691,
  30.8856,
  -29.9691,
  30.8856,
  '2027-02-28'::date,
  '12:00',
  'From R150',
  true,
  2500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Max''s Lifestyle Sunday Vibe Session' AND event_date = '2027-02-28'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Gqeberha Boardwalk Sunset Social',
  'Coastal breezes, acoustic pop sets, and delicious local seafood along the Boardwalk pier. The perfect way to round off the month.',
  'music',
  ARRAY['gqeberha', 'boardwalk', 'eastern cape', 'sunset'],
  'The Boardwalk Gqeberha',
  'Beach Road, Summerstrand, Gqeberha',
  'Gqeberha',
  'ZA',
  'Africa/Johannesburg',
  -33.9858,
  25.6586,
  -33.9858,
  25.6586,
  '2027-02-28'::date,
  '14:00',
  'From R100',
  true,
  1600,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Gqeberha Boardwalk Sunset Social' AND event_date = '2027-02-28'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Braamfontein Sunset Electronic Session',
  'Cutting-edge electronic music on the historic grounds of Constitution Hill. Stunning architectural lighting and underground sonic exploration.',
  'music',
  ARRAY['braamfontein', 'electronic', 'constitution hill', 'johannesburg'],
  'Constitution Hill Human Rights Precinct',
  '11 Kotze Street, Braamfontein',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1896,
  28.0425,
  -26.1896,
  28.0425,
  '2027-02-28'::date,
  '16:00',
  'From R150',
  true,
  1200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Braamfontein Sunset Electronic Session' AND event_date = '2027-02-28'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'African Mining & Energy Leaders Executive Indaba',
  'High-level dialogue on critical minerals, mining ESG compliance, local beneficiation, and private renewable power integration for African mining operations.',
  'biz',
  ARRAY['mining', 'energy', 'esg', 'sandton', 'indaba'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-02-02'::date,
  '08:30',
  'R1,500',
  true,
  650,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'African Mining & Energy Leaders Executive Indaba' AND event_date = '2027-02-02'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'African Venture Capital & Private Equity Summit',
  'Connecting global institutional asset allocators with African GP managers deploying capital into technology, consumer goods, and climate infrastructure.',
  'biz',
  ARRAY['venture capital', 'private equity', 'cape town', 'investors'],
  'Cape Town International Convention Centre (CTICC)',
  '1 Lower Long Street, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9161,
  18.4285,
  -33.9161,
  18.4285,
  '2027-02-04'::date,
  '09:00',
  'R1,200',
  true,
  500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'African Venture Capital & Private Equity Summit' AND event_date = '2027-02-04'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'SME Funding & Growth Capital Expo 2027',
  'Direct matchmaking between bank loan officers, angel syndicates, DFIs, and growing South African SMEs looking for working capital and equipment finance.',
  'biz',
  ARRAY['sme funding', 'finance', 'midrand', 'growth', 'business'],
  'Gallagher Convention Centre',
  '19 Richards Drive, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -26.0028,
  28.1287,
  -26.0028,
  28.1287,
  '2027-02-09'::date,
  '09:00',
  'Free (Registration Required)',
  false,
  800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'SME Funding & Growth Capital Expo 2027' AND event_date = '2027-02-09'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Commercial Property & Green Building Conference',
  'Exploring net-zero building designs, edge-certified developments, solar rooftop wheeling, and the future of flexible office spaces in South Africa.',
  'biz',
  ARRAY['property', 'green building', 'real estate', 'sandton'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2027-02-11'::date,
  '09:00',
  'R850',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Commercial Property & Green Building Conference' AND event_date = '2027-02-11'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'FinTech Africa Payments & Cross-Border Remittances',
  'Keynote panels detailing instant settlement networks, stablecoin-assisted trade settlement, and reduction of remittance friction across SADC corridors.',
  'biz',
  ARRAY['fintech', 'remittances', 'payments', 'sadc', 'banking'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-02-16'::date,
  '09:00',
  'R900',
  true,
  450,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'FinTech Africa Payments & Cross-Border Remittances' AND event_date = '2027-02-16'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Durban Port Supply Chain & Maritime Tech Forum',
  'Showcasing digital cargo tracking, container terminal automation, and customs single-window efficiency improvements at the Port of Durban.',
  'biz',
  ARRAY['maritime', 'logistics', 'durban', 'shipping', 'ports'],
  'Durban ICC',
  '45 Bram Fischer Road, Durban Central',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.8524,
  31.0286,
  -29.8524,
  31.0286,
  '2027-02-18'::date,
  '08:30',
  'R750',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Durban Port Supply Chain & Maritime Tech Forum' AND event_date = '2027-02-18'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Southern Africa Agri-Tech & Food Security Expo',
  'Highlighting precision agriculture, satellite soil mapping, drought-resilient crops, and solar-powered irrigation tech for commercial and smallholder farmers.',
  'biz',
  ARRAY['agritech', 'agriculture', 'stellenbosch', 'food security'],
  'Spier Wine Farm',
  'R310 Baden Powell Drive, Stellenbosch',
  'Stellenbosch',
  'ZA',
  'Africa/Johannesburg',
  -33.9723,
  18.7825,
  -33.9723,
  18.7825,
  '2027-02-23'::date,
  '09:00',
  'R500',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Southern Africa Agri-Tech & Food Security Expo' AND event_date = '2027-02-23'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Women in Corporate Governance & Board Leadership',
  'High-impact masterclass on King IV compliance, audit committee effectiveness, board diversity, and stakeholder capitalism for current and aspiring female directors.',
  'biz',
  ARRAY['governance', 'leadership', 'boardroom', 'sandton', 'women'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2027-02-24'::date,
  '08:30',
  'R650',
  true,
  250,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Women in Corporate Governance & Board Leadership' AND event_date = '2027-02-24'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Pretoria Automotive & Manufacturing Summit',
  'Examining South Africa''s transition to electric vehicle (EV) manufacturing, battery component sourcing, and supply chain readiness in the automotive sector.',
  'biz',
  ARRAY['automotive', 'ev', 'manufacturing', 'pretoria'],
  'Menlyn Maine Central Square',
  'Amarand Avenue, Waterkloof Glen, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7865,
  28.2812,
  -25.7865,
  28.2812,
  '2027-02-25'::date,
  '09:00',
  'R800',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Pretoria Automotive & Manufacturing Summit' AND event_date = '2027-02-25'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Digital Marketing & Social Commerce Conclave 2027',
  'Leading digital agencies, performance marketers, and brand managers explore TikTok shop integration, influencer contract standards, and AI creative workflows.',
  'biz',
  ARRAY['digital marketing', 'social commerce', 'rosebank', 'advertising'],
  'The Zone @ Rosebank',
  '177 Oxford Road, Rosebank',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1465,
  28.0416,
  -26.1465,
  28.0416,
  '2027-02-26'::date,
  '09:30',
  'R450',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Digital Marketing & Social Commerce Conclave 2027' AND event_date = '2027-02-26'::date AND deleted_at IS NULL
);
-- =========================================================================
-- March 2027: 20 Big Events + 10 Business Events
-- =========================================================================


INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Autumn Beats Outdoor Festival',
  'Embrace the golden tones of early autumn with a high-energy outdoor music festival featuring South Africa''s top house and amapiano royalty.',
  'music',
  ARRAY['festivals', 'waterfall city', 'amapiano', 'midrand', 'outdoor'],
  'Waterfall City Park',
  'Corner Magwa & Lone Creek Cres, Waterfall City, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -26.0152,
  28.1091,
  -26.0152,
  28.1091,
  '2027-03-05'::date,
  '13:00',
  'From R180',
  true,
  3000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Autumn Beats Outdoor Festival' AND event_date = '2027-03-05'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cabo Beach Club Sunset House Groove',
  'As autumn arrives in the Cape, enjoy clear skies and sublime oceanic views paired with world-class deep house and coastal dining.',
  'music',
  ARRAY['cabo beach', 'house music', 'cape town', 'sunset', 'autumn'],
  'Cabo Beach Club',
  '12 S Arm Road, Victoria & Alfred Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9022,
  18.4243,
  -33.9022,
  18.4243,
  '2027-03-06'::date,
  '15:00',
  'From R300',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cabo Beach Club Sunset House Groove' AND event_date = '2027-03-06'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'SunBet Arena Afro-Tech Masters',
  'An immersive visual and sonic celebration of South African electronic music, featuring mind-bending 3D projections and bone-rattling bass.',
  'music',
  ARRAY['afro-tech', 'sunbet arena', 'pretoria', 'electronic', 'visuals'],
  'SunBet Arena at Time Square',
  '209 Aramist Avenue, Menlyn, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7877,
  28.2798,
  -25.7877,
  28.2798,
  '2027-03-06'::date,
  '18:00',
  '{"tier_1":"250","tier_2":"450","vip":"850"}',
  true,
  6500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'SunBet Arena Afro-Tech Masters' AND event_date = '2027-03-06'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Kirstenbosch Summer Sunset: Cape Town Philharmonic Pop Classics',
  'The prestigious Cape Town Philharmonic Orchestra performs an uplifting, accessible program of pop, film, and Broadway classics on the botanical lawn.',
  'music',
  ARRAY['orchestra', 'kirstenbosch', 'cape town', 'classical', 'picnic'],
  'Kirstenbosch National Botanical Garden',
  'Rhodes Drive, Newlands, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9877,
  18.4326,
  -33.9877,
  18.4326,
  '2027-03-07'::date,
  '16:00',
  'From R250',
  true,
  4000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Kirstenbosch Summer Sunset: Cape Town Philharmonic Pop Classics' AND event_date = '2027-03-07'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Altitude Beach Autumn Sunset Bash',
  'Fourways turns up the heat with poolside VIP daybeds, live saxophone accompaniment over deep house rhythms, and signature cocktail buckets.',
  'music',
  ARRAY['altitude beach', 'pool party', 'deep house', 'fourways'],
  'Altitude Beach',
  'Fourways Mall, Ruby Close, Fourways',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.0175,
  28.0069,
  -26.0175,
  28.0069,
  '2027-03-12'::date,
  '14:00',
  'From R220',
  true,
  1500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Altitude Beach Autumn Sunset Bash' AND event_date = '2027-03-12'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Shimmy Electronic Horizon Festival',
  'A 10-hour dance marathon on the water featuring local underground techno and progressive house selectors. Spectacular harbor views and laser effects.',
  'music',
  ARRAY['shimmy beach', 'techno', 'cape town', 'electronic', 'harbour'],
  'Shimmy Beach Club',
  '12 S Arm Road, V&A Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9038,
  18.4293,
  -33.9038,
  18.4293,
  '2027-03-13'::date,
  '14:00',
  'From R320',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Shimmy Electronic Horizon Festival' AND event_date = '2027-03-13'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Konka Autumn High-Energy Soiree',
  'The gold standard of Soweto luxury. World-class bottle shows, supreme sound reinforcement, and surprise star performances all night long.',
  'music',
  ARRAY['konka', 'soweto', 'amapiano', 'vip', 'nightlife'],
  'Konka Soweto',
  'Modjadji Street, Pimville Zone 1, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2736,
  27.8972,
  -26.2736,
  27.8972,
  '2027-03-13'::date,
  '20:00',
  'From R350',
  true,
  1200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Konka Autumn High-Energy Soiree' AND event_date = '2027-03-13'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Eyadini Shisanyama & Gqom Sunday',
  'Durban''s liveliest weekend tradition. Savour flame-grilled meats and traditional sides while top KZN DJs play the finest gqom and amapiano.',
  'music',
  ARRAY['eyadini', 'durban', 'gqom', 'shisanyama', 'sunday'],
  'Eyadini Lounge',
  '3 Peace Haven Place, Umlazi, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.9675,
  30.8872,
  -29.9675,
  30.8872,
  '2027-03-14'::date,
  '12:00',
  'From R150',
  true,
  2600,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Eyadini Shisanyama & Gqom Sunday' AND event_date = '2027-03-14'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Soweto Human Rights Weekend Cultural Fiesta',
  'Commemorating South Africa''s human rights journey with live poetry, historic theatre, acoustic soul stages, and craft food stalls in Diepkloof.',
  'music',
  ARRAY['human rights', 'soweto', 'zone 6', 'culture', 'live music'],
  'Zone 6 Venue',
  'Warehouse 28, Blackwood Street, Diepkloof Zone 6, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2483,
  27.9351,
  -26.2483,
  27.9351,
  '2027-03-19'::date,
  '16:00',
  'From R150',
  true,
  3500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Soweto Human Rights Weekend Cultural Fiesta' AND event_date = '2027-03-19'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Constitution Hill Human Rights Festival & Concert',
  'A weekend of truth, freedom, and music at Constitution Hill. Three outdoor music stages, film screenings, artisan book markets, and human rights dialogues.',
  'music',
  ARRAY['constitution hill', 'human rights', 'festival', 'braamfontein', 'freedom'],
  'Constitution Hill Human Rights Precinct',
  '11 Kotze Street, Braamfontein',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1896,
  28.0425,
  -26.1896,
  28.0425,
  '2027-03-20'::date,
  '10:00',
  'Free / R100 for evening concert',
  false,
  5000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Constitution Hill Human Rights Festival & Concert' AND event_date = '2027-03-20'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Kyalami Autumn Supercar Parade & Track Fest',
  'Exotic Italian, British, and German supercars roar around the Kyalami Grand Prix Circuit, followed by a sunset music festival and food village.',
  'music',
  ARRAY['supercars', 'kyalami', 'midrand', 'motorsport', 'festival'],
  'Kyalami Grand Prix Circuit',
  'R55 & Allandale Road, Kyalami, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -25.9981,
  28.0689,
  -25.9981,
  28.0689,
  '2027-03-20'::date,
  '12:00',
  '{"general":"250","paddock_pass":"650"}',
  true,
  4500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Kyalami Autumn Supercar Parade & Track Fest' AND event_date = '2027-03-20'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Human Rights Day Sunset Concert Kirstenbosch',
  'Celebrate Human Rights Day in Cape Town with South Africa''s most beloved musical icons playing folk, freedom songs, and uplifting afro-pop.',
  'music',
  ARRAY['human rights day', 'kirstenbosch', 'cape town', 'freedom songs', 'concert'],
  'Kirstenbosch National Botanical Garden',
  'Rhodes Drive, Newlands, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9877,
  18.4326,
  -33.9877,
  18.4326,
  '2027-03-21'::date,
  '16:00',
  'From R220',
  true,
  4000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Human Rights Day Sunset Concert Kirstenbosch' AND event_date = '2027-03-21'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Grand Africa Café Autumn Beach Party',
  'Kick off your shoes and dance on the sand at Granger Bay. Superb seafood, chilled rosé, and world-class house selectors playing till the stars come out.',
  'music',
  ARRAY['grand africa', 'cape town', 'beach party', 'autumn', 'house music'],
  'Grand Africa Café & Beach',
  'Haul Road, V&A Waterfront, Granger Bay, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9018,
  18.4191,
  -33.9018,
  18.4191,
  '2027-03-21'::date,
  '15:00',
  'From R250',
  true,
  1200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Grand Africa Café Autumn Beach Party' AND event_date = '2027-03-21'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Spier Autumn Harvest & Jazz Picnic',
  'Celebrate the end of grape harvest season in Stellenbosch. Fresh seasonal produce, newly bottled wines, grape stomping activities, and live gypsy jazz.',
  'music',
  ARRAY['harvest', 'stellenbosch', 'wine', 'jazz', 'spier'],
  'Spier Wine Farm',
  'R310 Baden Powell Drive, Stellenbosch',
  'Stellenbosch',
  'ZA',
  'Africa/Johannesburg',
  -33.9723,
  18.7825,
  -33.9723,
  18.7825,
  '2027-03-22'::date,
  '11:00',
  'R350',
  true,
  650,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Spier Autumn Harvest & Jazz Picnic' AND event_date = '2027-03-22'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Parkhurst Autumn Craft Beer & Gin Fest',
  'Sample over 30 small-batch craft beers and gins from Gauteng''s leading micro-distilleries, accompanied by gourmet burger pop-ups and live acoustic duos.',
  'music',
  ARRAY['craft beer', 'gin', 'parkhurst', 'johannesburg', 'tasting'],
  'The Station Parkhurst',
  '24 4th Avenue, Parkhurst',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1384,
  28.0163,
  -26.1384,
  28.0163,
  '2027-03-26'::date,
  '16:00',
  'From R120',
  true,
  600,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Parkhurst Autumn Craft Beer & Gin Fest' AND event_date = '2027-03-26'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cabo Beach Club Sunset Finale',
  'Cape Town''s finest waterfront party experience. Exceptional sushi, champagne sparklers, and world-class underground electronic music.',
  'music',
  ARRAY['cabo beach', 'cape town', 'sunset', 'electronic', 'vip'],
  'Cabo Beach Club',
  '12 S Arm Road, Victoria & Alfred Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9022,
  18.4243,
  -33.9022,
  18.4243,
  '2027-03-27'::date,
  '15:00',
  'From R300',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cabo Beach Club Sunset Finale' AND event_date = '2027-03-27'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Menlyn Maine Autumn Fashion & Music Night',
  'Top South African fashion designers unveil their autumn/winter ready-to-wear collections on an outdoor runway, accompanied by live DJ sets and champagne lounges.',
  'music',
  ARRAY['fashion', 'pretoria', 'menlyn', 'runway', 'cocktails'],
  'Menlyn Maine Central Square',
  'Amarand Avenue, Waterkloof Glen, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7865,
  28.2812,
  -25.7865,
  28.2812,
  '2027-03-27'::date,
  '18:00',
  '{"runway_seat":"250","front_row_vip":"650"}',
  true,
  1500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Menlyn Maine Autumn Fashion & Music Night' AND event_date = '2027-03-27'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Max''s Lifestyle Autumn Shisanyama Sunday',
  'The best place to spend a Sunday in Durban. Impeccable service, mouth-watering cuts of meat, and high-fashion local flair.',
  'music',
  ARRAY['maxs lifestyle', 'durban', 'shisanyama', 'lifestyle'],
  'Max''s Lifestyle Village',
  'V1328 Mbe Road, Umlazi, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.9691,
  30.8856,
  -29.9691,
  30.8856,
  '2027-03-28'::date,
  '12:00',
  'From R150',
  true,
  2500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Max''s Lifestyle Autumn Shisanyama Sunday' AND event_date = '2027-03-28'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Gqeberha Oceanfront Autumn Breeze Fest',
  'Live music on the beach, local artisanal craft stalls, fresh seafood braais, and family-friendly beach games along the Boardwalk.',
  'music',
  ARRAY['gqeberha', 'boardwalk', 'eastern cape', 'beach festival'],
  'The Boardwalk Gqeberha',
  'Beach Road, Summerstrand, Gqeberha',
  'Gqeberha',
  'ZA',
  'Africa/Johannesburg',
  -33.9858,
  25.6586,
  -33.9858,
  25.6586,
  '2027-03-28'::date,
  '12:00',
  'From R100',
  true,
  1500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Gqeberha Oceanfront Autumn Breeze Fest' AND event_date = '2027-03-28'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Rosebank Art & Vinyl Evening Market',
  'Browse rare vintage vinyl records, contemporary African art prints, and handcrafted ceramics while enjoying craft cocktails and live ambient soul sets.',
  'music',
  ARRAY['art market', 'vinyl', 'rosebank', 'johannesburg', 'culture'],
  'The Zone @ Rosebank',
  '177 Oxford Road, Rosebank',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1465,
  28.0416,
  -26.1465,
  28.0416,
  '2027-03-31'::date,
  '17:00',
  'Free / R50 tasting ticket',
  false,
  1200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Rosebank Art & Vinyl Evening Market' AND event_date = '2027-03-31'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Africa FinTech & Digital Banking Summit 2027',
  'Convening African commercial banks, neobanks, payment switches, and regulators to debate credit scoring algorithms, API aggregation, and CBDC rollouts.',
  'biz',
  ARRAY['fintech', 'banking', 'digital payments', 'sandton', 'summit'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-03-03'::date,
  '08:30',
  'R1,100',
  true,
  650,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Africa FinTech & Digital Banking Summit 2027' AND event_date = '2027-03-03'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'AI in Healthcare & Life Sciences Congress',
  'Examining AI-driven diagnostics, clinical trial acceleration, genomic sequencing, and automated patient intake systems for Southern African healthcare providers.',
  'biz',
  ARRAY['ai', 'healthcare', 'life sciences', 'cape town', 'medical'],
  'Cape Town International Convention Centre (CTICC)',
  '1 Lower Long Street, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9161,
  18.4285,
  -33.9161,
  18.4285,
  '2027-03-09'::date,
  '09:00',
  'R850',
  true,
  400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'AI in Healthcare & Life Sciences Congress' AND event_date = '2027-03-09'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Gauteng Infrastructure & Municipal Bond Summit',
  'Uniting pension funds, sovereign wealth funds, and infrastructure developers to discuss municipal debt instruments and infrastructure delivery.',
  'biz',
  ARRAY['infrastructure', 'bonds', 'municipal finance', 'midrand'],
  'Gallagher Convention Centre',
  '19 Richards Drive, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -26.0028,
  28.1287,
  -26.0028,
  28.1287,
  '2027-03-11'::date,
  '09:00',
  'R950',
  true,
  450,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Gauteng Infrastructure & Municipal Bond Summit' AND event_date = '2027-03-11'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Silicon Cape Investor Demo Day 2027',
  'The premier graduation showcase for top-tier African tech startups. Founders present their operational metrics, growth traction, and open funding rounds.',
  'biz',
  ARRAY['demo day', 'startups', 'venture capital', 'cape town'],
  'Cape Town International Convention Centre (CTICC)',
  '1 Lower Long Street, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9161,
  18.4285,
  -33.9161,
  18.4285,
  '2027-03-16'::date,
  '14:00',
  'R400',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Silicon Cape Investor Demo Day 2027' AND event_date = '2027-03-16'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Africa Retail & Supply Chain Expo',
  'Transforming consumer goods retail: automated distribution centres, cold-chain monitoring, predictive demand forecasting, and omnichannel loyalty apps.',
  'biz',
  ARRAY['retail', 'supply chain', 'logistics', 'sandton', 'expo'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-03-18'::date,
  '09:00',
  'R700',
  true,
  500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Africa Retail & Supply Chain Expo' AND event_date = '2027-03-18'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Durban Ocean Economy & Maritime Trade Summit',
  'Maximizing the economic potential of Southern Africa''s blue economy: offshore aquaculture, naval engineering, port digitalization, and eco-tourism.',
  'biz',
  ARRAY['maritime', 'blue economy', 'trade', 'durban', 'shipping'],
  'Durban ICC',
  '45 Bram Fischer Road, Durban Central',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.8524,
  31.0286,
  -29.8524,
  31.0286,
  '2027-03-23'::date,
  '08:30',
  'R800',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Durban Ocean Economy & Maritime Trade Summit' AND event_date = '2027-03-23'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'SME Exporting & Global E-Commerce Workshop',
  'Practical step-by-step guidance on international shipping protocols, customs clearance, forex hedging, and listing on global digital marketplaces.',
  'biz',
  ARRAY['sme', 'export', 'ecommerce', 'sandton', 'trade'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2027-03-24'::date,
  '09:30',
  'R300',
  true,
  250,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'SME Exporting & Global E-Commerce Workshop' AND event_date = '2027-03-24'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Pretoria Cyber Defense & Government Tech Forum',
  'Dedicated to public sector cybersecurity, critical national infrastructure defense, secure government cloud adoption, and national digital ID platforms.',
  'biz',
  ARRAY['cybersecurity', 'govtech', 'digital id', 'pretoria'],
  'Menlyn Maine Central Square',
  'Amarand Avenue, Waterkloof Glen, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7865,
  28.2812,
  -25.7865,
  28.2812,
  '2027-03-25'::date,
  '09:00',
  'R750',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Pretoria Cyber Defense & Government Tech Forum' AND event_date = '2027-03-25'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Clean Energy & Green Hydrogen Southern Africa',
  'Assessing electrolyzer deployment, export corridor developments, water desalination needs, and off-take agreements for green ammonia and hydrogen.',
  'biz',
  ARRAY['green hydrogen', 'clean energy', 'decarbonization', 'sandton'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-03-30'::date,
  '08:30',
  'R1,200',
  true,
  400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Clean Energy & Green Hydrogen Southern Africa' AND event_date = '2027-03-30'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Women in Private Equity & Angel Investing Masterclass',
  'Hands-on training and peer exchange for women angels and venture scouts: term sheet negotiation, cap table hygiene, and valuation methodologies.',
  'biz',
  ARRAY['women in finance', 'angel investing', 'private equity', 'sandton'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2027-03-31'::date,
  '14:00',
  'R450',
  true,
  200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Women in Private Equity & Angel Investing Masterclass' AND event_date = '2027-03-31'::date AND deleted_at IS NULL
);
-- =========================================================================
-- April 2027: 20 Big Events + 10 Business Events
-- =========================================================================


INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Easter Weekend Amapiano Super Jam',
  'Kick off the Easter long weekend with 8 hours of blistering Amapiano beats at Zone 6 Venue. Elite DJ lineups, state-of-the-art CO2 jets, and VIP lounges.',
  'music',
  ARRAY['easter', 'amapiano', 'soweto', 'zone 6', 'long weekend'],
  'Zone 6 Venue',
  'Warehouse 28, Blackwood Street, Diepkloof Zone 6, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2483,
  27.9351,
  -26.2483,
  27.9351,
  '2027-04-02'::date,
  '18:00',
  'From R180',
  true,
  3500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Easter Weekend Amapiano Super Jam' AND event_date = '2027-04-02'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Shimmy Easter Sunset Ocean Rave',
  'Celebrate Easter by the Atlantic ocean. Top international deep house headliners, sunset beach dance floor, craft cocktails, and VIP waterfront cabanas.',
  'music',
  ARRAY['easter', 'shimmy beach', 'cape town', 'house music', 'rave'],
  'Shimmy Beach Club',
  '12 S Arm Road, V&A Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9038,
  18.4293,
  -33.9038,
  18.4293,
  '2027-04-03'::date,
  '15:00',
  'From R320',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Shimmy Easter Sunset Ocean Rave' AND event_date = '2027-04-03'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Altitude Beach Easter Saturday Pool Gala',
  'Fourways'' biggest long-weekend celebration. Sun-soaked daybeds, signature champagne sprays, live percussionists, and pulsating house tracks.',
  'music',
  ARRAY['easter', 'altitude beach', 'fourways', 'pool party'],
  'Altitude Beach',
  'Fourways Mall, Ruby Close, Fourways',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.0175,
  28.0069,
  -26.0175,
  28.0069,
  '2027-04-03'::date,
  '13:00',
  'From R220',
  true,
  1500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Altitude Beach Easter Saturday Pool Gala' AND event_date = '2027-04-03'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Easter Sunday Family Picnic & Jazz',
  'A blissful Easter Sunday on the green lawns of Spier Wine Farm. Artisan picnic baskets, chocolate egg hunts for kids, and soothing live jazz for adults.',
  'music',
  ARRAY['easter sunday', 'family', 'stellenbosch', 'spier', 'picnic'],
  'Spier Wine Farm',
  'R310 Baden Powell Drive, Stellenbosch',
  'Stellenbosch',
  'ZA',
  'Africa/Johannesburg',
  -33.9723,
  18.7825,
  -33.9723,
  18.7825,
  '2027-04-04'::date,
  '11:00',
  'R350 per adult (includes picnic basket)',
  true,
  800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Easter Sunday Family Picnic & Jazz' AND event_date = '2027-04-04'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Easter Monday Sunset Chill at Grand Africa',
  'Wrap up the long weekend barefoot on the sand with a glass of crisp wine, fresh seafood, and uplifting sunset house music.',
  'music',
  ARRAY['easter monday', 'grand africa', 'cape town', 'beach', 'sunset'],
  'Grand Africa Café & Beach',
  'Haul Road, V&A Waterfront, Granger Bay, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9018,
  18.4191,
  -33.9018,
  18.4191,
  '2027-04-05'::date,
  '15:00',
  'From R220',
  true,
  1200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Easter Monday Sunset Chill at Grand Africa' AND event_date = '2027-04-05'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Konka April Saturday Extravaganza',
  'The undisputed epicentre of Soweto nightlife. High-end luxury bottle service, star-studded VIP guests, and the hottest amapiano releases.',
  'music',
  ARRAY['konka', 'soweto', 'amapiano', 'vip', 'nightlife'],
  'Konka Soweto',
  'Modjadji Street, Pimville Zone 1, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2736,
  27.8972,
  -26.2736,
  27.8972,
  '2027-04-10'::date,
  '20:00',
  'From R350',
  true,
  1200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Konka April Saturday Extravaganza' AND event_date = '2027-04-10'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cabo Beach Sunset Electronic Odyssey',
  'Deep progressive sounds, ocean breezes, and panoramic views of Table Mountain as twilight sweeps across the Cape Town waterfront.',
  'music',
  ARRAY['cabo beach', 'cape town', 'electronic', 'sunset'],
  'Cabo Beach Club',
  '12 S Arm Road, Victoria & Alfred Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9022,
  18.4243,
  -33.9022,
  18.4243,
  '2027-04-10'::date,
  '16:00',
  'From R300',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cabo Beach Sunset Electronic Odyssey' AND event_date = '2027-04-10'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Eyadini Coastal Sunday Shisanyama',
  'Durban''s finest braai meat, ice-cold beverages, red carpet arrivals, and the latest gqom and house hits setting the rhythm.',
  'music',
  ARRAY['eyadini', 'durban', 'shisanyama', 'sunday session'],
  'Eyadini Lounge',
  '3 Peace Haven Place, Umlazi, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.9675,
  30.8872,
  -29.9675,
  30.8872,
  '2027-04-11'::date,
  '12:00',
  'From R150',
  true,
  2500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Eyadini Coastal Sunday Shisanyama' AND event_date = '2027-04-11'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'SunBet Arena Afro-Soul & RnB Night',
  'An intimate yet massive evening featuring South Africa''s most celebrated RnB and Soul vocalists backed by full live bands and string sections.',
  'music',
  ARRAY['rnb', 'afro-soul', 'sunbet arena', 'pretoria', 'live vocals'],
  'SunBet Arena at Time Square',
  '209 Aramist Avenue, Menlyn, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7877,
  28.2798,
  -25.7877,
  28.2798,
  '2027-04-16'::date,
  '19:00',
  '{"tier_1":"280","tier_2":"480","vip":"900"}',
  true,
  6500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'SunBet Arena Afro-Soul & RnB Night' AND event_date = '2027-04-16'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Kyalami Autumn Track Days & DJ Festival',
  'High-performance track action followed by a vibrant open-air festival featuring craft food trucks, driving simulators, and live DJ stages.',
  'music',
  ARRAY['kyalami', 'motorsport', 'midrand', 'festival'],
  'Kyalami Grand Prix Circuit',
  'R55 & Allandale Road, Kyalami, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -25.9981,
  28.0689,
  -25.9981,
  28.0689,
  '2027-04-17'::date,
  '12:00',
  'From R220',
  true,
  4000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Kyalami Autumn Track Days & DJ Festival' AND event_date = '2027-04-17'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Waterfall City Street Food & Craft Gin Fest',
  'Midrand''s favourite foodie gathering. Taste international gourmet creations, sip craft gins, and dance to live acoustic and afro-house sets.',
  'music',
  ARRAY['waterfall city', 'food festival', 'craft gin', 'midrand'],
  'Waterfall City Park',
  'Corner Magwa & Lone Creek Cres, Waterfall City, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -26.0152,
  28.1091,
  -26.0152,
  28.1091,
  '2027-04-17'::date,
  '11:00',
  'From R120',
  true,
  2500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Waterfall City Street Food & Craft Gin Fest' AND event_date = '2027-04-17'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Kirstenbosch Autumn Sunset: Contemporary Folk',
  'Crisp autumn air and warm acoustic guitars. Unwind with friends on the gentle slopes of Kirstenbosch as the evening shadows lengthen.',
  'music',
  ARRAY['kirstenbosch', 'folk', 'cape town', 'live music'],
  'Kirstenbosch National Botanical Garden',
  'Rhodes Drive, Newlands, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9877,
  18.4326,
  -33.9877,
  18.4326,
  '2027-04-18'::date,
  '16:00',
  'From R220',
  true,
  3500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Kirstenbosch Autumn Sunset: Contemporary Folk' AND event_date = '2027-04-18'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Rosebank Street Art & Sneaker Clash',
  'Live sneaker customisation battles, street dance showcases, hip-hop cyphers, and exclusive merch drops in the trendiest precinct in Joburg.',
  'music',
  ARRAY['sneakers', 'streetwear', 'rosebank', 'hiphop', 'art'],
  'The Zone @ Rosebank',
  '177 Oxford Road, Rosebank',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1465,
  28.0416,
  -26.1465,
  28.0416,
  '2027-04-23'::date,
  '13:00',
  'R100',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Rosebank Street Art & Sneaker Clash' AND event_date = '2027-04-23'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'The Station Parkhurst Autumn Rooftop Beats',
  'Joburg skyline views, artisan cocktails, and deep progressive house tracks as autumn settles over Parkhurst.',
  'music',
  ARRAY['rooftop', 'parkhurst', 'johannesburg', 'deep house'],
  'The Station Parkhurst',
  '24 4th Avenue, Parkhurst',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1384,
  28.0163,
  -26.1384,
  28.0163,
  '2027-04-24'::date,
  '16:00',
  'From R120',
  true,
  600,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'The Station Parkhurst Autumn Rooftop Beats' AND event_date = '2027-04-24'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cabo Beach Club Sunset Sessions',
  'Sensational waterfront sunset vibes. International guest DJs, luxury ocean loungers, artisan sushi, and deep melodic house.',
  'music',
  ARRAY['cabo beach', 'cape town', 'house music', 'sunset'],
  'Cabo Beach Club',
  '12 S Arm Road, Victoria & Alfred Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9022,
  18.4243,
  -33.9022,
  18.4243,
  '2027-04-24'::date,
  '15:00',
  'From R300',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cabo Beach Club Sunset Sessions' AND event_date = '2027-04-24'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Freedom Day Eve All-Star Amapiano Festival',
  'Celebrate South Africa''s democracy with an all-night Amapiano festival at FNB Stadium Stadium precinct. Over 25 powerhouse performers.',
  'music',
  ARRAY['freedom day', 'amapiano', 'fnb stadium', 'festival', 'johannesburg'],
  'FNB Stadium',
  'Soccer City Avenue, Nasrec',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.2348,
  27.9824,
  -26.2348,
  27.9824,
  '2027-04-26'::date,
  '16:00',
  '{"general":"200","vip":"550","vvip":"1200"}',
  true,
  12000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Freedom Day Eve All-Star Amapiano Festival' AND event_date = '2027-04-26'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Freedom Day Freedom Songs & Heritage Concert',
  'Commemorating 33 years of South African freedom at Constitution Hill. Iconic legacy artists perform freedom anthems, jazz, and traditional choral music.',
  'music',
  ARRAY['freedom day', 'constitution hill', 'heritage', 'braamfontein', 'concert'],
  'Constitution Hill Human Rights Precinct',
  '11 Kotze Street, Braamfontein',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1896,
  28.0425,
  -26.1896,
  28.0425,
  '2027-04-27'::date,
  '12:00',
  'Free entry (RSVP required)',
  false,
  5000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Freedom Day Freedom Songs & Heritage Concert' AND event_date = '2027-04-27'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Freedom Day Beach Festival Durban',
  'A massive celebration of music, culture, and coastal sunshine at Moses Mabhida Peoples Park. Food trucks, beach sports, and top KZN headliners.',
  'music',
  ARRAY['freedom day', 'durban', 'festival', 'beach', 'music'],
  'Moses Mabhida Stadium Peoples Park',
  '44 Isaiah Ntshangase Road, Stamford Hill, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.8291,
  31.0305,
  -29.8291,
  31.0305,
  '2027-04-27'::date,
  '11:00',
  'From R120',
  true,
  4500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Freedom Day Beach Festival Durban' AND event_date = '2027-04-27'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Gqeberha Boardwalk Freedom Sunset Fest',
  'Celebrate Freedom Day along the Eastern Cape shoreline with live bands, family fun activities, and delicious seafood braais.',
  'music',
  ARRAY['freedom day', 'gqeberha', 'boardwalk', 'eastern cape'],
  'The Boardwalk Gqeberha',
  'Beach Road, Summerstrand, Gqeberha',
  'Gqeberha',
  'ZA',
  'Africa/Johannesburg',
  -33.9858,
  25.6586,
  -33.9858,
  25.6586,
  '2027-04-27'::date,
  '13:00',
  'From R100',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Gqeberha Boardwalk Freedom Sunset Fest' AND event_date = '2027-04-27'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Max''s Lifestyle Freedom Celebration Shisanyama',
  'Freedom Day celebration in true Umlazi style. Impeccable hospitality, VIP treatment, luxury supercars, and top-tier Durban house DJs.',
  'music',
  ARRAY['freedom day', 'maxs lifestyle', 'durban', 'shisanyama'],
  'Max''s Lifestyle Village',
  'V1328 Mbe Road, Umlazi, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.9691,
  30.8856,
  -29.9691,
  30.8856,
  '2027-04-27'::date,
  '12:00',
  'From R150',
  true,
  2500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Max''s Lifestyle Freedom Celebration Shisanyama' AND event_date = '2027-04-27'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'South African Property Buyers & Investment Expo',
  'Showcasing high-yield residential developments, student accommodation projects, buy-to-let financing, and off-plan investment strategies across SA.',
  'biz',
  ARRAY['real estate', 'property', 'investment', 'sandton', 'expo'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-04-06'::date,
  '09:00',
  'Free (RSVP Required)',
  false,
  800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'South African Property Buyers & Investment Expo' AND event_date = '2027-04-06'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Africa Sustainability, ESG & Carbon Markets Forum',
  'Exploring voluntary carbon credits, renewable wheeling tariffs, water conservation tech, and corporate biodiversity reporting for African multinationals.',
  'biz',
  ARRAY['esg', 'sustainability', 'carbon credits', 'sandton'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2027-04-08'::date,
  '08:30',
  'R850',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Africa Sustainability, ESG & Carbon Markets Forum' AND event_date = '2027-04-08'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Western Cape Wine Export & Trade Conference',
  'Accelerating direct-to-consumer digital wine exports, exploring tariff adjustments under bilateral trade pacts, and modernizing bulk wine logistics.',
  'biz',
  ARRAY['wine trade', 'export', 'stellenbosch', 'agriculture', 'logistics'],
  'Spier Wine Farm',
  'R310 Baden Powell Drive, Stellenbosch',
  'Stellenbosch',
  'ZA',
  'Africa/Johannesburg',
  -33.9723,
  18.7825,
  -33.9723,
  18.7825,
  '2027-04-13'::date,
  '09:00',
  'R600',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Western Cape Wine Export & Trade Conference' AND event_date = '2027-04-13'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'SME Cybersecurity & Data Compliance Workshop',
  'Actionable guidance on securing business customer databases, enforcing multi-factor authentication, and avoiding crippling ransomware payments.',
  'biz',
  ARRAY['cybersecurity', 'sme', 'popia', 'midrand', 'workshop'],
  'Gallagher Convention Centre',
  '19 Richards Drive, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -26.0028,
  28.1287,
  -26.0028,
  28.1287,
  '2027-04-15'::date,
  '09:30',
  'R250',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'SME Cybersecurity & Data Compliance Workshop' AND event_date = '2027-04-15'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Africa Venture Capital LP-GP Symposium 2027',
  'Exclusive, closed-door gathering connecting international pension funds and DFIs with general partners investing across African tech and infrastructure.',
  'biz',
  ARRAY['venture capital', 'private equity', 'cape town', 'investors'],
  'Cape Town International Convention Centre (CTICC)',
  '1 Lower Long Street, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9161,
  18.4285,
  -33.9161,
  18.4285,
  '2027-04-20'::date,
  '09:00',
  'Invitation / R1,200',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Africa Venture Capital LP-GP Symposium 2027' AND event_date = '2027-04-20'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Durban Port Logistics & Rail Freight Conclave',
  'Addressing port concession progress, Transnet rail corridor revitalization, smart crane technology, and border turnaround speed for maritime trade.',
  'biz',
  ARRAY['freight', 'rail', 'maritime', 'logistics', 'durban'],
  'Durban ICC',
  '45 Bram Fischer Road, Durban Central',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.8524,
  31.0286,
  -29.8524,
  31.0286,
  '2027-04-21'::date,
  '08:30',
  'R750',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Durban Port Logistics & Rail Freight Conclave' AND event_date = '2027-04-21'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Pretoria GovTech & Smart Public Services Summit',
  'Reviewing citizen digital identity adoption, municipal e-billing portals, automated licensing, and smart streetlight IoT sensor deployments.',
  'biz',
  ARRAY['govtech', 'smart cities', 'iot', 'pretoria'],
  'Menlyn Maine Central Square',
  'Amarand Avenue, Waterkloof Glen, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7865,
  28.2812,
  -25.7865,
  28.2812,
  '2027-04-22'::date,
  '09:00',
  'R700',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Pretoria GovTech & Smart Public Services Summit' AND event_date = '2027-04-22'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Franchising & Business Expansion Expo 2027',
  'Connecting proven fast-food, retail, fitness, and automotive franchise brands with prospective franchisees, bank funders, and leasing agents.',
  'biz',
  ARRAY['franchising', 'business expansion', 'retail', 'sandton'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-04-28'::date,
  '09:00',
  'R350',
  true,
  600,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Franchising & Business Expansion Expo 2027' AND event_date = '2027-04-28'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Digital Health & HealthTech Southern Africa',
  'Demonstrating electronic health record interoperability, remote patient tele-monitoring, and automated medical scheme claims validation.',
  'biz',
  ARRAY['healthtech', 'telemedicine', 'medical schemes', 'sandton'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2027-04-29'::date,
  '09:00',
  'R650',
  true,
  280,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Digital Health & HealthTech Southern Africa' AND event_date = '2027-04-29'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Southern Africa Media, Advertising & AdTech Summit',
  'Exploring retail media networks, connected TV ad spending, cookieless programmatic advertising, and local content monetization in Africa.',
  'biz',
  ARRAY['advertising', 'adtech', 'media', 'rosebank', 'marketing'],
  'The Zone @ Rosebank',
  '177 Oxford Road, Rosebank',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1465,
  28.0416,
  -26.1465,
  28.0416,
  '2027-04-30'::date,
  '09:30',
  'R500',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Southern Africa Media, Advertising & AdTech Summit' AND event_date = '2027-04-30'::date AND deleted_at IS NULL
);
-- =========================================================================
-- May 2027: 20 Big Events + 10 Business Events
-- =========================================================================


INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'May Day Workers Celebration Music Concert',
  'Celebrate Workers'' Day with an energetic open-air festival featuring brass bands, choral groups, afro-pop royalty, and amapiano powerhouses in Soweto.',
  'music',
  ARRAY['workers day', 'may day', 'soweto', 'zone 6', 'concert'],
  'Zone 6 Venue',
  'Warehouse 28, Blackwood Street, Diepkloof Zone 6, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2483,
  27.9351,
  -26.2483,
  27.9351,
  '2027-05-01'::date,
  '12:00',
  'From R100',
  true,
  4000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'May Day Workers Celebration Music Concert' AND event_date = '2027-05-01'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Shimmy Autumn Sunset Session',
  'Soak up the serene autumn ocean breeze at Shimmy Beach Club. Soulful house, delicious tapas, crisp wine, and panoramic views of Table Bay harbour.',
  'music',
  ARRAY['shimmy beach', 'autumn', 'soulful house', 'cape town'],
  'Shimmy Beach Club',
  '12 S Arm Road, V&A Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9038,
  18.4293,
  -33.9038,
  18.4293,
  '2027-05-02'::date,
  '15:00',
  'From R250',
  true,
  1500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Shimmy Autumn Sunset Session' AND event_date = '2027-05-02'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Altitude Beach Autumn Warmup Party',
  'Fourways keeps the vibes heated. Heated outdoor pool, cozy fire pits, signature cocktails, and high-energy amapiano tracks.',
  'music',
  ARRAY['altitude beach', 'fourways', 'fire pits', 'amapiano'],
  'Altitude Beach',
  'Fourways Mall, Ruby Close, Fourways',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.0175,
  28.0069,
  -26.0175,
  28.0069,
  '2027-05-07'::date,
  '16:00',
  'From R200',
  true,
  1200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Altitude Beach Autumn Warmup Party' AND event_date = '2027-05-07'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'SunBet Arena Winter Awakening Rave',
  'Indoor warmth, booming subwoofers, and spectacular laser production. Top international and local techno and house producers rock Pretoria.',
  'music',
  ARRAY['rave', 'techno', 'sunbet arena', 'pretoria', 'electronic'],
  'SunBet Arena at Time Square',
  '209 Aramist Avenue, Menlyn, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7877,
  28.2798,
  -25.7877,
  28.2798,
  '2027-05-08'::date,
  '19:00',
  '{"tier_1":"250","tier_2":"450","vip":"800"}',
  true,
  6500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'SunBet Arena Winter Awakening Rave' AND event_date = '2027-05-08'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Stellenbosch Autumn Red Wine Festival',
  'Sample the finest full-bodied Cabernet Sauvignon, Pinotage, and Shiraz vintages from over 25 premier Stellenbosch wine estates, paired with artisan cheeses and live acoustic jazz.',
  'music',
  ARRAY['wine festival', 'pinotage', 'stellenbosch', 'spier', 'autumn'],
  'Spier Wine Farm',
  'R310 Baden Powell Drive, Stellenbosch',
  'Stellenbosch',
  'ZA',
  'Africa/Johannesburg',
  -33.9723,
  18.7825,
  -33.9723,
  18.7825,
  '2027-05-08'::date,
  '11:00',
  'R350 (includes tasting glass & tokens)',
  true,
  800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Stellenbosch Autumn Red Wine Festival' AND event_date = '2027-05-08'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Mother''s Day Sunset Botanical Concert',
  'Honor Mom with an unforgettable Sunday concert at Kirstenbosch. Classical crossover vocalists, acoustic soul serenades, and lush garden surroundings.',
  'music',
  ARRAY['mothers day', 'kirstenbosch', 'family', 'cape town', 'concert'],
  'Kirstenbosch National Botanical Garden',
  'Rhodes Drive, Newlands, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9877,
  18.4326,
  -33.9877,
  18.4326,
  '2027-05-09'::date,
  '15:30',
  'From R250 (free for children under 6)',
  false,
  3500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Mother''s Day Sunset Botanical Concert' AND event_date = '2027-05-09'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Konka May Luxury Saturday',
  'The heartbeat of VIP South African nightlife. Elite champagne presentations, star-studded crowds, and unforgettable DJ performances.',
  'music',
  ARRAY['konka', 'soweto', 'amapiano', 'vip', 'nightlife'],
  'Konka Soweto',
  'Modjadji Street, Pimville Zone 1, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2736,
  27.8972,
  -26.2736,
  27.8972,
  '2027-05-14'::date,
  '20:00',
  'From R350',
  true,
  1200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Konka May Luxury Saturday' AND event_date = '2027-05-14'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cabo Beach Club Sunset Beats',
  'Cape Town waterfront elegance. Fresh coastal oysters, chilled champagne, and mesmerizing deep house grooves on the waterfront deck.',
  'music',
  ARRAY['cabo beach', 'cape town', 'sunset', 'deep house'],
  'Cabo Beach Club',
  '12 S Arm Road, Victoria & Alfred Waterfront, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9022,
  18.4243,
  -33.9022,
  18.4243,
  '2027-05-15'::date,
  '15:00',
  'From R280',
  true,
  1600,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cabo Beach Club Sunset Beats' AND event_date = '2027-05-15'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Eyadini Shisanyama & Afro-House Jam',
  'Authentic Durban township energy. Sizzling meat, top coastal DJs, and vibrant fashion in Umlazi.',
  'music',
  ARRAY['eyadini', 'durban', 'shisanyama', 'afro-house'],
  'Eyadini Lounge',
  '3 Peace Haven Place, Umlazi, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.9675,
  30.8872,
  -29.9675,
  30.8872,
  '2027-05-15'::date,
  '12:00',
  'From R150',
  true,
  2500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Eyadini Shisanyama & Afro-House Jam' AND event_date = '2027-05-15'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'The Station Parkhurst Cozy Winter Rooftop',
  'Heated rooftop canopies, artisanal mulled wine, gourmet comfort food, and warm deep melodic house tunes in Parkhurst.',
  'music',
  ARRAY['rooftop', 'parkhurst', 'winter warm-up', 'house music'],
  'The Station Parkhurst',
  '24 4th Avenue, Parkhurst',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1384,
  28.0163,
  -26.1384,
  28.0163,
  '2027-05-16'::date,
  '15:00',
  'From R120',
  true,
  500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'The Station Parkhurst Cozy Winter Rooftop' AND event_date = '2027-05-16'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Kyalami Winter Endurance Fest',
  'Motorsport excitement under crisp autumn skies. Circuit racing, paddock tours, karting competitions, and live music stages.',
  'music',
  ARRAY['motorsport', 'kyalami', 'midrand', 'racing', 'festival'],
  'Kyalami Grand Prix Circuit',
  'R55 & Allandale Road, Kyalami, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -25.9981,
  28.0689,
  -25.9981,
  28.0689,
  '2027-05-21'::date,
  '12:00',
  'From R200',
  true,
  4000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Kyalami Winter Endurance Fest' AND event_date = '2027-05-21'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Rosebank Winter Street Food & Craft Market',
  'Warm up with hot ramen, sizzling gourmet burgers, spicy churros, artisanal ciders, and live acoustic music in Rosebank.',
  'music',
  ARRAY['street food', 'craft market', 'rosebank', 'johannesburg'],
  'The Zone @ Rosebank',
  '177 Oxford Road, Rosebank',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1465,
  28.0416,
  -26.1465,
  28.0416,
  '2027-05-22'::date,
  '11:00',
  'R80',
  true,
  1800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Rosebank Winter Street Food & Craft Market' AND event_date = '2027-05-22'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Grand Africa Café Cozy Beach Sunset',
  'Cozy indoor fireplaces, heated beach cabanas, fresh coastal seafood, and chilled ambient beats on the Granger Bay shoreline.',
  'music',
  ARRAY['grand africa', 'cape town', 'beach', 'sunset', 'cozy'],
  'Grand Africa Café & Beach',
  'Haul Road, V&A Waterfront, Granger Bay, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9018,
  18.4191,
  -33.9018,
  18.4191,
  '2027-05-22'::date,
  '16:00',
  'From R220',
  true,
  1000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Grand Africa Café Cozy Beach Sunset' AND event_date = '2027-05-22'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Max''s Lifestyle Sunday Soul & Shisanyama',
  'Durban''s Sunday tradition. Legendary hospitality, prime cuts of meat, luxury cars, and soothing soul music in Umlazi.',
  'music',
  ARRAY['maxs lifestyle', 'durban', 'sunday soul', 'shisanyama'],
  'Max''s Lifestyle Village',
  'V1328 Mbe Road, Umlazi, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.9691,
  30.8856,
  -29.9691,
  30.8856,
  '2027-05-23'::date,
  '12:00',
  'From R150',
  true,
  2500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Max''s Lifestyle Sunday Soul & Shisanyama' AND event_date = '2027-05-23'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Africa Day Eve Unity Fest Soweto',
  'Celebrate African unity and creativity with an explosive continent-wide lineup of Afrobeats, Amapiano, Soukous, and Highlife performers.',
  'music',
  ARRAY['africa day', 'afrobeats', 'amapiano', 'soweto', 'zone 6'],
  'Zone 6 Venue',
  'Warehouse 28, Blackwood Street, Diepkloof Zone 6, Soweto',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2483,
  27.9351,
  -26.2483,
  27.9351,
  '2027-05-24'::date,
  '18:00',
  'From R180',
  true,
  3800,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Africa Day Eve Unity Fest Soweto' AND event_date = '2027-05-24'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Africa Day Grand Cultural Carnival',
  'A massive celebration of African music, traditional dance, fashion showcases, and culinary treasures at Constitution Hill. Pan-African unity at its best.',
  'music',
  ARRAY['africa day', 'constitution hill', 'pan-african', 'heritage', 'carnival'],
  'Constitution Hill Human Rights Precinct',
  '11 Kotze Street, Braamfontein',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1896,
  28.0425,
  -26.1896,
  28.0425,
  '2027-05-25'::date,
  '11:00',
  'Free entry (RSVP Required)',
  false,
  6000,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Africa Day Grand Cultural Carnival' AND event_date = '2027-05-25'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Africa Day Coastal Jam Durban',
  'Celebrating Africa Day on the Durban beachfront with live music from across Southern and East Africa, craft markets, and delicious street cuisine.',
  'music',
  ARRAY['africa day', 'durban', 'moses mabhida', 'live concert'],
  'Moses Mabhida Stadium Peoples Park',
  '44 Isaiah Ntshangase Road, Stamford Hill, Durban',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.8291,
  31.0305,
  -29.8291,
  31.0305,
  '2027-05-25'::date,
  '12:00',
  'From R120',
  true,
  4500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Africa Day Coastal Jam Durban' AND event_date = '2027-05-25'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Gqeberha Boardwalk Africa Day Showcase',
  'Celebrate Africa Day along the Eastern Cape coastline with traditional drum circles, marimba bands, and local craft vendors.',
  'music',
  ARRAY['africa day', 'gqeberha', 'boardwalk', 'eastern cape'],
  'The Boardwalk Gqeberha',
  'Beach Road, Summerstrand, Gqeberha',
  'Gqeberha',
  'ZA',
  'Africa/Johannesburg',
  -33.9858,
  25.6586,
  -33.9858,
  25.6586,
  '2027-05-25'::date,
  '12:00',
  'From R80',
  true,
  1500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Gqeberha Boardwalk Africa Day Showcase' AND event_date = '2027-05-25'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Menlyn Maine Winter Wine & Dine Gala',
  'A lavish culinary showcase pairing Pretoria''s top chefs with award-winning winemakers. 5-course tasting menu, live jazz quintet, and charity auction.',
  'music',
  ARRAY['wine and dine', 'fine dining', 'pretoria', 'menlyn', 'jazz'],
  'Menlyn Maine Central Square',
  'Amarand Avenue, Waterkloof Glen, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7865,
  28.2812,
  -25.7865,
  28.2812,
  '2027-05-28'::date,
  '18:30',
  'R650 per person',
  true,
  600,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Menlyn Maine Winter Wine & Dine Gala' AND event_date = '2027-05-28'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Altitude Beach May Finale Night Swim',
  'Warm pool water, heated poolside lamps, steaming cocktails, and a blistering amapiano DJ set closing out May in Fourways.',
  'music',
  ARRAY['altitude beach', 'night swim', 'fourways', 'amapiano', 'party'],
  'Altitude Beach',
  'Fourways Mall, Ruby Close, Fourways',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.0175,
  28.0069,
  -26.0175,
  28.0069,
  '2027-05-29'::date,
  '17:00',
  'From R200',
  true,
  1400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Altitude Beach May Finale Night Swim' AND event_date = '2027-05-29'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'African Enterprise Technology & Cloud Summit 2027',
  'The premier enterprise tech summit gathering CIOs, CISOs, and cloud architects to discuss sovereign cloud, hybrid deployments, and enterprise AI safety.',
  'biz',
  ARRAY['enterprise tech', 'cloud', 'cio', 'sandton', 'summit'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-05-04'::date,
  '08:30',
  'R1,100',
  true,
  650,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'African Enterprise Technology & Cloud Summit 2027' AND event_date = '2027-05-04'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Africa Trade & AfCFTA Implementation Forum',
  'Unlocking cross-border value chains under the African Continental Free Trade Area: tariff dismantlement, trade dispute resolution, and export financing.',
  'biz',
  ARRAY['afcfta', 'trade', 'export', 'durban', 'logistics'],
  'Durban ICC',
  '45 Bram Fischer Road, Durban Central',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.8524,
  31.0286,
  -29.8524,
  31.0286,
  '2027-05-06'::date,
  '09:00',
  'R850',
  true,
  400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Africa Trade & AfCFTA Implementation Forum' AND event_date = '2027-05-06'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'SME Accounting, Cash Flow & Payroll Masterclass',
  'Practical, high-impact strategies for small business owners: cash flow forecasting, debtor management, cloud payroll automation, and UIF compliance.',
  'biz',
  ARRAY['sme', 'accounting', 'payroll', 'midrand', 'finance'],
  'Gallagher Convention Centre',
  '19 Richards Drive, Midrand',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -26.0028,
  28.1287,
  -26.0028,
  28.1287,
  '2027-05-11'::date,
  '09:00',
  'R250',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'SME Accounting, Cash Flow & Payroll Masterclass' AND event_date = '2027-05-11'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Southern Africa Industrial Robotics & Automation Expo',
  'Showcasing robotic assembly lines, cobots for packaging, automated guided vehicles (AGVs), and predictive machine maintenance.',
  'biz',
  ARRAY['robotics', 'automation', 'manufacturing', 'sandton', 'expo'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-05-13'::date,
  '09:00',
  'R600',
  true,
  500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Southern Africa Industrial Robotics & Automation Expo' AND event_date = '2027-05-13'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Silicon Cape FinTech & WealthTech Showcase',
  'Spotlighting robo-advisory platforms, fractional investment apps, digital pensions, and algorithmic wealth management designed for African consumers.',
  'biz',
  ARRAY['wealthtech', 'fintech', 'startups', 'cape town'],
  'Cape Town International Convention Centre (CTICC)',
  '1 Lower Long Street, Cape Town',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9161,
  18.4285,
  -33.9161,
  18.4285,
  '2027-05-18'::date,
  '10:00',
  'R400',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Silicon Cape FinTech & WealthTech Showcase' AND event_date = '2027-05-18'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Commercial Real Estate Logistics & Warehousing Summit',
  'Addressing the surge in e-commerce fulfillment hubs, high-bay cold storage facilities, and industrial park land acquisitions across Gauteng.',
  'biz',
  ARRAY['real estate', 'logistics', 'warehousing', 'sandton'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2027-05-19'::date,
  '09:00',
  'R800',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Commercial Real Estate Logistics & Warehousing Summit' AND event_date = '2027-05-19'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Pretoria Clean Energy & EV Infrastructure Forum',
  'Focusing on high-speed DC charging corridors, grid connection approvals, and commercial fleet electrification for logistics operators.',
  'biz',
  ARRAY['clean energy', 'ev charging', 'fleet', 'pretoria'],
  'Menlyn Maine Central Square',
  'Amarand Avenue, Waterkloof Glen, Pretoria',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7865,
  28.2812,
  -25.7865,
  28.2812,
  '2027-05-20'::date,
  '09:00',
  'R750',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Pretoria Clean Energy & EV Infrastructure Forum' AND event_date = '2027-05-20'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Africa Day Young Business Leaders & Innovators Dialogue',
  'A prestigious Africa Day forum celebrating under-35 African entrepreneurs, venture builders, and social innovators shaping the continent''s economic future.',
  'biz',
  ARRAY['africa day', 'young leaders', 'entrepreneurship', 'braamfontein'],
  'Constitution Hill Human Rights Precinct',
  '11 Kotze Street, Braamfontein',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1896,
  28.0425,
  -26.1896,
  28.0425,
  '2027-05-25'::date,
  '14:00',
  'Free entry (Application Required)',
  false,
  400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Africa Day Young Business Leaders & Innovators Dialogue' AND event_date = '2027-05-25'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Women in Science, Engineering & Mining Forum',
  'Fostering mentorship, talent pipelines, and leadership acceleration for women across engineering, geological surveys, and mineral extraction.',
  'biz',
  ARRAY['women in stem', 'mining', 'engineering', 'sandton'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-05-26'::date,
  '08:30',
  'R550',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Women in Science, Engineering & Mining Forum' AND event_date = '2027-05-26'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, price, is_paid, capacity,
  is_published, status, is_deleted, cover_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Digital Trust, AI Ethics & POPIA Governance Conclave',
  'Navigating algorithmic bias, synthetic data usage, automated credit decisioning, and regulatory audit readiness under South African data law.',
  'biz',
  ARRAY['ai ethics', 'popia', 'data governance', 'sandton'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2027-05-27'::date,
  '09:00',
  'R700',
  true,
  250,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Digital Trust, AI Ethics & POPIA Governance Conclave' AND event_date = '2027-05-27'::date AND deleted_at IS NULL
);