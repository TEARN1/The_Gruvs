#!/usr/bin/env node
/**
 * gen-db-contract.mjs — regenerate the app's database contract.
 *
 * Scans the client (and the Edge Functions) for every table it touches and
 * every RPC it calls, then splices those two lists into
 * supabase/queries/APP_DB_CONTRACT_CHECK.sql between the GENERATED markers.
 * The hand-written checks in that file are left alone.
 *
 * The point is that the contract cannot drift: the check the operator runs in
 * the Supabase editor is derived from what the app really needs, not from a
 * list someone maintained by hand and stopped updating.
 *
 * Usage:  npm run audit:contract
 */
import fs from 'node:fs';
import path from 'node:path';

const TARGET = 'supabase/queries/APP_DB_CONTRACT_CHECK.sql';

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})('src');
if (fs.existsSync('App.js')) files.push('App.js');

const rpcs = new Set();
const tables = new Set();

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\.rpc\(\s*['"`]([a-z0-9_]+)/g)) rpcs.add(m[1]);
  for (const m of src.matchAll(/\.from\(\s*['"`]([a-z_]+)['"`]\s*\)/g)) tables.add(m[1]);
}
// Edge Functions read tables with the service role — they are part of the contract too.
const fnDir = 'supabase/functions';
if (fs.existsSync(fnDir)) {
  for (const d of fs.readdirSync(fnDir)) {
    const p = path.join(fnDir, d, 'index.ts');
    if (!fs.existsSync(p)) continue;
    for (const m of fs.readFileSync(p, 'utf8').matchAll(/\.from\(\s*['"`]([a-z_]+)['"`]\s*\)/g)) tables.add(m[1]);
  }
}

const asValues = set => [...set].sort().map(x => `    ('${x}')`).join(',\n');

function splice(sql, key, body) {
  const start = `-- >>> GENERATED: ${key} <<<`;
  const end = `-- <<< END GENERATED: ${key} >>>`;
  const i = sql.indexOf(start);
  const j = sql.indexOf(end);
  if (i === -1 || j === -1) throw new Error(`markers for "${key}" not found in ${TARGET}`);
  return sql.slice(0, i + start.length) + '\n' + body + '\n' + sql.slice(j);
}

let sql = fs.readFileSync(TARGET, 'utf8');
sql = splice(sql, 'rpcs', asValues(rpcs));
sql = splice(sql, 'tables', asValues(tables));
fs.writeFileSync(TARGET, sql);

console.log(`Regenerated ${TARGET}`);
console.log(`  ${rpcs.size} RPCs and ${tables.size} tables the app requires.`);
console.log(`  Paste it into the Supabase SQL editor to see which are missing.`);
