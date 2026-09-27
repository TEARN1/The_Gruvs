/**
 * Retries an async function up to `maxAttempts` times with exponential backoff.
 * Only retries on network-style errors; bails immediately on 4xx (bad input).
 *
 * Usage:
 *   const { data, error } = await withRetry(() =>
 *     supabase.from('event_vibes').insert({ ... })
 *   );
 */
export async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 300 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      // Supabase returns { data, error } — treat a 4xx status as non-retryable
      if (result?.error) {
        const status = result.error?.status ?? result.error?.code;
        const is4xx = status >= 400 && status < 500;
        if (is4xx) return result; // bad input — don't retry
        lastError = result.error;
      } else {
        return result;
      }
    } catch (err) {
      lastError = err;
    }

    if (attempt < maxAttempts) {
      await _sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  return { data: null, error: lastError };
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
