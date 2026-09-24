/**
 * resilient() overall deadline.
 *
 * Per-attempt timeouts left the whole cascade unbounded: ~38 s per tier across
 * three tiers plus the mother escalation is ~153 s before the user sees even an
 * empty state. The deadline is a ceiling on the wait, and these tests pin the
 * two properties that make it safe to add: it must not slow down anything that
 * already works, and it must stay off unless a caller opts in.
 */
import { resilient } from '../src/utils/resilience';

jest.setTimeout(20000);

const never = () => new Promise(() => {}); // hangs forever

describe('resilient overallDeadlineMs', () => {
  it('returns fallbackValue once the deadline passes instead of hanging', async () => {
    const started = Date.now();
    const out = await resilient([never, never, never], {
      label: `deadline-test-${Math.random()}`,
      fallbackValue: 'FALLBACK',
      overallDeadlineMs: 400,
    });
    const elapsed = Date.now() - started;
    expect(out).toBe('FALLBACK');
    // Well under the ~153 s unbounded worst case, and under one attempt timeout.
    expect(elapsed).toBeLessThan(3000);
  });

  it('does not delay a fast successful call', async () => {
    const started = Date.now();
    const out = await resilient([async () => 'OK'], {
      label: `deadline-fast-${Math.random()}`,
      fallbackValue: null,
      overallDeadlineMs: 5000,
    });
    expect(out).toBe('OK');
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('is off by default, so existing callers are unchanged', async () => {
    // No overallDeadlineMs: a fast path still resolves normally. (The unbounded
    // hang case is exactly what the option exists to opt into, so it is not
    // exercised here.)
    const out = await resilient([async () => 'OK'], {
      label: `deadline-default-${Math.random()}`,
      fallbackValue: null,
    });
    expect(out).toBe('OK');
  });

  it('still prefers a later tier that succeeds before the deadline', async () => {
    const out = await resilient(
      [async () => { throw new Error('network down'); }, async () => 'TIER2'],
      {
        label: `deadline-tier2-${Math.random()}`,
        attemptsPerTier: 1,
        fallbackValue: null,
        overallDeadlineMs: 5000,
      }
    );
    expect(out).toBe('TIER2');
  });
});
