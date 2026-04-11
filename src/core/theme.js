import { Platform } from 'react-native';

export const ACCENT = '#ff4da6'; // Pulse Pink
export const GOLD = '#D4AF37';

export const LIGHT_THEME = {
  mode: 'light',
  bg: '#FDFCFE',
  card: '#FFFFFF',
  cardBorder: 'rgba(0, 0, 0, 0.06)',
  text: '#050510',
  textDim: '#64748B',
  accent: ACCENT,
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  overlay: 'rgba(5, 5, 16, 0.4)',
  subtle: '#F1F5F9',
  inputBg: '#F8FAFC',
  navBg: 'rgba(253, 252, 254, 0.95)',
  glass: (opacity = 0.05) => `rgba(0, 0, 0, ${opacity})`,
  sub: '#64748B',
};

export const DARK_THEME = {
  mode: 'dark',
  bg: '#050510',
  card: 'rgba(20, 20, 40, 0.95)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  text: '#ffffff',
  textDim: '#94a3b8',
  accent: ACCENT,
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  overlay: 'rgba(0, 0, 0, 0.7)',
  subtle: 'rgba(255, 255, 255, 0.05)',
  inputBg: 'rgba(255, 255, 255, 0.03)',
  navBg: 'rgba(5, 5, 20, 0.98)',
  glass: (opacity = 0.05) => `rgba(255, 255, 255, ${opacity})`,
  sub: '#94a3b8',
};

// Default export for backward compatibility
export const THEME = LIGHT_THEME;
export const COLORS = LIGHT_THEME;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const SHADOWS = {
  soft: (mode = 'light') => ({
    ...Platform.select({
      web: { boxShadow: mode === 'light' ? '0 4px 12px rgba(0,0,0,0.05)' : '0 4px 12px rgba(0,0,0,0.3)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: mode === 'light' ? 0.05 : 0.3,
        shadowRadius: 10,
        elevation: 3,
      }
    })
  }),
  glow: {
    ...Platform.select({
      web: { boxShadow: `0 8px 20px ${ACCENT}25` },
      default: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 8,
      }
    })
  }
};
