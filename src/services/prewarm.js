/**
 * prewarm — warm the caches for the main sections right after launch so the
 * FIRST time a user reaches a tab it renders instantly instead of showing a
 * spinner and fetching. Everything here is best-effort and fire-and-forget:
 * it only populates the same caches the screens already read from
 * (FeedManager / TrendingManager / ReelsRepository), so a failure just means
 * the screen falls back to its normal fetch — nothing breaks.
 *
 * Cache keys must match what the screens request or the warm-up is wasted:
 *  - LandingPage opens on mode 'drop', category 'all', page 0, no date range.
 *  - ReelsScreen opens on tab 'foryou'.
 *  - ExplorePage reads TrendingManager.fetch().
 */
import { FeedManager, TrendingManager } from './dataFlow';
import { ReelsRepository } from './reelsDataFlow';

let _done = false;

/**
 * @param {{ userId?: string|null }} opts
 */
export function prewarmSections({ userId = null } = {}) {
  if (_done) return;
  _done = true;

  // Small delay so the initial paint of the default tab wins the main thread
  // first; the warm-ups then fill in before the user swipes to another section.
  setTimeout(() => {
    // Feed (the default tab + shared by Explore's "near you" list).
    FeedManager.fetchPage({ page: 0, mode: 'drop', category: 'all', query: '', userId })
      .catch(() => {});

    // Explore trending row.
    TrendingManager.fetch?.(8)?.catch?.(() => {});

    // Reels "For You" — populates ReelsRepository's short cache so the first
    // Reels open is instant.
    ReelsRepository.getReelsFeed({ tab: 'foryou', userId }).catch(() => {});
  }, 1200);
}

/** Allow a fresh warm-up after sign-in / account switch. */
export function resetPrewarm() {
  _done = false;
}
