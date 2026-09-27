// Global error handler wired into Metro's ErrorUtils before the React tree mounts.
// Captures fatal and non-fatal JS errors that escape component error boundaries.
//
// Confirmed via direct test that react-native-web does NOT define ErrorUtils
// (`typeof global.ErrorUtils === 'undefined'` after requiring react-native-web) —
// so on web, the only platform in production today, installGlobalErrorHandler()
// below silently no-ops and event-handler throws / unhandled promise rejections
// (neither of which ErrorBoundary can structurally catch — it only sees
// render-phase errors) have had ZERO coverage. installWebErrorHandler() closes
// that gap with the browser-native equivalents.

const scrub = (message) => String(message)
  .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
  .replace(/sb-[a-zA-Z0-9-]{20,}/g, '[TOKEN]')
  .replace(/pk_live_[a-zA-Z0-9]{20,}/g, '[KEY]');

let _previousHandler = null;

export function installGlobalErrorHandler() {
  if (typeof ErrorUtils === 'undefined') return;

  _previousHandler = ErrorUtils.getGlobalHandler?.();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    const level = isFatal ? 'FATAL' : 'ERROR';
    const message = scrub(error?.message || String(error));
    const stack = error?.stack || '';

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

/**
 * installWebErrorHandler — the web counterpart to installGlobalErrorHandler,
 * covering event-handler throws and unhandled promise rejections on the one
 * platform where ErrorUtils doesn't exist. Call once at bootstrap, alongside
 * installGlobalErrorHandler() (safe to call on native too — no-ops there).
 *
 * Reports through the SAME two sinks ErrorBoundary uses (logError,
 * SecurityService.logSecurityEvent) so telemetry doesn't need a third code
 * path, with distinguishing labels so client_errors stays groupable. No
 * overlap risk with ErrorBoundary: React only calls componentDidCatch for
 * render-phase errors; these listeners only fire for what the reconciler
 * never sees.
 */
export function installWebErrorHandler({ logError, logSecurityEvent } = {}) {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (evt) => {
    const raw = evt?.error?.message || evt?.message || 'window.onerror';
    const message = scrub(raw);
    console.error(`[The Gruvs] [WINDOW-ERROR] ${message}`);
    const err = evt?.error instanceof Error ? evt.error : new Error(message);
    logError?.('window:onerror', err);
    logSecurityEvent?.(null, 'JS_UNCAUGHT_ERROR', { message });
    // No preventDefault() — keep default browser console logging for local dev.
  });

  window.addEventListener('unhandledrejection', (evt) => {
    const reason = evt?.reason;
    const message = scrub(reason?.message || String(reason ?? 'unhandled rejection'));
    console.error(`[The Gruvs] [UNHANDLED-REJECTION] ${message}`);
    const err = reason instanceof Error ? reason : new Error(message);
    logError?.('window:unhandledrejection', err);
    logSecurityEvent?.(null, 'JS_UNHANDLED_REJECTION', { message });
  });
}
