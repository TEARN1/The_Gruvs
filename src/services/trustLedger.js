import { supabase } from './supabase';
import { resilient } from '../utils/resilience';

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

      // Real-World Social Proof from Path Crossings.
      // The columns are `user_id` / `other_user_id` / `crossed_at` — this query
      // previously used user_id_a / user_id_b / created_at, none of which exist,
      // so PostgREST 400'd and (because only `count` was destructured) the
      // failure was invisible: this term was permanently 0. `error` is now
      // destructured so it can never go silent again.
      const { count: crossingCount, error: crossErr } = await supabase
        .from('path_crossings')
        .select('id', { count: 'exact', head: true })
        .or(`user_id.eq.${userId},other_user_id.eq.${userId}`)
        .gte('crossed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days
      if (crossErr) console.warn('[TrustLedger] path_crossings lookup failed:', crossErr.message);
      const realWorldSocialProof = (crossingCount || 0) * 0.5; // Each crossing adds 0.5 to SIS

      // 3. Synthesize High-Fidelity Score with 8-decimal precision
      // B (Base History) has no backing column — `prof.base_trust_index` was
      // never selected and does not exist on `profiles`, so this silently
      // evaluated to the neutral 50 for every user. Kept AT 50 deliberately:
      // collapsing B into R would make the K blend a no-op and jump everyone's
      // SIS (the verification gate is SIS >= 60), which is a product decision,
      // not a bug fix. Storing a real per-user baseline needs a new column.
      const NEUTRAL_BASE_TRUST = 50;
      const base = NEUTRAL_BASE_TRUST;
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

      // Was an ad hoc if(!rpcError) branch to a manual read-modify-write --
      // correct, but silent: a broken RPC ran the fallback path forever with
      // nobody told. resilient() keeps the exact same two strategies but
      // reports DEGRADED_PATH the moment tier 1 isn't the one running.
      const ok = await resilient(
        [
          () => supabase.rpc('update_sis_score', {
            user_id: userId,
            check_in_reliable: checkinReliable,
            cargo_intact: cargoIntact,
            social_positive: socialPositive,
          }),
          async () => {
            const { data: prof, error: fetchErr } = await supabase
              .from('profiles').select('social_integrity_score').eq('id', userId).single();
            if (fetchErr || !prof) throw fetchErr || new Error('profile not found');
            const current = typeof prof.social_integrity_score === 'number' ? prof.social_integrity_score : 50;
            const newScore = Math.min(100, Math.max(0, current + roundedDelta));
            return supabase.from('profiles').update({ social_integrity_score: newScore }).eq('id', userId);
          },
        ],
        { attemptsPerTier: 2, baseMs: 300, label: 'TrustLedger.updateAfterPath', fallbackValue: null }
      );

      if (ok === null) {
        console.error('[TrustLedger.updateAfterPath] both tiers failed');
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
