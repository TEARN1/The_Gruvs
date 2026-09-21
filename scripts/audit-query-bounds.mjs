#!/usr/bin/env node
/**
 * audit-query-bounds.mjs — find reads that pull an unbounded result set.
 *
 * A query with no LIMIT is correct on day one and gets slower every year. This
 * counts them so the number is tracked rather than rediscovered.
 *
 * Three categories, only one of which is really a problem:
 *
 *   bounded-by-scope  — scoped to a single event/match/room. Bounded by nature.
 *   user-scoped       — scoped to one user, no limit. Grows with that user's
 *                       lifetime activity. These are the ones to watch.
 *   unscoped          — no filter at all. Reads the whole table.
 *
 * A caveat worth knowing, because getting it wrong overstates the problem:
 * a query is often built into a variable and limited later —
 *     const q = supabase.from('follows').select(...).eq(...);
 *     const { data } = await q.order('created_at').limit(200);
 * Matching only the chain from .from() flags that as unbounded when it is not.
 * An earlier pass of this audit did exactly that and overstated the count by
 * ~19%. This version scans the enclosing block for a limit before reporting.
 */
import fs from 'node:fs';
import path from 'node:path';

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})('src');
if (fs.existsSync('App.js')) files.push('App.js');

const SCOPE_BOUNDED = /event_id|match_id|club_id|room_id|crew_id|series_id|poll_id|booking_id|reel_id|thread_id/;
const results = { unscoped: [], userScoped: [], scopeBounded: [], falsePositive: 0 };

for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\.from\(['"`]([a-z_]+)['"`]\)/);
    if (!m) continue;
    const table = m[1];

    let chain = lines[i];
    for (let j = i + 1; j < Math.min(i + 14, lines.length); j++) {
      chain += '\n' + lines[j];
      if (/;\s*$/.test(lines[j].trim())) break;
    }
    if (!/\.select\(/.test(chain)) continue;                 // reads only
    if (/head:\s*true/.test(chain)) continue;                // count-only: no rows
    if (/\.eq\(\s*['"`]id['"`]/.test(chain)) continue;        // single row by id
    if (/\.(limit|range|single|maybeSingle)\(/.test(chain)) continue;

    // The query may be limited later in the block via a variable.
    const block = lines.slice(Math.max(0, i - 8), Math.min(lines.length, i + 30)).join('\n');
    if (/\.(limit|range)\(/.test(block)) { results.falsePositive++; continue; }

    const scopes = [...chain.matchAll(/\.(?:eq|in|or|contains|overlaps)\(\s*['"`]?([a-z_]+)/g)].map(x => x[1]);
    const rec = { file: f, line: i + 1, table, scopes: [...new Set(scopes)] };
    if (scopes.length === 0) results.unscoped.push(rec);
    else if (scopes.some(s => SCOPE_BOUNDED.test(s))) results.scopeBounded.push(rec);
    else results.userScoped.push(rec);
  }
}

const total = results.unscoped.length + results.userScoped.length + results.scopeBounded.length;
console.log('Unbounded reads (no .limit / .range / .single):\n');
console.log(`  unscoped      ${String(results.unscoped.length).padStart(4)}   reads the whole table`);
console.log(`  user-scoped   ${String(results.userScoped.length).padStart(4)}   grows with one user's lifetime activity`);
console.log(`  scope-bounded ${String(results.scopeBounded.length).padStart(4)}   one event/match/room — bounded by nature`);
console.log(`  ─────────────────────`);
console.log(`  total         ${String(total).padStart(4)}   (+${results.falsePositive} limited later via a variable, not counted)\n`);

if (results.unscoped.length) {
  console.log('  Unscoped reads:');
  for (const r of results.unscoped) console.log(`    ${r.file}:${r.line}  ${r.table}`);
  console.log('');
}

const byTable = {};
for (const r of results.userScoped) (byTable[r.table] ||= []).push(r);
const top = Object.entries(byTable).sort((a, b) => b[1].length - a[1].length).slice(0, 10);
if (top.length) {
  console.log('  User-scoped, by table (watch the ones that grow forever):');
  for (const [t, rows] of top) console.log(`    ${String(rows.length).padStart(3)}×  ${t}`);
}

// Informational: this is a trend to watch, not a build gate. Failing CI on it
// would block every unrelated change until all of them are paginated.
process.exit(0);
