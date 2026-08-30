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
  // In CI, missing credentials is a BROKEN SENSOR, not a clean run. A watchdog
  // that reports healthy while blindfolded is worse than no watchdog — this
  // exact skip is how drift could sit in production behind a green Guardian.
  if (process.env.CI) {
    console.error('::error::Supabase URL/key missing — the schema sensor cannot see the database.');
    process.exit(1);
  }
  console.log('Supabase URL/key not available — skipping schema audit (local run).');
  process.exit(0);
}
const REST = `${URL.replace(/\/$/, '')}/rest/v1`;

// Tables we KNOWINGLY do not have yet — don't fail the build on these.
// Remove an entry the moment its schema ships.
// (The res_* Resident schema went LIVE 2026-07-17 — those tables were removed
// from here so their genuine disappearance would now correctly fail the guard.)
const EXPECTED_MISSING = new Set([]);

// Known, ACKNOWLEDGED drift with an owner and a plan. These do not fail the
// build (a guard that is always red gets ignored, and then the next real
// breakage sails through). They are still printed loudly on every run.
//
// The bar to add something here is high: it must be a tracked bug, not a
// convenient way to silence the guard.
const KNOWN_DRIFT = new Map([
  // (empty) — every known drift has been fixed. Adding an entry here requires a
  // tracked bug and a plan, never just a way to silence the guard.
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
    const table = m[1], between = m[2], sel = m[3];
    // The lookahead must not run past the END of this query into the next one,
    // or we pair a table with someone else's select (false positives).
    if (/\.from\(/.test(between)) continue;
    if (!sel || sel.trim() === '*') continue;
    const key = `${table}||${sel}`;
    if (!pairs.has(key)) pairs.set(key, { table, sel, file: file.split('\\').join('/') });
  }
}

const broken = [];     // NEW drift — fails the build
const acknowledged = []; // known + tracked — printed, but does not fail
const ignored = [];    // schema deliberately not deployed yet

for (const { table, sel, file } of pairs.values()) {
  const url = `${REST}/${table}?select=${encodeURIComponent(sel)}&limit=1`;
  try {
    const r = await fetch(url, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (r.status === 400 || r.status === 404) {
      const j = await r.json().catch(() => ({}));
      const entry = { status: r.status, table, file, msg: (j.message || '').slice(0, 100) };
      if (EXPECTED_MISSING.has(table)) ignored.push(entry);
      else if (KNOWN_DRIFT.has(table)) acknowledged.push({ ...entry, why: KNOWN_DRIFT.get(table) });
      else broken.push(entry);
    }
  } catch { /* network blip — never fail the build on it */ }
}

console.log(`Checked ${pairs.size} live queries.`);
if (ignored.length) {
  console.log(`\nSkipped ${ignored.length} (schema intentionally not deployed): ${[...new Set(ignored.map(i => i.table))].join(', ')}`);
}
if (acknowledged.length) {
  console.log(`\n⚠️  ${acknowledged.length} KNOWN broken quer${acknowledged.length === 1 ? 'y' : 'ies'} (tracked, not blocking):`);
  for (const a of [...new Map(acknowledged.map(a => [a.table, a])).values()]) {
    console.log(`   • ${a.table} — ${a.why}`);
  }
}

if (!broken.length) {
  console.log('\n✅ No NEW schema drift. Every other query matches the database.');
  process.exit(0);
}

console.log(`\n🔴 NEW SCHEMA DRIFT — ${broken.length} quer${broken.length === 1 ? 'y' : 'ies'} fail against the live database.`);
console.log('This feature is BROKEN in production. It fails SILENTLY — the app renders it as "empty",');
console.log('which is exactly how RSVP, Crews, polls and the ticket system rotted unnoticed.\n');
for (const b of broken) {
  console.log(`  [${b.status}] ${b.table}`);
  console.log(`        ${b.msg}`);
  console.log(`        ${b.file}\n`);
  console.log(`::error file=${b.file}::Schema drift in '${b.table}': ${b.msg}`);
}
process.exit(1);
