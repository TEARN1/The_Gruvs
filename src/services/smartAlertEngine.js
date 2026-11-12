/**
 * The Gruvs — Smart Alert Engine
 * Powers the 3 Proactive Alert Engines:
 * 1. RSVP-to-Designer Fashion Matcher
 * 2. 90-Day Upcoming Event Lead Radar for Hustlers
 * 3. Kasi Soccer, High-Stakes Matches & Favorite Player Alerts
 */

import { supabase, isSupabaseEnabled } from './supabase';
import { resilientRead } from '../utils/resilience';
import { logError } from '../utils/logError';
import { HUSTLER_CATEGORIES } from '../constants/hustlerCategories';

// Memory fallback store for offline / tests
const localSubscriptions = {
  teams: new Set(),
  players: new Set(),
};

export const SmartAlertEngine = {
  // ── Engine 1: RSVP-to-Designer Matcher ──────────────────────────────────
  /**
   * Matches event dress code & theme to local designers, pop-ups, and stylists.
   * @param {Object} event - Event record containing dress_code, tags, category, location
   * @returns {Promise<Array>} List of recommended designers & products
   */
  async getFashionMatchesForEvent(event) {
    if (!event) return [];
    const rawDressCode = event.dress_code || event.dressCode || '';
    const dressCode = String(rawDressCode).toLowerCase();
    const eventTags = Array.isArray(event.tags) ? event.tags : [];
    const keywords = [dressCode, ...eventTags, event.category].filter(Boolean).map(k => String(k).toLowerCase());

    try {
      if (isSupabaseEnabled) {
        // Query active fashion and grooming service nodes
        const { data, error } = await resilientRead(
          'service_nodes',
          () => supabase
            .from('service_nodes')
            .select('id, name, description, category, hourly_rate, currency, rating, cover_image, profile_id')
            .in('category', ['fashion_designers', 'streetwear_popups', 'makeup_artists_mua', 'mobile_barbers'])
            .eq('is_active', true)
            .limit(10),
          []
        );

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((provider) => ({
            id: provider.id,
            name: provider.name,
            category: provider.category,
            tagline: provider.description || 'Custom event attire & styling',
            priceLabel: provider.hourly_rate ? `From R${provider.hourly_rate}` : 'Custom Quote',
            coverImage: provider.cover_image,
            matchReason: rawDressCode ? `Matches "${rawDressCode}" dress code` : `Fits ${event.category || 'event'} style`,
            providerId: provider.profile_id,
          }));
        }
      }
    } catch (e) {
      logError('SmartAlertEngine.getFashionMatchesForEvent', e);
    }

    // Curated fallback matches for immediate offline experience
    return [
      {
        id: 'fashion_node_1',
        name: 'Kasi Drip Bespoke',
        category: 'fashion_designers',
        tagline: 'Custom tailored event blazers & modern African prints',
        priceLabel: 'From R950',
        matchReason: rawDressCode ? `Matches "${rawDressCode}" dress code` : 'Tailored event fit',
      },
      {
        id: 'fashion_node_2',
        name: 'Street Heritage Pop-Up',
        category: 'streetwear_popups',
        tagline: 'Limited edition graphic hoodies, cargo wear & sneakers',
        priceLabel: 'From R450',
        matchReason: 'Vibe check & event footwear',
      },
      {
        id: 'fashion_node_3',
        name: 'GlowGlam Express MUA',
        category: 'makeup_artists_mua',
        tagline: 'Red carpet glam makeup, lash installation & braids',
        priceLabel: 'From R350',
        matchReason: 'Event-ready glam',
      },
    ];
  },

  // ── Engine 2: 90-Day Upcoming Event Lead Radar ──────────────────────────
  /**
   * Scans events that are 30 to 90 days out or recurring annually,
   * detecting which service providers (caterers, drums, sound, bakkies) could supply them.
   * @param {string} providerCategory - e.g., 'shisanyama_braai', 'pa_line_array', 'bakkie_haulers'
   * @param {Object} options - { maxDays: 90, minDays: 14 }
   * @returns {Promise<Array>} Upcoming opportunities for vendors to submit 1-tap bids
   */
  async scanUpcomingLeads(providerCategory = null, { minDays = 14, maxDays = 90 } = {}) {
    const now = Date.now();
    const minTime = new Date(now + minDays * 86400000).toISOString();
    const maxTime = new Date(now + maxDays * 86400000).toISOString();

    try {
      if (isSupabaseEnabled) {
        let query = supabase
          .from('events')
          .select('id, title, event_date, date_time, category, location, venue_name, expected_attendance, cover_url')
          .gte('date_time', minTime)
          .lte('date_time', maxTime)
          .order('date_time', { ascending: true })
          .limit(20);

        const { data, error } = await resilientRead('scanUpcomingLeads', () => query, []);

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((ev) => {
            const eventDate = new Date(ev.date_time || ev.event_date);
            const daysAway = Math.max(1, Math.round((eventDate.getTime() - now) / 86400000));
            return {
              eventId: ev.id,
              eventTitle: ev.title,
              eventDate: ev.event_date,
              daysAway,
              location: ev.venue_name || ev.location || 'Local Venue',
              category: ev.category,
              expectedGuests: ev.expected_attendance || '200+',
              pitchOpportunity: `Organizers actively booking gear & crew for ${daysAway} days ahead`,
              recommendedRole: providerCategory || 'Vendor / Gear Partner',
            };
          });
        }
      }
    } catch (e) {
      logError('SmartAlertEngine.scanUpcomingLeads', e);
    }

    // High quality demo leads if database is empty or offline
    return [
      {
        eventId: 'lead_ev_1',
        eventTitle: 'Soweto Summer Groove Fest',
        eventDate: new Date(now + 42 * 86400000).toISOString().split('T')[0],
        daysAway: 42,
        location: 'Zone 6 Venue, Soweto',
        category: 'music',
        expectedGuests: '1,500+',
        pitchOpportunity: 'Open for spit braai caterers, stage sound, and bakkie logistics',
        recommendedRole: providerCategory || 'Gear & Food Vendor',
      },
      {
        eventId: 'lead_ev_2',
        eventTitle: 'Pretoria Amapiano Explosion',
        eventDate: new Date(now + 65 * 86400000).toISOString().split('T')[0],
        daysAway: 65,
        location: 'Tshwane Events Centre',
        category: 'nightlife',
        expectedGuests: '3,000+',
        pitchOpportunity: 'Calling drum kit rentals, Pioneer CDJ-3000 setups, and VIP shuttles',
        recommendedRole: providerCategory || 'Sound / Backline Partner',
      },
    ];
  },

  // ── Engine 3: Kasi Soccer & Lineup Alerts ────────────────────────────────
  /**
   * Follow a team or individual player to receive starting lineup notifications.
   */
  async followTeamOrPlayer(userId, targetId, type = 'team') {
    if (!targetId) return false;
    const key = `${type}:${targetId}`;
    if (type === 'player') {
      localSubscriptions.players.add(targetId);
    } else {
      localSubscriptions.teams.add(targetId);
    }

    if (isSupabaseEnabled && userId) {
      try {
        await supabase.from('sport_fan_subscriptions').upsert({
          user_id: userId,
          target_id: targetId,
          target_type: type,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        logError('SmartAlertEngine.followTeamOrPlayer', e);
      }
    }
    return true;
  },

  async unfollowTeamOrPlayer(userId, targetId, type = 'team') {
    if (!targetId) return false;
    if (type === 'player') {
      localSubscriptions.players.delete(targetId);
    } else {
      localSubscriptions.teams.delete(targetId);
    }

    if (isSupabaseEnabled && userId) {
      try {
        await supabase.from('sport_fan_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('target_id', targetId)
          .eq('target_type', type);
      } catch (e) {
        logError('SmartAlertEngine.unfollowTeamOrPlayer', e);
      }
    }
    return true;
  },

  isFollowing(targetId, type = 'team') {
    return type === 'player'
      ? localSubscriptions.players.has(targetId)
      : localSubscriptions.teams.has(targetId);
  },

  /**
   * Check if a match involves followed teams or favorite players.
   * Generates a match-day alert card if matched.
   */
  evaluateMatchAlert(match = {}, teamSheet = []) {
    const homeTeam = match.home_team || match.team_a || '';
    const awayTeam = match.away_team || match.team_b || '';
    const isTeamAlert = localSubscriptions.teams.has(homeTeam) || localSubscriptions.teams.has(awayTeam);

    const followedPlayersInMatch = (teamSheet || []).filter((p) => {
      const pid = p.id || p.player_id || p.name;
      return localSubscriptions.players.has(pid);
    });

    if (isTeamAlert || followedPlayersInMatch.length > 0) {
      return {
        hasAlert: true,
        title: isTeamAlert ? `Match Day Alert: ${homeTeam} vs ${awayTeam}` : `Favorite Player Alert!`,
        message: followedPlayersInMatch.length > 0
          ? `${followedPlayersInMatch.map(p => p.name || 'Player').join(', ')} is in the starting lineup!`
          : `Kickoff scheduled for ${match.time || 'today'} at ${match.pitch_name || 'Grounds'}`,
        matchId: match.id,
        isStakesMatch: !!match.is_cash_prize || !!match.stakes_pool,
      };
    }
    return { hasAlert: false };
  },
};

export default SmartAlertEngine;
