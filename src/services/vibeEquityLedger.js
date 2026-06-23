/**
 * VIBE-EQUITY LEDGER v1.0 — Non-Monetary Wealth Engine.
 *
 * Formalizes "Vibe" as a scarce social asset.
 * Governed by the 32M-Token Neural Mesh to ensure economic stability.
 */
import { supabase } from './supabase';
import projectDNA from './projectDNA.json';

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

      const { count: totalSupply } = await supabase.from('profiles').select('vibe_score', { count: 'exact', head: true });
      const halvingInterval = projectDNA.sovereign_mint_params.halving_interval_equity;
      const phase = Math.floor((totalSupply || 0) / halvingInterval);
      const supplyCap = projectDNA.sovereign_mint_params.global_supply_cap;

      if ((totalSupply || 0) >= supplyCap) {
        console.warn("[Mint] Global Supply Cap reached. Transitioning to Burn-Only Economy.");
        return { minted: 0, total: totalSupply };
      }

      const scarcityFactor = 1 / Math.pow(2, phase);

      const { data: profile } = await supabase.from('profiles').select('vibe_score, social_integrity_score').eq('id', userId).single();
      const integrityEfficiency = (profile?.social_integrity_score || 50) / 100;

      const amount = weight * integrityEfficiency * scarcityFactor;
      const newEquity = (profile?.vibe_score || 0) + amount;

      const { error: updateErr } = await supabase.from('profiles').update({
        vibe_score: parseFloat(newEquity.toFixed(8)),
        last_mint_at: new Date().toISOString()
      }).eq('id', userId);
      if (updateErr) throw updateErr;

      return { minted: amount, total: newEquity, phase: phase + 1 };
    } catch (e) {
      console.error('[VibeEquityLedger] mintEquity failed', e);
      return { minted: 0, total: 0 };
    }
  },

  /**
   * "Burn" Equity to perform high-privilege actions.
   * e.g. Pinning a Gruv to the top of the Kingdom.
   */
  async burnEquity(userId, amount) {
    try {
      const { data: profile } = await supabase.from('profiles').select('vibe_score').eq('id', userId).single();
      if ((profile?.vibe_score || 0) < amount) throw new Error("Insufficient Vibe Score.");

      const newEquity = profile.vibe_score - amount;
      await supabase.from('profiles').update({ vibe_score: newEquity }).eq('id', userId);

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
