/**
 * TypeScript types for Activity system
 *
 * Enums removed — use union types from @sc-fleet-manager/shared-types instead.
 * Re-exported here for convenience.
 */
import type {
  ActivityStatus,
  ActivityType,
  ActivityVisibility,
  CrewSlot,
  ParticipantRole,
  ParticipationStatus,
  PassengerSlot,
  ShipRequirement,
} from '@sc-fleet-manager/shared-types';

export type {
  ActivityStatus,
  ActivityType,
  ActivityVisibility,
  ParticipantRole,
  ParticipationStatus,
  ShipRequirement,
} from '@sc-fleet-manager/shared-types';

// ============================================================================
// Interfaces
// ============================================================================

export interface ActivityParticipant {
  userId: string;
  userName: string;
  avatarUrl?: string;
  organizationId?: string;
  organizationName?: string;
  role: ParticipantRole;
  status: ParticipationStatus;
  joinedAt: Date;
  shipType?: string;
  shipName?: string;
  shipId?: string;
  crewPosition?: string;
  crewShipId?: string;
  reputation?: number;
  notes?: string;
}

export interface OrganizationParticipation {
  organizationId: string;
  organizationName: string;
  role: 'host' | 'co_host' | 'participant' | 'allied' | 'contracted';
  memberCount: number;
  status: 'invited' | 'accepted' | 'declined';
  joinedAt: Date;
  contribution?: string;
}

export interface RouteWaypoint {
  order: number;
  location: string;
  system: string;
  coordinates?: string;
  distance?: number;
  estimatedTravelTime?: number;
  activities?: string[];
  requiredFuel?: number;
  notes?: string;
}

export interface ShipMetadata {
  size?: string;
  manufacturer?: string;
  cargoCapacity?: number;
  hangarSize?: string;
  vehicleCargoCapacity?: number;
  quantumFuelCapacity?: number;
  hydrogenFuelCapacity?: number;
  isRefuelCapable?: boolean;
  isRearmCapable?: boolean;
  isRepairCapable?: boolean;
  loanerShip?: string;
  quantum?: string;
  shields?: string;
  weapons?: string[];
  notes?: string;
  [key: string]: unknown;
}

export interface ShipAssignment {
  id?: string;
  shipId: string;
  shipType: string;
  shipName?: string;
  ownerId: string;
  ownerName: string;
  captainId?: string;
  captainName?: string;
  description?: string;
  role: 'combat' | 'mining' | 'cargo' | 'medical' | 'support' | 'scout' | 'other';
  crewCapacity: number;
  crewAssigned: number;
  currentCrew?: number;
  maxCrew?: number;
  crew?: Array<{ userId: string; userName: string; avatarUrl?: string; position: string }>;
  crewMembers: Array<{
    userId: string;
    userName: string;
    avatarUrl?: string;
    position: string;
  }>;
  /** Typed crew slots (seats per role); sum of capacities equals crewCapacity. */
  crewSlots?: CrewSlot[];
  capabilities?: string[];
  status: 'available' | 'assigned' | 'in_use';
  /** Loaner ship flag */
  isLoaner?: boolean;
  /** Display name of person who contributed this ship */
  contributedBy?: string;
  contributedByUserId?: string;
  /** Transport nesting */
  parentShipId?: string;
  isTransported?: boolean;
  transportType?: 'hangar' | 'cargo' | 'tractor_beam' | 'docking_collar';
  /** Non-crew passenger slots (e.g. marines); not counted toward crew totals. */
  passengers?: PassengerSlot[];
  /** Ship specifications metadata */
  metadata?: ShipMetadata;
}

export interface MiningData {
  location: string;
  system: string;
  topResources: Array<{
    name: string;
    symbol: string;
    percentage: number;
    price?: number;
    sellLocations?: string[];
  }>;
  accessibility: 'Easy' | 'Moderate' | 'Difficult' | 'Extreme';
  recommendedShips: string[];
  estimatedProfitPerHour?: number;
  notes?: string;
  lastUpdated: Date;
}

export interface RoleRequirement {
  role: ParticipantRole;
  count: number;
  filled: number;
  required: boolean;
  userName?: string;
}

export interface ResourceRequirement {
  resourceType: string;
  quantity: number;
  provided: number;
  unit: string;
  userName?: string;
  shipId?: string;
  crewCapacity?: number;
  requiredCapabilities?: string[];
}

export interface ActivityVoiceChannel {
  channelId: string;
  channelName: string;
  serverId: string;
  maxParticipants?: number;
  autoCreate: boolean;
  autoDelete: boolean;
  createdAt?: Date;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  activityType: ActivityType;
  status: ActivityStatus;
  visibility: ActivityVisibility;

  // Organization & participants
  creatorId: string;
  creatorName: string;
  primaryOrganizationId?: string;
  primaryOrganizationName?: string;
  participants: ActivityParticipant[];
  organizations: OrganizationParticipation[];
  maxParticipants?: number;

  // Location & time
  location?: string;
  systemLocation?: string;
  coordinates?: string;
  startTime?: Date;
  endTime?: Date;
  estimatedDuration?: number;

  // Requirements & rewards
  roleRequirements: RoleRequirement[];
  resourceRequirements: ResourceRequirement[];
  difficultyLevel?: string;
  recommendedLevel?: number;
  rewards?: string;
  payout?: number;

  // Route planning
  routePlan?: RouteWaypoint[];
  totalDistance?: number;
  totalEstimatedTime?: number;

  // Ship & crew management
  shipAssignments?: ShipAssignment[];
  ships?: ShipAssignment[];
  requiredShipTypes?: string;
  requiredShips?: ShipRequirement[];
  totalCrewCapacity?: number;
  totalCrewAssigned?: number;

  // Fleet logistics (calculated by RouteCalculationService)
  totalCargoCapacity?: number;
  totalQuantumFuel?: number;
  totalQuantumFuelRequired?: number;
  maxJumpRange?: number;
  hasRefuelShip?: boolean;

  // Mining data
  miningData?: MiningData;
  isMiningOperation?: boolean;
  targetResources?: string;

  // Voice channel
  voiceChannel?: ActivityVoiceChannel;

  // Metadata
  tags?: string[];
  categories?: string[];
  priority?: string;
  isRecurring?: boolean;
  recurringSchedule?: string;
  metadata?: Record<string, unknown>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateActivityDTO {
  title: string;
  description: string;
  activityType: ActivityType;
  visibility: ActivityVisibility;
  primaryOrganizationId?: string;
  location?: string;
  systemLocation?: string;
  coordinates?: string;
  startTime?: Date;
  endTime?: Date;
  estimatedDuration?: number;
  maxParticipants?: number;
  roleRequirements?: RoleRequirement[];
  resourceRequirements?: ResourceRequirement[];
  difficultyLevel?: string;
  recommendedLevel?: number;
  rewards?: string;
  payout?: number;
  tags?: string[];
  categories?: string[];
  priority?: string;
  isRecurring?: boolean;
  recurringSchedule?: string;
  routePlan?: RouteWaypoint[];
  autoEnrichMining?: boolean;
  createVoiceChannel?: boolean;
  voiceChannelLimit?: number;
}

export interface AvailableCrewPosition {
  shipId: string;
  shipType: string;
  shipName?: string;
  ownerId: string;
  ownerName: string;
  availableSlots: number;
  capabilities?: string[];
}
