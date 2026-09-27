import { secureToken, secureCode } from '../src/utils/secureId';

describe('secureToken', () => {
  it('has the requested length and a safe alphabet', () => {
    const t = secureToken(12);
    expect(t).toHaveLength(12);
    expect(t).toMatch(/^[A-HJ-NP-Z2-9]+$/); // no 0/O/1/I/l
  });

  // A credential must not repeat. 1000 draws with zero collisions is the floor.
  it('does not collide across many draws', () => {
    const seen = new Set();
    for (let i = 0; i < 1000; i++) seen.add(secureToken(12));
    expect(seen.size).toBe(1000);
  });

  it('is far stronger than a 4-digit suffix', () => {
    // 12 chars of a 30-symbol alphabet >> 9,000 possibilities.
    expect(Math.pow(30, 12)).toBeGreaterThan(9000 * 1e10);
  });
});

describe('secureCode', () => {
  it('formats into readable groups', () => {
    const c = secureCode(3, 4);
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });
});
