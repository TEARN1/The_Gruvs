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
  // CONFIGURATION: Precision Constants
  DECAY_HALF_LIFE_DAYS: 30,
  K_STABILITY_FACTOR: 0.85,
  CENTRALITY_WEIGHT: 0.15, // Impact of "Who trusts you" on your score

  /**
   * Calculate High-Fidelity SIS Score.
   * Logic: S = [(B * K) + (R * (1 - K))] * D + (C * W)
   * Where B = Base History, R = Recent Reliability, D = Temporal Decay, C = Centrality, W = Weight
   */
  async getSISScore(userId) {
    try {
      const { data: prof } = await supabase.from('profiles').select('social_integrity_score, last_active_at:last_seen, followers_count').eq('id', userId).single();

      if (!prof) return 50.00000000;

      // 1. Calculate Temporal Decay (Exponential)
      const lastActive = prof.last_active_at ? new Date(prof.last_active_at) : new Date();
      const daysSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
      const decay = Math.pow(0.5, daysSinceActive / this.DECAY_HALF_LIFE_DAYS);

      // 2. Calculate Eigen-Influence (Centrality Proxy)
      const { data: followerScores } = await supabase.rpc('get_follower_integrity_aggregate', { u_id: userId });
      const centralityScore = followerScores?.aggregate_score || (prof.followers_count * 0.1);

      // NEW: Incorporate Real-World Social Proof from Path Crossings
      const { count: crossingCount } = await supabase.from('path_crossings').select('id', { count: 'exact', head: true })
        .or(`user_id_a.eq.${userId},user_id_b.eq.${userId}`)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days
      const realWorldSocialProof = (crossingCount || 0) * 0.5; // Each crossing adds 0.5 to SIS

      // 3. Synthesize High-Fidelity Score with 8-decimal precision
      const base = prof.base_trust_index || 50;
      const current = prof.social_integrity_score || 50;

      const reputationStability = (base * this.K_STABILITY_FACTOR) + (current * (1 - this.K_STABILITY_FACTOR));
      const finalScore = (reputationStability * decay) + (centralityScore * this.CENTRALITY_WEIGHT);

      return parseFloat(Math.min(100, Math.max(0, finalScore + realWorldSocialProof)).toFixed(8));
    } catch {
      return 50.00000000;
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
