// Vibe Roulette's brain — weighted serendipity, not uniform random.
import { weightedPick } from '../src/utils/weightedPick';

describe('weightedPick', () => {
  const items = [
    { id: 'dead', heat: 0 },
    { id: 'warm', heat: 25 },
    { id: 'fire', heat: 400 },
  ];
  const byHeat = (e) => e.heat;

  it('null-safe: empty/garbage → null; single item → that item', () => {
    expect(weightedPick([], byHeat)).toBeNull();
    expect(weightedPick(null, byHeat)).toBeNull();
    expect(weightedPick([items[0]], byHeat)).toBe(items[0]);
  });

  it('is deterministic with an injected rand', () => {
    // weights: sqrt(1)=1, sqrt(25)=5, sqrt(400)=20 → total 26
    expect(weightedPick(items, byHeat, () => 0.0).id).toBe('dead');   // roll 0 → first
    expect(weightedPick(items, byHeat, () => 0.1).id).toBe('warm');   // roll 2.6
    expect(weightedPick(items, byHeat, () => 0.9).id).toBe('fire');   // roll 23.4
  });

  it('hot events win more often, but nothing has zero odds', () => {
    let rngState = 42;
    const rng = () => {
      rngState = (rngState * 1103515245 + 12345) % 2147483648;
      return rngState / 2147483648;
    };
    const wins = { dead: 0, warm: 0, fire: 0 };
    for (let i = 0; i < 3000; i++) wins[weightedPick(items, byHeat, rng).id]++;
    expect(wins.fire).toBeGreaterThan(wins.warm);
    expect(wins.warm).toBeGreaterThan(wins.dead);
    expect(wins.dead).toBeGreaterThan(0); // serendipity: the underdog stays possible
  });

  it('treats broken weights as the floor, never NaN-crashes', () => {
    const out = weightedPick([{ id: 'a' }, { id: 'b' }], () => NaN, () => 0.99);
    expect(['a', 'b']).toContain(out.id);
  });
});
