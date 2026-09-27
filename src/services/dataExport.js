/**
 * dataExport — the user's right to a copy of their own data (POPIA s.23,
 * GDPR "right to access / portability").
 *
 * The delete-account function proves we can find everything a user owns; this is
 * the read-only twin — it gathers that same data and hands it back as a JSON
 * file the user can download. No new permissions: every query is the user
 * reading their OWN rows, which RLS already allows.
 *
 * Best-effort per table: a table that doesn't exist or is blocked is skipped,
 * never fatal — a partial export beats a failed one.
 */
import { supabase } from './supabase';
import { logError } from '../utils/logError';
import { track } from '../utils/analytics';

// `profiles` can NOT be exported with select('*'). The coordinate lockdown
// (supabase/queries/lock_profile_coordinates.sql) revoked the table-level SELECT
// grant and re-granted an explicit safe column list, so `*` fails a permission
// check and the user's profile was being silently dropped from their own export.
// We request the same field list the app already reads successfully — and it
// deliberately excludes lat/lon: coordinates never go to a client.
const PROFILE_EXPORT_COLS = 'id, username, display_name, avatar_url, bio, vibe_score, is_verified, is_online, last_seen, identity_mode, is_beacon_active, is_discoverable, interests, location, career_title, career_description, looks_description, share_events, show_online, gender';

// The user's own rows, keyed by the column that ties a row to them.
const OWNED = [
  { table: 'profiles', col: 'id', single: true, cols: PROFILE_EXPORT_COLS },
  { table: 'events', col: 'author_id' },
  { table: 'event_rsvps', col: 'user_id' },
  { table: 'live_checkins', col: 'user_id' },
  { table: 'event_vibes', col: 'user_id' },
  { table: 'saved_events', col: 'user_id' },
  { table: 'follows', col: 'follower_id' },
  { table: 'ticket_tokens', col: 'user_id' },
  { table: 'stories', col: 'user_id' },
  { table: 'analytics_events', col: 'user_id' },
];

/**
 * Gather everything the signed-in user owns.
 * @returns {Promise<object>} { exported_at, user_id, data: { table: rows } }
 */
export async function collectUserData(userId) {
  const out = { exported_at: new Date().toISOString(), user_id: userId, data: {} };
  if (!userId) return out;

  await Promise.all(OWNED.map(async ({ table, col, single, cols }) => {
    try {
      let q = supabase.from(table).select(cols || '*').eq(col, userId);
      if (!single) q = q.limit(5000);
      const { data, error } = await q;
      if (error) return;                       // table missing / blocked — skip
      out.data[table] = single ? (data?.[0] ?? null) : (data || []);
    } catch { /* skip this table */ }
  }));

  return out;
}

/** Trigger a JSON download of the user's data (web). Returns false where unsupported. */
export function downloadJson(payload, filename = 'gruvs-my-data') {
  try {
    if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return false;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    logError('DataExport.download', e);
    return false;
  }
}

/** Full flow: gather + download. Returns { ok, tables } for the caller to message. */
export async function exportMyData(userId) {
  const payload = await collectUserData(userId);
  const tables = Object.keys(payload.data).length;
  const ok = downloadJson(payload);
  // Audit trail (#913, #335): record every bulk export of a user's data, so a
  // burst of exports is visible after the fact. This is the app-side of mass-read
  // visibility; true attacker-detection needs Supabase log monitoring (infra).
  try { track('data_export', { tables, ok }); } catch { /* never block the export */ }
  return { ok, tables };
}

export default { collectUserData, downloadJson, exportMyData };
