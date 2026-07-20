/**
 * CAS Service — API client for Composite Activity Score endpoints.
 */

import type {
  CASBreakdown,
  CASHeatmapResponse,
  CASHistoryPoint,
  CASRankingEntry,
  CASScoreResult,
} from '@sc-fleet-manager/shared-types';

import { apiClient, isApiClientError } from './apiClient';
import { BaseService } from './baseService';

class CASService extends BaseService {
  protected basePath = '/api/v2';

  async getCurrentScore(orgId: string): Promise<CASScoreResult | null> {
    try {
      this.log('getCurrentScore', { orgId });
      const response = await apiClient.get<CASScoreResult>(
        `${this.basePath}/organizations/${orgId}/cas/score`
      );
      return response.data;
    } catch (error) {
      if (isApiClientError(error) && error.statusCode === 404) {
        return null;
      }
      this.handleError(error, 'getCurrentScore');
    }
  }

  async getScoreHistory(orgId: string, days: number = 30): Promise<CASHistoryPoint[]> {
    try {
      this.log('getScoreHistory', { orgId, days });
      const response = await apiClient.get<CASHistoryPoint[]>(
        `${this.basePath}/organizations/${orgId}/cas/history`,
        { params: { days } }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getScoreHistory');
    }
  }

  async getScoreBreakdown(orgId: string): Promise<CASBreakdown> {
    try {
      this.log('getScoreBreakdown', { orgId });
      const response = await apiClient.get<CASBreakdown>(
        `${this.basePath}/organizations/${orgId}/cas/breakdown`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getScoreBreakdown');
    }
  }

  async getHeatmap(
    orgId: string,
    days: number = 7,
    logScale: boolean = true
  ): Promise<CASHeatmapResponse> {
    try {
      this.log('getHeatmap', { orgId, days });
      const response = await apiClient.get<CASHeatmapResponse>(
        `${this.basePath}/organizations/${orgId}/cas/heatmap`,
        { params: { days, logScale } }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getHeatmap');
    }
  }

  async getRanking(limit: number = 20): Promise<CASRankingEntry[]> {
    try {
      this.log('getRanking', { limit });
      const response = await apiClient.get<CASRankingEntry[]>(`${this.basePath}/cas/ranking`, {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'getRanking');
    }
  }
}

export const casService = new CASService();
