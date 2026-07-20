import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../utils/theme';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Navigation theme matching the Fringe Core dark brand */
const fringeCoreTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.border,
    notification: Colors.error,
  },
};

export const RootNavigator: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <NavigationContainer theme={fringeCoreTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main">{() => <MainNavigator />}</Stack.Screen>
        ) : (
          <Stack.Screen name="Auth">{() => <AuthNavigator />}</Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
