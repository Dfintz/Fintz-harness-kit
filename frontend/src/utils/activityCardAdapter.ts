/**
 * Activity Card Adapter
 *
 * Thin mappers from source data shapes to the normalized ActivityCardData
 * interface. No business logic — pure field mapping.
 */

import type { ActivityCardData, ShipCrewBreakdownCardEntry } from '@sc-fleet-manager/shared-types';

import type { UnifiedOpportunityItem } from '@/services/opportunityService';
import type { PublicJobListItem } from '@/services/publicDirectoryService';
import type { ActivityV2 } from '@/types/apiV2';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface SourceShipBreakdown {
  shipName: string;
  crewCapacity: number;
  roles: Array<{ role: string; total: number; filled: number; assignedUserName?: string | null }>;
  isLoaner?: boolean;
  contributedByUserName?: string | null;
  isTransported?: boolean;
  transportType?: 'hangar' | 'cargo';
  passengers?: Array<{ role: string; capacity: number; filled: number }>;
}

function mapShipCrewBreakdown(
  breakdown?: SourceShipBreakdown[]
): ShipCrewBreakdownCardEntry[] | undefined {
  return breakdown?.map(s => ({
    shipName: s.shipName,
    crewCapacity: s.crewCapacity,
    roles: s.roles.map(r => ({
      role: r.role,
      total: r.total,
      filled: r.filled,
      assignedUserName: r.assignedUserName,
    })),
    isLoaner: s.isLoaner,
    contributedByUserName: s.contributedByUserName,
    isTransported: s.isTransported,
    transportType: s.transportType,
    passengers: s.passengers?.map(p => ({
      role: p.role,
      capacity: p.capacity,
      filled: p.filled,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

/**
 * Maps an ActivityV2 API response to the normalized ActivityCardData shape.
 */
export function activityV2ToCardData(activity: ActivityV2): ActivityCardData {
  // The API may return extra fields (payDisplay, tags, etc.) not typed on ActivityV2.
  // Use a loose record to safely access them without unsafe type assertions.
  const extras = activity as Record<string, unknown>;

  return {
    id: activity.id,
    title: activity.title,
    type: (activity.type ?? '').toLowerCase(),
    status: (activity.status ?? '').toLowerCase(),
    description: activity.description,
    visibility: activity.visibility,
    location: activity.location,
    organizationName: activity.organizationName,
    creatorName: undefined, // ActivityV2 doesn't expose creatorName
    startDate: activity.scheduledStartDate ?? activity.startDate,
    estimatedDuration: activity.estimatedDuration,
    postedAt: activity.createdAt,
    currentParticipants: activity.currentParticipants,
    maxParticipants: activity.maxParticipants,
    // Pass through optional fields if API response includes them
    payDisplay: typeof extras.payDisplay === 'string' ? extras.payDisplay : undefined,
    experienceLevel:
      typeof extras.experienceLevel === 'number' || typeof extras.experienceLevel === 'string'
        ? extras.experienceLevel
        : undefined,
    tags: Array.isArray(extras.tags) ? (extras.tags as string[]) : undefined,
  };
}

/**
 * Maps a PublicJobListItem to the normalized ActivityCardData shape.
 */
export function jobListingToCardData(job: PublicJobListItem): ActivityCardData {
  let ownerName: string | undefined;
  if (job.ownerType === 'organization') {
    ownerName = job.organizationName;
  } else if (job.ownerType === 'alliance') {
    ownerName = job.allianceName;
  }

  return {
    id: job.id,
    title: job.title,
    type: 'job_listing',
    status: job.isActive ? 'open' : 'expired',
    description: job.description,
    location: undefined, // job listings don't have a location field
    tags: job.tags,
    languages: job.languages,
    organizationName: ownerName,
    organizationLogoUrl: job.organizationLogoUrl,
    postedAt: job.postedAt,
    expiresAt: job.expiresAt,
    jobType: job.jobType,
    focus: job.focus,
    payDisplay: job.payDisplay,
    experienceLevel: job.experienceLevel,
    listingCategory: job.listingCategory,
    crewSpotsTotal: job.crewSpotsTotal,
    crewSpotsFilled: job.crewSpotsFilled,
    shipCrewBreakdown: mapShipCrewBreakdown(job.shipCrewBreakdown),
    requiredShips: job.requiredShips,
    shipRequirementType: job.shipRequirementType,
  };
}

/**
 * Maps a UnifiedOpportunityItem to the normalized ActivityCardData shape.
 * Handles both 'job' and 'activity' source types.
 */
export function opportunityToCardData(item: UnifiedOpportunityItem): ActivityCardData {
  const isJob = item.sourceType === 'job';

  let ownerName: string | undefined;
  if (item.ownerType === 'organization' || !item.ownerType) {
    ownerName = item.organizationName;
  } else if (item.ownerType === 'alliance') {
    ownerName = item.allianceName;
  }

  const type = isJob ? 'job_listing' : (item.activityType ?? 'event').toLowerCase();
  let status: string;
  if (isJob) {
    status = item.isActive ? 'open' : 'expired';
  } else {
    status = (item.activityStatus ?? 'open').toLowerCase();
  }

  return {
    id: item.id,
    title: item.title,
    type,
    status,
    description: item.description,
    location: item.location,
    tags: item.tags,
    organizationName: ownerName,
    organizationLogoUrl: item.organizationLogoUrl,
    startDate: item.scheduledStartDate,
    postedAt: item.postedAt ?? new Date().toISOString(),
    expiresAt: item.expiresAt,
    currentParticipants: item.currentParticipants,
    maxParticipants: item.maxParticipants,
    jobType: item.jobType,
    focus: item.focus,
    payDisplay: item.payDisplay,
    experienceLevel: item.experienceLevel,
    listingCategory: item.listingCategory,
    crewSpotsTotal: item.crewSpotsTotal,
    crewSpotsFilled: item.crewSpotsFilled,
    shipCrewBreakdown: mapShipCrewBreakdown(
      item.shipCrewBreakdown as SourceShipBreakdown[] | undefined
    ),
    requiredShips: item.requiredShips,
    shipRequirementType: (item.shipRequirementType ?? 'none') as 'none' | 'required' | 'preferred',
  };
}
