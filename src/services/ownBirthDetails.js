/**
 * ownBirthDetails — the signed-in user's own birth date, age and birth year.
 *
 * Signed-in users cannot read birth_date, birth_year or age from `profiles`
 * (supabase/migrations/20261124180000_birthday_privacy.sql): column grants are
 * not row-aware, so letting anyone read their own would let everyone read
 * everyone's. The user's own row comes through get_my_profile(), which returns
 * only the caller's row.
 */
import { supabase } from './supabase';

export async function ownBirthDetails(userId) {
  const { data, error } = await supabase.rpc('get_my_profile').maybeSingle();
  if (error) throw error;
  if (!data || (userId && data.id !== userId)) return null;
  return { birth_date: data.birth_date ?? null, age: data.age ?? null, birth_year: data.birth_year ?? null };
}

export default ownBirthDetails;
