/**
 * Member Audit / Intel Flag Types
 *
 * Shared types for the Membership Audit & Intel system (Wave 2.1).
 * These types define behavioral flags automatically raised when members
 * perform notable actions (leave orgs, get moderated, switch primaries, etc.).
 */

// ─── Flag Type ───────────────────────────────────────────────────────

/**
 * The kind of behavioral event that generated a flag.
 * Each maps to a specific detection hook in the backend.
 */
export enum MemberFlagType {
  /** Member left an RSI organization they were previously in */
  RSI_ORG_LEFT = 'rsi_org_left',
  /** Member joined an RSI org on the watchlist as hostile */
  JOINED_HOSTILE_ORG = 'joined_hostile_org',
  /** Member joined an RSI org that is redacted / hidden */
  JOINED_REDACTED_ORG = 'joined_redacted_org',
  /** Member's rank changed in an RSI organization */
  RSI_RANK_CHANGED = 'rsi_rank_changed',
  /** Member left the Discord server (kick, ban, or voluntary) */
  DISCORD_LEFT = 'discord_left',
  /** Member's Discord roles changed significantly */
  DISCORD_ROLE_CHANGED = 'discord_role_changed',
  /** Member received a moderation action (local or shared) */
  MODERATION_ACTION_RECEIVED = 'moderation_action_received',
  /** A shared moderation action was received from another org */
  MODERATION_ACTION_SHARED = 'moderation_action_shared',
  /** Member switched their primary organization */
  PRIMARY_ORG_SWITCHED = 'primary_org_switched',
  /** Member left the platform entirely */
  PLATFORM_LEFT = 'platform_left',
  /** RSI handle or display name changed (possible identity evasion) */
  RSI_HANDLE_CHANGED = 'rsi_handle_changed',
  /** Suspected impersonation — RSI handle conflict between users */
  IMPERSONATION_SUSPECTED = 'impersonation_suspected',
  /** RSI sync repeatedly failing (account may be deleted) */
  RSI_SYNC_FAILED = 'rsi_sync_failed',
  /** RSI organization dissolved / no longer exists */
  RSI_ORG_DISSOLVED = 'rsi_org_dissolved',
  /** Member unlinked their Discord account from the platform */
  DISCORD_UNLINKED = 'discord_unlinked',
  /** Member was removed from a team (Wave 2.6 integration) */
  TEAM_MEMBER_REMOVED = 'team_member_removed',
  /** A team was deleted while it still had active members (Wave 2.6 integration) */
  TEAM_DELETED_WITH_MEMBERS = 'team_deleted_with_members',
  /** An activity was cancelled (Wave 2.3 integration) */
  ACTIVITY_CANCELLED = 'activity_cancelled',
  /** Manual flag created by an intel officer */
  MANUAL = 'manual',

  // ── RSI Sync Intel Flags (Wave 3.3) ──
  /** Member is in the web app but no longer found in the RSI org listing */
  MISSING_FROM_RSI = 'missing_from_rsi',
  /** Member is in RSI/web app but not in the org's Discord guild */
  MISSING_FROM_DISCORD = 'missing_from_discord',
  /** Member is in the RSI org listing but not linked in the web app */
  MISSING_FROM_WEB_APP = 'missing_from_web_app',
  /** Discord role doesn't match the expected role from RSI rank mapping */
  ROLE_MISMATCH_DISCORD = 'role_mismatch_discord',
  /** Internal web app role doesn't match the expected role from RSI rank mapping */
  ROLE_MISMATCH_INTERNAL = 'role_mismatch_internal',
  /** Member is hidden or has a redacted profile on RSI */
  HIDDEN_RSI_MEMBER = 'hidden_rsi_member',
  /** Member is an affiliate, not a primary member of this org */
  AFFILIATE_NOT_PRIMARY = 'affiliate_not_primary',
  /** Member has not verified their RSI identity */
  RSI_NOT_VERIFIED = 'rsi_not_verified',
}

// ─── Flag Severity ───────────────────────────────────────────────────

/**
 * Severity level for a member audit flag.
 * String enum for readability — aligns with ModerationIncident pattern.
 */
export enum FlagSeverity {
  /** Informational — no action required */
  INFO = 'info',
  /** Medium — worth monitoring */
  MEDIUM = 'medium',
  /** High — should be reviewed soon */
  HIGH = 'high',
  /** Critical — immediate attention recommended */
  CRITICAL = 'critical',
}

/** Ordered severity for comparison (higher = more severe) */
export const FLAG_SEVERITY_ORDER: Record<FlagSeverity, number> = {
  [FlagSeverity.INFO]: 1,
  [FlagSeverity.MEDIUM]: 2,
  [FlagSeverity.HIGH]: 3,
  [FlagSeverity.CRITICAL]: 4,
};

// ─── Flag Status ─────────────────────────────────────────────────────

/**
 * Resolution status for a flag.
 */
export enum FlagStatus {
  /** Flag is open and unresolved */
  OPEN = 'open',
  /** Flag has been resolved by an officer */
  RESOLVED = 'resolved',
  /** Flag was dismissed (false positive or not actionable) */
  DISMISSED = 'dismissed',
  /** Flag was escalated to higher authority */
  ESCALATED = 'escalated',
}

// ─── Default Severity Mapping ────────────────────────────────────────

/**
 * Default severity for each flag type.
 * Services can override for specific conditions (e.g., joining a hostile org = CRITICAL).
 */
export const DEFAULT_FLAG_SEVERITY: Record<MemberFlagType, FlagSeverity> = {
  [MemberFlagType.RSI_ORG_LEFT]: FlagSeverity.MEDIUM,
  [MemberFlagType.JOINED_HOSTILE_ORG]: FlagSeverity.CRITICAL,
  [MemberFlagType.JOINED_REDACTED_ORG]: FlagSeverity.HIGH,
  [MemberFlagType.RSI_RANK_CHANGED]: FlagSeverity.INFO,
  [MemberFlagType.DISCORD_LEFT]: FlagSeverity.HIGH,
  [MemberFlagType.DISCORD_ROLE_CHANGED]: FlagSeverity.INFO,
  [MemberFlagType.MODERATION_ACTION_RECEIVED]: FlagSeverity.HIGH,
  [MemberFlagType.MODERATION_ACTION_SHARED]: FlagSeverity.MEDIUM,
  [MemberFlagType.PRIMARY_ORG_SWITCHED]: FlagSeverity.HIGH,
  [MemberFlagType.PLATFORM_LEFT]: FlagSeverity.CRITICAL,
  [MemberFlagType.RSI_HANDLE_CHANGED]: FlagSeverity.HIGH,
  [MemberFlagType.IMPERSONATION_SUSPECTED]: FlagSeverity.CRITICAL,
  [MemberFlagType.RSI_SYNC_FAILED]: FlagSeverity.HIGH,
  [MemberFlagType.RSI_ORG_DISSOLVED]: FlagSeverity.MEDIUM,
  [MemberFlagType.DISCORD_UNLINKED]: FlagSeverity.MEDIUM,
  [MemberFlagType.TEAM_MEMBER_REMOVED]: FlagSeverity.INFO,
  [MemberFlagType.TEAM_DELETED_WITH_MEMBERS]: FlagSeverity.MEDIUM,
  [MemberFlagType.ACTIVITY_CANCELLED]: FlagSeverity.INFO,
  [MemberFlagType.MANUAL]: FlagSeverity.MEDIUM,

  // RSI Sync Intel Flags (Wave 3.3)
  [MemberFlagType.MISSING_FROM_RSI]: FlagSeverity.HIGH,
  [MemberFlagType.MISSING_FROM_DISCORD]: FlagSeverity.MEDIUM,
  [MemberFlagType.MISSING_FROM_WEB_APP]: FlagSeverity.INFO,
  [MemberFlagType.ROLE_MISMATCH_DISCORD]: FlagSeverity.MEDIUM,
  [MemberFlagType.ROLE_MISMATCH_INTERNAL]: FlagSeverity.MEDIUM,
  [MemberFlagType.HIDDEN_RSI_MEMBER]: FlagSeverity.INFO,
  [MemberFlagType.AFFILIATE_NOT_PRIMARY]: FlagSeverity.INFO,
  [MemberFlagType.RSI_NOT_VERIFIED]: FlagSeverity.MEDIUM,
};

// ─── DTOs ────────────────────────────────────────────────────────────

/**
 * DTO for creating a flag (system-generated).
 */
export interface CreateMemberFlagDto {
  /** The user this flag is about */
  userId: string;
  /** The organization context */
  organizationId: string;
  /** Type of behavioral event */
  flagType: MemberFlagType;
  /** Severity (uses default if omitted) */
  severity?: FlagSeverity;
  /** Human-readable description of why the flag was raised */
  description: string;
  /** Machine-readable context (JSON-safe) */
  metadata?: Record<string, unknown>;
  /** ID of related entity (e.g., ModerationIncident.id) */
  relatedEntityId?: string;
  /** Type of related entity (e.g., 'moderation_incident') */
  relatedEntityType?: string;
  /** Whether this flag was auto-generated (vs manual) */
  isAutoGenerated?: boolean;
}

/**
 * DTO for creating a manual flag (by an intel officer).
 */
export interface CreateManualFlagDto {
  /** The user this flag is about */
  userId: string;
  /** Severity of the manual flag */
  severity: FlagSeverity;
  /** Officer's description */
  description: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * DTO for resolving/dismissing/escalating a flag.
 */
export interface ResolveFlagDto {
  /** New status */
  status: FlagStatus.RESOLVED | FlagStatus.DISMISSED | FlagStatus.ESCALATED;
  /** Resolution note */
  resolutionNote: string;
}

/**
 * Query parameters for listing flags.
 */
export interface ListFlagsQuery {
  /** Filter by user */
  userId?: string;
  /** Filter by flag type(s) */
  flagTypes?: MemberFlagType[];
  /** Filter by severity(s) */
  severities?: FlagSeverity[];
  /** Filter by status(s) */
  statuses?: FlagStatus[];
  /** Only auto-generated flags */
  isAutoGenerated?: boolean;
  /** Date range: from */
  dateFrom?: string;
  /** Date range: to */
  dateTo?: string;
  /** Pagination */
  page?: number;
  pageSize?: number;
  /** Sort */
  sortBy?: 'createdAt' | 'severity' | 'flagType';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Summary DTO returned from API.
 */
export interface MemberFlagSummary {
  id: string;
  userId: string;
  organizationId: string;
  flagType: MemberFlagType;
  severity: FlagSeverity;
  status: FlagStatus;
  description: string;
  metadata?: Record<string, unknown>;
  relatedEntityId?: string;
  relatedEntityType?: string;
  isAutoGenerated: boolean;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

/**
 * Aggregated flag stats for a user within an org.
 */
export interface UserFlagStats {
  userId: string;
  organizationId: string;
  totalFlags: number;
  openFlags: number;
  resolvedFlags: number;
  dismissedFlags: number;
  escalatedFlags: number;
  highestSeverity: FlagSeverity | null;
  lastFlagAt: string | null;
}
