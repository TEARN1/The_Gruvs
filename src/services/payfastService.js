import { supabase } from './supabase';
import { resilient } from '../utils/resilience';

/**
 * PayFast Configuration & Endpoints
 * Supports both Sandbox (for testing) and Live Production
 */
const IS_SANDBOX = process.env.EXPO_PUBLIC_PAYFAST_SANDBOX !== 'false';
const PAYFAST_PROCESS_URL = IS_SANDBOX
  ? 'https://sandbox.payfast.co.za/eng/process'
  : 'https://www.payfast.co.za/eng/process';

const DEFAULT_MERCHANT_ID = process.env.EXPO_PUBLIC_PAYFAST_MERCHANT_ID || (IS_SANDBOX ? '10000100' : '');
const DEFAULT_MERCHANT_KEY = process.env.EXPO_PUBLIC_PAYFAST_MERCHANT_KEY || (IS_SANDBOX ? '46f0cd694581a' : '');

export const PayFastService = {
  isSandbox: IS_SANDBOX,
  processUrl: PAYFAST_PROCESS_URL,

  /**
   * Request a signed PayFast checkout session from the secure edge function.
   * Falls back to client-constructed sandbox form if offline or edge function unavailable.
   */
  async createCheckoutSession({
    app = 'thegruvs',
    itemType = 'ticket',
    itemId,
    itemName,
    itemDescription,
    amountZar,
    user,
    metadata = {},
    returnUrl,
    cancelUrl,
  }) {
    if (!amountZar || amountZar <= 0) {
      throw new Error('Invalid payment amount');
    }

    // RN defines window but not window.location — optional-chain so native gets the site URL.
    const host = (typeof window !== 'undefined' && window.location?.origin) || 'https://thegruvs.com';
    const finalReturnUrl = returnUrl || `${host}/payment/success?item=${encodeURIComponent(itemId || '')}`;
    const finalCancelUrl = cancelUrl || `${host}/payment/cancelled?item=${encodeURIComponent(itemId || '')}`;

    // 1. Try secure Edge Function first
    try {
      const { data, error } = await supabase.functions.invoke('payfast-checkout', {
        body: {
          app,
          itemType,
          itemId,
          itemName: itemName.slice(0, 100),
          itemDescription: (itemDescription || itemName).slice(0, 255),
          amountZar: Number(amountZar).toFixed(2),
          user: {
            id: user?.id,
            email: user?.email,
            name: user?.user_metadata?.full_name || user?.user_metadata?.username || 'Gruvs Member',
          },
          metadata,
          returnUrl: finalReturnUrl,
          cancelUrl: finalCancelUrl,
        },
      });

      if (!error && data?.paymentUrl) {
        return {
          paymentUrl: data.paymentUrl,
          paymentId: data.paymentId,
          fields: data.fields || {},
        };
      }
    } catch {
      // Fall through to client fallback below
    }

    // 2. Client fallback (Sandbox or pre-configured client credentials)
    const paymentId = `GRV-${itemType.toUpperCase().slice(0, 3)}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fields = {
      merchant_id: DEFAULT_MERCHANT_ID,
      merchant_key: DEFAULT_MERCHANT_KEY,
      return_url: finalReturnUrl,
      cancel_url: finalCancelUrl,
      notify_url: `${process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://api.thegruvs.com'}/functions/v1/payfast-itn`,
      name_first: (user?.user_metadata?.full_name || 'Gruvs').split(' ')[0] || 'Gruvs',
      name_last: (user?.user_metadata?.full_name || 'Member').split(' ').slice(1).join(' ') || 'Member',
      email_address: user?.email || 'guest@thegruvs.com',
      m_payment_id: paymentId,
      amount: Number(amountZar).toFixed(2),
      item_name: itemName.slice(0, 100),
      item_description: (itemDescription || itemName).slice(0, 255),
      custom_str1: app,
      custom_str2: itemType,
      custom_str3: user?.id || 'anonymous',
      custom_str4: JSON.stringify({ itemId, ...metadata }).slice(0, 250),
    };

    const queryParams = new URLSearchParams();
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        queryParams.append(k, String(v));
      }
    });

    const paymentUrl = `${PAYFAST_PROCESS_URL}?${queryParams.toString()}`;

    return {
      paymentUrl,
      paymentId,
      fields,
    };
  },

  /**
   * Helper to initiate VIP / Paid Tier ticket purchase
   */
  async checkoutEventTicket({ event, tier, user }) {
    if (!event || !tier) throw new Error('Event and tier required');
    return this.createCheckoutSession({
      app: 'thegruvs',
      itemType: 'ticket',
      itemId: `${event.id}_${tier.id}`,
      itemName: `${event.title} — ${tier.name}`,
      itemDescription: `Access Pass: ${tier.name} at ${event.venue || 'Venue'} (${event.city || 'SA'})`,
      amountZar: tier.price,
      user,
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
  async checkoutTablePitchIn({ event, tableTitle, amountZar, user, tableId }) {
    return this.createCheckoutSession({
      app: 'thegruvs',
      itemType: 'pitchin',
      itemId: tableId || `table_${event.id}`,
      itemName: `Table Pitch-In: ${tableTitle || event.title}`,
      itemDescription: `Squad split for ${event.title}`,
      amountZar,
      user,
      metadata: {
        eventId: event.id,
        tableId,
      },
    });
  },

  /**
   * Helper to initiate Service Booking (DJs, Bakkie, Sound engineers)
   */
  async checkoutServiceBooking({ booking, user }) {
    const amountZar = (Number(booking.amount_cents) || 0) / 100;
    return this.createCheckoutSession({
      app: 'thegruvs',
      itemType: 'booking',
      itemId: booking.id,
      itemName: `Booking: ${booking.cargo_type || 'Service'}`,
      itemDescription: `Escrow funded booking ${booking.id}`,
      amountZar,
      user,
      metadata: {
        bookingId: booking.id,
        serviceNodeId: booking.service_node_id,
      },
    });
  },

  /**
   * Helper to initiate Business Storefront / Event Boost
   */
  async checkoutBusinessBoost({ businessId, tierName, amountZar, user }) {
    return this.createCheckoutSession({
      app: 'thegruvs',
      itemType: 'business_boost',
      itemId: `${businessId}_${tierName}`,
      itemName: `Business Boost: ${tierName}`,
      itemDescription: `Storefront promotion & verified placement`,
      amountZar,
      user,
      metadata: {
        businessId,
        tierName,
      },
    });
  },
};

export default PayFastService;
