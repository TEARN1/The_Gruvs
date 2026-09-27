/**
 * botCheck — signup bot defense that needs no CAPTCHA, no key, no server config
 * (#380).
 *
 * Supabase CAPTCHA is the strong option, but it requires the founder to enable it
 * (which mints a site key) before the widget can exist. This is the defence we
 * can ship TODAY, and it catches the bulk of naive automated signups for free:
 *
 *   • HONEYPOT — a hidden field a human never sees and never fills. A bot that
 *     auto-fills every input trips it. Zero false positives: real users can't
 *     fill something that isn't shown to them.
 *   • TIMING — a human can't read, tab through, and complete a multi-field signup
 *     in under a second. An instantaneous submit is a script.
 *
 * Pure + deterministic. The honeypot is the hard signal; the timing floor is
 * deliberately tiny (800ms) so a fast real user — even one using a password
 * manager — is never blocked.
 */

const MIN_FILL_MS = 800;

/**
 * @param {object} p
 * @param {string} p.honeypot   the hidden field's value (should always be empty)
 * @param {number} p.elapsedMs  ms between the form opening and submit
 * @returns {{ bot:boolean, reason:string }}
 */
export function isLikelyBot({ honeypot = '', elapsedMs = Infinity } = {}) {
  if (String(honeypot).trim().length > 0) return { bot: true, reason: 'honeypot' };
  if (Number.isFinite(elapsedMs) && elapsedMs < MIN_FILL_MS) return { bot: true, reason: 'too_fast' };
  return { bot: false, reason: '' };
}

export default { isLikelyBot, MIN_FILL_MS };
