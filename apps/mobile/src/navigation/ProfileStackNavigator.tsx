import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import type { ProfileStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileStackNavigator: React.FC = () => (
  <Stack.Navigator>
    <Stack.Screen name="Profile" options={{ title: 'Profile' }}>
      {() => <ProfileScreen />}
    </Stack.Screen>
    <Stack.Screen name="Settings" options={{ title: 'Settings' }}>
      {() => <SettingsScreen />}
    </Stack.Screen>
  </Stack.Navigator>
);
