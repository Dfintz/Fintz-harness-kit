import { Ionicons } from '@expo/vector-icons';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';
import React from 'react';
import { Platform } from 'react-native';
import { NotificationsScreen } from '../screens/main/NotificationsScreen';
import { Colors } from '../utils/theme';
import { FleetStackNavigator } from './FleetStackNavigator';
import { MembersStackNavigator } from './MembersStackNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICON: Record<keyof MainTabParamList, { focused: string; default: string }> = {
  FleetTab: { focused: 'rocket', default: 'rocket-outline' },
  MembersTab: { focused: 'people', default: 'people-outline' },
  Notifications: { focused: 'notifications', default: 'notifications-outline' },
  ProfileTab: { focused: 'person', default: 'person-outline' },
};

export const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({
        route,
      }: {
        route: RouteProp<MainTabParamList, keyof MainTabParamList>;
      }): BottomTabNavigationOptions => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICON[route.name];
          const iconName = focused ? icons.focused : icons.default;
          return <Ionicons name={iconName as never} size={size} color={color} />;
        },
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="FleetTab" options={{ tabBarLabel: 'Fleet' }}>
        {() => <FleetStackNavigator />}
      </Tab.Screen>
      <Tab.Screen name="MembersTab" options={{ tabBarLabel: 'Members' }}>
        {() => <MembersStackNavigator />}
      </Tab.Screen>
      <Tab.Screen name="Notifications" options={{ headerShown: true, tabBarLabel: 'Alerts' }}>
        {() => <NotificationsScreen />}
      </Tab.Screen>
      <Tab.Screen name="ProfileTab" options={{ tabBarLabel: 'Profile' }}>
        {() => <ProfileStackNavigator />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};
