import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStore } from '../state/useStore';

// Screens
import LandingScreen from '../screens/auth/LandingScreen';
import AuthScreen from '../screens/auth/AuthScreen';
import TabNavigator from './TabNavigator';

// Additional Shared Screens
import ExploreScreen from '../screens/discover/ExploreScreen';
import EventDetailScreen from '../screens/feed/EventDetailScreen';
import MessagesScreen from '../screens/social/MessagesScreen';
import LeaderboardScreen from '../screens/social/LeaderboardScreen';
import DropsScreen from '../screens/social/DropsScreen';
import HappeningsScreen from '../screens/social/HappeningsScreen';
import WalletScreen from '../screens/social/WalletScreen';
import CommunityScreen from '../screens/social/CommunityScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const user = useStore((state) => state.user);
  const [initError, setInitError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    console.log('[NAV] Initializing...');
    setIsReady(true);
  }, []);

  if (initError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050510', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#ff4da6', marginBottom: 10, fontSize: 16 }}>Navigation Error</Text>
        <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', paddingHorizontal: 20 }}>{initError}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050510', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ff4da6" />
      </View>
    );
  }

  return (
    <NavigationContainer
      onReady={() => console.log('[NAV] Ready')}
      onError={(error) => {
        console.error('[NAV ERROR]', error);
        setInitError(error.message || 'Navigation error occurred');
      }}
    >
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          animationEnabled: true
        }}
        initialRouteName={user ? 'Main' : 'Landing'}
      >
        {!user ? (
          // Auth Stack
          <Stack.Group screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Landing" component={LandingScreen} options={{ animationEnabled: false }} />
            <Stack.Screen name="Auth" component={AuthScreen} />
          </Stack.Group>
        ) : (
          // Main App Stack (Authenticated)
          <Stack.Group>
            <Stack.Screen name="Main" component={TabNavigator} options={{ animationEnabled: false }} />
            <Stack.Screen name="Explore" component={ExploreScreen} />
            <Stack.Screen name="EventDetails" component={EventDetailScreen} />
            <Stack.Screen name="Messages" component={MessagesScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="Drops" component={DropsScreen} />
            <Stack.Screen name="Happenings" component={HappeningsScreen} />
            <Stack.Screen name="Wallet" component={WalletScreen} />
            <Stack.Screen name="Community" component={CommunityScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
