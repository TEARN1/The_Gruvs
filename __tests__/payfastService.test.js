jest.mock('../src/services/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

import { supabase } from '../src/services/supabase';
import { PayFastService } from '../src/services/payfastService';

const EVENT = { id: '0b6f8e1e-2c1a-4f53-9d3e-1f6c7a9b2d40', title: 'Rooftop', price: 1 };
const TIER = { id: 'vip', name: 'VIP', price: 1 };

beforeEach(() => supabase.functions.invoke.mockReset());

test('the app sends only the event and tier; the server sets the price', async () => {
  supabase.functions.invoke.mockResolvedValue({
    data: { paymentUrl: 'https://www.payfast.co.za/eng/process?signature=abc', paymentId: 'GRV-1', sandbox: false },
    error: null,
  });
  const out = await PayFastService.checkoutEventTicket({ event: EVENT, tier: TIER, user: { id: 'u1' } });
  expect(supabase.functions.invoke).toHaveBeenCalledWith('payfast-checkout', {
    body: { eventId: EVENT.id, tierId: 'vip' },
  });
  expect(out).toEqual({ paymentUrl: 'https://www.payfast.co.za/eng/process?signature=abc', paymentId: 'GRV-1', sandbox: false });
});

test('when the server refuses, the buyer gets a clear message and no unsigned PayFast link', async () => {
  supabase.functions.invoke.mockResolvedValue({
    data: null,
    error: { context: { json: async () => ({ error: 'tier_not_for_sale' }) } },
  });
  await expect(PayFastService.checkoutEventTicket({ event: EVENT, tier: TIER })).rejects.toThrow('This ticket type is not on sale.');
});

test('a network failure does not fall back to a link built in the browser', async () => {
  supabase.functions.invoke.mockResolvedValue({ data: null, error: new Error('Failed to fetch') });
  await expect(PayFastService.checkoutEventTicket({ event: EVENT, tier: TIER })).rejects.toThrow('Could not start the payment');
});

test('a tier is required', async () => {
  await expect(PayFastService.checkoutEventTicket({ event: EVENT })).rejects.toThrow('Choose a ticket type first.');
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});
