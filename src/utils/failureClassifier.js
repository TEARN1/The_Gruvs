/**
 * failureClassifier.js — one shared vocabulary for "what kind of failure is
 * this, and what should happen about it."
 *
 * Before this module, three different tiers each independently guessed at
 * classification: resilience.js's isFatal/isSchemaMiss/isTransient, an ad hoc
 * chunk-load check, and nothing at all for an expired session. A session
 * expiring, for instance, would be silently retried by the data layer, shown
 * as a generic "needs a moment" by the render layer, and never trigger a
 * re-login — three tiers, three different (wrong) responses to one cause.
 *
 * classify(err, context) is the single source of truth for WHAT broke.
 * RECOVERY[kind] is the single source of truth for WHAT SHOULD HAPPEN — every
 * tier (ErrorBoundary, resilience.js, errorReporter.js) looks the answer up
 * here instead of re-deciding it.
 */

export const FailureKind = Object.freeze({
  FATAL_INPUT:  'FATAL_INPUT',   // 4xx/validation — retrying is pointless
  SCHEMA_DRIFT: 'SCHEMA_DRIFT',  // column/table/RPC doesn't exist on the DB
  AUTH_EXPIRED: 'AUTH_EXPIRED',  // session invalid/expired
  TRANSIENT:    'TRANSIENT',     // network/5xx/timeout — worth retrying
  CHUNK_LOAD:   'CHUNK_LOAD',    // a React.lazy() import rejected
  VERSION_SKEW: 'VERSION_SKEW',  // confirmed stale bundle vs. live deploy
  UNKNOWN:      'UNKNOWN',
});

// What a tier should DO once it knows the kind. Every consumer looks this up
// instead of branching on the kind itself, so the response is consistent
// everywhere a failure of a given kind is handled.
export const Recovery = Object.freeze({
  REAUTH:   'REAUTH',     // send the user to sign-in, don't retry
  RELOAD:   'RELOAD',     // only a fresh page load can fix this
  ABORT:    'ABORT',      // don't retry, don't fall back — surface it now
  FALLBACK: 'FALLBACK',   // this tier is dead, try the next one, report loudly
  RETRY:    'RETRY',      // worth another attempt at the same tier
});

export const RECOVERY_FOR_KIND = Object.freeze({
  [FailureKind.AUTH_EXPIRED]: Recovery.REAUTH,
  [FailureKind.CHUNK_LOAD]:   Recovery.RELOAD,
  [FailureKind.VERSION_SKEW]: Recovery.RELOAD,
  [FailureKind.FATAL_INPUT]:  Recovery.ABORT,
  [FailureKind.SCHEMA_DRIFT]: Recovery.FALLBACK,
  [FailureKind.TRANSIENT]:    Recovery.RETRY,
  [FailureKind.UNKNOWN]:      Recovery.FALLBACK,
});

const PG_SCHEMA_CODES = new Set([
  '42703', // undefined_column
  '42P01', // undefined_table
  '42883', // undefined_function
  '42P10', // invalid_column_reference
]);

const AUTH_CODES = new Set(['401', 'PGRST301', 'JWT_EXPIRED']);

function isAuthExpired(err) {
  const status = err?.status ?? err?.statusCode;
  if (status === 401) return true;
  const code = String(err?.code || '');
  if (AUTH_CODES.has(code.toUpperCase())) return true;
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('jwt expired') || msg.includes('invalid jwt') ||
         msg.includes('session') && msg.includes('expired') ||
         msg.includes('refresh_token_not_found');
}

function isSchemaMiss(err) {
  const code = err?.code;
  if (typeof code === 'string') {
    if (/^PGRST2\d\d$/i.test(code)) return true;
    if (PG_SCHEMA_CODES.has(code.toUpperCase())) return true;
  }
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('schema cache') ||
         msg.includes('could not find the function') ||
         msg.includes('could not find a relationship') ||
         msg.includes('does not exist');
}

function isFatalInput(err) {
  const status = err?.status ?? err?.code ?? err?.statusCode;
  if (typeof status === 'number') return status >= 400 && status < 500;
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('permission denied') || msg.includes('invalid input');
}

function isTransient(err) {
  const status = err?.status ?? err?.code ?? err?.statusCode;
  if (typeof status === 'number') return status >= 500 || status === 429;
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('network') || msg.includes('timeout') ||
         msg.includes('fetch') || msg.includes('aborted') ||
         msg.includes('econnreset') || msg.includes('socket');
}

/**
 * classify(err, context?) → FailureKind
 *
 * `context` lets a caller supply information the error object alone can't
 * carry:
 *   - context.lazyBoundary: true  → this threw inside a Suspense/lazy region,
 *     the single reliable signal for CHUNK_LOAD (Metro's web chunk-fetch
 *     error text isn't stable enough to sniff — see RESILIENCE.md).
 *   - context.versionSkew: true   → a version check already confirmed the
 *     running bundle is stale (set by the Layer 0 guard before classify()
 *     is called from a lazyBoundary catch).
 */
export function classify(err, context = {}) {
  if (context.versionSkew) return FailureKind.VERSION_SKEW;
  if (context.lazyBoundary) return FailureKind.CHUNK_LOAD;
  if (isAuthExpired(err)) return FailureKind.AUTH_EXPIRED;
  if (isSchemaMiss(err)) return FailureKind.SCHEMA_DRIFT;
  if (isFatalInput(err)) return FailureKind.FATAL_INPUT;
  if (isTransient(err)) return FailureKind.TRANSIENT;
  return FailureKind.UNKNOWN;
}

/** Convenience: classify() + look up the recovery action in one call. */
export function recoveryFor(err, context) {
  return RECOVERY_FOR_KIND[classify(err, context)];
}

// Re-exported so resilience.js's internal isFatal/isSchemaMiss/isTransient
// can become thin wrappers around ONE implementation instead of maintaining
// a second copy that could drift from this one.
export const _internal = { isAuthExpired, isSchemaMiss, isFatalInput, isTransient };
