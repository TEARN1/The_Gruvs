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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Classification helpers ────────────────────────────────────────────────────

// 4xx errors are the caller's fault — no point retrying, bail immediately.
const isFatal = (err) => {
  const status = err?.status ?? err?.code ?? err?.statusCode;
  if (typeof status === 'number') return status >= 400 && status < 500;
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('permission denied') || msg.includes('invalid input');
};

// Transient errors are worth retrying.
const isTransient = (err) => {
  const status = err?.status ?? err?.code ?? err?.statusCode;
  if (typeof status === 'number') return status >= 500 || status === 429;
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('network') || msg.includes('timeout') ||
         msg.includes('fetch') || msg.includes('aborted') ||
         msg.includes('econnreset') || msg.includes('socket');
};

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
const PG_SCHEMA_CODES = new Set([
  '42703', // undefined_column
  '42P01', // undefined_table
  '42883', // undefined_function
  '42P10', // invalid_column_reference
]);

export const isSchemaMiss = (err) => {
  const code = err?.code;
  if (typeof code === 'string') {
    if (/^PGRST2\d\d$/i.test(code)) return true;      // PostgREST schema cache
    if (PG_SCHEMA_CODES.has(code.toUpperCase())) return true; // Postgres itself
  }
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('schema cache') ||
         msg.includes('could not find the function') ||
         msg.includes('could not find a relationship') ||
         msg.includes('does not exist');
};

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

// ─── Core resilience primitive ─────────────────────────────────────────────────

/**
 * Run `fn` up to `maxAttempts` times with exponential backoff + jitter.
 * Returns the result on the first success; throws on final failure.
 *
 * @param {() => Promise<any>} fn          — async operation to attempt
 * @param {number}             maxAttempts — max tries (default 3)
 * @param {number}             baseMs      — base delay in ms (default 300)
 * @param {string}             label       — for logging
 */
export async function attemptWithBackoff(fn, maxAttempts = 3, baseMs = 300, label = 'op') {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await fn(i);
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
async function runTier(fn, attemptsPerTier, baseMs, tierLabel) {
  try {
    const value = await attemptWithBackoff(fn, attemptsPerTier, baseMs, tierLabel);
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/**
 * 3-Tier Hierarchical Fallback Cascade.
 *
 * @param {Array<() => Promise<any>>} tiers            — [primary, secondary, tertiary]
 * @param {object}                    opts
 * @param {number}                    opts.attemptsPerTier — retries within each tier (default 3)
 * @param {number}                    opts.baseMs          — base backoff delay in ms (default 300)
 * @param {string}                    opts.label           — debug label for logs
 * @param {() => Promise<any>}        opts.onExhausted     — "mother" escalation if all 3 tiers fail
 * @param {any}                       opts.fallbackValue   — static value to return if even mother fails
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
  } = opts;

  const tierNames = ['primary', 'secondary', 'tertiary', 'quaternary', 'quinary'];

  let firstError = null;

  for (let t = 0; t < tiers.length; t++) {
    const result = await runTier(tiers[t], attemptsPerTier, baseMs, `${label}:${tierNames[t] ?? `tier${t + 1}`}`);
    if (result.ok) {
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

  // ── ALL TIERS EXHAUSTED: call the "mother" escalation ─────────────────────
  if (onExhausted) {
    try {
      // Mother itself is resilient — give it its own retry budget
      return await attemptWithBackoff(onExhausted, attemptsPerTier, baseMs * 2, `${label}:mother`);
    } catch {
      return fallbackValue;
    }
  }

  return fallbackValue;
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
    }
  );
}
