const fs = require('fs');
const path = require('path');

const AUTHOR_ID = 'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c';

function sqlEsc(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function isValidFlyer(url) {
  if (!url) return false;
  if (url.includes('/images/dates/')) return false;
  if (url.includes('gravatar.com')) return false;
  if (url.includes('placeholder')) return false;
  if (url.includes('default')) return false;
  return (url.includes('/banners/') || url.includes('/thumbs/thumb'));
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

async function run() {
  const rawCandidates = JSON.parse(fs.readFileSync('scripts/candidates.json', 'utf-8'));
  const targetMonths = ['2026-12', '2027-01', '2027-02'];

  const selectedEvents = [];
  const seenTitles = new Set();

  for (const m of targetMonths) {
    const monthPool = (rawCandidates[m] || []).filter(e => isValidFlyer(e.cover_url));

    // Sort: Business/Entrepreneurship first, then chronologically by event_date
    monthPool.sort((a, b) => {
      const aBiz = a.category === 'Entrepreneurship & Business';
      const bBiz = b.category === 'Entrepreneurship & Business';
      if (aBiz && !bBiz) return -1;
      if (!aBiz && bBiz) return 1;
      return a.event_date.localeCompare(b.event_date);
    });

    const chosenForMonth = [];
    for (const cand of monthPool) {
      const key = `${cand.title.trim().toLowerCase()}|${cand.event_date}`;
      if (seenTitles.has(key)) continue;

      chosenForMonth.push(cand);
      seenTitles.add(key);
      if (chosenForMonth.length === 20) break;
    }

    console.log(`Month ${m}: Picked ${chosenForMonth.length} events (Business: ${chosenForMonth.filter(e => e.category === 'Entrepreneurship & Business').length})`);
    selectedEvents.push(...chosenForMonth);
  }

  console.log(`Total events to seed: ${selectedEvents.length}`);

  const sqlLines = [
    '-- =====================================================================',
    '-- SEED 60 REAL GAUTENG EVENTS WITH AUTHENTIC PROMOTIONAL POSTERS',
    '-- 20 Dec 2026, 20 Jan 2027, 20 Feb 2027',
    '-- =====================================================================',
    'BEGIN;',
    ''
  ];

  for (const ev of selectedEvents) {
    const baseSlug = slugify(ev.title).slice(0, 50);
    const slug = `${baseSlug}-${ev.event_id || Math.floor(Math.random() * 1000000)}`;
    const lat = ev.latitude || -26.2041;
    const lon = ev.longitude || 28.0473;
    const img = ev.cover_url;

    // Use INSERT ... ON CONFLICT or check
    sqlLines.push(`
INSERT INTO public.events (
  author_id,
  user_id,
  title,
  description,
  category,
  categories,
  location,
  venue_name,
  address,
  city,
  country,
  latitude,
  longitude,
  lat,
  lon,
  event_date,
  event_time,
  date_time,
  starts_at,
  cover_url,
  cover_image,
  image_url,
  media_urls,
  ticket_url,
  price,
  is_paid,
  contact_phone,
  contact_email,
  is_published,
  status,
  is_featured,
  is_cancelled,
  is_hidden,
  is_deleted,
  is_archived,
  slug,
  timezone,
  created_at,
  updated_at
) VALUES (
  ${sqlEsc(AUTHOR_ID)},
  ${sqlEsc(AUTHOR_ID)},
  ${sqlEsc(ev.title)},
  ${sqlEsc(ev.description)},
  ${sqlEsc(ev.category)},
  ARRAY[${sqlEsc(ev.category)}]::text[],
  ${sqlEsc(`${ev.venue_name}, ${ev.city}`)},
  ${sqlEsc(ev.venue_name)},
  ${sqlEsc(ev.address)},
  ${sqlEsc(ev.city)},
  'South Africa',
  ${lat},
  ${lon},
  ${lat},
  ${lon},
  '${ev.event_date}'::date,
  '${ev.event_time}',
  '${ev.date_time}'::timestamptz,
  '${ev.starts_at}'::timestamptz,
  ${sqlEsc(img)},
  ${sqlEsc(img)},
  ${sqlEsc(img)},
  ARRAY[${sqlEsc(img)}]::text[],
  ${sqlEsc(ev.ticket_url)},
  ${sqlEsc(ev.price)},
  ${ev.is_paid ? 'true' : 'false'},
  '+27 11 888 2000',
  'events@thegruvs.com',
  true,
  'published',
  false,
  false,
  false,
  false,
  false,
  ${sqlEsc(slug)},
  'Africa/Johannesburg',
  NOW(),
  NOW()
);`);
  }

  sqlLines.push('');
  sqlLines.push('-- Ensure trigger-reset fields are explicitly published');
  sqlLines.push(`
UPDATE public.events
SET is_published = true, status = 'published'
WHERE author_id = '${AUTHOR_ID}'
  AND deleted_at IS NULL;
`);
  sqlLines.push('COMMIT;');

  const outPath = path.join(__dirname, '..', 'supabase', 'seed_real_gauteng_60_events.sql');
  fs.writeFileSync(outPath, sqlLines.join('\n'), 'utf-8');
  console.log(`Generated ${outPath} successfully.`);
}

run();
