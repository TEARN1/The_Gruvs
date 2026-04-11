import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LIGHT_THEME, DARK_THEME, ACCENT, THEME } from '../theme';
import { useStore } from '../state/useStore';

// Screens
import LandingScreen from '../../features/auth/screens/LandingScreen';
import AuthScreen from '../../features/auth/screens/AuthScreen';
import TabNavigator from './TabNavigator';

// Core Application Screens
import ExploreScreen from '../../features/social/screens/discover/ExploreScreen';
import EventDetailScreen from '../../features/feed/screens/EventDetailScreen';
import MessagesScreen from '../../features/social/screens/MessagesScreen';
import LeaderboardScreen from '../../features/social/screens/LeaderboardScreen';
import DropsScreen from '../../features/social/screens/DropsScreen';
import HappeningsScreen from '../../features/social/screens/HappeningsScreen';
import WalletScreen from '../../features/social/screens/WalletScreen';
import CommunityScreen from '../../features/social/screens/CommunityScreen';
import VendorNetworkScreen from '../../features/business/screens/VendorNetworkScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const user = useStore((state) => state.user);
  const themeMode = useStore((state) => state.themeMode);
  const theme = themeMode === 'dark' ? DARK_THEME : LIGHT_THEME;
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    console.log('[NAV] Initializing...');
    console.log('[NAV] Current user:', user);
    setIsReady(true);
  }, [user]);

  if (!isReady) {
    const splashTheme = themeMode === 'dark' ? DARK_THEME : LIGHT_THEME;
    return (
      <View style={{ flex: 1, backgroundColor: splashTheme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={{ color: splashTheme.text, marginTop: 16, fontWeight: '700' }}>Loading...</Text>
      </View>
    );
  }

  const MyTheme = {
    dark: themeMode === 'dark',
    colors: {
      primary: ACCENT,
      background: theme.bg,
      card: theme.card,
      text: theme.text,
      border: theme.cardBorder,
      notification: ACCENT,
    },
  };

  return (
    <NavigationContainer
      theme={MyTheme}
      onReady={() => console.log('[NAV] Ready')}
    >
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          animation: 'fade_from_bottom'
        }}
        initialRouteName={user ? 'Main' : 'Landing'}
      >
        {!user ? (
          // Auth Stack
          <Stack.Group screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Auth" component={AuthScreen} />
          </Stack.Group>
        ) : (
          // Main App Stack (Authenticated)
          <Stack.Group>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="Explore" component={ExploreScreen} />
            <Stack.Screen name="EventDetails" component={EventDetailScreen} />
            <Stack.Screen name="Messages" component={MessagesScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="Drops" component={DropsScreen} />
            <Stack.Screen name="Happenings" component={HappeningsScreen} />
            <Stack.Screen name="Vault" component={WalletScreen} />
            <Stack.Screen name="Community" component={CommunityScreen} />
            <Stack.Screen name="Network" component={VendorNetworkScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
