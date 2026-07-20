import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { FleetDetailScreen } from '../screens/main/FleetDetailScreen';
import { FleetOverviewScreen } from '../screens/main/FleetOverviewScreen';
import { ShipDetailScreen } from '../screens/main/ShipDetailScreen';
import type { FleetStackParamList } from './types';

const Stack = createNativeStackNavigator<FleetStackParamList>();

export const FleetStackNavigator: React.FC = () => (
  <Stack.Navigator>
    <Stack.Screen name="FleetOverview" options={{ title: 'Fleet' }}>
      {() => <FleetOverviewScreen />}
    </Stack.Screen>
    <Stack.Screen name="FleetDetail" options={{ title: 'Fleet Detail' }}>
      {() => <FleetDetailScreen />}
    </Stack.Screen>
    <Stack.Screen name="ShipDetail" options={{ title: 'Ship Detail' }}>
      {() => <ShipDetailScreen />}
    </Stack.Screen>
  </Stack.Navigator>
);
