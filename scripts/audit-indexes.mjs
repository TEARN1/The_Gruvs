#!/usr/bin/env node
/**
 * audit-indexes.mjs — catch index definitions that lie about themselves.
 *
 * Every index in supabase/queries is CREATE INDEX IF NOT EXISTS. That makes two
 * mistakes completely silent:
 *
 *   1. SAME NAME, DIFFERENT COLUMNS across two files. The first file to run
 *      wins; the second does nothing, with no error. Which index production
 *      actually has then depends on the order the files were applied in.
 *
 *      This shipped: idx_messages_recipient was (recipient_id, created_at DESC)
 *      in schema_part_1 and (recipient_id) in schema_part_4. Fresh-build order
 *      is 2→3→4→1, so part_4 won and the composite was never created — while
 *      every inbox read orders by created_at. Measured on 400k rows: 0.814 ms
 *      vs 0.166 ms typical, and 9.068 ms vs 0.156 ms for an account with 50k
 *      messages. The narrow index's cost grows with history; the composite's
 *      does not.
 *
 *   2. EXACT DUPLICATES under different names. Zero read benefit, and paid for
 *      on every insert and update — more WAL, more disk, more vacuum, more
 *      bloat. reels carried three separate plain (created_at DESC) indexes and
 *      three separate (user_id) indexes.
 *
 * Exit 1 on a collision (always wrong). Duplicates are reported as warnings,
 * since a deliberate duplicate can exist during a rename.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'supabase/queries';
// Reconciliation deliberately redefines names the schema files also define —
// that is its whole job, so it must not count as a collision against them.
// Instead, a name it pins counts as RESOLVED: it declares the intended
// definition, and applying it makes the end state deterministic.
const OWNS_CANONICAL = 'index_reconciliation.sql';

// The files a fresh build actually applies, in order (FRESH_BUILD_ORDER.md).
// A disagreement between two of these is live today. A disagreement that only
// involves a file outside this list (schema_v6_proposed.sql and friends are
// proposals, not part of the build) is latent — worth reporting, not worth
// failing the build over.
const BUILD_ORDER = ['schema_part_2.sql', 'schema_part_3.sql', 'schema_part_4.sql', 'schema_part_1.sql'];

const defs = [];
for (const f of fs.readdirSync(DIR).sort()) {
  if (!f.endsWith('.sql') || f === OWNS_CANONICAL) continue;
  const sql = fs.readFileSync(path.join(DIR, f), 'utf8');
  const re = /create\s+(unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([a-z0-9_]+)\s+on\s+(?:public\.)?([a-z_]+)\s*(?:using\s+\w+\s*)?(\([^;]*?\))\s*(where[^;']*)?/gi;
  for (const m of sql.matchAll(re)) {
    defs.push({
      file: f,
      name: m[2].toLowerCase(),
      table: m[3].toLowerCase(),
      body: (m[4] + ' ' + (m[5] || '')).replace(/\s+/g, ' ').trim().toLowerCase().replace(/\s*,\s*/g, ','),
    });
  }
}

const byName = {};
for (const d of defs) (byName[d.name] ||= []).push(d);

// Names pinned by the reconciliation file — their end state is declared, so a
// disagreement upstream no longer decides anything.
let pinned = new Set();
const canonPath = path.join(DIR, OWNS_CANONICAL);
if (fs.existsSync(canonPath)) {
  const canon = fs.readFileSync(canonPath, 'utf8');
  for (const m of canon.matchAll(/reidx\(\s*'[a-z_]+'\s*,\s*'([a-z0-9_]+)'/gi)) pinned.add(m[1].toLowerCase());
}

const collisions = [];
for (const [name, group] of Object.entries(byName)) {
  const variants = [...new Map(group.map(g => [`${g.table}${g.body}`, g])).values()];
  if (variants.length < 2) continue;
  const inBuild = variants.filter(v => BUILD_ORDER.includes(v.file));
  collisions.push({
    name,
    variants,
    pinned: pinned.has(name),
    // Live today only if two files the build actually applies disagree.
    live: inBuild.length > 1,
  });
}
const unresolved = collisions.filter(c => c.live && !c.pinned);
const latent     = collisions.filter(c => !c.live && !c.pinned);
const resolved   = collisions.filter(c => c.pinned);

const byDef = {};
for (const d of defs) (byDef[`${d.table}|${d.body}`] ||= new Set()).add(d.name);
const dups = Object.entries(byDef)
  .filter(([, names]) => names.size > 1)
  .map(([k, names]) => ({ def: k, names: [...names] }));

let failed = false;

if (unresolved.length) {
  failed = true;
  console.error(`\n❌ ${unresolved.length} index name(s) that the build applies are defined differently.`);
  console.error('   IF NOT EXISTS means the first file to run wins and the rest do nothing, so');
  console.error('   the real index depends on apply order. Give them distinct names, or pin the');
  console.error(`   intended definition in ${DIR}/${OWNS_CANONICAL}.\n`);
  for (const c of unresolved) {
    console.error(`   ${c.name}`);
    for (const v of c.variants) console.error(`       ${v.file.padEnd(26)} ${v.table}${v.body}`);
    console.error('');
  }
}

if (latent.length) {
  console.warn(`⚠️  ${latent.length} latent collision(s) — only in files outside the build order`);
  console.warn('   (proposals). Harmless until one of those files is applied.');
  for (const c of latent) console.warn(`   ${c.name}  (${c.variants.map(v => v.file).join(' vs ')})`);
  console.warn('');
}

if (resolved.length) {
  console.log(`ℹ️  ${resolved.length} collision(s) pinned by ${OWNS_CANONICAL}: ${resolved.map(c => c.name).join(', ')}`);
}

if (dups.length) {
  console.warn(`⚠️  ${dups.length} duplicate index definition(s) — same table, same columns, different names.`);
  console.warn('   Each copy is maintained on every write for no read benefit.\n');
  for (const d of dups.slice(0, 12)) {
    const [table, body] = d.def.split('|');
    console.warn(`   ${table}${body}`);
    console.warn(`       ${d.names.join(', ')}`);
  }
  console.warn('');
}

if (!failed) {
  console.log(`✅ No index name collisions across ${defs.length} definitions in ${DIR}.`);
  if (dups.length) console.log(`   (${dups.length} duplicate definition(s) reported above as warnings.)`);
}
process.exit(failed ? 1 : 0);
