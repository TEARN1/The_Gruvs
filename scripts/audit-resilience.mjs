/**
 * audit-resilience.mjs — does the render-recovery layer still hold?
 *
 * audit-schema.mjs and audit-writes.mjs check the DATA layer against the live
 * database. This checks the RENDER layer, purely statically (no Supabase
 * secrets, no network) — the two checks that would have caught the confirmed
 * root cause of a 2026-07-20 production incident before it shipped:
 *
 *   • Every <ErrorBoundary> usage must have a `label` prop. `label` drives
 *     BOTH the fallback text a user sees AND the telemetry key
 *     (`UI:${label}:${kind}` in ErrorBoundary.js) — an unlabeled boundary is
 *     invisible in both places at once. The generic "This section needs a
 *     moment" text a user reported was exactly this: two root boundaries in
 *     App.js had no label. FAILS THE BUILD — zero false positives, this is a
 *     JSX-prop check, not a live probe.
 *
 *   • Every named export of src/screens/lazyScreens.js (a React.lazy()
 *     component) that's rendered anywhere must have a <Suspense> ancestor in
 *     that same file. The confirmed root cause: GodViewDashboard was
 *     rendered unconditionally in App.js with zero Suspense anywhere above
 *     it — a chunk fetch that hadn't resolved yet suspended with nothing
 *     local to catch it, and fell through to the (then-unlabeled) root
 *     boundary. FAILS THE BUILD — same zero-false-positive bar.
 *
 * Advisory only (never fails the build): resilient()-wrapping coverage for
 * raw Supabase writes/reads, same style as audit-writes.mjs's RPC section —
 * this is the visibility mechanism for the ~400 unwrapped call sites judged
 * too large to fix in one pass (2026-07-20 restructure), not a thing this
 * script can respons­ibly gate on without a real AST and a lot more nuance
 * than a regex heuristic can offer.
 *
 * Usage:  node scripts/audit-resilience.mjs
 * Env:    none — fully static, safe to run on every push with no secrets.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Bar to add an entry here is the same as every other audit script in this
// repo: a tracked bug with an owner, never a convenient way to silence the
// guard. Empty on purpose — nothing has earned an exemption yet.
const EXPECTED_MISSING_LABEL = new Set([]);

function walk(dir, acc = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(js|jsx)$/.test(p)) acc.push(p);
  }
  return acc;
}

/** The full `<ErrorBoundary ...>` opening tag, brace-aware across newlines. */
function matchBoundaryTags(src) {
  const tags = [];
  const re = /<ErrorBoundary\b/g;
  let m;
  while ((m = re.exec(src))) {
    const start = m.index;
    let i = start, depth = 0, end = -1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) { end = i; break; }
    }
    if (end === -1) continue; // unterminated — malformed JSX, not our problem here
    tags.push({ text: src.slice(start, end + 1), index: start });
  }
  return tags;
}

const files = walk('src').concat(['App.js']);

// ─── Check 1: every ErrorBoundary has a label ────────────────────────────────

const missingLabel = [];
for (const file of files) {
  const rel = file.split('\\').join('/');
  const src = readFileSync(file, 'utf8');
  for (const tag of matchBoundaryTags(src)) {
    if (/\blabel\s*=/.test(tag.text)) continue;
    const line = src.slice(0, tag.index).split('\n').length;
    const key = `${rel}:${line}`;
    if (EXPECTED_MISSING_LABEL.has(key)) continue;
    missingLabel.push({ file: rel, line, snippet: tag.text.replace(/\s+/g, ' ').slice(0, 80) });
  }
}

// ─── Check 2: every lazyScreens.js export used anywhere has a local Suspense ─

const lazyScreensSrc = readFileSync('src/screens/lazyScreens.js', 'utf8');
const lazyExports = [...lazyScreensSrc.matchAll(/^export const (\w+) =/gm)].map((m) => m[1]);

// No real JSX tree here (regex, not an AST), so "is this usage inside a
// Suspense" can't be answered exactly. A strict "Suspense appears somewhere
// EARLIER in the file" check sounds right but isn't: this codebase's actual
// pattern (App.js's screenFor() -> renderScreen()) defines a JSX literal for
// a lazy screen in one function, then wraps ITS CALLER's return value in
// Suspense further down the file — textually AFTER the usage, even though
// it's correctly wrapped at runtime. A directional check flags that as
// broken. Use a bidirectional proximity window instead: is there a
// <Suspense> within PROXIMITY_LINES either way? Calibrated against real
// measurements in this file: the legitimate screenFor() indirection sits
// ~44 lines from its Suspense; the confirmed incident (GodViewDashboard
// rendered with NO Suspense anywhere nearby) had a ~130-line gap to the
// nearest unrelated one. 100 lines cleanly separates "wrapped, just
// indirectly" from "not wrapped at all."
const PROXIMITY_LINES = 100;

const missingSuspense = [];
for (const file of files) {
  if (file.endsWith('lazyScreens.js')) continue;
  const rel = file.split('\\').join('/');
  const src = readFileSync(file, 'utf8');
  const suspenseLines = [...src.matchAll(/<Suspense\b/g)]
    .map((m) => src.slice(0, m.index).split('\n').length);

  for (const name of lazyExports) {
    const usageMatch = src.match(new RegExp(`<${name}\\b`));
    if (!usageMatch) continue;
    const usageIndex = src.indexOf(usageMatch[0]);
    const line = src.slice(0, usageIndex).split('\n').length;
    const key = `${rel}:${line}`;
    if (EXPECTED_MISSING_LABEL.has(key)) continue;
    const nearSuspense = suspenseLines.some((sl) => Math.abs(sl - line) <= PROXIMITY_LINES);
    if (!nearSuspense) missingSuspense.push({ file: rel, line, component: name });
  }
}

// ─── Advisory: resilient() wrapping coverage for raw writes/reads ────────────

// A full backward brace-walk to find the "true" enclosing function is
// expensive and still just a heuristic on regex-extracted text (no real AST
// here) — approximate
// "enclosing function" as the nearest preceding `async function`/`async (`/
// `=> {` boundary. Good enough to separate "this file uses the pattern
// somewhere nearby" from "this call is nakedly unprotected."
function isNearResilientWrapper(src, callIndex) {
  const funcStart = Math.max(
    src.lastIndexOf('async function', callIndex),
    src.lastIndexOf('async (', callIndex),
    src.lastIndexOf('=> {', callIndex)
  );
  const windowStart = funcStart > -1 ? funcStart : Math.max(0, callIndex - 800);
  const chunk = src.slice(windowStart, callIndex);
  return /\bresilient(?:Read|Write)?\s*\(/.test(chunk);
}

let writeTotal = 0, writeWrapped = 0;
let readTotal = 0, readWrapped = 0;
const worstOffenders = new Map(); // file -> count

for (const file of files) {
  const rel = file.split('\\').join('/');
  const src = readFileSync(file, 'utf8');
  if (rel.includes('/utils/resilience.js')) continue;

  const writeRe = /\.from\(\s*['"`][a-z_0-9]+['"`]\s*\)\s*\.\s*(?:insert|update|upsert|delete)\(/g;
  let m;
  while ((m = writeRe.exec(src))) {
    writeTotal++;
    if (isNearResilientWrapper(src, m.index)) writeWrapped++;
    else worstOffenders.set(rel, (worstOffenders.get(rel) || 0) + 1);
  }

  const readRe = /\.from\(\s*['"`][a-z_0-9]+['"`]\s*\)\s*\.\s*select\(/g;
  while ((m = readRe.exec(src))) {
    readTotal++;
    if (isNearResilientWrapper(src, m.index)) readWrapped++;
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

const writePct = writeTotal ? Math.round((writeWrapped / writeTotal) * 100) : 100;
const readPct = readTotal ? Math.round((readWrapped / readTotal) * 100) : 100;

console.log(`Checked ${files.length} files for boundary/Suspense contract violations.`);
console.log(`\nresilient()-wrapping coverage (advisory, does not fail the build):`);
console.log(`  writes: ${writeWrapped}/${writeTotal} (${writePct}%)`);
console.log(`  reads:  ${readWrapped}/${readTotal} (${readPct}%)`);
if (worstOffenders.size) {
  const worst = [...worstOffenders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`\n  Worst offenders (unwrapped write count):`);
  for (const [file, count] of worst) console.log(`    ${count.toString().padStart(3)}  ${file}`);
}

const problems = [...missingLabel, ...missingSuspense];
if (!problems.length) {
  console.log('\n✅ No render-boundary contract violations. Every ErrorBoundary is labeled; every lazy render has a local Suspense.');
  process.exit(0);
}

if (missingLabel.length) {
  console.log(`\n🔴 ${missingLabel.length} <ErrorBoundary> WITHOUT a label prop:`);
  for (const b of missingLabel) {
    console.log(`  ${b.file}:${b.line}  ${b.snippet}`);
    console.log(`::error file=${b.file},line=${b.line}::ErrorBoundary missing a label prop — the fallback text AND the telemetry key both need it`);
  }
}
if (missingSuspense.length) {
  console.log(`\n🔴 ${missingSuspense.length} lazy component(s) rendered with no local <Suspense>:`);
  for (const s of missingSuspense) {
    console.log(`  ${s.file}:${s.line}  <${s.component}>`);
    console.log(`::error file=${s.file},line=${s.line}::<${s.component}> is React.lazy() but this file never opens a Suspense boundary — a slow chunk fetch will suspend with nothing local to catch it`);
  }
}
console.log('\nThis is the exact contract violation behind a confirmed production incident: an unconditionally-rendered lazy component with no Suspense fell through to an unlabeled root boundary.');
process.exit(1);
