/**
 * ActivityService DTOs and result shapes.
 *
 * Extracted from `ActivityService.ts` (E5 large-file decomposition) to establish a
 * types/logic ownership boundary on the activity domain's largest service. The
 * service module re-exports every interface below, so all existing
 * `./ActivityService` and `services/activity` import paths are preserved.
 */
import type {
  Activity,
  ActivityStatus,
  ActivityType,
  ActivityVisibility,
  ParticipantRole,
  RouteWaypoint,
} from '../../models/Activity';

export interface CreateActivityDTO {
  title: string;
  description: string;
  activityType: ActivityType;
  creatorId: string;
  creatorName: string;
  organizationId?: string;
  organizationName?: string;
  visibility?: ActivityVisibility;
  scheduledStartDate?: Date;
  scheduledEndDate?: Date;
  timezone?: string;
  estimatedDuration?: number;
  location?: string;
  systemLocation?: string;
  maxParticipants?: number;
  minParticipants?: number;
  roleRequirements?: Array<{ role: string; count: number; required: boolean }>;
  resourceRequirements?: Array<{ type: string; quantity: number; notes?: string }>;
  rewardCredits?: number;
  rewardReputation?: number;
  tags?: string[];
  categories?: string[];
  metadata?: Record<string, unknown>;

  // Voice channel options
  createVoiceChannel?: boolean;
  voiceChannelTemplate?: string;
  voiceChannelLimit?: number;
  voiceChannelBitrate?: number;

  // Route planning
  routePlan?: RouteWaypoint[];

  // Auto-enrich mining data
  autoEnrichMining?: boolean;

  // Crew member validation (M1 - Organization crew verification)
  crewMembers?: Array<{ userId: string; userName?: string }>;
}

export interface JoinActivityDTO {
  userId: string;
  userName: string;
  organizationId?: string;
  organizationName?: string;
  role: ParticipantRole;
  shipType?: string;
  shipName?: string;
  message?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivitySearchFilters {
  activityType?: ActivityType | ActivityType[];
  status?: ActivityStatus | ActivityStatus[];
  visibility?: ActivityVisibility;
  organizationId?: string;
  participatingOrgIds?: string[];
  creatorId?: string;
  tags?: string[];
  categories?: string[];
  startDate?: Date;
  endDate?: Date;
  minParticipants?: number;
  maxParticipants?: number;
  hasOpenSlots?: boolean;
  isFeatured?: boolean;
  isUrgent?: boolean;
  searchTerm?: string;
}

export interface ActivityStatistics {
  totalActivities: number;
  activeActivities: number;
  completedActivities: number;
  totalParticipants: number;
  averageParticipants: number;
  successRate: number;
  byType: Record<ActivityType, number>;
  byOrganization: Record<string, number>;
  totalCreditsRewarded: number;
  totalReputationRewarded: number;
}

export interface BringFleetAndInviteResult {
  activity: Activity;
  invited: string[];
  skipped: string[];
  status: 'full' | 'ships_only';
  inviteError?: string;
}

export interface ShipManagementCapabilities {
  manageableShipIdentifiers: string[];
}
