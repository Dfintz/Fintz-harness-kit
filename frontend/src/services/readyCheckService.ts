import type { ReadyCheck, ReadyCheckSummary } from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { BaseService, extractData } from './baseService';

/**
 * Ready Check response shape from GET endpoint
 */
export interface ReadyCheckResponse {
  active: boolean;
  readyCheck: ReadyCheck | null;
}

/**
 * Ready Check Service
 *
 * Handles ready check API calls for fleet operations/activities.
 * Voice-command-friendly API surface.
 */
class ReadyCheckService extends BaseService {
  protected basePath = '/api/v2/activities';

  /**
   * Initiate a ready check for an activity
   * POST /api/v2/activities/:id/ready-check
   */
  async initiateReadyCheck(activityId: string, durationSeconds: number = 120): Promise<ReadyCheck> {
    try {
      this.log('initiateReadyCheck', { activityId, durationSeconds });
      const response = await apiClient.post<ReadyCheck>(
        `${this.basePath}/${activityId}/ready-check`,
        { durationSeconds }
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'initiateReadyCheck');
    }
  }

  /**
   * Respond to a ready check
   * POST /api/v2/activities/:id/ready-check/respond
   */
  async respondToReadyCheck(
    activityId: string,
    response: 'ready' | 'not_ready'
  ): Promise<ReadyCheckSummary> {
    try {
      this.log('respondToReadyCheck', { activityId, response });
      const res = await apiClient.post<ReadyCheckSummary>(
        `${this.basePath}/${activityId}/ready-check/respond`,
        { response }
      );
      return extractData(res);
    } catch (error) {
      return this.handleError(error, 'respondToReadyCheck');
    }
  }

  /**
   * Get the current ready check status for an activity
   * GET /api/v2/activities/:id/ready-check
   */
  async getReadyCheck(activityId: string): Promise<ReadyCheckResponse> {
    try {
      this.log('getReadyCheck', { activityId });
      const response = await apiClient.get<ReadyCheckResponse>(
        `${this.basePath}/${activityId}/ready-check`
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getReadyCheck');
    }
  }

  /**
   * Cancel an active ready check
   * DELETE /api/v2/activities/:id/ready-check
   */
  async cancelReadyCheck(activityId: string): Promise<{ cancelled: boolean }> {
    try {
      this.log('cancelReadyCheck', { activityId });
      const response = await apiClient.delete<{ cancelled: boolean }>(
        `${this.basePath}/${activityId}/ready-check`
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'cancelReadyCheck');
    }
  }
}

export const readyCheckService = new ReadyCheckService();
