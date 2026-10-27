-- ============================================================================

-- Supabase Seeder: December 2026 Mega Events

-- Focused on Midrand, Ivory Park, Tembisa, Kempton Park, Centurion & Surroundings

-- Authentic South African venues, precise GPS coordinates, ZAR pricing, real imagery

-- ============================================================================



INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_midrand_altitude_launch', 'Altitude Beach Summer Kickoff 2026: White & Gold Poolside Splash', 'Midrand officially welcomes Ke Dezemba! Gauteng''s premier luxury beach club and poolside playground kicks off the festive season with dual soundstages, synchronized pool cabanas, guest Afro-Tech selectors, live Amapiano percussionists, chilled champagne towers, and golden hour drone light shows over Waterfall City.', 'amapiano', '2026-12-05', '12:00', 'Altitude Beach',
  -26.0155, 28.1065, 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=1200&auto=format&fit=crop","https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop"]', 'R350', '[{"name":"General Poolside Pass","price":350,"currency":"ZAR","capacity":1500},{"name":"VIP Deck & Backstage","price":850,"currency":"ZAR","capacity":250},{"name":"Ultra Cabana Table (Squad of 8)","price":4500,"currency":"ZAR","capacity":20}]', '["midrand","waterfall","altitude beach","summer kickoff","amapiano","afro tech","pool party","ke dezemba","gauteng"]',
  840, 610, 2000, 21, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_midrand_waterfall_afrohouse', 'Waterfall Sunset Afro-House & Deep Tech Gathering', 'Massive open-air lakeside amphitheatre experience under the Highveld twilight. Top international and local house tastemakers, artisan food pods, craft botanical spritz stations, and an immersive 360-degree acoustic stage at the heart of Waterfall City.', 'festival_music', '2026-12-11', '15:30', 'Waterfall City Park & Amphitheatre',
  -26.016, 28.109, 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop"]', 'R250', '[{"name":"Park Lawn Pass","price":250,"currency":"ZAR","capacity":3000},{"name":"Amphitheatre Golden Circle","price":500,"currency":"ZAR","capacity":400}]', '["midrand","waterfall city","mall of africa","afro house","deep tech","music festival","highveld","gauteng"]',
  520, 380, 3500, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_midrand_kyalami_supercars', 'Kyalami Grand Prix Day Fest & Supercar Soundclash', 'High-octane public holiday celebration on the Day of Reconciliation! Exotic supercars, precision drifting exhibitions, pit lane photo-ops, and an explosive main soundstage featuring South Africa''s biggest hip-hop and amapiano headliners overlooking the legendary Kyalami track.', 'sport', '2026-12-16', '10:00', 'Kyalami Grand Prix Circuit & Fan Deck',
  -25.997, 28.071, 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200&auto=format&fit=crop"]', 'R280', '[{"name":"Trackside Fan Pass","price":280,"currency":"ZAR","capacity":4000},{"name":"Clubhouse Pitlane VIP","price":750,"currency":"ZAR","capacity":350}]', '["midrand","kyalami","supercars","soundclash","reconciliation day","drifting","amapiano","hiphop","gauteng"]',
  940, 730, 5000, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_midrand_gallagher_braai_expo', 'Gallagher Festive Expo & Gourmet Braai Fiesta 2026', 'The ultimate year-end culinary and lifestyle gathering. Over 80 artisanal braai pitmasters, smokehouse brisket stalls, craft gin and local craft beer bars, family picnic lawns, live brass jazz bands, and safe monitored parking.', 'foodfestival', '2026-12-18', '12:00', 'Gallagher Convention Centre Arena & Grounds',
  -25.9985, 28.1285, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop"]', 'R180', '[{"name":"Day Pass (Includes Tasting Tokens)","price":180,"currency":"ZAR","capacity":2500},{"name":"Family Package (2 Adults + 2 Kids)","price":420,"currency":"ZAR","capacity":300}]', '["midrand","gallagher","halfway house","braai","food festival","craft beer","family","gauteng"]',
  430, 310, 3000, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_midrand_carlswald_sundowner', 'Carlswald Rooftop Sundowner Spritz & Nu-Soul Lounge', 'Chic, soulful Christmas Eve twilight celebration. Ice-cold Aperol spritzers, fresh oysters and artisan platters, live saxophone sessions, and smooth neo-soul vinyl DJs overlooking the northern Johannesburg skyline.', 'rooftop', '2026-12-24', '15:00', 'Carlswald Lifestyle Centre Piazza & Rooftop',
  -25.9785, 28.118, 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=1200&auto=format&fit=crop"]', 'R150', '[{"name":"Rooftop Access & Welcome Cocktail","price":150,"currency":"ZAR","capacity":400},{"name":"Reserved Lounge Booth","price":600,"currency":"ZAR","capacity":30}]', '["midrand","carlswald","rooftop","sundowner","christmas eve","nu soul","cocktails","gauteng"]',
  360, 240, 500, 21, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_midrand_altitude_christmas_day', 'Altitude Beach Christmas Day Luxe Pool Party', 'Spend Christmas Day poolside in high glamour! All-white beach attire, gourmet seafood and spit braais, international guest DJs, chilled magnum champagne service, and non-stop festive vibes under the warm Midrand sun.', 'amapiano', '2026-12-25', '13:00', 'Altitude Beach',
  -26.0155, 28.1065, 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop"]', 'R400', '[{"name":"Christmas Day Pool Pass","price":400,"currency":"ZAR","capacity":1200},{"name":"VIP Deck & Carvery Buffet","price":950,"currency":"ZAR","capacity":200}]', '["midrand","altitude beach","christmas day","pool party","all white","waterfall","amapiano","luxe","gauteng"]',
  720, 530, 1500, 21, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_midrand_urban_shisanyama_boxing', 'Midrand Urban Shisanyama Boxing Day Chillas Linkup', 'Traditional Day of Goodwill cooler box chillas! Premium butchery braai cuts, sizzling chakalaka, car wash showcases, and deep log-drum amapiano sets rolling from midday until late into the night.', 'streetfood', '2026-12-26', '11:00', 'Midrand Urban Shisanyama & Braai Lounge',
  -25.992, 28.132, 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop"]', 'R120', '[{"name":"General Admission","price":120,"currency":"ZAR","capacity":1500},{"name":"Cooler Box Pass","price":150,"currency":"ZAR","capacity":500}]', '["midrand","halfway house","shisanyama","boxing day","chillas","cooler box","braai","amapiano","gauteng"]',
  480, 350, 2000, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_midrand_altitude_nye_2027', 'Altitude Beach NYE 2027 Countdown Extravaganza', 'Midrand''s flagship New Year''s Eve 2027 mega-celebration. Twin outdoor soundstages, world-class laser mapping, midnight fireworks cascade over the infinity pool, and superstar DJ headliners welcoming the new dawn.', 'amapiano', '2026-12-31', '18:00', 'Altitude Beach',
  -26.0155, 28.1065, 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop"]', 'R500', '[{"name":"NYE Countdown Pass","price":500,"currency":"ZAR","capacity":2000},{"name":"VIP Grandstand & Champagne Toast","price":1200,"currency":"ZAR","capacity":300}]', '["midrand","altitude beach","nye 2027","new years eve","fireworks","waterfall","amapiano","countdown","gauteng"]',
  1150, 980, 2500, 21, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_midrand_waterfall_nye_fireworks', 'Waterfall City NYE Midnight Fireworks & Afro-House Symphony', 'A symphonic fusion of live orchestral strings, African percussion, and soaring electronic house music. 15,000 celebrants, midnight 10-minute pyrotechnic spectacular, food truck lane, and safe park-and-ride around Mall of Africa.', 'festival_music', '2026-12-31', '19:00', 'Waterfall City Park & Amphitheatre',
  -26.016, 28.109, 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop"]', 'R350', '[{"name":"General Lawn Seating","price":350,"currency":"ZAR","capacity":8000},{"name":"Golden Circle Stage Pass","price":700,"currency":"ZAR","capacity":1000}]', '["midrand","waterfall","mall of africa","nye 2027","fireworks","afro house","symphony","orchestra","gauteng"]',
  890, 720, 10000, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_tembisa_hangawt_launch', '1632 Amapiano Fest: The Log-Drum Season Launch', 'The iconic heart of 1632 lifestyle kicks off December! Premium bottle service, rooftop VIP deck, live broadcast rigs, and relentless Bacardi & log-drum sets by the pioneers of the sound in Hospital View.', 'amapiano', '2026-12-05', '14:00', 'The Hang Awt 1632',
  -26.012, 28.215, 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1200&auto=format&fit=crop"]', 'R150', '[{"name":"General Admission","price":150,"currency":"ZAR","capacity":1800},{"name":"VIP Sky Deck Access","price":450,"currency":"ZAR","capacity":200}]', '["tembisa","1632","the hang awt","hospital view","amapiano","bacardi","ke dezemba","log drum","gauteng"]',
  980, 810, 2200, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_tembisa_busy_corner_feast', 'Busy Corner Imbizo Shisanyama Year-End Afro-Soul & Braai Feast', 'Africa''s world-famous shisanyama commercial feast. Succulent charcoal braai platters, traditional pap and chakalaka, live township jazz & neo-soul bands, VIP cigar lounge, and genuine Highveld hospitality in Ebony Park / Tembisa.', 'streetfood', '2026-12-12', '12:00', 'Busy Corner Imbizo Shisanyama',
  -25.9935, 28.188, 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop"]', 'Free Admission', '[{"name":"Standard Table Reservation","price":0,"currency":"ZAR","capacity":2000},{"name":"VIP Executive Patio Booking","price":500,"currency":"ZAR","capacity":150}]', '["tembisa","ebony park","busy corner","imbizo shisanyama","braai","afro soul","food","lifestyle","gauteng"]',
  670, 490, 2500, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_tembisa_mehlareng_all_white', 'Tembisa All-White Reconciliation Day Mega Festival 2026', 'Over 20,000 music lovers dressed in pristine all-white! Tembisa''s biggest annual stadium gathering featuring 20+ live acts, massive sound towers, helicopter entrances, food village, and high-security park-and-ride at Mehlareng Stadium.', 'festival_music', '2026-12-16', '11:00', 'Mehlareng Stadium',
  -26.0185, 28.223, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop"]', 'R220', '[{"name":"Stadium Pitch Pass","price":220,"currency":"ZAR","capacity":15000},{"name":"Golden Circle Stage Front","price":450,"currency":"ZAR","capacity":1500},{"name":"VVIP Hospitality Marquee","price":1200,"currency":"ZAR","capacity":300}]', '["tembisa","mehlareng stadium","all white","reconciliation day","festival","amapiano","stadium","1632","gauteng"]',
  1450, 1210, 20000, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_tembisa_caprivi_sunset', 'Caprivi Lounge 1632 Summer Sunset Sessions', 'Sleek township elegance meets deep house & Afro-soul. Premium cocktail mixology, VIP bottle show parades, chilled outdoor lounge cabanas, and sunset golden hour sets in Esselen Park.', 'rooftop', '2026-12-19', '16:00', 'Caprivi Lounge Tembisa',
  -26.002, 28.224, 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=1200&auto=format&fit=crop"]', 'R150', '[{"name":"General Entry","price":150,"currency":"ZAR","capacity":600},{"name":"VIP Cabana Table","price":800,"currency":"ZAR","capacity":40}]', '["tembisa","caprivi lounge","esselen park","deep house","cocktails","nightlife","1632","gauteng"]',
  390, 270, 700, 21, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_tembisa_makhulong_carnival', 'Makhulong 1632 Festive Football & Music Carnival', 'High-stakes festive township soccer tournament finals followed immediately by a giant outdoor music concert on the stadium pitch. Local street food vendors, cheer squads, and live amapiano anthems at Makhulong Stadium.', 'sport', '2026-12-20', '10:00', 'Makhulong Stadium',
  -26.0105, 28.2285, 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop"]', 'R100', '[{"name":"Match & Concert Grandstand Pass","price":100,"currency":"ZAR","capacity":10000},{"name":"Pitchside Fan Zone","price":250,"currency":"ZAR","capacity":800}]', '["tembisa","makhulong stadium","football","soccer","carnival","amapiano","kwaito","1632","gauteng"]',
  610, 460, 12000, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_tembisa_hangawt_xmas_eve', 'The Hang Awt Christmas Eve Piano All-Nighter', 'The signature Christmas Eve experience in Tembisa. Log-drum bass vibrations until sunrise, superstar surprise guest appearances, bottle showers, and the pure electric spirit of 1632.', 'amapiano', '2026-12-24', '18:00', 'The Hang Awt 1632',
  -26.012, 28.215, 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1200&auto=format&fit=crop"]', 'R200', '[{"name":"Christmas Eve Pass","price":200,"currency":"ZAR","capacity":1500},{"name":"VIP Deck Access","price":500,"currency":"ZAR","capacity":200}]', '["tembisa","the hang awt","christmas eve","amapiano","all nighter","1632","nightlife","gauteng"]',
  880, 740, 2000, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_tembisa_busy_corner_xmas_day', 'Busy Corner Legendary Christmas Day Township Banquet', 'Gather your entire family and squad for the grandest Christmas Day braai feast in South Africa. Authentic charcoal-grilled short ribs, brisket, wors, steamed dumplings, live brass bands, and festive joy in Ebony Park.', 'streetfood', '2026-12-25', '11:00', 'Busy Corner Imbizo Shisanyama',
  -25.9935, 28.188, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop"]', 'Free Admission', '[{"name":"Family Table Booking","price":0,"currency":"ZAR","capacity":2500}]', '["tembisa","busy corner","christmas day","family feast","shisanyama","braai","ebony park","gauteng"]',
  590, 420, 2500, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_tembisa_ethafeni_boxing_spin', 'Tembisa Day of Goodwill Street Spin & Sound Battle', 'Adrenaline-fueled spinning culture! South Africa''s finest BMW 325i "Gusheshe" drivers doing precision burnouts, tire smoke shows, and twin sound truck DJ battles with bass that shakes the ground.', 'sport', '2026-12-26', '12:00', 'Ethafeni Sports Complex & Arena',
  -26.025, 28.219, 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop"]', 'R150', '[{"name":"Arena General Admission","price":150,"currency":"ZAR","capacity":3500},{"name":"Pit Grandstand Pass","price":300,"currency":"ZAR","capacity":400}]', '["tembisa","ethafeni","spinning","gusheshe","boxing day","sound battle","amapiano","1632","gauteng"]',
  730, 550, 4000, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_tembisa_hangawt_nye_2027', 'The Hang Awt 1632 NYE 2027 Grand Piano Finale', 'Say farewell to 2026 at the undisputed palace of Amapiano! Midnight confetti cannon showers, laser mapping, live streaming across Mzansi, and a 14-hour marathon of world-dominating South African rhythms.', 'amapiano', '2026-12-31', '17:00', 'The Hang Awt 1632',
  -26.012, 28.215, 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop"]', 'R300', '[{"name":"NYE Countdown Pass","price":300,"currency":"ZAR","capacity":2000},{"name":"VIP Deck & Midnight Toast","price":750,"currency":"ZAR","capacity":250}]', '["tembisa","the hang awt","nye 2027","new years eve","amapiano","1632","hospital view","countdown","gauteng"]',
  1320, 1140, 2500, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_ivorypark_swazi_inn_welcome', 'Swazi Inn December Welcome Bash & Cooler Box Explosion', 'Welcome to December in Ivory Park! Cooler boxes allowed before 6 PM, monster mobile sound rigs, local braai master showdowns, and high-energy Bacardi and log-drum sets that electrify Ext 7.', 'amapiano', '2026-12-04', '15:00', 'Swazi Inn Lifestyle Park & Car Wash',
  -26.016, 28.186, 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop"]', 'R80', '[{"name":"General Entry","price":80,"currency":"ZAR","capacity":2500},{"name":"Cooler Box Pass (Before 6PM)","price":100,"currency":"ZAR","capacity":800}]', '["ivory park","swazi inn","ext 7","cooler box","amapiano","bacardi","ke dezemba","braai","gauteng"]',
  540, 420, 3000, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_ivorypark_lord_khanyile_clash', 'Ivory Park Ext 2 Community Amapiano Soundclash', 'The raw sound of township talent! 12 rising producers and DJs clash for the crown of Ivory Park''s King of the Log-Drum. Massive open-air stage, street dancers, and youth entrepreneur market at Lord Khanyile Grounds.', 'amapiano', '2026-12-11', '16:00', 'Lord Khanyile Community Centre Grounds',
  -26.0045, 28.1795, 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop"]', 'R60', '[{"name":"Community Pass","price":60,"currency":"ZAR","capacity":2000}]', '["ivory park","ext 2","lord khanyile","soundclash","amapiano","dance","youth","dj battle","gauteng"]',
  410, 290, 2500, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_ivorypark_kopanong_reconciliation', 'Kopanong Reconciliation Day Street Carnival & Braai Fest', 'The premier public holiday carnival in Ivory Park! Street parade with marching brass bands, giant outdoor braai pits, traditional dancers, 5-a-side soccer showdowns, and sunset live concerts at Kopanong Sports Grounds.', 'festival_music', '2026-12-16', '10:00', 'Kopanong Sports Grounds & Civic Arena',
  -26.009, 28.182, 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop"]', 'R100', '[{"name":"Carnival Entry (Kids under 12 Free)","price":100,"currency":"ZAR","capacity":6000}]', '["ivory park","kopanong","reconciliation day","carnival","braai","music festival","ext 2","gauteng"]',
  810, 670, 7500, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_ivorypark_ext9_bacardi_dance', 'Ivory Park Ext 9 Bacardi & Street Dance Championship', 'Electrifying footwork, viral dance challenges, and raw Pretoria Bacardi beats! Dance crews from Ivory Park, Tembisa, and Mamelodi battle it out for R50,000 in cash prizes. Pure high-energy culture.', 'amapiano', '2026-12-19', '13:00', 'Ivory Park Ext 9 Open-Air Arena',
  -26.022, 28.175, 'https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=1200&auto=format&fit=crop"]', 'R70', '[{"name":"Spectator Pass","price":70,"currency":"ZAR","capacity":2500}]', '["ivory park","ext 9","bacardi","dance championship","viral dance","street dance","amapiano","gauteng"]',
  530, 390, 3000, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_ivorypark_swazi_inn_xmas_eve', 'Ivory Park Ext 7 Christmas Eve Community Glow', 'Christmas Eve festive lights and community warmth. Lantern lighting ceremony, live gospel & soulful amapiano choir, food stalls with traditional potjiekos, and joyful community carols.', 'festival_music', '2026-12-24', '17:00', 'Swazi Inn Lifestyle Park',
  -26.016, 28.186, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop"]', 'Free Admission', '[{"name":"Community Entry","price":0,"currency":"ZAR","capacity":2000}]', '["ivory park","swazi inn","ext 7","christmas eve","community glow","gospel","carols","gauteng"]',
  360, 260, 2500, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_ivorypark_kopanong_xmas_day', 'Kopanong Christmas Day Family & Friends Shisanyama Feast', 'Celebrate Christmas Day under the African shade trees! Bring your blankets, camping chairs, and picnic baskets. Large communal charcoal grills provided, live DJ sets, jumping castles for kids in Ext 2.', 'streetfood', '2026-12-25', '12:00', 'Kopanong Sports Grounds & Civic Lawns',
  -26.009, 28.182, 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop"]', 'R50', '[{"name":"Family Pass","price":50,"currency":"ZAR","capacity":3500},{"name":"Cooler Box Pass","price":80,"currency":"ZAR","capacity":1000}]', '["ivory park","kopanong","christmas day","family braai","shisanyama","picnic","ext 2","gauteng"]',
  510, 390, 4000, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_ivorypark_swazi_inn_boxing_trucks', 'Swazi Inn Day of Goodwill Sound Truck Showdown & Car Spin', 'The biggest Boxing Day spectacle in Ivory Park! 4 monster sound trucks with 50,000 watts of crystal-clear bass, tire-shredding BMW 325i spinning displays, and high-energy smoke shows in Ext 7.', 'sport', '2026-12-26', '12:00', 'Swazi Inn Commercial Hub & Parking Arena',
  -26.016, 28.186, 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop"]', 'R120', '[{"name":"General Arena Entry","price":120,"currency":"ZAR","capacity":3000}]', '["ivory park","swazi inn","boxing day","day of goodwill","spinning","sound truck","gusheshe","amapiano","ext 7","gauteng"]',
  670, 510, 3500, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_ivorypark_kopanong_nye_2027', 'Ivory Park NYE Midnight Street Countdown & Fireworks 2027', 'Ivory Park''s official New Year''s Eve countdown celebration! Giant LED countdown clock, midnight 15-minute fireworks display lighting up the entire township sky, and non-stop music until 6 AM.', 'festival_music', '2026-12-31', '18:00', 'Kopanong Sports Grounds',
  -26.009, 28.182, 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop"]', 'R150', '[{"name":"NYE Countdown Pass","price":150,"currency":"ZAR","capacity":7000},{"name":"VIP Grandstand & Toast","price":400,"currency":"ZAR","capacity":300}]', '["ivory park","kopanong","nye 2027","new years eve","fireworks","midnight countdown","ext 2","gauteng"]',
  990, 820, 8000, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_kempton_emperors_lights', 'Emperors Palace Garden of Lights 2026 Grand Opening', 'Over one million sparkling holiday lights transform the D''oreale Grande gardens into an enchanted wonderland! Light tunnels, festive fairy-tale displays, Santa''s workshop, live orchestra, and holiday treats in Kempton Park.', 'festival_music', '2026-12-04', '17:30', 'Emperors Palace Resort & Lawns',
  -26.1465, 28.2235, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop"]', 'R120', '[{"name":"Adult Garden Access","price":120,"currency":"ZAR","capacity":3500},{"name":"Child Access (Under 12)","price":70,"currency":"ZAR","capacity":1500}]', '["kempton park","emperors palace","garden of lights","family","holiday lights","christmas","east rand","gauteng"]',
  870, 650, 5000, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_kempton_dries_niemandt_picnic', 'Dries Niemandt Lakeside Music & Summer Picnic Fest', 'Scenic lakeside lawns, gentle Highveld summer breeze, and top-tier South African live bands. Chilled picnic setups, craft gin bars, gourmet food trucks, and acoustic sunset sessions at Dries Niemandt Park.', 'festival_music', '2026-12-12', '12:00', 'Dries Niemandt Park & Lakeside Arena',
  -26.104, 28.229, 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop"]', 'R180', '[{"name":"Lakeside Lawn Ticket","price":180,"currency":"ZAR","capacity":2500},{"name":"VIP Deck & Complimentary Wine","price":450,"currency":"ZAR","capacity":200}]', '["kempton park","dries niemandt","lakeside","picnic fest","live music","craft gin","family","gauteng"]',
  520, 380, 3000, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_kempton_birchwood_jazz', 'Ekurhuleni Reconciliation Day Soul & Jazz Festival', 'The celebrated "Ekurhuleni Comes Alive" heritage edition. World-class African jazz masters, soul songstresses, 3-course banquet dining, and sophisticated celebration of South African unity at Birchwood Hotel grounds.', 'liveband', '2026-12-16', '11:00', 'Birchwood Hotel & OR Tambo Lawns',
  -26.1715, 28.252, 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop"]', 'R350', '[{"name":"Festival Lawn Ticket","price":350,"currency":"ZAR","capacity":2000},{"name":"VIP Banquet & Meet-the-Artist","price":850,"currency":"ZAR","capacity":250}]', '["kempton park","birchwood","ekurhuleni","jazz","soul","reconciliation day","live band","heritage","gauteng"]',
  640, 480, 2500, 21, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_kempton_red_roman_rave', 'Kempton Park Red Roman Shed Deep House & Techno Rave', 'Industrial acoustics meet warehouse party intensity inside the Red Roman Shed. 30,000 watts of Funktion-One sound, hypnotizing laser grids, and cutting-edge deep tech and melodic techno selectors.', 'rave', '2026-12-18', '20:00', 'Red Roman Shed at Emperors Palace',
  -26.1465, 28.2235, 'https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=1200&auto=format&fit=crop"]', 'R250', '[{"name":"General Warehouse Pass","price":250,"currency":"ZAR","capacity":1500},{"name":"VIP Mezzanine Deck","price":550,"currency":"ZAR","capacity":150}]', '["kempton park","emperors palace","red roman shed","rave","techno","deep house","nightlife","warehouse","gauteng"]',
  580, 420, 1800, 21, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_kempton_bonaero_sundowner', 'Bonaero Park Sunset Plane-Spotter Deep House Session', 'Watch international jumbo jets take off into the golden hour sunset against the OR Tambo horizon while sipping bespoke botanical cocktails. Chilled melodic deep house and festive holiday tapas on the skydeck.', 'rooftop', '2026-12-24', '16:00', 'Bonaero Park Sunset Deck & Sky Lounge',
  -26.129, 28.272, 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=1200&auto=format&fit=crop"]', 'R160', '[{"name":"Skydeck Access & Cocktail","price":160,"currency":"ZAR","capacity":350}]', '["kempton park","bonaero park","plane spotter","or tambo","sundowner","deep house","christmas eve","cocktails","gauteng"]',
  320, 210, 400, 21, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_kempton_emperors_royal_buffet', 'Emperors Palace Christmas Day Royal Buffet & Carols', 'A lavish Christmas Day culinary showcase with roasted carvery, fresh oysters, festive puddings, and live gospel carolers. Safe indoor resort atmosphere with casino, cinema, and kids entertainment.', 'foodfestival', '2026-12-25', '12:00', 'Emperors Palace Convention Centre',
  -26.1465, 28.2235, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop"]', 'R550', '[{"name":"Adult Buffet Ticket","price":550,"currency":"ZAR","capacity":1200},{"name":"Kids Buffet (Under 12)","price":250,"currency":"ZAR","capacity":400}]', '["kempton park","emperors palace","christmas day","royal buffet","carols","family feast","dining","gauteng"]',
  530, 410, 1600, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_kempton_dries_niemandt_boxing', 'Dries Niemandt Boxing Day Cooler Box & Food Truck Fiesta', 'Pack your cooler box and gazebos for the biggest lakeside Boxing Day party on the East Rand! Live amapiano and kwaito stages, smoke braai pits, and vibrant community vibes.', 'streetfood', '2026-12-26', '11:00', 'Dries Niemandt Park',
  -26.104, 28.229, 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop"]', 'R120', '[{"name":"Park Admission","price":120,"currency":"ZAR","capacity":3500},{"name":"Cooler Box Permit","price":150,"currency":"ZAR","capacity":1000}]', '["kempton park","dries niemandt","boxing day","cooler box","food truck","braai","amapiano","lakeside","gauteng"]',
  690, 510, 4500, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_kempton_emperors_red_roman_nye', 'Emperors Palace Red Roman Shed NYE 2027 Golden Masquerade Ball', 'Glamorous black-tie and mask New Year''s Eve celebration. Champagne toast at midnight, casino floor action, dual stages of high-energy commercial anthems and private school amapiano.', 'rave', '2026-12-31', '19:00', 'Red Roman Shed at Emperors Palace',
  -26.1465, 28.2235, 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop"]', 'R450', '[{"name":"Masquerade Ball Pass","price":450,"currency":"ZAR","capacity":2000},{"name":"VIP Casino & Champagne Deck","price":950,"currency":"ZAR","capacity":250}]', '["kempton park","emperors palace","red roman shed","nye 2027","masquerade ball","new years eve","amapiano","gauteng"]',
  1040, 890, 2500, 21, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_kempton_dries_niemandt_nye', 'Kempton Park Lakeside NYE Family Fireworks Spectacular 2027', 'Ring in 2027 by the tranquil lake waters! Giant family concert, live stage with Ekurhuleni''s finest musical acts, illuminated food truck avenue, and midnight fireworks reflecting off the lake.', 'festival_music', '2026-12-31', '17:00', 'Dries Niemandt Park & Lake Arena',
  -26.104, 28.229, 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop"]', 'R180', '[{"name":"Family Lawn Pass (Adult)","price":180,"currency":"ZAR","capacity":5000},{"name":"Kids Pass (Under 12)","price":90,"currency":"ZAR","capacity":2000}]', '["kempton park","dries niemandt","lakeside","nye 2027","fireworks","family","new years eve","gauteng"]',
  820, 660, 7000, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_centurion_shisanyama_kickoff', 'Centurion Summer Kickoff: Shisanyama & Bacardi Bass Fest', 'Tshwane basslines meet succulent braai meat! High-energy Bacardi soundclash, revving sports cars, VIP ice-bucket service, and the undeniable groove of the capital''s southern playground in Centurion.', 'amapiano', '2026-12-05', '13:00', 'Centurion Shisanyama & Car Wash',
  -25.849, 28.196, 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1200&auto=format&fit=crop"]', 'R150', '[{"name":"General Entry","price":150,"currency":"ZAR","capacity":2000},{"name":"VIP Deck & Ice Bucket Service","price":500,"currency":"ZAR","capacity":150}]', '["centurion","centurion shisanyama","bacardi","amapiano","summer kickoff","car wash","braai","gauteng"]',
  640, 490, 2500, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_centurion_irene_farm_market', 'Irene Farm Artisan Gin & Craft Beer Summer Market', 'Historic countryside dairy estate surrounded by centuries-old oak trees. 50+ craft gin distilleries, microbreweries, artisanal cheeses, farm-to-table gourmet burgers, and acoustic folk music in Irene.', 'foodfestival', '2026-12-12', '10:00', 'Irene Farm & Dairy Lawns',
  -25.878, 28.214, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop"]', 'R120', '[{"name":"Market Pass + Tasting Glass","price":120,"currency":"ZAR","capacity":2500}]', '["centurion","irene","irene farm","craft beer","artisan gin","food market","family","gauteng"]',
  480, 350, 3000, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_centurion_supersport_soundclash', 'SuperSport Park Reconciliation Day Summer Soundclash 2026', 'Cricket stadium grass-bank festival with 18,000 celebrants! Major South African headliners spanning Amapiano, Afro-Pop, and Rock. Giant LED towers, beer garden, and festive family zones at SuperSport Park.', 'festival_music', '2026-12-16', '11:00', 'SuperSport Park Cricket Stadium Lawns & Fan Zone',
  -25.86, 28.197, 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop"]', 'R250', '[{"name":"Grass Embankment Pass","price":200,"currency":"ZAR","capacity":12000},{"name":"Grandstand Reserved","price":350,"currency":"ZAR","capacity":4000},{"name":"Presidential Suite Hospitality","price":1100,"currency":"ZAR","capacity":250}]', '["centurion","supersport park","soundclash","reconciliation day","stadium festival","amapiano","rock","gauteng"]',
  1220, 1040, 18000, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_centurion_lake_night_market', 'Centurion Lake Promenade Night Market & Food Truck Village', 'Stroll along the illuminated Centurion Lake boardwalk! 40 gourmet food trucks, handmade fashion & jewellery pop-ups, craft cocktail bars, and open-air acoustic & saxophone performances.', 'streetfood', '2026-12-19', '16:00', 'Centurion Lake Promenade & Open-Air Stage',
  -25.853, 28.188, 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=1200&auto=format&fit=crop"]', 'Free Admission', '[{"name":"Boardwalk Free Entry","price":0,"currency":"ZAR","capacity":3000}]', '["centurion","centurion lake","night market","food trucks","waterfront","lifestyle","promenade","gauteng"]',
  410, 310, 3500, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_centurion_the_rock_xmas_eve', 'The Rock Centurion Christmas Eve Black & Gold Groove', 'Upscale Christmas Eve elegance in Doringkloof. Premium bottle service, synchronized sparklers, guest afro-deep DJs, and high-fashion urban style celebrating the arrival of Christmas.', 'amapiano', '2026-12-24', '17:00', 'The Rock Lifestyle Lounge Centurion',
  -25.845, 28.204, 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1200&auto=format&fit=crop"]', 'R200', '[{"name":"Black & Gold Entry","price":200,"currency":"ZAR","capacity":700},{"name":"VIP Booth & Sparkler Service","price":850,"currency":"ZAR","capacity":30}]', '["centurion","the rock","doringkloof","christmas eve","black and gold","amapiano","nightlife","gauteng"]',
  490, 360, 800, 21, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_centurion_irene_xmas_day', 'Irene Farm Christmas Day Countryside Braai Picnic', 'Escape the city rush on Christmas Day! Relaxed countryside picnic hampers on lush green pastures, tractor rides for kids, homemade dairy ice-cream, and soft acoustic holiday carols in Irene.', 'foodfestival', '2026-12-25', '11:30', 'Irene Farm & Dairy Lawns',
  -25.878, 28.214, 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop"]', 'R380', '[{"name":"Adult Picnic Hamper & Lawn Spot","price":380,"currency":"ZAR","capacity":800},{"name":"Child Hamper","price":180,"currency":"ZAR","capacity":400}]', '["centurion","irene farm","christmas day","picnic","countryside","family braai","irene","gauteng"]',
  420, 320, 1200, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_centurion_shisanyama_boxing_day', 'Centurion Shisanyama Boxing Day Spin & Sound Fest', 'The traditional Boxing Day get-together in Centurion. Car enthusiasts, deep-bass sound rigs, sizzling T-bones and boerewors on open flames, and back-to-back Pretoria groove masters.', 'sport', '2026-12-26', '12:00', 'Centurion Shisanyama',
  -25.849, 28.196, 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop"]', 'R150', '[{"name":"Admission & Car Show","price":150,"currency":"ZAR","capacity":2500}]', '["centurion","centurion shisanyama","boxing day","day of goodwill","spinning","braai","bacardi","car show","gauteng"]',
  670, 510, 3000, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_centurion_supersport_nye_2027', 'SuperSport Park NYE 2027 Fireworks Extravaganza & Stadium Stage', 'The premier stadium celebration in the capital region. 25,000 people counting down together, breathtaking 15-minute aerial pyrotechnics, three sound stages, and top-billed Mzansi artists.', 'festival_music', '2026-12-31', '17:00', 'SuperSport Park Cricket Stadium',
  -25.86, 28.197, 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop"]', 'R350', '[{"name":"Grass Embankment NYE Pass","price":300,"currency":"ZAR","capacity":15000},{"name":"Grandstand Reserved","price":500,"currency":"ZAR","capacity":5000},{"name":"VIP Pavilion Hospitality","price":1250,"currency":"ZAR","capacity":400}]', '["centurion","supersport park","nye 2027","new years eve","fireworks","stadium concert","amapiano","countdown","gauteng"]',
  1480, 1260, 25000, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_centurion_lake_nye_countdown', 'Centurion Lake Waterfront NYE Countdown & Laser Show 2027', 'Waterfront musical countdown featuring water-fountain laser projections, live DJ sound towers, craft food market, and family-friendly midnight celebrations along the scenic water edge.', 'festival_music', '2026-12-31', '18:00', 'Centurion Lake Promenade',
  -25.853, 28.188, 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop"]', 'R150', '[{"name":"Boardwalk Countdown Pass","price":150,"currency":"ZAR","capacity":4000}]', '["centurion","centurion lake","nye 2027","laser show","waterfront","countdown","family","gauteng"]',
  730, 580, 5000, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_modderfontein_organic_house', 'Modderfontein Lakeside Acoustic & Organic House Festival', 'Nestled in the lush natural beauty of Modderfontein Reserve. Organic house rhythms, live guitars and flutes, eco-friendly food trucks, craft gin bars, and bird-watching sunset chill.', 'liveband', '2026-12-06', '13:00', 'Modderfontein Reserve & Lakeside Lawns',
  -26.082, 28.163, 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop"]', 'R200', '[{"name":"Reserve Day Pass","price":200,"currency":"ZAR","capacity":1500}]', '["modderfontein","surroundings","reserve","organic house","lakeside","acoustic","nature","gauteng"]',
  420, 310, 2000, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_clayville_sound_garden_cookout', 'Clayville Sound Garden Summer Kickoff & Braai Cookout', 'The vibrant border hub between Tembisa and Midrand. Smoked ribs, braai chicken, cooler box setups on green lawns, and infectious amapiano beats from afternoon into the warm summer night.', 'streetfood', '2026-12-13', '12:00', 'Clayville East Sound Garden & Shisanyama',
  -25.964, 28.232, 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop"]', 'R100', '[{"name":"General Admission","price":100,"currency":"ZAR","capacity":1500},{"name":"Cooler Box Ticket","price":100,"currency":"ZAR","capacity":500}]', '["clayville","olifantsfontein","surroundings","sound garden","shisanyama","braai","amapiano","gauteng"]',
  380, 270, 2000, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_rabie_ridge_soccer_derby', 'Rabie Ridge Community Goodwill Soccer Derby & Music Clash', 'Uniting Rabie Ridge, Ivory Park, and Kanana! Annual township football championship final followed by a huge community sound stage with local rap, kwaito, and amapiano talent.', 'sport', '2026-12-16', '10:00', 'Rabie Ridge Community Stadium & Lawns',
  -26.0125, 28.162, 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop"]', 'R60', '[{"name":"Derby & Music Pass","price":60,"currency":"ZAR","capacity":3000}]', '["rabie ridge","surroundings","soccer derby","reconciliation day","community","music clash","gauteng"]',
  390, 280, 3500, 16, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_modderfontein_nu_disco_picnic', 'Modderfontein Sunset Secret Picnic & Nu-Disco Session', 'Sunlit meadows and sparkling waters. Bring your picnic hampers, pillows, and squad for an afternoon of uplifting French house, nu-disco, and melodic afro-beats with craft cocktails in the amphitheatre.', 'rooftop', '2026-12-20', '15:00', 'Modderfontein Reserve Amphitheatre',
  -26.082, 28.163, 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=1200&auto=format&fit=crop"]', 'R180', '[{"name":"Picnic Spot Pass","price":180,"currency":"ZAR","capacity":1000}]', '["modderfontein","surroundings","picnic","nu disco","melodic beats","sunset","reserve","gauteng"]',
  340, 230, 1200, 21, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_olifantsfontein_kwaito_reunion', 'Olifantsfontein Heritage Kwaito & Old School House Reunion', 'Nostalgic Highveld summer reunion! Celebrating the roots of modern amapiano with legendary 90s and 2000s Kwaito classics, deep vinyl house, slow charcoal braais, and vintage car displays.', 'amapiano', '2026-12-26', '13:00', 'Olifantsfontein Heritage Park & Craft Braai',
  -25.952, 28.221, 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop"]', 'R120', '[{"name":"Heritage Reunion Pass","price":120,"currency":"ZAR","capacity":1500}]', '["olifantsfontein","clayville","surroundings","kwaito","old school house","boxing day","heritage","gauteng"]',
  460, 340, 2000, 21, true, NOW()
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
  is_verified = EXCLUDED.is_verified;

INSERT INTO public.events (
  id, title, description, category, event_date, event_time, venue_name,
  lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
  vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
) VALUES (
  'gp_dec26_modderfontein_lakeside_nye', 'Modderfontein Lakeside NYE 2027 Starlight Celebration', 'An intimate, open-air nature wonderland New Year''s Eve countdown. Fairy-light canopy over the lakeside trees, live indie-electronic performances, artisan food market, and midnight star-burst fireworks.', 'festival_music', '2026-12-31', '18:00', 'Modderfontein Reserve Amphitheatre & Lakeside',
  -26.082, 28.163, 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop', '["https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop"]', 'R300', '[{"name":"Starlight NYE Ticket","price":300,"currency":"ZAR","capacity":2000},{"name":"VIP Lake Deck & Sparkling Wine","price":650,"currency":"ZAR","capacity":200}]', '["modderfontein","surroundings","nye 2027","starlight","fireworks","lakeside","new years eve","gauteng"]',
  670, 520, 2500, 18, true, NOW()
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
  is_verified = EXCLUDED.is_verified;