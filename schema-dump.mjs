import { readFileSync } from 'fs';
const KEY = readFileSync('.env', 'utf8').match(/eyJ[A-Za-z0-9_.-]{40,}/)[0];
const B = 'https://feevvddvrjmfbhffccbf.supabase.co/rest/v1/';

const r = await fetch(B, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Accept: 'application/openapi+json' } });
const spec = await r.json();

const want = process.argv.slice(2);
const defs = spec.definitions || {};
for (const t of want) {
  const d = defs[t];
  if (!d) { console.log('\n### ' + t + '  -> TABLE NOT FOUND'); continue; }
  const cols = Object.keys(d.properties || {});
  console.log('\n### ' + t);
  console.log('   ' + cols.join(', '));
}
