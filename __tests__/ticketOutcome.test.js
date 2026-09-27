import { ticketOutcome } from '../src/services/dataFlow';

/**
 * Door-side ticket rejection reasons. The valid path (atomic claim of an unused
 * ticket) is DB-enforced — .eq('used', false) means a second scan flips zero
 * rows, so double-entry is impossible without a check-then-write race. This
 * tests the "why was it rejected" decision that runs when zero rows flipped.
 */
describe('ticketOutcome', () => {
  it('rejects a token that was never issued', () => {
    expect(ticketOutcome(null)).toEqual({ valid: false, reason: 'not_found', ticket: null });
  });

  // The double-entry case: the ticket exists, but the atomic claim already
  // matched zero rows because someone got in on it first.
  it('rejects an already-used ticket', () => {
    expect(ticketOutcome({ used: true, event_id: 'e1' }).reason).toBe('already_used');
  });

  it('rejects a valid ticket at the WRONG event door', () => {
    expect(ticketOutcome({ used: false, event_id: 'other' }, 'e1').reason).toBe('wrong_event');
  });

  it('does not cry wrong-event when no event scope is given', () => {
    expect(ticketOutcome({ used: true, event_id: 'e1' }, null).reason).toBe('already_used');
  });
});
