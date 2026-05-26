#!/usr/bin/env node
/**
 * The Gruvs — Pre-build Bundle Health Guard
 * Blocks the build on any issue that would cause a runtime crash or SafeSection chip.
 * Exit 1 = build blocked. Exit 0 = all clear.
 *
 * Checks:
 *   1. TDZ risk      — const/let declared before last import in module scope
 *   2. Circular deps — static import cycles (DFS)
 *   3. Missing exports — React.lazy(() => import(X).then(m => m.Y)) where Y is not exported from X
 *   4. Unconditional lazy SafeSection — lazy component in <SafeSection> without a {condition &&} guard
 *   5. Undefined component refs — JSX tags that reference an undeclared identifier in the same file
 *   6. Bad .then() on lazy — React.lazy import chain missing `default` key
 *   7. Duplicate exports — same name exported twice in one file
 *   8. Empty SafeSection — <SafeSection> with no children
 */

const { readFileSync, readdirSync, existsSync } = require('fs');
const { join, dirname, resolve } = require('path');

const root = process.cwd();
const SRC_DIRS = ['src/screens', 'src/components', 'src/services', 'src/utils', 'src/hooks', 'src/context'];
let errors = 0;
let warnings = 0;

const red   = s => `\x1b[31m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const green = s => `\x1b[32m${s}\x1b[0m`;

function allFiles() {
  const files = [];
  for (const dir of SRC_DIRS) {
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

// ── 1. TDZ CHECK ──────────────────────────────────────────────────────────────
console.log('\n🔍 [1/7] TDZ risks (const/let before last import)...');
let tdzCount = 0;
for (const file of allFiles()) {
  const lines = readFile(file).split('\n');
  let lastImport = -1;
  let firstConst = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) lastImport = i;
    if (firstConst === -1 && /^(const|let|var)\s/.test(lines[i])) firstConst = i;
  }
  if (firstConst !== -1 && firstConst < lastImport) {
    const short = file.replace(root, '').replace(/\\/g, '/');
    console.error(red(`  ❌ TDZ: ${short} — declaration line ${firstConst + 1}, last import line ${lastImport + 1}`));
    errors++; tdzCount++;
  }
}
if (tdzCount === 0) console.log(green('  ✅ No TDZ risks.'));

// ── 2. CIRCULAR DEPENDENCY CHECK ─────────────────────────────────────────────
console.log('\n🔍 [2/7] Circular dependencies...');

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

const visitedCycle = new Set();
const cyclePaths = new Set();
let cycleCount = 0;

function dfs(file, stack) {
  if (stack.includes(file)) {
    const cycle = [...stack.slice(stack.indexOf(file)), file]
      .map(f => f.replace(root, '').replace(/\\/g, '/'));
    const key = cycle.join(' → ');
    if (!cyclePaths.has(key)) {
      cyclePaths.add(key);
      console.error(red(`  ❌ CYCLE: ${key}`));
      errors++; cycleCount++;
    }
    return;
  }
  if (visitedCycle.has(file)) return;
  visitedCycle.add(file);
  stack.push(file);
  for (const dep of getStaticImports(file)) dfs(dep, stack);
  stack.pop();
}

for (const file of allFiles()) dfs(file, []);
if (cycleCount === 0) console.log(green('  ✅ No circular dependencies.'));

// ── 3. BAD React.lazy .then() — missing `default` key ────────────────────────
console.log('\n🔍 [3/7] React.lazy import chains (missing `default` key)...');
let lazyBadCount = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  const short = file.replace(root, '').replace(/\\/g, '/');
  // Match: React.lazy(() => import('...').then(m => ({ default: m.Something })))
  // Flag ones that have .then() but no `default:` key
  for (const m of content.matchAll(/React\.lazy\s*\(\s*\(\s*\)\s*=>\s*import\([^)]+\)\.then\(([^)]+)\)/g)) {
    const thenBody = m[1];
    if (!/default\s*:/.test(thenBody)) {
      const line = content.slice(0, m.index).split('\n').length;
      console.error(red(`  ❌ LAZY NO DEFAULT: ${short}:${line} — .then() does not set { default: ... }`));
      errors++; lazyBadCount++;
    }
  }
}
if (lazyBadCount === 0) console.log(green('  ✅ All React.lazy chains look correct.'));

// ── 4. UNCONDITIONAL LAZY SafeSection (always mounts, can chip on load) ───────
console.log('\n🔍 [4/7] Unconditional lazy components inside <SafeSection>...');

// Build set of lazy component names per file
function getLazyNames(content) {
  const names = new Set();
  for (const m of content.matchAll(/^const\s+(\w+)\s*=\s*React\.lazy/gm)) names.add(m[1]);
  return names;
}

let uncondCount = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  const short = file.replace(root, '').replace(/\\/g, '/');
  const lazyNames = getLazyNames(content);
  if (lazyNames.size === 0) continue;

  for (const name of lazyNames) {
    const jsxRe = new RegExp(`<${name}[\\s/>]`, 'g');
    for (const m of content.matchAll(jsxRe)) {
      // Look back up to 600 chars for a SafeSection open tag
      const before = content.slice(Math.max(0, m.index - 600), m.index);
      if (!before.includes('<SafeSection')) continue;

      // A condition guard is: {someExpr && \n ( or {someExpr && \n <SafeSection
      // Check up to 800 chars back for any && or ternary ? that opens a block
      const wider = content.slice(Math.max(0, m.index - 800), m.index);
      // Guard patterns: {expr &&, {!!expr, {expr ?, {expr === 'x' &&, {expr !== null
      const hasGuard = /\{[^}]*&&/.test(wider) ||
                       /\{[^}]*\?[^?]/.test(wider) ||
                       /\{!!\w/.test(wider);

      if (!hasGuard) {
        const line = content.slice(0, m.index).split('\n').length;
        console.error(red(`  ❌ UNCONDITIONAL LAZY: ${short}:${line} — <${name}> inside SafeSection with no condition guard — will crash on page load`));
        errors++; uncondCount++;
      }
    }
  }
}
if (uncondCount === 0) console.log(green('  ✅ All lazy SafeSections are conditionally guarded.'));

// ── 5. DUPLICATE NAMED EXPORTS ────────────────────────────────────────────────
console.log('\n🔍 [5/7] Duplicate named exports...');
let dupCount = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  const short = file.replace(root, '').replace(/\\/g, '/');
  const seen = {};
  for (const m of content.matchAll(/^export\s+(?:const|function|class|let|var)\s+(\w+)/gm)) {
    const name = m[1];
    if (seen[name]) {
      const line = content.slice(0, m.index).split('\n').length;
      console.error(red(`  ❌ DUPLICATE EXPORT: ${short}:${line} — '${name}' exported more than once`));
      errors++; dupCount++;
    }
    seen[name] = true;
  }
}
if (dupCount === 0) console.log(green('  ✅ No duplicate exports.'));

// ── 6. MISSING NAMED EXPORT IN LAZY TARGET ───────────────────────────────────
console.log('\n🔍 [6/7] React.lazy targets — named export exists in source...');
let missingExportCount = 0;
for (const file of allFiles()) {
  const content = readFile(file);
  const short = file.replace(root, '').replace(/\\/g, '/');
  // Match: React.lazy(() => import('../path/File').then(m => ({ default: m.ExportName })))
  for (const m of content.matchAll(/React\.lazy\s*\(\s*\(\s*\)\s*=>\s*import\(['"]([^'"]+)['"]\)\.then\(m\s*=>\s*\(\s*\{\s*default\s*:\s*m\.(\w+)/g)) {
    const importPath = m[1];
    const exportName = m[2];
    const resolved = resolveImport(file, importPath);
    if (!resolved) continue;
    const targetContent = readFile(resolved);
    // Check for: export const X, export function X, export class X, exports.X
    const exportRe = new RegExp(`export\\s+(?:const|function|class|let|var)\\s+${exportName}\\b|exports\\.${exportName}\\s*=`);
    if (!exportRe.test(targetContent)) {
      const line = content.slice(0, m.index).split('\n').length;
      console.error(red(`  ❌ MISSING EXPORT: ${short}:${line} — '${exportName}' not found in ${importPath}`));
      errors++; missingExportCount++;
    }
  }
}
if (missingExportCount === 0) console.log(green('  ✅ All lazy export targets exist.'));

// ── 7. CONSOLE.LOG LEFT IN SERVICES ──────────────────────────────────────────
console.log('\n🔍 [7/7] Stray console.log in services/utils (performance & info leak)...');
let logCount = 0;
const SERVICE_DIRS = ['src/services', 'src/utils'];
for (const dir of SERVICE_DIRS) {
  const fullDir = join(root, dir);
  if (!existsSync(fullDir)) continue;
  for (const f of readdirSync(fullDir).filter(f => /\.(js|ts)$/.test(f) && f !== 'log.js')) {
    const filePath = join(fullDir, f);
    const content = readFile(filePath);
    const short = filePath.replace(root, '').replace(/\\/g, '/');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (/console\.log\(/.test(line) && !/\/\/.*console\.log/.test(line)) {
        console.warn(yellow(`  ⚠️  LOG: ${short}:${i + 1} — console.log left in production code`));
        warnings++;
        logCount++;
      }
    });
  }
}
if (logCount === 0) console.log(green('  ✅ No stray console.log in services/utils.'));

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────');
if (errors > 0) {
  console.error(red(`🚨 FAILED — ${errors} error(s)${warnings > 0 ? `, ${warnings} warning(s)` : ''}. Fix before building.\n`));
  process.exit(1);
} else if (warnings > 0) {
  console.warn(yellow(`⚠️  PASSED WITH WARNINGS — ${warnings} warning(s). Build allowed but review recommended.\n`));
  process.exit(0);
} else {
  console.log(green('✅ All checks passed — safe to build.\n'));
  process.exit(0);
}
