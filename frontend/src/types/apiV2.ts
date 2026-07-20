/**
 * API v2 Type Definitions
 * Standard response formats for API v2 endpoints
 */

import type {
  LogisticsStatus,
  OrgScalingProfile,
  ResourceItem,
  RouteStatus,
  Activity as SharedActivity,
  Fleet as SharedFleet,
  Organization as SharedOrganization,
  Ship as SharedShip,
  SquadronMember as SharedSquadronMember,
  User as SharedUser,
  ShipRequirement,
  ShipRequirementType,
  SquadronMemberStatus,
  SquadronStatistics,
} from '@sc-fleet-manager/shared-types';

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    requestId: string;
    [key: string]: unknown;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Paginated result type (output of extractPaginatedData)
 * This is what the services return after extracting from PaginatedResponse
 */
export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: {
    timestamp: string;
    requestId: string;
    pagination: PaginationMeta;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface FleetListParams extends PaginationParams {
  search?: string;
}

export interface ActivityListParams extends PaginationParams {
  status?: string;
  type?: string;
  search?: string;
}

// Export ApiErrorCode from shared-types
export { ApiErrorCode } from '@sc-fleet-manager/shared-types';

// Fleet types
/**
 * Fleet type (backed by shared-types Fleet)
 * Includes dashboard-specific computed fields (memberCount, shipCount)
 */
export type Fleet = Pick<
  SharedFleet,
  | 'id'
  | 'name'
  | 'description'
  | 'emblem'
  | 'organizationId'
  | 'teamId'
  | 'status'
  | 'type'
  | 'leaderId'
  | 'secondInCommandId'
  | 'createdAt'
  | 'updatedAt'
> & {
  memberCount?: number;
  shipCount?: number;
  isActive?: boolean;
  // Fleet capability enrichments
  totalCargoCapacity?: number;
  avgQuantumFuel?: number | null;
  hasRefuelShip?: boolean;
  hasRearmShip?: boolean;
  hasRepairShip?: boolean;
  hasMedicalShip?: boolean;
  refuelShipNames?: string[];
  rearmShipNames?: string[];
  repairShipNames?: string[];
  medicalShipNames?: string[];
};

/** Alias for backward compatibility with v2 naming */
export type FleetV2 = Fleet;

export interface FleetStatistics {
  fleets: {
    total: number;
  };
  ships: {
    total: number;
    orgOwned: number;
    memberShared: number;
    byRole: Record<string, number>;
    bySize: Record<string, number>;
    byManufacturer: Record<string, number>;
    byCareer: Record<string, number>;
  };
}

export interface FleetComposition {
  fleet: {
    id: string;
    name: string;
    memberCount: number;
  };
  ships: {
    total: number;
    byRole: Record<string, number>;
    bySize: Record<string, number>;
    byManufacturer: Record<string, number>;
  };
  readiness: {
    flightReady: number;
    inConcept: number;
    inProduction: number;
  };
}

export interface ShipCrewGate {
  shipId: string;
  shipName: string;
  maxCrew: number;
  leanRequired: number;
  conservativeRequired: number;
  filled: number;
  passesLean: boolean;
  passesConservative: boolean;
}

export interface FleetCrewHealth {
  crewFillRate: number;
  totalRequired: number;
  totalFilled: number;
  totalMaxCrew: number;
  standbySlots: number;
  standbyFilled: number;
  perShip: ShipCrewGate[];
  overallGatePassed: boolean;
  crewMode: 'lean' | 'conservative';
}

export interface FleetHealth {
  fleetId: string;
  fleetName: string;
  healthScore: number;
  status: 'green' | 'yellow' | 'red';
  breakdown: {
    readinessScore: number;
    crewFillRate: number;
    capabilityScore: number;
    operationalScore: number;
    /** @deprecated Use crewFillRate instead */
    memberFillRate?: number;
  };
  details: {
    totalShips: number;
    flightReadyShips: number;
    totalCrewPositions?: number;
    crewFilled?: number;
    crewMode?: 'lean' | 'conservative';
    overallGatePassed?: boolean;
    standbySlots?: number;
    standbyFilled?: number;
    fleetStatus: string;
    /** @deprecated */
    memberCount?: number;
    /** @deprecated */
    maxMembers?: number;
  };
  crewHealth?: FleetCrewHealth;
  maintenanceHealth?: FleetMaintenanceHealth;
}

/** Per-ship maintenance & supply status */
export interface ShipMaintenanceStatus {
  shipId: string;
  shipName: string;
  size: string;
  status: string;
  isFlightReady: boolean;
  maxCrew: number;
  hullHp: number;
  shieldHp: number;
  cargoScu: number;
  isSupplyCapable: boolean;
  supplyCapacity: {
    ammunition: number;
    fuel: number;
    repairMaterial: number;
    totalAllocated: number;
  };
}

/** Fleet-level maintenance & supply health */
export interface FleetMaintenanceHealth {
  totalShips: number;
  flightReadyShips: number;
  supplyCapableShips: number;
  totalSupply: {
    ammunition: number;
    fuel: number;
    repairMaterial: number;
    totalScu: number;
  };
  perShip: ShipMaintenanceStatus[];
}

/**
 * Ship type (backed by shared-types Ship)
 * Includes frontend-specific fields like fleetId (API response context)
 */
export type Ship = Pick<
  SharedShip,
  'id' | 'name' | 'manufacturer' | 'model' | 'role' | 'status' | 'createdAt' | 'updatedAt'
> & {
  fleetId: string;
  size?: string;
  ownerId?: string;
  // Spec fields returned by API (from backend Ship entity)
  crew?: number;
  minCrew?: number;
  maxCrew?: number;
  cargo?: number;
  quantumFuelCapacity?: number;
  hydrogenFuelCapacity?: number;
  shields?: number;
  armor?: number;
  speed?: number;
  weapons?: { type: string; size: number; count: number }[];
};

/** Alias for backward compatibility with v2 naming */
export type ShipV2 = Ship;

// Activity types
/**
 * Activity type (backed by shared-types Activity)
 * Includes dashboard-specific fields like organizationName and currentParticipants
 */
export type Activity = Pick<
  SharedActivity,
  'id' | 'title' | 'description' | 'type' | 'status' | 'organizationId' | 'createdAt' | 'updatedAt'
> & {
  organizationName?: string;
  creatorId?: string;
  maxParticipants?: number;
  currentParticipants?: number;
  startDate?: string;
  endDate?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  estimatedDuration?: number;
  location?: string;
  visibility?: string;
  // Ship requirements & fleet logistics
  shipRequirementType?: ShipRequirementType;
  requiredShips?: ShipRequirement[];
  /** Card-level subset of ShipAssignment — only fields needed for preview display */
  shipAssignments?: Array<{
    shipType: string;
    shipName?: string;
    role: string;
    crewCapacity: number;
    crewAssigned: number;
    status: string;
  }>;
  manageableShipIdentifiers?: string[];
  totalCargoCapacity?: number;
  totalQuantumFuel?: number;
  hasRefuelShip?: boolean;
  totalCrewCapacity?: number;
  totalCrewAssigned?: number;
};

/** Alias for backward compatibility with v2 naming */
export type ActivityV2 = Activity;

export interface ActivityAnalytics {
  total: number;
  upcoming: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

export interface RecommendedActivities {
  activities: ActivityV2[];
  count: number;
}

// Organization types
export interface OrganizationDashboard {
  organization: {
    id: string;
    name: string;
    description?: string;
    memberCount: number;
    onlineMembers: number;
  };
  stats: {
    fleets: number;
    ships: number;
    activities: {
      total: number;
      upcoming: number;
      active: number;
    };
    members: {
      total: number;
      online: number;
      roles: Record<string, number>;
    };
  };
  recentActivity: FeedItem[];
}

export interface OrganizationOverview {
  organization: {
    id: string;
    name: string;
    description?: string;
    memberCount: number;
  };
  fleetStats: {
    totalFleets: number;
    totalShips: number;
    bySize: Record<string, number>;
  };
  activityStats: {
    total: number;
    upcoming: number;
    byType: Record<string, number>;
  };
  memberStats: {
    total: number;
    byRole: Record<string, number>;
  };
}

export interface FeedItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, unknown>;
}

export interface OrganizationInsights {
  trends: {
    memberGrowth: number;
    activityLevel: number;
    fleetExpansion: number;
  };
  topMembers: Array<{
    userId: string;
    userName: string;
    activityCount: number;
  }>;
  popularActivities: Array<{
    type: string;
    count: number;
  }>;
  recommendations: string[];
}

// Export RouteStatus from shared-types
export { RouteStatus } from '@sc-fleet-manager/shared-types';

export interface TradeStop {
  location: string;
  buyGoods?: string[];
  sellGoods?: string[];
  order: number;
  type?: 'trade' | 'refuel' | 'waypoint';
  requiredFuel?: number;
  distance?: number;
}

export interface RoutePerformance {
  runCount: number;
  avgProfit: number;
  avgDuration: number;
  lastRun?: string;
}

export interface FleetShip {
  shipId: string;
  shipName: string;
  quantity: number;
  cargo?: number;
  speed?: number;
  quantumSpeed?: number;
  quantumFuelCapacity?: number;
  isRefuelingShip?: boolean;
}

export interface RouteFleetComposition {
  ships: FleetShip[];
  totalCargo: number;
  slowestSpeed: number;
  slowestQuantumSpeed: number;
  minFuelCapacity: number;
  hasRefuelingShip: boolean;
}

export interface TradingRouteV2 {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  stops: TradeStop[];
  estimatedProfit?: number;
  estimatedDuration?: number;
  minCargoCapacity?: number;
  fleetComposition?: RouteFleetComposition;
  status: RouteStatus;
  performance?: RoutePerformance;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TradingOpportunity extends TradingRouteV2 {
  profitPerHour: number;
  rating: number;
}

export interface TradingOpportunities {
  opportunities: TradingOpportunity[];
  count: number;
  filters: {
    minProfit: number;
    maxDistance: number;
    cargoCapacity?: number;
  };
}

export interface TradingAnalytics {
  routes: {
    total: number;
    active: number;
    inactive: number;
    deprecated: number;
  };
  performance: {
    totalRuns: number;
    totalProfit: number;
    avgProfitPerRoute: number;
  };
  topRoutes: Array<{
    id: string;
    name: string;
    avgProfit: number;
    runCount: number;
  }>;
}

export interface MarketAnalysis {
  summary: {
    totalRoutes: number;
    uniqueCommodities: number;
    uniqueLocations: number;
  };
  popularCommodities: string[];
  popularLocations: string[];
  trends: {
    highProfitRoutes: number;
    quickRoutes: number;
  };
}

export interface TradingRouteListParams extends PaginationParams {
  status?: RouteStatus;
  search?: string;
}

export interface TradingOpportunityParams {
  minProfit?: number;
  maxDistance?: number;
  cargoCapacity?: number;
  limit?: number;
}

export interface MarketAnalysisParams {
  commodity?: string;
  location?: string;
}

// ============================================================================
// WebSocket Event Types
// ============================================================================

export interface FleetEvent {
  type:
    | 'fleet:created'
    | 'fleet:updated'
    | 'fleet:deleted'
    | 'fleet:ship_added'
    | 'fleet:ship_removed'
    | 'fleet:composition_updated';
  organizationId: string;
  fleetId: string;
  data: Record<string, unknown>;
  timestamp: number;
  userId?: string;
}

export interface ActivityEvent {
  type:
    | 'activity:created'
    | 'activity:updated'
    | 'activity:deleted'
    | 'activity:participant_joined'
    | 'activity:participant_left'
    | 'activity:status_changed'
    | 'activity:reminder';
  organizationId: string;
  activityId: string;
  data: Record<string, unknown>;
  timestamp: number;
  userId?: string;
}

export interface TradingEvent {
  type:
    | 'trading:route_created'
    | 'trading:route_updated'
    | 'trading:route_deleted'
    | 'trading:route_status_changed'
    | 'trading:opportunity_discovered'
    | 'trading:market_updated'
    | 'trading:price_changed';
  organizationId?: string;
  routeId?: string;
  data: Record<string, unknown>;
  timestamp: number;
  userId?: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  category?: 'system' | 'fleet' | 'activity' | 'trading' | 'organization';
  data?: Record<string, unknown>;
  timestamp: number | string;
  read: boolean;
  actionUrl?: string;
  /** Backend DB field — normalized to timestamp on the frontend */
  createdAt?: string;
}

export interface NotificationEvent {
  type: 'notification:new' | 'notification:read' | 'notification:deleted';
  notification: Notification;
  userId?: string;
  organizationId?: string;
}

// ===========================
// Presence Types
// ===========================

export type PresenceStatus = 'online' | 'idle' | 'offline';

export type User = Pick<SharedUser, 'id' | 'username' | 'displayName' | 'avatar' | 'email'> & {
  displayName: string;
  organizationId?: string;
};

export interface PresenceState {
  userId: string;
  user: User;
  status: PresenceStatus;
  lastSeen: number;
  currentActivity?: string;
  isTyping?: boolean;
  typingLocation?: string;
  customStatus?: {
    text: string;
    emoji?: string;
    expiresAt?: number;
  };
}

// ---------------------------------------------------------------------------
// Dashboard Summary (unified endpoint)
// ---------------------------------------------------------------------------
export interface DashboardSummaryResponse {
  fleets: {
    total: number;
    totalShips: number;
    totalMemberShips: number;
    personalShipCount: number;
  } | null;
  activities: { total: number; upcoming: number } | null;
  teams: { total: number } | null;
  notifications: {
    recent: unknown[];
    total: number;
    unreadCount: number;
  };
  organization: {
    id: string;
    name: string;
    role: string;
    rsiVerified: boolean;
    scale: OrgScalingProfile;
    members: {
      total: number;
      active: number;
      byRole: Record<string, number>;
    };
  } | null;
  scStats: {
    verificationRate: number;
    averageKD: number;
    averageTotalHours: number;
    averageMissionsCompleted: number;
    memberCount: number;
    verifiedCount: number;
  } | null;
  trading: {
    activeRoutes: number;
    totalEstimatedProfit: number;
  } | null;
  inventory: {
    totalItems: number;
    totalValue: number;
  } | null;
  mining: {
    activeOperations: number;
  } | null;
  missions: {
    total: number;
  } | null;
  alliances: {
    total: number;
    mutual: number;
    averageHealth: number;
  } | null;
  bounties: {
    totalBounties: number;
    activeBounties: number;
    completedBounties: number;
  } | null;
  reputation: {
    combinedScore: number;
    reliability: string;
  } | null;
  timestamp: string;
}

export interface PresenceEvent {
  type:
    | 'user:online'
    | 'user:offline'
    | 'user:idle'
    | 'user:typing'
    | 'user:typing_stopped'
    | 'user:activity_changed'
    | 'user:status_changed';
  userId: string;
  user?: User;
  status?: PresenceStatus;
  timestamp: number;
  organizationId?: string;
  data?: {
    lastSeen?: number;
    currentActivity?: string;
    isTyping?: boolean;
    typingLocation?: string;
    customStatus?: {
      text: string;
      emoji?: string;
      expiresAt?: number;
    };
  };
}

// ─── Squadron (people-management within fleets) ────────────────────────────

export type { SquadronMemberStatus, SquadronStatistics };

export type SquadronMember = SharedSquadronMember;

export interface SquadronMemberListParams extends PaginationParams {
  status?: SquadronMemberStatus;
  role?: string;
  search?: string;
  sortBy?: 'joinedAt' | 'lastActiveAt' | 'rank' | 'role';
  sortOrder?: 'ASC' | 'DESC';
}

export interface AddSquadronMemberInput {
  userId: string;
  role?: string;
  rank?: string;
  shipType?: string;
  specialization?: string;
}

export interface UpdateSquadronRoleInput {
  role: string;
}

// ==================== Organization Templates (Sprint 19-D) ====================

export enum TemplateCategory {
  MILITARY = 'MILITARY',
  CORPORATE = 'CORPORATE',
  GUILD = 'GUILD',
  COMMUNITY = 'COMMUNITY',
  PROJECT = 'PROJECT',
  CUSTOM = 'CUSTOM',
}

export enum TemplateVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  ORGANIZATION = 'ORGANIZATION',
  MARKETPLACE = 'MARKETPLACE',
}

export interface TemplateStructure {
  name: string;
  description?: string;
  type: string;
  level: number;
  children?: TemplateStructure[];
  defaultRoles?: string[];
  defaultMemberCount?: number;
}

export interface DefaultRole {
  name: string;
  description?: string;
  permissions: string[];
  memberCount?: number;
  autoAssign?: boolean;
}

export interface DefaultPermission {
  resource: string;
  actions: string[];
  scope: string;
  inheritable: boolean;
  priority: number;
  applyToRoles?: string[];
}

// Role template types (Sprint 19-A)
export interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  scope: string;
  permissions: string[];
}

export interface RoleTemplatesResponse {
  templates: RoleTemplate[];
  count: number;
}

export interface ApplyRoleTemplateInput {
  roleName: string;
  organizationId: string;
}

export interface ApplyRoleTemplateResponse {
  id: string;
  name: string;
  description: string;
  templateApplied: string;
  organizationId: string;
  permissions: string[];
  priority: number;
  createdAt: string;
}

export interface TemplateSettings {
  allowSubOrgs: boolean;
  maxDepth: number;
  requireApproval: boolean;
  inheritPermissions: boolean;
  autoArchiveInactive: boolean;
  inactivityThreshold?: number;
  visibility: string;
  customFields?: Array<{
    name: string;
    type: string;
    required: boolean;
    defaultValue?: unknown;
  }>;
}

export interface ApplicationConfig {
  createSubOrgsByDefault: boolean;
  subOrgDepth?: number;
  assignDefaultRoles: boolean;
  sendWelcomeMessages: boolean;
  enableAnalytics: boolean;
  customizationOptions?: Record<string, unknown>;
  allowApplications?: boolean;
  requireApproval?: boolean;
  autoAssignRole?: string;
  welcomeMessage?: string;
}

export interface OrganizationTemplate {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  visibility: TemplateVisibility;
  createdBy: string;
  creatorName: string | null;
  structure: TemplateStructure;
  defaultRoles: DefaultRole[];
  defaultPermissions: DefaultPermission[];
  defaultSettings: TemplateSettings;
  applicationConfig: ApplicationConfig;
  tags: string[] | null;
  iconUrl: string | null;
  usageCount: number;
  averageRating: number;
  ratingCount: number;
  isActive: boolean;
  isFeatured: boolean;
  isVerified: boolean;
  isPublic: boolean;
  version: string;
  changelog: string | null;
  forkedFrom: string | null;
  preview: {
    screenshots?: string[];
    demoUrl?: string;
    features?: string[];
    requirements?: string[];
  } | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface MarketplaceSearchParams {
  search?: string;
  category?: TemplateCategory;
  tags?: string[];
  minRating?: number;
  sortBy?: 'usage' | 'rating' | 'recent' | 'name';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface MarketplaceSearchResult {
  templates: OrganizationTemplate[];
  total: number;
}

export interface TemplateListParams {
  category?: TemplateCategory;
  visibility?: TemplateVisibility;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category?: TemplateCategory;
  visibility?: TemplateVisibility;
  structure: TemplateStructure;
  defaultRoles?: DefaultRole[];
  defaultPermissions?: DefaultPermission[];
  defaultSettings?: TemplateSettings;
  applicationConfig?: ApplicationConfig;
  tags?: string[];
  iconUrl?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  category?: TemplateCategory;
  visibility?: TemplateVisibility;
  structure?: TemplateStructure;
  defaultRoles?: DefaultRole[];
  defaultPermissions?: DefaultPermission[];
  defaultSettings?: TemplateSettings;
  applicationConfig?: ApplicationConfig;
  tags?: string[];
  iconUrl?: string;
}

export interface ApplyTemplateInput {
  name?: string;
  description?: string;
  settings?: Record<string, unknown>;
  customizations?: Record<string, unknown>;
  organizationId?: string;
}

export interface ForkTemplateInput {
  name?: string;
  description?: string;
}

export interface RateTemplateInput {
  rating: number;
}

export interface ImportTemplateInput {
  name: string;
  description?: string;
  category?: TemplateCategory;
  visibility?: TemplateVisibility;
  structure: TemplateStructure;
  defaultRoles?: DefaultRole[];
  defaultPermissions?: DefaultPermission[];
  defaultSettings?: TemplateSettings;
  applicationConfig?: ApplicationConfig;
  tags?: string[];
  version?: string;
}

// ============================================================================
// Activity Templates (Sprint 19-D)
// ============================================================================

export enum ActivityTemplateCategory {
  COMBAT = 'combat',
  MINING = 'mining',
  TRADING = 'trading',
  EXPLORATION = 'exploration',
  LOGISTICS = 'logistics',
  SOCIAL = 'social',
  TRAINING = 'training',
  CUSTOM = 'custom',
}

export interface ActivityTemplateRoleRequirement {
  role: string;
  count: number;
  required: boolean;
}

export interface ActivityTemplateResourceRequirement {
  resource: string;
  quantity: number;
  required: boolean;
}

export interface ActivityTemplateData {
  description?: string;
  activityType?: string;
  visibility?: string;
  maxParticipants?: number;
  minParticipants?: number;
  locationSystem?: string;
  locationPlanet?: string;
  locationDetails?: string;
  estimatedDuration?: number;
  requirements?: string[];
  objectives?: string[];
  roleRequirements?: ActivityTemplateRoleRequirement[];
  resourceRequirements?: ActivityTemplateResourceRequirement[];
  requiredShips?: string[];
  preferredShips?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ActivityTemplate {
  id: string;
  name: string;
  description: string | null;
  activityType: string;
  category: ActivityTemplateCategory;
  templateData: ActivityTemplateData;
  isPublic: boolean;
  isActive: boolean;
  usageCount: number;
  tags: string[] | null;
  createdBy: string;
  createdByName: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityTemplateCategoryInfo {
  label: string;
  value: string;
  description: string;
}

export interface CreateActivityTemplateInput {
  name: string;
  description?: string;
  activityType: string;
  category?: ActivityTemplateCategory;
  templateData?: ActivityTemplateData;
  isPublic?: boolean;
  tags?: string[];
}

export interface UpdateActivityTemplateInput {
  name?: string;
  description?: string;
  activityType?: string;
  category?: ActivityTemplateCategory;
  templateData?: ActivityTemplateData;
  isPublic?: boolean;
  isActive?: boolean;
  tags?: string[];
}

export interface ApplyActivityTemplateInput {
  title: string;
  scheduledStartTime: string;
  estimatedDuration?: number;
  maxParticipants?: number;
  overrides?: Record<string, unknown>;
}

export interface ActivityTemplateQueryFilters {
  category?: ActivityTemplateCategory;
  activityType?: string;
  isPublic?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// Organization Types (migrated from api.ts)
// ============================================================================

export type Organization = Pick<SharedOrganization, 'id' | 'name' | 'isVerified'> & {
  userRole?: string;
  joinedAt?: Date;
  rsiVerified?: boolean;
  scale?: OrgScalingProfile;
};

export interface OrganizationStatistics {
  totalMembers: number;
  totalFleets: number;
  totalShips: number;
  totalInventoryValue: number;
  activeRoutes: number;
  alliedOrganizations: number;
}

// ============================================================================
// Inventory Types (migrated from api.ts)
// ============================================================================

export interface InventoryItem {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  minStock?: number;
  avgBuyPrice?: number;
  avgSellPrice?: number;
  location?: string;
  notes?: string;
  fleetId?: string;
  organizationId: string;
  lastValidated?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInventoryItemInput {
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  minStock?: number;
  avgBuyPrice?: number;
  avgSellPrice?: number;
  location?: string;
  notes?: string;
  fleetId?: string;
}

export interface UpdateInventoryItemInput extends Partial<CreateInventoryItemInput> {}

export interface InventoryStatistics {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  categoryCounts: Record<string, number>;
}

export interface InventoryAdjustment {
  quantity: number;
  reason: string;
  notes?: string;
}

export interface InventoryQueryParams extends PaginationParams {
  category?: string;
  search?: string;
  fleetId?: string;
  lowStockOnly?: boolean;
}

// ============================================================================
// Treasury Types
// ============================================================================

export type TransactionType = 'income' | 'expense' | 'transfer' | 'dues' | 'reward' | 'purchase';
export type DuesFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
export type TreasuryPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface CreditPool {
  id: string;
  organizationId: string;
  balance: number;
  currency: string;
  lastTransactionAt?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreditTransaction {
  id: string;
  organizationId: string;
  creditPoolId: string;
  type: TransactionType;
  amount: number;
  balance: number;
  description: string;
  category?: string;
  fromUserId?: string;
  toUserId?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface CommissaryItem {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  stock: number;
  isActive: boolean;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommissaryPurchase {
  id: string;
  organizationId: string;
  itemId: string;
  buyerId: string;
  quantity: number;
  totalPrice: number;
  transactionId: string;
  item?: CommissaryItem;
  createdAt: string;
}

export interface OrgDues {
  id: string;
  organizationId: string;
  name: string;
  amount: number;
  frequency: DuesFrequency;
  isActive: boolean;
  dueDay: number;
  gracePeriodDays: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Treasury DTOs

export interface EarnCreditsInput {
  amount: number;
  source: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface SpendCreditsInput {
  amount: number;
  purpose: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface TransferCreditsInput {
  toUserId: string;
  amount: number;
  note?: string;
}

export interface CreateDuesInput {
  name: string;
  amount: number;
  frequency: DuesFrequency;
  dueDay?: number;
  gracePeriodDays?: number;
}

export interface UpdateDuesInput {
  name?: string;
  amount?: number;
  frequency?: DuesFrequency;
  isActive?: boolean;
  dueDay?: number;
  gracePeriodDays?: number;
}

export interface CreateCommissaryItemInput {
  name: string;
  description?: string;
  price: number;
  category: string;
  stock?: number;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCommissaryItemInput {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  stock?: number;
  isActive?: boolean;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PurchaseInput {
  quantity: number;
}

// Treasury query params

export interface TransactionQueryParams extends PaginationParams {
  type?: TransactionType;
  category?: string;
  fromUserId?: string;
  toUserId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'amount';
  sortOrder?: 'ASC' | 'DESC';
}

export interface DuesQueryParams extends PaginationParams {
  activeOnly?: boolean;
}

export interface CommissaryQueryParams extends PaginationParams {
  category?: string;
  activeOnly?: boolean;
  searchTerm?: string;
  sortBy?: 'createdAt' | 'price' | 'name';
  sortOrder?: 'ASC' | 'DESC';
}

export interface PurchaseQueryParams extends PaginationParams {
  buyerId?: string;
}

// Treasury response types

export interface TreasuryStatistics {
  balance: number;
  currency: string;
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
  recentTransactions: CreditTransaction[];
}

export interface LeaderboardEntry {
  userId: string;
  username?: string;
  totalContributed: number;
  transactionCount: number;
}

// ============================================================================
// Ship Input Types (migrated from api.ts)
// ============================================================================

export interface CreateShipInput {
  name: string;
  manufacturer: string;
  model: string;
  role: string;
  size: 'vehicle' | 'snub' | 'small' | 'medium' | 'large' | 'sub_capital' | 'capital';
  crew: number;
  cargoCapacity: number;
  location?: string;
  status?: 'operational' | 'maintenance' | 'damaged' | 'destroyed';
}

// ============================================================================
// Logistics Types (migrated from api.ts)
// ============================================================================

export type { LogisticsStatus, ResourceItem } from '@sc-fleet-manager/shared-types';

export interface LogisticsOperation {
  id: string;
  fleetId: string;
  operationName: string;
  description?: string;
  coordinatorId: string;
  status: LogisticsStatus;
  ships: ShipLogistics[];
  resources: ResourceItem[];
  route: RouteWaypoint[];
  totalFuelCapacity: number;
  totalCargoCapacity: number;
  totalFuelRequired: number;
  totalCargoUsed: number;
  maxJumpRange?: number;
  estimatedDuration?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShipLogistics {
  shipId: string;
  shipName: string;
  fuelCapacity: number;
  cargoCapacity: number;
  currentFuel: number;
  currentCargo: number;
  jumpRange: number;
}

export interface RouteWaypoint {
  location: string;
  distance: number;
  requiredFuel: number;
  order: number;
}

// ============================================================================
// Trading V1 Types (migrated from api.ts — used by legacy tests)
// ============================================================================

export type TradeRouteStatus = 'active' | 'inactive' | 'archived';

export interface TradingRoute {
  id: string;
  name: string;
  description?: string;
  stops: RouteStop[];
  estimatedProfit: number;
  estimatedDuration: number;
  status: TradeRouteStatus;
  runs: number;
  organizationId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RouteStop {
  location: string;
  order: number;
  action: 'buy' | 'sell';
  commodity: string;
  quantity: number;
  price: number;
}

export interface TradeOpportunity {
  commodity: string;
  buyLocation: string;
  sellLocation: string;
  buyPrice: number;
  sellPrice: number;
  profitPerUnit: number;
  profitMargin: number;
  estimatedDistance?: number;
  lastUpdated: Date;
}
