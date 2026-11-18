import { supabase } from './supabase';

/**
 * PayFast checkout for paid event tickets.
 *
 * The payfast-checkout edge function decides everything that matters: who is
 * paying (from the sign-in), what it costs (from the event's tiers) and the
 * signed PayFast link. The app only says which event and tier. There is no
 * fallback built in the browser: an unsigned link would carry a price the
 * buyer could change, and payfast-itn would never issue a ticket for it.
 */

// What the edge function's error codes mean to a buyer.
const CHECKOUT_ERRORS = {
  auth_required: 'Sign in to buy a ticket.',
  event_unavailable: 'This event is no longer on sale.',
  tier_not_for_sale: 'This ticket type is not on sale.',
  amount_below_minimum: 'PayFast needs a price of at least R5.',
  payments_not_configured: 'Online payment is not set up yet. Please try again later.',
};

async function readError(error) {
  try {
    const body = await error?.context?.json?.();
    if (body?.error && CHECKOUT_ERRORS[body.error]) return CHECKOUT_ERRORS[body.error];
  } catch {
    // fall through
  }
  return 'Could not start the payment. Please try again.';
}

export const PayFastService = {
  /**
   * Starts a PayFast payment for one paid tier of an event.
   * Returns { paymentUrl, paymentId, sandbox }.
   */
  async checkoutEventTicket({ event, tier }) {
    if (!event?.id || tier?.id === undefined || tier?.id === null) {
      throw new Error('Choose a ticket type first.');
    }
    const { data, error } = await supabase.functions.invoke('payfast-checkout', {
      body: { eventId: event.id, tierId: String(tier.id) },
    });
    if (error) throw new Error(await readError(error));
    if (!data?.paymentUrl) throw new Error('Could not start the payment. Please try again.');
    return { paymentUrl: data.paymentUrl, paymentId: data.paymentId, sandbox: Boolean(data.sandbox) };
  },
};

export default PayFastService;
