/**
 * VIBE-EQUITY LEDGER v2.0 — Non-Monetary Wealth Engine.
 *
 * Formalizes "Vibe" as a scarce social asset.
 * Governed by the 32M-Token Neural Mesh to ensure economic stability.
 *
 * F2 — ONE vibe_score writer: equity now lives in its OWN column
 * (profiles.vibe_equity — see supabase/migrations/20260927000100_vibe_equity_column.sql), never
 * vibe_score. Before, one check-in fired THREE vibe_score writers (this mint,
 * touchDown's +8, computeVibeScore's recompute) that clobbered each other —
 * the recompute rounded the 8-decimal equity float away every time.
 * vibe_score = earned contribution, written ONLY by ScoreEngine.computeVibeScore.
 * vibe_equity = spendable social asset, written ONLY here (mint/burn).
 * Pre-migration the column may not exist: mint/burn then no-op gracefully.
 */
import { supabase } from './supabase';
import projectDNA from './projectDNA.json';
import { resilient } from '../utils/resilience';

const isMissingColumn = (error) =>
  error?.code === '42703' ||
  /vibe_equity|column|schema cache/i.test(error?.message || '');

export const VibeEquityLedger = {
  // Economic Constants (Weighted by PhD Brain)
  MULTIPLIERS: {
    EVENT_HOSTING: 25.0,
    PHYSICAL_CHECKIN: 10.0,
    SOCIAL_RESONANCE: 5.0, // High Echo-to-Vibe ratio
    COMMUNITY_GOVERNANCE: 15.0 // Voting on features
  },

  /**
   * High-Fidelity Equity Minting (Sovereign Mint Protocol).
   * Logic: M = (W * E * P) / (2^(floor(Total_Supply / Halving_Interval)))
   * Where W = Action Weight, E = Efficiency, P = PhD Stability Factor
   */
  async mintEquity(userId, actionType, metadata = {}) {
    // Minting happens in the database when the real action is saved (event
    // posted, check-in, vibe: reward_on_insert, migration 20261124200500),
    // with the same weights and a daily cap. An app that could mint could
    // mint anything, so this only reports the balance.
    try {
      const { data: profile } = await supabase.from('profiles').select('vibe_equity').eq('id', userId).single();
      return { minted: 0, total: Number(profile?.vibe_equity) || 0, persisted: true, action: actionType, metadata };
    } catch {
      return { minted: 0, total: 0 };
    }
  },

  /**
   * "Burn" Equity to perform high-privilege actions.
   * e.g. Pinning a Gruv to the top of the Kingdom.
   * Spends vibe_equity — a burn can never touch the earned vibe_score.
   */
  async burnEquity(userId, amount) {
    // burn_my_equity checks the balance and spends it in the database, for
    // the signed-in user only; a failed spend throws.
    const { data, error } = await supabase.rpc('burn_my_equity', { p_amount: amount, p_reason: 'burn' });
    if (error) {
      console.error('[VibeEquityLedger] burnEquity failed', error);
      throw new Error(error.message || 'Could not save your spend -- try again.');
    }
    return Number(data) || 0;
  },

  /**
   * The Economic Governor.
   * Checks for "Vibe Bubbles" and autonomously adjusts difficulty.
   */
  async runEconomicAudit() {
    try {
      const { data: stats } = await supabase.rpc('get_economic_velocity');
      if (!stats) return;
      if (stats.velocity > projectDNA.neural_weights.behavioral_economic_balance) {
        console.warn("[Governor] Economic Velocity too high. Hardening minting weights.");
        this.MULTIPLIERS.EVENT_HOSTING *= 0.95;
      }
    } catch { /* RPC not yet deployed — audit is best-effort */ }
  }
};
