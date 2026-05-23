import { supabase } from './supabase';
import { TrustLedger } from './trustLedger';
import { LevelManager } from './dataFlow';
import { log } from '../utils/log';
import { withRetry } from '../utils/retry';

export const EscrowService = {
  /**
   * Lock funds in escrow by inserting a service_bookings row.
   * Returns the new booking id, or null on failure.
   */
  async lockFunds(bookingData) {
    try {
      const {
        requester_id,
        provider_id,
        service_node_id,
        cargo_type,
        origin_address,
        destination_address,
        pickup_address,
        dropoff_address,
        scheduled_at,
        amount_cents,
      } = bookingData;

      const { data, error } = await supabase
        .from('service_bookings')
        .insert([
          {
            client_id: requester_id,
            provider_id,
            service_node_id,
            cargo_type,
            pickup_address: pickup_address || origin_address,
            dropoff_address: dropoff_address || destination_address,
            scheduled_at,
            amount_cents,
            estimated_price: amount_cents ? (amount_cents / 100) : null,
            status: 'escrow_held',
            created_at: new Date().toISOString(),
          },
        ])
        .select('id')
        .single();

      if (error) {
        log.error('EscrowService:lockFunds', error);
        return null;
      }

      return data?.id ?? null;
    } catch (err) {
      log.error('EscrowService:lockFunds', err);
      return null;
    }
  },

  /**
   * Release escrow to the provider:
   *  - marks booking as 'completed'
   *  - increments provider's wallet_balance in profiles
   * Returns true on success, false on failure.
   */
  async releaseToProvider(bookingId, providerId) {
    try {
      // Fetch booking — verify providerId owns this booking (IDOR defense)
      const { data: booking, error: fetchErr } = await supabase
        .from('service_bookings')
        .select('amount_cents, client_id, provider_id')
        .eq('id', bookingId)
        .eq('provider_id', providerId)   // ownership check
        .eq('status', 'escrow_held')     // only release held funds
        .single();

      if (fetchErr || !booking) {
        log.error('EscrowService:releaseToProvider', fetchErr || 'booking not found or not owned');
        return false;
      }

      // Mark booking completed — scoped to both id AND provider_id
      const { error: updateErr } = await withRetry(() =>
        supabase.from('service_bookings')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', bookingId)
          .eq('provider_id', providerId)
      );

      if (updateErr) {
        log.error('EscrowService:releaseToProvider', updateErr);
        return false;
      }

      // Increment provider wallet_balance (rands = cents / 100)
      const amountRands = booking.amount_cents / 100;

      const { error: walletErr } = await supabase.rpc('increment_wallet_balance', {
        user_id: providerId,
        amount: amountRands,
      });

      if (walletErr) {
        // Fallback: manual read-modify-write — scoped to providerId
        const { data: prof } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', providerId)
          .single();
        if (prof) {
          await withRetry(() =>
            supabase.from('profiles')
              .update({ wallet_balance: (prof.wallet_balance || 0) + amountRands })
              .eq('id', providerId)
          );
        }
      }

      // ── Movement OS Integration: Update Social Integrity Score ──
      // Reward the provider for successful delivery
      TrustLedger.updateAfterPath(providerId, {
        checkinReliable: true,
        cargoIntact: true,
        socialPositive: true,
      }).catch(() => {});

      // ── Reward XP ──
      LevelManager.addXP(providerId, 'BOOKING_COMPLETE').catch(() => {});

      return true;
    } catch (err) {
      log.error('EscrowService:releaseToProvider', err);
      return false;
    }
  },

  /**
   * Initiate a dispute:
   *  - marks booking as 'disputed'
   *  - inserts a row into disputes table
   * Returns true on success, false on failure.
   */
  // callerId must be either the client_id or provider_id of the booking
  async initiateDispute(bookingId, reason, callerId) {
    if (!callerId) { log.error('EscrowService:initiateDispute', 'callerId required'); return false; }
    try {
      // Ownership check — only a party to the booking can open a dispute
      const { data: booking, error: checkErr } = await supabase
        .from('service_bookings')
        .select('id')
        .eq('id', bookingId)
        .or(`client_id.eq.${callerId},provider_id.eq.${callerId}`)
        .single();

      if (checkErr || !booking) {
        log.error('EscrowService:initiateDispute', 'booking not found or caller not a party');
        return false;
      }

      const { error: updateErr } = await withRetry(() =>
        supabase.from('service_bookings')
          .update({ status: 'disputed' })
          .eq('id', bookingId)
          .or(`client_id.eq.${callerId},provider_id.eq.${callerId}`)
      );

      if (updateErr) { log.error('EscrowService:initiateDispute', updateErr); return false; }

      const { error: disputeErr } = await supabase
        .from('disputes')
        .insert([{ booking_id: bookingId, raised_by: callerId, reason, status: 'open', created_at: new Date().toISOString() }]);

      if (disputeErr) { log.error('EscrowService:initiateDispute:insert', disputeErr); return false; }

      return true;
    } catch (err) {
      log.error('EscrowService:initiateDispute', err);
      return false;
    }
  },

  /**
   * Fetch the current row for a booking.
   * Returns the booking object or null.
   */
  async getBookingStatus(bookingId) {
    try {
      const { data, error } = await supabase
        .from('service_bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (error) {
        log.error('EscrowService:getBookingStatus', error);
        return null;
      }

      return data ?? null;
    } catch (err) {
      log.error('EscrowService:getBookingStatus', err);
      return null;
    }
  },

  /**
   * Fetch all bookings for a user (either as client or provider).
   */
  async getUserBookings(userId) {
    if (!userId) return [];
    try {
      const { data, error } = await supabase
        .from('service_bookings')
        .select('*, provider:provider_id(username, avatar_url), client:client_id(username, avatar_url)')
        .or(`client_id.eq.${userId},provider_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      log.error('EscrowService:getUserBookings', err);
      return [];
    }
  },
};
