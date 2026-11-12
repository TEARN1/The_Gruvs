import { supabase } from './supabase';

/**
 * PayFast checkout — client side.
 *
 * The app sends ONLY which event and tier. The payfast-checkout edge function
 * works out who is paying (from the session) and what it costs (from the
 * event), records the order, and returns a signed PayFast URL. payfast-itn
 * then issues the ticket only if PayFast confirms the exact amount.
 *
 * There is deliberately NO client-side fallback. The old one built an unsigned
 * URL to PayFast's public sandbox demo merchant whenever the edge function was
 * unreachable, so buyers "paid" play money and got nothing.
 */

// Human messages for the edge function's error codes.
const MESSAGES = {
  auth_required: 'Sign in to buy a ticket.',
  payments_not_configured: "Ticket payments aren't switched on yet.",
  event_unavailable: 'This event is no longer available.',
  tier_not_for_sale: "This ticket isn't for sale.",
  amount_below_minimum: 'This ticket is below the minimum card payment (R5).',
};

async function errorCode(error) {
  // supabase-js FunctionsHttpError keeps the Response on `context`.
  try {
    const body = await error?.context?.json?.();
    return body?.error || null;
  } catch {
    return null;
  }
}

export const PayFastService = {
  /**
   * Start PayFast checkout for a paid tier. Resolves { paymentUrl, paymentId, sandbox }.
   * Throws an Error with a user-facing message on any failure.
   */
  async checkoutEventTicket({ event, tier }) {
    if (!event?.id || tier?.id == null) throw new Error('Pick a ticket first.');

    let data;
    let error;
    try {
      ({ data, error } = await supabase.functions.invoke('payfast-checkout', {
        body: { eventId: event.id, tierId: String(tier.id) },
      }));
    } catch {
      throw new Error("Couldn't reach checkout. Check your connection and try again.");
    }
    if (error || !data?.paymentUrl) {
      const code = (await errorCode(error)) || data?.error;
      throw new Error(MESSAGES[code] || "Couldn't start checkout. Please try again.");
    }
    return { paymentUrl: data.paymentUrl, paymentId: data.paymentId, sandbox: !!data.sandbox };
  },
};

export default PayFastService;
