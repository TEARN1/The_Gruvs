/**
 * talentEngine — data access for the Talent Platform (players, careers,
 * ratings, follows, scout search). Backs PlayerProfileModal and the scout
 * leaderboard. All reads are best-effort (return safe empties on failure);
 * writes go through the resilient cascade.
 *
 * Schema: supabase/queries/27_talent_platform.sql
 */
import { supabase } from './supabase';
import { resilient } from '../utils/resilience';
import { sanitizeSearch } from '../utils/sanitize';

const safe = async (fn, fallback) => {
  try { const v = await fn(); return v ?? fallback; } catch { return fallback; }
};

export const TalentEngine = {
  // ── Player identity + career ────────────────────────────────────────────
  async getPlayer(playerId) {
    return safe(async () => {
      const { data } = await supabase
        .from('players')
        .select('*, current_club:current_club_id(id, name, short_name, logo_url, city, country)')
        .eq('id', playerId)
        .maybeSingle();
      return data;
    }, null);
  },

  /** Resolve the player identity for a Gruvs user (claimed profile), if any. */
  async getPlayerByUser(userId) {
    return safe(async () => {
      const { data } = await supabase.from('players').select('*').eq('user_id', userId).maybeSingle();
      return data;
    }, null);
  },

  /** Career timeline: club spells (newest first) + season-by-season stats. */
  async getCareer(playerId) {
    const [spells, seasons] = await Promise.all([
      safe(async () => {
        const { data } = await supabase
          .from('player_team_spells')
          .select('*, club:club_id(name, short_name, logo_url), season:season_id(name)')
          .eq('player_id', playerId)
          .order('joined_at', { ascending: false });
        return data;
      }, []),
      safe(async () => {
        const { data } = await supabase
          .from('player_season_stats')
          .select('*, season:season_id(name), competition:competition_id(name, sport_type), club:club_id(name, short_name, logo_url)')
          .eq('player_id', playerId)
          .order('updated_at', { ascending: false });
        return data;
      }, []),
    ]);
    return { spells: spells || [], seasons: seasons || [] };
  },

  /** Recent 0–10 ratings with the rater's name. */
  async getRecentRatings(playerId, limit = 10) {
    return safe(async () => {
      const { data } = await supabase
        .from('player_match_ratings')
        .select('rating, note, created_at, rater:rater_id(username, avatar_url)')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(limit);
      return data;
    }, []);
  },

  // ── Follow a player ─────────────────────────────────────────────────────
  async isFollowing(playerId, userId) {
    if (!userId) return false;
    return safe(async () => {
      const { data } = await supabase
        .from('player_followers')
        .select('player_id')
        .eq('player_id', playerId).eq('follower_id', userId)
        .maybeSingle();
      return !!data;
    }, false);
  },

  async toggleFollow(playerId, userId, isFollowing) {
    if (!userId) return false;
    return resilient(
      isFollowing
        ? [() => supabase.from('player_followers').delete().eq('player_id', playerId).eq('follower_id', userId)]
        : [
            () => supabase.from('player_followers').upsert({ player_id: playerId, follower_id: userId }, { onConflict: 'player_id,follower_id', ignoreDuplicates: true }),
            () => supabase.from('player_followers').insert({ player_id: playerId, follower_id: userId }),
          ],
      { attemptsPerTier: 2, baseMs: 300, label: 'TalentEngine.toggleFollow', fallbackValue: null }
    ).then(() => !isFollowing).catch(() => isFollowing);
  },

  // ── Rate a player for a match (0–10) ────────────────────────────────────
  async ratePlayer({ playerId, matchId = null, eventId = null, raterId, rating, note = '' }) {
    if (!raterId) return false;
    const r = Math.max(0, Math.min(10, Number(rating) || 0));
    const ok = await resilient(
      [() => supabase.from('player_match_ratings').upsert(
        { player_id: playerId, match_id: matchId, event_id: eventId, rater_id: raterId, rating: r, note: note.slice(0, 280) },
        { onConflict: 'player_id,match_id,rater_id' }
      )],
      { attemptsPerTier: 2, baseMs: 300, label: 'TalentEngine.ratePlayer', fallbackValue: null }
    );
    return ok !== null;
  },

  /** Claim an unclaimed player identity for the signed-in user. */
  async claimPlayer(playerId, userId) {
    if (!userId) return false;
    const ok = await resilient(
      [() => supabase.from('players').update({ user_id: userId }).eq('id', playerId).is('user_id', null)],
      { attemptsPerTier: 2, baseMs: 300, label: 'TalentEngine.claimPlayer', fallbackValue: null }
    );
    return ok !== null;
  },

  // ── Players: search + create (for tagging guests) ──────────────────────
  async searchPlayers(query, limit = 12) {
    const s = sanitizeSearch(query);
    if (!s) return [];
    return safe(async () => {
      const { data } = await supabase
        .from('players')
        .select('id, full_name, known_as, photo_url, primary_position, sport_type, current_club_id, is_verified')
        .ilike('full_name', `%${s}%`)
        .limit(limit);
      return data;
    }, []);
  },

  async createPlayer({ full_name, known_as = null, category = null, sport_type = null, headline = null, primary_position = null, nationality = null, region = null, photo_url = null, user_id = null, metrics = {}, createdBy = null }) {
    if (!full_name?.trim()) return null;
    return safe(async () => {
      const { data } = await supabase.from('players').insert({
        full_name: full_name.trim(), known_as, category, sport_type, headline, primary_position,
        nationality, region, photo_url, user_id, metrics, created_by: createdBy,
      }).select().single();
      return data;
    }, null);
  },

  /** Update a talent's editable profile fields (creator/claimant/admin only via RLS). */
  async updateTalent(playerId, patch = {}) {
    const ok = await resilient(
      [() => supabase.from('players').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', playerId)],
      { attemptsPerTier: 2, baseMs: 300, label: 'TalentEngine.updateTalent', fallbackValue: null }
    );
    return ok !== null;
  },

  // ── Event guests ("mention the guests who'll be there") ─────────────────
  async getEventGuests(eventId) {
    return safe(async () => {
      const { data } = await supabase
        .from('event_guests')
        .select('*, player:player_id(id, full_name, known_as, photo_url, primary_position, career_goals, career_rating, is_verified), profile:user_id(username, avatar_url)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      return data;
    }, []);
  },

  /**
   * Tag a guest on an event. `guest` may reference an existing player ({id})
   * or describe a new one ({full_name, ...}) which is created first. When the
   * role is "player" we also record a sport_athletes appearance so it rolls up
   * to the player's career (apps / recompute).
   */
  async addGuest({ eventId, guest, role = 'player', teamSide = null, clubId = null, category = null, addedBy }) {
    let playerId = guest.id || null;
    if (!playerId && guest.full_name) {
      const created = await this.createPlayer({ ...guest, category: guest.category || category, createdBy: addedBy });
      playerId = created?.id || null;
    }
    const inserted = await safe(async () => {
      const { data } = await supabase.from('event_guests').insert({
        event_id: eventId, player_id: playerId, user_id: guest.user_id || null,
        guest_name: guest.full_name || guest.known_as || null,
        role, team_side: teamSide, club_id: clubId, added_by: addedBy,
      }).select('*, player:player_id(id, full_name, known_as, photo_url, primary_position, category, career_goals, career_rating, is_verified), profile:user_id(username, avatar_url)').single();
      return data;
    }, null);

    if (playerId && role === 'player') {
      // Record the appearance + refresh cached career totals (best-effort).
      await safe(() => supabase.from('sport_athletes').insert({
        event_id: eventId, player_id: playerId, name: guest.full_name || guest.known_as || 'Player', user_id: guest.user_id || null,
      }), null);
      await safe(() => supabase.rpc('recompute_player_career', { p_player_id: playerId }), null);
    }
    return inserted;
  },

  /** Host edits a guest's per-event performance (role/side/rating/placement/award/metrics). */
  async updateGuest(guestId, patch = {}) {
    const ok = await resilient(
      [() => supabase.from('event_guests').update(patch).eq('id', guestId)],
      { attemptsPerTier: 2, baseMs: 300, label: 'TalentEngine.updateGuest', fallbackValue: null }
    );
    return ok !== null;
  },

  async removeGuest(guestId) {
    const ok = await resilient(
      [() => supabase.from('event_guests').delete().eq('id', guestId)],
      { attemptsPerTier: 2, baseMs: 300, label: 'TalentEngine.removeGuest', fallbackValue: null }
    );
    return ok !== null;
  },

  // ── Scout search (leaderboard) ──────────────────────────────────────────
  async searchTopPlayers({ category = null, sport = null, metric = 'rating', region = null, position = null, minAge = null, maxAge = null, limit = 10 } = {}) {
    return safe(async () => {
      const { data } = await supabase.rpc('search_top_players', {
        p_category: category, p_metric: metric, p_region: region,
        p_position: position, p_min_age: minAge, p_max_age: maxAge,
        p_sport: sport, p_limit: limit,
      });
      return data;
    }, []);
  },
};

/** FIFA-style overall rating (0–99) from the player's avg match rating,
 *  with a sensible fallback derived from output when there are no ratings. */
export function playerOVR(player) {
  if (!player) return 0;
  const r = Number(player.career_rating) || 0;
  if (r > 0) return Math.min(99, Math.round(r * 9.9));
  // No ratings yet → derive a modest baseline from production
  const goals = Number(player.career_goals) || 0;
  const apps = Number(player.career_apps) || 0;
  const base = 55 + Math.min(25, goals * 2) + Math.min(10, Math.floor(apps / 3));
  return Math.min(85, base);
}

export default TalentEngine;
