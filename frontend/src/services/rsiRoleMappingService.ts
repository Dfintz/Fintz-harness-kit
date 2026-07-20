/**
 * RSI Role Mapping Service
 *
 * Frontend service for managing RSI rank → Discord role → web role mappings.
 * Calls the backend /api/v2/rsi/role-mapping endpoints.
 */

import { apiClient } from './apiClient';
import { BaseService, unwrapResponse } from './baseService';

/**
 * The 4 fixed RSI role types that every RSI organization has.
 * Each org customises the display name (e.g. Founder → "CEO"), but the
 * underlying type is always one of these four.
 */
export const RSI_ROLE_TYPES = ['Founder', 'Officer', 'Recruitment', 'Marketing'] as const;

/**
 * Default RSI rank name per star level (0–5).
 * Every RSI org has exactly 6 star-based ranks with customisable names.
 * These are the RSI defaults shown when creating a new org.
 */
export const STANDARD_STAR_RANKS: Record<number, string> = {
  0: 'Rank 0',
  1: 'Rank 1',
  2: 'Rank 2',
  3: 'Rank 3',
  4: 'Rank 4',
  5: 'Rank 5',
};

/**
 * Fallback options shown when no crawled data is available.
 * Includes all 4 fixed RSI roles + all 6 star-based rank defaults.
 */
export const RSI_RANKS_FALLBACK = [
  // RSI Roles (fixed)
  'Founder',
  'Officer',
  'Recruitment',
  'Marketing',
  // RSI Ranks (star-based, 5→0)
  'Rank 5',
  'Rank 4',
  'Rank 3',
  'Rank 2',
  'Rank 1',
  'Rank 0',
] as const;

export type RsiRank = string;

/**
 * Discovered RSI ranks returned from crawled member data
 */
export interface DiscoveredRanks {
  /** Text role names observed in crawled members (e.g. "Founder", "Officer") */
  roles: string[];
  /** Numeric star ranks observed in crawled members (0-5) */
  ranks: number[];
  /** Star-to-rank-name mapping with member counts */
  rankMap: Array<{ stars: number; name: string; count: number }>;
  /** RSI organizational roles (e.g. "CEO", "VP") discovered from crawled members */
  orgRoles?: string[];
}

export interface RbacPermissions {
  fleetView?: boolean;
  fleetEdit?: boolean;
  fleetManage?: boolean;
  orgView?: boolean;
  orgEdit?: boolean;
  orgManage?: boolean;
  eventView?: boolean;
  eventManage?: boolean;
  intelView?: boolean;
  intelManage?: boolean;
  admin?: boolean;
  custom?: Record<string, boolean>;
}

export interface RoleMappingSummary {
  rsiRank: string;
  hasDiscordRole: boolean;
  discordRoleId: string | null;
  hasInternalRole: boolean;
  hasAutoAssignTeams: boolean;
  permissionCount: number;
  isActive: boolean;
  priority: number;
}

export interface RoleMapping {
  id: string;
  rsiRank: string;
  discordRoleId?: string;
  internalRoleId?: string;
  rbacPermissions?: RbacPermissions;
  isActive: boolean;
  priority: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  summary?: RoleMappingSummary;
}

export interface RoleMappingListResponse {
  readonly mappings: readonly RoleMapping[];
  readonly count: number;
}

export interface CreateRoleMappingInput {
  rsiRank: string;
  discordRoleId?: string;
  rbacPermissions?: RbacPermissions;
  isActive?: boolean;
  priority?: number;
  description?: string;
  internalRoleId?: string;
}

export interface UpdateRoleMappingInput {
  discordRoleId?: string;
  rbacPermissions?: RbacPermissions;
  isActive?: boolean;
  priority?: number;
  description?: string;
  internalRoleId?: string;
}

export interface RoleMappingTemplate {
  name: string;
  description: string;
  mappings: Array<{
    rsiRank: string;
    priority: number;
    description: string;
  }>;
}

class RsiRoleMappingService extends BaseService {
  protected basePath = '/api/v2/rsi/role-mapping';

  async getMappings(
    organizationId: string,
    includeInactive = false
  ): Promise<RoleMappingListResponse> {
    try {
      this.log('getMappings', { organizationId });
      const params: Record<string, string> = {};
      if (includeInactive) params.includeInactive = 'true';

      const response = await apiClient.get<RoleMappingListResponse>(
        `${this.basePath}/${organizationId}`,
        { params }
      );
      return unwrapResponse<RoleMappingListResponse>(response);
    } catch (error) {
      this.handleError(error, 'getMappings');
    }
  }

  async createMapping(organizationId: string, input: CreateRoleMappingInput): Promise<RoleMapping> {
    try {
      this.log('createMapping', { organizationId, input });
      const response = await apiClient.post<{ data: { mapping: RoleMapping } }>(
        `${this.basePath}/${organizationId}`,
        input
      );
      const data = unwrapResponse<{ mapping: RoleMapping }>(response);
      return data.mapping;
    } catch (error) {
      this.handleError(error, 'createMapping');
    }
  }

  async updateMapping(
    organizationId: string,
    mappingId: string,
    input: UpdateRoleMappingInput
  ): Promise<RoleMapping> {
    try {
      this.log('updateMapping', { organizationId, mappingId });
      const response = await apiClient.put<{ data: { mapping: RoleMapping } }>(
        `${this.basePath}/${organizationId}/${mappingId}`,
        input
      );
      const data = unwrapResponse<{ mapping: RoleMapping }>(response);
      return data.mapping;
    } catch (error) {
      this.handleError(error, 'updateMapping');
    }
  }

  async deleteMapping(organizationId: string, mappingId: string): Promise<void> {
    try {
      this.log('deleteMapping', { organizationId, mappingId });
      await apiClient.delete(`${this.basePath}/${organizationId}/${mappingId}`);
    } catch (error) {
      this.handleError(error, 'deleteMapping');
    }
  }

  async getTemplates(): Promise<RoleMappingTemplate[]> {
    try {
      this.log('getTemplates');
      const response = await apiClient.get<{ data: { templates: RoleMappingTemplate[] } }>(
        `${this.basePath}/templates`
      );
      const data = unwrapResponse<{ templates: RoleMappingTemplate[] }>(response);
      return data.templates ?? [];
    } catch (error) {
      this.handleError(error, 'getTemplates');
    }
  }

  async getDiscoveredRanks(organizationId: string): Promise<DiscoveredRanks> {
    try {
      this.log('getDiscoveredRanks', { organizationId });
      const response = await apiClient.get<{ data: DiscoveredRanks }>(
        `${this.basePath}/${organizationId}/discovered-ranks`
      );
      return unwrapResponse<DiscoveredRanks>(response);
    } catch (error) {
      this.handleError(error, 'getDiscoveredRanks');
    }
  }

  async getOrganizationRoles(
    organizationId: string
  ): Promise<Array<{ id: string; name: string; description: string }>> {
    try {
      this.log('getOrganizationRoles', { organizationId });
      const response = await apiClient.get<{
        data: { roles: Array<{ id: string; name: string; description: string }> };
      }>('/api/v2/roles', { params: { organizationId, limit: 100 } });
      const data = unwrapResponse<{
        roles: Array<{ id: string; name: string; description: string }>;
      }>(response);
      return data.roles ?? [];
    } catch (error) {
      this.handleError(error, 'getOrganizationRoles');
    }
  }
}

export const rsiRoleMappingService = new RsiRoleMappingService();
