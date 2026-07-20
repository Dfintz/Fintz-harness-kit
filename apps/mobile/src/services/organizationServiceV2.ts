/**
 * Organization Service V2 for Mobile
 * Handles all organization-related API calls using v2 endpoints.
 * Ported from frontend/src/services/organizationServiceV2.ts
 */

import type {
  FeedItem,
  Organization,
  OrganizationDashboard,
  OrganizationOverview,
  OrganizationStatistics,
  PaginatedResult,
  PaginationParams,
} from '@/types/apiV2';
import { apiClient } from './apiClient';
import { BaseService, extractData, extractPaginatedData } from './baseService';

export interface OrganizationMemberV2 {
  userId: string;
  organizationId: string;
  role: string;
  joinedAt: Date;
  username?: string;
  displayName?: string;
  avatar?: string;
  rsiHandle?: string | null;
  rsiVerified?: boolean;
  discordId?: string | null;
  lastLoginAt?: string | null;
  registeredAt?: string | null;
  teams?: { teamName: string; teamRole: string; rank: string | null }[];
  crewAssignments?: { shipId: string; crewRole: string }[];
}

class OrganizationServiceV2 extends BaseService {
  protected basePath = '/api/v2/organizations';

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

  async getFeed(organizationId: string, params?: PaginationParams) {
    try {
      this.log('getFeed', { organizationId, params });
      const url = `${this.basePath}/${organizationId}/feed`;
      const queryParams = this.getPaginationParams(params);
      const response = await apiClient.getPaginated<FeedItem>(url, { params: queryParams });
      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'getFeed');
    }
  }

  async getMyOrganizations(): Promise<Organization[]> {
    try {
      this.log('getMyOrganizations');
      const response = await apiClient.get<Organization[]>('/api/v2/users/me/organizations');
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getMyOrganizations');
    }
  }

  async getOrganizationById(organizationId: string): Promise<Organization> {
    try {
      this.log('getOrganizationById', { organizationId });
      const response = await apiClient.get<Organization>(`${this.basePath}/${organizationId}`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getOrganizationById');
    }
  }

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

  async updateOrganization(
    organizationId: string,
    data: { name?: string; description?: string; logo?: string; settings?: Record<string, unknown> }
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

  async removeMember(organizationId: string, memberId: string): Promise<void> {
    try {
      this.log('removeMember', { organizationId, memberId });
      await apiClient.delete(`${this.basePath}/${organizationId}/members/${memberId}`);
    } catch (error) {
      return this.handleError(error, 'removeMember');
    }
  }
}

export const organizationServiceV2 = new OrganizationServiceV2();
