/**
 * backfill-geocodes.mjs — give every event a map pin.
 *
 * Older events were posted before geocoding was reliable (Expo's geocoder
 * doesn't exist on web, so web-posted events saved null lat/lon). Those events
 * have a real address but no coordinates, so they never appear on the map. This
 * one-off, idempotent backfill geocodes each such event's address via Nominatim
 * (free, keyless) and writes lat/lon. New events already geocode on post
 * (services/geocoding.js), so this only ever has to clear the historical backlog.
 *
 * Run:  SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-geocodes.mjs
 *   (service role is required — it updates events you don't own. Never ship this
 *    key to the client; it's a local/admin script only.)
 *
 * Safe to re-run: it only touches rows where lat/lon are still null.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://feevvddvrjmfbhffccbf.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY (admin key) to run the backfill.'); process.exit(1); }

const db = createClient(URL, KEY, { auth: { persistSession: false } });
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(query) {
  try {
    const res = await fetch(`${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1`, {
      headers: { Accept: 'application/json', 'User-Agent': 'TheGruvs-backfill/1.0 (admin script)' },
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.length) return null;
    const lat = parseFloat(j[0].lat), lon = parseFloat(j[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) return null; // null-island guard
    return { lat, lon };
  } catch { return null; }
}

const main = async () => {
  const { data, error } = await db
    .from('events')
    .select('id, title, address, city')
    .is('deleted_at', null)
    .or('lat.is.null,lon.is.null')
    .not('address', 'is', null);
  if (error) { console.error('Query failed:', error.message); process.exit(1); }

  const rows = (data || []).filter((e) => (e.address || '').trim().length > 3);
  console.log(`Found ${rows.length} events missing coordinates.\n`);

  let fixed = 0, skipped = 0;
  for (const e of rows) {
    // Try "address, city" first, then the address alone (city can be wrong/noisy).
    const q1 = [e.address, e.city].filter(Boolean).join(', ');
    let hit = await geocode(q1);
    await sleep(1100); // Nominatim: ~1 req/s
    if (!hit && e.city) { hit = await geocode(e.address); await sleep(1100); }

    if (!hit) { skipped++; console.log(`  ✗ ${e.title?.slice(0, 48)} — no match`); continue; }
    const { error: upErr } = await db.from('events').update({ lat: hit.lat, lon: hit.lon }).eq('id', e.id);
    if (upErr) { skipped++; console.log(`  ✗ ${e.title?.slice(0, 48)} — update failed: ${upErr.message}`); continue; }
    fixed++; console.log(`  ✓ ${e.title?.slice(0, 48)} → ${hit.lat.toFixed(4)}, ${hit.lon.toFixed(4)}`);
  }
  console.log(`\nDone. ${fixed} geocoded, ${skipped} skipped (bad/ambiguous address — fix by hand).`);
};

main();
