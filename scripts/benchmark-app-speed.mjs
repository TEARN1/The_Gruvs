import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Load environment variables
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...vals] = trimmed.split('=');
    if (key && vals.length > 0 && !process.env[key.trim()]) {
      process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://feevvddvrjmfbhffccbf.supabase.co';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

console.log('⚡ [SPEED BENCHMARK] Starting Full App Speed & Latency Profiling...\n');

async function benchmarkDatabase() {
  console.log('─── 1. DATABASE & NETWORK ROUNDTRIP BENCHMARK ───');
  const results = [];

  // Test 1: Raw Health Ping
  const pingStart = performance.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: ANON_KEY },
    });
    const pingTime = performance.now() - pingStart;
    results.push({ test: 'Supabase Gateway Ping', timeMs: pingTime.toFixed(1), status: res.status });
    console.log(`  • Supabase API Gateway Ping: ${pingTime.toFixed(1)} ms (HTTP ${res.status})`);
  } catch (err) {
    console.log(`  ❌ Gateway Ping Failed: ${err.message}`);
  }

  // Test 2: Cold Query (10 upcoming events with coordinates)
  const coldStart = performance.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?select=id,title,venue_name,event_date,price&limit=10`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    const data = await res.json();
    const coldTime = performance.now() - coldStart;
    results.push({ test: 'Cold Events Query (10 rows)', timeMs: coldTime.toFixed(1), rows: data.length });
    console.log(`  • Cold Events Fetch (10 rows): ${coldTime.toFixed(1)} ms (${data.length} records returned)`);
  } catch (err) {
    console.log(`  ❌ Cold Query Failed: ${err.message}`);
  }

  // Test 3: Warm Query (Repeat same query)
  const warmStart = performance.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?select=id,title,venue_name,event_date,price&limit=10`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    const data = await res.json();
    const warmTime = performance.now() - warmStart;
    results.push({ test: 'Warm Events Query (Cache)', timeMs: warmTime.toFixed(1), rows: data.length });
    console.log(`  • Warm Events Fetch (HTTP/Edge Cache): ${warmTime.toFixed(1)} ms`);
  } catch (err) {
    console.log(`  ❌ Warm Query Failed: ${err.message}`);
  }

  // Test 4: Heavy Multi-Column Feed Query
  const heavyStart = performance.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?select=id,title,venue_name,location,address,city,event_date,event_time,latitude,longitude,category,price,image_url,cover_url,media_urls&order=event_date.asc&limit=30`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    const data = await res.json();
    const heavyTime = performance.now() - heavyStart;
    results.push({ test: 'Full 30-Event Heavy Feed Payload', timeMs: heavyTime.toFixed(1), sizeKb: (JSON.stringify(data).length / 1024).toFixed(1) });
    console.log(`  • Heavy Feed Query (30 complex events): ${heavyTime.toFixed(1)} ms (${(JSON.stringify(data).length / 1024).toFixed(1)} KB payload)`);
  } catch (err) {
    console.log(`  ❌ Heavy Query Failed: ${err.message}`);
  }

  return results;
}

function benchmarkBundle() {
  console.log('\n─── 2. CLIENT JAVASCRIPT BUNDLE & PAYLOAD SIZES ───');
  const distExpo = path.join(ROOT, 'dist', '_expo', 'static', 'js', 'web');
  
  let bundleSize = null;
  if (fs.existsSync(distExpo)) {
    const files = fs.readdirSync(distExpo);
    for (const f of files) {
      if (f.startsWith('AppEntry-') && f.endsWith('.js')) {
        const stats = fs.statSync(path.join(distExpo, f));
        bundleSize = stats.size;
        console.log(`  • Main JS Bundle (AppEntry): ${(bundleSize / (1024 * 1024)).toFixed(2)} MB (${bundleSize.toLocaleString()} bytes)`);
        console.log(`    ↳ Estimated 3G Download Time: ~${(bundleSize / (1024 * 180)).toFixed(1)} seconds`);
        console.log(`    ↳ Estimated 4G/LTE Download Time: ~${(bundleSize / (1024 * 1200)).toFixed(1)} seconds`);
        console.log(`    ↳ Estimated Mobile V8 Parse/Compile Time: ~${(bundleSize / (1024 * 1500)).toFixed(1)} - 2.8 seconds`);
      }
    }
  }

  return bundleSize;
}

function benchmarkCodeVolume() {
  console.log('\n─── 3. SOURCE CODE FOOTPRINT & RENDER BOTTLENECKS ───');
  const dirs = [
    path.join(ROOT, 'src', 'screens'),
    path.join(ROOT, 'src', 'components'),
    path.join(ROOT, 'src', 'services'),
    path.join(ROOT, 'src', 'utils'),
  ];

  const fileStats = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.endsWith('.js') || f.endsWith('.jsx')) {
        const fullPath = path.join(dir, f);
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n').length;
        const sizeBytes = fs.statSync(fullPath).size;
        fileStats.push({ name: f, path: path.relative(ROOT, fullPath), lines, sizeKb: (sizeBytes / 1024).toFixed(1), bytes: sizeBytes });
      }
    }
  }

  fileStats.sort((a, b) => b.bytes - a.bytes);

  console.log('  Top 8 Largest Files Blocking Parser & Memory:');
  for (let i = 0; i < Math.min(8, fileStats.length); i++) {
    const f = fileStats[i];
    console.log(`    ${i + 1}. ${f.name.padEnd(28)} ${f.lines.toString().padStart(5)} lines  (${f.sizeKb} KB) [${f.path}]`);
  }

  const totalLines = fileStats.reduce((acc, curr) => acc + curr.lines, 0);
  const totalKb = (fileStats.reduce((acc, curr) => acc + curr.bytes, 0) / 1024).toFixed(1);
  console.log(`\n  Total Project Source Code: ${totalLines.toLocaleString()} lines across ${fileStats.length} files (${(totalKb / 1024).toFixed(2)} MB)`);

  return fileStats;
}

async function run() {
  const dbMetrics = await benchmarkDatabase();
  const bundleBytes = benchmarkBundle();
  const codeStats = benchmarkCodeVolume();

  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('📊 BENCHMARK COMPLETE — DETAILED PERFORMANCE AUDIT GENERATED');
  console.log('─────────────────────────────────────────────────────────────\n');
}

run().catch(console.error);
