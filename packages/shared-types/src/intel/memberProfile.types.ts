/**
 * Member Profile Types
 *
 * Shared types for the aggregated Member Intel Profile (Wave 2.1).
 * A MemberIntelProfile combines data from 6+ sources into a single
 * view for an intel officer.
 */
import type { MemberFlagSummary, UserFlagStats } from './memberAudit.types';
import type { WatchlistCrossReferenceResult } from './orgWatchlist.types';

// ─── RSI Presence ────────────────────────────────────────────────────

export interface RsiPresence {
  /** RSI spectrum handle */
  rsiHandle: string;
  /** Verification status of the RSI link */
  verificationStatus: 'pending' | 'verified' | 'failed' | 'removed';
  /** Last sync timestamp (ISO) */
  lastSyncedAt: string | null;
  /** Rank within the querying org's RSI chapter */
  rank: string | null;
  /** Whether the member is an affiliate (not main) */
  isAffiliate: boolean;
  /** Whether this org is the user's main/primary RSI affiliation */
  isPrimaryOrg?: boolean;
  /** Whether the user was found in the org's RSI member crawl */
  isFoundInOrg?: boolean;
  /** Whether the user's membership in this org is hidden/redacted */
  isHidden?: boolean;
  /** Other RSI orgs this member appears in (from member cache) */
  otherRsiOrgs: RsiOrgMembership[];
}

export interface RsiOrgMembership {
  rsiOrgSid: string;
  rsiOrgName?: string;
  rank: string;
  isAffiliate: boolean;
  /** Whether this is the user's main (primary) RSI affiliation */
  isPrimary?: boolean;
  /** Whether the user's membership in this org is hidden/redacted */
  isHidden?: boolean;
}

// ─── Discord Presence ────────────────────────────────────────────────

export interface DiscordPresence {
  discordId: string;
  /** Display name in the guild */
  displayName: string | null;
  /** Guild (server) ID */
  guildId?: string;
  /** Guild (server) name */
  guildName?: string;
  /** Role IDs in the guild */
  roleIds: string[];
  /** Role names in the guild */
  roleNames: string[];
  /** Current online status (null if not fetched / bot offline) */
  status: 'online' | 'idle' | 'dnd' | 'offline' | null;
  /** Joined the guild at (ISO) */
  joinedAt: string | null;
  /** Whether the user is a member of the Discord guild */
  isInGuild?: boolean;
}

// ─── Platform Membership ─────────────────────────────────────────────

export interface PlatformMembership {
  organizationId: string;
  organizationName?: string;
  role: string;
  title: string | null;
  isActive: boolean;
  /** Whether this is the user's primary org in the web application */
  isPrimary?: boolean;
  joinedAt: string | null;
}

// ─── Moderation Summary ──────────────────────────────────────────────

export interface ModerationSummary {
  totalIncidents: number;
  activeIncidents: number;
  highestSeverity: string | null;
  sharedIncidents: number;
  lastIncidentAt: string | null;
}

// ─── Role Alignment ──────────────────────────────────────────────────

/** Role alignment check between RSI rank, Discord role, and web app role */
export interface MemberRoleAlignment {
  /** RSI rank as reported by the crawler */
  rsiRank: string | null;
  /** Discord role expected from RsiRoleMapping */
  mappedDiscordRole: string | null;
  /** Actual Discord roles the user has in the guild */
  actualDiscordRoles: string[];
  /** Internal web-app role expected from RsiRoleMapping */
  mappedWebRole: string | null;
  /** Actual OrganizationMembership role */
  actualWebRole: string;
  /** Whether all roles are aligned across systems */
  isAligned: boolean;
  /** Descriptions of any mismatches found */
  mismatches: string[];
}

// ─── Aggregated Profile ──────────────────────────────────────────────

/**
 * Aggregated member intel profile.
 * Built per (userId, organizationId) by MemberProfileService.
 */
export interface MemberIntelProfile {
  /** Target user ID */
  userId: string;
  /** Querying organization ID */
  organizationId: string;
  /** Platform username for display */
  username?: string;

  /** RSI account link + org memberships */
  rsi: RsiPresence | null;

  /** Discord guild presence (cached, may be null if bot offline) */
  discord: DiscordPresence | null;

  /** Platform org memberships */
  platformMemberships: PlatformMembership[];

  /** Citizen watchlist cross-reference hits */
  watchlistHits: WatchlistCrossReferenceResult[];

  /** Active audit flags for this user in the querying org */
  activeFlags: MemberFlagSummary[];

  /** Aggregated flag stats */
  flagStats: UserFlagStats;

  /** Moderation incident summary */
  moderation: ModerationSummary | null;

  /** Role alignment check across RSI, Discord, and web app */
  roleAlignment: MemberRoleAlignment | null;

  /** Profile generation timestamp (ISO) */
  generatedAt: string;
}
