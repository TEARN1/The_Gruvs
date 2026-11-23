import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const dirs = [
  path.join(ROOT, 'src', 'screens'),
  path.join(ROOT, 'src', 'components'),
  path.join(ROOT, 'src', 'navigation'),
];

console.log('🔍 [ONCLICK AUDIT] Scanning all onPress and onClick handlers across codebase...\n');

let totalHandlers = 0;
const issues = [];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/onPress\s*=\s*\{/i.test(line) || /onClick\s*=\s*\{/i.test(line)) {
      totalHandlers++;
      const context = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 6)).join('\n');

      // Check 1: Direct un-chained prop callback (e.g. onPress={() => onOpen(id)} without ?.)
      const propCallMatch = line.match(/onPress\s*=\s*\{\s*\(\s*\)\s*=>\s*([a-zA-Z0-9_]+)\(/);
      if (propCallMatch) {
        const fnName = propCallMatch[1];
        if (/^on[A-Z]/.test(fnName) || /^handle[A-Z]/.test(fnName)) {
          // Check if file uses optional chaining or if fn is a required prop
          if (!line.includes(`${fnName}?.`) && !content.includes(`if (!${fnName})`)) {
            // Check if fnName is a destructured prop with no default
            const destructureMatch = content.match(new RegExp(`\\{[^}]*\\b${fnName}\\b[^}]*\\}\\s*=\\s*props`)) ||
                                     content.match(new RegExp(`const\\s*\\{[^}]*\\b${fnName}\\b[^}]*\\}\\s*=`)) ||
                                     content.match(new RegExp(`\\(\\s*\\{[^}]*\\b${fnName}\\b[^}]*\\}\\s*\\)`));
            if (destructureMatch && !destructureMatch[0].includes(`${fnName} =`)) {
              issues.push({
                type: 'UNGUARDED_CALLBACK',
                file: relPath,
                line: i + 1,
                code: line.trim(),
                detail: `Callback prop "${fnName}" called directly without optional chaining "${fnName}?.()". If parent omits prop, tap crashes with TypeError: ${fnName} is not a function.`,
              });
            }
          }
        }
      }

      // Check 2: Unsafe navigation call
      if (/navigation\.navigate\(/i.test(line) && !/navigation\?\.navigate/i.test(line) && !/navigation\s*&&/i.test(line)) {
        issues.push({
          type: 'UNGUARDED_NAVIGATION',
          file: relPath,
          line: i + 1,
          code: line.trim(),
          detail: 'Direct navigation.navigate() call without null check or navigation?.navigate().',
        });
      }

      // Check 3: Deep property access in onPress without optional chaining
      const deepAccessMatch = line.match(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/);
      if (deepAccessMatch && !line.includes('?.') && !/React\.|Platform\.|styles\.|Dimensions\./.test(deepAccessMatch[0])) {
        // Potential deep access
      }
    }
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      walkDir(full);
    } else if (/\.(js|jsx|ts|tsx)$/.test(f)) {
      checkFile(full);
    }
  }
}

dirs.forEach(walkDir);

console.log(`Scanned ${totalHandlers} total button / touchable handlers.\n`);

if (issues.length > 0) {
  console.log(`⚠️  Found ${issues.length} potential onclick crash patterns:\n`);
  issues.forEach((iss, idx) => {
    console.log(`${idx + 1}. [${iss.type}] ${iss.file}:${iss.line}`);
    console.log(`   Code:   ${iss.code}`);
    console.log(`   Detail: ${iss.detail}\n`);
  });
} else {
  console.log('✅ No unguarded callbacks or crash patterns detected.');
}
