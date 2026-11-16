/**
 * backStack — a tiny global "back intent" stack.
 *
 * Anything that opens an on-screen layer (modal, sheet, full-screen overlay)
 * registers a close handler while it is visible. The hardware back button
 * (Android) and the browser/phone back button (web) pop the most-recently
 * opened layer before the app navigates tabs or exits — so a single back press
 * closes the thing on top instead of blowing past it and leaving the app.
 *
 * Use the `useBackClose(active, onClose)` hook rather than calling this directly.
 */
export const BACK_PRIORITY = {
  PREVIEW: 40,
  MODAL: 30,
  SEARCH: 20,
  TAB: 10,
};

let stack = [];

export const backStack = {
  /** Register a close handler with optional priority; returns an unregister fn (call on unmount/hide). */
  push(closeFn, priority = BACK_PRIORITY.MODAL) {
    const entry = { closeFn, priority, openedAt: Date.now() };
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  },

  /** Close the topmost registered layer (highest priority, then LIFO). Returns true if one was handled. */
  pop() {
    if (stack.length === 0) return false;
    let bestIdx = stack.length - 1;
    for (let i = stack.length - 2; i >= 0; i--) {
      if (stack[i].priority > stack[bestIdx].priority) {
        bestIdx = i;
      }
    }
    const entry = stack[bestIdx];
    // Ignore a back-pop that lands within 300ms of opening. No human presses back
    // that fast — on web a spurious history/popstate event can fire right as a
    // sheet mounts, which was slamming the reels comment box shut on open. We
    // consume the event (so it doesn't bubble) but keep the layer open.
    if (Date.now() - entry.openedAt < 300) return true;
    stack.splice(bestIdx, 1);
    try { entry.closeFn(); } catch { /* a broken close handler must not wedge back */ }
    return true;
  },

  get size() { return stack.length; },
};

export default backStack;