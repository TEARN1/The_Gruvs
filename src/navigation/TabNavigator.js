import React from 'react';
import { View, Platform, useWindowDimensions, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ACCENT, THEME } from '../theme';
import { useStore } from '../state/useStore';
import { TouchableOpacity } from 'react-native';

let FeedScreen, VendorNetworkScreen, ProfileScreen;
let feedError = null;

try {
  FeedScreen = require('../screens/feed/FeedScreen').default;
} catch (e) {
  feedError = e;
  FeedScreen = () => (
    <View style={{ flex: 1, backgroundColor: '#050510', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#ff4444' }}>Error loading Feed</Text>
      <Text style={{ color: '#fff', fontSize: 12 }}>{e.message}</Text>
    </View>
  );
}

try {
  VendorNetworkScreen = require('../screens/business/VendorNetworkScreen').default;
} catch (e) {
  VendorNetworkScreen = () => (
    <View style={{ flex: 1, backgroundColor: '#050510', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#ff4444' }}>Error loading Network</Text>
    </View>
  );
}

try {
  ProfileScreen = require('../screens/profile/ProfileScreen').default;
} catch (e) {
  ProfileScreen = () => (
    <View style={{ flex: 1, backgroundColor: '#050510', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#ff4444' }}>Error loading Profile</Text>
    </View>
  );
}

const Tab = createBottomTabNavigator();

// A dummy component for the 'Add Event' button so it doesn't navigate, handled cleanly via modals usually.
const EmptyScreen = () => null;

export default function TabNavigator() {
  const { width } = useWindowDimensions();
  const isPC = Platform.OS === 'web' && width > 768;

  // We hide bottom tabs on PC since Desktop sidebar handles navigation there.
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: isPC ? 'none' : 'flex',
          backgroundColor: THEME.navBg,
          borderTopWidth: 1,
          borderTopColor: '#1a1a3e',
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 90 : 70,
        },
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: THEME.sub,
      }}
    >
      <Tab.Screen 
        name="Pulse" 
        component={FeedScreen} 
        options={{
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="pulse" size={26} color={color} />,
        }}
      />
      <Tab.Screen 
        name="Network" 
        component={VendorNetworkScreen} 
        options={{
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="briefcase-outline"size={24} color={color} />,
        }}
      />
      <Tab.Screen 
        name="Add" 
        component={EmptyScreen}
        options={{
          tabBarButton: () => (
            <TouchableOpacity 
              style={{ top: -15, justifyContent: 'center', alignItems: 'center' }}
              onPress={() => useStore.getState().setAddEventModalVisible(true)}
            >
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', shadowColor: ACCENT, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 }}>
                <Feather name="plus" size={26} color="#fff" />
              </View>
            </TouchableOpacity>
          )
        }}
      />

      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
          tabBarIcon: ({ color }) => <Feather name="user" size={24} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
