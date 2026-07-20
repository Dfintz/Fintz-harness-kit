/**
 * RSI Member Intel Service
 *
 * Frontend service for member intelligence endpoints (Wave 3.3).
 * Provides member listing, intel cards, enrichment, audit, and role validation.
 */

import { apiClient } from './apiClient';
import { BaseService, unwrapResponse } from './baseService';

// ─── Types ─────────────────────────────────────────────────────────────

export interface MemberIntelSummary {
  rsiHandle: string;
  displayName?: string;
  rsiRank?: string;
  rsiStars: number;
  isMainOrg: boolean;
  isAffiliate: boolean;
  isHidden: boolean;
  isRedacted: boolean;
  isLinked: boolean;
  isInDiscord: boolean;
  activeFlagCount: number;
  hasMismatch: boolean;
}

export interface MemberIntelCard {
  rsiHandle: string;
  displayName?: string;
  rsiRank?: string;
  rsiStars: number;
  rsiRoles?: string[];
  isMainOrg: boolean;
  isAffiliate: boolean;
  isHidden: boolean;
  isRedacted: boolean;
  avatar?: string;
  enlisted?: string;
  lastCrawledAt?: string;

  otherOrgs: Array<{
    sid: string;
    name: string;
    rank?: string;
    stars?: number;
    isMain: boolean;
  }>;

  webAppStatus: {
    isLinked: boolean;
    syncStatus?: string;
    userId?: string;
    membershipRole?: string;
    isActiveMember: boolean;
  };

  discordStatus: {
    isInGuild: boolean;
    discordUserId?: string;
    discordRoles: Array<{ id: string; name: string }>;
    expectedDiscordRoleId?: string;
    expectedDiscordRoleName?: string;
    hasCorrectRole: boolean;
  };

  activeFlags: Array<{
    id: string;
    flagType: string;
    severity: string;
    description: string;
    createdAt: string;
  }>;

  roleMappingStatus: {
    expectedMapping?: {
      rsiRank: string;
      discordRoleId?: string;
      internalRoleId?: string;
    };
    isRankMatchingMapping: boolean;
    isDiscordRoleCorrect: boolean;
    isInternalRoleCorrect: boolean;
    mismatches: string[];
  };
}

export interface EnrichmentResult {
  rsiHandle: string;
  orgsFound: number;
  success: boolean;
  error?: string;
}

export interface BatchEnrichmentResult {
  total: number;
  enriched: number;
  failed: number;
  results: EnrichmentResult[];
}

export interface AuditRunResult {
  organizationId: string;
  totalChecked: number;
  flagsCreated: number;
  flagsSkipped: number;
  errors: string[];
  flagsByType: Record<string, number>;
}

export interface RoleMappingValidationResult {
  organizationId: string;
  totalMembers: number;
  validatedMembers: number;
  mismatches: Array<{
    rsiHandle: string;
    userId?: string;
    rsiRank: string;
    expectedMapping: {
      discordRoleId?: string;
      internalRoleId?: string;
    };
    actual: {
      discordRoles: string[];
      internalRoleId?: string;
    };
    issues: string[];
  }>;
  unmappedRanks: string[];
  summary: {
    correctDiscordRoles: number;
    incorrectDiscordRoles: number;
    correctInternalRoles: number;
    incorrectInternalRoles: number;
    noMappingDefined: number;
    notInDiscord: number;
  };
}

export interface MemberIntelListResponse {
  readonly members: readonly MemberIntelSummary[];
  readonly count: number;
  /** 'ok' | 'no_schedule' | 'no_members' */
  readonly status?: string;
}

export interface LinkCandidate {
  userId: string;
  username: string;
  discordId?: string;
  isAlreadyLinked: boolean;
  existingRsiHandle?: string;
}

export interface ManualLinkInput {
  userId: string;
  discordUserId?: string;
}

export interface ManualLinkResult {
  success: boolean;
  linkId: string;
  rsiHandle: string;
  userId: string;
}

export interface ClearCacheResult {
  crawledMembers: number;
  citizenOrgs: number;
  memberCache: number;
}

// ─── Service ───────────────────────────────────────────────────────────

class RsiMemberIntelServiceFrontend extends BaseService {
  protected basePath = '/api/v2/rsi/members';

  async getMemberList(organizationId: string): Promise<MemberIntelListResponse> {
    try {
      this.log('getMemberList', { organizationId });
      const response = await apiClient.get<MemberIntelListResponse>(
        `${this.basePath}/${organizationId}/intel`
      );
      return unwrapResponse<MemberIntelListResponse>(response);
    } catch (error) {
      this.handleError(error, 'getMemberList');
    }
  }

  async getMemberCard(organizationId: string, rsiHandle: string): Promise<MemberIntelCard> {
    try {
      this.log('getMemberCard', { organizationId, rsiHandle });
      const response = await apiClient.get<MemberIntelCard>(
        `${this.basePath}/${organizationId}/intel/${encodeURIComponent(rsiHandle)}`
      );
      return unwrapResponse<MemberIntelCard>(response);
    } catch (error) {
      this.handleError(error, 'getMemberCard');
    }
  }

  async enrichMember(organizationId: string, rsiHandle: string): Promise<EnrichmentResult> {
    try {
      this.log('enrichMember', { organizationId, rsiHandle });
      const response = await apiClient.post<EnrichmentResult>(
        `${this.basePath}/${organizationId}/intel/${encodeURIComponent(rsiHandle)}/enrich`
      );
      return unwrapResponse<EnrichmentResult>(response);
    } catch (error) {
      this.handleError(error, 'enrichMember');
    }
  }

  async enrichAll(organizationId: string): Promise<BatchEnrichmentResult> {
    try {
      this.log('enrichAll', { organizationId });
      const response = await apiClient.post<BatchEnrichmentResult>(
        `${this.basePath}/${organizationId}/intel/enrich-all`
      );
      return unwrapResponse<BatchEnrichmentResult>(response);
    } catch (error) {
      this.handleError(error, 'enrichAll');
    }
  }

  async runAudit(organizationId: string, guildId?: string): Promise<AuditRunResult> {
    try {
      this.log('runAudit', { organizationId, guildId });
      const response = await apiClient.post<AuditRunResult>(
        `${this.basePath}/${organizationId}/intel/audit`,
        guildId ? { guildId } : {}
      );
      return unwrapResponse<AuditRunResult>(response);
    } catch (error) {
      this.handleError(error, 'runAudit');
    }
  }

  async validateRoles(
    organizationId: string,
    guildId?: string
  ): Promise<RoleMappingValidationResult> {
    try {
      this.log('validateRoles', { organizationId, guildId });
      const response = await apiClient.post<RoleMappingValidationResult>(
        `${this.basePath}/${organizationId}/intel/validate-roles`,
        guildId ? { guildId } : {}
      );
      return unwrapResponse<RoleMappingValidationResult>(response);
    } catch (error) {
      this.handleError(error, 'validateRoles');
    }
  }

  async getLinkCandidates(organizationId: string, query?: string): Promise<LinkCandidate[]> {
    try {
      this.log('getLinkCandidates', { organizationId, query });
      const params = query ? `?q=${encodeURIComponent(query)}` : '';
      const response = await apiClient.get<LinkCandidate[]>(
        `${this.basePath}/${organizationId}/intel/link-candidates${params}`
      );
      return unwrapResponse<LinkCandidate[]>(response);
    } catch (error) {
      this.handleError(error, 'getLinkCandidates');
    }
  }

  async manualLink(
    organizationId: string,
    rsiHandle: string,
    input: ManualLinkInput
  ): Promise<ManualLinkResult> {
    try {
      this.log('manualLink', { organizationId, rsiHandle, input });
      const response = await apiClient.post<ManualLinkResult>(
        `${this.basePath}/${organizationId}/intel/${encodeURIComponent(rsiHandle)}/link`,
        input
      );
      return unwrapResponse<ManualLinkResult>(response);
    } catch (error) {
      this.handleError(error, 'manualLink');
    }
  }

  async unlinkMember(organizationId: string, rsiHandle: string): Promise<{ success: boolean }> {
    try {
      this.log('unlinkMember', { organizationId, rsiHandle });
      const response = await apiClient.delete<{ success: boolean }>(
        `${this.basePath}/${organizationId}/intel/${encodeURIComponent(rsiHandle)}/link`
      );
      return unwrapResponse<{ success: boolean }>(response);
    } catch (error) {
      this.handleError(error, 'unlinkMember');
    }
  }

  async clearCache(organizationId: string): Promise<ClearCacheResult> {
    try {
      this.log('clearCache', { organizationId });
      const response = await apiClient.post<ClearCacheResult>(
        `${this.basePath}/${organizationId}/intel/clear-cache`
      );
      return unwrapResponse<ClearCacheResult>(response);
    } catch (error) {
      this.handleError(error, 'clearCache');
    }
  }
}

export const rsiMemberIntelService = new RsiMemberIntelServiceFrontend();
