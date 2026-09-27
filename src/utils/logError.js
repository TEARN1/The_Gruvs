/**
 * logError — lightweight, fire-and-forget error telemetry.
 *
 * Why: features have died silently before (check-in failed for weeks inside an
 * empty catch). This surfaces failures to a `client_errors` table we can read
 * via Supabase MCP each session — our x-ray vision.
 *
 * Contract:
 *  • NEVER throws, NEVER blocks, NEVER awaited by callers — a logging failure
 *    must not break the thing it's logging.
 *  • NO PII — only a short label, the error message, and a whitelisted context
 *    of scalar ids/codes. Never pass emails, tokens, full objects, or bodies.
 *  • Rate-limited + deduped per session so a hot loop can't spam the table.
 */
import { supabase, isSupabaseEnabled } from '../services/supabase';
import { Platform } from 'react-native';

const APP_VERSION = '1.1.0';
const MAX_PER_SESSION = 40;        // hard cap so a crash loop can't flood
const DEDUPE_WINDOW_MS = 60_000;   // same label+message within 1 min → once

let _sent = 0;
const _recent = new Map();         // `${label}:${message}` -> last-sent ms

// Only keep scalar, non-sensitive context values. Drop anything that looks
// like an object, or a key that could carry PII.
const PII_KEYS = /email|token|password|phone|lat|lon|address|body|caption|message_text|jwt|secret/i;
function safeContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (PII_KEYS.test(k)) continue;
    if (v == null) continue;
    const t = typeof v;
    if (t === 'string') out[k] = v.slice(0, 120);
    else if (t === 'number' || t === 'boolean') out[k] = v;
    // objects/arrays are intentionally dropped
  }
  return out;
}

function messageOf(err) {
  if (!err) return 'unknown';
  if (typeof err === 'string') return err.slice(0, 300);
  const m = err.message || err.error_description || err.code || String(err);
  return String(m).slice(0, 300);
}

/**
 * @param {string} label   where it happened, e.g. 'CheckIn.touchDown'
 * @param {any}    err      the caught error
 * @param {object} [context] scalar-only extras (ids, codes) — NEVER PII
 */
export function logError(label, err, context) {
  try {
    if (!isSupabaseEnabled || _sent >= MAX_PER_SESSION) return;
    const message = messageOf(err);
    const key = `${label}:${message}`;
    const now = Date.now();
    const last = _recent.get(key);
    if (last && now - last < DEDUPE_WINDOW_MS) return; // deduped
    _recent.set(key, now);
    _sent += 1;

    let userId = null;
    try { userId = supabase.auth.getUser ? undefined : null; } catch {}

    // Resolve the current user id without blocking (best-effort).
    const insert = (uid) => {
      supabase.from('client_errors').insert({
        user_id: uid || null,
        label: String(label).slice(0, 80),
        message,
        context: safeContext(context),
        platform: Platform.OS,
        app_version: APP_VERSION,
      }).then(() => {}, () => {}); // swallow — logging must never surface an error
    };

    const maybe = supabase.auth.getSession?.();
    if (maybe && typeof maybe.then === 'function') {
      maybe.then(({ data }) => insert(data?.session?.user?.id)).catch(() => insert(null));
    } else {
      insert(null);
    }
  } catch { /* logging must be invisible on failure */ }
}

export default logError;
