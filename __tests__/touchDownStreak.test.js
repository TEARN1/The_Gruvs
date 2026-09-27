import { buildTouchDownStreak } from '../src/utils/touchDownStreak';

const NOW = Date.parse('2026-06-20T22:00:00Z'); // a Saturday

describe('buildTouchDownStreak — celebrated, never guilt', () => {
  it('counts consecutive weekends ending this weekend', () => {
    const s = buildTouchDownStreak(['2026-06-20', '2026-06-13', '2026-06-06'], NOW);
    expect(s.current).toBe(3);
    expect(s.longest).toBeGreaterThanOrEqual(3);
    expect(s.thisWeekendOut).toBe(true);
    expect(s.message).toMatch(/3 weekends running/);
  });

  it('stays alive from last weekend even if you have not been out yet this one', () => {
    const s = buildTouchDownStreak(['2026-06-13', '2026-06-06'], NOW);
    expect(s.alive).toBe(true);
    expect(s.thisWeekendOut).toBe(false);
    expect(s.current).toBe(2);
    expect(s.message).toMatch(/keep it alive/);
  });

  it('a broken streak gets encouragement, never a scold', () => {
    const s = buildTouchDownStreak(['2026-05-30'], NOW); // 3 weeks ago
    expect(s.current).toBe(0);
    expect(s.alive).toBe(false);
    expect(s.message).toBe('Your next night out starts a streak');
    expect(s.message).not.toMatch(/lost|broke|missed|don't/i);
  });

  it('tracks the longest run even when the current streak is shorter', () => {
    const s = buildTouchDownStreak(
      ['2026-03-07', '2026-03-14', '2026-03-21', '2026-03-28', '2026-06-20'], NOW);
    expect(s.longest).toBe(4);
    expect(s.current).toBe(1);
  });

  it('is null-safe and ignores garbage dates', () => {
    expect(buildTouchDownStreak(null, NOW)).toMatchObject({ current: 0, longest: 0, alive: false });
    expect(buildTouchDownStreak([null, 'nope', ''], NOW).current).toBe(0);
  });
});
