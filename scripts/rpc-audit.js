#!/usr/bin/env node
/**
 * rpc-audit.js — find RPCs the client calls that the repo's SQL never defines.
 *
 * Why this exists: `npm run audit:writes` checks written COLUMNS but skips RPCs
 * entirely without a service-role key (the OpenAPI spec is anon-locked). Two
 * separate sweeps have found ~half the RPCs unaccounted for, and a missing RPC
 * fails silently behind a `catch` or a fallback tier — which is exactly how
 * `create_user_profile` sat broken while every signup silently lost its data.
 *
 * This needs NO database connection: it cross-references call sites against
 * `CREATE FUNCTION` statements in `supabase/`.
 *
 * IMPORTANT — two different failure modes, and this script cannot tell them apart:
 *   1. Genuinely absent from the live DB  -> the feature is dead or degraded.
 *   2. Present on live but never committed -> works today, but a rebuild loses it
 *      and nobody can review it. Applying SQL straight to live via MCP without
 *      saving the file is how this happens.
 * Both are real problems. Confirm against live with:
 *   select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 *   where n.nspname='public';
 *
 * Severity is split by whether the call is the SOLE path or one tier of a
 * `resilient([...])` cascade — a missing tier-3 fallback is noise if tier 1
 * works; a missing sole path is a dead feature.
 *
 * Usage:  node scripts/rpc-audit.js [--json]
 * Exits 1 when any SOLE-PATH rpc is undefined, so CI can gate on it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const asJson = process.argv.includes('--json');

// ── Functions the repo's SQL defines ────────────────────────────────────────
const defined = new Set();
(function walkSql(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walkSql(p); continue; }
    if (!/\.sql$/.test(e.name)) continue;
    const src = fs.readFileSync(p, 'utf8');
    const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?["']?([a-zA-Z0-9_]+)/gi;
    let m;
    while ((m = re.exec(src))) defined.add(m[1]);
  }
})(path.join(ROOT, 'supabase'));

// ── Call sites ──────────────────────────────────────────────────────────────
const sole = [];
const tiered = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(js|jsx|ts|tsx)$/.test(e.name)) continue;
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    const rel = path.relative(ROOT, p).split(path.sep).join('/');
    lines.forEach((line, i) => {
      const re = /\.rpc\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g;
      let m;
      while ((m = re.exec(line))) {
        const name = m[1];
        if (defined.has(name)) continue;
        // A cascade tier looks like: resilient([ () => …, () => supabase.rpc(…) ])
        const back = lines.slice(Math.max(0, i - 20), i).join('\n');
        const inCascade = /resilient\(|attemptWithBackoff\(/.test(back);
        const siblings = (back.match(/\(\)\s*=>/g) || []).length;
        (inCascade && siblings >= 1 ? tiered : sole).push({ name, at: `${rel}:${i + 1}` });
      }
    });
  }
})(path.join(ROOT, 'src'));

const uniq = (arr) => {
  const seen = new Map();
  for (const r of arr) if (!seen.has(r.name)) seen.set(r.name, r);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
};
// A name that appears anywhere as a cascade tier isn't a sole path.
const tierU = uniq(tiered);
const soleU = uniq(sole).filter((r) => !tierU.some((t) => t.name === r.name));

if (asJson) {
  console.log(JSON.stringify({ solePath: soleU, fallbackTier: tierU }, null, 2));
} else {
  console.log(`\nRPCs undefined in repo SQL — ${soleU.length} sole-path, ${tierU.length} fallback-tier.\n`);
  console.log('🔴 SOLE PATH — no fallback, so a missing function means the feature is dead:');
  soleU.forEach((r) => console.log(`   ${r.name.padEnd(34)} ${r.at}`));
  console.log('\n🟡 FALLBACK TIER — inside resilient(); degrades rather than dies:');
  tierU.forEach((r) => console.log(`   ${r.name.padEnd(34)} ${r.at}`));
  console.log(
    '\nNote: "undefined in repo SQL" is not the same as "absent from the live DB".\n' +
    'Some of these exist on live but were applied without committing the file —\n' +
    'still a problem (a rebuild loses them), just a different one.\n'
  );
}

process.exit(soleU.length > 0 ? 1 : 0);
