/**
 * tournamentEngine — governance voting + fan predictions.
 *
 *  A) Governance: teams elect tournament officials (results editor, log keeper,
 *     fixtures, disciplinary, head organiser). ≥ threshold distinct teams → the
 *     candidate is granted the role and may edit that tournament's data.
 *  B) Predictions: fans vote which team will win a competitive event.
 *
 * Schema: supabase/queries/30_tournament_governance.sql
 */
import { supabase } from './supabase';

const safe = async (fn, fallback) => { try { const v = await fn(); return v ?? fallback; } catch { return fallback; } };

// Elected positions — label + what they control + icon for the UI.
export const TOURNAMENT_ROLES = [
  { key: 'results_editor',   label: 'Results Editor',   blurb: 'Enters & edits match results',        icon: 'edit-3' },
  { key: 'log_keeper',       label: 'Log Keeper',       blurb: 'Maintains the standings / league log', icon: 'list' },
  { key: 'fixtures_manager', label: 'Fixtures Manager', blurb: 'Sets the schedule & fixtures',         icon: 'calendar' },
  { key: 'disciplinary',     label: 'Disciplinary',     blurb: 'Cards, bans & disputes',               icon: 'shield' },
  { key: 'head_organizer',   label: 'Head Organiser',   blurb: 'Overall tournament authority',         icon: 'award' },
];

export const TournamentEngine = {
  // ── Governance ──────────────────────────────────────────────────────────
  /** Clubs the signed-in user can vote with (owns). */
  async getMyTeams(userId) {
    if (!userId) return [];
    return safe(async () => {
      const { data } = await supabase
        .from('clubs').select('id, name, short_name, logo_url')
        .eq('owner_id', userId);
      return data;
    }, []);
  },

  /** Current elected officials for a competition (with profile). */
  async getOfficials(competitionId) {
    return safe(async () => {
      const { data } = await supabase
        .from('tournament_officials')
        .select('role, votes_at_election, elected_at, user:user_id(id, username, avatar_url)')
        .eq('competition_id', competitionId);
      return data;
    }, []);
  },

  /** Vote standings for a role: candidates ranked by distinct-team votes. */
  async getRoleStandings(competitionId, role) {
    return safe(async () => {
      const { data } = await supabase
        .from('tournament_role_votes')
        .select('candidate_id, voter_club_id, candidate:candidate_id(id, username, avatar_url)')
        .eq('competition_id', competitionId).eq('role', role);
      const rows = data || [];
      const byCand = {};
      for (const r of rows) {
        if (!byCand[r.candidate_id]) byCand[r.candidate_id] = { candidate: r.candidate, votes: 0, teams: new Set() };
        byCand[r.candidate_id].teams.add(r.voter_club_id);
      }
      return Object.values(byCand)
        .map(c => ({ candidate: c.candidate, candidate_id: c.candidate?.id, votes: c.teams.size }))
        .sort((a, b) => b.votes - a.votes);
    }, []);
  },

  /** This team's current vote for a role (so the UI can show it). */
  async getMyVote(competitionId, role, clubId) {
    if (!clubId) return null;
    return safe(async () => {
      const { data } = await supabase
        .from('tournament_role_votes')
        .select('candidate_id')
        .eq('competition_id', competitionId).eq('role', role).eq('voter_club_id', clubId)
        .maybeSingle();
      return data?.candidate_id || null;
    }, null);
  },

  /** Cast / change a team's vote for a candidate. Returns {threshold, leader, leader_votes, elected}. */
  async castRoleVote({ competitionId, role, candidateId, clubId }) {
    try {
      const { data, error } = await supabase.rpc('cast_role_vote', {
        p_competition: competitionId, p_role: role, p_candidate: candidateId, p_club: clubId,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, ...(data || {}) };
    } catch (e) { return { ok: false, error: e.message }; }
  },

  async getCompetition(competitionId) {
    return safe(async () => {
      const { data } = await supabase.from('competitions').select('*').eq('id', competitionId).maybeSingle();
      return data;
    }, null);
  },

  // ── Predictions ─────────────────────────────────────────────────────────
  /** Live tally of who fans think will win, keyed by label. */
  async getPredictionTally(eventId) {
    return safe(async () => {
      const { data } = await supabase
        .from('match_predictions')
        .select('predicted_side, predicted_label')
        .eq('event_id', eventId);
      const rows = data || [];
      const tally = {};
      for (const r of rows) {
        const k = r.predicted_label || r.predicted_side || 'unknown';
        tally[k] = (tally[k] || 0) + 1;
      }
      return { total: rows.length, tally };
    }, { total: 0, tally: {} });
  },

  async getMyPrediction(eventId, userId) {
    if (!userId) return null;
    return safe(async () => {
      const { data } = await supabase
        .from('match_predictions')
        .select('predicted_side, predicted_label, predicted_team_id')
        .eq('event_id', eventId).eq('user_id', userId)
        .maybeSingle();
      return data;
    }, null);
  },

  async castPrediction({ eventId, side = null, teamId = null, label = null, matchId = null }) {
    try {
      const { data, error } = await supabase.rpc('cast_match_prediction', {
        p_event: eventId, p_side: side, p_team: teamId, p_label: label, p_match: matchId,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, ...(data || {}) };
    } catch (e) { return { ok: false, error: e.message }; }
  },
};

export default TournamentEngine;
