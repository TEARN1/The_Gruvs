/**
 * TalentConfig — makes the talent platform universal.
 *
 * One set of screens (player card, leaderboard, guest tagging) adapts to EVERY
 * event category by reading this config: the noun for a participant, which 4
 * stats their card shows, which metrics the scout board can rank by, the guest
 * roles, and the per-event numbers a host edits.
 *
 * Universal counters live on the talent row (career_events, career_rating,
 * career_awards, follower_count). Category-specific numbers live in the JSONB
 * `metrics` (on the talent) and `event_guests.metrics` (per event).
 */

// Stat sources:  career_*  → a column on the talent row;  metric:<key> → metrics JSONB
const UNIVERSAL = {
  events:  { key: 'career_events', label: 'Events',  icon: 'calendar' },
  rating:  { key: 'career_rating', label: 'Rating',  icon: 'star',  decimal: true },
  awards:  { key: 'career_awards', label: 'Awards',  icon: 'award' },
  fans:    { key: 'follower_count', label: 'Fans',   icon: 'users' },
};

export const TALENT_CATEGORIES = {
  sport: {
    noun: 'Player', icon: 'activity',
    cardStats: ['career_goals', 'career_assists', 'career_apps', 'career_rating'],
    statLabels: { career_goals: 'Goals', career_assists: 'Assists', career_apps: 'Apps' },
    leaderboard: ['goals', 'assists', 'rating', 'apps', 'followers'],
    roles: ['player', 'coach', 'referee', 'guest'],
    perEvent: [{ key: 'goals', label: 'Goals' }, { key: 'assists', label: 'Assists' }],
  },
  music: {
    noun: 'Artist', icon: 'music',
    cardStats: ['metric:shows', 'follower_count', 'career_awards', 'career_rating'],
    statLabels: { 'metric:shows': 'Shows' },
    leaderboard: ['rating', 'events', 'followers', 'awards'],
    roles: ['performer', 'dj', 'host', 'guest'],
    perEvent: [{ key: 'crowd', label: 'Crowd (1-10)' }, { key: 'set_min', label: 'Set (min)' }],
  },
  comedy: {
    noun: 'Comedian', icon: 'mic',
    cardStats: ['metric:sets', 'follower_count', 'career_awards', 'career_rating'],
    statLabels: { 'metric:sets': 'Sets' },
    leaderboard: ['rating', 'events', 'followers', 'awards'],
    roles: ['performer', 'host', 'guest'],
    perEvent: [{ key: 'laughs', label: 'Laughs (1-10)' }],
  },
  hackathon: {
    noun: 'Builder', icon: 'code',
    cardStats: ['metric:builds', 'career_awards', 'career_events', 'career_rating'],
    statLabels: { 'metric:builds': 'Builds' },
    leaderboard: ['awards', 'rating', 'events', 'followers'],
    roles: ['builder', 'mentor', 'judge', 'guest'],
    perEvent: [{ key: 'placement', label: 'Placement' }],
  },
  fashion: {
    noun: 'Model', icon: 'star',
    cardStats: ['metric:shows', 'follower_count', 'career_awards', 'career_rating'],
    statLabels: { 'metric:shows': 'Shows' },
    leaderboard: ['rating', 'followers', 'events', 'awards'],
    roles: ['model', 'designer', 'judge', 'guest'],
    perEvent: [{ key: 'walks', label: 'Walks' }],
  },
  esports: {
    noun: 'Gamer', icon: 'target',
    cardStats: ['metric:wins', 'career_awards', 'career_events', 'career_rating'],
    statLabels: { 'metric:wins': 'Wins' },
    leaderboard: ['awards', 'rating', 'events', 'followers'],
    roles: ['player', 'coach', 'caster', 'guest'],
    perEvent: [{ key: 'kills', label: 'Kills' }, { key: 'placement', label: 'Placement' }],
  },
  debate: {
    noun: 'Debater', icon: 'message-circle',
    cardStats: ['metric:wins', 'career_awards', 'career_events', 'career_rating'],
    statLabels: { 'metric:wins': 'Wins' },
    leaderboard: ['awards', 'rating', 'events', 'followers'],
    roles: ['speaker', 'judge', 'guest'],
    perEvent: [{ key: 'points', label: 'Points' }],
  },
  // Fallback for any other category (art, food, nightlife, business, film…)
  default: {
    noun: 'Talent', icon: 'star',
    cardStats: ['career_events', 'follower_count', 'career_awards', 'career_rating'],
    statLabels: {},
    leaderboard: ['rating', 'events', 'followers', 'awards'],
    roles: ['performer', 'host', 'judge', 'guest'],
    perEvent: [],
  },
};

export const talentConfig = (category) =>
  TALENT_CATEGORIES[(category || '').toLowerCase()] || TALENT_CATEGORIES.default;

/** Resolve a stat value for a talent given a stat key (career_* or metric:<k>). */
export function resolveStat(talent, statKey) {
  if (!talent) return 0;
  if (statKey.startsWith('metric:')) {
    const k = statKey.slice(7);
    return Number(talent.metrics?.[k]) || 0;
  }
  return Number(talent[statKey]) || 0;
}

/** Human label for a stat key, category-aware. */
export function statLabel(category, statKey) {
  const cfg = talentConfig(category);
  if (cfg.statLabels?.[statKey]) return cfg.statLabels[statKey];
  const uni = Object.values(UNIVERSAL).find(u => u.key === statKey);
  if (uni) return uni.label;
  if (statKey.startsWith('metric:')) {
    const k = statKey.slice(7);
    return k.charAt(0).toUpperCase() + k.slice(1);
  }
  return statKey.replace('career_', '').replace(/^\w/, c => c.toUpperCase());
}

/** Leaderboard metric chips for a category (label + sort key for the RPC). */
export function leaderboardMetrics(category) {
  const METRIC_LABELS = {
    goals: 'Goals', assists: 'Assists', rating: 'Rating', apps: 'Apps',
    events: 'Events', awards: 'Awards', followers: 'Fans',
  };
  return talentConfig(category).leaderboard.map(k => ({ key: k, label: METRIC_LABELS[k] || k }));
}

export { UNIVERSAL };
export default TALENT_CATEGORIES;
