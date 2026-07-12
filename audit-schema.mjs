import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const KEY = readFileSync('.env', 'utf8').match(/eyJ[A-Za-z0-9_.-]{40,}/)[0];
const B = 'https://feevvddvrjmfbhffccbf.supabase.co/rest/v1';

function walk(dir, acc = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(js|ts|tsx)$/.test(p)) acc.push(p);
  }
  return acc;
}

// Extract  .from('table') ... .select('cols')
const pairs = new Map();
for (const f of walk('src')) {
  const src = readFileSync(f, 'utf8');
  const re = /\.from\(\s*['"`]([a-z_0-9]+)['"`]\s*\)([\s\S]{0,400}?)\.select\(\s*['"`]([^'"`]*)['"`]/g;
  let m;
  while ((m = re.exec(src))) {
    const table = m[1];
    const sel = m[3];
    if (!sel || sel.trim() === '*') continue;
    const key = table + '||' + sel;
    if (!pairs.has(key)) pairs.set(key, { table, sel, file: f.split('\\').join('/') });
  }
}

console.log('Validating ' + pairs.size + ' distinct table+select queries against the LIVE database...\n');

const broken = [];
for (const { table, sel, file } of pairs.values()) {
  const url = B + '/' + table + '?select=' + encodeURIComponent(sel) + '&limit=1';
  try {
    const r = await fetch(url, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
    if (r.status === 400 || r.status === 404) {
      const j = await r.json().catch(() => ({}));
      broken.push({ status: r.status, table, file, msg: (j.message || '').slice(0, 100), sel: sel.slice(0, 55) });
    }
  } catch (e) { /* network */ }
}

if (!broken.length) {
  console.log('✅ No broken queries found.');
} else {
  console.log('🔴 ' + broken.length + ' BROKEN QUERIES (silently failing in production):\n');
  for (const b of broken) {
    console.log('[' + b.status + '] ' + b.table);
    console.log('      ' + b.msg);
    console.log('      ' + b.file);
    console.log('');
  }
}
