/**
 * clubEngine — all DB operations for the clubs, memberships, and awards system.
 *
 * ClubManager       — create/read/update clubs
 * MembershipManager — invite, accept, manage roster
 * AwardManager      — give out and read awards for any event type
 * CareerStatsManager — read player career stats
 */
import { supabase } from './supabase';

// ── CLUB MANAGER ──────────────────────────────────────────────────────────────
export const ClubManager = {

  async create(ownerId, data) {
    const { data: club, error } = await supabase
      .from('clubs')
      .insert({ owner_id: ownerId, ...data })
      .select().single();
    if (error) throw error;
    return club;
  },

  async update(clubId, data) {
    const { data: club, error } = await supabase
      .from('clubs')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', clubId)
      .select().single();
    if (error) throw error;
    return club;
  },

  async getById(clubId) {
    const { data } = await supabase
      .from('clubs')
      .select('*, profiles(username, avatar_url, is_verified)')
      .eq('id', clubId)
      .single();
    return data;
  },

  async getByOwner(ownerId) {
    const { data } = await supabase
      .from('clubs')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return data || [];
  },

  async search(query, sportType = null) {
    let q = supabase
      .from('clubs')
      .select('id, name, short_name, sport_type, logo_url, city, members_count, is_verified')
      .eq('is_active', true)
      .ilike('name', `%${query}%`)
      .limit(20);
    if (sportType) q = q.eq('sport_type', sportType);
    const { data } = await q;
    return data || [];
  },

  // Get all events a club has participated in (via sport_teams)
  async getEventHistory(clubId) {
    const { data } = await supabase
      .from('sport_teams')
      .select('*, events(id, title, event_date, category)')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });
    return data || [];
  },
};

// ── MEMBERSHIP MANAGER ────────────────────────────────────────────────────────
export const MembershipManager = {

  async getRoster(clubId, activeOnly = true) {
    let q = supabase
      .from('club_memberships')
      .select('*, profiles(id, username, display_name, avatar_url, is_verified)')
      .eq('club_id', clubId)
      .order('role')
      .order('display_name');
    if (activeOnly) q = q.eq('is_active', true);
    const { data } = await q;
    return data || [];
  },

  async getPlayerClubs(userId) {
    const { data } = await supabase
      .from('club_memberships')
      .select('*, clubs(id, name, short_name, logo_url, sport_type, city)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('joined_at', { ascending: false });
    return data || [];
  },

  async add(clubId, userId, role = 'player', extra = {}) {
    const { data, error } = await supabase
      .from('club_memberships')
      .insert({ club_id: clubId, user_id: userId, role, ...extra })
      .select().single();
    if (error) throw error;
    return data;
  },

  async remove(membershipId) {
    const { error } = await supabase
      .from('club_memberships')
      .update({ is_active: false, left_at: new Date().toISOString().split('T')[0] })
      .eq('id', membershipId);
    if (error) throw error;
  },

  async updateRole(membershipId, role, extra = {}) {
    const { data, error } = await supabase
      .from('club_memberships')
      .update({ role, ...extra })
      .eq('id', membershipId)
      .select().single();
    if (error) throw error;
    return data;
  },

  // Check if a user is a member of a specific club
  async isMember(clubId, userId) {
    const { data } = await supabase
      .from('club_memberships')
      .select('id, role')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    return data;
  },

  // Invite by user_id
  async invite(clubId, inviterId, inviteeId, role = 'player', message = '') {
    const { data, error } = await supabase
      .from('club_invitations')
      .insert({ club_id: clubId, inviter_id: inviterId, invitee_id: inviteeId, role, message })
      .select().single();
    if (error) throw error;
    return data;
  },

  async getPendingInvitations(userId) {
    const { data } = await supabase
      .from('club_invitations')
      .select('*, clubs(id, name, logo_url, sport_type, city), profiles!inviter_id(username, avatar_url)')
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    return data || [];
  },

  async respondToInvitation(invitationId, accept) {
    const status = accept ? 'accepted' : 'declined';
    const { data: inv, error } = await supabase
      .from('club_invitations')
      .update({ status })
      .eq('id', invitationId)
      .select().single();
    if (error) throw error;

    // If accepted, create membership
    if (accept && inv) {
      await supabase.from('club_memberships').insert({
        club_id: inv.club_id,
        user_id: inv.invitee_id,
        role: inv.role,
        position: inv.position || null,
      });
    }
    return inv;
  },
};

// ── AWARD MANAGER ─────────────────────────────────────────────────────────────
export const AwardManager = {

  // Preset categories by event type
  SPORT_CATEGORIES: [
    { key: 'player_of_tournament', label: 'Player of the Tournament', icon: '🏆' },
    { key: 'top_scorer',           label: 'Top Goal Scorer',          icon: '⚽' },
    { key: 'top_assists',          label: 'Most Assists',             icon: '🎯' },
    { key: 'golden_glove',         label: 'Golden Glove',             icon: '🧤' },
    { key: 'mvp',                  label: 'Most Valuable Player',     icon: '⭐' },
    { key: 'best_xi',              label: 'Team of the Tournament',   icon: '👥' },
    { key: 'fair_play',            label: 'Fair Play Award',          icon: '🤝' },
    { key: 'best_young_player',    label: 'Best Young Player',        icon: '🌟' },
  ],
  MUSIC_CATEGORIES: [
    { key: 'best_performance',   label: 'Best Performance',    icon: '🎤' },
    { key: 'crowd_favourite',    label: 'Crowd Favourite',     icon: '🔥' },
    { key: 'best_newcomer',      label: 'Best Newcomer',       icon: '✨' },
    { key: 'headline_act',       label: 'Headline Act',        icon: '🎸' },
  ],
  HACKATHON_CATEGORIES: [
    { key: 'best_project',       label: 'Best Project',        icon: '🏆' },
    { key: 'most_innovative',    label: 'Most Innovative',     icon: '💡' },
    { key: 'best_design',        label: 'Best Design',         icon: '🎨' },
    { key: 'best_pitch',         label: 'Best Pitch',          icon: '🎯' },
    { key: 'people_choice',      label: "People's Choice",     icon: '❤️' },
  ],
  UNIVERSAL_CATEGORIES: [
    { key: 'participant_of_year',label: 'Participant of the Year', icon: '🌟' },
    { key: 'most_valuable',      label: 'Most Valuable',       icon: '💎' },
    { key: 'best_in_show',       label: 'Best in Show',        icon: '🏅' },
    { key: 'special_recognition',label: 'Special Recognition', icon: '🎖️' },
  ],

  getCategoriesForEvent(eventCategory) {
    const cat = eventCategory?.toLowerCase();
    if (['sport','soccer','rugby','basketball','cricket','athletics','tennis','boxing','volleyball'].includes(cat))
      return this.SPORT_CATEGORIES;
    if (['music','festival','rave','concert','dj'].includes(cat))
      return this.MUSIC_CATEGORIES;
    if (['hackathon','competition','esports','gaming'].includes(cat))
      return this.HACKATHON_CATEGORIES;
    return this.UNIVERSAL_CATEGORIES;
  },

  async listForEvent(eventId, publishedOnly = true) {
    let q = supabase
      .from('event_awards')
      .select('*, profiles(username, avatar_url), clubs(name, logo_url)')
      .eq('event_id', eventId)
      .order('created_at');
    if (publishedOnly) q = q.eq('is_published', true);
    const { data } = await q;
    return data || [];
  },

  async listForUser(userId) {
    const { data } = await supabase
      .from('event_awards')
      .select('*, events(id, title, event_date, category)')
      .eq('recipient_user_id', userId)
      .eq('is_published', true)
      .order('created_at', { ascending: false });
    return data || [];
  },

  async create(eventId, awardData, createdBy) {
    const { data, error } = await supabase
      .from('event_awards')
      .insert({ event_id: eventId, created_by: createdBy, ...awardData })
      .select().single();
    if (error) throw error;
    return data;
  },

  async publish(awardId) {
    const { data, error } = await supabase
      .from('event_awards')
      .update({ is_published: true })
      .eq('id', awardId)
      .select().single();
    if (error) throw error;
    return data;
  },

  async delete(awardId) {
    const { error } = await supabase.from('event_awards').delete().eq('id', awardId);
    if (error) throw error;
  },
};

// ── CAREER STATS MANAGER ──────────────────────────────────────────────────────
export const CareerStatsManager = {

  async getForUser(userId) {
    const { data } = await supabase
      .from('player_career_stats')
      .select('*')
      .eq('user_id', userId)
      .order('matches_count', { ascending: false });
    return data || [];
  },

  async getForUserAndSport(userId, sportType) {
    const { data } = await supabase
      .from('player_career_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('sport_type', sportType)
      .maybeSingle();
    return data;
  },

  // Called after a match completes to update player stats from match events
  async recomputeFromMatchEvents(userId, sportType) {
    // athlete_id references sport_athletes (NOT profiles), and it holds a
    // sport_athletes.id — not a user id. The old query embedded the wrong table
    // AND filtered athlete_id by a user id, so it could never match anyone even
    // if the embed had resolved. Join through sport_athletes and filter on its
    // user_id instead.
    const { data: events } = await supabase
      .from('sport_match_events')
      .select('event_type, athlete_id, sport_athletes!inner(user_id)')
      .eq('sport_athletes.user_id', userId);
    // Build aggregates
    const goals        = (events || []).filter(e => ['goal','try'].includes(e.event_type)).length;
    const assists      = (events || []).filter(e => e.event_type === 'assist').length;
    const yellowCards  = (events || []).filter(e => e.event_type === 'yellow_card').length;
    const redCards     = (events || []).filter(e => e.event_type === 'red_card').length;
    await supabase
      .from('player_career_stats')
      .upsert({
        user_id: userId, sport_type: sportType,
        goals, assists, yellow_cards: yellowCards, red_cards: redCards,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'user_id,sport_type' });
  },
};
