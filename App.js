import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text,
  SafeAreaView, StatusBar, Animated, Dimensions, Platform,
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

const { width } = Dimensions.get('window');

const TABS = [
  { key: 'feed',     label: 'The Drop', icon: 'home'     },
  { key: 'explore',  label: 'Explore',  icon: 'compass'  },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'profile',  label: 'Profile',  icon: 'user'     },
];

const TabBar = ({ currentTab, onTabChange, primary, muted }) => {
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

const MainNavigator = () => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState('feed');
  const [authModalVisible, setAuthModalVisible] = useState(false);

  const bg      = currentTheme?.background || '#0d1112';
  const primary = currentTheme?.primary    || '#00f2ff';
  const muted   = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';
  const isDark  = !bg.startsWith('#f') && !bg.startsWith('#e');

  const IS_DEMO_MODE = !process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL.includes('your-project-id');
  const handleAuthRequired = () => setAuthModalVisible(true);

  const renderScreen = () => {
    switch (currentTab) {
      case 'feed':
        return <LandingPage mode="drop" onAuthRequired={handleAuthRequired} />;
      case 'explore':
        return <ExplorePage onAuthRequired={handleAuthRequired} />;
      case 'calendar':
        return <CalendarPage onAuthRequired={handleAuthRequired} />;
      case 'profile':
        return <ProfilePage onAuthRequired={handleAuthRequired} />;
      default:
        return <LandingPage mode="drop" onAuthRequired={handleAuthRequired} />;
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
        <View style={styles.content}>
          {renderScreen()}
        </View>
        <TabBar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          primary={primary}
          muted={muted}
        />
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
  content: { flex: 1 },
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
  tabDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },

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
