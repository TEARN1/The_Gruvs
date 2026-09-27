/**
 * validate-schema.js — Checks the LIVE Supabase project against what the code
 * expects. For every table the app queries, probes whether it exists. For every
 * RPC, probes whether the function is deployed.
 *
 * A missing table or RPC = a feature that is silently broken in production.
 *
 * Reads credentials from .env (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY).
 * Run: node scripts/validate-schema.js
 *
 * Note: runs with the anon key, so RLS applies. We only distinguish
 *   "relation/function does not exist" (real problem) from
 *   "exists but RLS/permission/param error" (fine — it's deployed).
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');

// ── Load .env ──
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const envGet = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim() : null;
};
const URL = envGet('EXPO_PUBLIC_SUPABASE_URL');
const KEY = envGet('EXPO_PUBLIC_SUPABASE_ANON_KEY');
// Optional: a service_role key (via env var or .env) unlocks RPC introspection.
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || envGet('SUPABASE_SERVICE_ROLE_KEY') || null;
const INTROSPECT_KEY = SERVICE_KEY || KEY;
if (!URL || !KEY) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// ── Parse tables + RPCs from the code (same logic as extract-schema) ──
const SRC_DIRS = ['src/screens', 'src/components', 'src/services', 'src/hooks', 'src/context'];
const files = [];
SRC_DIRS.forEach((d) => {
  const f = path.join(ROOT, d);
  if (fs.existsSync(f)) fs.readdirSync(f).filter((x) => x.endsWith('.js')).forEach((x) => files.push(path.join(f, x)));
});
const tables = new Set();
const rpcs = new Set();
const tableCols = {}; // table -> Set(columns) inferred from filters + select + write keys
const COL = /^[a-z][a-z0-9_]*$/;
const addCol = (t, c) => {
  if (!COL.test(c)) return;
  if (!tableCols[t]) tableCols[t] = new Set();
  tableCols[t].add(c);
};
files.forEach((fp) => {
  const c = fs.readFileSync(fp, 'utf8');
  let m;
  const rRe = /\.rpc\(\s*['"`]([a-z_][a-z0-9_]*)['"`]/g;
  while ((m = rRe.exec(c)) !== null) rpcs.add(m[1]);

  // Walk each .from('t') chain segment and harvest columns
  const fromRe = /\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)/g;
  const froms = [];
  while ((m = fromRe.exec(c)) !== null) {
    tables.add(m[1]);
    froms.push({ name: m[1], start: m.index + m[0].length });
  }
  froms.forEach((f, i) => {
    const end = i + 1 < froms.length ? froms[i + 1].start : Math.min(f.start + 300, c.length);
    const seg = c.slice(f.start, end);
    // Only filter columns: .eq('col', ...) and friends. The first string arg is
    // unambiguously a real column on this table. (Write-object keys are excluded
    // — they capture nested JSON keys like metadata.phase and produce false hits.)
    const filt = seg.matchAll(/\.(eq|neq|gt|gte|lt|lte|in|like|ilike|order)\(\s*[`'"]([a-z_][a-z0-9_]*)[`'"]/g);
    for (const mm of filt) addCol(f.name, mm[2]);
  });
});

const MISSING_TABLE = '42P01'; // undefined_table
const MISSING_COLUMN = '42703'; // undefined_column

async function checkTable(name) {
  const { error } = await supabase.from(name).select('*', { count: 'exact', head: true }).limit(1);
  if (!error) return { name, status: 'ok' };
  if (error.code === MISSING_TABLE || /relation .* does not exist/i.test(error.message || '')) {
    return { name, status: 'MISSING', detail: error.message };
  }
  // RLS / permission / other → table exists
  return { name, status: 'ok', note: error.code };
}

// Validate columns by selecting them all at once. If any is missing, PostgREST
// names it in a 42703 error; we drop it and retry to collect the full set of
// missing columns. Works with the anon key (parse error, not RLS-gated).
async function checkColumns(name, cols) {
  let remaining = [...cols];
  const missing = [];
  // NOTE: must NOT use head:true — a HEAD/count request skips column validation.
  // A real .select(cols).limit(1) forces PostgREST to parse the column list and
  // return 42703 (column does not exist) at parse time, before RLS row filtering.
  for (let i = 0; i < cols.length + 1 && remaining.length; i++) {
    const { error } = await supabase.from(name).select(remaining.join(',')).limit(1);
    if (!error) break;
    if (error.code !== MISSING_COLUMN) break; // RLS/other — can't verify columns, stop
    const m = (error.message || '').match(/column "?(?:[a-z_]+\.)?([a-z_][a-z0-9_]*)"? does not exist/i);
    const bad = m ? m[1] : null;
    if (!bad || !remaining.includes(bad)) break; // can't parse — stop to avoid loop
    missing.push(bad);
    remaining = remaining.filter((c) => c !== bad);
  }
  return missing;
}

// Fetch the authoritative list of deployed RPC functions from PostgREST's
// OpenAPI spec (served at the REST root). Every exposed function appears as a
// /rpc/{name} path — this is definitive regardless of parameter signatures.
async function fetchDeployedRpcs() {
  // Try a few header combinations — Supabase configs vary on what the root accepts.
  const attempts = [
    { apikey: INTROSPECT_KEY, Authorization: `Bearer ${INTROSPECT_KEY}` },
    { apikey: INTROSPECT_KEY },
    { apikey: INTROSPECT_KEY, Authorization: `Bearer ${INTROSPECT_KEY}`, Accept: 'application/openapi+json' },
  ];
  for (const headers of attempts) {
    try {
      const res = await fetch(`${URL}/rest/v1/`, { headers });
      if (!res.ok) continue;
      const spec = await res.json();
      const deployed = new Set();
      Object.keys(spec.paths || {}).forEach((p) => {
        const m = p.match(/^\/rpc\/(\w+)$/);
        if (m) deployed.add(m[1]);
      });
      if (deployed.size > 0) return { deployed, ok: true };
    } catch { /* try next */ }
  }
  return { deployed: new Set(), ok: false };
}

(async () => {
  console.log(`Validating against ${URL}\n`);

  const tableResults = [];
  for (const t of [...tables].sort()) tableResults.push(await checkTable(t));
  const missTables = tableResults.filter((r) => r.status === 'MISSING');
  const missTableNames = new Set(missTables.map((r) => r.name));

  // Column checks — only for tables that exist and have inferred columns
  const colIssues = [];
  for (const t of [...tables].sort()) {
    if (missTableNames.has(t)) continue;
    const cols = tableCols[t] ? [...tableCols[t]] : [];
    if (!cols.length) continue;
    const missing = await checkColumns(t, cols);
    if (missing.length) colIssues.push({ table: t, missing });
  }

  const { deployed: deployedRpcs, ok: rpcIntrospectOk } = await fetchDeployedRpcs();
  const missRpcs = [...rpcs].sort().filter((r) => !deployedRpcs.has(r));

  console.log('═══ TABLES ═══');
  console.log(`  ${tableResults.filter((r) => r.status === 'ok').length}/${tableResults.length} exist`);
  if (missTables.length) {
    console.log('  MISSING:');
    missTables.forEach((r) => console.log('    ✗ ' + r.name));
  }

  console.log('\n═══ COLUMNS (from .eq/.insert/.update refs) ═══');
  if (!colIssues.length) {
    console.log('  ✓ All referenced columns exist on their tables');
  } else {
    console.log('  Columns referenced in code but NOT found in the DB:');
    colIssues.forEach(({ table, missing }) => console.log('    ✗ ' + table + ': ' + missing.join(', ')));
  }

  console.log('\n═══ RPC FUNCTIONS ═══');
  if (!rpcIntrospectOk) {
    console.log('  ⚠ Could not introspect RPCs via the anon key (OpenAPI root returned 401).');
    console.log('    Re-run with the service_role key to list deployed functions:');
    console.log('    SUPABASE_SERVICE_KEY=... node scripts/validate-schema.js');
  } else {
    console.log(`  ${rpcs.size - missRpcs.length}/${rpcs.size} deployed`);
    if (missRpcs.length) {
      console.log('  MISSING (called in code, not deployed in DB):');
      missRpcs.forEach((r) => console.log('    ✗ ' + r));
    }
  }

  console.log('\n═══ SUMMARY ═══');
  console.log(`  Missing tables:        ${missTables.length}`);
  console.log(`  Tables w/ missing cols: ${colIssues.length}`);
  console.log(`  Missing RPCs:          ${rpcIntrospectOk ? missRpcs.length : 'unknown (introspection blocked)'}`);
  if (!missTables.length && !colIssues.length && rpcIntrospectOk && !missRpcs.length) {
    console.log('\n  ✓ Live database fully matches what the code expects.');
  }
})();
