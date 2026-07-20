import { apiClient } from './apiClient';
import { BaseService } from './baseService';

import type { PublicUserInfo } from '@/components/PublicUserCard';

export interface CommunityBrowseParams {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'username' | 'displayName';
  sortOrder?: 'ASC' | 'DESC';
  rsiVerifiedOnly?: boolean;
  hasOrganization?: boolean;
}

export interface CommunityBrowseResult {
  data: PublicUserInfo[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

class CommunityMembersService extends BaseService {
  protected basePath = '/api/v2/users/community';

  async browseMembers(params: CommunityBrowseParams = {}): Promise<CommunityBrowseResult> {
    try {
      this.log('browseMembers', params);
      const response = await apiClient.get<CommunityBrowseResult>(`${this.basePath}/browse`, {
        params,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'browseMembers');
    }
  }
}

export const communityMembersService = new CommunityMembersService();
