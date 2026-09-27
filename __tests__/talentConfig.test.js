import { talentConfig, resolveStat, statLabel, leaderboardMetrics } from '../src/constants/TalentConfig';

describe('talentConfig (universal categories)', () => {
  it('returns the right noun per category', () => {
    expect(talentConfig('sport').noun).toBe('Player');
    expect(talentConfig('music').noun).toBe('Artist');
    expect(talentConfig('comedy').noun).toBe('Comedian');
    expect(talentConfig('hackathon').noun).toBe('Builder');
  });
  it('falls back to the default for unknown categories', () => {
    expect(talentConfig('underwater-basket-weaving').noun).toBe('Talent');
    expect(talentConfig(null).noun).toBe('Talent');
  });
});

describe('resolveStat', () => {
  it('reads career_* columns off the talent row', () => {
    expect(resolveStat({ career_goals: 9 }, 'career_goals')).toBe(9);
    expect(resolveStat({ career_events: 4 }, 'career_events')).toBe(4);
  });
  it('reads metric:<key> from the metrics JSON', () => {
    expect(resolveStat({ metrics: { shows: 12 } }, 'metric:shows')).toBe(12);
    expect(resolveStat({ metrics: {} }, 'metric:shows')).toBe(0);
  });
  it('is safe for missing talent', () => {
    expect(resolveStat(null, 'career_goals')).toBe(0);
  });
});

describe('statLabel', () => {
  it('uses the category-specific label', () => {
    expect(statLabel('sport', 'career_goals')).toBe('Goals');
    expect(statLabel('music', 'metric:shows')).toBe('Shows');
  });
  it('uses universal labels for shared stats', () => {
    expect(statLabel(null, 'career_rating')).toBe('Rating');
    expect(statLabel('music', 'follower_count')).toBe('Fans');
  });
});

describe('leaderboardMetrics', () => {
  it('gives sport goals + rating', () => {
    const keys = leaderboardMetrics('sport').map(m => m.key);
    expect(keys).toContain('goals');
    expect(keys).toContain('rating');
  });
  it('leads music with rating (no goals)', () => {
    const keys = leaderboardMetrics('music').map(m => m.key);
    expect(keys[0]).toBe('rating');
    expect(keys).not.toContain('goals');
  });
});
