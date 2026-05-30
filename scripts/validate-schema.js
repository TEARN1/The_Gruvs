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
files.forEach((fp) => {
  const c = fs.readFileSync(fp, 'utf8');
  let m;
  const tRe = /\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)/g;
  while ((m = tRe.exec(c)) !== null) tables.add(m[1]);
  const rRe = /\.rpc\(\s*['"`]([a-z_][a-z0-9_]*)['"`]/g;
  while ((m = rRe.exec(c)) !== null) rpcs.add(m[1]);
});

const MISSING_TABLE = '42P01'; // undefined_table

async function checkTable(name) {
  const { error } = await supabase.from(name).select('*', { count: 'exact', head: true }).limit(1);
  if (!error) return { name, status: 'ok' };
  if (error.code === MISSING_TABLE || /relation .* does not exist/i.test(error.message || '')) {
    return { name, status: 'MISSING', detail: error.message };
  }
  // RLS / permission / other → table exists
  return { name, status: 'ok', note: error.code };
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

  const { deployed: deployedRpcs, ok: rpcIntrospectOk } = await fetchDeployedRpcs();
  const missRpcs = [...rpcs].sort().filter((r) => !deployedRpcs.has(r));

  console.log('═══ TABLES ═══');
  console.log(`  ${tableResults.filter((r) => r.status === 'ok').length}/${tableResults.length} exist`);
  if (missTables.length) {
    console.log('  MISSING:');
    missTables.forEach((r) => console.log('    ✗ ' + r.name));
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
  console.log(`  Missing tables: ${missTables.length}`);
  console.log(`  Missing RPCs:   ${rpcIntrospectOk ? missRpcs.length : 'unknown (introspection blocked)'}`);
  if (!missTables.length && rpcIntrospectOk && !missRpcs.length) console.log('\n  ✓ Live database fully matches what the code expects.');
})();
