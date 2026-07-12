/**
 * fetchWithTimeout — fetch() with a deadline.
 *
 * `fetch` has NO default timeout. A third-party host that accepts the socket and
 * then goes quiet (open-meteo, er-api, Spotify, a captive-WiFi portal, a phone
 * dropping from LTE to nothing) leaves the promise pending FOREVER. Callers that
 * `await` it hang with it — spinners that never stop, cache fallbacks in the
 * catch block that never run, screens that never render.
 *
 * Every outbound call to a host we do not control must go through this.
 * Aborting turns a silent infinite hang into an ordinary catchable error, so the
 * existing offline/cache fallbacks actually get a chance to fire.
 */
const DEFAULT_MS = 10000;

export async function fetchWithTimeout(url, options = {}, ms = DEFAULT_MS) {
  // Respect a caller's own AbortSignal as well as our deadline.
  const controller = new AbortController();
  const { signal: callerSignal, ...rest } = options;
  const onAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onAbort);
  }

  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener('abort', onAbort);
  }
}

export default fetchWithTimeout;
