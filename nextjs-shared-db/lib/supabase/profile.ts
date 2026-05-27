import { createClient } from './client';

export interface Sibling {
  name: string;
  age: number;
  relationship: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface SharedProfile {
  id: string;
  first_name: string | null;
  surname: string | null;
  email: string | null;
  age: number | null;
  siblings: Sibling[];
  emergency_contacts: EmergencyContact[];
}

const SHARED_FIELDS = 'id, first_name, surname, email, age, siblings, emergency_contacts' as const;

/** Fetch the current user's shared profile fields */
export async function getMyProfile(): Promise<SharedProfile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(SHARED_FIELDS)
    .eq('id', user.id)
    .single();

  if (error) { console.error('getMyProfile', error.message); return null; }
  return data as SharedProfile;
}

/** Update the current user's shared profile fields */
export async function updateMyProfile(
  patch: Partial<Omit<SharedProfile, 'id'>>,
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  return { error: error?.message ?? null };
}

/** Add a sibling to the current user's profile */
export async function addSibling(sibling: Sibling): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase.rpc('append_to_profile_jsonb', {
    p_user_id: user.id,
    p_column: 'siblings',
    p_value: sibling,
  });

  // Fallback: fetch → append → update (if RPC not yet deployed)
  if (error) {
    const profile = await getMyProfile();
    const updated = [...(profile?.siblings ?? []), sibling];
    return updateMyProfile({ siblings: updated });
  }
  return { error: null };
}

/** Add an emergency contact to the current user's profile */
export async function addEmergencyContact(contact: EmergencyContact): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const profile = await getMyProfile();
  const updated = [...(profile?.emergency_contacts ?? []), contact];
  return updateMyProfile({ emergency_contacts: updated });
}
