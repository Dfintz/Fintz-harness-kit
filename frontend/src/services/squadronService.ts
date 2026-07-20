import type {
  AddSquadronMemberInput,
  PaginationParams,
  SquadronMember,
  SquadronMemberListParams,
  SquadronStatistics,
  UpdateSquadronRoleInput,
} from '@/types/apiV2';
import type { SquadronRoleStats, SquadronShipStats } from '@sc-fleet-manager/shared-types';
import { apiClient } from './apiClient';
import { BaseService, extractData, extractPaginatedData } from './baseService';

/**
 * Squadron Service
 * People-management within fleets: member roster, roles, statistics.
 */
class SquadronService extends BaseService {
  protected basePath = '/api/v2/squadrons';

  // ============================================================================
  // Member Queries
  // ============================================================================

  /**
   * Get members of a squadron with pagination & filtering
   * GET /api/v2/squadrons/:squadronId/members
   */
  async getMembers(squadronId: string, params?: SquadronMemberListParams) {
    try {
      this.log('getMembers', { squadronId, params });

      const queryParams = {
        ...this.getPaginationParams(params),
        status: params?.status,
        role: params?.role,
        search: params?.search,
        sortBy: params?.sortBy,
        sortOrder: params?.sortOrder,
      };

      const response = await apiClient.getPaginated<SquadronMember>(
        `${this.basePath}/${squadronId}/members`,
        { params: queryParams }
      );

      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'getMembers');
    }
  }

  /**
   * Get a specific member by ID
   * GET /api/v2/squadrons/:squadronId/members/:memberId
   */
  async getMemberById(squadronId: string, memberId: string) {
    try {
      this.log('getMemberById', { squadronId, memberId });

      const response = await apiClient.get<SquadronMember>(
        `${this.basePath}/${squadronId}/members/${memberId}`
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getMemberById');
    }
  }

  /**
   * Check if a user is a member of a squadron
   * GET /api/v2/squadrons/:squadronId/members/:userId/check
   */
  async checkMembership(squadronId: string, userId: string) {
    try {
      this.log('checkMembership', { squadronId, userId });

      const response = await apiClient.get<{ isMember: boolean }>(
        `${this.basePath}/${squadronId}/members/${userId}/check`
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'checkMembership');
    }
  }

  /**
   * Get all squadrons a user belongs to
   * GET /api/v2/squadrons/users/:userId/squadrons
   */
  async getUserSquadrons(userId: string, params?: PaginationParams) {
    try {
      this.log('getUserSquadrons', { userId, params });

      const queryParams = this.getPaginationParams(params);
      const response = await apiClient.getPaginated<SquadronMember>(
        `${this.basePath}/users/${userId}/squadrons`,
        { params: queryParams }
      );

      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'getUserSquadrons');
    }
  }

  // ============================================================================
  // Membership Management
  // ============================================================================

  /**
   * Add a member to a squadron
   * POST /api/v2/squadrons/:squadronId/members
   */
  async addMember(squadronId: string, data: AddSquadronMemberInput) {
    try {
      this.log('addMember', { squadronId, data });

      const response = await apiClient.post<SquadronMember>(
        `${this.basePath}/${squadronId}/members`,
        data
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'addMember');
    }
  }

  /**
   * Remove a member from a squadron
   * DELETE /api/v2/squadrons/:squadronId/members/:userId
   */
  async removeMember(squadronId: string, userId: string) {
    try {
      this.log('removeMember', { squadronId, userId });

      await apiClient.delete(`${this.basePath}/${squadronId}/members/${userId}`);
    } catch (error) {
      this.handleError(error, 'removeMember');
    }
  }

  /**
   * Update a member's role within a squadron
   * PATCH /api/v2/squadrons/:squadronId/members/:userId/role
   */
  async updateMemberRole(squadronId: string, userId: string, data: UpdateSquadronRoleInput) {
    try {
      this.log('updateMemberRole', { squadronId, userId, data });

      const response = await apiClient.patch<SquadronMember>(
        `${this.basePath}/${squadronId}/members/${userId}/role`,
        data
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'updateMemberRole');
    }
  }

  // ============================================================================
  // Analytics & Statistics
  // ============================================================================

  /**
   * Get total member count
   * GET /api/v2/squadrons/:squadronId/count
   */
  async getMemberCount(squadronId: string) {
    try {
      this.log('getMemberCount', { squadronId });

      const response = await apiClient.get<{ count: number }>(
        `${this.basePath}/${squadronId}/count`
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getMemberCount');
    }
  }

  /**
   * Get active member count
   * GET /api/v2/squadrons/:squadronId/count/active
   */
  async getActiveMemberCount(squadronId: string) {
    try {
      this.log('getActiveMemberCount', { squadronId });

      const response = await apiClient.get<{ count: number }>(
        `${this.basePath}/${squadronId}/count/active`
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getActiveMemberCount');
    }
  }

  /**
   * Get role distribution statistics
   * GET /api/v2/squadrons/:squadronId/stats/roles
   */
  async getRoleStats(squadronId: string) {
    try {
      this.log('getRoleStats', { squadronId });

      const response = await apiClient.get<SquadronRoleStats[]>(
        `${this.basePath}/${squadronId}/stats/roles`
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getRoleStats');
    }
  }

  /**
   * Get ship type distribution statistics
   * GET /api/v2/squadrons/:squadronId/stats/ships
   */
  async getShipStats(squadronId: string) {
    try {
      this.log('getShipStats', { squadronId });

      const response = await apiClient.get<SquadronShipStats[]>(
        `${this.basePath}/${squadronId}/stats/ships`
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getShipStats');
    }
  }

  /**
   * Get comprehensive squadron statistics
   * GET /api/v2/squadrons/:squadronId/stats
   */
  async getStatistics(squadronId: string) {
    try {
      this.log('getStatistics', { squadronId });

      const response = await apiClient.get<SquadronStatistics>(
        `${this.basePath}/${squadronId}/stats`
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getStatistics');
    }
  }
}

export const squadronService = new SquadronService();
