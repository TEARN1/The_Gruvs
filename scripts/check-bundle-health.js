#!/usr/bin/env node
/**
 * The Gruvs — Pre-build Bundle Health Guard  v3.0
 * 30 checks across 6 categories. Exit 1 = build blocked. Exit 0 = all clear.
 *
 * CATEGORY A — Bundle / Module integrity (checks 1–7)
 * CATEGORY B — React / Component safety   (checks 8–14)
 * CATEGORY C — Supabase / Data safety     (checks 15–19)
 * CATEGORY D — Security                   (checks 20–23)
 * CATEGORY E — Performance                (checks 24–27)
 * CATEGORY F — Code quality               (checks 28–30)
 */

const { readFileSync, readdirSync, existsSync, statSync } = require('fs');
const { join, dirname } = require('path');

const root = process.cwd();
const SRC_DIRS = ['src/screens', 'src/components', 'src/services', 'src/utils', 'src/hooks', 'src/context'];
let errors = 0;
let warnings = 0;
let checkNum = 0;

const red    = s => `\x1b[31m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const green  = s => `\x1b[32m${s}\x1b[0m`;
const cyan   = s => `\x1b[36m${s}\x1b[0m`;
const bold   = s => `\x1b[1m${s}\x1b[0m`;

function check(label) {
  checkNum++;
  console.log(cyan(`\n🔍 [${checkNum}/30] ${label}...`));
}

function err(msg)  { console.error(red(`  ❌ ${msg}`));    errors++;   }
function warn(msg) { console.warn(yellow(`  ⚠️  ${msg}`));  warnings++; }
function ok(msg)   { console.log(green(`  ✅ ${msg}`)); }

function allFiles(dirs) {
  const files = [];
  for (const dir of (dirs || SRC_DIRS)) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;
    for (const f of readdirSync(fullDir)) {
      if (/\.(js|ts|tsx)$/.test(f)) files.push(join(fullDir, f));
    }
  }
  return files;
}

function readFile(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

function short(file) { return file.replace(root, '').replace(/\\/g, '/'); }

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

function resolveImport(from, imp) {
  if (!imp.startsWith('.')) return null;
  const base = join(dirname(from), imp);
  for (const ext of ['', '.js', '.ts', '.tsx', '/index.js', '/index.ts']) {
    const p = base + ext;
    if (existsSync(p)) return p;
  }
  return null;
}

function getStaticImports(file) {
  const content = readFile(file);
  const imports = [];
  for (const m of content.matchAll(/^import\s+.*?from\s+['"]([^'"]+)['"]/gm)) {
    const resolved = resolveImport(file, m[1]);
    if (resolved) imports.push(resolved);
  }
  return imports;
}

function getLazyNames(content) {
  const names = new Set();
  for (const m of content.matchAll(/^const\s+(\w+)\s*=\s*React\.lazy/gm)) names.add(m[1]);
  return names;
}

// ═══════════════════════════════════════════════════════════════════
// CATEGORY A — Bundle / Module integrity
// ═══════════════════════════════════════════════════════════════════
console.log(bold('\n━━━ CATEGORY A: Bundle / Module integrity ━━━'));

// ── A1. TDZ: const/let before last import ─────────────────────────
check('TDZ risks (const/let declared before last import)');
let c = 0;
for (const file of allFiles()) {
  const lines = readFile(file).split('\n');
  let lastImport = -1, firstConst = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) lastImport = i;
    if (firstConst === -1 && /^(const|let|var)\s/.test(lines[i])) firstConst = i;
  }
  if (firstConst !== -1 && firstConst < lastImport)
    err(`TDZ: ${short(file)} — declaration line ${firstConst + 1}, last import line ${lastImport + 1}`), c++;
}
if (!c) ok('No TDZ risks.');

// ── A2. Circular static imports ───────────────────────────────────
check('Circular static import cycles');
const visitedCycle = new Set(); const cyclePaths = new Set(); c = 0;
function dfs(file, stack) {
  if (stack.includes(file)) {
    const cycle = [...stack.slice(stack.indexOf(file)), file].map(f => short(f));
    const key = cycle.join(' → ');
    if (!cyclePaths.has(key)) { cyclePaths.add(key); err(`CYCLE: ${key}`); c++; }
    return;
  }
  if (visitedCycle.has(file)) return;
  visitedCycle.add(file);
  stack.push(file);
  for (const dep of getStaticImports(file)) dfs(dep, stack);
  stack.pop();
}
for (const file of allFiles()) dfs(file, []);
if (!c) ok('No circular dependencies.');

// ── A3. React.lazy .then() missing `default` key ─────────────────
check('React.lazy chains — missing { default: } key');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  for (const m of content.matchAll(/React\.lazy\s*\(\s*\(\s*\)\s*=>\s*import\([^)]+\)\.then\(([^)]+)\)/g)) {
    if (!/default\s*:/.test(m[1]))
      err(`LAZY NO DEFAULT: ${short(file)}:${lineOf(content, m.index)} — .then() missing { default: ... }`), c++;
  }
}
if (!c) ok('All React.lazy chains have default key.');

// ── A4. Lazy export target exists ─────────────────────────────────
check('React.lazy targets — named export exists in source file');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  for (const m of content.matchAll(/React\.lazy\s*\(\s*\(\s*\)\s*=>\s*import\(['"]([^'"]+)['"]\)\.then\(m\s*=>\s*\(\s*\{\s*default\s*:\s*m\.(\w+)/g)) {
    const resolved = resolveImport(file, m[1]);
    if (!resolved) continue;
    const target = readFile(resolved);
    if (!new RegExp(`export\\s+(?:const|function|class|let|var)\\s+${m[2]}\\b|exports\\.${m[2]}\\s*=`).test(target))
      err(`MISSING EXPORT: ${short(file)}:${lineOf(content, m.index)} — '${m[2]}' not in ${m[1]}`), c++;
  }
}
if (!c) ok('All lazy export targets exist.');

// ── A5. Unconditional lazy inside SafeSection ─────────────────────
check('Unconditional lazy components inside <SafeSection>');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  const lazyNames = getLazyNames(content);
  if (!lazyNames.size) continue;
  for (const name of lazyNames) {
    for (const m of content.matchAll(new RegExp(`<${name}[\\s/>]`, 'g'))) {
      const before = content.slice(Math.max(0, m.index - 600), m.index);
      if (!before.includes('<SafeSection')) continue;
      const wider = content.slice(Math.max(0, m.index - 800), m.index);
      const hasGuard = /\{[^}]*&&/.test(wider) || /\{[^}]*\?[^?]/.test(wider) || /\{!!\w/.test(wider);
      if (!hasGuard)
        err(`UNCONDITIONAL LAZY: ${short(file)}:${lineOf(content, m.index)} — <${name}> in SafeSection without condition guard`), c++;
    }
  }
}
if (!c) ok('All lazy SafeSections are conditionally guarded.');

// ── A6. Duplicate named exports ───────────────────────────────────
check('Duplicate named exports in same file');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  const seen = {};
  for (const m of content.matchAll(/^export\s+(?:const|function|class|let|var)\s+(\w+)/gm)) {
    if (seen[m[1]])
      err(`DUPLICATE EXPORT: ${short(file)}:${lineOf(content, m.index)} — '${m[1]}' exported more than once`), c++;
    seen[m[1]] = true;
  }
}
if (!c) ok('No duplicate exports.');

// ── A7. Import path exists on disk ────────────────────────────────
check('Relative import paths resolve to existing files');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  for (const m of content.matchAll(/^import\s+.*?from\s+['"](\.[^'"]+)['"]/gm)) {
    const resolved = resolveImport(file, m[1]);
    if (!resolved)
      err(`BROKEN IMPORT: ${short(file)}:${lineOf(content, m.index)} — '${m[1]}' does not resolve`), c++;
  }
}
if (!c) ok('All relative imports resolve.');

// ═══════════════════════════════════════════════════════════════════
// CATEGORY B — React / Component safety
// ═══════════════════════════════════════════════════════════════════
console.log(bold('\n━━━ CATEGORY B: React / Component safety ━━━'));

// ── B8. useEffect with async callback (memory leak) ───────────────
check('useEffect with direct async callback (memory leak pattern)');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  for (const m of content.matchAll(/useEffect\s*\(\s*async\s*\(/g)) {
    warn(`ASYNC EFFECT: ${short(file)}:${lineOf(content, m.index)} — useEffect with async callback leaks on unmount`);
    c++;
  }
}
if (!c) ok('No async useEffect callbacks.');

// ── B9. setState called after unmount (missing cleanup) ───────────
check('Missing cleanup in useEffect with subscriptions');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  // Look for useEffect blocks that have supabase.channel or setInterval/setTimeout but no return cleanup
  const effectBlocks = [...content.matchAll(/useEffect\s*\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s*\},/g)];
  for (const m of effectBlocks) {
    const body = m[1];
    const hasSub = /supabase\.channel|setInterval|addEventListener|subscribe/.test(body);
    const hasCleanup = /return\s*\(\s*\)|return\s*\(\s*\)\s*=>|\.unsubscribe|clearInterval|removeEventListener/.test(body);
    if (hasSub && !hasCleanup)
      warn(`NO CLEANUP: ${short(file)}:${lineOf(content, m.index)} — subscription/timer without cleanup return`), c++;
  }
}
if (!c) ok('No unclean subscriptions found.');

// ── B10. keyExtractor returning index in FlatList ─────────────────
check('keyExtractor returning index in FlatList (broken reconciliation)');
c = 0;
for (const file of allFiles(['src/screens', 'src/components'])) {
  const content = readFile(file);
  for (const m of content.matchAll(/keyExtractor\s*=\s*\{[^}]{0,80}=>\s*(?:String\s*\()?\s*(?:index|idx)\s*\)?[\s}]/g))
    warn(`KEY INDEX: ${short(file)}:${lineOf(content, m.index)} — keyExtractor returns index — use stable id`), c++;
}
if (!c) ok('No index-based keyExtractor in FlatLists.');

// ── B11. Missing error boundary on top-level screens ──────────────
check('Top-level screens missing ErrorBoundary or SafeSection wrapper');
c = 0;
const screenFiles = allFiles(['src/screens']);
for (const file of screenFiles) {
  const content = readFile(file);
  // Only check files that export a screen component
  if (!content.includes('export const') && !content.includes('export default')) continue;
  // Skip if file uses SafeSection or ErrorBoundary
  const hasBoundary = content.includes('SafeSection') || content.includes('ErrorBoundary');
  if (!hasBoundary)
    warn(`NO BOUNDARY: ${short(file)} — screen has no SafeSection or ErrorBoundary protection`), c++;
}
if (!c) ok('All screens use error boundaries.');

// ── B12. Hardcoded colors instead of theme variables ──────────────
check('Hardcoded hex colors outside theme/constants files');
c = 0;
const NON_THEME = allFiles(['src/screens', 'src/components']).filter(f => !f.includes('Theme') && !f.includes('Design'));
for (const file of NON_THEME) {
  const content = readFile(file);
  const matches = [...content.matchAll(/'#[0-9a-fA-F]{6}'/g)];
  // Only flag if many hardcoded colors — threshold 20 to avoid false positives on StyleSheet blocks
  if (matches.length > 20)
    warn(`HARDCODED COLORS: ${short(file)} — ${matches.length} hardcoded hex colors (use theme variables)`), c++;
}
if (!c) ok('Color usage looks reasonable.');

// ── B13. Component files over 800 lines (maintainability) ─────────
check('Component files exceeding 800 lines (maintainability)');
c = 0;
for (const file of allFiles(['src/components'])) {
  const lines = readFile(file).split('\n').length;
  if (lines > 800)
    warn(`LARGE FILE: ${short(file)} — ${lines} lines (consider splitting)`), c++;
}
if (!c) ok('All component files are reasonable size.');

// ── B14. Screen files over 2000 lines ─────────────────────────────
check('Screen files exceeding 2000 lines');
c = 0;
for (const file of allFiles(['src/screens'])) {
  const lines = readFile(file).split('\n').length;
  if (lines > 2000)
    warn(`LARGE SCREEN: ${short(file)} — ${lines} lines`), c++;
}
if (!c) ok('All screen files within size limit.');

// ═══════════════════════════════════════════════════════════════════
// CATEGORY C — Supabase / Data safety
// ═══════════════════════════════════════════════════════════════════
console.log(bold('\n━━━ CATEGORY C: Supabase / Data safety ━━━'));

// ── C15. Raw .delete() without .eq() filter (deletes all rows!) ───
check('Unfiltered .delete() calls (would delete entire table)');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  for (const m of content.matchAll(/\.delete\s*\(\s*\)(?!\s*\.\s*eq|\s*\.\s*match|\s*\.\s*filter|\s*\.\s*in\b)/g)) {
    // Make sure it's a supabase chain
    const before = content.slice(Math.max(0, m.index - 200), m.index);
    if (/supabase|from\(/.test(before))
      err(`UNFILTERED DELETE: ${short(file)}:${lineOf(content, m.index)} — .delete() with no .eq() filter`), c++;
  }
}
if (!c) ok('All delete() calls have filters.');

// ── C16. .select() with no columns (over-fetching) ────────────────
check('Supabase .select() with no column list (over-fetching)');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  for (const m of content.matchAll(/\.select\s*\(\s*['"]\s*['"]\s*\)/g)) {
    warn(`SELECT STAR: ${short(file)}:${lineOf(content, m.index)} — .select('') fetches all columns`);
    c++;
  }
}
if (!c) ok('No empty .select() calls.');

// ── C17. Supabase calls outside try/catch or .catch() ─────────────
check('Supabase calls with no error handling (fire-and-forget)');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  // Only flag .delete() without error handling (inserts/updates are usually inside try/catch)
  for (const m of content.matchAll(/supabase\.from\([^)]+\)\.delete\(/g)) {
    const surrounding = content.slice(Math.max(0, m.index - 150), m.index + 300);
    const hasErrorCheck = /\.catch|error\s*\}|if\s*\(\s*error|try\s*\{/.test(surrounding);
    if (!hasErrorCheck)
      warn(`NO ERROR HANDLE: ${short(file)}:${lineOf(content, m.index)} — .delete() with no error check`), c++;
  }
}
if (!c) ok('All Supabase mutations handle errors.');

// ── C18. Direct user.id usage without null check ──────────────────
check('user.id used without null guard in top-level render (crashes when logged out)');
c = 0;
for (const file of allFiles(['src/screens', 'src/components'])) {
  const content = readFile(file);
  // Only flag user.id that's NOT preceded by optional chain, conditional, or already inside a user && block
  // Narrow to: eq('user_id', user.id) or insert({user_id: user.id}) patterns without any guard
  for (const m of content.matchAll(/eq\(['"]user_id['"]\s*,\s*user\.id\)|:\s*user\.id\b/g)) {
    const surrounding = content.slice(Math.max(0, m.index - 300), m.index + 20);
    const safe = /user\?\.id|if\s*\(!?\s*user\b|user\s*&&|\buser\b.*return/.test(surrounding);
    if (!safe)
      console.log(yellow(`  ℹ️  UNSAFE USER ID: ${short(file)}:${lineOf(content, m.index)} — user.id in DB call without null guard`)); c++;
  }
}
if (!c) ok('user.id in DB calls look guarded.');

// ── C19. Hardcoded Supabase URLs or keys in source ────────────────
check('Hardcoded Supabase URLs or API keys in source');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  if (/supabase\.co\/rest|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{10,}/.test(content)) {
    err(`HARDCODED KEY: ${short(file)} — Supabase URL or JWT key found in source`);
    c++;
  }
}
if (!c) ok('No hardcoded Supabase credentials.');

// ═══════════════════════════════════════════════════════════════════
// CATEGORY D — Security
// ═══════════════════════════════════════════════════════════════════
console.log(bold('\n━━━ CATEGORY D: Security ━━━'));

// ── D20. eval() or Function() constructor usage ───────────────────
check('eval() or new Function() usage (code injection risk)');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  for (const m of content.matchAll(/\beval\s*\(|new\s+Function\s*\(/g)) {
    err(`EVAL: ${short(file)}:${lineOf(content, m.index)} — eval/Function() is a code injection risk`);
    c++;
  }
}
if (!c) ok('No eval() or Function() usage.');

// ── D21. dangerouslySetInnerHTML usage ────────────────────────────
check('dangerouslySetInnerHTML (XSS risk)');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  for (const m of content.matchAll(/dangerouslySetInnerHTML/g))
    warn(`XSS RISK: ${short(file)}:${lineOf(content, m.index)} — dangerouslySetInnerHTML`), c++;
}
if (!c) ok('No dangerouslySetInnerHTML usage.');

// ── D22. Exposed secrets pattern ──────────────────────────────────
check('Hardcoded secrets, tokens or passwords in source');
c = 0;
const SECRET_RE = /(?:password|secret|api_key|apikey|private_key)\s*[:=]\s*['"][^'"]{6,}['"]/i;
for (const file of allFiles()) {
  const content = readFile(file);
  if (SECRET_RE.test(content)) {
    const m = content.match(SECRET_RE);
    err(`HARDCODED SECRET: ${short(file)}:${lineOf(content, content.indexOf(m[0]))} — potential secret in source`);
    c++;
  }
}
if (!c) ok('No hardcoded secrets found.');

// ── D23. Linking.openURL with unvalidated input ───────────────────
check('Linking.openURL with dynamic / unvalidated URLs');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  for (const m of content.matchAll(/Linking\.openURL\s*\(\s*(?!['"]https?:\/\/|['"]mailto:|['"]tel:)/g)) {
    warn(`OPEN URL: ${short(file)}:${lineOf(content, m.index)} — Linking.openURL with dynamic URL (validate first)`);
    c++;
  }
}
if (!c) ok('All Linking.openURL calls look safe.');

// ═══════════════════════════════════════════════════════════════════
// CATEGORY E — Performance
// ═══════════════════════════════════════════════════════════════════
console.log(bold('\n━━━ CATEGORY E: Performance ━━━'));

// ── E24. Stray console.log in services/utils ──────────────────────
check('Stray console.log in services/utils (perf + info leak)');
c = 0;
for (const file of allFiles(['src/services', 'src/utils'])) {
  if (file.endsWith('log.js')) continue;
  const content = readFile(file);
  content.split('\n').forEach((line, i) => {
    if (/console\.log\(/.test(line) && !/\/\/.*console\.log/.test(line))
      warn(`LOG: ${short(file)}:${i + 1} — console.log in production code`), c++;
  });
}
if (!c) ok('No stray console.log in services/utils.');

// ── E25. Inline object/array in JSX props (new ref every render) ──
check('Inline object/array literals in JSX style props (re-render churn)');
c = 0;
for (const file of allFiles(['src/screens', 'src/components'])) {
  const content = readFile(file);
  // style={{ ... }} with more than 3 properties is a sign of heavy inline style
  const matches = [...content.matchAll(/style=\{\{[^}]{80,}\}\}/g)];
  if (matches.length > 15)
    warn(`INLINE STYLES: ${short(file)} — ${matches.length} heavy inline style objects (extract to StyleSheet)`), c++;
}
if (!c) ok('Inline style usage looks reasonable.');

// ── E26. Large images without resize hint ─────────────────────────
check('Image components missing resizeMode or dimensions');
c = 0;
for (const file of allFiles(['src/screens', 'src/components'])) {
  const content = readFile(file);
  const imgTags = [...content.matchAll(/<Image\s[^>]*\/>/gs)];
  for (const m of imgTags) {
    const tag = m[0];
    if (!tag.includes('resizeMode') && !tag.includes('style'))
      warn(`IMAGE: ${short(file)}:${lineOf(content, m.index)} — <Image> missing resizeMode or style dimensions`), c++;
  }
}
if (!c) ok('All Image components have size/resize hints.');

// ── E27. Missing useMemo/useCallback on heavy computations ────────
check('FlatList renderItem without useCallback (re-renders entire list)');
c = 0;
for (const file of allFiles(['src/screens'])) {
  const content = readFile(file);
  // Flag renderItem={({ item }) => ...} arrow function not wrapped in useCallback
  for (const m of content.matchAll(/renderItem\s*=\s*\{\s*\(\s*\{/g)) {
    const before = content.slice(Math.max(0, m.index - 30), m.index);
    if (!before.includes('useCallback') && !before.includes('renderCard') && !before.includes('render'))
      warn(`RENDER ITEM: ${short(file)}:${lineOf(content, m.index)} — renderItem inline arrow (wrap in useCallback)`), c++;
  }
}
if (!c) ok('FlatList renderItem usage looks memoized.');

// ═══════════════════════════════════════════════════════════════════
// CATEGORY F — Code quality
// ═══════════════════════════════════════════════════════════════════
console.log(bold('\n━━━ CATEGORY F: Code quality ━━━'));

// ── F28. Empty catch blocks swallowing errors silently ─────────────
check('Empty catch blocks in screens/components silently swallowing errors');
c = 0;
for (const file of allFiles(['src/screens', 'src/components'])) {
  const content = readFile(file);
  for (const m of content.matchAll(/\}\s*catch\s*(?:\([^)]*\))?\s*\{\s*\}/g)) {
    console.log(yellow(`  ℹ️  EMPTY CATCH: ${short(file)}:${lineOf(content, m.index)} — empty catch silently swallows errors`));
    c++;
  }
}
if (!c) ok('No empty catch blocks in screens/components.');

// ── F29. TODO / FIXME / HACK comments left in code ────────────────
check('TODO / FIXME / HACK comments in source');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  content.split('\n').forEach((line, i) => {
    if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line))
      warn(`${line.match(/TODO|FIXME|HACK|XXX/)[0]}: ${short(file)}:${i + 1} — ${line.trim().slice(0, 80)}`), c++;
  });
}
if (!c) ok('No TODO/FIXME/HACK comments.');

// ── F30. Commented-out code blocks (dead code) ────────────────────
check('Large commented-out code blocks (dead code)');
c = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  // Find consecutive comment lines (5+ in a row) that look like commented code
  const lines = content.split('\n');
  let streak = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\/\//.test(lines[i]) && /[{};=()]/.test(lines[i])) streak++;
    else streak = 0;
    if (streak === 8) {
      warn(`DEAD CODE: ${short(file)}:${i - 7} — ${streak}+ consecutive commented-out code lines`);
      c++; streak = 0;
    }
  }
}
if (!c) ok('No large dead code blocks detected.');

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════
console.log(bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log(`  Checks run: ${bold(String(checkNum))}/30   Errors: ${errors > 0 ? red(String(errors)) : green('0')}   Warnings: ${warnings > 0 ? yellow(String(warnings)) : green('0')}`);
console.log(bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

if (errors > 0) {
  console.error(red(`🚨 BUILD BLOCKED — ${errors} error(s) must be fixed before deploying.\n`));
  process.exit(1);
} else if (warnings > 0) {
  console.warn(yellow(`⚠️  BUILD ALLOWED WITH WARNINGS — ${warnings} issue(s) to review.\n`));
  process.exit(0);
} else {
  console.log(green('✅ All 30 checks passed — ship it.\n'));
  process.exit(0);
}
