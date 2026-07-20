/**
 * Alliance Service
 * Handles alliance diplomacy management API calls
 *
 * Backend routes: /api/v2/alliance-diplomacy/*
 *
 * Created in Sprint 0.5 — Wire Unwired Features
 */

import { apiClient } from './apiClient';
import { BaseService, unwrapArrayResponse } from './baseService';

// ============================================================================
// Types
// ============================================================================

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export enum AllianceStatus {
  PROPOSED = 'proposed',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

export enum AllianceType {
  TRADE = 'trade',
  MILITARY = 'military',
  MUTUAL_DEFENSE = 'mutual_defense',
  NON_AGGRESSION = 'non_aggression',
  FULL_ALLIANCE = 'full_alliance',
}

export interface Alliance {
  id: string;
  orgId1: string;
  orgId2: string;
  allianceType: AllianceType;
  status: AllianceStatus;
  proposedBy: string;
  approvedBy?: string;
  terms?: Array<{ term: string; description: string }>;
  incidents?: Array<{
    incidentId: string;
    description: string;
    severity: IncidentSeverity;
    reportedBy: string;
    timestamp: string;
    resolved: boolean;
  }>;
  notes?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AllianceIncident {
  id: string;
  allianceId: string;
  reportedBy: string;
  reporterName?: string;
  description: string;
  severity: IncidentSeverity;
  status: 'open' | 'resolved';
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: string;
  reportedAt: string;
}

export interface ProposeAllianceDTO {
  targetOrgId: string;
  allianceType: AllianceType;
  name?: string;
  terms?: string;
  notes?: string;
}

export interface ReportIncidentDTO {
  description: string;
  severity: IncidentSeverity;
}

export interface ResolveIncidentDTO {
  resolution: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Alliance Service
 *
 * Provides API methods for managing inter-organization
 * diplomacy relations, lifecycle actions, and incident tracking.
 */
export class AllianceService extends BaseService {
  protected basePath = '/api/v2/alliance-diplomacy';

  // ==================== Alliance CRUD ====================

  /**
   * Propose a new alliance/diplomatic relation
   */
  async proposeAlliance(data: ProposeAllianceDTO): Promise<Alliance> {
    try {
      this.log('proposeAlliance', data);
      const response = await apiClient.post<Alliance>(this.basePath, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'proposeAlliance');
    }
  }

  /**
   * List all alliance relations
   */
  async getAlliances(): Promise<Alliance[]> {
    try {
      this.log('getAlliances');
      const response = await apiClient.get<Alliance[]>(this.basePath);
      return unwrapArrayResponse<Alliance>(response.data);
    } catch (error) {
      this.handleError(error, 'getAlliances');
    }
  }

  /**
   * Get a specific alliance by ID
   */
  async getAllianceById(id: string): Promise<Alliance> {
    try {
      this.log('getAllianceById', id);
      const response = await apiClient.get<Alliance>(`${this.basePath}/${id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAllianceById');
    }
  }

  // ==================== Lifecycle Actions ====================

  /**
   * Approve a proposed alliance
   */
  async approveAlliance(id: string): Promise<Alliance> {
    try {
      this.log('approveAlliance', id);
      const response = await apiClient.post<Alliance>(`${this.basePath}/${id}/approve`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'approveAlliance');
    }
  }

  /**
   * Suspend an active alliance
   */
  async suspendAlliance(id: string): Promise<Alliance> {
    try {
      this.log('suspendAlliance', id);
      const response = await apiClient.post<Alliance>(`${this.basePath}/${id}/suspend`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'suspendAlliance');
    }
  }

  /**
   * Terminate an alliance permanently
   */
  async terminateAlliance(id: string): Promise<Alliance> {
    try {
      this.log('terminateAlliance', id);
      const response = await apiClient.post<Alliance>(`${this.basePath}/${id}/terminate`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'terminateAlliance');
    }
  }

  // ==================== Incident Management ====================

  /**
   * Report an incident against an alliance
   */
  async reportIncident(allianceId: string, data: ReportIncidentDTO): Promise<AllianceIncident> {
    try {
      this.log('reportIncident', { allianceId, data });
      const response = await apiClient.post<AllianceIncident>(
        `${this.basePath}/${allianceId}/incidents`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'reportIncident');
    }
  }

  /**
   * Resolve an incident
   */
  async resolveIncident(
    allianceId: string,
    incidentId: string,
    data: ResolveIncidentDTO
  ): Promise<AllianceIncident> {
    try {
      this.log('resolveIncident', { allianceId, incidentId, data });
      const response = await apiClient.put<AllianceIncident>(
        `${this.basePath}/${allianceId}/incidents/${incidentId}/resolve`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'resolveIncident');
    }
  }
}

// Create singleton instance
export const allianceService = new AllianceService();
