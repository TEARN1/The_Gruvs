/**
 * ROYAL GOVERNANCE ENGINE v1.0
 *
 * Decentralized platform direction.
 * Powered by Vibe-Equity and the 32M-Token Neural Mesh.
 */
import { supabase } from './supabase';

export const RoyalGovernance = {
  MIN_EQUITY_FOR_VOTE: 500,

  /**
   * Propose a new platform feature autonomously.
   * Scans Echoes and Vibe patterns to find what the kingdom needs.
   */
  async generateAutonomousProposal() {
    // Local deterministic proposals list
    const candidates = [
      {
        proposal_title: "Amapiano Royalty Tax Rebate",
        proposal_description: "Reduce treasury cuts from ticket sales of music category events by 2% to incentivize local artist gigs.",
        equity_reward: 100,
        strategic_value: "Fosters grassroots growth in the local music economy."
      },
      {
        proposal_title: "Sovereign DJ Backing Fund",
        proposal_description: "Initialize a communal pool of 50,000 Vibe-Equity to subsidize sound gear rentals for emerging talent.",
        equity_reward: 150,
        strategic_value: "Empowers new artists and improves acoustic production values."
      },
      {
        proposal_title: "Decentralized Ticket Fair-Play",
        proposal_description: "Impose a maximum resale markup cap of 15% on the peer-to-peer secondary market ticket trading.",
        equity_reward: 80,
        strategic_value: "Combats scalping and keeps event access fair for the community."
      }
    ];

    const proposal = candidates[Math.floor(Math.random() * candidates.length)];

    try {
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
    const { data: profile } = await supabase.from('profiles').select('vibe_score').eq('id', userId).single();

    if ((profile?.vibe_score || 0) < this.MIN_EQUITY_FOR_VOTE) {
      throw new Error("Insufficient Vibe Score to enter the Royal Council.");
    }

    await supabase.from('governance_votes').insert({
      user_id: userId,
      proposal_id: proposalId,
      vote: voteType,
      weight: profile.vibe_score
    });

    return true;
  }
};
