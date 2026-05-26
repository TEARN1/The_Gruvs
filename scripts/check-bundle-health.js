#!/usr/bin/env node
/**
 * The Gruvs — Pre-build Bundle Health Guard
 * Runs before every Expo web build (hooked via package.json "prebuild").
 * Catches TDZ risks and circular dependency cycles before they reach Vercel.
 * Exit 1 = build blocked. Exit 0 = all clear.
 */

const { readFileSync, readdirSync, existsSync } = require('fs');
const { join, dirname } = require('path');

const root = process.cwd();
const SRC_DIRS = ['src/screens', 'src/components', 'src/services', 'src/utils', 'src/hooks', 'src/context'];
let errors = 0;

// ── 1. TDZ CHECK: const/let before last import ────────────────────────────────
console.log('\n🔍 Checking for TDZ risks (const/let before imports)...');
for (const dir of SRC_DIRS) {
  const fullDir = join(root, dir);
  if (!existsSync(fullDir)) continue;
  for (const f of readdirSync(fullDir).filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.tsx'))) {
    const lines = readFileSync(join(fullDir, f), 'utf8').split('\n');
    let lastImport = -1;
    let firstConst = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) lastImport = i;
      if (firstConst === -1 && /^(const|let|var)\s/.test(lines[i])) firstConst = i;
    }
    if (firstConst !== -1 && firstConst < lastImport) {
      console.error(`  ❌ TDZ RISK: ${dir}/${f} — declaration at line ${firstConst + 1}, last import at line ${lastImport + 1}`);
      errors++;
    }
  }
}
if (errors === 0) console.log('  ✅ No TDZ risks found.');

// ── 2. CIRCULAR DEPENDENCY CHECK ─────────────────────────────────────────────
console.log('\n🔍 Checking for circular dependencies...');

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
  try {
    const content = readFileSync(file, 'utf8');
    const imports = [];
    for (const m of content.matchAll(/^import\s+.*?from\s+['"]([^'"]+)['"]/gm)) {
      const resolved = resolveImport(file, m[1]);
      if (resolved) imports.push(resolved);
    }
    return imports;
  } catch { return []; }
}

const visitedCycle = new Set();
const cyclePaths = new Set();

function dfs(file, stack) {
  if (stack.includes(file)) {
    const cycle = [...stack.slice(stack.indexOf(file)), file]
      .map(f => f.replace(root, '').replace(/\\/g, '/'));
    const key = cycle.join(' → ');
    if (!cyclePaths.has(key)) {
      cyclePaths.add(key);
      console.error(`  ❌ CYCLE: ${key}`);
      errors++;
    }
    return;
  }
  if (visitedCycle.has(file)) return;
  visitedCycle.add(file);
  stack.push(file);
  for (const dep of getStaticImports(file)) dfs(dep, stack);
  stack.pop();
}

// Start from all screen and component entry points
for (const dir of SRC_DIRS) {
  const fullDir = join(root, dir);
  if (!existsSync(fullDir)) continue;
  for (const f of readdirSync(fullDir).filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.tsx'))) {
    dfs(join(fullDir, f), []);
  }
}

if (cyclePaths.size === 0) console.log('  ✅ No circular dependencies found.');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
if (errors > 0) {
  console.error(`🚨 Bundle health check FAILED — ${errors} issue(s) found. Fix before building.\n`);
  process.exit(1);
} else {
  console.log('✅ Bundle health check passed — safe to build.\n');
  process.exit(0);
}
