#!/usr/bin/env node
/**
 * db-reachability.mjs — is the database actually there?
 *
 * WHY THIS EXISTS. When the Supabase project is paused, every data call from
 * the live site fails, so health-check.mjs reports "JS errors" and "failing
 * requests" and Guardian raises an alarm about CLIENT ERRORS. That sends you
 * into the app code looking for a bug that isn't there. The cause is one line
 * in the Supabase dashboard.
 *
 * This runs first and names the cause, so the alarm is actionable:
 *
 *     PAUSED       — free-tier projects pause after ~7 days of no activity.
 *                    Data is retained; restore it from the dashboard.
 *     UNREACHABLE  — DNS or network. Project deleted, or an outage.
 *     UNAUTHORIZED — the project is up but the anon key is wrong or rotated.
 *     NO_CREDENTIALS — the workflow has no URL/key, so nothing was checked.
 *     OK           — reachable and answering.
 *
 * It also doubles as a keep-warm ping: a real request against the REST endpoint
 * is activity, and activity is what stops a free-tier project pausing in the
 * first place.
 *
 * Exit 0 = reachable. Exit 1 = not, with the reason on stdout and as a
 * GitHub ::error:: annotation.
 */

const env = (...names) => { for (const n of names) if (process.env[n]) return process.env[n]; return null; };
const URL_  = env('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
const KEY   = env('SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
const STRICT = process.env.GUARDIAN_STRICT === '1' || process.env.GITHUB_EVENT_NAME === 'schedule';

function fail(state, message, remedy) {
  console.log(`\n🔴 DATABASE ${state}\n`);
  console.log(`  ${message}`);
  if (remedy) console.log(`\n  → ${remedy}`);
  console.log(`::error::Database ${state}: ${message}`);
  process.exit(1);
}

if (!URL_ || !KEY) {
  const msg = 'No SUPABASE_URL / SUPABASE_ANON_KEY available, so the database was never contacted.';
  const remedy = 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY as repository secrets.';
  if (STRICT) {
    // On the unattended schedule this must be loud. A monitor that silently
    // checks nothing is worse than no monitor: it reports green forever.
    // It also means Guardian never touches the database — and those 6-hourly
    // requests are what keep a free-tier project from pausing.
    fail('NOT CHECKED', msg, remedy);
  }
  console.log(`::notice::${msg} ${remedy}`);
  process.exit(0);
}

const started = Date.now();
let res, netErr;
try {
  res = await fetch(`${URL_}/rest/v1/`, {
    method: 'GET',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    signal: AbortSignal.timeout(20000),
  });
} catch (e) {
  netErr = e;
}
const ms = Date.now() - started;

if (netErr) {
  const m = String(netErr.message || netErr);
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(m)) {
    fail('UNREACHABLE',
      `DNS lookup failed for ${URL_} (${m}).`,
      'The project may have been deleted. Check the Supabase dashboard.');
  }
  fail('UNREACHABLE', `Could not reach ${URL_} after ${ms}ms (${m}).`,
    'Check the Supabase status page and the project dashboard.');
}

const body = await res.text().catch(() => '');
const looksPaused = res.status === 503 || res.status === 540
  || /paused|inactiv|project is not active/i.test(body);

if (looksPaused) {
  fail('PAUSED',
    `${URL_} answered ${res.status} — the project is paused.`,
    'Free-tier projects pause after ~7 days without activity. Data is retained. '
  + 'Restore it in the Supabase dashboard, then re-run Guardian. '
  + 'Every data call from the live site fails until you do, which is what the '
  + 'client-error alarms are actually reporting.');
}

if (res.status === 401 || res.status === 403) {
  fail('UNAUTHORIZED',
    `${URL_} answered ${res.status} — reachable, but the key was rejected.`,
    'The anon key was probably rotated. Update the repository secret and the deploy env.');
}

if (!res.ok && res.status >= 500) {
  fail('UNHEALTHY', `${URL_} answered ${res.status} after ${ms}ms.`,
    'Check the Supabase status page.');
}

console.log(`✅ Database reachable — ${URL_} answered ${res.status} in ${ms}ms.`);
console.log('   (this request also counts as activity, which is what keeps a free-tier project awake)');
process.exit(0);
