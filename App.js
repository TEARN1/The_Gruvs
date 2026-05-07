import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text,
  SafeAreaView, StatusBar, Animated, Platform, useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ToastProvider } from './src/components/ToastNotification';
import { LandingPage } from './src/screens/LandingPage';
import { ExplorePage } from './src/screens/ExplorePage';
import { ProfilePage } from './src/screens/ProfilePage';
import { CalendarPage } from './src/screens/CalendarPage';
import { AuthModal } from './src/components/AuthModal';
import { BrandLogo } from './src/components/BrandLogo';

const TABS = [
  { key: 'feed',     label: 'The Drop', icon: 'home'     },
  { key: 'explore',  label: 'Explore',  icon: 'compass'  },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'profile',  label: 'Profile',  icon: 'user'     },
];

const WIDE_BREAKPOINT      = 900;
const SIDEBAR_OPEN_WIDTH   = 220;
const SIDEBAR_CLOSED_WIDTH = 56;

// ── Bottom Tab Bar (narrow screens) ──────────────────────────────────────────
const TabBar = ({ currentTab, onTabChange, primary, muted }) => {
  const { width } = useWindowDimensions();
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const tabWidth = width / TABS.length;

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
    <View style={[styles.tabBar, { borderTopColor: `${primary}25` }]}>
      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: `${primary}28`, transform: [{ translateX: indicatorAnim }] },
        ]}
      />
      {TABS.map(tab => {
        const isActive = currentTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.75}
          >
            <Feather name={tab.icon} size={22} color={isActive ? primary : `${muted}`} style={{ opacity: isActive ? 1 : 0.5 }} />
            <Text style={[styles.tabLabel, { color: isActive ? primary : muted }]}>{tab.label}</Text>
            {isActive && <View style={[styles.tabDot, { backgroundColor: primary }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ── Left Sidebar (wide screens) ───────────────────────────────────────────────
const SidebarNav = ({ currentTab, onTabChange, primary, muted, bg, isOpen, onToggle }) => (
  <View style={[
    sb.root,
    {
      width: isOpen ? SIDEBAR_OPEN_WIDTH : SIDEBAR_CLOSED_WIDTH,
      backgroundColor: bg,
      borderRightColor: `${primary}15`,
    },
    Platform.OS === 'web' && { transition: 'width 0.2s ease' },
  ]}>
    {/* Logo */}
    <View style={[sb.logoRow, { justifyContent: isOpen ? 'flex-start' : 'center' }]}>
      <BrandLogo size={24} showGlow={isOpen} />
      {isOpen && (
        <View style={{ marginLeft: 10 }}>
          <Text style={[sb.logoName, { color: primary }]}>THE GRUVS</Text>
          <Text style={[sb.logoSub, { color: muted }]}>Royal Edition</Text>
        </View>
      )}
    </View>

    <View style={[sb.divider, { backgroundColor: `${primary}15` }]} />

    {/* Nav items */}
    <View style={sb.nav}>
      {TABS.map(tab => {
        const isActive = currentTab === tab.key;
        return (
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

    {/* Toggle button */}
    <TouchableOpacity
      style={[sb.toggleBtn, { justifyContent: isOpen ? 'flex-start' : 'center' }]}
      onPress={onToggle}
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
  logoSub:  { fontSize: 8,  fontWeight: '700', letterSpacing: 1,   marginTop: 2, opacity: 0.6 },
  divider:  { height: 1, marginHorizontal: 14, marginBottom: 8 },
  nav:      { flex: 1 },
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
  const { currentTheme } = useTheme();
  const { width } = useWindowDimensions();
  const [currentTab, setCurrentTab] = useState('feed');
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [targetEvent, setTargetEvent] = useState(null);

  const isWide = width >= WIDE_BREAKPOINT;

  const bg      = currentTheme?.background || '#0d1112';
  const primary = currentTheme?.primary    || '#00f2ff';
  const muted   = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const isDark  = !bg.startsWith('#f') && !bg.startsWith('#e');

  const IS_DEMO_MODE = !process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL.includes('your-project-id');

  const handleTabChange = (tab) => {
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

  const renderScreen = () => {
    switch (currentTab) {
      case 'feed':
        return (
          <LandingPage
            mode="drop"
            onAuthRequired={handleAuthRequired}
            targetEvent={targetEvent}
            onTargetHandled={() => setTargetEvent(null)}
            refreshKey={feedRefreshKey}
          />
        );
      case 'explore':
        return (
          <ExplorePage
            onAuthRequired={handleAuthRequired}
            onNavigateToEvent={handleNavigateToEvent}
          />
        );
      case 'calendar':
        return <CalendarPage onAuthRequired={handleAuthRequired} onNavigateToEvent={handleNavigateToEvent} />;
      case 'profile':
        return <ProfilePage onAuthRequired={handleAuthRequired} />;
      default:
        return (
          <LandingPage
            mode="drop"
            onAuthRequired={handleAuthRequired}
            targetEvent={targetEvent}
            onTargetHandled={() => setTargetEvent(null)}
            refreshKey={feedRefreshKey}
          />
        );
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={bg}
        translucent={false}
      />

      {IS_DEMO_MODE && (
        <View style={[styles.offlineBanner, { backgroundColor: primary }]}>
          <Feather name="wifi-off" size={12} color="#000" />
          <Text style={styles.offlineText}>DEMO MODE: SUPABASE NOT CONNECTED</Text>
        </View>
      )}

      <SafeAreaView style={styles.safeArea}>
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
            />
            <View style={styles.wideContent}>
              {renderScreen()}
            </View>
          </View>
        ) : (
          // ── Narrow screen: bottom tab bar ──────────────────────────────
          <View style={styles.narrowLayout}>
            <View style={styles.content}>
              {renderScreen()}
            </View>
            <TabBar
              currentTab={currentTab}
              onTabChange={handleTabChange}
              primary={primary}
              muted={muted}
            />
          </View>
        )}
      </SafeAreaView>

      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
      />
    </View>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <MainNavigator />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, ...(Platform.OS === 'web' && { minHeight: '100vh' }) },
  safeArea: { flex: 1 },

  // Wide layout
  wideLayout:  { flex: 1, flexDirection: 'row' },
  wideContent: { flex: 1, overflow: 'hidden' },

  // Narrow layout
  narrowLayout: { flex: 1 },
  content:      { flex: 1 },

  // Bottom tab bar
  tabBar: {
    flexDirection: 'row',
    height: 68,
    borderTopWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    position: 'relative',
    paddingBottom: 6,
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
  tabDot:   { width: 4, height: 4, borderRadius: 2, marginTop: 1 },

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
