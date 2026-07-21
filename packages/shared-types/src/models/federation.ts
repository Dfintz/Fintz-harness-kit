/**
 * Federation (Alliance Enhancement) — Shared Types
 *
 * Multi-organization federation system with governance, proposals,
 * shared resources, treaties, and public directory.
 *
 * @module federation
 */

import type { ApplicationQuestion } from './application.js';
import type { VoiceServerConfig } from './voiceServer.js';

// ─── Enums / Literal Unions ────────────────────────────────────

export type FederationRole = 'founder' | 'leader' | 'council' | 'member' | 'observer';

export type FederationStatus = 'forming' | 'active' | 'dissolved';

export type FederationMemberStatus = 'pending' | 'active' | 'suspended';

/**
 * Association type for member organizations.
 * - `full_member`:  Full voting member with all rights and obligations
 * - `associate`:    Affiliated org with limited voting, partial obligations
 * - `cooperative`:  Cooperative relationship — coordinated on specific initiatives
 * - `affiliate`:    Loosely associated org, mostly informational/diplomatic ties
 */
export type FederationAssociationType = 'full_member' | 'associate' | 'cooperative' | 'affiliate';

/**
 * How a member action (invite, kick, war declaration) is decided.
 * - `chairman_decides`:  The chairman/president unilaterally decides
 * - `majority_vote`:     Simple majority of eligible voters (>50%)
 * - `unanimous_vote`:    All eligible voters must approve (target org excluded for kicks)
 */
export type MemberActionDecisionMethod = 'chairman_decides' | 'majority_vote' | 'unanimous_vote';

export type VotingSystem = 'majority' | 'supermajority' | 'unanimous' | 'weighted';

export type ProposalType =
  | 'add_member'
  | 'remove_member'
  | 'amend_governance'
  | 'add_treaty'
  | 'declare_war'
  | 'dissolve'
  | 'custom';

export type ProposalStatus = 'open' | 'passed' | 'rejected' | 'expired';

export type VoteChoice = 'approve' | 'reject' | 'abstain';

export type SharedResourceType =
  'fleet' | 'intel' | 'routes' | 'discord' | 'infrastructure' | 'other';

export type SharedResourceAccessLevel = 'all' | 'council' | 'leaders';

export type TreatyType =
  'mutual_defense' | 'trade' | 'resource_sharing' | 'non_aggression' | 'custom';

export type TreatyStatus = 'proposed' | 'active' | 'expired' | 'terminated';

export type TreatySignatureStatus = 'pending' | 'signed' | 'rejected';

/**
 * Tracks an individual org's response to a treaty proposal.
 */
export interface TreatySignature {
  organizationId: string;
  organizationName: string;
  status: TreatySignatureStatus;
  respondedAt?: string; // ISO 8601
}

/**
 * How the federation chairman seat transitions.
 * - `fixed`:    Chairman never changes (permanent founder rule)
 * - `rotation`: Automatically cycles through eligible orgs
 * - `election`: Member orgs vote for the next chairman
 */
export type SuccessionMode = 'fixed' | 'rotation' | 'election';

// ─── Chairman (nested in Governance JSON) ──────────────────────

/**
 * Current chairman state, persisted inside FederationGovernance.
 * The chairman is the acting leader of the federation.
 */
export interface FederationChairman {
  /** The org currently holding the chair */
  organizationId: string;
  organizationName: string;
  /** The individual user acting as chairman (ambassador) */
  userId: string;
  userName: string;
  /** When this term started */
  termStart: string; // ISO 8601
  /** When this term ends (null for fixed succession) */
  termEnd: string | null;
}

// ─── Governance (JSON column) ──────────────────────────────────

export interface FederationGovernance {
  votingSystem: VotingSystem;
  requiredApprovalThreshold: number; // 0-100
  councilSize: number;
  leaderTermDays: number;
  amendmentThreshold: number; // 0-100
  /** How the chairman seat transitions between orgs */
  successionMode?: SuccessionMode;
  /** Current chairman — set on creation, updated on succession */
  chairman?: FederationChairman;
  /** Ordered list of org IDs for rotation succession */
  rotationOrder?: string[];
  /** Per-action decision rules for member management */
  memberActionRules?: MemberActionRules;
}

/**
 * Configurable decision rules for key federation actions.
 * Each action can be resolved by chairman fiat or put to a vote.
 * For `unanimous_vote` on kicks, the target org is automatically excluded.
 */
export interface MemberActionRules {
  /** How new org invitations are decided (default: chairman_decides) */
  inviteDecisionMethod: MemberActionDecisionMethod;
  /** How member kicks/removals are decided (default: chairman_decides) */
  kickDecisionMethod: MemberActionDecisionMethod;
  /** How war declarations are decided (default: majority_vote) */
  warDeclarationDecisionMethod: MemberActionDecisionMethod;
}

// ─── Shared Resource (JSON array on Federation) ────────────────

export interface SharedResource {
  id: string;
  name: string;
  type: SharedResourceType;
  providedBy: string; // Organization ID
  accessLevel: SharedResourceAccessLevel;
  description: string;
}

// ─── Treaty (JSON array on Federation) ─────────────────────────

export interface FederationTreaty {
  id: string;
  name: string;
  type: TreatyType;
  /** Org IDs that have signed (kept for backward compat, derived from signatures) */
  signatories: string[];
  terms: string[];
  effectiveDate: string; // ISO 8601
  expirationDate?: string;
  status: TreatyStatus;
  /** The org that proposed the treaty */
  proposedBy: string;
  proposedByName?: string;
  /** Per-org signature tracking */
  signatures?: TreatySignature[];
}

// ─── Vote (JSON array on FederationProposal) ───────────────────

export interface FederationVote {
  organizationId: string;
  organizationName: string;
  vote: VoteChoice;
  votedBy: string;
  votedAt: string; // ISO 8601
  weight: number;
  comment?: string;
}

// ─── Core Interfaces ──────────────────────────────────────────

export interface Federation {
  id: string;
  name: string;
  description: string;
  founderId: string;
  founderOrgId: string;
  governance: FederationGovernance;
  sharedResources: SharedResource[];
  treaties: FederationTreaty[];
  status: FederationStatus;
  isPublic: boolean;
  tags: string[];
  logoUrl?: string | null;
  bannerUrl?: string | null;
  discordUrl?: string | null;
  websiteUrl?: string | null;
  /** Next scheduled review date (ISO 8601) */
  reviewDate?: string | null;
  /** Expiry date for the federation agreement (ISO 8601) */
  expiryDate?: string | null;
  /** Whether the federation agreement auto-renews on expiry */
  autoRenew?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FederationMemberResponse {
  id: string;
  federationId: string;
  organizationId: string;
  organizationName: string;
  role: FederationRole;
  status: FederationMemberStatus;
  /** The association level of this org within the federation */
  associationType: FederationAssociationType;
  votingPower: number;
  contributions: number;
  joinedAt: string;
}

export interface FederationProposalResponse {
  id: string;
  federationId: string;
  type: ProposalType;
  title: string;
  description: string;
  proposedBy: string;
  proposedByOrg: string;
  votes: FederationVote[];
  status: ProposalStatus;
  requiredApproval: number;
  metadata?: Record<string, unknown> | null;
  votingEndsAt: string;
  createdAt: string;
}

export interface FederationStats {
  totalMembers: number;
  activeMembers: number;
  totalVotingPower: number;
  sharedResourcesCount: number;
  activeTreaties: number;
  openProposals: number;
  averageTrustScore: number;
  combinedMemberCount: number;
}

// ─── Public Directory ──────────────────────────────────────────

export interface PublicFederationListItem {
  id: string;
  slug?: string;
  name: string;
  description: string;
  memberCount: number;
  memberOrganizations: Array<{
    organizationId: string;
    organizationName: string;
    role: FederationRole;
    isPublic: boolean;
  }>;
  tags: string[];
  createdAt: string;
  sharedResourceTypes: string[];
  treatyCount: number;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  discordUrl?: string | null;
  websiteUrl?: string | null;
}

// ─── Request DTOs ──────────────────────────────────────────────

export interface CreateFederationRequest {
  name: string;
  description: string;
  isPublic?: boolean;
  tags?: string[];
  governance?: Partial<FederationGovernance>;
  logoUrl?: string;
  bannerUrl?: string;
  discordUrl?: string;
  websiteUrl?: string;
}

export interface UpdateFederationRequest {
  name?: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  governance?: Partial<FederationGovernance>;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  discordUrl?: string | null;
  websiteUrl?: string | null;
  /** Next scheduled review date (ISO 8601) */
  reviewDate?: string | null;
  /** Expiry date for the federation agreement (ISO 8601) */
  expiryDate?: string | null;
  /** Whether the federation agreement auto-renews on expiry */
  autoRenew?: boolean;
}

export interface CreateProposalRequest {
  type: ProposalType;
  title: string;
  description: string;
  votingDurationDays?: number;
  metadata?: Record<string, unknown>;
}

export interface CastVoteRequest {
  vote: VoteChoice;
  comment?: string;
}

export interface AddSharedResourceRequest {
  name: string;
  type: SharedResourceType;
  accessLevel: SharedResourceAccessLevel;
  description: string;
}

export interface CreateTreatyRequest {
  name: string;
  type: TreatyType;
  terms: string[];
  effectiveDate?: string;
  expirationDate?: string;
}

export interface SignTreatyRequest {
  action: 'sign' | 'reject';
}

export interface InviteMemberRequest {
  targetOrgId: string;
  targetOrgName: string;
  role?: FederationRole;
  associationType?: FederationAssociationType;
}

export interface UpdateMemberRoleRequest {
  role: FederationRole;
}

// ─── Federation Settings (JSON column) ─────────────────────────

/**
 * Per-federation feature toggles.
 * Stored as a jsonb column on the `federations` table.
 */
export interface FederationSettings {
  /** Allow federation-level custom titles & badges */
  enableTitlesBadges?: boolean;
  /** Allow federation-level shared fleets (reuses org fleet infra) */
  enableFederationFleets?: boolean;
  /** Allow federation-level dynamic teams (reuses org team infra) */
  enableFederationDynamicTeams?: boolean;
  /** Allow organizations to self-apply to join (default: true for public federations) */
  allowSelfApplication?: boolean;
  /** Require council approval for applications (default: true) */
  requireApproval?: boolean;
  /** Custom application form questions (same type as Organization.settings) */
  applicationQuestions?: ApplicationQuestion[];
  // Central Discord Server
  /** Enable federation central Discord server feature */
  enableCentralDiscord?: boolean;
  /** Discord guild ID of the central server */
  centralGuildId?: string;
  /** Cached guild name for display */
  centralGuildName?: string;
  /** Mapping: orgId → Discord role ID in the central guild */
  orgRoleMappings?: Record<string, string>;
  /** Mapping: federation role → Discord role ID */
  hierarchyRoleMappings?: Record<string, string>;
  /** How to handle users in multiple member orgs */
  conflictResolutionMode?: 'manual' | 'primary_org';
  /** Auto-create Discord roles for each member org */
  autoCreateOrgRoles?: boolean;
  /** Strip roles when org leaves federation */
  removeRolesOnOrgLeave?: boolean;
  /** Strip roles when user leaves their org */
  removeRolesOnUserLeave?: boolean;
  /** Channel ID for sync notifications */
  syncNotificationChannelId?: string;
  /** Discord role ID assigned to non-member users (no org affiliation) */
  noAccessRoleId?: string;
  /** Kick users who are not members of any federation org (instead of assigning noAccessRole) */
  kickNonMembers?: boolean;
  /** Discord role ID for ambassadors — provides elevated channel access */
  ambassadorRoleId?: string;
  /** Discord role ID for general verified federation members */
  memberRoleId?: string;
  /** Discord text channel ID pre-configured for comm link connections */
  commLinkChannelId?: string;
  /** Persisted conflict queue — users in multiple member orgs awaiting manual resolution */
  discordConflicts?: Array<{
    discordUserId: string;
    discordUsername: string;
    conflictingOrgs: Array<{ orgId: string; orgName: string }>;
    flaggedAt: string;
  }>;
  /** External voice server configuration (Mumble, TeamSpeak, etc.) */
  voiceServer?: VoiceServerConfig;
}

export interface UpdateFederationSettingsRequest {
  enableTitlesBadges?: boolean;
  enableFederationFleets?: boolean;
  enableFederationDynamicTeams?: boolean;
  allowSelfApplication?: boolean;
  requireApproval?: boolean;
  applicationQuestions?: ApplicationQuestion[];
  enableCentralDiscord?: boolean;
  autoCreateOrgRoles?: boolean;
  removeRolesOnOrgLeave?: boolean;
  removeRolesOnUserLeave?: boolean;
  conflictResolutionMode?: 'manual' | 'primary_org';
  syncNotificationChannelId?: string;
  kickNonMembers?: boolean;
  /** Voice server configuration (Mumble, TeamSpeak, etc.) */
  voiceServer?: VoiceServerConfig;
}

/** Application mode for federation membership */
export type FederationApplicationMode = 'simple' | 'custom' | 'disabled';

// ─── Federation Fleet Aggregation ──────────────────────────────

/** Summary of an org-scoped fleet visible at federation level */
export interface FederationFleetItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  type: string;
  memberCount: number;
  shipCount: number;
  organizationId: string;
  organizationName: string;
  visibility: string;
  /** Fleet readiness info (null if health data unavailable) */
  readiness: FederationFleetReadiness | null;
  /** Whether this fleet is shared via a diplomacy treaty (not a direct federation member fleet) */
  isShared: boolean;
  /** The diplomacy treaty type through which this fleet is shared (only set when isShared=true) */
  sharedVia?: string;
}

/** Lightweight readiness snapshot for federation fleet aggregation */
export interface FederationFleetReadiness {
  /** Overall health score 0-100 */
  healthScore: number;
  /** Readiness status: green (≥75), yellow (50-74), red (<50) */
  status: 'green' | 'yellow' | 'red';
  /** Percentage of flight-ready ships */
  readinessPercent: number;
  /** Crew fill rate percentage */
  crewFillPercent: number;
}

/** Aggregated federation fleets response */
export interface FederationFleetsResponse {
  federationId: string;
  totalFleets: number;
  fleetsByOrganization: Record<string, number>;
  fleets: FederationFleetItem[];
}

// ─── Federation Units (Cross-Org Teams) ────────────────────────

/** Summary of an org-scoped team visible at federation level */
export interface FederationUnitItem {
  id: string;
  name: string;
  description: string | null;
  type: string;
  memberCount: number;
  maxMembers: number;
  isActive: boolean;
  organizationId: string;
  organizationName: string;
}

/** Aggregated federation units response */
export interface FederationUnitsResponse {
  federationId: string;
  totalUnits: number;
  unitsByOrganization: Record<string, number>;
  units: FederationUnitItem[];
}

// ─── Ambassador System ────────────────────────────────────────

export type FederationAmbassadorRole = 'council' | 'representative' | 'observer';

export type FederationAmbassadorPermission =
  'vote' | 'announce' | 'intel' | 'wiki' | 'resources' | 'hr' | 'settings' | 'view';

export interface FederationAmbassadorResponse {
  id: string;
  federationId: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  userName: string;
  role: FederationAmbassadorRole;
  permissions: FederationAmbassadorPermission[];
  isActive: boolean;
  isExternal: boolean;
  title?: string | null;
  appointedAt: string;
}

export interface AppointAmbassadorRequest {
  userId: string;
  userName: string;
  organizationId: string;
  organizationName: string;
  role?: FederationAmbassadorRole;
  permissions?: FederationAmbassadorPermission[];
  title?: string;
  isExternal?: boolean;
}

export interface UpdateAmbassadorRequest {
  role?: FederationAmbassadorRole;
  permissions?: FederationAmbassadorPermission[];
  title?: string | null;
  isActive?: boolean;
}

// ─── Federation Wiki (Phase 2) ────────────────────────────────

export type FederationWikiVisibility = 'public' | 'members' | 'council';

export interface FederationWikiPage {
  id: string;
  federationId: string;
  title: string;
  slug: string;
  content: string;
  parentPageId?: string | null;
  sortOrder: number;
  tags: string[];
  version: number;
  isLocked: boolean;
  federationVisibility: FederationWikiVisibility;
  createdBy: string;
  lastEditedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FederationWikiTreeNode extends FederationWikiPage {
  children: FederationWikiTreeNode[];
}

export interface CreateFederationWikiPageRequest {
  title: string;
  content?: string;
  parentPageId?: string | null;
  tags?: string[];
  visibility?: FederationWikiVisibility;
}

export interface UpdateFederationWikiPageRequest {
  title?: string;
  content?: string;
  tags?: string[];
  changeDescription?: string;
  isLocked?: boolean;
  visibility?: FederationWikiVisibility;
}

// ─── Federation Announcements (Phase 2) ───────────────────────

export type FederationAnnouncementAudience = 'all-members' | 'council' | 'public';

export interface FederationAnnouncementResponse {
  id: string;
  federationId: string;
  title: string;
  content: string;
  targetAudience: FederationAnnouncementAudience;
  createdBy: string;
  createdByName: string | null;
  status: string;
  createdAt: string;
  sentAt: string | null;
  pinnedAt: string | null;
}

export interface CreateFederationAnnouncementRequest {
  title: string;
  content: string;
  targetAudience?: FederationAnnouncementAudience;
}

// ─── Federation Polls (Phase 3) ───────────────────────────────

export type FederationVotingMode = 'equal' | 'weighted';

export interface FederationPollOption {
  id: string;
  label: string;
  description?: string;
  sortOrder: number;
}

export interface FederationPollResponse {
  id: string;
  federationId: string;
  title: string;
  description: string | null;
  pollType: string;
  options: FederationPollOption[];
  votingMode: FederationVotingMode;
  isAnonymous: boolean;
  maxSelections: number;
  status: string;
  createdBy: string;
  createdByName: string | null;
  endsAt: string | null;
  closedAt: string | null;
  totalVotes: number;
  createdAt: string;
}

export interface FederationPollResults {
  pollId: string;
  totalVotes: number;
  optionCounts: Record<string, number>;
  hasVoted: boolean;
}

export interface CreateFederationPollRequest {
  title: string;
  description?: string;
  pollType?: string;
  options: Array<{ label: string; description?: string }>;
  votingMode?: FederationVotingMode;
  isAnonymous?: boolean;
  maxSelections?: number;
  endsAt?: string;
}

// ─── Federation Teams (Phase 3) ───────────────────────────────

export type FederationTeamType =
  'task_force' | 'diplomatic_mission' | 'joint_operation' | 'trade_convoy' | 'custom';

export type FederationTeamStatus = 'active' | 'disbanded';

export interface FederationTeamMemberData {
  userId: string;
  userName: string;
  organizationId: string;
  organizationName: string;
  role: string;
}

export interface FederationTeamResponse {
  id: string;
  federationId: string;
  name: string;
  description: string | null;
  type: FederationTeamType;
  leaderId: string | null;
  leaderName: string | null;
  leaderOrgId: string | null;
  members: FederationTeamMemberData[];
  memberCount: number;
  status: FederationTeamStatus;
  maxMembers: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFederationTeamRequest {
  name: string;
  description?: string;
  type?: FederationTeamType;
  maxMembers?: number;
  leaderId?: string;
  leaderName?: string;
  leaderOrgId?: string;
}

export interface UpdateFederationTeamRequest {
  name?: string;
  description?: string | null;
  type?: FederationTeamType;
  maxMembers?: number;
  leaderId?: string | null;
  leaderName?: string | null;
  leaderOrgId?: string | null;
  status?: FederationTeamStatus;
}

export interface AddFederationTeamMemberRequest {
  userId: string;
  userName: string;
  organizationId: string;
  organizationName: string;
  role?: string;
}

// ─── Federation Intel (Phase 4) ───────────────────────────────

export type FederationIntelClassification = 'open' | 'restricted' | 'secret';
export type FederationIntelStatus = 'draft' | 'pending_review' | 'published' | 'archived';

export interface FederationIntelEntryResponse {
  id: string;
  federationId: string;
  title: string;
  content: string;
  classification: FederationIntelClassification;
  status: FederationIntelStatus;
  submittedBy: string;
  submittedByName: string | null;
  submittedByOrgId: string | null;
  approvedBy: string | null;
  tags: string[];
  visibleToTreaties: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateFederationIntelRequest {
  title: string;
  content: string;
  classification?: FederationIntelClassification;
  tags?: string[];
  visibleToTreaties?: string[];
}

export interface UpdateFederationIntelRequest {
  title?: string;
  content?: string;
  classification?: FederationIntelClassification;
  tags?: string[];
  visibleToTreaties?: string[];
}

// ─── Federation Personnel (Phase 5) ──────────────────────────

export interface FederationPersonnelResponse {
  userId: string;
  userName: string;
  organizationId: string;
  organizationName: string;
  orgRole: string;
  title: string | null;
  isAmbassador: boolean;
  ambassadorRole: string | null;
  ambassadorTitle: string | null;
  joinedAt: string | null;
}

export interface FederationPersonnelSummaryResponse {
  totalPersonnel: number;
  byOrganization: Record<string, number>;
  totalAmbassadors: number;
}

// ─── Federation Discord (Appendix C) ─────────────────────────

export interface FederationDiscordConflict {
  discordUserId: string;
  discordUsername: string;
  conflictingOrgs: Array<{ orgId: string; orgName: string }>;
  flaggedAt: string;
}

export interface FederationDiscordStatus {
  enabled: boolean;
  centralGuildId: string | null;
  centralGuildName: string | null;
  orgRoleCount: number;
  hierarchyRoleCount: number;
  conflictCount: number;
}
