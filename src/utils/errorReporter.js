// Global error handler wired into Metro's ErrorUtils before the React tree mounts.
// Captures fatal and non-fatal JS errors that escape component error boundaries.

let _previousHandler = null;

export function installGlobalErrorHandler() {
  if (typeof ErrorUtils === 'undefined') return;

  _previousHandler = ErrorUtils.getGlobalHandler?.();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    const level = isFatal ? 'FATAL' : 'ERROR';
    let message = error?.message || String(error);
    const stack = error?.stack || '';

    // Scrub sensitive data from logs (tokens, emails, keys)
    message = message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    message = message.replace(/sb-[a-zA-Z0-9-]{20,}/g, '[TOKEN]');
    message = message.replace(/pk_live_[a-zA-Z0-9]{20,}/g, '[KEY]');

    console.error(`[The Gruvs] [${level}] ${message}`);
    if (isFatal && stack) {
      console.error('[Stack]', stack);
    }

    // Forward to the previous handler (dev overlay, Expo crash reporter, etc.)
    _previousHandler?.(error, isFatal);
  });
}

// Call this to swap in a production reporter (e.g. Sentry) at runtime.
// Must be called after installGlobalErrorHandler().
export function setProductionReporter(reportFn) {
  if (typeof ErrorUtils === 'undefined') return;
  const baseHandler = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    try { reportFn(error, isFatal); } catch { /* reporter must not crash */ }
    baseHandler?.(error, isFatal);
  });
}
