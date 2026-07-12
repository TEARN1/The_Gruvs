/**
 * analytics — lightweight product-funnel telemetry.
 *
 * The app had error telemetry (logError) but no way to see whether the CORE
 * LOOP works: of the people who open the app, how many view an event → RSVP →
 * Touch Down → share? track() records those milestones to `analytics_events`,
 * which we read via Supabase MCP.
 *
 * Contract (identical spirit to logError):
 *  • NEVER throws / blocks / is awaited — a telemetry failure can't affect UX.
 *  • NO PII — an event name + a small map of SCALAR props (ids, tab, source).
 *    Never pass emails, bodies, names, coordinates.
 *  • Best-effort + capped so it can't flood.
 */
import { supabase, isSupabaseEnabled } from '../services/supabase';
import { Platform } from 'react-native';

const MAX_PER_SESSION = 300;
let _sent = 0;

// A per-load session id so funnels can be stitched without any identity.
const SESSION_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const PII_KEYS = /email|token|password|phone|lat|lon|address|body|caption|name|message|jwt|secret/i;
function safeProps(props) {
  if (!props || typeof props !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (PII_KEYS.test(k) || v == null) continue;
    const t = typeof v;
    if (t === 'string') out[k] = v.slice(0, 80);
    else if (t === 'number' || t === 'boolean') out[k] = v;
  }
  return out;
}

/**
 * Record a funnel milestone. Fire-and-forget.
 * @param {string} event  e.g. 'touch_down', 'event_view', 'rsvp', 'signup', 'share'
 * @param {object} [props] scalar-only extras (eventId, tab, source) — NEVER PII
 */
export function track(event, props) {
  try {
    if (!isSupabaseEnabled || _sent >= MAX_PER_SESSION || !event) return;
    _sent += 1;
    const row = {
      event: String(event).slice(0, 40),
      props: safeProps(props),
      session_id: SESSION_ID,
      platform: Platform.OS,
    };
    const insert = (uid) => {
      supabase.from('analytics_events').insert({ ...row, user_id: uid || null })
        .then(() => {}, () => {}); // swallow — telemetry must be invisible on failure
    };
    const s = supabase.auth.getSession?.();
    if (s && typeof s.then === 'function') s.then(({ data }) => insert(data?.session?.user?.id)).catch(() => insert(null));
    else insert(null);
  } catch { /* invisible on failure */ }
}

export default track;
