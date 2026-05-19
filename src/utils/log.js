/**
 * Structured logger. All errors go through here so they can be routed to
 * a production reporter (Sentry, etc.) by calling setReporter() once on boot.
 *
 * Usage:
 *   import { log } from '../utils/log';
 *   log.error('notificationService:send', err);
 *   log.warn('EchoSection:fetch', 'no data returned');
 */

let _reporter = null;

/** Swap in a production error reporter at boot time (e.g. Sentry.captureException). */
export function setReporter(fn) {
  _reporter = fn;
}

function scrub(msg) {
  if (typeof msg !== 'string') return msg;
  return msg
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    .replace(/eyJ[a-zA-Z0-9._-]{20,}/g, '[JWT]')
    .replace(/sb-[a-zA-Z0-9-]{20,}/g, '[TOKEN]');
}

export const log = {
  error(context, errOrMsg) {
    const msg = errOrMsg instanceof Error ? errOrMsg.message : String(errOrMsg);
    console.error(`[${context}] ${scrub(msg)}`);
    if (_reporter) {
      try { _reporter(errOrMsg instanceof Error ? errOrMsg : new Error(msg), context); } catch {}
    }
  },

  warn(context, msg) {
    if (__DEV__) console.warn(`[${context}] ${scrub(String(msg))}`);
  },

  info(context, msg) {
    if (__DEV__) console.log(`[${context}] ${String(msg)}`);
  },
};
