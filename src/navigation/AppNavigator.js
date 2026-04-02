import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStore } from '../state/useStore';

// Screens - with try-catch error handling
import LandingScreen from '../screens/auth/LandingScreen';
import AuthScreen from '../screens/auth/AuthScreen';
import TabNavigator from './TabNavigator';

// Additional Shared Screens - lazy load with error handling
let ExploreScreen, EventDetailScreen, MessagesScreen, LeaderboardScreen, DropsScreen, HappeningsScreen, WalletScreen, CommunityScreen;

try { ExploreScreen = require('../screens/discover/ExploreScreen').default; } catch (e) { console.error('Error loading ExploreScreen:', e); }
try { EventDetailScreen = require('../screens/feed/EventDetailScreen').default; } catch (e) { console.error('Error loading EventDetailScreen:', e); }
try { MessagesScreen = require('../screens/social/MessagesScreen').default; } catch (e) { console.error('Error loading MessagesScreen:', e); }
try { LeaderboardScreen = require('../screens/social/LeaderboardScreen').default; } catch (e) { console.error('Error loading LeaderboardScreen:', e); }
try { DropsScreen = require('../screens/social/DropsScreen').default; } catch (e) { console.error('Error loading DropsScreen:', e); }
try { HappeningsScreen = require('../screens/social/HappeningsScreen').default; } catch (e) { console.error('Error loading HappeningsScreen:', e); }
try { WalletScreen = require('../screens/social/WalletScreen').default; } catch (e) { console.error('Error loading WalletScreen:', e); }
try { CommunityScreen = require('../screens/social/CommunityScreen').default; } catch (e) { console.error('Error loading CommunityScreen:', e); }

const FallbackScreen = ({ name }) => (
  <View style={{ flex: 1, backgroundColor: '#050510', justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ color: '#ff4444' }}>Error loading {name}</Text>
  </View>
);

ExploreScreen = ExploreScreen || (() => <FallbackScreen name="Explore" />);
EventDetailScreen = EventDetailScreen || (() => <FallbackScreen name="EventDetails" />);
MessagesScreen = MessagesScreen || (() => <FallbackScreen name="Messages" />);
LeaderboardScreen = LeaderboardScreen || (() => <FallbackScreen name="Leaderboard" />);
DropsScreen = DropsScreen || (() => <FallbackScreen name="Drops" />);
HappeningsScreen = HappeningsScreen || (() => <FallbackScreen name="Happenings" />);
WalletScreen = WalletScreen || (() => <FallbackScreen name="Wallet" />);
CommunityScreen = CommunityScreen || (() => <FallbackScreen name="Community" />);

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const user = useStore((state) => state.user);
  const [initError, setInitError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    console.log('[NAV] Initializing...');
    console.log('[NAV] Current user:', user);
    setIsReady(true);
  }, [user]);

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
        <Text style={{ color: '#fff', marginTop: 16 }}>Loading...</Text>
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
            {ExploreScreen && <Stack.Screen name="Explore" component={ExploreScreen} />}
            {EventDetailScreen && <Stack.Screen name="EventDetails" component={EventDetailScreen} />}
            {MessagesScreen && <Stack.Screen name="Messages" component={MessagesScreen} />}
            {LeaderboardScreen && <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />}
            {DropsScreen && <Stack.Screen name="Drops" component={DropsScreen} />}
            {HappeningsScreen && <Stack.Screen name="Happenings" component={HappeningsScreen} />}
            {WalletScreen && <Stack.Screen name="Wallet" component={WalletScreen} />}
            {CommunityScreen && <Stack.Screen name="Community" component={CommunityScreen} />}
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
