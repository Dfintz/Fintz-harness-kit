/**
 * Participation Service — Sprint 20-E
 *
 * API client for unified participation endpoints.
 * Consumes /api/v2/participation/* routes.
 */

import type { ParticipationSummary, ParticipationSystemType } from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { extractData } from './baseService';

export interface ParticipationSummaryParams {
  organizationId?: string;
  systems?: ParticipationSystemType[];
}

class ParticipationService {
  private readonly basePath = '/api/v2/participation';

  /** Get participation summary for the authenticated user */
  async getMySummary(params?: ParticipationSummaryParams): Promise<ParticipationSummary> {
    const query = this.buildQuery(params);
    const response = await apiClient.get<ParticipationSummary>(`${this.basePath}/summary${query}`);
    return extractData(response);
  }

  /** Get participation summary for a specific user */
  async getUserSummary(
    userId: string,
    params?: ParticipationSummaryParams
  ): Promise<ParticipationSummary> {
    const query = this.buildQuery(params);
    const response = await apiClient.get<ParticipationSummary>(
      `${this.basePath}/users/${encodeURIComponent(userId)}/summary${query}`
    );
    return extractData(response);
  }

  private buildQuery(params?: ParticipationSummaryParams): string {
    if (!params) return '';
    const searchParams = new URLSearchParams();
    if (params.organizationId) {
      searchParams.set('organizationId', params.organizationId);
    }
    if (params.systems?.length) {
      searchParams.set('systems', params.systems.join(','));
    }
    const qs = searchParams.toString();
    return qs ? `?${qs}` : '';
  }
}

export const participationService = new ParticipationService();
