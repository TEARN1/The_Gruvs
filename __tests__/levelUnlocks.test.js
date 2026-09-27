import { unlocksForLevel, unlockedSoFar, nextUnlocks } from '../src/utils/levelUnlocks';

describe('level unlocks', () => {
  it('every tier defines at least one unlock', () => {
    ['Viber', 'Elite Viber', 'Royal Viber', 'Gruv Master', 'Legend'].forEach((n) => {
      expect(unlocksForLevel(n).length).toBeGreaterThan(0);
    });
  });

  it('unlockedSoFar accumulates the tier + everything below it', () => {
    const elite = unlockedSoFar(300); // Elite Viber
    expect(elite.some((u) => u.key === 'core')).toBe(true);          // Viber
    expect(elite.some((u) => u.key === 'who_was_there')).toBe(true); // Elite
    expect(elite.some((u) => u.key === 'vouch')).toBe(false);        // Royal — not yet
  });

  it('nextUnlocks returns the next tier’s unlocks', () => {
    expect(nextUnlocks(50).some((u) => u.key === 'who_was_there')).toBe(true); // Viber → Elite
  });

  it('Legend (top tier) has no next unlocks', () => {
    expect(nextUnlocks(50000)).toEqual([]);
  });

  it('trust powers are earned-only; convenience unlocks are not', () => {
    const royal = unlocksForLevel('Royal Viber');
    expect(royal.find((u) => u.key === 'vouch').earned).toBe(true);          // trust → earned only
    expect(royal.find((u) => u.key === 'host_featured').earned).toBe(false); // convenience
  });
});
