/**
 * CrewManager — named squads you create and invite people to.
 * Backed by public.crews / crew_members / crew_invites (RLS-protected) plus the
 * create_crew + accept_crew_invite SECURITY DEFINER RPCs for atomic writes.
 */
import { supabase } from './supabase';
import { NotificationService } from './notificationService';

export const CrewManager = {
  async createCrew({ name, description = null, icon = 'account-group', color = '#7c3aed' }) {
    const clean = (name || '').trim();
    if (!clean) throw new Error('Give your crew a name.');
    const { data, error } = await supabase.rpc('create_crew', {
      p_name: clean, p_description: description, p_icon: icon, p_color: color,
    });
    if (error) throw error;
    // RPC returns the crews row (object or single-row array depending on PostgREST)
    return Array.isArray(data) ? data[0] : data;
  },

  async listMyCrews(userId) {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('crew_members')
      .select('role, joined_at, crews(*)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });
    if (error) return [];
    return (data || [])
      .filter(r => r.crews)
      .map(r => ({ ...r.crews, _role: r.role }));
  },

  async getMembers(crewId) {
    if (!crewId) return [];
    const { data, error } = await supabase
      .from('crew_members')
      .select('role, joined_at, user_id, profiles:user_id(id, username, avatar_url, vibe_score, is_verified)')
      .eq('crew_id', crewId);
    if (error) return [];
    return (data || []).map(r => ({ role: r.role, joined_at: r.joined_at, ...(r.profiles || { id: r.user_id }) }));
  },

  async invite(crewId, inviterId, invitee, crewName = 'a crew') {
    const inviteeId = typeof invitee === 'string' ? invitee : invitee?.id;
    if (!crewId || !inviterId || !inviteeId) throw new Error('Missing invite details.');
    const { error } = await supabase
      .from('crew_invites')
      .upsert(
        { crew_id: crewId, inviter_id: inviterId, invitee_id: inviteeId, status: 'pending' },
        { onConflict: 'crew_id,invitee_id' }
      );
    if (error) throw error;
    NotificationService.send(inviteeId, {
      type: 'crew_invite',
      title: 'Crew invite',
      body: `You were invited to join ${crewName}.`,
      actorId: inviterId,
      data: { kind: 'crew_invite', crewId },
    }).catch(() => {});
    return true;
  },

  async listMyInvites(userId) {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('crew_invites')
      .select('id, created_at, crews(*), inviter:inviter_id(id, username, avatar_url)')
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data || []).filter(r => r.crews);
  },

  async respondInvite(inviteId, accept) {
    if (!inviteId) return false;
    if (accept) {
      const { error } = await supabase.rpc('accept_crew_invite', { p_invite_id: inviteId });
      if (error) throw error;
      return true;
    }
    const { error } = await supabase.from('crew_invites').update({ status: 'declined' }).eq('id', inviteId);
    if (error) throw error;
    return true;
  },

  async leaveCrew(crewId, userId) {
    if (!crewId || !userId) return false;
    const { error } = await supabase.from('crew_members').delete().eq('crew_id', crewId).eq('user_id', userId);
    if (error) throw error;
    return true;
  },

  async deleteCrew(crewId) {
    if (!crewId) return false;
    const { error } = await supabase.from('crews').delete().eq('id', crewId);
    if (error) throw error;
    return true;
  },
};
