/**
 * RsiUserLinkService types (E5 decomposition).
 *
 * The input/result/config types + the `AffiliateHandling` enum for RSI user-link
 * verification and org role-sync, produced and consumed by {@link RsiUserLinkService}.
 * Extracted into a sibling module so the service file holds orchestration logic
 * only. Re-exported from `./RsiUserLinkService` (and the `services/rsi` barrel) so
 * every import path — including `rsiSyncScheduler` — is preserved.
 */

import type { VerificationMethod } from '../../models/RsiUserLink';

/**
 * Input for creating a user link
 */
export interface CreateUserLinkInput {
  userId: string;
  organizationId: string;
  rsiHandle: string;
  verificationMethod: VerificationMethod;
  discordUserId?: string;
}

/**
 * Result of a verification attempt
 */
export interface VerificationResult {
  success: boolean;
  verified: boolean;
  error?: string;
  rank?: string;
  isAffiliate?: boolean;
}

/**
 * Result of syncing a single user
 */
export interface UserSyncResult {
  userId: string;
  rsiHandle: string;
  success: boolean;
  rolesAdded: string[];
  rolesRemoved: string[];
  newRank?: string;
  previousRank?: string;
  error?: string;
  /** True if user was removed from the organization */
  isRemoved?: boolean;
}

/**
 * Result of running a full organization sync
 */
export interface OrgSyncResult {
  organizationId: string;
  totalUsers: number;
  synced: number;
  failed: number;
  removed: number;
  errors: string[];
  duration: number;
  userResults: UserSyncResult[];
}

/**
 * Affiliate handling options
 */
export enum AffiliateHandling {
  /** Include affiliates in role sync */
  INCLUDE = 'include',
  /** Exclude affiliates from role sync */
  EXCLUDE = 'exclude',
  /** Assign a specific role to affiliates */
  SPECIAL_ROLE = 'special_role',
}

/**
 * Configuration for org sync
 */
export interface OrgSyncConfig {
  affiliateHandling: AffiliateHandling;
  affiliateRoleId?: string;
  removeRolesOnLeave: boolean;
  guildId: string;
  rsiOrgSid: string;
}

