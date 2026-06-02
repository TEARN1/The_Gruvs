/**
 * Jest setup — runs before each test file (configured in package.json > jest >
 * setupFilesAfterEnv). Mocks the native modules that aren't available in the
 * Node test environment so component tests don't crash on import.
 *
 * React Native Testing Library v12.4+ auto-extends Jest matchers, so no
 * extra matcher import is needed here.
 */

// ── AsyncStorage ─────────────────────────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// ── expo-haptics (no-op in tests) ────────────────────────────────────────────
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// ── expo-local-authentication (biometrics) ───────────────────────────────────
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  authenticateAsync: jest.fn(async () => ({ success: true })),
  supportedAuthenticationTypesAsync: jest.fn(async () => []),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
}));

// ── Silence the RN Animated "useNativeDriver" warning in tests ───────────────
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({
  __esModule: true,
  default: { API: {}, addListener: jest.fn(), removeListeners: jest.fn() },
}), { virtual: true });

// ── Silence the known-benign "not wrapped in act(...)" noise from the looping
//    Animated effects (floating reaction orbs etc.). These are continuous
//    background animations, not state we assert on — real errors still print.
const _consoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && /not wrapped in act/.test(args[0])) return;
  _consoleError(...args);
};

// ── Global mock for Supabase client to prevent teardown leaks ────────────────
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      getUser: jest.fn(() => Promise.resolve({ data: { user: null } })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

