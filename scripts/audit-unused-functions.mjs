#!/usr/bin/env node
/**
 * audit-unused-functions.mjs — database functions nothing calls.
 *
 * The reverse of rpc-audit.js (which finds calls with no definition). Every
 * function the app never calls is still callable by anyone signed in, unless
 * it was revoked. A SECURITY DEFINER one runs with the owner's rights, so an
 * unused one is an attack surface with no product benefit.
 *
 * "Used" means the name appears anywhere outside its own CREATE FUNCTION
 * statement: app code (src/), Edge Functions, scripts, or other SQL (trigger
 * bindings, cron jobs, other functions). That is generous on purpose: a false
 * "unused" leads to dropping a live function; a false "used" costs nothing.
 *
 * It reads repo files only. The live database may have functions the repo
 * doesn't know about; list those with the query in the runbook.
 *
 * Usage: node scripts/audit-unused-functions.mjs [--json]
 * Report only. Never exits non-zero, and never drops anything: review each one first.
 */
import fs from 'node:fs';
import path from 'node:path';

const asJson = process.argv.includes('--json');
const SKIP_DIRS = new Set(['node_modules', '.git', 'archive', 'dist', 'build', 'android', 'ios']);

function walk(dir, exts, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, acc);
    else if (exts.some((x) => e.name.endsWith(x))) acc.push(p);
  }
  return acc;
}

// Tests and generated contract checks mention function names without calling them.
const NOT_A_CALLER = /(^|\/)(supabase\/test\/|__tests__\/)|APP_DB_CONTRACT_CHECK\.sql$/;

const sqlFiles = walk('supabase', ['.sql']);
const codeFiles = [
  ...walk('src', ['.js', '.jsx', '.ts', '.tsx']),
  ...walk('supabase/functions', ['.ts', '.js']),
  ...walk('scripts', ['.js', '.mjs', '.sql']),
  ...walk('app', ['.js', '.jsx', '.ts', '.tsx']),
].filter((f) => !f.endsWith('audit-unused-functions.mjs'));

const createRe = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(([\s\S]*?)\$([a-z_]*)\$([\s\S]*?)\$\3\$/gi;

const defs = new Map(); // name -> { files:Set, definer:boolean }
const bodies = [];      // SQL with every CREATE FUNCTION header removed, bodies kept
for (const f of sqlFiles) {
  const sql = fs.readFileSync(f, 'utf8');
  if (NOT_A_CALLER.test(f)) continue;
  let stripped = sql;
  for (const m of sql.matchAll(createRe)) {
    const name = m[1].toLowerCase();
    if (!/\bpublic\.|create\s+(or\s+replace\s+)?function\s+"?[a-z]/i.test(m[0])) continue;
    const d = defs.get(name) || { files: new Set(), definer: false };
    d.files.add(f);
    if (/security\s+definer/i.test(m[0] + sql.slice(m.index + m[0].length, m.index + m[0].length + 200))) d.definer = true;
    defs.set(name, d);
    // Keep the body (it may call other functions), drop the name in the header.
    stripped = stripped.replace(m[0], m[4]);
  }
  bodies.push(stripped);
}

const haystack = [
  ...bodies,
  ...codeFiles.filter((f) => !NOT_A_CALLER.test(f)).map((f) => fs.readFileSync(f, 'utf8')),
].join('\n').toLowerCase();

// Trigger functions are "called" by CREATE TRIGGER … EXECUTE FUNCTION name(),
// which lives in the SQL haystack already, so they need no special case.
const unused = [];
for (const [name, d] of defs) {
  const re = new RegExp(`(?<![a-z0-9_])${name}(?![a-z0-9_])`);
  if (!re.test(haystack)) unused.push({ name, definer: d.definer, files: [...d.files].sort() });
}
unused.sort((a, b) => (b.definer - a.definer) || a.name.localeCompare(b.name));

if (asJson) {
  console.log(JSON.stringify({ defined: defs.size, unused }, null, 2));
} else {
  const definer = unused.filter((u) => u.definer);
  console.log(`${defs.size} functions defined in supabase/ · ${unused.length} referenced nowhere else\n`);
  if (definer.length) {
    console.log(`SECURITY DEFINER and unused (${definer.length}): review first; each runs with owner rights`);
    for (const u of definer) console.log(`  ${u.name.padEnd(42)} ${u.files[0]}`);
    console.log('');
  }
  const rest = unused.filter((u) => !u.definer);
  if (rest.length) {
    console.log(`Unused, invoker rights (${rest.length}): lower risk; candidates for cleanup`);
    for (const u of rest) console.log(`  ${u.name.padEnd(42)} ${u.files[0]}`);
  }
  console.log('\nBefore dropping any: confirm on live with');
  console.log("  select proname, prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname = '<name>';");
  console.log('and check pg_cron (select * from cron.job) and Edge Function source for callers.');
}
