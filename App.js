import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useFonts, loadAsync as _loadFontAsync } from 'expo-font';
const Font = { loadAsync: _loadFontAsync };
import {
  View, StyleSheet, TouchableOpacity, Text,
  StatusBar, Animated, Platform, useWindowDimensions, BackHandler, ActivityIndicator, Linking, PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BREAKPOINT } from './src/constants/DesignTokens';
import { HIDDEN_TABS, feature } from './src/constants/launchConfig';
import { BusinessDashboardScreen } from './src/screens/BusinessDashboardScreen';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { setDriftReporter } from './src/utils/resilience';
import { shouldEnterSafeMode, clearCrashLog } from './src/utils/bootGuard';
import { logError } from './src/utils/logError';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { EntitlementProvider } from './src/context/EntitlementContext';
import { ResetPasswordModal } from './src/components/ResetPasswordModal';
import { IdentityProvider } from './src/context/IdentityContext';
import { CurrencyProvider } from './src/context/CurrencyContext';
import { ToastProvider, useToast } from './src/components/ToastNotification';
import { CallProvider } from './src/context/CallContext';
import { OfflineBanner } from './src/components/OfflineBanner';
import { InstallAppBanner } from './src/components/InstallAppBanner';
import { useWebAppUpdate, reloadForUpdate } from './src/hooks/useWebAppUpdate';
import { LandingPage } from './src/screens/LandingPage';
// Hooks from these modules are used at shell level — keep eager
import { NotificationsScreen, useUnreadCount } from './src/screens/NotificationsScreen';
import { ChatsScreen, useUnreadDMCount } from './src/screens/ChatsScreen';
import { AuthModal } from './src/components/AuthModal';
import { BrandLogo } from './src/components/BrandLogo';
import { useNotifications } from './src/hooks/useNotifications';
import { ViberProfileModal } from './src/components/ViberProfileModal';
// Split on web, static on native — see src/screens/lazyScreens.js
import {
  ProfilePage, CalendarPage, ExplorePage, ReelsScreen, GodViewDashboard, MapScreen,
} from './src/screens/lazyScreens';
import { TutorialProvider, useTutorial } from './src/context/TutorialContext';
import { TutorialOverlay } from './src/components/TutorialOverlay';
import { AppLockGate } from './src/components/AppLockGate';
import { installGlobalErrorHandler, installWebErrorHandler } from './src/utils/errorReporter';
import { validateEnv } from './src/utils/validateEnv';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SecurityService } from './src/services/securityService';
import { VibeEconomyEngine } from './src/services/revenueEngine';
import { supabase } from './src/services/supabase';
import { prewarmSections } from './src/services/prewarm';
import { backStack } from './src/utils/backStack';

// Install before any component mounts so all boot errors are captured.
// installGlobalErrorHandler covers native (ErrorUtils); installWebErrorHandler
// covers web (ErrorUtils is confirmed undefined under react-native-web) —
// between them, event-handler throws and unhandled promise rejections are
// caught on every platform instead of only wherever ErrorUtils happens to
// exist. Reporters are injected (not imported directly) so this module stays
// free of a supabase dependency, matching resilience.js's setDriftReporter.
installGlobalErrorHandler();
installWebErrorHandler({
  logError: (label, err) => logError(label, err),
  logSecurityEvent: (userId, type, details) => SecurityService.logSecurityEvent(userId, type, details),
});
validateEnv();

// Schema drift, and paths that only work via a fallback tier, now land in
// client_errors instead of a console nobody reads in production. That blind
// spot is how 48 missing RPCs and 14 missing columns survived unnoticed.
setDriftReporter((label, err, kind) =>
  logError(`${kind}:${label}`.slice(0, 80), err, { code: err?.code || null })
);

// Master list — every screen the shell can mount (used for keep-alive + deep links).
const ALL_TABS = [
  { key: 'feed', label: 'The Drop', icon: 'home' },
  { key: 'reels', label: 'Reels', icon: 'film' },
  { key: 'explore', label: 'Explore', icon: 'compass' },
  // The Living Map — a co-star of The Drop. Gated by feature('liveMap'); when
  // off it's filtered out of both the mount list and the nav bar below.
  ...(feature('liveMap') ? [{ key: 'map', label: 'Map', icon: 'map' }] : []),
  { key: 'calendar', label: 'Lineup', icon: 'calendar' },
  { key: 'chats', label: 'Linked Up', icon: 'message-circle' },
  { key: 'notifications', label: 'Pings', icon: 'bell' },
  { key: 'profile', label: 'Vibe Card', icon: 'user' },
];

// Visible list — what the bottom bar, sidebar, swipe, and hotkeys navigate.
// In minimal launch mode this drops the demoted tabs (e.g. Reels). Hidden
// screens still mount via ALL_TABS and stay reachable through deep links.
const TABS = ALL_TABS.filter(t => !HIDDEN_TABS.includes(t.key));

// Suspense fallback while a web chunk streams in. Hidden tabs prewarm in the
// background, so they render nothing — a spinner the user can't see is just
// noise, and on the active tab it should only appear if the chunk is genuinely
// slow (cached chunks resolve within a frame).
const ScreenSkeleton = ({ active }) => (
  active ? (
    <View style={styles.screenSkeleton}>
      <ActivityIndicator size="small" />
    </View>
  ) : null
);

const WIDE_BREAKPOINT = BREAKPOINT.wide;
const SIDEBAR_OPEN_WIDTH = 220;
const SIDEBAR_CLOSED_WIDTH = 56;

// ── Bottom Tab Bar (narrow screens) ──────────────────────────────────────────
const TabBar = ({ currentTab, onTabChange, primary, muted, bg, unreadCount = 0, unreadDMCount = 0 }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const tabWidth = width / TABS.length; // auto-scales with the visible tab count

  useEffect(() => {
    const index = TABS.findIndex(t => t.key === currentTab);
    const target = index * tabWidth + (tabWidth / 2) - 20;
    if (!isNaN(target)) {
      Animated.spring(indicatorAnim, {
        toValue: target,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    }
  }, [currentTab, tabWidth]);

  // Drag-to-scrub: glide a thumb across the bar to slide between sections
  // (faster than aiming at one tab). Latest tab kept in a ref so the gesture
  // only fires onTabChange when the tab under the finger actually changes.
  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;
  const scrubToX = useCallback((pageX) => {
    let idx = Math.floor(pageX / tabWidth);
    idx = Math.max(0, Math.min(TABS.length - 1, idx));
    const key = TABS[idx].key;
    if (key !== currentTabRef.current) {
      try { Haptics.selectionAsync(); } catch {}
      onTabChange(key);
    }
  }, [tabWidth, onTabChange]);

  const panResponder = useMemo(() => PanResponder.create({
    // Only hijack clearly-horizontal drags; taps still hit the tabs below.
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
    onPanResponderGrant: (e) => scrubToX(e.nativeEvent.pageX),
    onPanResponderMove: (e) => scrubToX(e.nativeEvent.pageX),
  }), [scrubToX]);

  return (
    <View
      style={[styles.tabBar, { borderTopColor: `${primary}25`, paddingBottom: insets.bottom || 6, backgroundColor: bg || 'rgba(13,17,18,0.97)' }]}
      {...panResponder.panHandlers}
    >
      {/* Grabber — signals the bar is draggable */}
      <View style={[styles.tabGrabber, { backgroundColor: `${primary}40` }]} pointerEvents="none" />
      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: `${primary}28`, transform: [{ translateX: indicatorAnim }] },
        ]}
      />
      {TABS.map(tab => {
        const isActive = currentTab === tab.key;
        return (
          // Items 31-32: accessibilityRole="tab", label, and selected state
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <View style={{ position: 'relative' }}>
              <Feather name={tab.icon} size={20} color={isActive ? primary : `${muted}`} style={{ opacity: isActive ? 1 : 0.5 }} />
              {/* Item 38: accessible unread badge labels */}
              {tab.key === 'notifications' && unreadCount > 0 && (
                <View
                  style={[styles.unreadBadge, { backgroundColor: '#ef4444' }]}
                  accessibilityLabel={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
                >
                  <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
              {tab.key === 'chats' && unreadDMCount > 0 && (
                <View
                  style={[styles.unreadBadge, { backgroundColor: primary }]}
                  accessibilityLabel={`${unreadDMCount} unread message${unreadDMCount !== 1 ? 's' : ''}`}
                >
                  <Text style={[styles.unreadBadgeText, { color: '#000' }]}>{unreadDMCount > 9 ? '9+' : unreadDMCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, { color: isActive ? primary : muted }]}>{tab.label}</Text>
            {isActive && <View style={[styles.tabDot, { backgroundColor: primary }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ── Left Sidebar (wide screens) ───────────────────────────────────────────────
// Item 33: accessibilityRole="navigation" on root
const SidebarNav = ({ currentTab, onTabChange, primary, muted, bg, isOpen, onToggle, onGodView, onBusiness }) => (
  <View
    accessibilityRole="navigation"
    accessibilityLabel="Main navigation"
    style={[
      sb.root,
      {
        width: isOpen ? SIDEBAR_OPEN_WIDTH : SIDEBAR_CLOSED_WIDTH,
        backgroundColor: bg,
        borderRightColor: `${primary}15`,
      },
      Platform.OS === 'web' && { transition: 'width 0.2s ease' },
    ]}
  >
    {/* Logo */}
    <TouchableOpacity
      activeOpacity={1}
      onLongPress={onGodView}
      style={[sb.logoRow, { justifyContent: isOpen ? 'flex-start' : 'center' }]}
    >
      <BrandLogo size={24} showGlow={isOpen} />
      {isOpen && (
        <View style={{ marginLeft: 10 }}>
          <Text style={[sb.logoName, { color: primary }]}>THE GRUVS</Text>
          <Text style={[sb.logoSub, { color: muted }]}>Royale Edition</Text>
        </View>
      )}
    </TouchableOpacity>

    <View style={[sb.divider, { backgroundColor: `${primary}15` }]} />

    {/* Nav items */}
    <View style={sb.nav}>
      {TABS.map(tab => {
        const isActive = currentTab === tab.key;
        return (
          // Item 33: accessibilityRole="tab", label, state on sidebar items
          // Item 39: data-tooltip for collapsed state CSS tooltip
          <TouchableOpacity
            key={tab.key}
            style={[
              sb.item,
              { justifyContent: isOpen ? 'flex-start' : 'center' },
              isActive && {
                backgroundColor: `${primary}15`,
                borderRightWidth: 2.5,
                borderRightColor: primary,
              },
            ]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            {...(!isOpen && Platform.OS === 'web' ? { 'data-tooltip': tab.label } : {})}
          >
            <Feather
              name={tab.icon}
              size={19}
              color={isActive ? primary : muted}
              style={{ opacity: isActive ? 1 : 0.5 }}
            />
            {isOpen && (
              <Text style={[sb.itemLabel, { color: isActive ? primary : muted }]}>
                {tab.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>

    {/* The Gruvs for Business — one tap from anywhere, not buried in a profile row */}
    {feature('business') && onBusiness && (
      <TouchableOpacity
        style={[sb.item, { justifyContent: isOpen ? 'flex-start' : 'center', marginTop: 'auto' }]}
        onPress={onBusiness}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="The Gruvs for Business"
        {...(!isOpen && Platform.OS === 'web' ? { 'data-tooltip': 'For Business' } : {})}
      >
        <Feather name="briefcase" size={19} color={primary} />
        {isOpen && <Text style={[sb.itemLabel, { color: primary, fontWeight: '800' }]}>For Business</Text>}
      </TouchableOpacity>
    )}

    {/* Toggle button — Item 44: accessibility role + label */}
    <TouchableOpacity
      style={[sb.toggleBtn, { justifyContent: isOpen ? 'flex-start' : 'center' }]}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      <Feather
        name={isOpen ? 'sidebar' : 'menu'}
        size={17}
        color={muted}
        style={{ opacity: 0.55 }}
      />
      {isOpen && <Text style={[sb.toggleLabel, { color: muted }]}>Collapse</Text>}
    </TouchableOpacity>
  </View>
);

const sb = StyleSheet.create({
  root: {
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  logoName: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  logoSub: { fontSize: 8, fontWeight: '700', letterSpacing: 1, marginTop: 2, opacity: 0.6 },
  divider: { height: 1, marginHorizontal: 14, marginBottom: 8 },
  nav: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  itemLabel: { fontSize: 13, fontWeight: '800' },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  toggleLabel: { fontSize: 11, fontWeight: '700' },
});

// ── Main Navigator ─────────────────────────────────────────────────────────────
const MainNavigator = () => {
  const { currentTheme, applyNeuralTheme } = useTheme();
  const { user: authUser, recoveryMode, endRecovery } = useAuth();
  const { width } = useWindowDimensions();
  const { show: showToast } = useToast();
  const updateReady = useWebAppUpdate(); // web: a newer build was deployed
  const unreadCount = useUnreadCount();
  const unreadDMCount = useUnreadDMCount(
    () => { if (currentTab !== 'chats') showToast('💬 New message in Linked Up', 'info'); }
  );
  const { hasLaunched, openTutorial, markLaunched, activeTutorial } = useTutorial();
  const [currentTab, setCurrentTab] = useState('feed');
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [godViewVisible, setGodViewVisible] = useState(false);
  const [bizHubVisible, setBizHubVisible] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [targetEvent, setTargetEvent] = useState(null);
  const [targetProfile, setTargetProfile] = useState(null);
  const [targetReel, setTargetReel] = useState(null);
  // Item 41: cross-fade between screens
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const backPressCount = useRef(0);
  const backPressTimer = useRef(null);
  const lastHapticRef = useRef(0);

  // Warm the caches for the other sections on launch so the first time the user
  // reaches Reels / Explore (or refreshes the feed) it's already loaded.
  useEffect(() => {
    prewarmSections({ userId: authUser?.id || null });
  }, [authUser?.id]);

  const handleTabChange = useCallback((tab) => {
    if (Platform.OS !== 'web') {
      const now = Date.now();
      if (now - lastHapticRef.current > 300) {
        lastHapticRef.current = now;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
      }
    }

    if (tab === currentTab && tab === 'feed') {
      setFeedRefreshKey(k => k + 1);
    } else {
      setCurrentTab(tab);
      // Item 41: cross-fade — new screen eases in instead of hard-cutting
      screenOpacity.setValue(0.25);
      Animated.timing(screenOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    }
  }, [currentTab, screenOpacity]);

  const isWide = width >= WIDE_BREAKPOINT;

  // ── Swipe between tabs ──────────────────────────────────────────────────────
  // Natural pager feel: swipe LEFT = next (Drop→Reels→Explore→Lineup→Linked Up→
  // Pings→Vibe Card), swipe RIGHT = previous. Reels owns its own horizontal
  // gestures (right = poster profile, left = Drop), so the shell skips it. We use
  // onMoveShouldSet (not the Capture variant) so inner horizontal carousels still
  // claim their own swipes — only swipes over plain/vertical content change tabs.
  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;
  const tabSwipe = useMemo(() => {
    const order = TABS.map(t => t.key);
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => {
        // Web: navigate by clicking tabs. Trackpad/scroll drift falsely triggers
        // this swipe and yanks the user to the next section — so disable it on web.
        if (Platform.OS === 'web') return false;
        if (currentTabRef.current === 'reels') return false;
        // Require a clearly deliberate, mostly-horizontal swipe (stricter than before).
        return Math.abs(g.dx) > 36 && Math.abs(g.dx) > Math.abs(g.dy) * 2.2;
      },
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dx) < Math.abs(g.dy)) return;
        if (Math.abs(g.dx) < 55 && Math.abs(g.vx) < 0.3) return;
        const i = order.indexOf(currentTabRef.current);
        if (i === -1) return;
        const ni = i + (g.dx > 0 ? -1 : 1);   // swipe right → previous tab, swipe left → next tab
        if (ni < 0 || ni >= order.length) return;
        handleTabChange(order[ni]);
      },
    });
  }, [handleTabChange]);

  // Android hardware back: close open overlays first, then tab-switch to feed, else double-press to exit
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = () => {
      if (backStack.pop()) return true; // close the topmost modal/sheet first
      if (godViewVisible) {
        setGodViewVisible(false);
        return true;
      }
      if (bizHubVisible) {
        setBizHubVisible(false);
        return true;
      }
      if (authModalVisible) {
        setAuthModalVisible(false);
        return true;
      }
      if (targetProfile) {
        setTargetProfile(null);
        return true;
      }
      if (targetEvent) {
        setTargetEvent(null);
        return true;
      }
      if (currentTab !== TABS[0].key) {
        handleTabChange(TABS[0].key);
        return true;
      }
      if (backPressCount.current === 1) {
        BackHandler.exitApp();
        return true;
      }
      backPressCount.current = 1;
      clearTimeout(backPressTimer.current);
      backPressTimer.current = setTimeout(() => { backPressCount.current = 0; }, 2000);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => { sub.remove(); clearTimeout(backPressTimer.current); };
  }, [currentTab, godViewVisible, authModalVisible, targetProfile, targetEvent, handleTabChange]);

  // Web: trap the browser / phone back button so it walks back to The Drop
  // instead of leaving the app (the Android handler above is native-only).
  const webBackRef = useRef(() => false);
  webBackRef.current = () => {
    if (backStack.pop()) return true; // close the topmost modal/sheet first
    if (godViewVisible) { setGodViewVisible(false); return true; }
    if (authModalVisible) { setAuthModalVisible(false); return true; }
    if (targetProfile) { setTargetProfile(null); return true; }
    if (targetEvent) { setTargetEvent(null); return true; }
    if (currentTab !== TABS[0].key) { handleTabChange(TABS[0].key); return true; }
    return false; // already on The Drop, nothing open -> allow the app to leave
  };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    let exiting = false;
    window.history.pushState({ gruvs: 'root' }, '');
    const onPop = () => {
      if (exiting) return;
      if (webBackRef.current()) {
        window.history.pushState({ gruvs: 1 }, ''); // re-trap so a single back never leaves mid-app
      } else {
        exiting = true;
        window.history.back(); // on The Drop with nothing open -> actually exit
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleNotifNavigate = useCallback((type, data) => {
    if (type === 'event' && data?.event_id) {
      setTargetEvent({ id: data.event_id });
      setCurrentTab('feed');
    } else if (type === 'chats') {
      setCurrentTab('chats');
    } else {
      setCurrentTab('notifications');
    }
  }, []);

  useNotifications({ onNavigate: handleNotifNavigate });

  // Native and Web deep-linking route handler
  useEffect(() => {
    const parseAndRouteUrl = (url) => {
      if (!url) return;
      try {
        // Parse native schemes (thegruvs://) and web links
        const cleanUrl = url.replace(/.*?:\/\//, '');
        const parts = cleanUrl.split('/');

        if (cleanUrl.includes('event/')) {
          const eventId = parts[parts.indexOf('event') + 1]?.split('?')[0];
          if (eventId) {
            setTargetEvent({ id: eventId });
            setCurrentTab('feed');
          }
        } else if (cleanUrl.includes('profile/')) {
          const profileId = parts[parts.indexOf('profile') + 1]?.split('?')[0];
          if (profileId) {
            setTargetProfile(profileId);
            setCurrentTab('profile');
          }
        } else if (cleanUrl.includes('reel/')) {
          const reelId = parts[parts.indexOf('reel') + 1]?.split('?')[0];
          if (reelId) {
            setTargetReel(reelId);
            setCurrentTab('reels');
          }
        }
      } catch (err) {
        console.warn('[DeepLink] failed to parse native link:', err);
      }
    };

    // Handle initial launch deep links
    Linking.getInitialURL().then(url => {
      if (url) parseAndRouteUrl(url);
    }).catch(() => {});

    // Listen to deep link events while app is open
    const sub = Linking.addEventListener('url', (event) => {
      if (event.url) parseAndRouteUrl(event.url);
    });

    // Web deep link parameter listener
    if (Platform.OS === 'web') {
      try {
        const params = new URLSearchParams(window.location.search);
        const eventId   = params.get('event');
        const profileId = params.get('profile');
        const reelId    = params.get('reel');
        if (eventId) {
          setTargetEvent({ id: eventId });
          setCurrentTab('feed');
          window.history.replaceState({}, '', window.location.pathname);
        } else if (profileId) {
          setTargetProfile(profileId);
          setCurrentTab('profile');
          window.history.replaceState({}, '', window.location.pathname);
        } else if (reelId) {
          setTargetReel(reelId);
          setCurrentTab('reels');
          window.history.replaceState({}, '', window.location.pathname);
        }
      } catch {}
    }

    return () => {
      if (sub && sub.remove) sub.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-launch welcome tutorial on first app open
  useEffect(() => {
    const checkStatus = async () => {
      if (!authUser) return;

      const status = await VibeEconomyEngine.getSovereignStatus(authUser.id);

      // Dynamic Sovereign Glow
      if (status.isRoyal) {
        const glowIntensity = Math.min(1, status.equity / VibeEconomyEngine.ROYAL_THRESHOLD);
        applyNeuralTheme({ glowIntensity: glowIntensity * 0.5 });
      }


    };

    checkStatus();

    // Weekly "you missed out" digest — at most once a week, never blocks startup.
    if (authUser) {
      setTimeout(() => {
        import('./src/services/missedEventsDigest')
          .then(m => m.maybeSendMissedDigest(authUser))
          .catch(() => {});
      }, 4000);

      // Keep the user findable in "Find Them": refresh their saved location on
      // launch, but ONLY if location permission is already granted (this never
      // shows a prompt). get_safe_nearby_vibers still gates on is_discoverable,
      // so a ghost/private user storing coords is never surfaced to others.
      setTimeout(async () => {
        try {
          const Location = await import('expo-location');
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status !== 'granted') return;
          const { LocationService } = await import('./src/services/locationService');
          const coords = await LocationService.requestAndGet();
          if (coords?.lat != null && coords?.lon != null) {
            LocationService.saveToProfile(authUser.id, coords.lat, coords.lon);
          }
        } catch { /* best-effort presence refresh */ }
      }, 6000);
    }

    SecurityService.validateSession().then(isValid => {
      if (!isValid) {
        supabase.auth.signOut().catch(() => {});
      }
    });

    if (!hasLaunched) {
      const timer = setTimeout(() => {
        openTutorial('welcome');
        markLaunched();
      }, 1200);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLaunched, authUser, applyNeuralTheme, openTutorial, markLaunched]);

  const bg = currentTheme?.background || '#0d1112';
  const primary = currentTheme?.primary || '#00f2ff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const isDark = !bg.startsWith('#f') && !bg.startsWith('#e');

  // Item 35: keyboard navigation 1-7 on web desktop
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e) => {
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= TABS.length && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target?.tagName;
        if (target === 'INPUT' || target === 'TEXTAREA') return;
        // Suppress when a modal is open — keyboard nav would navigate behind the modal
        if (authModalVisible || godViewVisible || !!targetProfile) return;
        handleTabChange(TABS[idx - 1].key);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleTabChange, authModalVisible, godViewVisible, targetProfile]);

  // Item 36: update document.title on tab change
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const tabLabel = ALL_TABS.find(t => t.key === currentTab)?.label || 'The Drop';
    document.title = `${tabLabel} — The Gruvs`;
  }, [currentTab]);

  const handleAuthRequired = () => setAuthModalVisible(true);

  const handleNavigateToEvent = (event) => {
    if (!event) return;
    setTargetEvent(event);
    setCurrentTab('feed');
  };

  const handleNavigateToServices = () => {
    setCurrentTab('explore');
  };

  // ── Keep-alive screens ──────────────────────────────────────────────────────
  // Each tab mounts ONCE on first visit and then stays mounted; switching tabs
  // only toggles visibility (display:none) instead of unmounting. That means a
  // screen keeps its loaded data + scroll position, so moving away and back no
  // longer triggers a fresh "download" each time. Tabs are mounted lazily, so
  // we don't pay for screens the user never opens.
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([currentTab]));
  useEffect(() => {
    setVisitedTabs(prev => (prev.has(currentTab) ? prev : new Set(prev).add(currentTab)));
  }, [currentTab]);

  // Progressive prefetch — quietly mount the other sections in the background so
  // the FIRST time a user opens one it is already loaded instead of triggering a
  // fresh "download" they wait on. Hidden screens stay paused (e.g. Reels gates
  // on tabActive), so this only warms their data + layout.
  //
  // IMPORTANT: each warm-up waits for the browser to be genuinely IDLE. Mounting
  // these on a plain timer competed with first paint/hydration and made the tab
  // bar take far longer to appear on slow devices (it wiped out CI entirely).
  // requestIdleCallback yields to rendering, so prefetch can never delay the UI.
  useEffect(() => {
    // NOTE: 'reels' is deliberately NOT prefetched — mounting it starts fetching
    // video, which burns mobile data in the background (bad on SA data plans) and
    // fires range requests. Reels loads on demand; the rest are light.
    const guestOk  = ['explore'];
    const authOnly = ['notifications', 'chats', 'profile'];
    const queue = [...guestOk, ...(authUser ? authOnly : [])];

    const warm = (tab) => setVisitedTabs(prev => (prev.has(tab) ? prev : new Set(prev).add(tab)));
    const idle = typeof globalThis.requestIdleCallback === 'function'
      ? (cb) => globalThis.requestIdleCallback(cb, { timeout: 10000 })
      : (cb) => setTimeout(cb, 0);

    const timers = queue.map((tab, i) =>
      // Start well after first paint, stagger widely, and still only run on idle.
      setTimeout(() => idle(() => warm(tab)), 5000 + i * 2500)
    );
    return () => timers.forEach(clearTimeout);
  }, [authUser]);

  const screenFor = (tabKey) => {
    switch (tabKey) {
      case 'feed':
        return (
          <LandingPage
            mode="drop"
            onAuthRequired={handleAuthRequired}
            targetEvent={targetEvent}
            onTargetHandled={() => setTargetEvent(null)}
            refreshKey={feedRefreshKey}
            onNavigateToServices={handleNavigateToServices}
            onNavigateToReels={(reelId) => {
              if (reelId) setTargetReel(reelId);
              handleTabChange('reels');
            }}
          />
        );
      case 'reels':
        return (
          <ReelsScreen
            onAuthRequired={handleAuthRequired}
            onNavigateToEvent={handleNavigateToEvent}
            initialReelId={targetReel}
            onInitialReelHandled={() => setTargetReel(null)}
            onExitToDrop={() => handleTabChange('feed')}
            tabActive={currentTab === 'reels'}
          />
        );
      case 'explore':
        return <ExplorePage onAuthRequired={handleAuthRequired} onNavigateToEvent={handleNavigateToEvent} />;
      case 'map':
        return <MapScreen onAuthRequired={handleAuthRequired} onNavigateToEvent={handleNavigateToEvent} />;
      case 'calendar':
        return <CalendarPage onAuthRequired={handleAuthRequired} onNavigateToEvent={handleNavigateToEvent} />;
      case 'chats':
        return <ChatsScreen onAuthRequired={handleAuthRequired} />;
      case 'notifications':
        return <NotificationsScreen onAuthRequired={handleAuthRequired} onNavigateToEvent={handleNavigateToEvent} />;
      case 'profile':
        return <ProfilePage onAuthRequired={handleAuthRequired} onNavigateToEvent={handleNavigateToEvent} />;
      default:
        return null;
    }
  };

  const renderScreen = () => (
    <View style={styles.screenHost}>
      {ALL_TABS.map(tab => {
        if (!visitedTabs.has(tab.key)) return null;
        const isActive = tab.key === currentTab;
        return (
          <View
            key={tab.key}
            style={isActive ? styles.screenActive : styles.screenHidden}
            pointerEvents={isActive ? 'auto' : 'none'}
            aria-hidden={!isActive}
            // Screens are pre-mounted hidden (background prefetch), so the DOM
            // holds several screens at once. Mark the live one so tests — and
            // anything else walking the tree — can scope to what's on screen
            // instead of matching text inside a hidden tab.
            dataSet={{ screen: tab.key, active: isActive ? 'true' : 'false' }}
          >
            <ErrorBoundary label={tab.label}>
              {/* Per-tab boundary: a background tab still streaming its chunk
                  must never suspend the tab the user is actually looking at. */}
              <Suspense fallback={<ScreenSkeleton active={isActive} />}>
                {screenFor(tab.key)}
              </Suspense>
            </ErrorBoundary>
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <ErrorBoundary label="Offline banner" inline>
        <OfflineBanner />
      </ErrorBoundary>
      {updateReady && (
        <TouchableOpacity
          onPress={reloadForUpdate}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="A new version is available. Tap to refresh."
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            paddingVertical: 8, paddingHorizontal: 14, backgroundColor: primary,
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
          }}
        >
          <Feather name="download" size={13} color="#000" />
          <Text style={{ color: '#000', fontWeight: '900', fontSize: 12 }}>
            New version available — tap to refresh
          </Text>
        </TouchableOpacity>
      )}
      <ErrorBoundary label="Install banner" inline>
        <InstallAppBanner primary={primary} />
      </ErrorBoundary>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={bg}
        translucent={false}
      />

      {/* Password reset: shown over everything when the user returns via a reset link */}
      {recoveryMode && (
        <ErrorBoundary label="Password reset">
          <ResetPasswordModal visible onDone={endRecovery} />
        </ErrorBoundary>
      )}

      {/* Item 37: Hidden ARIA live region announces current tab to screen readers */}
      <View
        accessible
        importantForAccessibility="yes"
        aria-live="polite"
        aria-atomic="true"
        style={styles.srOnly}
      >
        <Text>{ALL_TABS.find(t => t.key === currentTab)?.label || ''}</Text>
      </View>

      {/* Item 40: Skip-to-content link */}
      {Platform.OS === 'web' && (
        <TouchableOpacity
          nativeID="skip-to-content"
          accessibilityRole="link"
          accessibilityLabel="Skip to main content"
          onPress={() => {
            const el = document.getElementById('main-content');
            if (el) { el.setAttribute('tabindex', '-1'); el.focus(); }
          }}
          style={styles.skipLink}
        >
          <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>Skip to content</Text>
        </TouchableOpacity>
      )}

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {isWide ? (
          // ── Wide screen: sidebar on left ───────────────────────────────
          <View style={styles.wideLayout}>
            <ErrorBoundary label="Navigation" inline>
              <SidebarNav
                currentTab={currentTab}
                onTabChange={handleTabChange}
                primary={primary}
                muted={muted}
                bg={bg}
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(p => !p)}
                onGodView={() => setGodViewVisible(true)}
                onBusiness={() => setBizHubVisible(true)}
              />
            </ErrorBoundary>
            {/* Item 43: nativeID for skip-link anchor */}
            <Animated.View nativeID="main-content" style={[styles.wideContent, { opacity: screenOpacity }]}>
              {renderScreen()}
            </Animated.View>
          </View>
        ) : (
          // ── Narrow screen: bottom tab bar ──────────────────────────────
          <View style={styles.narrowLayout}>
            {/* Item 43: nativeID for skip-link anchor */}
            <Animated.View nativeID="main-content" style={[styles.content, { opacity: screenOpacity }]} {...tabSwipe.panHandlers}>
              {renderScreen()}
            </Animated.View>
            {/* The Gruvs for Business — floating pill, one tap from any screen
                (mobile has no global header). Above the tab bar. */}
            {feature('business') && (
              <TouchableOpacity
                onPress={() => setBizHubVisible(true)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="The Gruvs for Business"
                style={[styles.bizFab, { backgroundColor: primary, shadowColor: primary }]}
              >
                <Feather name="briefcase" size={14} color="#000" />
                <Text style={styles.bizFabText}>Business</Text>
              </TouchableOpacity>
            )}
            <ErrorBoundary label="Navigation" inline>
              <TabBar
                currentTab={currentTab}
                onTabChange={handleTabChange}
                primary={primary}
                muted={muted}
                bg={bg}
                unreadCount={unreadCount}
                unreadDMCount={unreadDMCount}
              />
            </ErrorBoundary>
          </View>
        )}
      </SafeAreaView>

      {/* The Gruvs for Business hub — opened from sidebar / mobile pill */}
      {bizHubVisible && (
        <ErrorBoundary label="Business">
          <BusinessDashboardScreen onClose={() => setBizHubVisible(false)} />
        </ErrorBoundary>
      )}

      {/* Item 42: accessibilityViewIsModal on AuthModal */}
      <ErrorBoundary label="Sign in">
        <AuthModal
          visible={authModalVisible}
          onClose={() => setAuthModalVisible(false)}
          accessibilityViewIsModal={true}
        />
      </ErrorBoundary>

      {/* Tutorial overlay — rendered on top of everything */}
      {activeTutorial && (
        <ErrorBoundary label="Tutorial">
          <TutorialOverlay />
        </ErrorBoundary>
      )}

      {/* Deep-link: profile share opens ViberProfileModal over current tab */}
      <ErrorBoundary label="Profile">
        <ViberProfileModal
          visible={!!targetProfile}
          userId={targetProfile}
          onClose={() => setTargetProfile(null)}
          onNavigateToEvent={handleNavigateToEvent}
        />
      </ErrorBoundary>

      {/* Supreme God View Dashboard — lazy-split on web (src/screens/lazyScreens.js).
          Mounted unconditionally regardless of `visible` (that's an internal
          display gate, not a mount gate), so this MUST carry its own Suspense —
          it sits outside every per-tab boundary and has no ancestor Suspense.
          Missing this exact wrapper was the confirmed cause of a production
          incident: an unresolved chunk fetch suspended with nothing local to
          catch it, falling through to the unlabeled root boundary. */}
      <ErrorBoundary label="God View" lazyBoundary inline>
        <Suspense fallback={null}>
          <GodViewDashboard
            visible={godViewVisible}
            onClose={() => setGodViewVisible(false)}
          />
        </Suspense>
      </ErrorBoundary>
    </View>
  );
};

export default function App() {
  // Boot-time circuit breaker (Layer -1) — the earliest defense, checked
  // before ANY provider mounts. ErrorBoundary's in-session safe mode can't
  // help a crash that happens before React's tree even finishes building
  // (a synchronous provider-init throw, a hung font load); this catches
  // that case using a PERSISTENT log (survives a full app kill, unlike
  // sessionStorage) written by ErrorBoundary's `critical` catch.
  const [safeModeChecked, setSafeModeChecked] = useState(false);
  const [inSafeMode, setInSafeMode] = useState(false);
  useEffect(() => {
    let alive = true;
    // Race against a short timeout — a boot gate must never hang the app
    // waiting on storage; fail OPEN (normal boot) if the check is slow.
    Promise.race([
      shouldEnterSafeMode(),
      new Promise((resolve) => setTimeout(() => resolve(false), 800)),
    ]).then((trip) => { if (alive) { setInSafeMode(trip); setSafeModeChecked(true); } })
      .catch(() => { if (alive) setSafeModeChecked(true); });
    return () => { alive = false; };
  }, []);

  // Kick off font load in background. Never block rendering — if the load
  // stalls, the app would be permanently blank. Icons self-load in componentDidMount.
  // First paint blocks ONLY on Feather (~56KB) — 96% of the app's icons. The
  // heavy MaterialCommunityIcons face (~1.15MB) loads in the BACKGROUND so a
  // slow connection no longer stares at a multi-second spinner; the handful of
  // MCI glyphs simply pop in a moment later.
  const [fontsLoaded] = useFonts({
    Feather: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'),
    feather: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'),
  });
  useEffect(() => {
    Font.loadAsync({
      MaterialCommunityIcons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
      'material-community': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
    }).catch(() => {});
  }, []);

  const [forceLoaded, setForceLoaded] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const t = setTimeout(() => setForceLoaded(true), 1200); // shorter safety net
      return () => clearTimeout(t);
    }
  }, []);

  if (!safeModeChecked || (!fontsLoaded && !forceLoaded)) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0d1112" translucent={false} />
        <ActivityIndicator size="large" color="#00f2ff" />
      </View>
    );
  }

  // Boot guard tripped: skip the normal tree — no providers, no lazy screens,
  // nothing that could be part of whatever kept crashing. Deliberately has no
  // dependency on anything else in this file being healthy.
  if (inSafeMode) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0d1112" translucent={false} />
        <Feather name="shield" size={28} color="#00f2ff" />
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 14, textAlign: 'center', paddingHorizontal: 24 }}>
          Running in safe mode
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 6, textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 }}>
          The Gruvs crashed a few times in a row, so it's starting up minimal
          this time to break the loop.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#00f2ff' }}
            onPress={async () => {
              await clearCrashLog();
              if (typeof window !== 'undefined' && window.location) window.location.reload();
              else { setInSafeMode(false); }
            }}
          >
            <Feather name="rotate-cw" size={13} color="#00f2ff" />
            <Text style={{ color: '#00f2ff', fontSize: 13, fontWeight: '700' }}>Exit safe mode</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ErrorBoundary critical label="App shell">
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <EntitlementProvider>
            <IdentityProvider>
              <CurrencyProvider>
              <TutorialProvider>
                <ToastProvider>
                  <CallProvider>
                    <ErrorBoundary critical label="Main navigator">
                      <AppLockGate>
                        <MainNavigator />
                      </AppLockGate>
                    </ErrorBoundary>
                  </CallProvider>
                </ToastProvider>
              </TutorialProvider>
              </CurrencyProvider>
            </IdentityProvider>
            </EntitlementProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, ...(Platform.OS === 'web' && { minHeight: '100dvh' }) },
  safeArea: { flex: 1 },

  // Wide layout
  wideLayout: { flex: 1, flexDirection: 'row' },
  wideContent: { flex: 1, overflow: 'hidden' },

  // Narrow layout
  narrowLayout: { flex: 1 },
  content: { flex: 1 },
  bizFab: {
    position: 'absolute', right: 14, bottom: 78, zIndex: 40,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
    shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 6,
  },
  bizFabText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 0.3 },

  // Keep-alive screen host: visited screens stack here; only the active one is
  // visible. Hidden screens stay mounted (state + scroll preserved) but out of
  // layout and non-interactive.
  screenHost: { flex: 1 },
  screenActive: { ...StyleSheet.absoluteFillObject },
  screenHidden: { display: 'none' },
  screenSkeleton: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Bottom tab bar — height expands to cover bottom inset (home indicator / nav bar)
  tabBar: {
    flexDirection: 'row',
    minHeight: 62,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 6,
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  tabGrabber: {
    position: 'absolute',
    top: 3,
    left: '50%',
    marginLeft: -18,
    width: 36,
    height: 4,
    borderRadius: 2,
    zIndex: 5,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    gap: 3,
  },
  tabLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  tabDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
  unreadBadge: { position: 'absolute', top: -4, right: -6, minWidth: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  unreadBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900' },

  // Item 37: visually hidden ARIA live region
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  // Item 40: skip-to-content (positioned via CSS id="skip-to-content")
  skipLink: {
    position: 'absolute',
    top: -100,
    left: 8,
    zIndex: 99999,
    backgroundColor: '#00f2ff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d1112',
  },
});
