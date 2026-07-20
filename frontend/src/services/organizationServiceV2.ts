import type {
  FeedItem,
  Organization,
  OrganizationDashboard,
  OrganizationInsights,
  OrganizationOverview,
  OrganizationStatistics,
  PaginatedResult,
  PaginationParams,
} from '@/types/apiV2';
import { apiClient } from './apiClient';
import { BaseService, extractData, extractPaginatedData } from './baseService';
export type { Organization, OrganizationStatistics } from '@/types/apiV2';

/**
 * Member type for organization member queries
 */
export interface OrganizationMemberV2 {
  userId: string;
  organizationId: string;
  role: string;
  joinedAt: Date;
  username?: string;
  displayName?: string;
  avatar?: string;
  // Extended member context (Wave 3.3)
  rsiHandle?: string | null;
  rsiVerified?: boolean;
  discordId?: string | null;
  lastLoginAt?: string | null;
  registeredAt?: string | null;
  // Team & fleet enrichment
  teams?: Array<{ teamName: string; teamRole: string; rank: string | null }>;
  crewAssignments?: Array<{ shipId: string; crewRole: string }>;
}

/**
 * Organization Service V2
 * Handles all organization-related API calls using v2 endpoints
 */
class OrganizationServiceV2 extends BaseService {
  protected basePath = '/api/v2/organizations';

  // ============================================================================
  // Organization Dashboard & Overview
  // ============================================================================

  /**
   * Get complete dashboard data for an organization
   * GET /api/v2/organizations/:orgId/dashboard
   */
  async getDashboard(organizationId: string) {
    try {
      this.log('getDashboard', { organizationId });

      const url = `${this.basePath}/${organizationId}/dashboard`;
      const response = await apiClient.get<OrganizationDashboard>(url);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getDashboard');
    }
  }

  /**
   * Get organization overview with statistics
   * GET /api/v2/organizations/:orgId/overview
   */
  async getOverview(organizationId: string) {
    try {
      this.log('getOverview', { organizationId });

      const url = `${this.basePath}/${organizationId}/overview`;
      const response = await apiClient.get<OrganizationOverview>(url);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getOverview');
    }
  }

  /**
   * Get organization activity feed with pagination
   * GET /api/v2/organizations/:orgId/feed
   */
  async getFeed(organizationId: string, params?: PaginationParams) {
    try {
      this.log('getFeed', { organizationId, params });

      const url = `${this.basePath}/${organizationId}/feed`;
      const queryParams = this.getPaginationParams(params);

      const response = await apiClient.getPaginated<FeedItem>(url, {
        params: queryParams,
      });

      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'getFeed');
    }
  }

  /**
   * Get organization insights and recommendations
   * GET /api/v2/organizations/:orgId/insights
   */
  async getInsights(organizationId: string) {
    try {
      this.log('getInsights', { organizationId });

      const url = `${this.basePath}/${organizationId}/insights`;
      const response = await apiClient.get<OrganizationInsights>(url);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getInsights');
    }
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Alias for getOverview - Get organization overview with statistics
   */
  async getOverBox(organizationId: string) {
    return this.getOverview(organizationId);
  }

  /**
   * Get complete organization data (overview + feed + insights)
   */
  async getCompleteData(organizationId: string) {
    try {
      const [overview, feed, insights] = await Promise.all([
        this.getOverview(organizationId),
        this.getFeed(organizationId, { page: 1, limit: 20 }),
        this.getInsights(organizationId),
      ]);

      return {
        overview,
        feed: feed.items,
        feedPagination: feed.pagination,
        insights,
      };
    } catch (error) {
      return this.handleError(error, 'getCompleteData');
    }
  }

  /**
   * Get all feed items (convenience method without pagination)
   */
  async getAllFeedItems(organizationId: string, limit: number = 100): Promise<FeedItem[]> {
    const result = await this.getFeed(organizationId, { page: 1, limit });
    return result.items;
  }

  // ============================================================================
  // Alliance Management
  // ============================================================================

  /**
   * Get all alliances for an organization
   * GET /api/v2/organizations/:orgId/alliances
   */
  async getAlliances(organizationId: string) {
    try {
      this.log('getAlliances', { organizationId });

      const url = `${this.basePath}/${organizationId}/alliances`;
      const response = await apiClient.get(url);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getAlliances');
    }
  }

  /**
   * Get alliance statistics
   * GET /api/v2/organizations/:orgId/alliance-statistics
   */
  async getAllianceStatistics(organizationId: string) {
    try {
      this.log('getAllianceStatistics', { organizationId });

      const url = `${this.basePath}/${organizationId}/alliance-statistics`;
      const response = await apiClient.get(url);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getAllianceStatistics');
    }
  }

  /**
   * Get shared activities with allied organizations
   * GET /api/v2/organizations/:orgId/shared-activities
   */
  async getSharedActivities(
    organizationId: string,
    params?: PaginationParams & { status?: string }
  ) {
    try {
      this.log('getSharedActivities', { organizationId, params });

      const url = `${this.basePath}/${organizationId}/shared-activities`;
      const queryParams = {
        ...this.getPaginationParams(params),
        ...(params?.status && { status: params.status }),
      };

      const response = await apiClient.getPaginated(url, {
        params: queryParams,
      });

      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'getSharedActivities');
    }
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Get current user's organizations
   * GET /api/v2/users/me/organizations
   */
  async getMyOrganizations(): Promise<Organization[]> {
    try {
      this.log('getMyOrganizations');
      const response = await apiClient.get<Organization[]>('/api/v2/users/me/organizations');
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getMyOrganizations');
    }
  }

  /**
   * Get a single organization by ID
   * GET /api/v2/organizations/:orgId
   */
  async getOrganizationById(organizationId: string): Promise<Organization> {
    try {
      this.log('getOrganizationById', { organizationId });
      const response = await apiClient.get<Organization>(`${this.basePath}/${organizationId}`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getOrganizationById');
    }
  }

  /**
   * Get organization members with pagination
   * GET /api/v2/organizations/:orgId/members
   */
  async getOrganizationMembers(
    organizationId: string,
    params?: PaginationParams & { role?: string; search?: string }
  ): Promise<PaginatedResult<OrganizationMemberV2>> {
    try {
      this.log('getOrganizationMembers', { organizationId, params });
      const url = `${this.basePath}/${organizationId}/members`;
      const response = await apiClient.getPaginated<OrganizationMemberV2>(url, { params });
      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'getOrganizationMembers');
    }
  }

  /**
   * Get organization statistics
   * GET /api/v2/organizations/:orgId/statistics
   */
  async getOrganizationStatistics(organizationId: string): Promise<OrganizationStatistics> {
    try {
      this.log('getOrganizationStatistics', { organizationId });
      const response = await apiClient.get<OrganizationStatistics>(
        `${this.basePath}/${organizationId}/statistics`
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getOrganizationStatistics');
    }
  }

  /**
   * Create a new organization
   * POST /api/v2/organizations
   */
  async createOrganization(data: {
    name: string;
    description?: string;
    rsiSpectrumId?: string;
    logo?: string;
  }): Promise<Organization> {
    try {
      this.log('createOrganization', data);
      const response = await apiClient.post<Organization>(this.basePath, data);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'createOrganization');
    }
  }

  /**
   * Update an organization
   * PUT /api/v2/organizations/:orgId
   */
  async updateOrganization(
    organizationId: string,
    data: {
      name?: string;
      description?: string;
      logo?: string;
      settings?: Record<string, unknown>;
    }
  ): Promise<Organization> {
    try {
      this.log('updateOrganization', { organizationId, data });
      const response = await apiClient.put<Organization>(
        `${this.basePath}/${organizationId}`,
        data
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'updateOrganization');
    }
  }

  /**
   * Rename an organization (display name only, tag/id is immutable)
   * PATCH /api/v2/organizations/:orgId/rename
   */
  async renameOrganization(organizationId: string, name: string): Promise<Organization> {
    try {
      this.log('renameOrganization', { organizationId, name });
      const response = await apiClient.patch<Organization>(
        `${this.basePath}/${organizationId}/rename`,
        { name }
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'renameOrganization');
    }
  }

  /**
   * Sync organization name from RSI
   * POST /api/v2/organizations/:orgId/sync-name-from-rsi
   */
  async syncNameFromRsi(organizationId: string): Promise<{ data: Organization; rsiName: string }> {
    try {
      this.log('syncNameFromRsi', { organizationId });
      const response = await apiClient.post<{ data: Organization; rsiName: string }>(
        `${this.basePath}/${organizationId}/sync-name-from-rsi`
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'syncNameFromRsi');
    }
  }

  /**
   * Update a member's role
   * PATCH /api/v2/organizations/:id/members/:userId/role
   */
  async updateMemberRole(
    organizationId: string,
    memberId: string,
    roleUpdate: string | { role?: string; roleId?: string }
  ): Promise<OrganizationMemberV2> {
    try {
      const payload =
        typeof roleUpdate === 'string'
          ? { role: roleUpdate }
          : {
              ...(roleUpdate.role ? { role: roleUpdate.role } : {}),
              ...(roleUpdate.roleId ? { roleId: roleUpdate.roleId } : {}),
            };

      if (!payload.role && !payload.roleId) {
        throw new Error('Role update payload must include either role or roleId');
      }

      this.log('updateMemberRole', { organizationId, memberId, ...payload });
      const response = await apiClient.patch<OrganizationMemberV2>(
        `${this.basePath}/${organizationId}/members/${memberId}/role`,
        payload
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'updateMemberRole');
    }
  }

  /**
   * Remove a member from organization
   * DELETE /api/v2/organizations/:orgId/members/:memberId
   */
  async removeMember(organizationId: string, memberId: string): Promise<void> {
    try {
      this.log('removeMember', { organizationId, memberId });
      await apiClient.delete(`${this.basePath}/${organizationId}/members/${memberId}`);
    } catch (error) {
      return this.handleError(error, 'removeMember');
    }
  }

  /**
   * Leave an organization
   * POST /api/v2/organizations/:orgId/leave
   */
  async leaveOrganization(organizationId: string): Promise<void> {
    try {
      this.log('leaveOrganization', { organizationId });
      await apiClient.post(`${this.basePath}/${organizationId}/leave`);
    } catch (error) {
      return this.handleError(error, 'leaveOrganization');
    }
  }

  /**
   * Get organization hierarchy tree
   * GET /api/organizations/:orgId/tree
   */
  async getOrganizationTree(organizationId: string): Promise<OrgTreeNode> {
    try {
      this.log('getOrganizationTree', { organizationId });
      const response = await apiClient.get<OrgTreeNode>(
        `/api/organizations/${organizationId}/tree`
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getOrganizationTree');
    }
  }
}

/**
 * Tree node for org hierarchy visualization
 */
export interface OrgTreeNode {
  id: string;
  name: string;
  type?: string;
  level?: number;
  childCount?: number;
  totalMembers?: number;
  directMembers?: number;
  logoUrl?: string;
  children?: OrgTreeNode[];
}

export const organizationServiceV2 = new OrganizationServiceV2();
