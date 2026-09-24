/**
 * The Gruvs — Hierarchical Resilience Engine
 *
 * Every critical operation runs through a 3-tier fallback cascade:
 *   Tier 1 (Primary)   — full-featured, ideal path
 *   Tier 2 (Secondary) — simplified / degraded-mode path
 *   Tier 3 (Tertiary)  — cache-only / offline-safe path
 *
 * Each tier gets up to `attemptsPerTier` tries with exponential backoff.
 * If all 3 tiers are exhausted, an optional `onExhausted` (the "mother")
 * is called — itself a resilient function with its own 3-tier strategy.
 *
 * Usage:
 *   const events = await resilient(
 *     [primaryFetch, simplifiedFetch, cachedFetch],
 *     { onExhausted: staticFallback, label: 'FeedManager.fetchPage' }
 *   );
 */

import { _internal as classifier } from './failureClassifier';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// A single attempt may NEVER hang forever — a stalled request with no timeout is
// the #1 cause of screens that "load and never stop". Race every attempt against
// a timeout so it rejects, retries, and ultimately falls back — the UI always
// resolves to data, empty, or error, never an infinite spinner.
const ATTEMPT_TIMEOUT_MS = 12000;

// Ceiling on a whole read cascade (all tiers + escalation), not one attempt.
// See the overallDeadlineMs note in resilient() for why reads get this and
// writes deliberately do not.
const READ_DEADLINE_MS = 15000;
export function withTimeout(value, ms = ATTEMPT_TIMEOUT_MS, label = 'request') {
  let to;
  const timer = new Promise((_, reject) => { to = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms); });
  return Promise.race([Promise.resolve(value).finally(() => clearTimeout(to)), timer]);
}

// ─── Classification helpers ────────────────────────────────────────────────────
//
// These now delegate to failureClassifier.js — the one shared vocabulary every
// tier (render boundary, global handler, data layer) uses to decide "what kind
// of failure is this." Kept as local names/signatures so nothing below this
// line, or any external caller, has to change.

// 4xx errors are the caller's fault — no point retrying, bail immediately.
const isFatal = (err) => classifier.isFatalInput(err);

// Transient errors are worth retrying.
const isTransient = (err) => classifier.isTransient(err);

// Schema drift — the query names a table/column/relationship the database does
// not have. Permanent for THIS tier (retrying never helps), but the NEXT fallback
// tier still should run, so these are deliberately NOT "fatal" (fatal skips the
// whole cascade).
//
// This used to only match PostgREST's PGRST2xx codes. Postgres' own schema errors
// (42703 undefined_column, 42P01 undefined_table, 42883 undefined_function) fell
// through EVERY classifier — not fatal, not transient, not a schema miss — so they
// were treated as unknown-retryable: 9 doomed requests, then a silent null. That is
// exactly how 24 broken queries rotted in production unnoticed. They are now
// classified AND logged loudly (see reportSchemaMiss) so drift can never hide again.
export const isSchemaMiss = (err) => classifier.isSchemaMiss(err);

// Schema drift is a BUG, not a runtime condition — never let it fail quietly.
//
// console.error alone was not enough: it is invisible in production, which is
// how 48 missing RPCs and 14 missing columns survived unnoticed (2026-07-19
// sweep). A reporter can be injected so drift ALSO lands in client_errors and
// can be read back. Injected rather than imported to keep this module free of
// a supabase dependency (it is imported almost everywhere).
let _driftReporter = null;

/**
 * Register a sink for drift + degradation events, e.g.
 *   setDriftReporter((label, err, kind) => logError(`${kind}:${label}`, err));
 * Pass null to disable. Never called more than once per unique problem.
 */
export function setDriftReporter(fn) {
  _driftReporter = typeof fn === 'function' ? fn : null;
}

const _seenMiss = new Set();
const reportOnce = (key, consoleMsg, label, err, kind) => {
  if (_seenMiss.has(key)) return;   // once per unique problem, not per retry
  _seenMiss.add(key);
  // eslint-disable-next-line no-console
  console.error(consoleMsg);
  if (_driftReporter) {
    try { _driftReporter(label, err, kind); } catch { /* telemetry is never load-bearing */ }
  }
};

const reportSchemaMiss = (err, label) => {
  reportOnce(
    `miss|${label}|${err?.code}|${err?.message}`,
    `[SCHEMA DRIFT] ${label}: ${err?.message || err}` +
      (err?.code ? ` (code ${err.code})` : '') +
      ' — the query does not match the database. This feature is BROKEN, not empty.',
    label, err, 'SCHEMA_DRIFT'
  );
};

// A fallback tier succeeding is not success — it means the intended path is
// dead and nobody noticed. Every bug in the 2026-07-19 sweep looked "fine"
// precisely because a lower tier quietly covered for a broken tier 1.
const reportDegraded = (label, tierIndex, err) => {
  reportOnce(
    `degraded|${label}|${tierIndex}`,
    `[DEGRADED] ${label}: tier ${tierIndex + 1} succeeded, but tier 1 failed` +
      (err?.message ? ` (${err.message})` : '') +
      ' — the primary path is broken; this is working by fallback only.',
    label, err, 'DEGRADED_PATH'
  );
};

// ─── Circuit breaker ────────────────────────────────────────────────────────
//
// resilient() used to re-attempt every tier, full backoff and all, on EVERY
// call — including the 50th call in a row against a table that's been down
// for a minute. That's not resilience, it's noise: it stacks latency onto a
// user action that was always going to fail, and hammers a confirmed-dead
// endpoint. If a label has fully exhausted its cascade CIRCUIT_THRESHOLD
// times within CIRCUIT_WINDOW_MS, the breaker "opens": subsequent calls skip
// straight to fallbackValue with no network attempt at all.
//
// A fully-blocking open breaker can never recover on its own — nothing gets
// through to prove the endpoint is back, so it can only close by the window
// aging out (up to CIRCUIT_WINDOW_MS of blind fallback-only behavior even
// after the real fix ships). Real half-open behavior instead: once open, let
// exactly one PROBE call through per PROBE_INTERVAL_MS. A probe that
// succeeds closes the circuit immediately; a probe that fails counts as
// another failure and keeps it open.
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_WINDOW_MS = 60_000;
const PROBE_INTERVAL_MS = 15_000;
const _circuitFailures = new Map(); // label -> number[] (failure timestamps)
const _circuitLastProbe = new Map(); // label -> timestamp of last probe let through

function isOpenState(label) {
  const times = _circuitFailures.get(label);
  if (!times) return false;
  const cutoff = Date.now() - CIRCUIT_WINDOW_MS;
  const recent = times.filter((t) => t > cutoff);
  if (recent.length !== times.length) _circuitFailures.set(label, recent);
  return recent.length >= CIRCUIT_THRESHOLD;
}

/** true = short-circuit to fallbackValue now; false = proceed (normal OR probe). */
function circuitIsOpen(label) {
  if (!isOpenState(label)) return false;
  const lastProbe = _circuitLastProbe.get(label) || 0;
  if (Date.now() - lastProbe >= PROBE_INTERVAL_MS) {
    _circuitLastProbe.set(label, Date.now()); // this call IS the probe — let it through
    return false;
  }
  return true; // open, and not yet due for another probe
}

function recordCircuitFailure(label) {
  const times = _circuitFailures.get(label) || [];
  times.push(Date.now());
  _circuitFailures.set(label, times);
  // Every failure — including the one that opens the circuit — counts as
  // "just probed and it's still bad," so the cooldown starts from the most
  // recent evidence, not from an unset 0 that would let the very next call
  // straight through as an accidental immediate probe.
  _circuitLastProbe.set(label, Date.now());
}

function recordCircuitSuccess(label) {
  _circuitFailures.delete(label);
  _circuitLastProbe.delete(label);
}

const _seenCircuitOpen = new Set();
function reportCircuitOpen(label) {
  if (_seenCircuitOpen.has(label)) return;
  _seenCircuitOpen.add(label);
  // eslint-disable-next-line no-console
  console.error(
    `[CIRCUIT OPEN] ${label}: failed its full cascade ${CIRCUIT_THRESHOLD}+ times in the ` +
    `last ${CIRCUIT_WINDOW_MS / 1000}s — skipping network attempts and returning the ` +
    'fallback directly until it recovers.'
  );
  if (_driftReporter) {
    try { _driftReporter(label, new Error('circuit open'), 'CIRCUIT_OPEN'); } catch { /* never load-bearing */ }
  }
  // Self-clear the dedupe so a LATER re-open (after recovering and breaking
  // again) still gets reported instead of going silent forever.
  setTimeout(() => _seenCircuitOpen.delete(label), CIRCUIT_WINDOW_MS);
}

// Exposed for the GodViewDashboard resilience panel (Layer 4) and tests —
// read-only snapshot of which labels are currently short-circuited.
export function getOpenCircuits() {
  const cutoff = Date.now() - CIRCUIT_WINDOW_MS;
  const open = [];
  for (const [label, times] of _circuitFailures.entries()) {
    if (times.filter((t) => t > cutoff).length >= CIRCUIT_THRESHOLD) open.push(label);
  }
  return open;
}

// ─── Core resilience primitive ─────────────────────────────────────────────────

/**
 * Run `fn` up to `maxAttempts` times with exponential backoff + jitter.
 * Returns the result on the first success; throws on final failure.
 *
 * @param {() => Promise<any>} fn          — async operation to attempt. Called
 *                              as fn(attemptIndex, { idempotencyKey }) — extra
 *                              args are safely ignored by existing tiers that
 *                              take no parameters.
 * @param {number}             maxAttempts — max tries (default 3)
 * @param {number}             baseMs      — base delay in ms (default 300)
 * @param {string}             label       — for logging
 * @param {string|null}        idempotencyKey — see resilient()'s opts.idempotencyKey
 */
export async function attemptWithBackoff(fn, maxAttempts = 3, baseMs = 300, label = 'op', idempotencyKey = null) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await withTimeout(fn(i, { idempotencyKey }), ATTEMPT_TIMEOUT_MS, label);
      // Supabase pattern: { data, error } — treat error as thrown
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        // Schema drift can never succeed by retrying — surface it and move on
        // to the next tier immediately.
        if (isSchemaMiss(result.error)) {
          reportSchemaMiss(result.error, label);
          throw result.error;
        }
        if (isFatal(result.error)) throw result.error; // don't retry bad inputs
        lastErr = result.error;
      } else {
        return result;
      }
    } catch (err) {
      // Missing RPC/table/column: this tier can never succeed, so stop retrying
      // and let resilient() fall through to the next tier (it isn't "fatal", so
      // the cascade continues instead of aborting).
      if (isSchemaMiss(err)) { reportSchemaMiss(err, label); throw err; }
      if (isFatal(err)) throw err; // bail immediately on 4xx / permission
      lastErr = err;
    }
    if (i < maxAttempts - 1) {
      const jitter = Math.random() * baseMs * 0.4;
      await sleep(baseMs * Math.pow(2, i) + jitter);
    }
  }
  throw lastErr ?? new Error(`${label} failed after ${maxAttempts} attempts`);
}

/**
 * Run a single tier (a function) with up to `attemptsPerTier` tries.
 * Returns { ok: true, value } on success or { ok: false, error } on failure.
 */
async function runTier(fn, attemptsPerTier, baseMs, tierLabel, idempotencyKey) {
  try {
    const value = await attemptWithBackoff(fn, attemptsPerTier, baseMs, tierLabel, idempotencyKey);
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/**
 * 3-Tier Hierarchical Fallback Cascade.
 *
 * @param {Array<() => Promise<any>>} tiers            — [primary, secondary, tertiary].
 *   Each tier may accept (attemptIndex, { idempotencyKey }) — see opts.idempotencyKey.
 * @param {object}                    opts
 * @param {number}                    opts.attemptsPerTier — retries within each tier (default 3)
 * @param {number}                    opts.baseMs          — base backoff delay in ms (default 300)
 * @param {string}                    opts.label           — debug label for logs, and the
 *   circuit-breaker key (see getOpenCircuits())
 * @param {() => Promise<any>}        opts.onExhausted     — "mother" escalation if all 3 tiers fail
 * @param {any}                       opts.fallbackValue   — static value to return if even mother fails
 * @param {string}                    [opts.idempotencyKey] — a stable key (e.g. a client-generated
 *   UUID) passed to every tier so a write can be deduped if tier 1 actually
 *   succeeded server-side but the client never saw the ack (network drop
 *   post-write) and tier 2 gets attempted — the exact class of bug
 *   send_message_v2's client_key was built to close. Tiers that write should
 *   thread this into an `on conflict (idempotency_key) do nothing`-style
 *   upsert or an RPC arg; tiers that ignore it behave exactly as before.
 *
 * @returns {Promise<any>} — result from the first succeeding tier/strategy
 */
export async function resilient(tiers, opts = {}) {
  const {
    attemptsPerTier = 3,
    baseMs          = 300,
    label           = 'operation',
    onExhausted     = null,
    fallbackValue   = null,
    idempotencyKey  = null,
    overallDeadlineMs = null,
  } = opts;

  if (circuitIsOpen(label)) {
    reportCircuitOpen(label);
    return fallbackValue;
  }

  const tierNames = ['primary', 'secondary', 'tertiary', 'quaternary', 'quinary'];

  const runCascade = async () => {
    let firstError = null;

    for (let t = 0; t < tiers.length; t++) {
      const result = await runTier(tiers[t], attemptsPerTier, baseMs, `${label}:${tierNames[t] ?? `tier${t + 1}`}`, idempotencyKey);
      if (result.ok) {
        recordCircuitSuccess(label);
        // Succeeded on a FALLBACK tier: the intended path is broken. Say so.
        if (t > 0) reportDegraded(label, t, firstError);
        return result.value;
      }
      if (t === 0) firstError = result.error;
      // If transient, the next tier may succeed with a simpler strategy
      // If fatal, skip remaining tiers — wrong input, not a connectivity issue
      if (result.error && isFatal(result.error)) {
        if (onExhausted) break; // skip to escalation
        return fallbackValue;
      }
    }

    // ── ALL TIERS EXHAUSTED: call the "mother" escalation ───────────────────
    if (onExhausted) {
      try {
        // Mother itself is resilient — give it its own retry budget
        const value = await attemptWithBackoff(onExhausted, attemptsPerTier, baseMs * 2, `${label}:mother`, idempotencyKey);
        recordCircuitSuccess(label);
        return value;
      } catch {
        recordCircuitFailure(label);
        return fallbackValue;
      }
    }

    recordCircuitFailure(label);
    return fallbackValue;
  };

  if (!overallDeadlineMs || overallDeadlineMs <= 0) return runCascade();

  // Per-ATTEMPT timeouts alone leave the CASCADE unbounded: each tier can burn
  // 3 × 12 s plus backoff (~38 s), so three tiers plus the mother escalation is
  // ~153 s before the user is shown even an empty state. Nobody waits that long;
  // they conclude the app is broken and leave.
  //
  // This is strictly a CEILING on how long a caller waits. It never shortens a
  // successful path, so nothing that works today gets slower — it only converts
  // a two-and-a-half-minute spinner into a timely fallback.
  //
  // Deliberately opt-in rather than defaulted, because it is only safe for
  // READS. Abandoning a WRITE does not cancel it: the server may still commit,
  // so returning fallbackValue would report failure on a write that actually
  // succeeded and invite a duplicate on retry. Writes keep waiting for a real
  // answer (see resilientWrite, which does not pass this).
  let deadlineTimer = null;
  const clearDeadline = () => { if (deadlineTimer) { clearTimeout(deadlineTimer); deadlineTimer = null; } };
  const DEADLINE = Symbol('deadline'); // sentinel: can't collide with a real value
  const deadline = new Promise((resolve) => {
    deadlineTimer = setTimeout(() => resolve(DEADLINE), overallDeadlineMs);
  });

  const outcome = await Promise.race([
    runCascade().finally(clearDeadline),
    deadline,
  ]);

  if (outcome === DEADLINE) {
    // A backend too slow to answer within the ceiling is a failure signal — let
    // the circuit breaker see it so subsequent calls fail fast instead of each
    // paying the full deadline over again.
    recordCircuitFailure(label);
    return fallbackValue;
  }
  return outcome;
}

// ─── Pre-built strategy factories ─────────────────────────────────────────────

/**
 * Build a Supabase query tier with progressive field reduction.
 * Each tier queries fewer joined columns — less likely to fail on schema issues.
 *
 * Tier 1: full select with all joins
 * Tier 2: base table only, no profile join
 * Tier 3: minimal fields (id, title, created_at)
 */
export function supabaseQueryTiers(table, {
  fullSelect,
  simpleSelect,
  minimalSelect = 'id, created_at',
  buildQuery, // (supabaseRef, selectStr) => queryBuilder
}) {
  return [
    () => buildQuery(table, fullSelect),
    () => buildQuery(table, simpleSelect),
    () => buildQuery(table, minimalSelect),
  ];
}

/**
 * Cache-read tier — for use as tertiary or mother fallback.
 * Returns stale cached value without any network call.
 */
export function cacheTier(cache, key) {
  return () => {
    const stale = cache.getStale ? cache.getStale(key) : cache.get(key);
    if (stale !== null && stale !== undefined) return stale;
    throw new Error(`Cache miss: ${key}`);
  };
}

// ─── Convenience wrappers for common app patterns ─────────────────────────────

/**
 * wraps a plain async function with 3 self-healing attempts.
 * Drop-in replacement for the existing `withRetry`.
 */
export async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 300 } = {}) {
  return attemptWithBackoff(fn, maxAttempts, baseDelayMs, 'withRetry');
}

/**
 * Resilient write: try primary write, then a simplified upsert, then queue locally.
 * Prevents data loss when the network hiccups during a user action.
 *
 * @param {() => Promise} primaryWrite    — full insert/update
 * @param {() => Promise} fallbackWrite   — simpler upsert / partial save
 * @param {() => void}    localQueue      — queue the operation for retry (fire-and-forget)
 */
export async function resilientWrite(primaryWrite, fallbackWrite, localQueue, label = 'write') {
  return resilient(
    [
      primaryWrite,
      fallbackWrite ?? primaryWrite,
      localQueue ? () => { localQueue(); return { queued: true }; } : primaryWrite,
    ],
    {
      attemptsPerTier: 3,
      baseMs: 400,
      label,
      fallbackValue: { queued: true },
    }
  );
}

/**
 * Resilient read with automatic cache integration.
 * Tier 1: fresh network fetch → caches result
 * Tier 2: network fetch with minimal fields
 * Tier 3: stale cache
 * Mother: hardcoded static empty result (never crashes the UI)
 *
 * @param {() => Promise}  fetchFull     — primary network call
 * @param {() => Promise}  fetchSimple   — fallback network call (simpler query)
 * @param {() => any}      fromCache     — return cached value (throws if miss)
 * @param {any}            emptyResult   — mother fallback value (e.g. [])
 */
export async function resilientRead(fetchFull, fetchSimple, fromCache, emptyResult = [], label = 'read') {
  return resilient(
    [fetchFull, fetchSimple, fromCache],
    {
      attemptsPerTier: 3,
      baseMs: 300,
      label,
      onExhausted: () => emptyResult,
      fallbackValue: emptyResult,
      // Reads are safe to abandon: nothing is committed, and the caller already
      // has a meaningful answer to fall back on (emptyResult). 15 s is well past
      // any healthy response — the primary tier alone times out at 12 s — so a
      // read that hits this ceiling was never going to arrive usefully anyway.
      overallDeadlineMs: READ_DEADLINE_MS,
    }
  );
}
