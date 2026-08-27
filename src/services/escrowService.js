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
   * Release escrow to the provider.
   *
   * One authorized, atomic server call. `release_escrow_to_provider` (see
   * supabase/queries/definer_rpc_hardening.sql) checks that the caller is the
   * CLIENT who paid, that the booking is still `escrow_held`, then marks it
   * completed and credits the provider's wallet under a row lock.
   *
   * SECURITY: there is deliberately NO client-side fallback here. The previous
   * implementation fell back to `profiles.update({ wallet_balance })` on the
   * PROVIDER's row when the RPC failed. That is a direct client write to a money
   * column, and it only appeared to be safe because RLS happened to block it —
   * `profiles_update_own` restricts updates to `id = auth.uid()`, and the payer
   * is the one releasing. So the fallback could never actually pay anyone; it
   * just masked the fact that the RPC call was malformed (it passed
   * `user_id`/`amount` to a function whose parameters are `p_user_id`/`p_amount`,
   * so PostgREST never resolved it). Net effect: bookings were marked completed
   * and providers were never paid. A money movement either happens server-side,
   * authorized and atomic, or it fails loudly.
   *
   * @param {string} bookingId
   * @param {string} [providerId] unused — the server reads it from the booking.
   *   Kept so existing call sites don't break.
   * Returns true on success, false on failure.
   */
  async releaseToProvider(bookingId, providerId) {
    if (!bookingId) {
      log.error('EscrowService:releaseToProvider', 'bookingId required');
      return false;
    }
    try {
      const { data, error } = await withRetry(() =>
        supabase.rpc('release_escrow_to_provider', { p_booking_id: bookingId })
      );

      if (error) {
        log.error('EscrowService:releaseToProvider', error);
        return false;
      }

      // The RPC returns the booking it settled; no rows means nothing was released.
      const settled = Array.isArray(data) ? data[0] : data;
      if (!settled) {
        log.error('EscrowService:releaseToProvider', 'no booking settled');
        return false;
      }

      const paidProvider = settled.provider_id || providerId;

      // ── Movement OS Integration: Update Social Integrity Score ──
      // Reward the provider for successful delivery
      TrustLedger.updateAfterPath(paidProvider, {
        checkinReliable: true,
        cargoIntact: true,
        socialPositive: true,
      }).catch(() => {});

      // ── Reward XP ──
      LevelManager.addXP(paidProvider, 'BOOKING_COMPLETE').catch(() => {});

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
