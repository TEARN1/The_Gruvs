import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStore } from '../state/useStore';

// Screens
import LandingScreen from '../screens/auth/LandingScreen';
import { AuthScreen } from '../screens';
import TabNavigator from './TabNavigator';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const user = useStore((state) => state.user);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Auth Stack
          <Stack.Group screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Auth">
              {(props) => <AuthScreen {...props} onLogin={(form) => useStore.getState().setUser({ id: 'u1', name: form.username || 'User', gender: form.gender || 'other', visitor: false })} onSignup={(form) => useStore.getState().setUser({ id: 'u1', name: form.username || 'User', gender: form.gender || 'other', visitor: false })} />}
            </Stack.Screen>
          </Stack.Group>
        ) : (
          // Main App Stack
          <Stack.Screen name="Main" component={TabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
