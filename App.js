import { useState, useRef, useEffect, useCallback } from 'react';
import { useFonts } from 'expo-font';
import {
  View, StyleSheet, TouchableOpacity, Text,
  StatusBar, Animated, Platform, useWindowDimensions, BackHandler,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BREAKPOINT } from './src/constants/DesignTokens';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { IdentityProvider } from './src/context/IdentityContext';
import { ToastProvider } from './src/components/ToastNotification';
import { LandingPage } from './src/screens/LandingPage';
// Hooks from these modules are used at shell level — keep eager
import { NotificationsScreen, useUnreadCount } from './src/screens/NotificationsScreen';
import { ChatsScreen, useUnreadDMCount } from './src/screens/ChatsScreen';
import { AuthModal } from './src/components/AuthModal';
import { BrandLogo } from './src/components/BrandLogo';
import { useNotifications } from './src/hooks/useNotifications';
import { ProfilePage } from './src/screens/ProfilePage';
import { ViberProfileModal } from './src/components/ViberProfileModal';
import { CalendarPage } from './src/screens/CalendarPage';
import { ExplorePage } from './src/screens/ExplorePage';
import { ReelsScreen } from './src/screens/ReelsScreen';
import { TutorialProvider, useTutorial } from './src/context/TutorialContext';
import { TutorialOverlay } from './src/components/TutorialOverlay';
import { GodViewDashboard } from './src/screens/GodViewDashboard';
//import { AIAssistant } from './src/components/AIAssistant'; // HIDDEN — Under development
import { installGlobalErrorHandler } from './src/utils/errorReporter';
import { validateEnv } from './src/utils/validateEnv';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SecurityService } from './src/services/securityService';
import { VibeEconomyEngine } from './src/services/revenueEngine';
import { NeuralUI } from './src/services/neuralUI';

// Install before any component mounts so all boot errors are captured
installGlobalErrorHandler();
validateEnv();

const TABS = [
  { key: 'feed', label: 'The Drop', icon: 'home' },
  { key: 'reels', label: 'Reels', icon: 'film' },
  { key: 'explore', label: 'Explore', icon: 'compass' },
  { key: 'calendar', label: 'Lineup', icon: 'calendar' },
  { key: 'chats', label: 'Linked Up', icon: 'message-circle' },
  { key: 'notifications', label: 'Pings', icon: 'bell' },
  { key: 'profile', label: 'Vibe Card', icon: 'user' },
];

const WIDE_BREAKPOINT = BREAKPOINT.wide;
const SIDEBAR_OPEN_WIDTH = 220;
const SIDEBAR_CLOSED_WIDTH = 56;

// ── Bottom Tab Bar (narrow screens) ──────────────────────────────────────────
const TabBar = ({ currentTab, onTabChange, primary, muted, bg, unreadCount = 0, unreadDMCount = 0 }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const tabWidth = width / TABS.length; // auto-scales with 7 tabs

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

  return (
    <View style={[styles.tabBar, { borderTopColor: `${primary}25`, paddingBottom: insets.bottom || 6, backgroundColor: bg || 'rgba(13,17,18,0.97)' }]}>
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
const SidebarNav = ({ currentTab, onTabChange, primary, muted, bg, isOpen, onToggle, onGodView }) => (
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
  const { user: authUser } = useAuth();
  const { width } = useWindowDimensions();
  const unreadCount = useUnreadCount();
  const unreadDMCount = useUnreadDMCount();
  const { hasLaunched, openTutorial, markLaunched, activeTutorial } = useTutorial();
  const [currentTab, setCurrentTab] = useState('feed');
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [godViewVisible, setGodViewVisible] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [, setIsSovereign] = useState(false);
  const [targetEvent, setTargetEvent] = useState(null);
  const [targetProfile, setTargetProfile] = useState(null);
  const [targetReel, setTargetReel] = useState(null);
  // Item 41: cross-fade between screens
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const backPressCount = useRef(0);
  const backPressTimer = useRef(null);

  const isWide = width >= WIDE_BREAKPOINT;

  // Android hardware back: single press → go to feed; double press within 2s → exit app
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = () => {
      if (currentTab !== 'feed') {
        setCurrentTab('feed');
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
  }, [currentTab]);

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

  // Web deep-link: read ?event=, ?profile=, ?reel= from og-meta redirect URLs
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const eventId   = params.get('event');
      const profileId = params.get('profile');
      const reelId    = params.get('reel');
      if (eventId) {
        setTargetEvent({ id: eventId });
        setCurrentTab('feed');
        // Clean URL without reload
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-launch welcome tutorial on first app open
  useEffect(() => {
    // Advanced Logic: Check Sovereign Status
    const checkStatus = async () => {
      const user = authUser;
      if (user) {
        const status = await VibeEconomyEngine.getSovereignStatus(user.id);
        setIsSovereign(status.isRoyal);

        // NEW: Dynamic Sovereign Glow
        if (status.isRoyal) {
          // Apply a subtle glow effect to the UI based on equity
          const glowIntensity = Math.min(1, status.equity / VibeEconomyEngine.ROYAL_THRESHOLD);
          applyNeuralTheme({ glowIntensity: glowIntensity * 0.5 }); // Max 50% intensity
        }

        // Advanced Logic: Neural UI Mutation
        if (status.isRoyal || status.sis > 90) {
          NeuralUI.calculateOptimalEnvironment({ sis: status.sis, equity: status.equity })
            .then(res => applyNeuralTheme(res.custom_tokens))
            .catch(() => { });
        }
      }
    };
    checkStatus();

    // Security check: validate session on mount
    SecurityService.validateSession().then(isValid => {
      if (!isValid && currentTab !== 'feed') {
        // Optional: force sign out or redirect if session is invalid
      }
    });

    if (!hasLaunched) {
      const t = setTimeout(() => {
        openTutorial('welcome');
        markLaunched();
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [hasLaunched]);

  const bg = currentTheme?.background || '#0d1112';
  const primary = currentTheme?.primary || '#00f2ff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const isDark = !bg.startsWith('#f') && !bg.startsWith('#e');

  // Item 35: keyboard navigation 1-6 on web desktop
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e) => {
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= TABS.length && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target?.tagName;
        if (target === 'INPUT' || target === 'TEXTAREA') return;
        handleTabChange(TABS[idx - 1].key);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentTab]);

  // Item 36: update document.title on tab change
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const tabLabel = TABS.find(t => t.key === currentTab)?.label || 'The Drop';
    document.title = `${tabLabel} — The Gruvs`;
  }, [currentTab]);

  const handleTabChange = (tab) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    }

    if (tab === currentTab && tab === 'feed') {
      setFeedRefreshKey(k => k + 1);
    } else {
      setCurrentTab(tab);
    }
  };

  const handleAuthRequired = () => setAuthModalVisible(true);

  const handleNavigateToEvent = (event) => {
    if (!event) return;
    setTargetEvent(event);
    setCurrentTab('feed');
  };

  const handleNavigateToServices = () => {
    setCurrentTab('explore');
  };

  const renderScreen = () => {
    const wrap = (label, node) => (
      <ErrorBoundary key={label} label={label}>
        {node}
      </ErrorBoundary>
    );
    switch (currentTab) {
      case 'feed':
        return wrap('The Drop', (
          <LandingPage
            mode="drop"
            onAuthRequired={handleAuthRequired}
            targetEvent={targetEvent}
            onTargetHandled={() => setTargetEvent(null)}
            refreshKey={feedRefreshKey}
            onNavigateToServices={handleNavigateToServices}
          />
        ));
      case 'reels':
        return wrap('Reels', (
          <ReelsScreen
            onAuthRequired={handleAuthRequired}
            initialReelId={targetReel}
            onInitialReelHandled={() => setTargetReel(null)}
          />
        ));
      case 'explore':
        return wrap('Explore', (
          <ExplorePage
            onAuthRequired={handleAuthRequired}
            onNavigateToEvent={handleNavigateToEvent}
          />
        ));
      case 'calendar':
        return wrap('Lineup', <CalendarPage onAuthRequired={handleAuthRequired} onNavigateToEvent={handleNavigateToEvent} />);
      case 'chats':
        return wrap('Chats', <ChatsScreen onAuthRequired={handleAuthRequired} />);
      case 'notifications':
        return wrap('Pings', <NotificationsScreen onAuthRequired={handleAuthRequired} onNavigateToEvent={handleNavigateToEvent} />);
      case 'profile':
        return wrap('Vibe Card', <ProfilePage onAuthRequired={handleAuthRequired} onNavigateToEvent={handleNavigateToEvent} />);
      default:
        return wrap('The Drop', (
          <LandingPage
            mode="drop"
            onAuthRequired={handleAuthRequired}
            targetEvent={targetEvent}
            onTargetHandled={() => setTargetEvent(null)}
            refreshKey={feedRefreshKey}
          />
        ));
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={bg}
        translucent={false}
      />

      {/* Item 37: Hidden ARIA live region announces current tab to screen readers */}
      <View
        accessible
        importantForAccessibility="yes"
        aria-live="polite"
        aria-atomic="true"
        style={styles.srOnly}
      >
        <Text>{TABS.find(t => t.key === currentTab)?.label || ''}</Text>
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
            <SidebarNav
              currentTab={currentTab}
              onTabChange={handleTabChange}
              primary={primary}
              muted={muted}
              bg={bg}
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen(p => !p)}
              onGodView={() => setGodViewVisible(true)}
            />
            {/* Item 43: nativeID for skip-link anchor */}
            <Animated.View nativeID="main-content" style={[styles.wideContent, { opacity: screenOpacity }]}>
              {renderScreen()}
            </Animated.View>
          </View>
        ) : (
          // ── Narrow screen: bottom tab bar ──────────────────────────────
          <View style={styles.narrowLayout}>
            {/* Item 43: nativeID for skip-link anchor */}
            <Animated.View nativeID="main-content" style={[styles.content, { opacity: screenOpacity }]}>
              {renderScreen()}
            </Animated.View>
            <TabBar
              currentTab={currentTab}
              onTabChange={handleTabChange}
              primary={primary}
              muted={muted}
              bg={bg}
              unreadCount={unreadCount}
              unreadDMCount={unreadDMCount}
            />
          </View>
        )}
      </SafeAreaView>

      {/* Item 42: accessibilityViewIsModal on AuthModal */}
      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        accessibilityViewIsModal={true}
      />

      {/* AI Assistant — floating button above TabBar — HIDDEN */}
      {/* <AIAssistant bottomOffset={80} /> */}

      {/* Tutorial overlay — rendered on top of everything */}
      {activeTutorial && <TutorialOverlay />}

      {/* Deep-link: profile share opens ViberProfileModal over current tab */}
      <ViberProfileModal
        visible={!!targetProfile}
        userId={targetProfile}
        onClose={() => setTargetProfile(null)}
        onNavigateToEvent={handleNavigateToEvent}
      />

      {/* Supreme God View Dashboard */}
      <GodViewDashboard
        visible={godViewVisible}
        onClose={() => setGodViewVisible(false)}
      />
    </View>
  );
};

export default function App() {
  // Kick off font load in background. Never block rendering — if the load
  // stalls, the app would be permanently blank. Icons self-load in componentDidMount.
  useFonts({
    feather: Platform.OS === 'web'
      ? 'https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.1.0/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'
      : require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'),
  });

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <IdentityProvider>
              <TutorialProvider>
                <ToastProvider>
                  <ErrorBoundary>
                    <MainNavigator />
                  </ErrorBoundary>
                </ToastProvider>
              </TutorialProvider>
            </IdentityProvider>
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

  offlineBanner: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  offlineText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
