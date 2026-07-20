/**
 * VIBE-EQUITY LEDGER v2.0 — Non-Monetary Wealth Engine.
 *
 * Formalizes "Vibe" as a scarce social asset.
 * Governed by the 32M-Token Neural Mesh to ensure economic stability.
 *
 * F2 — ONE vibe_score writer: equity now lives in its OWN column
 * (profiles.vibe_equity — see supabase/queries/vibe_equity_column.sql), never
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
    try {
      const weight = this.MULTIPLIERS[actionType] || 1.0;

      const { count: totalSupply } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
      const halvingInterval = projectDNA.sovereign_mint_params.halving_interval_equity;
      const phase = Math.floor((totalSupply || 0) / halvingInterval);
      const supplyCap = projectDNA.sovereign_mint_params.global_supply_cap;

      if ((totalSupply || 0) >= supplyCap) {
        console.warn("[Mint] Global Supply Cap reached. Transitioning to Burn-Only Economy.");
        return { minted: 0, total: totalSupply };
      }

      const scarcityFactor = 1 / Math.pow(2, phase);

      // vibe_equity is the ONLY column this ledger touches — never vibe_score.
      const { data: profile, error: readErr } = await supabase
        .from('profiles').select('vibe_equity, social_integrity_score').eq('id', userId).single();
      if (readErr && isMissingColumn(readErr)) return { minted: 0, total: 0, persisted: false }; // pre-migration — no-op
      const integrityEfficiency = (profile?.social_integrity_score || 50) / 100;

      const amount = weight * integrityEfficiency * scarcityFactor;
      const newEquity = (Number(profile?.vibe_equity) || 0) + amount;

      // resilient() retries transient failures and falls back to dropping
      // last_mint_at (the exact column that was missing on the live DB until
      // schema_drift_columns.sql -- this used to fail the WHOLE update over
      // one optional column, silently losing a legitimate mint every time).
      const updated = await resilient(
        [
          () => supabase.from('profiles').update({
            vibe_equity: parseFloat(newEquity.toFixed(8)),
            last_mint_at: new Date().toISOString(),
          }).eq('id', userId),
          () => supabase.from('profiles').update({
            vibe_equity: parseFloat(newEquity.toFixed(8)),
          }).eq('id', userId),
        ],
        { attemptsPerTier: 2, baseMs: 300, label: 'VibeEquityLedger.mintEquity', fallbackValue: null }
      );
      if (updated === null) return { minted: 0, total: 0, persisted: false };

      return { minted: amount, total: newEquity, phase: phase + 1, persisted: true };
    } catch (e) {
      console.error('[VibeEquityLedger] mintEquity failed', e);
      return { minted: 0, total: 0 };
    }
  },

  /**
   * "Burn" Equity to perform high-privilege actions.
   * e.g. Pinning a Gruv to the top of the Kingdom.
   * Spends vibe_equity — a burn can never touch the earned vibe_score.
   */
  async burnEquity(userId, amount) {
    try {
      const { data: profile, error: readErr } = await supabase
        .from('profiles').select('vibe_equity').eq('id', userId).single();
      if (readErr && isMissingColumn(readErr)) throw new Error('Vibe Equity not available yet.');
      if ((Number(profile?.vibe_equity) || 0) < amount) throw new Error("Insufficient Vibe Equity.");

      const newEquity = Number(profile.vibe_equity) - amount;
      // The write's result was previously discarded entirely -- a failed
      // spend (RLS denial, dropped connection) still returned newEquity as
      // if it had persisted, so a user could see a lower balance client-side
      // that was never actually saved. resilient() makes the failure real.
      const updated = await resilient(
        [() => supabase.from('profiles').update({ vibe_equity: newEquity }).eq('id', userId)],
        { attemptsPerTier: 2, baseMs: 300, label: 'VibeEquityLedger.burnEquity', fallbackValue: null }
      );
      if (updated === null) throw new Error('Could not save your spend -- try again.');

      return newEquity;
    } catch (e) {
      console.error('[VibeEquityLedger] burnEquity failed', e);
      throw e;
    }
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
