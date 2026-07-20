import { apiClient } from './apiClient';
import { unwrapArrayResponse, unwrapResponse } from './baseService';

const BASE = '/api/v2/federations';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FederationRole = 'founder' | 'leader' | 'council' | 'member' | 'observer';
export type FederationStatus = 'forming' | 'active' | 'dissolved';
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
export type ResourceType = 'fleet' | 'intel' | 'routes' | 'discord' | 'infrastructure' | 'other';
export type ResourceAccessLevel = 'all' | 'council' | 'leaders';
export type TreatyType =
  | 'mutual_defense'
  | 'trade'
  | 'resource_sharing'
  | 'non_aggression'
  | 'custom';

export type FederationAssociationType = 'full_member' | 'associate' | 'cooperative' | 'affiliate';
export type MemberActionDecisionMethod = 'chairman_decides' | 'majority_vote' | 'unanimous_vote';

export interface GovernanceSettings {
  votingSystem: 'majority' | 'supermajority' | 'unanimous' | 'weighted';
  requiredApprovalThreshold: number;
  councilSize: number;
  leaderTermDays: number;
  amendmentThreshold: number;
  /** How the chairman seat transitions between orgs */
  successionMode?: 'fixed' | 'rotation' | 'election';
  /** Current acting chairman */
  chairman?: {
    organizationId: string;
    organizationName: string;
    userId: string;
    userName: string;
    termStart: string;
    termEnd: string | null;
  };
  /** Ordered list of org IDs for rotation succession */
  rotationOrder?: string[];
  /** Per-action decision rules for member management */
  memberActionRules?: {
    inviteDecisionMethod?: MemberActionDecisionMethod;
    kickDecisionMethod?: MemberActionDecisionMethod;
    warDeclarationDecisionMethod?: MemberActionDecisionMethod;
  };
}

export interface FederationMember {
  id: string;
  organizationId: string;
  organizationName: string;
  role: FederationRole;
  joinedAt: string;
  status: 'active' | 'invited' | 'pending';
  associationType?: FederationAssociationType;
}

export interface ManagedFederation {
  id: string;
  name: string;
  description: string;
  status: FederationStatus;
  isPublic: boolean;
  tags: string[];
  members: FederationMember[];
  logoUrl?: string;
  bannerUrl?: string;
  discordUrl?: string;
  websiteUrl?: string;
  governance?: GovernanceSettings;
  /** Next scheduled review date (ISO 8601) */
  reviewDate?: string | null;
  /** Expiry date for the federation agreement (ISO 8601) */
  expiryDate?: string | null;
  /** Whether the federation agreement auto-renews on expiry */
  autoRenew?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FederationProposal {
  id: string;
  type: ProposalType;
  title: string;
  description: string;
  status: ProposalStatus;
  votes: Array<{
    organizationId: string;
    organizationName: string;
    vote: VoteChoice;
    comment?: string;
    votedAt: string;
  }>;
  votingDurationDays: number;
  closesAt: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface FederationResource {
  id: string;
  name: string;
  type: ResourceType;
  accessLevel: ResourceAccessLevel;
  description: string;
  addedAt: string;
}

export type TreatySignatureStatus = 'pending' | 'signed' | 'rejected';

export interface TreatySignature {
  organizationId: string;
  organizationName: string;
  status: TreatySignatureStatus;
  respondedAt?: string;
}

export interface FederationTreaty {
  id: string;
  name: string;
  type: TreatyType;
  signatories: string[];
  terms: string[];
  effectiveDate?: string;
  expirationDate?: string;
  status: 'proposed' | 'active' | 'expired' | 'terminated';
  createdAt: string;
  proposedBy: string;
  proposedByName?: string;
  signatures?: TreatySignature[];
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

export interface MemberContribution {
  organizationId: string;
  organizationName: string;
  role: FederationRole;
  contributions: number;
  sharedResources: number;
  votingParticipation: number;
}

export interface FederationSettings {
  enableTitlesBadges: boolean;
  enableFederationFleets: boolean;
  enableFederationDynamicTeams: boolean;
  // Discord settings
  enableCentralDiscord?: boolean;
  autoCreateOrgRoles?: boolean;
  removeRolesOnOrgLeave?: boolean;
  removeRolesOnUserLeave?: boolean;
  conflictResolutionMode?: 'manual' | 'primary_org';
  syncNotificationChannelId?: string | null;
  kickNonMembers?: boolean;
  noAccessRoleId?: string | null;
  ambassadorRoleId?: string | null;
  memberRoleId?: string | null;
  commLinkChannelId?: string | null;
}

export interface FederationFleetReadiness {
  healthScore: number;
  status: 'green' | 'yellow' | 'red';
  readinessPercent: number;
  crewFillPercent: number;
}

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
  readiness: FederationFleetReadiness | null;
  isShared: boolean;
  sharedVia?: string;
}

export interface FederationFleetsResponse {
  federationId: string;
  totalFleets: number;
  fleetsByOrganization: Record<string, number>;
  fleets: FederationFleetItem[];
}

// ─── Ambassador Types ────────────────────────────────────────────────────────

export type FederationAmbassadorRole = 'council' | 'representative' | 'observer';
export type FederationAmbassadorPermission =
  | 'vote'
  | 'announce'
  | 'intel'
  | 'wiki'
  | 'resources'
  | 'hr'
  | 'settings'
  | 'view';

export interface FederationAmbassador {
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
  title: string | null;
  appointedAt: string;
}

// ─── Federation Wiki Types ───────────────────────────────────────────────────

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

// ─── Federation Announcement Types ───────────────────────────────────────────

export type FederationAnnouncementAudience = 'all-members' | 'council' | 'public';

export interface FederationAnnouncement {
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

export interface FederationAnnouncementDiscordPostResult {
  announcement: FederationAnnouncement;
  guildId: string;
  channelId: string;
  messageId: string;
}

// ─── Federation Poll Types ───────────────────────────────────────────────────

export type FederationVotingMode = 'equal' | 'weighted';

export interface FederationPollOption {
  id: string;
  label: string;
  description?: string;
  sortOrder: number;
}

export interface FederationPoll {
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

export interface FederationPollDiscordPostResult {
  mirrorId: string;
  guildId: string;
  channelId: string;
  status: string;
  messageId: string | null;
}

// ─── Federation Team Types ───────────────────────────────────────────────────

export type FederationTeamType =
  | 'task_force'
  | 'diplomatic_mission'
  | 'joint_operation'
  | 'trade_convoy'
  | 'custom';

export type FederationTeamStatus = 'active' | 'disbanded';

export interface FederationTeamMember {
  userId: string;
  userName: string;
  organizationId: string;
  organizationName: string;
  role: string;
}

export interface FederationTeam {
  id: string;
  federationId: string;
  name: string;
  description: string | null;
  type: FederationTeamType;
  leaderId: string | null;
  leaderName: string | null;
  leaderOrgId: string | null;
  members: FederationTeamMember[];
  memberCount: number;
  status: FederationTeamStatus;
  maxMembers: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Federation Intel Types ──────────────────────────────────────────────────

export type FederationIntelClassification = 'open' | 'restricted' | 'secret';
export type FederationIntelStatus = 'draft' | 'pending_review' | 'published' | 'archived';

export interface FederationIntelEntry {
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

// ─── Federation Personnel Types ──────────────────────────────────────────────

export interface FederationPersonnel {
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

export interface FederationPersonnelSummary {
  totalPersonnel: number;
  byOrganization: Record<string, number>;
  totalAmbassadors: number;
}

// ─── Federation Application Types ────────────────────────────────────────────

export type FederationApplicationMode = 'simple' | 'custom' | 'disabled';

export interface FederationApplicationModeResponse {
  mode: FederationApplicationMode;
  questions?: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string;
    options?: string[];
    maxLength?: number;
    order: number;
  }>;
}

export interface FederationApplication {
  id: string;
  federationId: string;
  applicantOrgId: string;
  applicantOrgName: string;
  applicantUserId: string;
  message: string | null;
  formResponses: Record<string, string> | null;
  source: string | null;
  status: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

// ─── Federation Discord Types ────────────────────────────────────────────────

export interface FederationDiscordStatus {
  enabled: boolean;
  centralGuildId: string | null;
  centralGuildName: string | null;
  orgRoleCount: number;
  hierarchyRoleCount: number;
  conflictCount: number;
}

export interface FederationDiscordConflict {
  discordUserId: string;
  discordUsername: string;
  conflictingOrgs: Array<{ orgId: string; orgName: string }>;
  flaggedAt: string;
}

// ─── Federation Discord Guild Settings Types ─────────────────────────────────

export interface FederationDiscordGuildSettingsDTO {
  id: string;
  federationId: string;
  guildId: string;
  guildName?: string;
  guildIconUrl?: string;
  eventSettings?: Record<string, unknown>;
  voiceChannelSettings?: Record<string, unknown>;
  tunnelSettings?: Record<string, unknown>;
  notificationPreferences?: Record<string, unknown>;
  roleSyncSettings?: Record<string, unknown>;
  crossModerationSettings?: Record<string, unknown>;
  ticketSettings?: Record<string, unknown>;
  statSettings?: Record<string, unknown>;
  dmNotificationSettings?: Record<string, unknown>;
  smartLfgPingSettings?: Record<string, unknown>;
  recruitmentSettings?: Record<string, unknown>;
  giveawaySettings?: Record<string, unknown>;
  advancedEventSettings?: Record<string, unknown>;
  teamVoiceSettings?: Record<string, unknown>;
  roleGatingSettings?: Record<string, unknown>;
  lfgNetworkSettings?: Record<string, unknown>;
  lfgSettings?: Record<string, unknown>;
  welcomeSettings?: Record<string, unknown>;
  auditLogSettings?: Record<string, unknown>;
  timezone?: string;
  settingsEnabled: boolean;
  adminUserIds?: string;
  serverManagerRoleIds?: string;
  assistantRoleIds?: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Service ──────────────────────────────────────────────────────────────────

export const federationManagementService = {
  // Federation CRUD
  async getFederation(id: string): Promise<ManagedFederation> {
    const res = await apiClient.get<ManagedFederation>(`${BASE}/${id}`);
    return unwrapResponse<ManagedFederation>(res);
  },

  /**
   * Resolve a slug (or UUID) to a federation ID.
   * Authenticated — works for both public and private federations.
   */
  async resolveSlug(slug: string): Promise<{ id: string; name: string } | null> {
    try {
      const res = await apiClient.get<{ id: string; name: string }>(
        `${BASE}/resolve-slug/${encodeURIComponent(slug)}`
      );
      return unwrapResponse<{ id: string; name: string }>(res);
    } catch {
      return null;
    }
  },

  /**
   * Disband (dissolve) a federation. Founder only.
   * DELETE /api/v2/federations/:id
   */
  async disbandFederation(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/${id}`);
  },

  /**
   * List federations that the user's active org belongs to.
   * GET /api/v2/federations
   */
  async getMyFederations(): Promise<ManagedFederation[]> {
    const res = await apiClient.get<ManagedFederation[]>(BASE);
    return unwrapArrayResponse<ManagedFederation>(res);
  },

  async updateFederation(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      isPublic: boolean;
      tags: string[];
      logoUrl: string;
      bannerUrl: string;
      discordUrl: string;
      websiteUrl: string;
      governance: Partial<GovernanceSettings>;
      reviewDate: string | null;
      expiryDate: string | null;
      autoRenew: boolean;
    }>
  ): Promise<ManagedFederation> {
    const res = await apiClient.put<ManagedFederation>(`${BASE}/${id}`, data);
    return unwrapResponse(res);
  },

  // Members
  async inviteMember(
    federationId: string,
    targetOrgId: string,
    targetOrgName: string,
    role: FederationRole = 'member',
    associationType: FederationAssociationType = 'full_member'
  ): Promise<FederationMember> {
    const res = await apiClient.post<FederationMember>(`${BASE}/${federationId}/members/invite`, {
      targetOrgId,
      targetOrgName,
      role,
      associationType,
    });
    return unwrapResponse(res);
  },

  async acceptInvitation(federationId: string): Promise<FederationMember> {
    const res = await apiClient.post<FederationMember>(
      `${BASE}/${federationId}/members/accept`,
      {}
    );
    return unwrapResponse(res);
  },

  async declineInvitation(federationId: string, memberId: string): Promise<void> {
    await apiClient.delete(`${BASE}/${federationId}/members/${memberId}`);
  },

  async removeMember(federationId: string, memberId: string): Promise<void> {
    await apiClient.delete(`${BASE}/${federationId}/members/${memberId}`);
  },

  async updateMemberRole(
    federationId: string,
    memberId: string,
    role: FederationRole
  ): Promise<FederationMember> {
    const res = await apiClient.put<FederationMember>(
      `${BASE}/${federationId}/members/${memberId}/role`,
      { role }
    );
    return unwrapResponse(res);
  },

  // Proposals
  async listProposals(
    federationId: string,
    status?: ProposalStatus
  ): Promise<FederationProposal[]> {
    const qs = status ? `?status=${status}` : '';
    const res = await apiClient.get<FederationProposal[]>(`${BASE}/${federationId}/proposals${qs}`);
    return unwrapArrayResponse(res);
  },

  async createProposal(
    federationId: string,
    data: {
      type: ProposalType;
      title: string;
      description: string;
      votingDurationDays?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<FederationProposal> {
    const res = await apiClient.post<FederationProposal>(`${BASE}/${federationId}/proposals`, data);
    return unwrapResponse(res);
  },

  async castVote(
    federationId: string,
    proposalId: string,
    vote: VoteChoice,
    comment?: string
  ): Promise<FederationProposal> {
    const res = await apiClient.post<FederationProposal>(
      `${BASE}/${federationId}/proposals/${proposalId}/vote`,
      { vote, ...(comment ? { comment } : {}) }
    );
    return unwrapResponse(res);
  },

  // Resources
  async addResource(
    federationId: string,
    data: {
      name: string;
      type: ResourceType;
      accessLevel?: ResourceAccessLevel;
      description: string;
    }
  ): Promise<FederationResource> {
    const res = await apiClient.post<FederationResource>(`${BASE}/${federationId}/resources`, data);
    return unwrapResponse(res);
  },

  async removeResource(federationId: string, resourceId: string): Promise<void> {
    await apiClient.delete(`${BASE}/${federationId}/resources/${resourceId}`);
  },

  // Treaties
  async createTreaty(
    federationId: string,
    data: {
      name: string;
      type: TreatyType;
      terms: string[];
      effectiveDate?: string;
      expirationDate?: string;
    }
  ): Promise<FederationTreaty> {
    const res = await apiClient.post<FederationTreaty>(`${BASE}/${federationId}/treaties`, data);
    return unwrapResponse(res);
  },

  async respondToTreaty(
    federationId: string,
    treatyId: string,
    action: 'sign' | 'reject'
  ): Promise<FederationTreaty> {
    const res = await apiClient.post<FederationTreaty>(
      `${BASE}/${federationId}/treaties/${treatyId}/respond`,
      { action }
    );
    return unwrapResponse(res);
  },

  async terminateTreaty(federationId: string, treatyId: string): Promise<void> {
    await apiClient.delete(`${BASE}/${federationId}/treaties/${treatyId}`);
  },

  // Analytics
  async getStats(federationId: string): Promise<FederationStats> {
    const res = await apiClient.get<FederationStats>(`${BASE}/${federationId}/stats`);
    return unwrapResponse(res);
  },

  async getContributions(federationId: string): Promise<MemberContribution[]> {
    const res = await apiClient.get<MemberContribution[]>(`${BASE}/${federationId}/contributions`);
    return unwrapArrayResponse(res);
  },

  // Settings
  async getSettings(federationId: string): Promise<FederationSettings> {
    const res = await apiClient.get<FederationSettings>(`${BASE}/${federationId}/settings`);
    return unwrapResponse(res);
  },

  async updateSettings(
    federationId: string,
    data: Partial<FederationSettings>
  ): Promise<FederationSettings> {
    const res = await apiClient.put<FederationSettings>(`${BASE}/${federationId}/settings`, data);
    return unwrapResponse(res);
  },

  // Chairman / Succession
  async updateSuccessionMode(
    federationId: string,
    data: { successionMode: 'fixed' | 'rotation' | 'election'; leaderTermDays?: number }
  ): Promise<GovernanceSettings> {
    const res = await apiClient.put<GovernanceSettings>(
      `${BASE}/${federationId}/succession-mode`,
      data
    );
    return unwrapResponse(res);
  },

  async succeedChairman(federationId: string): Promise<GovernanceSettings> {
    const res = await apiClient.post<GovernanceSettings>(
      `${BASE}/${federationId}/succeed-chairman`
    );
    return unwrapResponse(res);
  },

  // Federation Fleets
  async getFleets(federationId: string): Promise<FederationFleetsResponse> {
    const res = await apiClient.get<FederationFleetsResponse>(`${BASE}/${federationId}/fleets`);
    return unwrapResponse(res);
  },

  // Federation Units
  async getUnits(federationId: string): Promise<unknown> {
    const res = await apiClient.get(`${BASE}/${federationId}/units`);
    return unwrapResponse(res);
  },

  // Ambassadors
  async listAmbassadors(federationId: string): Promise<FederationAmbassador[]> {
    const res = await apiClient.get<FederationAmbassador[]>(`${BASE}/${federationId}/ambassadors`);
    return unwrapArrayResponse(res);
  },

  async appointAmbassador(
    federationId: string,
    data: {
      userId: string;
      userName: string;
      organizationId: string;
      organizationName: string;
      role?: FederationAmbassadorRole;
      permissions?: FederationAmbassadorPermission[];
      title?: string;
      isExternal?: boolean;
    }
  ): Promise<FederationAmbassador> {
    const res = await apiClient.post<FederationAmbassador>(
      `${BASE}/${federationId}/ambassadors`,
      data
    );
    return unwrapResponse(res);
  },

  async updateAmbassador(
    federationId: string,
    ambassadorId: string,
    data: {
      role?: FederationAmbassadorRole;
      permissions?: FederationAmbassadorPermission[];
      title?: string | null;
      isActive?: boolean;
    }
  ): Promise<FederationAmbassador> {
    const res = await apiClient.put<FederationAmbassador>(
      `${BASE}/${federationId}/ambassadors/${ambassadorId}`,
      data
    );
    return unwrapResponse(res);
  },

  async removeAmbassador(federationId: string, ambassadorId: string): Promise<void> {
    await apiClient.delete(`${BASE}/${federationId}/ambassadors/${ambassadorId}`);
  },

  async getMyAmbassadorProfile(federationId: string): Promise<FederationAmbassador | null> {
    const res = await apiClient.get<FederationAmbassador | null>(
      `${BASE}/${federationId}/ambassadors/me`
    );
    return unwrapResponse(res);
  },

  // ── Federation Wiki ─────────────────────────────────────────

  async listWikiPages(federationId: string): Promise<FederationWikiPage[]> {
    const res = await apiClient.get<FederationWikiPage[]>(`${BASE}/${federationId}/wiki`);
    return unwrapArrayResponse(res);
  },

  async getWikiTree(federationId: string): Promise<FederationWikiTreeNode[]> {
    const res = await apiClient.get<FederationWikiTreeNode[]>(`${BASE}/${federationId}/wiki/tree`);
    return unwrapArrayResponse(res);
  },

  async getWikiPage(federationId: string, pageId: string): Promise<FederationWikiPage> {
    const res = await apiClient.get<FederationWikiPage>(`${BASE}/${federationId}/wiki/${pageId}`);
    return unwrapResponse(res);
  },

  async createWikiPage(
    federationId: string,
    data: {
      title: string;
      content?: string;
      parentPageId?: string | null;
      tags?: string[];
      visibility?: FederationWikiVisibility;
    }
  ): Promise<FederationWikiPage> {
    const res = await apiClient.post<FederationWikiPage>(`${BASE}/${federationId}/wiki`, data);
    return unwrapResponse(res);
  },

  async updateWikiPage(
    federationId: string,
    pageId: string,
    data: {
      title?: string;
      content?: string;
      tags?: string[];
      changeDescription?: string;
      isLocked?: boolean;
      visibility?: FederationWikiVisibility;
    }
  ): Promise<FederationWikiPage> {
    const res = await apiClient.put<FederationWikiPage>(
      `${BASE}/${federationId}/wiki/${pageId}`,
      data
    );
    return unwrapResponse(res);
  },

  async deleteWikiPage(federationId: string, pageId: string): Promise<void> {
    await apiClient.delete(`${BASE}/${federationId}/wiki/${pageId}`);
  },

  // ── Federation Announcements ────────────────────────────────

  async listFederationAnnouncements(federationId: string): Promise<FederationAnnouncement[]> {
    const res = await apiClient.get<FederationAnnouncement[]>(
      `${BASE}/${federationId}/announcements`
    );
    return unwrapArrayResponse(res);
  },

  async createFederationAnnouncement(
    federationId: string,
    data: {
      title: string;
      content: string;
      targetAudience?: FederationAnnouncementAudience;
    }
  ): Promise<FederationAnnouncement> {
    const res = await apiClient.post<FederationAnnouncement>(
      `${BASE}/${federationId}/announcements`,
      data
    );
    return unwrapResponse(res);
  },

  async deleteFederationAnnouncement(federationId: string, announcementId: string): Promise<void> {
    await apiClient.delete(`${BASE}/${federationId}/announcements/${announcementId}`);
  },

  async toggleAnnouncementPin(
    federationId: string,
    announcementId: string
  ): Promise<FederationAnnouncement> {
    const res = await apiClient.put<FederationAnnouncement>(
      `${BASE}/${federationId}/announcements/${announcementId}/pin`
    );
    return unwrapResponse(res);
  },

  async postFederationAnnouncementToDiscord(
    federationId: string,
    announcementId: string,
    channelId: string
  ): Promise<FederationAnnouncementDiscordPostResult> {
    const res = await apiClient.post<FederationAnnouncementDiscordPostResult>(
      `${BASE}/${federationId}/announcements/${announcementId}/post`,
      { channelId }
    );
    return unwrapResponse(res);
  },

  // ── Federation Polls ────────────────────────────────────────

  async listFederationPolls(federationId: string, status?: string): Promise<FederationPoll[]> {
    const qs = status ? `?status=${status}` : '';
    const res = await apiClient.get<FederationPoll[]>(`${BASE}/${federationId}/polls${qs}`);
    return unwrapArrayResponse(res);
  },

  async createFederationPoll(
    federationId: string,
    data: {
      title: string;
      description?: string;
      pollType?: string;
      options: Array<{ label: string; description?: string }>;
      votingMode?: FederationVotingMode;
      isAnonymous?: boolean;
      maxSelections?: number;
      endsAt?: string;
    }
  ): Promise<FederationPoll> {
    const res = await apiClient.post<FederationPoll>(`${BASE}/${federationId}/polls`, data);
    return unwrapResponse(res);
  },

  async castFederationVote(
    federationId: string,
    pollId: string,
    optionId: string
  ): Promise<FederationPollResults> {
    const res = await apiClient.post<FederationPollResults>(
      `${BASE}/${federationId}/polls/${pollId}/vote`,
      { optionId }
    );
    return unwrapResponse(res);
  },

  async getFederationPollResults(
    federationId: string,
    pollId: string
  ): Promise<FederationPollResults> {
    const res = await apiClient.get<FederationPollResults>(
      `${BASE}/${federationId}/polls/${pollId}/results`
    );
    return unwrapResponse(res);
  },

  async closeFederationPoll(federationId: string, pollId: string): Promise<FederationPoll> {
    const res = await apiClient.put<FederationPoll>(
      `${BASE}/${federationId}/polls/${pollId}/close`
    );
    return unwrapResponse(res);
  },

  async deleteFederationPoll(federationId: string, pollId: string): Promise<void> {
    await apiClient.delete(`${BASE}/${federationId}/polls/${pollId}`);
  },

  async postFederationPollToDiscord(
    federationId: string,
    pollId: string,
    channelId: string
  ): Promise<FederationPollDiscordPostResult> {
    const res = await apiClient.post<FederationPollDiscordPostResult>(
      `${BASE}/${federationId}/polls/${pollId}/post`,
      { channelId }
    );
    return unwrapResponse(res);
  },

  // ── Federation Teams ────────────────────────────────────────

  async listFederationTeams(federationId: string): Promise<FederationTeam[]> {
    const res = await apiClient.get<FederationTeam[]>(`${BASE}/${federationId}/teams`);
    return unwrapArrayResponse(res);
  },

  async createFederationTeam(
    federationId: string,
    data: {
      name: string;
      description?: string;
      type?: FederationTeamType;
      maxMembers?: number;
      leaderId?: string;
      leaderName?: string;
      leaderOrgId?: string;
    }
  ): Promise<FederationTeam> {
    const res = await apiClient.post<FederationTeam>(`${BASE}/${federationId}/teams`, data);
    return unwrapResponse(res);
  },

  async updateFederationTeam(
    federationId: string,
    teamId: string,
    data: {
      name?: string;
      description?: string | null;
      type?: FederationTeamType;
      maxMembers?: number;
      status?: FederationTeamStatus;
    }
  ): Promise<FederationTeam> {
    const res = await apiClient.put<FederationTeam>(
      `${BASE}/${federationId}/teams/${teamId}`,
      data
    );
    return unwrapResponse(res);
  },

  async addFederationTeamMember(
    federationId: string,
    teamId: string,
    member: FederationTeamMember
  ): Promise<FederationTeam> {
    const res = await apiClient.post<FederationTeam>(
      `${BASE}/${federationId}/teams/${teamId}/members`,
      member
    );
    return unwrapResponse(res);
  },

  async removeFederationTeamMember(
    federationId: string,
    teamId: string,
    memberUserId: string
  ): Promise<FederationTeam> {
    const res = await apiClient.delete<FederationTeam>(
      `${BASE}/${federationId}/teams/${teamId}/members/${memberUserId}`
    );
    return unwrapResponse(res);
  },

  async deleteFederationTeam(federationId: string, teamId: string): Promise<void> {
    await apiClient.delete(`${BASE}/${federationId}/teams/${teamId}`);
  },

  // ── Federation Intel ────────────────────────────────────────

  async listFederationIntel(
    federationId: string,
    filters?: { classification?: string; status?: string }
  ): Promise<FederationIntelEntry[]> {
    const params: Record<string, string> = {};
    if (filters?.classification) params.classification = filters.classification;
    if (filters?.status) params.status = filters.status;
    const res = await apiClient.get<FederationIntelEntry[]>(`${BASE}/${federationId}/intel`, {
      params,
    });
    return unwrapArrayResponse(res);
  },

  async submitFederationIntel(
    federationId: string,
    data: {
      title: string;
      content: string;
      classification?: FederationIntelClassification;
      tags?: string[];
      visibleToTreaties?: string[];
    }
  ): Promise<FederationIntelEntry> {
    const res = await apiClient.post<FederationIntelEntry>(`${BASE}/${federationId}/intel`, data);
    return unwrapResponse(res);
  },

  async updateFederationIntel(
    federationId: string,
    intelId: string,
    data: {
      title?: string;
      content?: string;
      classification?: FederationIntelClassification;
      tags?: string[];
      visibleToTreaties?: string[];
    }
  ): Promise<FederationIntelEntry> {
    const res = await apiClient.put<FederationIntelEntry>(
      `${BASE}/${federationId}/intel/${intelId}`,
      data
    );
    return unwrapResponse(res);
  },

  async approveFederationIntel(
    federationId: string,
    intelId: string
  ): Promise<FederationIntelEntry> {
    const res = await apiClient.put<FederationIntelEntry>(
      `${BASE}/${federationId}/intel/${intelId}/approve`
    );
    return unwrapResponse(res);
  },

  async archiveFederationIntel(
    federationId: string,
    intelId: string
  ): Promise<FederationIntelEntry> {
    const res = await apiClient.put<FederationIntelEntry>(
      `${BASE}/${federationId}/intel/${intelId}/archive`
    );
    return unwrapResponse(res);
  },

  async deleteFederationIntel(federationId: string, intelId: string): Promise<void> {
    await apiClient.delete(`${BASE}/${federationId}/intel/${intelId}`);
  },

  // ── Federation Personnel ────────────────────────────────────

  async listFederationPersonnel(federationId: string): Promise<FederationPersonnel[]> {
    const res = await apiClient.get<FederationPersonnel[]>(`${BASE}/${federationId}/personnel`);
    return unwrapArrayResponse(res);
  },

  async getFederationPersonnelSummary(federationId: string): Promise<FederationPersonnelSummary> {
    const res = await apiClient.get<FederationPersonnelSummary>(
      `${BASE}/${federationId}/personnel/summary`
    );
    return unwrapResponse(res);
  },

  // ── Federation Applications ─────────────────────────────────

  async getFederationApplicationMode(
    federationId: string
  ): Promise<FederationApplicationModeResponse> {
    const res = await apiClient.get<FederationApplicationModeResponse>(
      `${BASE}/${federationId}/application-mode`
    );
    return unwrapResponse(res);
  },

  async submitFederationApplication(
    federationId: string,
    data: { message?: string; formResponses?: Record<string, string>; source?: string }
  ): Promise<FederationApplication> {
    const res = await apiClient.post<FederationApplication>(
      `${BASE}/${federationId}/applications`,
      data
    );
    return unwrapResponse(res);
  },

  async listFederationApplications(
    federationId: string,
    status?: string
  ): Promise<FederationApplication[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    const res = await apiClient.get<FederationApplication[]>(
      `${BASE}/${federationId}/applications`,
      { params }
    );
    return unwrapArrayResponse(res);
  },

  async reviewFederationApplication(
    federationId: string,
    appId: string,
    decision: 'approved' | 'rejected',
    note?: string
  ): Promise<FederationApplication> {
    const res = await apiClient.put<FederationApplication>(
      `${BASE}/${federationId}/applications/${appId}/review`,
      { decision, note }
    );
    return unwrapResponse(res);
  },

  async withdrawFederationApplication(federationId: string, appId: string): Promise<void> {
    await apiClient.delete(`${BASE}/${federationId}/applications/${appId}`);
  },

  // ── Federation Discord ──────────────────────────────────────

  async getFederationDiscordStatus(federationId: string): Promise<FederationDiscordStatus> {
    const res = await apiClient.get<FederationDiscordStatus>(
      `${BASE}/${federationId}/discord/status`
    );
    return unwrapResponse(res);
  },

  async setupFederationDiscord(
    federationId: string,
    guildId: string,
    guildName: string
  ): Promise<FederationDiscordStatus> {
    const res = await apiClient.post<FederationDiscordStatus>(
      `${BASE}/${federationId}/discord/setup`,
      { guildId, guildName }
    );
    return unwrapResponse(res);
  },

  async unlinkFederationDiscord(federationId: string): Promise<FederationDiscordStatus> {
    const res = await apiClient.delete<FederationDiscordStatus>(`${BASE}/${federationId}/discord`);
    return unwrapResponse(res);
  },

  async getFederationDiscordConflicts(federationId: string): Promise<FederationDiscordConflict[]> {
    const res = await apiClient.get<FederationDiscordConflict[]>(
      `${BASE}/${federationId}/discord/conflicts`
    );
    return unwrapArrayResponse(res);
  },

  async resolveFederationDiscordConflict(
    federationId: string,
    discordUserId: string,
    chosenOrgId: string
  ): Promise<{ orgRoleId: string | null; hierarchyRoleId: string | null }> {
    const res = await apiClient.post(
      `${BASE}/${federationId}/discord/conflicts/${discordUserId}/resolve`,
      { chosenOrgId }
    );
    return unwrapResponse(res);
  },

  // ── Federation Discord Guild Settings ──────────────────────

  async getFederationGuildSettingsList(
    federationId: string
  ): Promise<FederationDiscordGuildSettingsDTO[]> {
    const res = await apiClient.get(`${BASE}/${federationId}/discord/guild-settings`);
    return unwrapResponse(res);
  },

  async getFederationGuildSettings(
    federationId: string,
    guildId: string
  ): Promise<FederationDiscordGuildSettingsDTO> {
    const res = await apiClient.get(`${BASE}/${federationId}/discord/guild-settings/${guildId}`);
    return unwrapResponse(res);
  },

  async updateFederationGuildSettingsSection(
    federationId: string,
    guildId: string,
    section: string,
    data: Record<string, unknown>
  ): Promise<FederationDiscordGuildSettingsDTO> {
    const res = await apiClient.patch(
      `${BASE}/${federationId}/discord/guild-settings/${guildId}/${section}`,
      data
    );
    return unwrapResponse(res);
  },
};
