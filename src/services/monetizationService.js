/**
 * MONETIZATION SERVICE v1.0
 * 
 * Handles double-entry virtual coin balances, diamond earnings,
 * and cashouts/withdrawals for creators and hosts.
 */
import { supabase } from './supabase';
import { resilient } from '../utils/resilience';

export const MonetizationService = {
  /**
   * Get total virtual coins balance of a user
   */
  async getCoinBalance(userId) {
    if (!userId) return 0;
    try {
      const { data, error } = await supabase
        .from('coin_ledger')
        .select('amount')
        .eq('user_id', userId); // MUST scope to this user — never sum the whole table
      if (error) throw error;

      // Sum the positive credits and negative debits
      const balance = (data || []).reduce((sum, item) => sum + (item.amount || 0), 0);
      return Math.max(0, balance);
    } catch (e) {
      console.error('[MonetizationService] getCoinBalance failed', e);
      return 0;
    }
  },

  /**
   * Get total diamond balance of a host/creator
   */
  async getDiamondBalance(userId) {
    if (!userId) return 0;
    try {
      const { data, error } = await supabase
        .from('diamond_ledger')
        .select('amount')
        .eq('user_id', userId); // MUST scope to this user — never sum the whole table
      if (error) throw error;

      const balance = (data || []).reduce((sum, item) => sum + parseFloat(item.amount || 0), 0.0);
      return parseFloat(Math.max(0, balance).toFixed(4));
    } catch (e) {
      console.error('[MonetizationService] getDiamondBalance failed', e);
      return 0;
    }
  },

  /**
   * Fetch all active virtual gifts from the registry
   */
  async getActiveGifts() {
    try {
      const { data, error } = await supabase
        .from('gift_registry')
        .select('*')
        .eq('is_active', true)
        .order('coin_cost', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('[MonetizationService] getActiveGifts failed', e);
      return [];
    }
  },

  /**
   * Atomically process a gift transaction (calls pg process_gift RPC)
   */
  async sendGift(senderId, hostId, eventId, giftId) {
    if (!senderId || !hostId || !eventId || !giftId) return { success: false, error: 'Missing parameters.' };
    try {
      const { data, error } = await supabase.rpc('process_gift', {
        p_sender_id: senderId,
        p_host_id: hostId,
        p_event_id: eventId,
        p_gift_id: giftId
      });

      if (error) {
        if (error.message.includes('INSUFFICIENT_COINS')) {
          return { success: false, error: 'Insufficient coins in your wallet.' };
        }
        throw error;
      }
      return { success: true, ...data };
    } catch (e) {
      console.error('[MonetizationService] sendGift transaction failed', e);
      return { success: false, error: e.message || 'Transaction failed.' };
    }
  },

  /**
   * Submit a cashout request via the secure server-side RPC.
   *
   * The diamond-balance check, the ZAR conversion rate, and the ledger debit are
   * all done atomically inside Postgres (process_gift / request_cashout). Clients
   * cannot write coin_ledger / diamond_ledger / cashout_requests directly — those
   * tables are RLS read-only — so the old client-side inserts were both blocked by
   * RLS and a diamond-minting risk. The rate lives on the server now (not passed in).
   * `userId` is kept for call-site compatibility; the server uses auth.uid().
   */
  async requestCashout(userId, diamondAmount) {
    if (!diamondAmount || diamondAmount <= 0) {
      return { success: false, error: 'Invalid diamond amount.' };
    }

    try {
      const { data, error } = await supabase.rpc('request_cashout', {
        p_diamond_amount: diamondAmount,
      });
      if (error) {
        if ((error.message || '').includes('INSUFFICIENT_DIAMONDS')) {
          return { success: false, error: 'Insufficient diamonds balance.' };
        }
        throw error;
      }
      return { success: true, cashoutId: data?.cashout_id, fiatAmount: data?.fiat_amount, ...data };
    } catch (e) {
      console.error('[MonetizationService] requestCashout failed', e);
      return { success: false, error: e.message || 'Cashout request failed.' };
    }
  },

  /**
   * Fetch user's cashout history
   */
  async getCashoutHistory(userId) {
    if (!userId) return [];
    try {
      const { data, error } = await supabase
        .from('cashout_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('[MonetizationService] getCashoutHistory failed', e);
      return [];
    }
  }
};
