import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  FleetTab: undefined;
  MembersTab: undefined;
  Notifications: undefined;
  ProfileTab: undefined;
};

export type FleetStackParamList = {
  FleetOverview: undefined;
  FleetDetail: { fleetId: string };
  ShipDetail: { shipId: string };
};

export type MembersStackParamList = {
  MembersList: undefined;
  MemberDetail: { userId: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<
  MainTabParamList,
  T
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
