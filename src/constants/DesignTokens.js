// Centralised design tokens — single source of truth for layout constants.
// Import these instead of scattering magic numbers across files.

export const Z_INDEX = {
  toast:   99999,
  modal:   9000,
  sidebar: 800,
  fab:     600,
  sticky:  100,
  base:    1,
};

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  14,
  lg:  20,
  xl:  32,
  xxl: 48,
};

export const RADIUS = {
  card:   22,
  pill:   20,
  badge:  8,
  avatar: 999,
  input:  14,
  modal:  28,
  glass:  18,
};

export const DURATION = {
  fast:   150,
  base:   220,
  slow:   380,
};

export const TRANSITION = {
  fast:   '150ms ease',
  base:   '220ms ease',
  slow:   '380ms ease',
  spring: 'cubic-bezier(0.34,1.56,0.64,1)',
};

export const SHADOW = {
  card: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius:  40,
    elevation:     10,
  },
  lift: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 20 },
    shadowOpacity: 0.75,
    shadowRadius:  60,
    elevation:     16,
  },
  glow: (color) => ({
    shadowColor:   color,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius:  18,
    elevation:     12,
  }),
};

export const FONT = {
  heading:    { fontWeight: '900', letterSpacing: -0.3 },
  subheading: { fontWeight: '800', letterSpacing: 0   },
  label:      { fontWeight: '700', letterSpacing: 0.3 },
  badge:      { fontWeight: '900', letterSpacing: 0.8 },
  caption:    { fontWeight: '600', letterSpacing: 0.1 },
};

export const BREAKPOINT = {
  wide:   900,
  medium: 640,
  small:  375,
};

// ── Glass / Water design language ────────────────────────────────────────────
// Pure-JS, cross-platform (web uses CSS gradients via the `background` prop;
// native uses layered translucent Views). No native blur dependency.
export const GLASS = {
  // base fill behind frosted surfaces
  fill:        'rgba(255,255,255,0.06)',
  fillStrong:  'rgba(255,255,255,0.10)',
  fillFaint:   'rgba(255,255,255,0.035)',
  // hairline borders that catch light
  border:      'rgba(255,255,255,0.16)',
  borderBright:'rgba(255,255,255,0.28)',
  // top sheen overlay (the "wet" highlight) — web gradient + native fallback
  sheenWeb:    'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 38%, transparent 60%)',
  sheenNative: 'rgba(255,255,255,0.07)',
  // inner depth shadow for a "pane of glass" feel
  innerShadow: 'rgba(0,0,0,0.22)',
  radius:      22,
};

// Animation timings tuned for a liquid, springy feel
export const MOTION = {
  liquid:      { tension: 38, friction: 9 },   // slow watery settle
  spring:      { tension: 180, friction: 12 }, // snappy press
  bounce:      { tension: 220, friction: 8 },  // playful pop
  drift:       14000,                          // ambient background drift loop (ms)
  shimmer:     1400,                           // skeleton shimmer sweep (ms)
  countUp:     900,                            // number count-up (ms)
};
