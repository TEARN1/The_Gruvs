import React from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import FeedScreen from '../screens/feed/FeedScreen';
import VendorNetworkScreen from '../screens/business/VendorNetworkScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SQLScreen from '../screens/database/SQLScreen';
import { ACCENT, THEME } from '../theme';
import { useStore } from '../state/useStore';
import { TouchableOpacity } from 'react-native';

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
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="briefcase-outline" size={24} color={color} />,
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
        name="SQL" 
        component={SQLScreen} 
        options={{
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="database" size={24} color={color} />,
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
