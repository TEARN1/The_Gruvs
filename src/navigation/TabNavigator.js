import React from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import FeedScreen from '../screens/feed/FeedScreen';
import VendorNetworkScreen from '../screens/business/VendorNetworkScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import { ACCENT, THEME } from '../theme';

const Tab = createBottomTabNavigator();

// A dummy component for the 'Add Event' button so it doesn't navigate, handled cleanly via modals usually.
// For now, mapping it to feed is safe since the actual add action is inside FeedScreen for now.
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
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="briefcase-outline" size={24} color={color} />,
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
