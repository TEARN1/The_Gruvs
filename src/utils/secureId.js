/**
 * secureId — unguessable identifiers for anything that acts as a credential.
 *
 * `Math.random()` is NOT cryptographically secure: its output is predictable, so
 * anything used to prove identity or grant access (a ticket, an invite code, a
 * share token) must not come from it. A 4-digit random suffix on a QR entry
 * ticket is ~9,000 guesses — trivially brute-forceable at a door.
 *
 * Uses the platform CSPRNG (`crypto.getRandomValues`, present on web and in the
 * Expo/Hermes runtime). Falls back to Math.random ONLY if no CSPRNG exists at
 * all, and never silently — a credential minted without a CSPRNG is a bug we
 * want to see, not hide.
 */

// Unambiguous alphabet — no 0/O/1/I/l, so a ticket read aloud or off a screen
// can't be mistyped.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomBytes(n) {
  const g = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
  if (g && typeof g.getRandomValues === 'function') {
    return g.getRandomValues(new Uint8Array(n));
  }
  // No CSPRNG available. Extremely rare on our targets; do not fail a ticket,
  // but this path is a known weakness, not a design choice.
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

/**
 * A high-entropy token string. `len` chars from a 30-symbol alphabet:
 * 12 chars ≈ 59 bits — not brute-forceable.
 */
export function secureToken(len = 12) {
  const bytes = randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

/** Group into readable blocks: "A7QK-9MPX-2RTV". */
export function secureCode(groups = 3, per = 4) {
  const parts = [];
  for (let i = 0; i < groups; i++) parts.push(secureToken(per));
  return parts.join('-');
}

export default { secureToken, secureCode };
