jest.mock('../src/services/supabase', () => ({ supabase: { from: jest.fn() } }));

import { readPaymentReturn, describeOrder } from '../src/components/PaymentReturnModal';

const ORDER = 'GRV-0b6f8e1e-2c1a-4f53-9d3e-1f6c7a9b2d40';

test('reads the order PayFast returns the buyer with', () => {
  expect(readPaymentReturn({ pathname: '/payment/success', search: `?order=${ORDER}` })).toEqual({ kind: 'success', order: ORDER });
  expect(readPaymentReturn({ pathname: '/payment/cancelled/', search: `?order=${ORDER}` })).toEqual({ kind: 'cancelled', order: ORDER });
  expect(readPaymentReturn({ pathname: '/payment/success', search: '?order=<script>' })).toEqual({ kind: 'success', order: null });
  expect(readPaymentReturn({ pathname: '/', search: `?order=${ORDER}` })).toBeNull();
  expect(readPaymentReturn({ pathname: '/event/abc', search: '' })).toBeNull();
});

test('shows a ticket only once payfast-itn has issued one', () => {
  expect(describeOrder(null).state).toBe('missing');
  expect(describeOrder({ status: 'pending' }).state).toBe('pending');
  expect(describeOrder({ status: 'complete' }, null).state).toBe('pending');
  expect(describeOrder({ status: 'complete' }, { token: 'TKT-1' })).toEqual({ state: 'ticket', ticket: { token: 'TKT-1' } });
  expect(describeOrder({ status: 'complete', status_reason: 'sandbox_no_ticket' }).state).toBe('test');
  expect(describeOrder({ status: 'cancelled' }).state).toBe('cancelled');
  expect(describeOrder({ status: 'rejected', status_reason: 'amount_mismatch:100' }).state).toBe('problem');
  expect(describeOrder({ status: 'failed' }).state).toBe('problem');
});
