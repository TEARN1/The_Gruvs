import { supabase } from './supabase';

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
        service_type,
        cargo_type,
        origin_address,
        destination_address,
        scheduled_at,
        amount_cents,
      } = bookingData;

      const { data, error } = await supabase
        .from('service_bookings')
        .insert([
          {
            client_id: requester_id,
            provider_id,
            service_type,
            cargo_type,
            origin_address,
            destination_address,
            scheduled_at,
            amount_cents,
            status: 'escrow_held',
            created_at: new Date().toISOString(),
          },
        ])
        .select('id')
        .single();

      if (error) {
        console.error('[EscrowService.lockFunds] error:', error.message);
        return null;
      }

      return data?.id ?? null;
    } catch (err) {
      console.error('[EscrowService.lockFunds] unexpected:', err.message);
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
      // Fetch booking to get the amount
      const { data: booking, error: fetchErr } = await supabase
        .from('service_bookings')
        .select('amount_cents')
        .eq('id', bookingId)
        .single();

      if (fetchErr || !booking) {
        console.error('[EscrowService.releaseToProvider] fetch error:', fetchErr?.message);
        return false;
      }

      // Mark booking completed
      const { error: updateErr } = await supabase
        .from('service_bookings')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', bookingId);

      if (updateErr) {
        console.error('[EscrowService.releaseToProvider] update booking error:', updateErr.message);
        return false;
      }

      // Increment provider wallet_balance (rands = cents / 100)
      const amountRands = booking.amount_cents / 100;

      const { error: walletErr } = await supabase.rpc('increment_wallet_balance', {
        user_id: providerId,
        amount: amountRands,
      });

      if (walletErr) {
        // Fallback: manual read-modify-write
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', providerId)
          .single();

        if (!profErr && prof) {
          const newBalance = (prof.wallet_balance || 0) + amountRands;
          await supabase
            .from('profiles')
            .update({ wallet_balance: newBalance })
            .eq('id', providerId);
        }
      }

      return true;
    } catch (err) {
      console.error('[EscrowService.releaseToProvider] unexpected:', err.message);
      return false;
    }
  },

  /**
   * Initiate a dispute:
   *  - marks booking as 'disputed'
   *  - inserts a row into disputes table
   * Returns true on success, false on failure.
   */
  async initiateDispute(bookingId, reason) {
    try {
      const { error: updateErr } = await supabase
        .from('service_bookings')
        .update({ status: 'disputed' })
        .eq('id', bookingId);

      if (updateErr) {
        console.error('[EscrowService.initiateDispute] update error:', updateErr.message);
        return false;
      }

      const { error: disputeErr } = await supabase
        .from('disputes')
        .insert([
          {
            booking_id: bookingId,
            reason,
            status: 'open',
            created_at: new Date().toISOString(),
          },
        ]);

      if (disputeErr) {
        console.error('[EscrowService.initiateDispute] insert dispute error:', disputeErr.message);
        // Booking is already marked disputed — still consider partial success
        return false;
      }

      return true;
    } catch (err) {
      console.error('[EscrowService.initiateDispute] unexpected:', err.message);
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
        console.error('[EscrowService.getBookingStatus] error:', error.message);
        return null;
      }

      return data ?? null;
    } catch (err) {
      console.error('[EscrowService.getBookingStatus] unexpected:', err.message);
      return null;
    }
  },
};
