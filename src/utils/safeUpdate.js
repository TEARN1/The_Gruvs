/**
 * safeUpdate — stop mass-assignment privilege escalation.
 *
 * Several services took a caller-supplied object and spread it straight into a
 * Supabase `.update({ ...data })`. If the caller adds a column they shouldn't
 * control — `is_verified`, `owner_id`, `user_id`, a `career_*` stat, a
 * `*_count` — it goes to the database. RLS *may* block it, but relying on every
 * table having a perfect column-level WITH CHECK is exactly the assumption that
 * gets apps breached. Defence in depth: never send a field the user isn't
 * allowed to set in the first place.
 *
 *   pick(data, ALLOWED)      → only the whitelisted keys survive (preferred)
 *   stripPrivileged(data)    → denylist safety net where a full whitelist isn't
 *                              practical yet
 */

// Columns a normal user must NEVER be able to set on ANY table via a spread.
// Identity, ownership, verification, and any server-maintained counter/stat.
const PRIVILEGED = new Set([
  'id', 'owner_id', 'user_id', 'author_id', 'created_by', 'creator_id',
  'role', 'is_admin', 'is_staff', 'is_moderator',
  'is_verified', 'verified', 'is_active', 'status',
  'vibe_score', 'trust_score', 'social_integrity_score', 'reputation',
  'follower_count', 'followers_count', 'following_count',
  'members_count', 'events_count', 'trophies_count',
  'created_at', 'updated_at', 'deleted_at',
]);
const PRIVILEGED_RE = /^(career_|is_|has_|can_|.*_count$|.*_score$)/;

/** Keep only the explicitly-allowed keys. The safe default. */
export function pick(obj, allowed) {
  const allow = allowed instanceof Set ? allowed : new Set(allowed);
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    if (allow.has(k) && v !== undefined) out[k] = v;
  }
  return out;
}

/** Drop any privileged/server-owned field. Use when a full whitelist isn't ready. */
export function stripPrivileged(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (PRIVILEGED.has(k) || PRIVILEGED_RE.test(k)) continue;
    out[k] = v;
  }
  return out;
}

// ── Per-table whitelists — only user-editable, non-privilege columns. ─────────
export const CLUB_EDITABLE = new Set([
  'name', 'short_name', 'bio', 'category', 'city', 'country', 'logo_url',
  'banner_url', 'colors', 'contact_email', 'contact_phone', 'social_handle',
  'website', 'home_ground', 'founded_year', 'sport_type',
]);

export const PLAYER_EDITABLE = new Set([
  'full_name', 'known_as', 'bio', 'photo_url', 'date_of_birth', 'height_cm',
  'preferred_foot', 'nationality', 'region', 'country', 'sport_type',
  'current_club_id',
]);

export default { pick, stripPrivileged, CLUB_EDITABLE, PLAYER_EDITABLE };
