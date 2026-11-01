-- Real South African sport fixtures, November 2026 – January 2027 (40 events).
--
-- Posted as The Gruvs account. Every row is a published fixture, checked on
-- 2026-10-09 against the organiser or at least two independent listings:
--   Cricket  — Cricket South Africa's 2026/27 home schedule (Proteas v
--              Bangladesh, Proteas v England) and the SA20 2027 schedule.
--   Rugby    — Sharks, Stormers, Bulls and Lions fixture/ticket pages, the URC
--              2026/27 fixture list, EPCR, and SA Rugby (HSBC SVNS Cape Town).
--   Golf     — Sun International / Nedbank Golf Challenge (3–6 Dec 2026).
--   Racing   — summercup.co.za, lormarinskingsplate.co.za.
--   Motorsport — SA Endurance Series / Kyalami (Nine Hours of Kyalami).
-- Start times are SAST. A time is left NULL where the sources disagreed or
-- none was published yet (the app then shows the date only), rather than
-- guessed. Left out on purpose: anything with no venue yet (Carling Knockout
-- final, Bafana v Kenya), or with conflicting dates (2nd ODI v England,
-- Proteas Women v India, Soweto Marathon not yet confirmed by the organiser).
--
-- Not a migration: it is data, and CI's throwaway database has no Gruvs
-- account to author it. Safe to re-run: a fixture is skipped if The Gruvs
-- already posted the same title on the same date.

WITH gruvs AS (
  SELECT 'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c'::uuid AS id
),
fx (title, description, tags, venue_name, address, city, lat, lon, event_date, event_time, end_date, ticket_url, price) AS (
  VALUES
  -- ── Proteas v Bangladesh ──────────────────────────────────────────────
  ('Proteas v Bangladesh — 1st Test', 'South Africa v Bangladesh, first of two Tests (World Test Championship). Five days, 15–19 November.', ARRAY['cricket','proteas','test','bangladesh'], 'DP World Wanderers Stadium', 'Illovo, Johannesburg', 'Johannesburg', -26.13111, 28.05750, DATE '2026-11-15', '10:00', DATE '2026-11-19', 'https://cricket.co.za', 'Paid'),
  ('Proteas v Bangladesh — 2nd Test', 'South Africa v Bangladesh, second Test (World Test Championship). Five days, 23–27 November.', ARRAY['cricket','proteas','test','bangladesh'], 'SuperSport Park', 'Centurion, Gauteng', 'Centurion', -25.85972, 28.19528, DATE '2026-11-23', '10:00', DATE '2026-11-27', 'https://cricket.co.za', 'Paid'),
  ('Proteas v Bangladesh — 1st ODI', 'South Africa v Bangladesh, first of three ODIs. Start time to be confirmed.', ARRAY['cricket','proteas','odi','bangladesh'], 'Buffalo Park', 'Buffalo Park Drive, East London', 'East London', -33.00674, 27.91910, DATE '2026-12-01', NULL, NULL, 'https://cricket.co.za', 'Paid'),
  ('Proteas v Bangladesh — 2nd ODI', 'South Africa v Bangladesh, second ODI. Start time to be confirmed.', ARRAY['cricket','proteas','odi','bangladesh'], 'St George''s Park', 'Park Drive, Gqeberha', 'Gqeberha', -33.96639, 25.61028, DATE '2026-12-04', NULL, NULL, 'https://cricket.co.za', 'Paid'),
  ('Proteas v Bangladesh — 3rd ODI', 'South Africa v Bangladesh, third ODI. Start time to be confirmed.', ARRAY['cricket','proteas','odi','bangladesh'], 'Newlands Cricket Ground', 'Campground Road, Newlands, Cape Town', 'Cape Town', -33.97361, 18.46889, DATE '2026-12-07', NULL, NULL, 'https://cricket.co.za', 'Paid'),
  ('Proteas v Bangladesh — 1st T20I', 'South Africa v Bangladesh, first of three T20Is. Start time to be confirmed.', ARRAY['cricket','proteas','t20','bangladesh'], 'Diamond Oval', '41 Lardner Burke Avenue, Kimberley', 'Kimberley', -28.74243, 24.79772, DATE '2026-12-10', NULL, NULL, 'https://cricket.co.za', 'Paid'),
  ('Proteas v Bangladesh — 2nd T20I', 'South Africa v Bangladesh, second T20I. Start time to be confirmed.', ARRAY['cricket','proteas','t20','bangladesh'], 'Willowmoore Park', '101 Harpur Avenue, Benoni', 'Benoni', -26.19450, 28.31690, DATE '2026-12-12', NULL, NULL, 'https://cricket.co.za', 'Paid'),
  ('Proteas v Bangladesh — 3rd T20I', 'South Africa v Bangladesh, third T20I. Start time to be confirmed.', ARRAY['cricket','proteas','t20','bangladesh'], 'SuperSport Park', 'Centurion, Gauteng', 'Centurion', -25.85972, 28.19528, DATE '2026-12-13', NULL, NULL, 'https://cricket.co.za', 'Paid'),
  -- ── Proteas v England ─────────────────────────────────────────────────
  ('Proteas v England — 1st Test', 'South Africa v England, first Test. Five days, 17–21 December. Start time to be confirmed.', ARRAY['cricket','proteas','test','england'], 'DP World Wanderers Stadium', 'Illovo, Johannesburg', 'Johannesburg', -26.13111, 28.05750, DATE '2026-12-17', NULL, DATE '2026-12-21', 'https://cricket.co.za', 'Paid'),
  ('Proteas v England — Boxing Day Test', 'South Africa v England, second Test — the Boxing Day Test. Five days, 26–30 December. Start time to be confirmed.', ARRAY['cricket','proteas','test','england','boxing day'], 'SuperSport Park', 'Centurion, Gauteng', 'Centurion', -25.85972, 28.19528, DATE '2026-12-26', NULL, DATE '2026-12-30', 'https://cricket.co.za', 'Paid'),
  ('Proteas v England — New Year''s Test', 'South Africa v England, third Test — the New Year''s Test. Five days, 3–7 January. Start time to be confirmed.', ARRAY['cricket','proteas','test','england','new year'], 'Newlands Cricket Ground', 'Campground Road, Newlands, Cape Town', 'Cape Town', -33.97361, 18.46889, DATE '2027-01-03', NULL, DATE '2027-01-07', 'https://cricket.co.za', 'Paid'),
  ('Proteas v England — 1st ODI', 'South Africa v England, first of three ODIs. Start time to be confirmed.', ARRAY['cricket','proteas','odi','england'], 'Boland Park', 'Paarl, Western Cape', 'Paarl', -33.74139, 18.99833, DATE '2027-01-10', NULL, NULL, 'https://cricket.co.za', 'Paid'),
  ('Proteas v England — 3rd ODI', 'South Africa v England, third ODI. Start time to be confirmed.', ARRAY['cricket','proteas','odi','england'], 'Mangaung Oval', 'Att Horak Street, Willows, Bloemfontein', 'Bloemfontein', -29.11668, 26.20527, DATE '2027-01-15', NULL, NULL, 'https://cricket.co.za', 'Paid'),
  -- ── SA20 2027 (January) ───────────────────────────────────────────────
  ('SA20: Sunrisers Eastern Cape v Pretoria Capitals', 'SA20 2027 opening match — the defending champions host the Capitals.', ARRAY['cricket','sa20','t20'], 'St George''s Park', 'Park Drive, Gqeberha', 'Gqeberha', -33.96639, 25.61028, DATE '2027-01-17', '15:30', NULL, 'https://www.sa20.co.za', 'Paid'),
  ('SA20: Paarl Royals v Joburg Super Kings', 'SA20 2027 league match.', ARRAY['cricket','sa20','t20'], 'Boland Park', 'Paarl, Western Cape', 'Paarl', -33.74139, 18.99833, DATE '2027-01-18', '17:30', NULL, 'https://www.sa20.co.za', 'Paid'),
  ('SA20: Pretoria Capitals v Durban''s Super Giants', 'SA20 2027 league match.', ARRAY['cricket','sa20','t20'], 'SuperSport Park', 'Centurion, Gauteng', 'Centurion', -25.85972, 28.19528, DATE '2027-01-19', '17:30', NULL, 'https://www.sa20.co.za', 'Paid'),
  ('SA20: Durban''s Super Giants v Sunrisers Eastern Cape', 'SA20 2027 league match.', ARRAY['cricket','sa20','t20'], 'Kingsmead', 'Kingsmead, Durban', 'Durban', -29.85000, 31.02778, DATE '2027-01-21', '17:30', NULL, 'https://www.sa20.co.za', 'Paid'),
  ('SA20: Durban''s Super Giants v Pretoria Capitals', 'SA20 2027 league match (day game).', ARRAY['cricket','sa20','t20'], 'Kingsmead', 'Kingsmead, Durban', 'Durban', -29.85000, 31.02778, DATE '2027-01-23', '13:00', NULL, 'https://www.sa20.co.za', 'Paid'),
  ('SA20: Joburg Super Kings v Sunrisers Eastern Cape', 'SA20 2027 league match.', ARRAY['cricket','sa20','t20'], 'DP World Wanderers Stadium', 'Illovo, Johannesburg', 'Johannesburg', -26.13111, 28.05750, DATE '2027-01-23', '17:30', NULL, 'https://www.sa20.co.za', 'Paid'),
  ('SA20: Paarl Royals v MI Cape Town', 'SA20 2027 league match.', ARRAY['cricket','sa20','t20'], 'Boland Park', 'Paarl, Western Cape', 'Paarl', -33.74139, 18.99833, DATE '2027-01-24', '15:30', NULL, 'https://www.sa20.co.za', 'Paid'),
  ('SA20: Pretoria Capitals v Sunrisers Eastern Cape', 'SA20 2027 league match.', ARRAY['cricket','sa20','t20'], 'SuperSport Park', 'Centurion, Gauteng', 'Centurion', -25.85972, 28.19528, DATE '2027-01-26', '17:30', NULL, 'https://www.sa20.co.za', 'Paid'),
  ('SA20: Durban''s Super Giants v Paarl Royals', 'SA20 2027 league match.', ARRAY['cricket','sa20','t20'], 'Kingsmead', 'Kingsmead, Durban', 'Durban', -29.85000, 31.02778, DATE '2027-01-27', '17:30', NULL, 'https://www.sa20.co.za', 'Paid'),
  ('SA20: Sunrisers Eastern Cape v Joburg Super Kings', 'SA20 2027 league match.', ARRAY['cricket','sa20','t20'], 'St George''s Park', 'Park Drive, Gqeberha', 'Gqeberha', -33.96639, 25.61028, DATE '2027-01-28', '17:30', NULL, 'https://www.sa20.co.za', 'Paid'),
  ('SA20: Paarl Royals v Pretoria Capitals', 'SA20 2027 league match.', ARRAY['cricket','sa20','t20'], 'Boland Park', 'Paarl, Western Cape', 'Paarl', -33.74139, 18.99833, DATE '2027-01-29', '17:30', NULL, 'https://www.sa20.co.za', 'Paid'),
  ('SA20: Sunrisers Eastern Cape v MI Cape Town', 'SA20 2027 league match (day game).', ARRAY['cricket','sa20','t20'], 'St George''s Park', 'Park Drive, Gqeberha', 'Gqeberha', -33.96639, 25.61028, DATE '2027-01-30', '13:00', NULL, 'https://www.sa20.co.za', 'Paid'),
  ('SA20: Joburg Super Kings v Durban''s Super Giants', 'SA20 2027 league match.', ARRAY['cricket','sa20','t20'], 'DP World Wanderers Stadium', 'Illovo, Johannesburg', 'Johannesburg', -26.13111, 28.05750, DATE '2027-01-30', '17:30', NULL, 'https://www.sa20.co.za', 'Paid'),
  ('SA20: Pretoria Capitals v Paarl Royals', 'SA20 2027 league match.', ARRAY['cricket','sa20','t20'], 'SuperSport Park', 'Centurion, Gauteng', 'Centurion', -25.85972, 28.19528, DATE '2027-01-31', '15:30', NULL, 'https://www.sa20.co.za', 'Paid'),
  -- ── Rugby ─────────────────────────────────────────────────────────────
  ('URC: Lions v Bulls', 'Vodacom United Rugby Championship — the Highveld derby at Ellis Park.', ARRAY['rugby','urc','derby'], 'Ellis Park Stadium', 'Doornfontein, Johannesburg', 'Johannesburg', -26.19750, 28.06083, DATE '2026-12-05', '14:30', NULL, 'https://shop.ticketpro.co.za/seller/lions-rugby-mhmf', 'From R70'),
  ('URC: Sharks v Stormers', 'Vodacom United Rugby Championship — SA derby at Kings Park.', ARRAY['rugby','urc','derby'], 'Hollywoodbets Kings Park', 'Stamford Hill, Durban', 'Durban', -29.82500, 31.02972, DATE '2026-12-05', '17:00', NULL, 'https://sharksrugby.co.za/pages/fixtures', 'Paid'),
  ('HSBC SVNS Cape Town', 'The Cape Town leg of the HSBC SVNS series — two days of sevens rugby, 5–6 December. Gate and match times to be confirmed.', ARRAY['rugby','sevens','svns','blitzboks'], 'DHL Stadium', 'Green Point, Cape Town', 'Cape Town', -33.90333, 18.41111, DATE '2026-12-05', NULL, DATE '2026-12-06', 'https://www.svns.com', 'From R180'),
  ('Challenge Cup: Sharks v Scarlets', 'EPCR Challenge Cup pool match at Kings Park.', ARRAY['rugby','challenge cup','epcr'], 'Hollywoodbets Kings Park', 'Stamford Hill, Durban', 'Durban', -29.82500, 31.02972, DATE '2026-12-12', '19:30', NULL, 'https://sharksrugby.co.za/pages/fixtures', 'Paid'),
  ('URC: Sharks v Bulls', 'Vodacom United Rugby Championship — SA derby at Kings Park.', ARRAY['rugby','urc','derby'], 'Hollywoodbets Kings Park', 'Stamford Hill, Durban', 'Durban', -29.82500, 31.02972, DATE '2026-12-19', '18:30', NULL, 'https://sharksrugby.co.za/pages/fixtures', 'Paid'),
  ('URC: Stormers v Lions', 'Vodacom United Rugby Championship — SA derby in Cape Town. Kick-off to be confirmed.', ARRAY['rugby','urc','derby'], 'DHL Stadium', 'Green Point, Cape Town', 'Cape Town', -33.90333, 18.41111, DATE '2026-12-19', NULL, NULL, 'https://stormers.co.za/tickets-hub/', 'Paid'),
  ('URC: Sharks v Lions', 'Vodacom United Rugby Championship — SA derby at Kings Park.', ARRAY['rugby','urc','derby'], 'Hollywoodbets Kings Park', 'Stamford Hill, Durban', 'Durban', -29.82500, 31.02972, DATE '2027-01-02', '17:00', NULL, 'https://sharksrugby.co.za/pages/fixtures', 'Paid'),
  ('URC: Stormers v Bulls', 'Vodacom United Rugby Championship — the North-South derby in Cape Town.', ARRAY['rugby','urc','derby'], 'DHL Stadium', 'Green Point, Cape Town', 'Cape Town', -33.90333, 18.41111, DATE '2027-01-03', '16:00', NULL, 'https://stormers.co.za/tickets-hub/', 'Paid'),
  ('Champions Cup: Bulls v Bath', 'Investec Champions Cup pool match at Loftus.', ARRAY['rugby','champions cup','epcr'], 'Loftus Versfeld', 'Arcadia, Pretoria', 'Pretoria', -25.75333, 28.22278, DATE '2027-01-09', '17:15', NULL, 'https://tickets.bullsrugby.co.za/', 'Paid'),
  -- ── Golf, racing, motorsport ──────────────────────────────────────────
  ('Nedbank Golf Challenge 2026', 'DP World Tour event at the Gary Player Country Club, Sun City. Four rounds, 3–6 December.', ARRAY['golf','dp world tour','nedbank'], 'Gary Player Country Club', 'Sun City Resort, North West', 'Sun City', -25.34577, 27.09887, DATE '2026-12-03', NULL, DATE '2026-12-06', 'https://nedbankgolfchallenge.com', 'Paid'),
  ('Betway Summer Cup 2026', 'Grade 1 Summer Cup race day at Turffontein, one of Johannesburg''s biggest days at the races.', ARRAY['horse racing','summer cup'], 'Turffontein Racecourse', '14 Turf Club Street, Turffontein, Johannesburg', 'Johannesburg', -26.23806, 28.04694, DATE '2026-11-28', NULL, NULL, 'https://www.summercup.co.za', 'Paid'),
  ('L''Ormarins King''s Plate 2027', 'The 166th King''s Plate race day at Kenilworth, Cape Town.', ARRAY['horse racing','kings plate'], 'Hollywoodbets Kenilworth Racecourse', 'Kenilworth, Cape Town', 'Cape Town', -33.99861, 18.47972, DATE '2027-01-09', NULL, NULL, 'https://lormarinskingsplate.co.za', 'Paid'),
  ('Nine Hours of Kyalami', 'South African Endurance Series season finale at Kyalami, 13–14 November, with support races.', ARRAY['motorsport','endurance','kyalami'], 'Kyalami Grand Prix Circuit', 'Kyalami, Midrand', 'Midrand', -25.99806, 28.06889, DATE '2026-11-13', NULL, DATE '2026-11-14', 'https://www.saeseries.com', 'Paid')
)
INSERT INTO public.events (
  author_id, title, description, category, tags, venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude, event_date, event_time, end_date, ticket_url, price, is_paid, is_published
)
SELECT g.id, fx.title, fx.description, 'sport', fx.tags, fx.venue_name, fx.address, fx.city, 'ZA', 'Africa/Johannesburg',
       fx.lat, fx.lon, fx.lat, fx.lon, fx.event_date, fx.event_time, fx.end_date, fx.ticket_url, fx.price, false, true
FROM fx CROSS JOIN gruvs g
WHERE NOT EXISTS (
  SELECT 1 FROM public.events e
  WHERE e.author_id = g.id AND e.title = fx.title AND e.event_date = fx.event_date AND e.deleted_at IS NULL
)
RETURNING id, title, event_date;
