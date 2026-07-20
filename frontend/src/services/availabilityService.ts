/**
 * Availability Service — API client for Wave 2.4 endpoints
 */

import type {
  AvailabilitySlot,
  BestTimeWindow,
  GroupAvailabilityHeatmap,
  SetAvailabilityRequest,
} from '@sc-fleet-manager/shared-types';
import { apiClient } from './apiClient';
import { extractData } from './baseService';

class AvailabilityService {
  /** Validate orgId before making API calls */
  private validateOrgId(orgId: string, method: string): void {
    if (!orgId) {
      throw new Error(`[AvailabilityService.${method}] organizationId is required`);
    }
  }

  /** Replace the current user's availability for an org */
  async setMyAvailability(
    orgId: string,
    slots: SetAvailabilityRequest['slots']
  ): Promise<{ slots: AvailabilitySlot[]; count: number }> {
    this.validateOrgId(orgId, 'setMyAvailability');
    const response = await apiClient.put<{ slots: AvailabilitySlot[]; count: number }>(
      `/api/v2/organizations/${orgId}/availability`,
      { slots }
    );
    return extractData(response);
  }

  /** Get current user's availability for an org */
  async getMyAvailability(orgId: string): Promise<{ slots: AvailabilitySlot[]; count: number }> {
    this.validateOrgId(orgId, 'getMyAvailability');
    const response = await apiClient.get<{ slots: AvailabilitySlot[]; count: number }>(
      `/api/v2/organizations/${orgId}/availability/me`
    );
    return extractData(response);
  }

  /** Get group availability heatmap */
  async getGroupHeatmap(orgId: string): Promise<GroupAvailabilityHeatmap> {
    this.validateOrgId(orgId, 'getGroupHeatmap');
    const response = await apiClient.get<GroupAvailabilityHeatmap>(
      `/api/v2/organizations/${orgId}/availability/heatmap`
    );
    return extractData(response);
  }

  /** Find best times for scheduling */
  async findBestTimes(
    orgId: string,
    durationMinutes: number,
    minAttendees: number
  ): Promise<{ windows: BestTimeWindow[]; count: number }> {
    this.validateOrgId(orgId, 'findBestTimes');
    const response = await apiClient.get<{ windows: BestTimeWindow[]; count: number }>(
      `/api/v2/organizations/${orgId}/availability/best-times`,
      { params: { durationMinutes, minAttendees } }
    );
    return extractData(response);
  }
}

export const availabilityService = new AvailabilityService();
