import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { MemberDetailScreen } from '../screens/main/MemberDetailScreen';
import { MembersScreen } from '../screens/main/MembersScreen';
import type { MembersStackParamList } from './types';

const Stack = createNativeStackNavigator<MembersStackParamList>();

export const MembersStackNavigator: React.FC = () => (
  <Stack.Navigator>
    <Stack.Screen name="MembersList" options={{ title: 'Members' }}>
      {() => <MembersScreen />}
    </Stack.Screen>
    <Stack.Screen name="MemberDetail" options={{ title: 'Member' }}>
      {() => <MemberDetailScreen />}
    </Stack.Screen>
  </Stack.Navigator>
);
