import { getVibeLevel, getXpLevel, VIBE_LEVELS } from '../src/utils/vibeLevel';

describe('getVibeLevel', () => {
  it('maps scores to the right tier', () => {
    expect(getVibeLevel(0).name).toBe('Viber');
    expect(getVibeLevel(100).name).toBe('Viber');
    expect(getVibeLevel(101).name).toBe('Elite Viber');
    expect(getVibeLevel(500).name).toBe('Elite Viber');
    expect(getVibeLevel(501).name).toBe('Royal Viber');
    expect(getVibeLevel(2001).name).toBe('Gruv Master');
    expect(getVibeLevel(10001).name).toBe('Legend');
    expect(getVibeLevel(999999).name).toBe('Legend');
  });

  it('reports the next tier and points-to-next', () => {
    const r = getVibeLevel(50);
    expect(r.next).toBe('Elite Viber');
    expect(r.toNext).toBe(51); // 101 - 50
  });

  it('caps the top tier (no next, full progress)', () => {
    const r = getVibeLevel(20000);
    expect(r.next).toBeNull();
    expect(r.toNext).toBe(0);
    expect(r.progress).toBe(100);
  });

  it('computes progress toward the next tier', () => {
    // Elite spans 101..500; at 300 you're (300-101)/(501-101) ≈ 49.75%
    const r = getVibeLevel(300);
    expect(r.name).toBe('Elite Viber');
    expect(Math.round(r.progress)).toBe(50);
  });

  it('is null-safe / clamps negatives', () => {
    expect(getVibeLevel(undefined).name).toBe('Viber');
    expect(getVibeLevel(null).name).toBe('Viber');
    expect(getVibeLevel(-50).name).toBe('Viber');
    expect(getVibeLevel('abc').name).toBe('Viber');
  });

  it('ladder is ordered and contiguous', () => {
    for (let i = 1; i < VIBE_LEVELS.length; i++) {
      expect(VIBE_LEVELS[i].min).toBe(VIBE_LEVELS[i - 1].max + 1);
    }
  });

  it('every tier carries a color (single source for badge styling)', () => {
    VIBE_LEVELS.forEach((l) => expect(l.color).toMatch(/^#/));
    expect(getVibeLevel(300).color).toBe('#06b6d4');
  });
});

// F3 — the ONE numeric XP curve. LevelManager notifications and the ProfilePage
// XP bar both call this; these tests keep them from ever diverging again.
describe('getXpLevel', () => {
  it('level = floor(sqrt(xp/50)) + 1, capped at 100', () => {
    expect(getXpLevel(0).level).toBe(1);
    expect(getXpLevel(49).level).toBe(1);
    expect(getXpLevel(50).level).toBe(2);
    expect(getXpLevel(200).level).toBe(3);
    expect(getXpLevel(10 ** 9).level).toBe(100);
  });

  it('progress bar math is consistent with the curve', () => {
    const r = getXpLevel(200); // level 3 spans 200..450
    expect(r.xpStart).toBe(200);
    expect(r.xpEnd).toBe(450);
    expect(r.pct).toBe(0);
    expect(r.toNext).toBe(250);
  });

  it('is null-safe / clamps negatives; capped level has no toNext', () => {
    expect(getXpLevel(undefined).level).toBe(1);
    expect(getXpLevel(-10).level).toBe(1);
    expect(getXpLevel(10 ** 9).toNext).toBe(0);
    expect(getXpLevel(10 ** 9).pct).toBe(100);
  });
});
