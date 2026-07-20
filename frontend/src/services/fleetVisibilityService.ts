/**
 * Fleet Visibility Service
 * Handles fleet visibility rule management API calls
 *
 * Backend routes: /api/v2/fleets/:id/visibility-rules/*
 */

import type {
  CreateFleetVisibilityRuleRequest,
  FleetVisibilityAccessLevel,
  FleetVisibilityRule,
  UpdateFleetVisibilityRuleRequest,
} from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Service
// ============================================================================

class FleetVisibilityService extends BaseService {
  protected basePath = '/api/v2/fleets';

  /**
   * Get all visibility rules for a fleet
   */
  async getRules(fleetId: string): Promise<FleetVisibilityRule[]> {
    try {
      this.log('getRules', fleetId);
      const response = await apiClient.get<FleetVisibilityRule[]>(
        `${this.basePath}/${fleetId}/visibility-rules`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getRules');
    }
  }

  /**
   * Create a new visibility rule for a fleet
   */
  async createRule(
    fleetId: string,
    data: CreateFleetVisibilityRuleRequest
  ): Promise<FleetVisibilityRule> {
    try {
      this.log('createRule', { fleetId, ...data });
      const response = await apiClient.post<FleetVisibilityRule>(
        `${this.basePath}/${fleetId}/visibility-rules`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'createRule');
    }
  }

  /**
   * Update a visibility rule
   */
  async updateRule(
    fleetId: string,
    ruleId: string,
    data: UpdateFleetVisibilityRuleRequest
  ): Promise<FleetVisibilityRule> {
    try {
      this.log('updateRule', { fleetId, ruleId, ...data });
      const response = await apiClient.put<FleetVisibilityRule>(
        `${this.basePath}/${fleetId}/visibility-rules/${ruleId}`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateRule');
    }
  }

  /**
   * Delete a visibility rule
   */
  async deleteRule(fleetId: string, ruleId: string): Promise<void> {
    try {
      this.log('deleteRule', { fleetId, ruleId });
      await apiClient.delete(`${this.basePath}/${fleetId}/visibility-rules/${ruleId}`);
    } catch (error) {
      this.handleError(error, 'deleteRule');
    }
  }

  /**
   * Check what access level an org has to a fleet
   */
  async checkAccess(
    fleetId: string,
    targetOrgId?: string,
    securityLevel?: number
  ): Promise<{ fleetId: string; accessLevel: FleetVisibilityAccessLevel | null }> {
    try {
      this.log('checkAccess', { fleetId, targetOrgId, securityLevel });
      const response = await apiClient.post<{
        fleetId: string;
        accessLevel: FleetVisibilityAccessLevel | null;
      }>(`${this.basePath}/${fleetId}/check-access`, {
        targetOrgId,
        securityLevel,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'checkAccess');
    }
  }
}

export const fleetVisibilityService = new FleetVisibilityService();
