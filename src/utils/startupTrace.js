/**
 * startupTrace — milestone timings for a cold start, read from the device log
 * (`adb logcat | grep "[startup]"`). The first call of each label prints the
 * milliseconds since this module was first evaluated (≈ JS bundle start).
 * Capped and one-shot per label, so it costs nothing after launch.
 */
const T0 = Date.now();
const seen = new Set();

export function markStartup(label) {
  if (seen.has(label) || seen.size >= 40) return;
  seen.add(label);
  // console.log reaches logcat (ReactNativeJS) in release builds too.
  console.log(`[startup] +${Date.now() - T0}ms ${label}`);
}
