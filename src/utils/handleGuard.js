/**
 * handleGuard — stop username impersonation.
 *
 * Usernames are ASCII-only (the input regex already blocks Cyrillic-К lookalikes),
 * and uniqueness is case-insensitive. But two handles can still be built to look
 * identical to a human while being distinct strings:
 *
 *   konka  ·  k0nka  ·  kon.ka  ·  konka_  ·  konkaa  ·  kOnka
 *
 * On a Truth-Protocol app, someone registering a near-copy of a real venue/host
 * to trade on their reputation is a direct trust attack. This reduces a handle to
 * a "skeleton" — the canonical form of how it READS — so confusable variants
 * collide.
 *
 * Pure + deterministic. The scalable enforcement is a unique index on a stored
 * skeleton column (DB); this is the shared client-side core + a best-effort check.
 */

// Characters that read as the same glyph in common fonts.
const CONFUSABLES = {
  '0': 'o', '1': 'l', '!': 'l', '|': 'l', '3': 'e', '4': 'a', '5': 's',
  '7': 't', '8': 'b', '9': 'g', '$': 's', '@': 'a',
};

/**
 * Reduce a handle to how it READS: lowercase, drop separators (. _ -), map
 * digit/symbol lookalikes to letters, collapse runs of the same letter
 * (konkaa → konka), and fold the classic rn→m confusion.
 */
export function handleSkeleton(handle) {
  let s = String(handle || '').trim().toLowerCase().replace(/^@/, '');
  s = s.replace(/[._\-\s]/g, '');                     // separators are invisible noise
  s = s.replace(/[0-9!|$@]/g, (c) => CONFUSABLES[c] || c);
  s = s.replace(/rn/g, 'm');                          // 'rn' reads as 'm'
  s = s.replace(/(.)\1{1,}/g, '$1');                  // konkaa / konkaaa → konka
  return s;
}

/** True if two handles are visually confusable (same skeleton, different string). */
export function isConfusable(a, b) {
  if (!a || !b) return false;
  if (String(a).toLowerCase() === String(b).toLowerCase()) return false; // identical isn't "confusable"
  return handleSkeleton(a) === handleSkeleton(b);
}

/** Escape LIKE/ILIKE wildcards so `_` and `%` in a handle aren't treated as patterns. */
export function escapeLike(s) {
  return String(s || '').replace(/([%_\\])/g, '\\$1');
}

/**
 * Given the desired handle and a list of existing handles, return the first one
 * it would impersonate (same skeleton), or null.
 */
export function findImpersonation(desired, existingHandles) {
  const skel = handleSkeleton(desired);
  if (!skel) return null;
  for (const h of existingHandles || []) {
    if (!h) continue;
    if (String(h).toLowerCase() === String(desired).toLowerCase()) continue; // exact dup handled elsewhere
    if (handleSkeleton(h) === skel) return h;
  }
  return null;
}

export default { handleSkeleton, isConfusable, escapeLike, findImpersonation };
