/**
 * audit-client-errors.mjs — is anything failing out there that nobody noticed?
 *
 * resilience.js fires reportDegraded() the moment a FALLBACK tier wins, because
 * "a fallback tier succeeding is not success — it means the intended path is
 * dead and nobody noticed." App.js routes that into client_errors via the drift
 * reporter. The problem: NOTHING read that table. The alarm built to catch
 * silent breakage was itself silent — the 2026-07-19 sweep found 48 missing
 * RPCs exactly because a lower tier had been quietly covering for years.
 *
 * This is the read side. It calls client_error_status() (aggregates only — no
 * user ids, no messages) and fails when the app is running on fallbacks.
 *
 * Thresholds are deliberately not zero: a handful of transient errors in a day
 * is normal for a mobile client on bad networks, and a guard that is always red
 * gets ignored (same reasoning as audit-schema.mjs).
 *
 * Usage:  node scripts/audit-client-errors.mjs
 * Env:    SUPABASE_URL, SUPABASE_ANON_KEY  (falls back to .env for local runs)
 */
import { readFileSync, existsSync } from 'fs';

function env(name, ...alts) {
  for (const k of [name, ...alts]) if (process.env[k]) return process.env[k];
  if (existsSync('.env')) {
    const raw = readFileSync('.env', 'utf8');
    for (const k of [name, ...alts]) {
      const m = raw.match(new RegExp(`^${k}=(.+)$`, 'm'));
      if (m) return m[1].trim();
    }
  }
  return null;
}

const URL = env('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
const KEY = env('SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY');

// In CI, missing credentials is a BROKEN SENSOR, not a clean run — a watchdog
// that reports healthy while blindfolded is worse than no watchdog. Locally
// (no CI env var) it stays a skip so the script is still runnable offline.
if (!URL || !KEY) {
  if (process.env.CI) {
    console.error('::error::Supabase URL/key missing — the client-error sensor cannot see the database.');
    process.exitCode = 1;
  } else {
    console.log('Supabase URL/key not available — skipping client-error audit.');
  }
} else {
  // A degraded path means the PRIMARY is broken and a fallback is carrying it.
  // That is the signal worth waking someone for, so its budget is tight.
  const LIMITS = {
    degraded: 1,   // any degraded path at all is a broken primary
    drift: 1,      // schema drift = the query no longer matches the database
    circuit_open: 5,
  };

  const r = await fetch(`${URL.replace(/\/$/, '')}/rest/v1/rpc/client_error_status`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_hours: 24 }),
  });

  // NB: set process.exitCode and fall through rather than process.exit() — on
  // Windows, exiting while fetch's handles are still closing trips a libuv
  // assertion (exit 127), which would make the watchdog itself look broken.
  if (r.status === 404) {
    console.log('::notice::client_error_status() not deployed yet (supabase/queries/client_error_status.sql) — nothing to audit.');
  } else if (!r.ok) {
    console.error(`::error::client_error_status() returned HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    process.exitCode = 1;
  } else {
    const s = await r.json();
    console.log('Client error status:', JSON.stringify(s, null, 2));

    const problems = [];
    for (const [key, limit] of Object.entries(LIMITS)) {
      const n = Number(s?.[key] || 0);
      if (n >= limit) problems.push(`${key}: ${n} in the last ${s.window_hours}h (limit ${limit})`);
    }

    if (problems.length) {
      console.error('::error::The app is running on fallbacks — a primary path is broken:');
      for (const p of problems) console.error(`::error::  • ${p}`);
      const top = Array.isArray(s.top_labels) ? s.top_labels.slice(0, 5) : [];
      for (const t of top) console.error(`::error::    ${t.label} ×${t.count}`);
      process.exitCode = 1;
    } else {
      console.log(`✅ No degraded paths or schema drift reported by clients in the last ${s.window_hours}h (${s.total} total errors).`);
    }
  }
}
