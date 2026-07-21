/**
 * Organization entity - represents a Star Citizen organization
 */
export interface Organization {
  id: string;
  name: string;
  description?: string;
  spectrumId?: string;
  logo?: string;
  banner?: string;
  isVerified: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Extended organization entity with computed fields (v2)
 */
export interface OrganizationV2 extends Organization {
  memberCount: number;
  fleetCount: number;
  shipCount: number;
  settings?: OrganizationSettings;
}

export enum OrgScaleTier {
  STANDARD = 'standard',
  LARGE = 'large',
  MEGA = 'mega',
  ULTRA = 'ultra',
}

export interface OrgScalingProfile {
  tier: OrgScaleTier;
  memberCount: number;
  dashboardCacheTtlSeconds: number;
  recommendedPageSize: number;
}

/**
 * Organization settings
 */
export interface OrganizationSettings {
  isPublic: boolean;
  requireApproval: boolean;
  defaultRole?: string;
  /** UEX marketplace org handle (without @) for deep-linking store pages. */
  uexStoreHandle?: string;
}

/**
 * Organization member with role information
 */
export interface OrganizationMember {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  role: string;
  permissions: string[];
  joinedAt: Date | string;
  lastActiveAt?: Date | string;
  shipCount?: number;
}

/**
 * Organization statistics
 */
export interface OrganizationStatistics {
  memberCount: number;
  activeMembers: number;
  fleetCount: number;
  totalShips: number;
  totalShipValue?: number;
  activityCount?: number;
  memberGrowth?: number;
}

/**
 * Request to create a new organization
 */
export interface CreateOrganizationRequest {
  name: string;
  description?: string;
  spectrumId?: string;
}

/**
 * Request to update an existing organization
 */
export interface UpdateOrganizationRequest extends Partial<CreateOrganizationRequest> {
  settings?: Partial<OrganizationSettings>;
}
