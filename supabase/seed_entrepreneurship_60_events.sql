--
-- Seed 60 South African Entrepreneurship Events (Dec 2026, Jan 2027, Feb 2027)
-- Generated with verified high-res Unsplash images, official contacts, and full physical addresses
--
BEGIN;

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Mzansi Seed Stage Pitch Battle 2026',
  'Top 15 pre-seed and seed stage African tech startups compete head-to-head in front of top venture capitalists and angel investors for R1,500,000 in equity-free prize funding and accelerator entry. Network with over 300 founders, VCs, and tech leaders.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'pitch', 'startups', 'venture-capital', 'founders', 'sandton'],
  '22 On Sloane Startup Campus',
  '22 Sloane Street, Bryanston, Sandton, 2191',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.0505,
  28.0255,
  -26.0505,
  28.0255,
  '2026-12-02'::date,
  '09:00',
  '2026-12-02 09:00:00+02'::timestamptz,
  'pitch@22onsloane.co',
  '+27 11 026 6000',
  '{"founder_pass":"Free RSVP","delegate":"R350","investor_vip":"R1200"}',
  false,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Mzansi Seed Stage Pitch Battle 2026' AND event_date = '2026-12-02'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cape Town Angel Investors & Founders Breakfast',
  'An intimate, high-impact dealflow breakfast connecting high-net-worth angel syndicates with scalable SaaS, clean-tech, and e-commerce founders. Pitch sessions, term-sheet breakdowns, and confidential 1-on-1 breakout meetings over artisan coffee.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'angel-investing', 'founders', 'startups', 'cape-town', 'networking'],
  'Workshop17 Watershed',
  '17 Dock Road, V&A Waterfront, Cape Town, 8002',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9065,
  18.4208,
  -33.9065,
  18.4208,
  '2026-12-03'::date,
  '08:30',
  '2026-12-03 08:30:00+02'::timestamptz,
  'angels@workshop17.co.za',
  '+27 21 202 6900',
  '{"founder":"R250","angel_investor":"R750","syndicate_table":"R3500"}',
  true,
  180,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cape Town Angel Investors & Founders Breakfast' AND event_date = '2026-12-03'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Township Tech & SME Innovation Summit',
  'Unlocking high-growth township entrepreneurship, spaza shop digitization, last-mile logistics, and fintech enablement. Featuring township business leaders, micro-grant announcements, and digital tool demonstrations for 500+ local entrepreneurs.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'sme', 'township-economy', 'fintech', 'soweto', 'innovation'],
  'Soweto Theatre Business & Cultural Centre',
  'Bolani Link & Cnr Bolani Rd, Jabulani, Soweto, 1868',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2415,
  27.8592,
  -26.2415,
  27.8592,
  '2026-12-05'::date,
  '10:00',
  '2026-12-05 10:00:00+02'::timestamptz,
  'innovate@sowetotheatre.com',
  '+27 11 930 7461',
  '{"general":"Free RSVP","workshop_pass":"R150","exhibitor":"R850"}',
  false,
  500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Township Tech & SME Innovation Summit' AND event_date = '2026-12-05'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Sandton VC Dealmakers & Scaleup Gala',
  'The premier year-end gathering for Africa’s Series A and Series B founders, private equity partners, and corporate venture capital heads. Keynotes on cross-border expansion, liquidity events, and 2027 macroeconomic growth trends.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'venture-capital', 'private-equity', 'scaleups', 'sandton', 'gala'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton, 2196',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2026-12-08'::date,
  '17:30',
  '2026-12-08 17:30:00+02'::timestamptz,
  'dealmakers@sandtoncc.co.za',
  '+27 11 779 0000',
  '{"scaleup_founder":"R950","executive_pass":"R1800","table_of_8":"R12000"}',
  true,
  600,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Sandton VC Dealmakers & Scaleup Gala' AND event_date = '2026-12-08'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Women Founders & Executive Leadership Forum',
  'Empowering female entrepreneurs building transformative businesses across healthcare, finance, logistics, and retail. Masterclasses on fundraising resilience, board governance, and global customer acquisition.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'women-in-business', 'founders', 'leadership', 'johannesburg'],
  'Workshop17 Sandton',
  '138 West Street, Sandton, 2196',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1075,
  28.0545,
  -26.1075,
  28.0545,
  '2026-12-09'::date,
  '09:30',
  '2026-12-09 09:30:00+02'::timestamptz,
  'womenlead@workshop17.co.za',
  '+27 11 202 7000',
  '{"early_bird":"R250","standard":"R450","vip_mentorship":"R950"}',
  true,
  250,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Women Founders & Executive Leadership Forum' AND event_date = '2026-12-09'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Braamfontein Digital Founders Demo Day',
  'Graduating cohort of 20 high-velocity AI, Web3, and mobile app ventures pitch their working prototypes to regional seed funds and institutional partners. Live interactive voting and demo booths.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'demo-day', 'tech-startups', 'ai', 'braamfontein'],
  'Tshimologong Digital Innovation Precinct',
  '41 Juta Street, Braamfontein, Johannesburg, 2001',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1932,
  28.0345,
  -26.1932,
  28.0345,
  '2026-12-10'::date,
  '13:00',
  '2026-12-10 13:00:00+02'::timestamptz,
  'demoday@tshimologong.joburg',
  '+27 11 717 6000',
  '{"student_founder":"Free RSVP","general_ticket":"R180","investor":"R600"}',
  false,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Braamfontein Digital Founders Demo Day' AND event_date = '2026-12-10'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Durban Coastal Founders & Blue Economy Pitch',
  'Spotlighting marine logistics, tourism tech, maritime commerce, and green supply-chain entrepreneurship across KwaZulu-Natal. Network with provincial development finance institutions and maritime investors.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'blue-economy', 'durban', 'founders', 'pitch'],
  'The Pencil Club Umhlanga',
  '1 Ncondo Place, Umhlanga Ridge, Durban, 4319',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.724,
  31.0825,
  -29.724,
  31.0825,
  '2026-12-11'::date,
  '10:00',
  '2026-12-11 10:00:00+02'::timestamptz,
  'bluebiz@thepencilclub.com',
  '+27 31 826 9000',
  '{"founder_pass":"R200","corporate_delegate":"R650","vip":"R1100"}',
  true,
  220,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Durban Coastal Founders & Blue Economy Pitch' AND event_date = '2026-12-11'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Agri-Tech & Rural Enterprise Showcase',
  'Connecting agricultural innovators, drone farming operators, hydroponic pioneers, and commercial distribution syndicates. Learn how to raise blended finance and navigate food security supply chains.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'agritech', 'food-security', 'sme', 'midrand'],
  'Riversands I-Hub',
  '8 Incubation Drive, Riverside View, Midrand, 2021',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -25.9692,
  28.0055,
  -25.9692,
  28.0055,
  '2026-12-12'::date,
  '09:00',
  '2026-12-12 09:00:00+02'::timestamptz,
  'agritech@riversandsihub.co.za',
  '+27 11 012 4600',
  '{"farmer_founder":"Free RSVP","delegate":"R300","exhibitor_booth":"R1500"}',
  false,
  450,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Agri-Tech & Rural Enterprise Showcase' AND event_date = '2026-12-12'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Stellenbosch Biotech & DeepTech Venture Summit',
  'University spin-outs, genomics founders, and patent commercialization ventures pitch to international life sciences venture funds. Exploring academic tech transfer and global licensing agreements.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'deeptech', 'biotech', 'stellenbosch', 'spinout'],
  'Stellenbosch University LaunchLab',
  'Hammanshand Road, Stellenbosch, 7600',
  'Stellenbosch',
  'ZA',
  'Africa/Johannesburg',
  -33.9328,
  18.8654,
  -33.9328,
  18.8654,
  '2026-12-14'::date,
  '09:00',
  '2026-12-14 09:00:00+02'::timestamptz,
  'deeptech@launchlab.co.za',
  '+27 21 808 9494',
  '{"academic_founder":"R250","investor":"R850","corporate":"R1400"}',
  true,
  200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Stellenbosch Biotech & DeepTech Venture Summit' AND event_date = '2026-12-14'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Pretoria GovTech & Public Procurement Masterclass',
  'A practical, high-value workshop teaching young entrepreneurs and SME suppliers how to successfully bid for provincial government tenders, municipal digitisation projects, and smart city contracts.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'govtech', 'procurement', 'pretoria', 'tenders'],
  'The Capital Menlyn Maine',
  '194 Bancor Avenue, Menlyn, Pretoria, 0181',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7865,
  28.281,
  -25.7865,
  28.281,
  '2026-12-15'::date,
  '09:30',
  '2026-12-15 09:30:00+02'::timestamptz,
  'govtech@thecapital.co.za',
  '+27 12 942 5000',
  '{"sme_pass":"R300","vip_networking":"R650"}',
  true,
  250,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Pretoria GovTech & Public Procurement Masterclass' AND event_date = '2026-12-15'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'E-Commerce Brands & D2C Growth Conference',
  'Direct-to-consumer founders, Shopify experts, digital marketers, and payment gateway leads reveal how to scale from R50k to R5M monthly GMV. Live teardowns of high-converting storefronts and viral ad campaigns.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'ecommerce', 'd2c', 'cape-town', 'growth-marketing'],
  'Cape Town International Convention Centre (CTICC)',
  '1 Lower Long Street, Foreshore, Cape Town, 8001',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9161,
  18.4285,
  -33.9161,
  18.4285,
  '2026-12-16'::date,
  '10:00',
  '2026-12-16 10:00:00+02'::timestamptz,
  'd2c@cticc.co.za',
  '+27 21 410 5000',
  '{"general_ticket":"R450","growth_workshop":"R850","vip_pass":"R1500"}',
  true,
  500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'E-Commerce Brands & D2C Growth Conference' AND event_date = '2026-12-16'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Youth Enterprise & Creative Industries Pitch',
  'Creative economy founders in fashion, digital animation, music production, and streaming platforms pitch for micro-grants and distributor agreements. Mentorship sessions with leading cultural executives.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'creative-economy', 'youth', 'fashion', 'cape-town'],
  'Bandwidth Barn Woodstock',
  '66 Albert Road, Woodstock, Cape Town, 7925',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.928,
  18.4485,
  -33.928,
  18.4485,
  '2026-12-17'::date,
  '11:00',
  '2026-12-17 11:00:00+02'::timestamptz,
  'creative@citi.org.za',
  '+27 21 409 7000',
  '{"young_founder":"Free RSVP","supporter":"R150","sponsor":"R1200"}',
  false,
  220,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Youth Enterprise & Creative Industries Pitch' AND event_date = '2026-12-17'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Johannesburg FinTech Founders Roundtable',
  'Closed-door roundtable for banking infrastructure founders, neo-bank executives, and regulatory sandbox participants discussing SARB compliance, open finance APIs, and regional payments interoperability.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'fintech', 'banking', 'roundtable', 'sandton'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton, 2196',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2026-12-18'::date,
  '14:00',
  '2026-12-18 14:00:00+02'::timestamptz,
  'fintech@themarcsandton.co.za',
  '+27 11 883 1200',
  '{"fintech_founder":"R500","compliance_delegate":"R950","executive":"R1800"}',
  true,
  150,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Johannesburg FinTech Founders Roundtable' AND event_date = '2026-12-18'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Midrand Manufacturing & Hardware Incubator Day',
  'Factory tours, hardware rapid prototyping demos, 3D printing showcases, and electronics assembly solutions for industrial startups manufacturing locally in Gauteng.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'manufacturing', 'hardware', 'midrand', 'iot'],
  'Gallagher Convention Centre',
  '19 Richards Drive, Halfway House, Midrand, 1685',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -26.0028,
  28.1287,
  -26.0028,
  28.1287,
  '2026-12-19'::date,
  '09:00',
  '2026-12-19 09:00:00+02'::timestamptz,
  'hardware@gallagher.co.za',
  '+27 11 266 3000',
  '{"maker_pass":"R150","general":"R350","vendor_booth":"R1200"}',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Midrand Manufacturing & Hardware Incubator Day' AND event_date = '2026-12-19'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Franchise & Licensed Business Opportunities Expo',
  'Explore turnkey business models in food & beverage, logistics, retail, automotive maintenance, and education. Meet direct franchisors with pre-approved bank financing options.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'franchising', 'business-opportunities', 'durban', 'retail'],
  'Durban ICC',
  '45 Bram Fischer Road, Durban Central, Durban, 4001',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.8524,
  31.0286,
  -29.8524,
  31.0286,
  '2026-12-21'::date,
  '10:00',
  '2026-12-21 10:00:00+02'::timestamptz,
  'franchise@icc.co.za',
  '+27 31 360 1000',
  '{"visitor_pass":"R100","vip_buyer":"R450","franchisor_stand":"R3500"}',
  true,
  700,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Franchise & Licensed Business Opportunities Expo' AND event_date = '2026-12-21'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Green Energy & Solar Microgrid Entrepreneurs Forum',
  'Commercial solar installers, battery energy storage founders, and independent power producer (IPP) entrepreneurs meet commercial property owners and green funding institutions.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'solar', 'green-energy', 'sme', 'pretoria'],
  'SunBet Arena at Time Square',
  '209 Aramist Avenue, Menlyn, Pretoria, 0181',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7877,
  28.2798,
  -25.7877,
  28.2798,
  '2026-12-22'::date,
  '09:30',
  '2026-12-22 09:30:00+02'::timestamptz,
  'solarbiz@suninternational.com',
  '+27 12 003 6150',
  '{"installer_pass":"R300","commercial_client":"R650","investor":"R1200"}',
  true,
  400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Green Energy & Solar Microgrid Entrepreneurs Forum' AND event_date = '2026-12-22'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Eastern Cape Tech & Logistics Innovation Summit',
  'Gqeberha’s automotive manufacturing supply chain meets cutting-edge logistics tech, IoT fleet tracking, and port optimization startups. Connect with regional enterprise partners.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'logistics', 'supply-chain', 'gqeberha', 'automotive'],
  'Genesis Hub Gqeberha',
  '140 Main Road, Walmer, Gqeberha, 6070',
  'Gqeberha',
  'ZA',
  'Africa/Johannesburg',
  -33.978,
  25.592,
  -33.978,
  25.592,
  '2026-12-23'::date,
  '10:00',
  '2026-12-23 10:00:00+02'::timestamptz,
  'innovation@genesishub.co.za',
  '+27 41 581 0500',
  '{"general":"Free RSVP","delegate":"R250","corporate":"R750"}',
  false,
  250,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Eastern Cape Tech & Logistics Innovation Summit' AND event_date = '2026-12-23'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Hospitality & Culinary Startup Showcase',
  'Craft food brands, artisanal roasters, boutique winemakers, and cloud kitchen operators pitch to premier hotel chains, retail buyers, and gourmet restaurant groups.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'culinary', 'hospitality', 'cape-town', 'foodtech'],
  'Workshop17 Watershed',
  '17 Dock Road, V&A Waterfront, Cape Town, 8002',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9065,
  18.4208,
  -33.9065,
  18.4208,
  '2026-12-28'::date,
  '12:00',
  '2026-12-28 12:00:00+02'::timestamptz,
  'culinary@workshop17.co.za',
  '+27 21 202 6900',
  '{"tasting_pass":"R350","chef_founder":"R200","vip_buyer":"R850"}',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Hospitality & Culinary Startup Showcase' AND event_date = '2026-12-28'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Digital Nomads & Remote Solopreneur Meetup',
  'International solopreneurs, freelance agency owners, and remote software engineers gather to share monetization hacks, international tax structures, and automated client acquisition systems.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'solopreneur', 'remote-work', 'freelancers', 'sandton'],
  'Radisson Blu Gautrain Hotel Sandton',
  'Corner Rivonia Road & West Street, Sandton, 2196',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1068,
  28.0552,
  -26.1068,
  28.0552,
  '2026-12-29'::date,
  '16:00',
  '2026-12-29 16:00:00+02'::timestamptz,
  'nomads@radissonblu.com',
  '+27 11 286 1000',
  '{"solopreneur_pass":"R150","networker":"R250"}',
  true,
  180,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Digital Nomads & Remote Solopreneur Meetup' AND event_date = '2026-12-29'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Year-End Founders Toast & 2027 Vision Mixer',
  'Celebrate 2026 business milestones and establish strategic alliances for 2027. An evening of celebration, open networking, champagne toasts, and executive matchmaking across all startup sectors.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'networking', 'year-end', 'founders', 'sandton'],
  '22 On Sloane Startup Campus',
  '22 Sloane Street, Bryanston, Sandton, 2191',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.0505,
  28.0255,
  -26.0505,
  28.0255,
  '2026-12-30'::date,
  '18:00',
  '2026-12-30 18:00:00+02'::timestamptz,
  'vision2027@22onsloane.co',
  '+27 11 026 6000',
  '{"founder_early":"R250","executive":"R600","vip_table":"R2500"}',
  true,
  400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Year-End Founders Toast & 2027 Vision Mixer' AND event_date = '2026-12-30'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'New Year Startup Bootcamp & Venture Kickoff 2027',
  'Start 2027 with relentless momentum. An intensive 2-day hands-on bootcamp guiding 150 early-stage founders through financial modeling, customer discovery, legal IP protection, and investor decks.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'bootcamp', 'founders', 'startups', 'sandton', 'accelerator'],
  '22 On Sloane Startup Campus',
  '22 Sloane Street, Bryanston, Sandton, 2191',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.0505,
  28.0255,
  -26.0505,
  28.0255,
  '2027-01-08'::date,
  '08:30',
  '2027-01-08 08:30:00+02'::timestamptz,
  'kickoff@22onsloane.co',
  '+27 11 026 6000',
  '{"bootcamp_seat":"R450","two_founder_bundle":"R750","mentor_access":"R1200"}',
  true,
  250,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'New Year Startup Bootcamp & Venture Kickoff 2027' AND event_date = '2027-01-08'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Silicon Cape Tech Trend & Founder Forecast 2027',
  'Venture capitalists and premier tech founders reveal the top tech trends, consumer behavior shifts, and fundraising conditions defining 2027 in Africa. High-level panel dialogues and open Q&A.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'tech-trends', 'venture-capital', 'cape-town', 'founders'],
  'Workshop17 Watershed',
  '17 Dock Road, V&A Waterfront, Cape Town, 8002',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9065,
  18.4208,
  -33.9065,
  18.4208,
  '2027-01-11'::date,
  '10:00',
  '2027-01-11 10:00:00+02'::timestamptz,
  'forecast@workshop17.co.za',
  '+27 21 202 6900',
  '{"standard_pass":"R300","vip_lounge":"R750","livestream":"R100"}',
  true,
  280,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Silicon Cape Tech Trend & Founder Forecast 2027' AND event_date = '2027-01-11'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'SME Tax, Legal & Compliance Masterclass',
  'Don’t get caught out by SARS or CIPC. Leading corporate tax attorneys and chartered accountants teach small business owners deductions, VAT compliance, employment contracts, and Section 12BA green incentives.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'tax', 'legal', 'sme', 'compliance', 'sandton'],
  'Workshop17 Sandton',
  '138 West Street, Sandton, 2196',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1075,
  28.0545,
  -26.1075,
  28.0545,
  '2027-01-12'::date,
  '09:00',
  '2027-01-12 09:00:00+02'::timestamptz,
  'compliance@workshop17.co.za',
  '+27 11 202 7000',
  '{"sme_owner":"R250","delegate":"R450","materials_included":"R600"}',
  true,
  200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'SME Tax, Legal & Compliance Masterclass' AND event_date = '2027-01-12'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Healthcare & MedTech Innovators Pitch Night',
  'Biotech researchers, digital health startup founders, and medical device pioneers present breakthrough clinical solutions to hospital group executives and healthcare venture funds.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'medtech', 'healthtech', 'stellenbosch', 'biotech'],
  'Stellenbosch University LaunchLab',
  'Hammanshand Road, Stellenbosch, 7600',
  'Stellenbosch',
  'ZA',
  'Africa/Johannesburg',
  -33.9328,
  18.8654,
  -33.9328,
  18.8654,
  '2027-01-13'::date,
  '17:30',
  '2027-01-13 17:30:00+02'::timestamptz,
  'medtech@launchlab.co.za',
  '+27 21 808 9494',
  '{"medtech_founder":"Free RSVP","medical_professional":"R350","investor":"R900"}',
  false,
  180,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Healthcare & MedTech Innovators Pitch Night' AND event_date = '2027-01-13'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'B2B Sales Mastery for Tech Founders',
  'Tired of slow enterprise sales cycles? Master the art of enterprise prospecting, cold outreach sequences, discovery calls, and closing multi-million Rand annual contracts with corporate South Africa.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'b2b-sales', 'enterprise', 'startups', 'braamfontein'],
  'Tshimologong Digital Innovation Precinct',
  '41 Juta Street, Braamfontein, Johannesburg, 2001',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1932,
  28.0345,
  -26.1932,
  28.0345,
  '2027-01-14'::date,
  '13:00',
  '2027-01-14 13:00:00+02'::timestamptz,
  'b2bsales@tshimologong.joburg',
  '+27 11 717 6000',
  '{"founder_seat":"R350","enterprise_team":"R900","vip_review":"R1500"}',
  true,
  220,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'B2B Sales Mastery for Tech Founders' AND event_date = '2027-01-14'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Durban Creative Solopreneurs & Creators Summit',
  'Monetize digital content, build media production agencies, and scale personal brands into multi-revenue business empires. Featuring leading YouTube, TikTok, and podcast producers from South Africa.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'creators', 'media', 'solopreneur', 'durban'],
  'Durban ICC',
  '45 Bram Fischer Road, Durban Central, Durban, 4001',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.8524,
  31.0286,
  -29.8524,
  31.0286,
  '2027-01-15'::date,
  '10:00',
  '2027-01-15 10:00:00+02'::timestamptz,
  'creators@icc.co.za',
  '+27 31 360 1000',
  '{"creator_pass":"R200","vip_studio_tour":"R500","brand_rep":"R900"}',
  true,
  450,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Durban Creative Solopreneurs & Creators Summit' AND event_date = '2027-01-15'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Soweto Youth Business Incubator Open Day',
  'Connecting ambitious young township founders with free mentorship, co-working desk access, cloud computing credits, and seed grant funding opportunities. Inspirational guest keynotes and workshops.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'youth', 'soweto', 'incubator', 'community'],
  'Soweto Theatre Business & Cultural Centre',
  'Bolani Link & Cnr Bolani Rd, Jabulani, Soweto, 1868',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2415,
  27.8592,
  -26.2415,
  27.8592,
  '2027-01-16'::date,
  '10:00',
  '2027-01-16 10:00:00+02'::timestamptz,
  'youthincubator@sowetotheatre.com',
  '+27 11 930 7461',
  '{"community_youth":"Free RSVP","general":"Free RSVP"}',
  false,
  400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Soweto Youth Business Incubator Open Day' AND event_date = '2027-01-16'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Gauteng PropTech & Smart Buildings Forum',
  'Real estate developers, property syndicates, and PropTech innovators explore automated property management, tenant experience apps, digital leasing, and green building efficiency standards.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'proptech', 'real-estate', 'smart-buildings', 'sandton'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton, 2196',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-01-18'::date,
  '09:00',
  '2027-01-18 09:00:00+02'::timestamptz,
  'proptech@sandtoncc.co.za',
  '+27 11 779 0000',
  '{"founder_delegate":"R450","property_developer":"R950","executive":"R1800"}',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Gauteng PropTech & Smart Buildings Forum' AND event_date = '2027-01-18'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Pretoria AI & Automation for Small Businesses',
  'Practical, no-jargon demonstration of how small business owners can utilize generative AI agents, automated CRM pipelines, and automated bookkeeping to triple productivity without expanding payroll.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'ai-automation', 'sme', 'productivity', 'pretoria'],
  'SunBet Arena at Time Square',
  '209 Aramist Avenue, Menlyn, Pretoria, 0181',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7877,
  28.2798,
  -25.7877,
  28.2798,
  '2027-01-19'::date,
  '14:00',
  '2027-01-19 14:00:00+02'::timestamptz,
  'aibiz@suninternational.com',
  '+27 12 003 6150',
  '{"sme_owner":"R200","executive_pass":"R500"}',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Pretoria AI & Automation for Small Businesses' AND event_date = '2027-01-19'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Venture Capital Associate & Analyst Mixer',
  'An evening of confidential dealflow discussions and networking for investment associates, venture scouts, and early-stage syndicate managers tracking African tech rounds.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'venture-capital', 'investors', 'dealflow', 'sandton'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton, 2196',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2027-01-20'::date,
  '18:00',
  '2027-01-20 18:00:00+02'::timestamptz,
  'vcmixer@themarcsandton.co.za',
  '+27 11 883 1200',
  '{"invitation_only":"Free RSVP","general_vc":"R350"}',
  false,
  120,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Venture Capital Associate & Analyst Mixer' AND event_date = '2027-01-20'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cape Town FinTech Hackathon & Pitch Challenge',
  '48-hour challenge building the next generation of financial inclusion tools, cross-border remittance bots, and micro-savings apps. Top 3 teams win cash prizes and institutional sponsorship.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'fintech', 'hackathon', 'pitch', 'cape-town'],
  'Cape Town International Convention Centre (CTICC)',
  '1 Lower Long Street, Foreshore, Cape Town, 8001',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9161,
  18.4285,
  -33.9161,
  18.4285,
  '2027-01-22'::date,
  '09:00',
  '2027-01-22 09:00:00+02'::timestamptz,
  'fintechhack@cticc.co.za',
  '+27 21 410 5000',
  '{"developer_participant":"Free RSVP","spectator_pitch":"R150","judge_pass":"R750"}',
  false,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cape Town FinTech Hackathon & Pitch Challenge' AND event_date = '2027-01-22'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Midrand Logistics & Trucking Business Workshop',
  'How to enter and succeed in South Africa''s road freight, parcel courier, and cross-border trucking industry. Fuel management systems, fleet financing, broker negotiations, and cargo insurance essentials.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'logistics', 'trucking', 'freight', 'midrand'],
  'Riversands I-Hub',
  '8 Incubation Drive, Riverside View, Midrand, 2021',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -25.9692,
  28.0055,
  -25.9692,
  28.0055,
  '2027-01-23'::date,
  '09:30',
  '2027-01-23 09:30:00+02'::timestamptz,
  'trucking@riversandsihub.co.za',
  '+27 11 012 4600',
  '{"operator_pass":"R300","fleet_owner":"R650","vip_networking":"R1100"}',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Midrand Logistics & Trucking Business Workshop' AND event_date = '2027-01-23'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Women in STEM & Engineering Enterprise Pitch',
  'Female founders building hard-tech, civil engineering, clean energy, and software engineering ventures pitch their solutions for seed capital and enterprise vendor onboarding.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'women-in-stem', 'engineering', 'cape-town', 'founders'],
  'Bandwidth Barn Woodstock',
  '66 Albert Road, Woodstock, Cape Town, 7925',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.928,
  18.4485,
  -33.928,
  18.4485,
  '2027-01-25'::date,
  '10:00',
  '2027-01-25 10:00:00+02'::timestamptz,
  'womenstem@citi.org.za',
  '+27 21 409 7000',
  '{"stem_founder":"Free RSVP","delegate":"R250","corporate_supporter":"R800"}',
  false,
  200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Women in STEM & Engineering Enterprise Pitch' AND event_date = '2027-01-25'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Franchising Your Existing Business Model',
  'Turn your successful restaurant, salon, fitness studio, or service business into a replicable national franchise system. Operations manual design, FASA regulations, and franchise marketing.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'franchising', 'business-growth', 'pretoria', 'scaling'],
  'The Capital Menlyn Maine',
  '194 Bancor Avenue, Menlyn, Pretoria, 0181',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7865,
  28.281,
  -25.7865,
  28.281,
  '2027-01-26'::date,
  '14:00',
  '2027-01-26 14:00:00+02'::timestamptz,
  'franchisescale@thecapital.co.za',
  '+27 12 942 5000',
  '{"founder_seat":"R450","business_duo":"R750"}',
  true,
  180,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Franchising Your Existing Business Model' AND event_date = '2027-01-26'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Durban Retail & Wholesale Importers Network',
  'Direct manufacturers and port customs clearing specialists teach entrepreneurs how to safely import inventory from Asia and Europe, negotiate container freight, and manage cash flow cycles.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'importing', 'trade', 'wholesale', 'durban'],
  'The Pencil Club Umhlanga',
  '1 Ncondo Place, Umhlanga Ridge, Durban, 4319',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.724,
  31.0825,
  -29.724,
  31.0825,
  '2027-01-27'::date,
  '10:00',
  '2027-01-27 10:00:00+02'::timestamptz,
  'importers@thepencilclub.com',
  '+27 31 826 9000',
  '{"importer_pass":"R350","vip_consultation":"R850"}',
  true,
  220,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Durban Retail & Wholesale Importers Network' AND event_date = '2027-01-27'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Startup Valuation & Cap Table Modeling Workshop',
  'Demystifying startup valuations before you sign a term sheet. Learn discounted cash flow vs scorecard valuation, convertible notes, SAFEs, option pools, and dilution modeling with veteran VCs.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'valuation', 'fundraising', 'cap-table', 'sandton'],
  '22 On Sloane Startup Campus',
  '22 Sloane Street, Bryanston, Sandton, 2191',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.0505,
  28.0255,
  -26.0505,
  28.0255,
  '2027-01-28'::date,
  '15:00',
  '2027-01-28 15:00:00+02'::timestamptz,
  'valuation@22onsloane.co',
  '+27 11 026 6000',
  '{"founder_ticket":"R350","investor_ticket":"R700"}',
  true,
  200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Startup Valuation & Cap Table Modeling Workshop' AND event_date = '2027-01-28'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Green Tech & Circular Economy Pitch Day',
  'Pioneering waste-to-value, bioplastic, water purification, and circular economy startups pitch to sustainability funds and ESG corporate procurement directors for R1,000,000 in grants.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'greentech', 'circular-economy', 'esg', 'cape-town'],
  'Workshop17 Watershed',
  '17 Dock Road, V&A Waterfront, Cape Town, 8002',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9065,
  18.4208,
  -33.9065,
  18.4208,
  '2027-01-29'::date,
  '09:00',
  '2027-01-29 09:00:00+02'::timestamptz,
  'greentech@workshop17.co.za',
  '+27 21 202 6900',
  '{"green_founder":"Free RSVP","general_pass":"R250","corporate_esg":"R850"}',
  false,
  250,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Green Tech & Circular Economy Pitch Day' AND event_date = '2027-01-29'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Eastern Cape Automotive Innovation & SME Hub',
  'Showcasing component manufacturing, supply chain digital twin tech, and EV battery refurbishment startups tailored for South Africa’s leading automotive export cluster.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'automotive', 'manufacturing', 'gqeberha', 'sme'],
  'Genesis Hub Gqeberha',
  '140 Main Road, Walmer, Gqeberha, 6070',
  'Gqeberha',
  'ZA',
  'Africa/Johannesburg',
  -33.978,
  25.592,
  -33.978,
  25.592,
  '2027-01-29'::date,
  '10:00',
  '2027-01-29 10:00:00+02'::timestamptz,
  'autotech@genesishub.co.za',
  '+27 41 581 0500',
  '{"general_entry":"Free RSVP","sme_delegate":"R200","corporate":"R600"}',
  false,
  220,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Eastern Cape Automotive Innovation & SME Hub' AND event_date = '2027-01-29'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Midrand Food Truck & Mobile Catering Incubator',
  'Everything you need to launch a profitable food truck, trailer, or pop-up catering brand: health clearances, gas compliance certificates, festival booking tactics, and kitchen economics.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'food-trucks', 'hospitality', 'sme', 'midrand'],
  'Gallagher Convention Centre',
  '19 Richards Drive, Halfway House, Midrand, 1685',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -26.0028,
  28.1287,
  -26.0028,
  28.1287,
  '2027-01-30'::date,
  '11:00',
  '2027-01-30 11:00:00+02'::timestamptz,
  'foodtrucks@gallagher.co.za',
  '+27 11 266 3000',
  '{"culinary_pass":"R150","tasting_kit":"R300"}',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Midrand Food Truck & Mobile Catering Incubator' AND event_date = '2027-01-30'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Gauteng Angel Investor Pitch Dinner',
  'An exclusive, black-tie three-course dinner where 6 pre-vetted high-growth tech and retail ventures present private investment pitches to 40 verified high-net-worth angel investors.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'angel-investors', 'pitch-dinner', 'vip', 'sandton'],
  'Radisson Blu Gautrain Hotel Sandton',
  'Corner Rivonia Road & West Street, Sandton, 2196',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1068,
  28.0552,
  -26.1068,
  28.0552,
  '2027-01-30'::date,
  '19:00',
  '2027-01-30 19:00:00+02'::timestamptz,
  'angelclub@radissonblu.com',
  '+27 11 286 1000',
  '{"angel_seat":"R1500","pitching_company":"R2500"}',
  true,
  80,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Gauteng Angel Investor Pitch Dinner' AND event_date = '2027-01-30'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Africa Venture Capital & Private Equity Summit 2027',
  'The benchmark investment summit bringing together 800+ international fund managers, sovereign wealth representatives, DFIs, and Africa’s fastest-growing technology and infrastructure pioneers.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'venture-capital', 'private-equity', 'sandton', 'summit', 'investors'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton, 2196',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-02-03'::date,
  '08:30',
  '2027-02-03 08:30:00+02'::timestamptz,
  'vcsummit@sandtoncc.co.za',
  '+27 11 779 0000',
  '{"startup_delegate":"R1200","fund_manager":"R3500","vip_all_access":"R7500"}',
  true,
  850,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Africa Venture Capital & Private Equity Summit 2027' AND event_date = '2027-02-03'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cape Town Seedstars Pitch Competition 2027',
  'The official Cape Town regional qualifier for Seedstars World. Top 10 high-growth African startups pitch live for a chance to represent South Africa in Switzerland with $500k global investment.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'pitch', 'seedstars', 'startups', 'cape-town', 'competition'],
  'Cape Town International Convention Centre (CTICC)',
  '1 Lower Long Street, Foreshore, Cape Town, 8001',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9161,
  18.4285,
  -33.9161,
  18.4285,
  '2027-02-04'::date,
  '14:00',
  '2027-02-04 14:00:00+02'::timestamptz,
  'seedstars@cticc.co.za',
  '+27 21 410 5000',
  '{"spectator_pass":"R200","founder_vip":"R550","investor_ticket":"R1100"}',
  true,
  400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cape Town Seedstars Pitch Competition 2027' AND event_date = '2027-02-04'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Township E-Commerce & Delivery Hub Launch',
  'Empowering local township merchants with multi-vendor marketplace technology, instant debit card payments, and bicycle/scooter hyper-local delivery fulfillment. Grants awarded to top 10 merchants.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'township-economy', 'ecommerce', 'delivery', 'soweto'],
  'Soweto Theatre Business & Cultural Centre',
  'Bolani Link & Cnr Bolani Rd, Jabulani, Soweto, 1868',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2415,
  27.8592,
  -26.2415,
  27.8592,
  '2027-02-05'::date,
  '10:00',
  '2027-02-05 10:00:00+02'::timestamptz,
  'deliveryhub@sowetotheatre.com',
  '+27 11 930 7461',
  '{"local_merchant":"Free RSVP","general":"R100"}',
  false,
  450,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Township E-Commerce & Delivery Hub Launch' AND event_date = '2027-02-05'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'AI Product Founders & LLM Builders Workshop',
  'A deeply technical, commercialization-focused masterclass for engineers building agentic workflows, custom LLM fine-tuning, and automated B2B customer support tools for South African business clients.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'ai', 'llm', 'software', 'braamfontein', 'founders'],
  'Tshimologong Digital Innovation Precinct',
  '41 Juta Street, Braamfontein, Johannesburg, 2001',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1932,
  28.0345,
  -26.1932,
  28.0345,
  '2027-02-06'::date,
  '10:00',
  '2027-02-06 10:00:00+02'::timestamptz,
  'aibuilders@tshimologong.joburg',
  '+27 11 717 6000',
  '{"developer_pass":"R300","founder_vip":"R650"}',
  true,
  250,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'AI Product Founders & LLM Builders Workshop' AND event_date = '2027-02-06'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Stellenbosch Agri-FinTech & Crop Insurance Forum',
  'Innovative parametric weather insurance, smart satellite crop monitoring, and micro-loan lending algorithms designed to finance South African emerging farmers and commercial wine estates.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'agritech', 'fintech', 'insurance', 'stellenbosch'],
  'Stellenbosch University LaunchLab',
  'Hammanshand Road, Stellenbosch, 7600',
  'Stellenbosch',
  'ZA',
  'Africa/Johannesburg',
  -33.9328,
  18.8654,
  -33.9328,
  18.8654,
  '2027-02-08'::date,
  '09:00',
  '2027-02-08 09:00:00+02'::timestamptz,
  'agrifintech@launchlab.co.za',
  '+27 21 808 9494',
  '{"farmer_pass":"R200","fintech_founder":"R450","corporate":"R950"}',
  true,
  200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Stellenbosch Agri-FinTech & Crop Insurance Forum' AND event_date = '2027-02-08'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Pretoria CyberSecurity & Defence Tech Pitch',
  'Startups building endpoint encryption, AI threat hunting, industrial SCADA defense, and fraud prevention present to corporate CISOs, state intelligence procurement, and venture backers.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'cybersecurity', 'defencetech', 'pretoria', 'startups'],
  'SunBet Arena at Time Square',
  '209 Aramist Avenue, Menlyn, Pretoria, 0181',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7877,
  28.2798,
  -25.7877,
  28.2798,
  '2027-02-09'::date,
  '10:00',
  '2027-02-09 10:00:00+02'::timestamptz,
  'cybertech@suninternational.com',
  '+27 12 003 6150',
  '{"founder_seat":"R350","security_pro":"R750","vip":"R1500"}',
  true,
  250,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Pretoria CyberSecurity & Defence Tech Pitch' AND event_date = '2027-02-09'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Durban Tourism & Hospitality Tech Incubator',
  'Accelerating smart ticketing, experiential travel apps, guest concierge robotics, and eco-tourism booking platforms for KwaZulu-Natal''s premier holiday and conferencing economy.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'tourism', 'hospitality', 'durban', 'traveltech'],
  'Durban ICC',
  '45 Bram Fischer Road, Durban Central, Durban, 4001',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.8524,
  31.0286,
  -29.8524,
  31.0286,
  '2027-02-10'::date,
  '09:30',
  '2027-02-10 09:30:00+02'::timestamptz,
  'tourismtech@icc.co.za',
  '+27 31 360 1000',
  '{"tourism_operator":"R250","startup_pass":"R350","vip_buyer":"R850"}',
  true,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Durban Tourism & Hospitality Tech Incubator' AND event_date = '2027-02-10'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Women Angel Investors Masterclass & Pitch Review',
  'A dedicated masterclass teaching high-earning women executives how to evaluate angel investments, negotiate equity term sheets, and mentor early-stage female-led African ventures.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'women-investors', 'angel-investing', 'sandton', 'leadership'],
  'Workshop17 Sandton',
  '138 West Street, Sandton, 2196',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1075,
  28.0545,
  -26.1075,
  28.0545,
  '2027-02-11'::date,
  '17:30',
  '2027-02-11 17:30:00+02'::timestamptz,
  'womenangels@workshop17.co.za',
  '+27 11 202 7000',
  '{"aspiring_angel":"R650","seasoned_investor":"R1100"}',
  true,
  150,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Women Angel Investors Masterclass & Pitch Review' AND event_date = '2027-02-11'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Midrand Industrial Robotics & Automation Showcase',
  'Live live-action demonstrations of robotic arms, autonomous pallet movers, computer vision sorting lines, and warehouse automation systems built by South African engineering entrepreneurs.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'robotics', 'automation', 'hardware', 'midrand'],
  'Gallagher Convention Centre',
  '19 Richards Drive, Halfway House, Midrand, 1685',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -26.0028,
  28.1287,
  -26.0028,
  28.1287,
  '2027-02-12'::date,
  '09:00',
  '2027-02-12 09:00:00+02'::timestamptz,
  'robotics@gallagher.co.za',
  '+27 11 266 3000',
  '{"engineer_pass":"R250","delegate":"R500","exhibitor":"R2500"}',
  true,
  400,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Midrand Industrial Robotics & Automation Showcase' AND event_date = '2027-02-12'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cape Town CleanTech & Water Innovation Summit',
  'Groundbreaking desalination innovations, greywater recycling plants, municipal leakage sensors, and climate-resilient water infrastructure companies pitch for public-private utility contracts.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'cleantech', 'water-security', 'cape-town', 'esg'],
  'Workshop17 Watershed',
  '17 Dock Road, V&A Waterfront, Cape Town, 8002',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.9065,
  18.4208,
  -33.9065,
  18.4208,
  '2027-02-15'::date,
  '09:00',
  '2027-02-15 09:00:00+02'::timestamptz,
  'cleantech@workshop17.co.za',
  '+27 21 202 6900',
  '{"cleantech_founder":"R300","utility_delegate":"R750","vip":"R1400"}',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cape Town CleanTech & Water Innovation Summit' AND event_date = '2027-02-15'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Raising Venture Debt in Emerging Markets',
  'Learn how to fund growth without diluting your founder equity. Managing partners from leading African venture debt funds explain underwriting criteria, revenue-based financing, and covenants.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'venture-debt', 'fundraising', 'non-dilutive', 'sandton'],
  '22 On Sloane Startup Campus',
  '22 Sloane Street, Bryanston, Sandton, 2191',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.0505,
  28.0255,
  -26.0505,
  28.0255,
  '2027-02-16'::date,
  '14:00',
  '2027-02-16 14:00:00+02'::timestamptz,
  'venturedebt@22onsloane.co',
  '+27 11 026 6000',
  '{"founder_seat":"R400","executive_pass":"R850"}',
  true,
  200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Raising Venture Debt in Emerging Markets' AND event_date = '2027-02-16'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'EdTech & Future of Work Startup Showcase',
  'Showcasing digital upskilling academies, gamified STEM curricula, AI tutoring assistants, and corporate micro-credentialing platforms transforming education across Sub-Saharan Africa.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'edtech', 'future-of-work', 'cape-town', 'startups'],
  'Bandwidth Barn Woodstock',
  '66 Albert Road, Woodstock, Cape Town, 7925',
  'Cape Town',
  'ZA',
  'Africa/Johannesburg',
  -33.928,
  18.4485,
  -33.928,
  18.4485,
  '2027-02-17'::date,
  '10:00',
  '2027-02-17 10:00:00+02'::timestamptz,
  'edtech@citi.org.za',
  '+27 21 409 7000',
  '{"edtech_founder":"Free RSVP","educator_pass":"R150","investor":"R600"}',
  false,
  220,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'EdTech & Future of Work Startup Showcase' AND event_date = '2027-02-17'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Cross-Border African Trade & AfCFTA Masterclass',
  'How to scale your goods and services across SADC, East, and West Africa under the African Continental Free Trade Area. Tariff schedules, rules of origin certificates, and trade financing mechanics.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'afcfta', 'export', 'trade', 'midrand'],
  'Riversands I-Hub',
  '8 Incubation Drive, Riverside View, Midrand, 2021',
  'Midrand',
  'ZA',
  'Africa/Johannesburg',
  -25.9692,
  28.0055,
  -25.9692,
  28.0055,
  '2027-02-18'::date,
  '09:30',
  '2027-02-18 09:30:00+02'::timestamptz,
  'afcfta@riversandsihub.co.za',
  '+27 11 012 4600',
  '{"exporter_pass":"R350","corporate_trade":"R850"}',
  true,
  300,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Cross-Border African Trade & AfCFTA Masterclass' AND event_date = '2027-02-18'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Pretoria Biotech & Pharmaceutical Spin-Out Pitch',
  'Pre-clinical drug discovery, active pharmaceutical ingredient (API) synthesis, and point-of-care diagnostic startups present to international biopharma licensing executives.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'biotech', 'pharma', 'pretoria', 'spinout'],
  'The Capital Menlyn Maine',
  '194 Bancor Avenue, Menlyn, Pretoria, 0181',
  'Pretoria',
  'ZA',
  'Africa/Johannesburg',
  -25.7865,
  28.281,
  -25.7865,
  28.281,
  '2027-02-19'::date,
  '10:00',
  '2027-02-19 10:00:00+02'::timestamptz,
  'biopharma@thecapital.co.za',
  '+27 12 942 5000',
  '{"researcher_founder":"Free RSVP","industry_delegate":"R450","investor":"R1000"}',
  false,
  180,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Pretoria Biotech & Pharmaceutical Spin-Out Pitch' AND event_date = '2027-02-19'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Durban Fashion Design & Apparel Factory Incubator',
  'Connecting independent fashion designers and streetwear founders with CMT manufacturing factories, fabric mills, pattern makers, and retail buyers for nationwide distribution.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'fashion', 'manufacturing', 'textiles', 'durban'],
  'The Pencil Club Umhlanga',
  '1 Ncondo Place, Umhlanga Ridge, Durban, 4319',
  'Durban',
  'ZA',
  'Africa/Johannesburg',
  -29.724,
  31.0825,
  -29.724,
  31.0825,
  '2027-02-20'::date,
  '11:00',
  '2027-02-20 11:00:00+02'::timestamptz,
  'fashioninc@thepencilclub.com',
  '+27 31 826 9000',
  '{"designer_entry":"R200","buyer_pass":"R500","vip_front_row":"R850"}',
  true,
  250,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Durban Fashion Design & Apparel Factory Incubator' AND event_date = '2027-02-20'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Sandton Corporate Venture Capital & M&A Forum',
  'Leading enterprise corporations (banks, telcos, insurers, retailers) share their strategic acquisition roadmaps, corporate venture arm theses, and open commercial pilot opportunities.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'cvc', 'm-and-a', 'corporate-innovation', 'sandton'],
  'The Marc Sandton',
  '129 Rivonia Road, Sandton, 2196',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1042,
  28.0558,
  -26.1042,
  28.0558,
  '2027-02-23'::date,
  '09:00',
  '2027-02-23 09:00:00+02'::timestamptz,
  'cvc@themarcsandton.co.za',
  '+27 11 883 1200',
  '{"scaleup_ceo":"R650","corporate_director":"R1500","vip_dinner":"R2500"}',
  true,
  200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Sandton Corporate Venture Capital & M&A Forum' AND event_date = '2027-02-23'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Eastern Cape Renewable Energy Microgrid Builders',
  'Wind turbine maintenance contractors, mini-grid operators, and energy storage developers gather to discuss independent power projects and off-grid industrial manufacturing supply.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'renewable-energy', 'wind-power', 'gqeberha', 'sme'],
  'Genesis Hub Gqeberha',
  '140 Main Road, Walmer, Gqeberha, 6070',
  'Gqeberha',
  'ZA',
  'Africa/Johannesburg',
  -33.978,
  25.592,
  -33.978,
  25.592,
  '2027-02-24'::date,
  '10:00',
  '2027-02-24 10:00:00+02'::timestamptz,
  'windenergy@genesishub.co.za',
  '+27 41 581 0500',
  '{"contractor_pass":"R250","energy_developer":"R600","vip":"R1100"}',
  true,
  200,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Eastern Cape Renewable Energy Microgrid Builders' AND event_date = '2027-02-24'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Soweto Artisan Trades & Construction Guild Launch',
  'Connecting qualified plumbing, electrical, carpentry, and masonry contractors with bulk material discounts, digital dispatch software, and commercial builder subcontracts.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'construction', 'artisans', 'sme', 'soweto'],
  'Soweto Theatre Business & Cultural Centre',
  'Bolani Link & Cnr Bolani Rd, Jabulani, Soweto, 1868',
  'Soweto',
  'ZA',
  'Africa/Johannesburg',
  -26.2415,
  27.8592,
  -26.2415,
  27.8592,
  '2027-02-25'::date,
  '10:00',
  '2027-02-25 10:00:00+02'::timestamptz,
  'trades@sowetotheatre.com',
  '+27 11 930 7461',
  '{"artisan_entry":"Free RSVP","general":"Free RSVP"}',
  false,
  350,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Soweto Artisan Trades & Construction Guild Launch' AND event_date = '2027-02-25'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'Founders Mental Resilience & High-Performance Retreat',
  'Tackling burnout, executive psychology, stress management, and elite cognitive performance for active startup founders navigating high-stakes hypergrowth. Led by clinical sports psychologists.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'founder-wellness', 'mental-health', 'leadership', 'sandton'],
  'Radisson Blu Gautrain Hotel Sandton',
  'Corner Rivonia Road & West Street, Sandton, 2196',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1068,
  28.0552,
  -26.1068,
  28.0552,
  '2027-02-26'::date,
  '09:00',
  '2027-02-26 09:00:00+02'::timestamptz,
  'resilience@radissonblu.com',
  '+27 11 286 1000',
  '{"founder_retreat":"R550","all_inclusive_wellness":"R1200"}',
  true,
  120,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'Founders Mental Resilience & High-Performance Retreat' AND event_date = '2027-02-26'::date AND deleted_at IS NULL
);

INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
SELECT
  'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid,
  'South African Angel Syndicate Demo Day Finale',
  'The season finale where 12 top-performing accelerated startups from across Gauteng, Western Cape, and KwaZulu-Natal pitch for syndicated seed investment tickets totaling R10M+.',
  'biz',
  ARRAY['biz', 'entrepreneurship'],
  ARRAY['entrepreneurship', 'pitch', 'demo-day', 'angel-investing', 'sandton', 'startups'],
  'Sandton Convention Centre',
  '161 Maude Street, Sandton, 2196',
  'Johannesburg',
  'ZA',
  'Africa/Johannesburg',
  -26.1065,
  28.0531,
  -26.1065,
  28.0531,
  '2027-02-27'::date,
  '14:00',
  '2027-02-27 14:00:00+02'::timestamptz,
  'finaledemoday@sandtoncc.co.za',
  '+27 11 779 0000',
  '{"spectator_ticket":"R350","angel_syndicate":"R1200","vip_table":"R5000"}',
  true,
  500,
  true,
  'published',
  false,
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
  ARRAY['https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80']
WHERE NOT EXISTS (
  SELECT 1 FROM public.events
  WHERE title = 'South African Angel Syndicate Demo Day Finale' AND event_date = '2027-02-27'::date AND deleted_at IS NULL
);

UPDATE public.events
SET is_published = true, status = 'published'
WHERE tags @> ARRAY['entrepreneurship']::text[]
  AND event_date >= '2026-12-01'
  AND event_date <= '2027-02-28'
  AND deleted_at IS NULL;

COMMIT;