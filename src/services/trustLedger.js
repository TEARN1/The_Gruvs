import { supabase } from './supabase';

const TIERS = [
  {
    tier: 'Bronze',
    color: '#9ca3af',
    minScore: 0,
    perks: ['Access to basic gigs', 'Standard visibility'],
  },
  {
    tier: 'Silver',
    color: '#C0C0C0',
    minScore: 40,
    perks: ['Priority gig matching', 'Silver badge on profile', '5% fee reduction'],
  },
  {
    tier: 'Gold',
    color: '#FFD700',
    minScore: 66,
    perks: ['Featured provider status', 'Gold badge', '10% fee reduction', 'Early access to events'],
  },
  {
    tier: 'Platinum',
    color: '#E5E4E2',
    minScore: 86,
    glowColor: '#06b6d4', // cyan glow
    perks: [
      'Top placement in search',
      'Platinum badge with cyan glow',
      '15% fee reduction',
      'Dedicated support',
      'Verified Provider checkmark',
    ],
  },
];

export const TrustLedger = {
  /**
   * Fetch the social_integrity_score for a user.
   * Returns a number 0-100, or 0 on failure.
   */
  async getSISScore(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('social_integrity_score')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('[TrustLedger.getSISScore] error:', error?.message);
        return 0;
      }

      const score = data.social_integrity_score;
      if (typeof score !== 'number') return 0;
      return Math.min(100, Math.max(0, score));
    } catch (err) {
      console.error('[TrustLedger.getSISScore] unexpected:', err.message);
      return 0;
    }
  },

  /**
   * Update SIS score after a completed path/gig.
   * Weighted inputs: checkinReliable=40%, cargoIntact=35%, socialPositive=25%
   * Attempts RPC first, falls back to manual UPDATE.
   *
   * @param {string} userId
   * @param {{ checkinReliable: boolean, cargoIntact: boolean, socialPositive: boolean }} flags
   */
  async updateAfterPath(userId, { checkinReliable = false, cargoIntact = false, socialPositive = false }) {
    try {
      // Build a 0-100 delta contribution for this interaction
      const delta =
        (checkinReliable ? 40 : -10) * 0.4 +
        (cargoIntact ? 35 : -15) * 0.35 +
        (socialPositive ? 25 : -5) * 0.25;

      // Round to 2dp
      const roundedDelta = Math.round(delta * 100) / 100;

      // Try RPC first
      const { error: rpcError } = await supabase.rpc('update_sis_score', {
        user_id: userId,
        check_in_reliable: checkinReliable,
        cargo_intact: cargoIntact,
        social_positive: socialPositive,
      });

      if (!rpcError) return true;

      // RPC doesn't exist or failed — manual fallback
      const { data: prof, error: fetchErr } = await supabase
        .from('profiles')
        .select('social_integrity_score')
        .eq('id', userId)
        .single();

      if (fetchErr || !prof) {
        console.error('[TrustLedger.updateAfterPath] fetch error:', fetchErr?.message);
        return false;
      }

      const current = typeof prof.social_integrity_score === 'number'
        ? prof.social_integrity_score
        : 50;

      const newScore = Math.min(100, Math.max(0, current + roundedDelta));

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ social_integrity_score: newScore })
        .eq('id', userId);

      if (updateErr) {
        console.error('[TrustLedger.updateAfterPath] update error:', updateErr.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[TrustLedger.updateAfterPath] unexpected:', err.message);
      return false;
    }
  },

  /**
   * Return tier metadata for a given score.
   * @param {number} score 0-100
   * @returns {{ tier: string, color: string, minScore: number, perks: string[], glowColor?: string }}
   */
  getProviderTier(score) {
    // Walk tiers from highest to lowest
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (score >= TIERS[i].minScore) {
        return TIERS[i];
      }
    }
    return TIERS[0]; // Bronze fallback
  },

  /**
   * Fetch the top N profiles ordered by social_integrity_score descending.
   * Returns array of profile rows, or [] on failure.
   */
  async getLeaderboardByTrust(limit = 20) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, social_integrity_score, display_name')
        .order('social_integrity_score', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[TrustLedger.getLeaderboardByTrust] error:', error.message);
        return [];
      }

      return data ?? [];
    } catch (err) {
      console.error('[TrustLedger.getLeaderboardByTrust] unexpected:', err.message);
      return [];
    }
  },
};
