import fs from 'fs';
import path from 'path';

function walk(dir) {
  let files = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== 'node_modules' && ent.name !== '.git' && ent.name !== 'dist') {
      files = files.concat(walk(full));
    } else if (ent.isFile() && (ent.name.endsWith('.js') || ent.name.endsWith('.jsx'))) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = walk('src');

for (const f of allFiles) {
  const code = fs.readFileSync(f, 'utf8');
  const lines = code.split('\n');
  lines.forEach((l, idx) => {
    if (l.includes('accessibilityRole="button"') || l.includes("accessibilityRole='button'")) {
      const prev = lines.slice(Math.max(0, idx - 20), idx + 1).join('\n');
      const match = prev.match(/<([A-Za-z0-9_.]+)[^>]*?accessibilityRole=['"]button['"]/s);
      const tag = match ? match[1] : 'unknown';
      if (tag === 'View') {
        const after = lines.slice(idx, Math.min(lines.length, idx + 40)).join('\n');
        const hasNestedBtn = after.includes('<TouchableOpacity') || after.includes('<Pressable') || after.includes('accessibilityRole="button"') || after.includes("accessibilityRole='button'");
        console.log(`${f}:${idx + 1}: View with accessibilityRole="button" ${hasNestedBtn ? '[CONTAINS NESTED BUTTON]' : '[leaf]'}`);
      }
    }
  });
}
