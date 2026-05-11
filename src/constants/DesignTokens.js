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
