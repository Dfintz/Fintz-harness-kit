/**
 * Public Stats Service
 *
 * Provides access to the public platform statistics endpoint.
 * No authentication required.
 */

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

export interface PublicStats {
  publicOrganizations: number;
  publicAlliances: number;
  publicFederations: number;
  users: number;
  publicJobListings: number;
  shipsTracked: number;
  fleetsTracked: number;
}

class PublicStatsService extends BaseService {
  protected basePath = '/api/v2/public/stats';

  async getStats(): Promise<PublicStats> {
    try {
      this.log('getStats');
      const response = await apiClient.get<PublicStats>(this.basePath);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getStats');
    }
  }
}

export const publicStatsService = new PublicStatsService();
