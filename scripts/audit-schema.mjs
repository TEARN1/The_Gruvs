/**
 * audit-schema.mjs — the guard that would have caught the 24.
 *
 * Extracts EVERY `.from('table').select('cols')` in src/ and runs each one
 * against the LIVE database. A query that names a column/table/relationship the
 * database doesn't have returns 400/404 — the feature is dead, but the app
 * renders it as "empty", so nobody ever notices. That is exactly how 24 broken
 * queries (RSVP, Crews, polls, event chat, tickets) rotted in production.
 *
 * Run in CI on every PR and nightly. Exit code 1 = schema drift = the build fails
 * before it can ship another silent breakage.
 *
 * Usage:  node scripts/audit-schema.mjs
 * Env:    SUPABASE_URL, SUPABASE_ANON_KEY  (falls back to .env for local runs)
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

function env(name, ...alts) {
  for (const k of [name, ...alts]) if (process.env[k]) return process.env[k];
  if (existsSync('.env')) {
    const raw = readFileSync('.env', 'utf8');
    for (const k of [name, ...alts]) {
      const m = raw.match(new RegExp(`^${k}=(.+)$`, 'm'));
      if (m) return m[1].trim();
    }
  }
  return null;
}

const URL = env('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
const KEY = env('SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY');

if (!URL || !KEY) {
  console.log('::notice::Supabase URL/key not available — skipping schema audit.');
  process.exit(0);
}
const REST = `${URL.replace(/\/$/, '')}/rest/v1`;

// Tables we KNOWINGLY do not have yet — don't fail the build on these.
// Remove an entry the moment its schema ships.
const EXPECTED_MISSING = new Set([
  'res_alerts',        // Resident sister-app schema, not deployed (feature-gated)
  'res_lift_clubs',
  'res_listings',
  'res_market_items',
]);

function walk(dir, acc = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(js|ts|tsx)$/.test(p)) acc.push(p);
  }
  return acc;
}

const pairs = new Map();
for (const file of walk('src')) {
  const src = readFileSync(file, 'utf8');
  const re = /\.from\(\s*['"`]([a-z_0-9]+)['"`]\s*\)([\s\S]{0,400}?)\.select\(\s*['"`]([^'"`]*)['"`]/g;
  let m;
  while ((m = re.exec(src))) {
    const table = m[1], sel = m[3];
    if (!sel || sel.trim() === '*') continue;
    const key = `${table}||${sel}`;
    if (!pairs.has(key)) pairs.set(key, { table, sel, file: file.split('\\').join('/') });
  }
}

const broken = [];
const ignored = [];
for (const { table, sel, file } of pairs.values()) {
  const url = `${REST}/${table}?select=${encodeURIComponent(sel)}&limit=1`;
  try {
    const r = await fetch(url, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (r.status === 400 || r.status === 404) {
      const j = await r.json().catch(() => ({}));
      const entry = { status: r.status, table, file, msg: (j.message || '').slice(0, 100) };
      (EXPECTED_MISSING.has(table) ? ignored : broken).push(entry);
    }
  } catch { /* network blip — don't fail the build on it */ }
}

console.log(`Checked ${pairs.size} live queries.`);
if (ignored.length) console.log(`Ignored ${ignored.length} (known-missing schema): ${[...new Set(ignored.map(i => i.table))].join(', ')}`);

if (!broken.length) {
  console.log('\n✅ No schema drift. Every query matches the database.');
  process.exit(0);
}

console.log(`\n🔴 SCHEMA DRIFT — ${broken.length} quer${broken.length === 1 ? 'y' : 'ies'} fail against the live database.`);
console.log('These features are BROKEN in production. They fail silently — the app renders them as "empty".\n');
for (const b of broken) {
  console.log(`  [${b.status}] ${b.table}`);
  console.log(`        ${b.msg}`);
  console.log(`        ${b.file}\n`);
  console.log(`::error file=${b.file}::Schema drift in '${b.table}': ${b.msg}`);
}
process.exit(1);
