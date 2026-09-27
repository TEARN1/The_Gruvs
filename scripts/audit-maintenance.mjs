/**
 * audit-maintenance.mjs — is the platform still cleaning up after itself?
 *
 * audit-schema.mjs asks "does the code match the database?". This asks the
 * follow-up nobody asks until it's a subpoena: "did the maintenance actually
 * RUN?" data_retention.sql promises location data is purged (live_checkins
 * 90d, path_crossings 30d — POPIA s.14). A pg_cron job that silently stops
 * keeps that promise broken indefinitely, and nothing else would ever notice.
 *
 * Calls the maintenance_status() RPC (supabase/queries/maintenance_status.sql)
 * and fails loudly when:
 *   • the oldest presence row exceeds its retention window + slack
 *   • pg_cron thinks a job is active but its last run FAILED
 *
 * Until the RPC / retention SQL are deployed it reports and exits 0 — an
 * advisory, not a tripwire, so it can ship ahead of the SQL runbook without
 * turning Guardian permanently red (a guard that is always red gets ignored;
 * see audit-schema.mjs).
 *
 * Usage:  node scripts/audit-maintenance.mjs
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

if (!URL || !KEY) {
  // See audit-schema.mjs: green-while-blind is the failure mode this guard
  // exists to prevent, so in CI a missing key fails instead of passing.
  if (process.env.CI) {
    console.error('::error::Supabase URL/key missing — the maintenance sensor cannot see the database.');
    process.exit(1);
  }
  console.log('Supabase URL/key not available — skipping maintenance audit (local run).');
  process.exit(0);
}

// Retention windows from data_retention.sql, plus slack for scheduling gaps —
// a daily purge that last ran yesterday must not page anyone.
const WINDOWS = [
  { field: 'checkins_oldest_days',  limit: 90 + 3, label: 'live_checkins (90d retention)' },
  { field: 'crossings_oldest_days', limit: 30 + 3, label: 'path_crossings (30d retention)' },
];

// Per-level staleness (maintenance_levels.sql): cadence tracks consequence.
// L1 is the legal/safety layer (daily, strict); L2 is hygiene (weekly, lenient).
const LEVELS = [
  { key: 'L1', cadence: 'daily',  maxDays: 1 + 3,  strict: true  },
  { key: 'L2', cadence: 'weekly', maxDays: 7 + 14, strict: false },
];

const r = await fetch(`${URL.replace(/\/$/, '')}/rest/v1/rpc/maintenance_status`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: '{}',
});

// NB: set process.exitCode and fall through rather than process.exit() — on
// Windows, exiting while fetch's handles are still closing trips a libuv
// assertion (exit 127), which would make the watchdog itself look broken.
if (r.status === 404) {
  console.log('::notice::maintenance_status() not deployed yet (supabase/queries/maintenance_status.sql) — nothing to audit.');
} else if (!r.ok) {
  // A malformed response is ITS OWN failure — don't let the watchdog rot silently.
  console.error(`::error::maintenance_status() returned HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  process.exitCode = 1;
} else {

  const s = await r.json();
  console.log('Maintenance status:', JSON.stringify(s, null, 2));

  const problems = [];

  // ── Per-level paper trail (maintenance_levels.sql) ────────────────────────
  if (s.levels_deployed) {
    for (const { key, cadence, maxDays, strict } of LEVELS) {
      const run = s.levels?.[key];
      const report = strict
        ? (m) => problems.push(m)
        : (m) => console.log(`::warning::${m}`);
      if (!run) {
        report(`${key} (${cadence}) has NEVER run. Is pg_cron enabled and the job scheduled?`);
      } else if (run.ok === false) {
        report(`${key}'s last run FAILED: ${JSON.stringify(run.detail?.error || run.detail).slice(0, 150)}`);
      } else if (Number(run.last_run_days_ago) > maxDays) {
        report(`${key} (${cadence}) last ran ${run.last_run_days_ago}d ago (max ${maxDays}) — maintenance has stalled.`);
      }
    }
    // Overdue account deletions are a promise broken to a specific person —
    // always strict, regardless of level plumbing.
    if (Number(s.deletions_overdue) > 0) {
      problems.push(`${s.deletions_overdue} account deletion(s) past the 30d grace window and NOT executed.`);
    }
  } else {
    console.log('::notice::maintenance_levels.sql not deployed — per-level tracking unavailable, falling back to data-age checks.');
  }

  if (!s.retention_deployed) {
    console.log('::notice::data_retention.sql not deployed — retention windows not yet enforceable. (Runbook Part 1, item 2.)');
  } else {
    for (const { field, limit, label } of WINDOWS) {
      const days = Number(s[field]);
      if (Number.isFinite(days) && days > limit) {
        problems.push(`${label}: oldest row is ${days} days old (limit ${limit}) — the purge is NOT running.`);
      }
    }
    if (!s.cron_enabled) {
      console.log('::warning::pg_cron is not enabled — purges only happen when run by hand. Enable the extension in the dashboard.');
    }
  }

  for (const job of s.cron_jobs || []) {
    if (job.active && job.last_status && job.last_status !== 'succeeded') {
      problems.push(`pg_cron job '${job.name}' is active but its last run ${job.last_status} (${job.last_run_days_ago}d ago).`);
    }
  }

  if (problems.length) {
    for (const p of problems) console.error(`::error::${p}`);
    console.error(`\n🔴 MAINTENANCE STALLED — ${problems.length} problem(s). The platform has stopped cleaning up after itself.`);
    process.exitCode = 1;
  } else {
    console.log('✅ Maintenance is running: retention windows hold and scheduled jobs are healthy.');
  }
}
