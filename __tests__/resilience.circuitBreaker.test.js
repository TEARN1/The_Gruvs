import { resilient, getOpenCircuits } from '../src/utils/resilience';

// The breaker's window is a real 60s wall-clock timer; use fake timers so the
// tests are fast and deterministic without waiting on real time.
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('resilient() circuit breaker', () => {
  it('opens after 3 full-cascade exhaustions and short-circuits without calling any tier', async () => {
    const label = `CircuitTest.open.${Math.random()}`;
    const failing = jest.fn(async () => { throw new Error('down'); });

    for (let i = 0; i < 3; i++) {
      await resilient([failing], { attemptsPerTier: 1, baseMs: 1, label, fallbackValue: 'fallback' });
    }
    expect(getOpenCircuits()).toContain(label);

    failing.mockClear();
    const result = await resilient([failing], { attemptsPerTier: 1, baseMs: 1, label, fallbackValue: 'fallback' });
    expect(result).toBe('fallback');
    expect(failing).not.toHaveBeenCalled(); // short-circuited — no network attempt
  });

  it('lets one probe through per interval, and a successful probe closes the circuit', async () => {
    const label = `CircuitTest.close.${Math.random()}`;
    const failing = jest.fn(async () => { throw new Error('down'); });
    const succeeding = jest.fn(async () => 'ok');

    for (let i = 0; i < 3; i++) {
      await resilient([failing], { attemptsPerTier: 1, baseMs: 1, label, fallbackValue: null });
    }
    expect(getOpenCircuits()).toContain(label);

    // Immediately after opening, not yet due for a probe — short-circuited.
    const blocked = await resilient([succeeding], { attemptsPerTier: 1, baseMs: 1, label, fallbackValue: 'blocked' });
    expect(blocked).toBe('blocked');
    expect(succeeding).not.toHaveBeenCalled();

    // Advance past the probe interval — the next call is let through as a probe.
    jest.advanceTimersByTime(15_001);
    const probed = await resilient([succeeding], { attemptsPerTier: 1, baseMs: 1, label, fallbackValue: null });
    expect(probed).toBe('ok');
    expect(succeeding).toHaveBeenCalledTimes(1);
    expect(getOpenCircuits()).not.toContain(label);
  });

  it('does not open for a different label', async () => {
    const labelA = `CircuitTest.a.${Math.random()}`;
    const labelB = `CircuitTest.b.${Math.random()}`;
    const failing = jest.fn(async () => { throw new Error('down'); });

    for (let i = 0; i < 3; i++) {
      await resilient([failing], { attemptsPerTier: 1, baseMs: 1, label: labelA, fallbackValue: null });
    }
    expect(getOpenCircuits()).toContain(labelA);
    expect(getOpenCircuits()).not.toContain(labelB);
  });
});
