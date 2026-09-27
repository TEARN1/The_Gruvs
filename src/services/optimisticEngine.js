/**
 * optimisticEngine.js — Instant client-side state mutation with rollback.
 *
 * Provides immediate UI feedback for:
 *   - Liking posts / reels
 *   - RSVPing to events
 *   - Bookmarking / Saving events
 *   - Follow / Unfollow actions
 *
 * If the background network write fails, it reverts the local state and
 * alerts the caller to show a graceful rollback toast.
 */

class OptimisticStore {
  constructor() {
    this.listeners = new Set();
    this.optimisticLikes = new Map();     // id -> boolean
    this.optimisticCounts = new Map();    // id -> delta (+1, -1)
    this.optimisticRsvps = new Map();     // eventId -> status ('going' | null)
    this.optimisticSaves = new Map();     // eventId -> boolean
    this.optimisticFollows = new Map();   // userId -> boolean
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => {
      try { fn(); } catch (_) {}
    });
  }

  /**
   * Optimistically toggle a like
   */
  async toggleLike({ targetId, isLiked, currentCount = 0, serverCall }) {
    const nextState = !isLiked;
    const delta = nextState ? 1 : -1;

    // Apply immediate local state
    this.optimisticLikes.set(targetId, nextState);
    this.optimisticCounts.set(targetId, (this.optimisticCounts.get(targetId) || 0) + delta);
    this.notify();

    try {
      if (serverCall) await serverCall(nextState);
      return { ok: true, liked: nextState, count: Math.max(0, currentCount + delta) };
    } catch (err) {
      // Revert on error
      this.optimisticLikes.set(targetId, isLiked);
      this.optimisticCounts.set(targetId, (this.optimisticCounts.get(targetId) || 0) - delta);
      this.notify();
      throw err;
    }
  }

  /**
   * Optimistically toggle an RSVP
   */
  async toggleRsvp({ eventId, isGoing, serverCall }) {
    const nextStatus = isGoing ? null : 'going';
    this.optimisticRsvps.set(eventId, nextStatus);
    this.notify();

    try {
      if (serverCall) await serverCall(nextStatus);
      return { ok: true, status: nextStatus };
    } catch (err) {
      this.optimisticRsvps.set(eventId, isGoing ? 'going' : null);
      this.notify();
      throw err;
    }
  }

  /**
   * Get active optimistic state
   */
  getLikeState(id, fallback = false) {
    return this.optimisticLikes.has(id) ? this.optimisticLikes.get(id) : fallback;
  }

  getRsvpState(eventId, fallback = null) {
    return this.optimisticRsvps.has(eventId) ? this.optimisticRsvps.get(eventId) : fallback;
  }
}

export const optimisticEngine = new OptimisticStore();
