/**
 * MainNavigator.js — Primary Application Shell & Tab Router.
 *
 * Manages screen keep-alive hosting, cross-fade transitions, responsive wide/narrow layouts,
 * native/web deep linking, accessibility skip-links, and global modal overlays.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  StatusBar,
  Animated,
  Platform,
  useWindowDimensions,
  BackHandler,
  ActivityIndicator,
  Linking,
  PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastNotification';
import { useWebAppUpdate, reloadForUpdate } from '../hooks/useWebAppUpdate';
import { NotificationsScreen, useUnreadCount } from '../screens/NotificationsScreen';
import { ChatsScreen, useUnreadDMCount } from '../screens/ChatsScreen';
import { LandingPage } from '../screens/LandingPage';
import {
  ProfilePage,
  CalendarPage,
  ExplorePage,
  ReelsScreen,
  GodViewDashboard,
  MapScreen,
} from '../screens/lazyScreens';
import { useTutorial } from '../context/TutorialContext';
import { TutorialOverlay } from '../components/TutorialOverlay';
import { ResetPasswordModal } from '../components/ResetPasswordModal';
import { AuthModal } from '../components/AuthModal';
import { BusinessDashboardScreen } from '../screens/BusinessDashboardScreen';
import { ViberProfileModal } from '../components/ViberProfileModal';
import { OfflineBanner } from '../components/OfflineBanner';
import { InstallAppBanner } from '../components/InstallAppBanner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SecurityService } from '../services/securityService';
import { VibeEconomyEngine } from '../services/revenueEngine';
import { supabase } from '../services/supabase';
import { prewarmSections } from '../services/prewarm';
import { backStack } from '../utils/backStack';
import { feature } from '../constants/launchConfig';
import { appInstallService } from '../services/appInstallService';
import { useNotifications } from '../hooks/useNotifications';

import { ALL_TABS, TABS, WIDE_BREAKPOINT, getTabLabel } from './navigationConfig';
import { TabBar } from './TabBar';
import { SidebarNav } from './SidebarNav';

const ScreenSkeleton = ({ active }) =>
  active ? (
    <View style={styles.screenSkeleton}>
      <ActivityIndicator size="small" />
    </View>
  ) : null;

export const MainNavigator = () => {
  const { currentTheme, applyNeuralTheme } = useTheme();
  const { user: authUser, recoveryMode, endRecovery } = useAuth();
  const { width } = useWindowDimensions();
  const { show: showToast } = useToast();
  const updateReady = useWebAppUpdate();
  const unreadCount = useUnreadCount();
  const unreadDMCount = useUnreadDMCount(() => {
    if (currentTab !== 'chats') showToast('💬 New message in Linked Up', 'info');
  });
  const { hasLaunched, openTutorial, markLaunched, activeTutorial } = useTutorial();

  const [currentTab, setCurrentTab] = useState('feed');
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [godViewVisible, setGodViewVisible] = useState(false);
  const [bizHubVisible, setBizHubVisible] = useState(false);
  const [hasBusiness, setHasBusiness] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!authUser?.id) {
      setHasBusiness(false);
      return;
    }
    supabase
      .from('business_profiles')
      .select('id')
      .eq('user_id', authUser.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setHasBusiness(!!data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [authUser?.id]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [targetEvent, setTargetEvent] = useState(null);
  const [targetProfile, setTargetProfile] = useState(null);
  const [targetReel, setTargetReel] = useState(null);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const backPressCount = useRef(0);
  const backPressTimer = useRef(null);
  const lastHapticRef = useRef(0);

  // Warm caches for other sections on launch
  useEffect(() => {
    prewarmSections({ userId: authUser?.id || null });
  }, [authUser?.id]);

  const handleTabChange = useCallback(
    (tab) => {
      if (Platform.OS !== 'web') {
        const now = Date.now();
        if (now - lastHapticRef.current > 300) {
          lastHapticRef.current = now;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      }

      if (tab === currentTab && tab === 'feed') {
        setFeedRefreshKey((k) => k + 1);
      } else {
        setCurrentTab(tab);
        screenOpacity.setValue(0.25);
        Animated.timing(screenOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      }
    },
    [currentTab, screenOpacity]
  );

  const isWide = width >= WIDE_BREAKPOINT;

  // Swipe between tabs on mobile touch devices
  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;
  const tabSwipe = useMemo(() => {
    const order = TABS.map((t) => t.key);
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => {
        if (Platform.OS === 'web') return false;
        if (currentTabRef.current === 'reels') return false;
        return Math.abs(g.dx) > 36 && Math.abs(g.dx) > Math.abs(g.dy) * 2.2;
      },
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dx) < Math.abs(g.dy)) return;
        if (Math.abs(g.dx) < 55 && Math.abs(g.vx) < 0.3) return;
        const i = order.indexOf(currentTabRef.current);
        if (i === -1) return;
        const ni = i + (g.dx > 0 ? -1 : 1);
        if (ni < 0 || ni >= order.length) return;
        handleTabChange(order[ni]);
      },
    });
  }, [handleTabChange]);

  // Android hardware back button handling
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = () => {
      if (backStack.pop()) return true;
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
      backPressTimer.current = setTimeout(() => {
        backPressCount.current = 0;
      }, 2000);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => {
      sub.remove();
      clearTimeout(backPressTimer.current);
    };
  }, [currentTab, godViewVisible, bizHubVisible, authModalVisible, targetProfile, targetEvent, handleTabChange]);

  // Web browser history navigation trapping
  const webBackRef = useRef(() => false);
  webBackRef.current = () => {
    if (backStack.pop()) return true;
    if (godViewVisible) {
      setGodViewVisible(false);
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
    return false;
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    let exiting = false;
    window.history.pushState({ gruvs: 'root' }, '');
    const onPop = () => {
      if (exiting) return;
      if (webBackRef.current()) {
        window.history.pushState({ gruvs: 1 }, '');
      } else {
        exiting = true;
        window.history.back();
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

  // Deep-linking route handler
  useEffect(() => {
    const parseAndRouteUrl = (url) => {
      if (!url) return;
      try {
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

    Linking.getInitialURL()
      .then((url) => {
        if (url) parseAndRouteUrl(url);
      })
      .catch(() => {});

    const sub = Linking.addEventListener('url', (event) => {
      if (event.url) parseAndRouteUrl(event.url);
    });

    if (Platform.OS === 'web') {
      try {
        const params = new URLSearchParams(window.location.search);
        const eventId = params.get('event');
        const profileId = params.get('profile');
        const reelId = params.get('reel');
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
  }, []);

  // Neural theme glow & background digest / presence
  const applyNeuralThemeRef = useRef(applyNeuralTheme);
  applyNeuralThemeRef.current = applyNeuralTheme;
  useEffect(() => {
    let cancelled = false;
    const timers = [];
    const checkStatus = async () => {
      if (!authUser) return;
      const status = await VibeEconomyEngine.getSovereignStatus(authUser.id);
      if (cancelled) return;
      if (status.isRoyal) {
        const glowIntensity = Math.min(1, status.equity / VibeEconomyEngine.ROYAL_THRESHOLD);
        applyNeuralThemeRef.current({ glowIntensity: glowIntensity * 0.5 });
      }
    };

    checkStatus();

    if (authUser) {
      timers.push(
        setTimeout(() => {
          import('../services/missedEventsDigest')
            .then((m) => m.maybeSendMissedDigest(authUser))
            .catch(() => {});
        }, 4000)
      );

      timers.push(
        setTimeout(async () => {
          try {
            const Location = await import('expo-location');
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const { LocationService } = await import('../services/locationService');
            const coords = await LocationService.requestAndGet();
            if (coords?.lat != null && coords?.lon != null) {
              LocationService.saveToProfile(authUser.id, coords.lat, coords.lon);
            }
          } catch {}
        }, 6000)
      );
    }

    SecurityService.validateSession().then((isValid) => {
      if (!isValid) {
        supabase.auth.signOut().catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [authUser]);

  // First-launch welcome tutorial
  useEffect(() => {
    if (!hasLaunched) {
      const timer = setTimeout(() => {
        openTutorial('welcome');
        markLaunched();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [hasLaunched, openTutorial, markLaunched]);

  const bg = currentTheme?.background || '#0d1112';
  const primary = currentTheme?.primary || '#00f2ff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const isDark = !bg.startsWith('#f') && !bg.startsWith('#e');

  // Desktop numeric hotkeys 1-7
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e) => {
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= TABS.length && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target?.tagName;
        if (target === 'INPUT' || target === 'TEXTAREA') return;
        if (authModalVisible || godViewVisible || !!targetProfile) return;
        handleTabChange(TABS[idx - 1].key);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleTabChange, authModalVisible, godViewVisible, targetProfile]);

  // Sync document title on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const tabLabel = getTabLabel(currentTab);
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

  // Keep-alive screen management with lazy first-mount
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([currentTab]));
  useEffect(() => {
    setVisitedTabs((prev) => (prev.has(currentTab) ? prev : new Set(prev).add(currentTab)));
  }, [currentTab]);

  // Progressive background idle prefetch
  useEffect(() => {
    const guestOk = ['explore'];
    const authOnly = ['notifications', 'chats', 'profile'];
    const queue = [...guestOk, ...(authUser ? authOnly : [])];

    const warm = (tab) => setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
    const idle =
      typeof globalThis.requestIdleCallback === 'function'
        ? (cb) => globalThis.requestIdleCallback(cb, { timeout: 10000 })
        : (cb) => setTimeout(cb, 0);

    const timers = queue.map((tab, i) =>
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
            onNavigateToMap={(ev) => {
              if (ev) setTargetEvent(ev);
              handleTabChange('map');
            }}
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
        return (
          <MapScreen
            onAuthRequired={handleAuthRequired}
            onNavigateToEvent={handleNavigateToEvent}
            initialEvent={targetEvent}
            onInitialEventHandled={() => setTargetEvent(null)}
          />
        );
      case 'calendar':
        return <CalendarPage onAuthRequired={handleAuthRequired} onNavigateToEvent={handleNavigateToEvent} />;
      case 'chats':
        return <ChatsScreen onAuthRequired={handleAuthRequired} />;
      case 'notifications':
        return <NotificationsScreen onAuthRequired={handleAuthRequired} onNavigateToEvent={handleNavigateToEvent} />;
      case 'profile':
        return (
          <ProfilePage
            onAuthRequired={handleAuthRequired}
            onNavigateToEvent={handleNavigateToEvent}
            onNavigateToTab={handleTabChange}
          />
        );
      default:
        return null;
    }
  };

  const renderScreen = () => (
    <View style={styles.screenHost}>
      {ALL_TABS.map((tab) => {
        const isVisited = visitedTabs.has(tab.key);
        if (!isVisited) return null;
        const isActive = currentTab === tab.key;
        return (
          <View
            key={tab.key}
            style={isActive ? styles.screenActive : styles.screenHidden}
            dataSet={{ screen: tab.key, active: isActive ? 'true' : 'false' }}
          >
            <ErrorBoundary label={tab.label}>
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
          style={[styles.updateBanner, { backgroundColor: primary }]}
        >
          <Feather name="download" size={13} color="#000" />
          <Text style={styles.updateBannerText}>New version available — tap to refresh</Text>
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

      {recoveryMode && (
        <ErrorBoundary label="Password reset">
          <ResetPasswordModal visible onDone={endRecovery} />
        </ErrorBoundary>
      )}

      {/* Screen reader ARIA live region */}
      <View
        accessible
        importantForAccessibility="yes"
        aria-live="polite"
        aria-atomic="true"
        style={styles.srOnly}
      >
        <Text>{getTabLabel(currentTab)}</Text>
      </View>

      {/* Skip-to-content accessibility link */}
      {Platform.OS === 'web' && (
        <TouchableOpacity
          nativeID="skip-to-content"
          accessibilityRole="link"
          accessibilityLabel="Skip to main content"
          onPress={() => {
            const el = document.getElementById('main-content');
            if (el) {
              el.setAttribute('tabindex', '-1');
              el.focus();
            }
          }}
          style={styles.skipLink}
        >
          <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>Skip to content</Text>
        </TouchableOpacity>
      )}

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {isWide ? (
          <View style={styles.wideLayout}>
            <ErrorBoundary label="Navigation" inline>
              <SidebarNav
                currentTab={currentTab}
                onTabChange={handleTabChange}
                primary={primary}
                muted={muted}
                bg={bg}
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen((p) => !p)}
                onGodView={() => setGodViewVisible(true)}
                onBusiness={hasBusiness ? () => setBizHubVisible(true) : undefined}
                onDownloadApp={() => appInstallService.openModal()}
              />
            </ErrorBoundary>
            <Animated.View nativeID="main-content" style={[styles.wideContent, { opacity: screenOpacity }]}>
              {renderScreen()}
            </Animated.View>
          </View>
        ) : (
          <View style={styles.narrowLayout}>
            <Animated.View
              nativeID="main-content"
              style={[styles.content, { opacity: screenOpacity }]}
              {...tabSwipe.panHandlers}
            >
              {renderScreen()}
            </Animated.View>
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

      {/* Overlays & Global Modals */}
      {bizHubVisible && (
        <ErrorBoundary label="Business">
          <BusinessDashboardScreen onClose={() => setBizHubVisible(false)} />
        </ErrorBoundary>
      )}

      <ErrorBoundary label="Sign in">
        <AuthModal
          visible={authModalVisible}
          onClose={() => setAuthModalVisible(false)}
          accessibilityViewIsModal
        />
      </ErrorBoundary>

      {activeTutorial && (
        <ErrorBoundary label="Tutorial">
          <TutorialOverlay />
        </ErrorBoundary>
      )}

      <ErrorBoundary label="Profile">
        <ViberProfileModal
          visible={!!targetProfile}
          userId={targetProfile}
          onClose={() => setTargetProfile(null)}
          onNavigateToEvent={handleNavigateToEvent}
        />
      </ErrorBoundary>

      <ErrorBoundary label="God View" lazyBoundary inline>
        <Suspense fallback={null}>
          <GodViewDashboard visible={godViewVisible} onClose={() => setGodViewVisible(false)} />
        </Suspense>
      </ErrorBoundary>
    </View>
  );
};

export default MainNavigator;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...(Platform.OS === 'web' && { minHeight: '100dvh', overflowX: 'hidden' }),
  },
  safeArea: { flex: 1 },
  wideLayout: { flex: 1, flexDirection: 'row' },
  wideContent: { flex: 1, overflow: 'hidden' },
  narrowLayout: { flex: 1 },
  content: { flex: 1 },
  screenHost: { flex: 1 },
  screenActive: { ...StyleSheet.absoluteFillObject },
  screenHidden: { display: 'none' },
  screenSkeleton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  updateBannerText: { color: '#000', fontWeight: '900', fontSize: 12 },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
  },
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
});
