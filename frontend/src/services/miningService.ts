/**
 * Mining Service
 * Handles mining operation management API calls
 *
 * Backend routes: /api/v2/mining-operations/*
 *
 * Created in Sprint 0.5 — Wire Unwired Features
 */

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Types
// ============================================================================

export enum MiningOperationStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface MiningResource {
  resourceType: string;
  amount: number;
  unit: string;
  estimatedValue?: number;
}

export interface MiningCrewMember {
  userId: string;
  username?: string;
  role: string;
  joinedAt?: string;
}

export interface MiningOperation {
  id: string;
  title: string;
  description?: string;
  status: MiningOperationStatus;
  location?: string;
  systemLocation?: string;
  organizationId?: string;
  createdBy: string;
  crewMembers: MiningCrewMember[];
  resources: MiningResource[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMiningOperationDTO {
  title: string;
  description?: string;
  location?: string;
  systemLocation?: string;
  organizationId?: string;
}

export interface AddCrewMemberDTO {
  userId: string;
  role: string;
}

export interface RecordResourcesDTO {
  resources: MiningResource[];
}

export interface UpdateStatusDTO {
  status: MiningOperationStatus;
  reason?: string;
}

export interface UpdateMiningOperationDTO {
  location?: string;
  resourceType?: string;
  notes?: string;
  description?: string;
}

export interface RegolithSummary {
  location: string;
  system: string;
  totalResources: number;
  topResources: Array<{
    name: string;
    symbol: string;
    percentage: number;
    estimatedValue?: number;
    price?: number;
    sellLocations?: string[];
  }>;
  accessibility: string;
  recommendedShips: string[];
  estimatedProfitPerHour?: number;
  notes: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Mining Service
 *
 * Provides API methods for managing mining operations,
 * crew members, resource tracking, and operation lifecycle.
 */
export class MiningService extends BaseService {
  protected basePath = '/api/v2/mining-operations';

  // ==================== CRUD ====================

  /**
   * Create a new mining operation
   */
  async createOperation(data: CreateMiningOperationDTO): Promise<MiningOperation> {
    try {
      this.log('createOperation', data);
      const response = await apiClient.post<MiningOperation>(this.basePath, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'createOperation');
    }
  }

  /**
   * Get all mining operations for the authenticated user
   */
  async getOperations(): Promise<MiningOperation[]> {
    try {
      this.log('getOperations');
      const response = await apiClient.get<MiningOperation[]>(this.basePath);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getOperations');
    }
  }

  /**
   * Get a specific mining operation by ID
   */
  async getOperationById(id: string): Promise<MiningOperation> {
    try {
      this.log('getOperationById', id);
      const response = await apiClient.get<MiningOperation>(`${this.basePath}/${id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getOperationById');
    }
  }

  /**
   * Update a mining operation
   */
  async updateOperation(id: string, data: UpdateMiningOperationDTO): Promise<MiningOperation> {
    try {
      this.log('updateOperation', { id, data });
      const response = await apiClient.put<MiningOperation>(`${this.basePath}/${id}`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateOperation');
    }
  }

  /**
   * Delete a mining operation
   */
  async deleteOperation(id: string): Promise<void> {
    try {
      this.log('deleteOperation', id);
      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      this.handleError(error, 'deleteOperation');
    }
  }

  // ==================== Crew Management ====================

  /**
   * Add a crew member to a mining operation
   */
  async addCrewMember(operationId: string, data: AddCrewMemberDTO): Promise<MiningCrewMember> {
    try {
      this.log('addCrewMember', { operationId, data });
      const response = await apiClient.post<MiningCrewMember>(
        `${this.basePath}/${operationId}/crew`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'addCrewMember');
    }
  }

  // ==================== Resource Tracking ====================

  /**
   * Record resources collected in a mining operation
   */
  async recordResources(operationId: string, data: RecordResourcesDTO): Promise<MiningResource[]> {
    try {
      this.log('recordResources', { operationId, data });
      const response = await apiClient.post<MiningResource[]>(
        `${this.basePath}/${operationId}/resources`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'recordResources');
    }
  }

  // ==================== Status Management ====================

  /**
   * Update the status of a mining operation
   */
  async updateStatus(operationId: string, data: UpdateStatusDTO): Promise<MiningOperation> {
    try {
      this.log('updateStatus', { operationId, data });
      const response = await apiClient.put<MiningOperation>(
        `${this.basePath}/${operationId}/status`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateStatus');
    }
  }

  // ==================== Regolith Data ====================

  /**
   * Get regolith mining data summary for a location
   */
  async getRegolithSummary(location: string): Promise<RegolithSummary | null> {
    try {
      this.log('getRegolithSummary', location);
      const response = await apiClient.get<RegolithSummary>(
        `${this.basePath}/regolith/${encodeURIComponent(location)}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getRegolithSummary');
    }
  }
}

// Create singleton instance
export const miningService = new MiningService();
