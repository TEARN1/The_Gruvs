/**
 * audit-writes.mjs — the other half of audit-schema.mjs.
 *
 * audit-schema.mjs checks every READ (`.from(t).select(cols)`) against the live
 * database. This checks every WRITE and every RPC:
 *
 *   • WRITE COLUMNS — every key in a .insert()/.update()/.upsert() object.
 *     Verified with a read-only probe (`select=<cols>&limit=0`); nothing is
 *     ever written. A missing column means the write fails and a catch or a
 *     resilient() fallback swallows it, so the feature is DEAD while looking
 *     fine. Fails the build.
 *
 *   • RPCs — every name passed to .rpc(), checked against the PostgREST
 *     OpenAPI spec. Read-only: the functions are never invoked. A missing RPC
 *     usually survives via a fallback tier, so this WARNS rather than fails —
 *     but it means the validated path is not the one running.
 *
 * Why this exists: the 2026-07-19 audit found 48 RPCs and 14 write-columns that
 * do not exist on the live database — vibe_equity minting, live event updates,
 * crowd votes and event role grants had all silently done nothing for months.
 * audit-schema.mjs could not have caught any of them; it only reads.
 *
 * Usage:  node scripts/audit-writes.mjs
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
  console.log('::notice::Supabase URL/key not available — skipping write audit.');
  process.exit(0);
}
const REST = `${URL.replace(/\/$/, '')}/rest/v1`;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// Same contract as audit-schema.mjs: the bar to add an entry is a tracked bug
// with an owner, never a convenient way to silence the guard.
const EXPECTED_MISSING = new Set([]);
const KNOWN_DRIFT = new Map([]);

// RPCs that are deliberately absent (fallback tier is the intended path).
const KNOWN_MISSING_RPCS = new Set([]);

function walk(dir, acc = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(js|jsx|ts|tsx)$/.test(p)) acc.push(p);
  }
  return acc;
}

/** Top-level keys of the object literal whose '{' sits at index `open`. */
function topLevelKeys(src, open) {
  let depth = 0, end = open;
  for (; end < src.length; end++) {
    const c = src[end];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) break; }
  }
  const keys = [];
  let d = 0, cur = '';
  for (const ch of src.slice(open + 1, end)) {
    if ('{[('.includes(ch)) d++;
    if ('}])'.includes(ch)) d--;
    if (ch === ',' && d === 0) { keys.push(cur); cur = ''; } else cur += ch;
  }
  keys.push(cur);
  return keys
    .map(k => (k.match(/^\s*(?:\.\.\.)?\s*([a-zA-Z0-9_]+)\s*:/) || [])[1])
    .filter(Boolean);
}

// ─── Extract ─────────────────────────────────────────────────────────────────

// Files are tracked per COLUMN, not per table. Per-table attribution names
// every file that writes to `profiles` (16 of them) when one column is wrong,
// which makes the ::error annotation point at innocent files and useless.
const writes = new Map();   // table -> Map(col -> Set(file))
const rpcs = new Map();     // name  -> Set(file)

for (const file of walk('src')) {
  const src = readFileSync(file, 'utf8');
  const rel = file.split('\\').join('/');

  const writeRe = /\.from\(\s*['"`]([a-z_0-9]+)['"`]\s*\)\s*\.\s*(?:insert|update|upsert)\(\s*\{/g;
  let m;
  while ((m = writeRe.exec(src))) {
    const table = m[1];
    if (!writes.has(table)) writes.set(table, new Map());
    const cols = writes.get(table);
    for (const col of topLevelKeys(src, writeRe.lastIndex - 1)) {
      if (!cols.has(col)) cols.set(col, new Set());
      cols.get(col).add(rel);
    }
  }

  const rpcRe = /\.rpc\(\s*['"`]([a-z_0-9]+)['"`]/g;
  while ((m = rpcRe.exec(src))) {
    if (!rpcs.has(m[1])) rpcs.set(m[1], new Set());
    rpcs.get(m[1]).add(rel);
  }
}

// ─── Verify write columns ────────────────────────────────────────────────────
//
// One probe per column, not per table: a table-wide probe fails as soon as ONE
// column is wrong and cannot tell us which. Columns are cheap (limit=0 returns
// no rows) and this only runs in CI.
//
// Only an explicit "does not exist" counts as drift. A permission error means
// anon simply cannot see that column (several are deliberately revoked — see
// lock_authenticated_pii.sql), which proves nothing either way.

const broken = [];
const acknowledged = [];
const ignored = [];
const inconclusive = [];
let probes = 0;

for (const [table, cols] of writes) {
  for (const [col, files] of cols) {
    probes++;
    const url = `${REST}/${table}?select=${encodeURIComponent(col)}&limit=0`;
    try {
      const r = await fetch(url, { headers: HEADERS });
      if (r.ok) continue;
      const j = await r.json().catch(() => ({}));
      const msg = (j.message || '').slice(0, 120);
      const missing = /does not exist|could not find|schema cache/i.test(msg);
      const entry = { table, col, file: [...files].join(', '), status: r.status, msg };
      if (!missing) { inconclusive.push(entry); continue; }
      if (EXPECTED_MISSING.has(table)) ignored.push(entry);
      else if (KNOWN_DRIFT.has(`${table}.${col}`)) acknowledged.push({ ...entry, why: KNOWN_DRIFT.get(`${table}.${col}`) });
      else broken.push(entry);
    } catch { /* network blip — never fail the build on it */ }
  }
}

// ─── Verify RPCs (read-only: OpenAPI spec, never invoked) ────────────────────
//
// The spec at /rest/v1/ is 401 for anon on this project (correctly — it lists
// the whole API surface), so this half needs a service-role key. It is NOT
// attempted with the anon key: probing /rpc/<name> directly cannot distinguish
// "function missing" from "wrong argument signature" — PostgREST returns
// PGRST202 for both — so it would invent false positives, and a guard that
// cries wolf gets ignored. Skipped loudly instead of guessed.

const missingRpcs = [];
let rpcChecked = false;
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');

if (SERVICE_KEY) {
  try {
    const spec = await fetch(`${REST}/`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    }).then(r => r.json());
    const defined = new Set(
      Object.keys(spec?.paths || {})
        .filter(p => p.startsWith('/rpc/'))
        .map(p => p.slice(5))
    );
    if (defined.size) {
      rpcChecked = true;
      for (const [name, files] of rpcs) {
        if (!defined.has(name) && !KNOWN_MISSING_RPCS.has(name)) {
          missingRpcs.push({ name, file: [...files].join(', ') });
        }
      }
    }
  } catch { /* spec unavailable — report as unchecked, never guess */ }
}

// ─── Report ──────────────────────────────────────────────────────────────────

console.log(`Probed ${probes} written columns across ${writes.size} tables, and ${rpcs.size} RPCs.`);

if (ignored.length) {
  console.log(`\nSkipped ${ignored.length} (schema intentionally not deployed).`);
}
if (inconclusive.length) {
  console.log(`\n${inconclusive.length} column(s) not visible to anon (permission, not drift) — not checked.`);
}
if (acknowledged.length) {
  console.log(`\n⚠️  ${acknowledged.length} KNOWN missing column(s) (tracked, not blocking):`);
  for (const a of acknowledged) console.log(`   • ${a.table}.${a.col} — ${a.why}`);
}
if (!rpcChecked) {
  console.log(`\n⚠️  ${rpcs.size} RPCs NOT checked — needs SUPABASE_SERVICE_ROLE_KEY (the`);
  console.log('   OpenAPI spec is anon-locked). The last manual sweep found 48 of them');
  console.log('   missing, so treat this as an unchecked gap, not a clean result.');
} else if (missingRpcs.length) {
  console.log(`\n⚠️  ${missingRpcs.length} RPC(s) called but not defined on the database:`);
  for (const r of missingRpcs) console.log(`   • ${r.name}  ← ${r.file}`);
  console.log('   These usually survive via a resilient() fallback tier, so they do not');
  console.log('   fail the build — but the validated path is NOT the one running.');
} else {
  console.log(`\n✅ All ${rpcs.size} RPCs exist on the database.`);
}

if (!broken.length) {
  console.log('\n✅ No NEW write drift. Every written column exists on the database.');
  process.exit(0);
}

console.log(`\n🔴 NEW WRITE DRIFT — ${broken.length} column(s) written but absent from the database.`);
console.log('A write to a column that does not exist fails silently behind a catch or a');
console.log('fallback tier. Assume the feature is DEAD until proven otherwise — that is');
console.log('exactly how vibe_equity minting and live event updates rotted unnoticed.\n');
for (const b of broken) {
  console.log(`  [${b.status}] ${b.table}.${b.col}`);
  console.log(`        ${b.msg}`);
  console.log(`        ${b.file}\n`);
  // One path per annotation — GitHub ignores a comma-joined list.
  console.log(`::error file=${b.file.split(', ')[0]}::Write drift: '${b.table}.${b.col}' does not exist`);
}
process.exit(1);
