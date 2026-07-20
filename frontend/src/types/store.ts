/**
 * TypeScript types for Zustand stores
 *
 * NOTE: These types are store-domain-specific and represent aggregations of backend entities
 * for Zustand state management. They do NOT duplicate shared-types definitions.
 *
 * - Core entity types (User, Organization, Fleet, Activity, Ship, etc.) use shared-types
 * - Store-specific aggregations (FleetMember, UserShip, EventParticipant, etc.) are defined here
 * - Union types like EventType/EventStatus are intentionally scoped to store domain
 *   (distinct from ActivityType/ActivityStatus which come from @sc-fleet-manager/shared-types)
 *
 * For activity/event union types from backend, see: @sc-fleet-manager/shared-types activity.ts
 */

// ============================================================================
// Common Types
// ============================================================================

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface ApiState {
  loading: boolean;
  error: ApiError | null;
}

// ============================================================================
// User & Authentication Types
// ============================================================================

export interface User {
  id: string;
  username: string;
  email: string;
  discordId?: string;
  discordUsername?: string;
  avatar?: string;
  organizationId?: string;
  activeOrgId?: string;
  activeOrgName?: string;
  activeOrgLogoUrl?: string;
  role: UserRole;
  orgRole?: string;
  orgPermissions?: string[];
  permissions: Permission[];
  rsiHandle?: string;
  rsiVerified?: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'user' | 'moderator' | 'member' | 'recruit';

export type Permission =
  | 'fleet.view'
  | 'fleet.edit'
  | 'fleet.delete'
  | 'users.view'
  | 'users.edit'
  | 'users.delete'
  | 'org.view'
  | 'org.edit'
  | 'org.manage'
  | 'events.create'
  | 'events.edit'
  | 'events.delete';

export interface AuthState extends ApiState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  expiresAt: number | null;
  /** @internal Guard flag — prevents tryAuthWithCookies from racing a logout */
  _logoutInProgress: boolean;
}

export interface AuthActions {
  login: (token: string, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  checkAuth: () => boolean;
  tryAuthWithCookies: () => Promise<boolean>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: ApiError | null) => void;
  reset: () => void;
}

export type AuthStore = AuthState & AuthActions;

// ============================================================================
// Fleet Types
// ============================================================================

export interface FleetMember {
  id: string;
  userId: string;
  username: string;
  role: string;
  rank?: string;
  joinedAt: string;
  discordId?: string;
  ships: UserShip[];
  status: 'active' | 'inactive' | 'on-leave';
}

export interface Ship {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  size: 'vehicle' | 'snub' | 'small' | 'medium' | 'large' | 'sub_capital' | 'capital';
  role: string;
  crew: number;
  price?: number;
  imageUrl?: string;
  specifications?: Record<string, any>;
}

export interface UserShip {
  id: string;
  userId: string;
  shipId: string;
  ship: Ship;
  quantity: number;
  insurance: 'stock' | 'upgraded' | 'lifetime';
  shared: boolean;
  sharedWith?: ('org' | 'alliance')[];
  notes?: string;
}

export interface FleetState extends ApiState {
  members: FleetMember[];
  totalMembers: number;
  activeMembers: number;
}

export interface FleetActions {
  fetchFleet: () => Promise<void>;
  addMember: (memberId: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  updateMember: (memberId: string, data: Partial<FleetMember>) => Promise<void>;
  clearFleet: () => void;
  clearError: () => void;
}

export type FleetStore = FleetState & FleetActions;

// ============================================================================
// Ships Types
// ============================================================================

export interface ShipsState extends ApiState {
  ships: Ship[];
  userShips: UserShip[];
  filteredShips: Ship[];
  filters: ShipFilters;
  totalShips: number;
}

export interface ShipFilters {
  manufacturer?: string;
  size?: Ship['size'];
  role?: string;
  search?: string;
}

export interface ShipsActions {
  fetchShips: () => Promise<void>;
  fetchUserShips: (userId: string) => Promise<void>;
  addUserShip: (ship: Omit<UserShip, 'id'>) => Promise<void>;
  updateUserShip: (shipId: string, data: Partial<UserShip>) => Promise<void>;
  deleteUserShip: (shipId: string) => Promise<void>;
  importShipsFromCSV: (file: File) => Promise<void>;
  setFilters: (filters: Partial<ShipFilters>) => void;
  clearFilters: () => void;
  clearError: () => void;
}

export type ShipsStore = ShipsState & ShipsActions;

// ============================================================================
// Organization Types
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  tag: string;
  description?: string;
  logoUrl?: string;
  foundedAt: string;
  memberCount: number;
  focus: OrganizationFocus[];
  rsiOrgUrl?: string;
  discordGuildId?: string;
}

export type OrganizationFocus =
  | 'combat'
  | 'trading'
  | 'exploration'
  | 'mining'
  | 'security'
  | 'piracy'
  | 'smuggling'
  | 'bounty-hunting';

export interface OrganizationRelationship {
  id: string;
  organizationId: string;
  targetOrganizationId: string;
  targetOrganization: Organization;
  type: RelationshipType;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export type RelationshipType = 'neutral' | 'cooperative' | 'alliance' | 'hostile';

export interface OrganizationState extends ApiState {
  currentOrg: Organization | null;
  organizations: Organization[];
  relationships: OrganizationRelationship[];
  alliances: Organization[];
  hostileOrgs: Organization[];
}

export interface OrganizationActions {
  fetchOrganization: (orgId: string) => Promise<void>;
  fetchOrganizations: () => Promise<void>;
  fetchRelationships: (orgId: string) => Promise<void>;
  createRelationship: (targetOrgId: string, type: RelationshipType) => Promise<void>;
  updateRelationship: (relationshipId: string, type: RelationshipType) => Promise<void>;
  deleteRelationship: (relationshipId: string) => Promise<void>;
  setCurrentOrg: (org: Organization) => void;
  clearError: () => void;
}

export type OrganizationStore = OrganizationState & OrganizationActions;

// ============================================================================
// Events & Calendar Types
// ============================================================================

export interface Event {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  startDate: string;
  endDate: string;
  location?: string;
  organizerId: string;
  organizer: User;
  participants: EventParticipant[];
  maxParticipants?: number;
  status: EventStatus;
  visibility: EventVisibility;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export type EventType =
  | 'mission'
  | 'operation'
  | 'training'
  | 'meeting'
  | 'tournament'
  | 'social'
  | 'other';

export type EventStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

export type EventVisibility = 'public' | 'org' | 'alliance' | 'private';

export interface EventParticipant {
  userId: string;
  username: string;
  status: 'attending' | 'maybe' | 'declined';
  role?: string;
  shipId?: string;
}

export interface EventsState extends ApiState {
  events: Event[];
  upcomingEvents: Event[];
  filteredEvents: Event[];
  selectedEvent: Event | null;
  filters: EventFilters;
}

export interface EventFilters {
  type?: EventType;
  status?: EventStatus;
  visibility?: EventVisibility;
  dateRange?: { start: string; end: string };
  search?: string;
}

export interface EventsActions {
  fetchEvents: () => Promise<void>;
  fetchUpcomingEvents: () => Promise<void>;
  fetchEvent: (eventId: string) => Promise<void>;
  createEvent: (event: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEvent: (eventId: string, data: Partial<Event>) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  joinEvent: (eventId: string, status: EventParticipant['status']) => Promise<void>;
  leaveEvent: (eventId: string) => Promise<void>;
  setFilters: (filters: Partial<EventFilters>) => void;
  clearFilters: () => void;
  setSelectedEvent: (event: Event | null) => void;
  clearError: () => void;
}

export type EventsStore = EventsState & EventsActions;

// ============================================================================
// UI State Types
// ============================================================================

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  createdAt: number;
}

export interface Modal {
  id: string;
  type?: string;
  title?: string;
  content?: string;
  props?: Record<string, any>;
  onClose?: () => void;
}

export interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  notifications: Notification[];
  modals: Modal[];
  loading: Record<string, boolean>;
}

export interface UIActions {
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  openModal: (modal: Omit<Modal, 'id'>) => void;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  setLoading: (key: string, loading: boolean) => void;
  clearLoading: () => void;
}

export type UIStore = UIState & UIActions;

// ============================================================================
// Users Management Types
// ============================================================================

export interface UsersState extends ApiState {
  users: User[];
  selectedUser: User | null;
  filteredUsers: User[];
  filters: UserFilters;
  totalUsers: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface UserFilters {
  role?: UserRole;
  organizationId?: string;
  search?: string;
  status?: 'active' | 'inactive';
}

export interface UsersActions {
  fetchUsers: (page?: number, limit?: number) => Promise<void>;
  fetchUser: (userId: string) => Promise<void>;
  createUser: (user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateUser: (userId: string, data: Partial<User>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  assignRole: (userId: string, role: UserRole) => Promise<void>;
  updatePermissions: (userId: string, permissions: Permission[]) => Promise<void>;
  setFilters: (filters: Partial<UserFilters>) => void;
  clearFilters: () => void;
  setSelectedUser: (user: User | null) => void;
  clearError: () => void;
}

export type UsersStore = UsersState & UsersActions;

// ============================================================================
// Persistence Configuration
// ============================================================================

export interface PersistConfig {
  name: string;
  version: number;
  storage?: Storage;
  partialize?: (state: any) => any;
  onRehydrateStorage?: () => void;
  serialize?: (state: any) => string;
  deserialize?: (str: string) => any;
  skipHydration?: boolean;
}
