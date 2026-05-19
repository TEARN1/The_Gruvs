/**
 * ROYAL GOVERNANCE ENGINE v1.0
 *
 * Decentralized platform direction.
 * Powered by Vibe-Equity and the 32M-Token Neural Mesh.
 */
import { supabase } from './supabase';
import { chat, AIFeature } from './claudeService';

export const RoyalGovernance = {
  MIN_EQUITY_FOR_VOTE: 500,

  /**
   * Propose a new platform feature autonomously.
   * Scans Echoes and Vibe patterns to find what the kingdom needs.
   */
  async generateAutonomousProposal() {

    const { data: echoes } = await supabase.from('echoes').select('body').limit(100);

    const prompt = `[ROYAL COUNCIL PROPOSAL]
    USER FEEDBACK (Echoes): ${JSON.stringify(echoes)}

    TASK: Analyze current user pain points and market opportunities.
    Propose ONE major platform feature to be voted on by the Royal Council.

    Return JSON: {
      "proposal_title": "Copy",
      "proposal_description": "Detailed logic",
      "equity_reward": number,
      "strategic_value": "Why this matters"
    }`;

    try {
      const response = await chat([{ role: 'user', content: prompt }], {
        feature: AIFeature.ADMIN,
        systemExtra: "You are the Supreme Advisor to the King."
      });

      const proposal = JSON.parse(response.text);

      // Save to governance table
      await supabase.from('governance_proposals').insert({
        title: proposal.proposal_title,
        description: proposal.proposal_description,
        status: 'voting_open',
        created_at: new Date().toISOString()
      });

      return proposal;
    } catch (e) {
       console.error('[Governance] Proposal failed:', e.message);
       return null;
    }
  },

  /**
   * Cast a vote.
   * Verifies equity balance before allowing the vote.
   */
  async castRoyalVote(userId, proposalId, voteType) {
    const { data: profile } = await supabase.from('profiles').select('vibe_equity').eq('id', userId).single();

    if ((profile?.vibe_equity || 0) < this.MIN_EQUITY_FOR_VOTE) {
      throw new Error("Insufficient Vibe-Equity to enter the Royal Council.");
    }

    await supabase.from('governance_votes').insert({
      user_id: userId,
      proposal_id: proposalId,
      vote: voteType,
      weight: profile.vibe_equity
    });

    return true;
  }
};
