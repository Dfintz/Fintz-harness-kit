import { apiClient } from './apiClient';
import { BaseService, unwrapResponse } from './baseService';

export interface AdminGdprRequest {
  id: string;
  type: 'export' | 'deletion';
  userId: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired' | 'cancelled';
  requestedAt: string;
  completedAt: string | null;
}

export interface AdminGdprSummary {
  exportCount: number;
  deletionCount: number;
  pendingCount: number;
  exportCountLast30Days: number;
  pendingDeletionCount: number;
}

export interface AdminGdprRequestsResponse {
  requests: AdminGdprRequest[];
  summary: AdminGdprSummary;
  generatedAt: string;
}

class GdprAdminService extends BaseService {
  protected basePath = '/api/v2/gdpr/admin';

  async getGdprRequests(limit?: number): Promise<AdminGdprRequestsResponse> {
    try {
      this.log('getGdprRequests', { limit });
      const query = limit ? `?limit=${limit}` : '';
      const response = await apiClient.get<AdminGdprRequestsResponse>(
        `${this.basePath}/requests${query}`
      );
      return unwrapResponse<AdminGdprRequestsResponse>(response.data);
    } catch (error) {
      this.handleError(error, 'getGdprRequests');
    }
  }
}

export const gdprAdminService = new GdprAdminService();
