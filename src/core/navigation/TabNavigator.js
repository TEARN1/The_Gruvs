import React from 'react';
import { View, Platform, useWindowDimensions, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { ACCENT, LIGHT_THEME, DARK_THEME } from '../theme';
import { useStore } from '../state/useStore';
import VendorNetworkScreen from '../../features/business/screens/VendorNetworkScreen';

// Screens
import FeedScreen from '../../features/feed/screens/FeedScreen';
import ProfileScreen from '../../features/social/screens/profile/ProfileScreen';
import MessagesScreen from '../../features/social/screens/MessagesScreen';
import WalletScreen from '../../features/social/screens/WalletScreen';

const Tab = createBottomTabNavigator();

const EmptyScreen = () => null;

export default function TabNavigator() {
  const { width } = useWindowDimensions();
  const themeMode = useStore((state) => state.themeMode);
  const theme = themeMode === 'dark' ? DARK_THEME : LIGHT_THEME;
  const isPC = Platform.OS === 'web' && width > 768;

  return (
    <Tab.Navigator
      initialRouteName="Pulse"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: isPC ? 'none' : 'flex',
          backgroundColor: theme.card,
          borderTopWidth: 1,
          borderTopColor: theme.cardBorder,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 90 : 70,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
          ...Platform.select({
            web: {
              boxShadow: themeMode === 'light' ? '0 -4px 15px rgba(0,0,0,0.03)' : '0 -4px 15px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(10px)',
              backgroundColor: themeMode === 'light' ? 'rgba(253, 252, 254, 0.95)' : 'rgba(5, 5, 16, 0.95)'
            },
            default: {
              shadowColor: '#000',
              shadowOpacity: themeMode === 'light' ? 0.03 : 0.4,
              shadowRadius: 10
            }
          })
        },
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: theme.textDim,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen 
        name="Network"
        component={VendorNetworkScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={focused && styles.activeTabIndicator}>
              <Feather name="briefcase" size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen 
        name="Pulse" 
        component={FeedScreen} 
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={focused && styles.activeTabIndicator}>
              <MaterialCommunityIcons name="pulse" size={26} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen 
        name="Add" 
        component={EmptyScreen}
        options={({ navigation }) => ({
          tabBarButton: () => (
            <TouchableOpacity 
              style={styles.addButtonContainer}
              onPress={() => {
                const user = useStore.getState().user;
                if (!user || user.isVisitor) {
                  navigation.navigate('Auth');
                  return;
                }
                useStore.getState().setAddEventModalVisible(true);
              }}
            >
              <View style={styles.addButton}>
                <Feather name="plus" size={28} color="#fff" />
              </View>
            </TouchableOpacity>
          )
        })}
      />
      <Tab.Screen
        name="Vault"
        component={WalletScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={focused && styles.activeTabIndicator}>
              <Ionicons name="wallet-outline" size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile" 
        component={ProfileScreen} 
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={focused && styles.activeTabIndicator}>
              <Feather name="user" size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  activeTabIndicator: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 77, 166, 0.1)',
  },
  addButtonContainer: {
    top: -15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    ...Platform.select({
      web: { boxShadow: `0 8px 16px ${ACCENT}66` },
      default: { shadowColor: ACCENT, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 }
    })
  }
});
