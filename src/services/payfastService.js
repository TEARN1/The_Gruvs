import { supabase } from './supabase';
import { resilient } from '../utils/resilience';

/**
 * Starts a PayFast payment through the payfast-checkout edge function.
 *
 * The server decides the price (a ticket tier's price, a booking's amount) and
 * the buyer (whoever is signed in), records the order and signs the request.
 * The browser never builds or signs a payment itself: if the server cannot
 * start one, the buyer is told, and nothing is charged.
 */
export const PayFastService = {
  async createCheckoutSession({
    itemType = 'ticket',
    itemId,
    itemName,
    itemDescription,
    amountZar,
    metadata = {},
    returnUrl,
    cancelUrl,
  }) {
    const host = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://thegruvs.com';
    const { data, error } = await supabase.functions.invoke('payfast-checkout', {
      body: {
        itemType,
        itemId,
        itemName: String(itemName || '').slice(0, 100),
        itemDescription: String(itemDescription || itemName || '').slice(0, 255),
        // Only a pitch-in or a business boost lets the buyer choose the amount.
        amountZar: amountZar === undefined ? undefined : Number(amountZar).toFixed(2),
        metadata,
        returnUrl: returnUrl || `${host}/payment/success?item=${encodeURIComponent(itemId || '')}`,
        cancelUrl: cancelUrl || `${host}/payment/cancelled?item=${encodeURIComponent(itemId || '')}`,
      },
    });
    if (error || !data?.paymentUrl) {
      throw new Error(data?.error || 'Online payment is not available right now. Nothing was charged.');
    }
    return { paymentUrl: data.paymentUrl, paymentId: data.paymentId, fields: data.fields || {} };
  },

  /**
   * Helper to initiate VIP / Paid Tier ticket purchase
   */
  async checkoutEventTicket({ event, tier }) {
    if (!event || !tier) throw new Error('Event and tier required');
    return this.createCheckoutSession({
      app: 'thegruvs',
      itemType: 'ticket',
      itemId: `${event.id}_${tier.id}`,
      itemName: `${event.title} — ${tier.name}`,
      itemDescription: `Access Pass: ${tier.name} at ${event.venue || 'Venue'} (${event.city || 'SA'})`,
      metadata: {
        eventId: event.id,
        tierId: tier.id,
        tierName: tier.name,
      },
    });
  },

  /**
   * Helper to initiate Table Pitch-In / Squad Pool contribution
   */
  async checkoutTablePitchIn({ event, tableTitle, amountZar, tableId }) {
    return this.createCheckoutSession({
      app: 'thegruvs',
      itemType: 'pitchin',
      itemId: tableId || `table_${event.id}`,
      itemName: `Table Pitch-In: ${tableTitle || event.title}`,
      itemDescription: `Squad split for ${event.title}`,
      amountZar,
      metadata: {
        eventId: event.id,
        tableId,
      },
    });
  },

  /**
   * Helper to initiate Service Booking (DJs, Bakkie, Sound engineers)
   */
  async checkoutServiceBooking({ booking }) {
    return this.createCheckoutSession({
      app: 'thegruvs',
      itemType: 'booking',
      itemId: booking.id,
      itemName: `Booking: ${booking.cargo_type || 'Service'}`,
      itemDescription: `Escrow funded booking ${booking.id}`,
      metadata: {
        bookingId: booking.id,
        serviceNodeId: booking.service_node_id,
      },
    });
  },

  /**
   * Helper to initiate Business Storefront / Event Boost
   */
  async checkoutBusinessBoost({ businessId, tierName, amountZar }) {
    return this.createCheckoutSession({
      app: 'thegruvs',
      itemType: 'business_boost',
      itemId: `${businessId}_${tierName}`,
      itemName: `Business Boost: ${tierName}`,
      itemDescription: `Storefront promotion`,
      amountZar,
      metadata: {
        businessId,
        tierName,
      },
    });
  },
};

export default PayFastService;
