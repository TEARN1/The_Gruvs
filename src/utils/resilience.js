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
        if (isFatal(result.error)) return result; // don't retry bad inputs
        lastErr = result.error;
      } else {
        return result;
      }
    } catch (err) {
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

  for (let t = 0; t < tiers.length; t++) {
    const result = await runTier(tiers[t], attemptsPerTier, baseMs, `${label}:${tierNames[t] ?? `tier${t + 1}`}`);
    if (result.ok) return result.value;
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
