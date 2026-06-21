/**
 * viewerAge — the signed-in viewer's age, fetched once and cached, for the
 * content age-rating filter (src/utils/contentAgeRating). Kept OUT of the main
 * profile load (AuthContext PROFILE_FIELDS) so an un-migrated DB without a
 * birth_date column can never break profile loading.
 *
 * Fail-safe: unknown age → null. The age filter treats null as "general only",
 * so mature content stays hidden until a real birthday is known.
 */
import { supabase } from '../services/supabase';
import { profileAge } from './ageGate';

let _cache = { userId: null, age: undefined };

/** Fetch + cache the viewer's age. Call on screen mount; returns the age or null. */
export async function loadViewerAge(userId) {
  if (!userId) { _cache = { userId: null, age: null }; return null; }
  if (_cache.userId === userId && _cache.age !== undefined) return _cache.age;
  try {
    // Select the DOB fields separately + tolerantly — any may be absent.
    const { data } = await supabase
      .from('profiles')
      .select('birth_date, age, birth_year')
      .eq('id', userId)
      .maybeSingle();
    _cache = { userId, age: profileAge(data) };
  } catch {
    _cache = { userId, age: null };
  }
  return _cache.age;
}

/** Synchronous last-known viewer age (null if not loaded yet / unknown). */
export function viewerAgeSync() {
  return _cache.age === undefined ? null : _cache.age;
}

/** Clear on sign-out so the next user doesn't inherit a stale age. */
export function resetViewerAge() {
  _cache = { userId: null, age: undefined };
}

export default { loadViewerAge, viewerAgeSync, resetViewerAge };
