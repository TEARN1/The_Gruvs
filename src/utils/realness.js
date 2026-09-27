// ── Realness score (Truth Protocol, quantified) ──────────────────────────────
// How REAL is a Gruv's crowd — verified presence vs hype. A Gruv with 200 Vibes
// but 3 Touch Downs is hyped-but-empty; one with 80 Vibes and 60 here is the
// real deal. Pure + null-safe.
//
//   vibes — hype (vibe_count)
//   going — intent (Locked In)
//   here  — verified Touch Downs (the only signal that can't be faked)
//
// Returns { tier, label } where tier ∈ none | hyped | building | real.

export function realnessScore({ vibes = 0, going = 0, here = 0 } = {}) {
  const hype = (Number(vibes) || 0) + (Number(going) || 0);
  const real = Number(here) || 0;

  if (real <= 0 && hype <= 0) return { tier: 'none', label: 'No signal yet' };
  if (real <= 0) return { tier: 'hyped', label: 'Hyped — unproven' };
  // Real deal: a genuine crowd on the ground, or presence that backs up the hype.
  if (real >= 20 || (hype > 0 && real >= hype * 0.5)) return { tier: 'real', label: 'The real deal' };
  return { tier: 'building', label: 'Building' };
}
