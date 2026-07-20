/**
 * Mission Service
 * Handles mission planning and lifecycle management API calls
 *
 * Created during Sprint 1 — Wave 3.1
 */

import type {
  AssignMissionRequest,
  CompleteMissionRequest,
  CreateMissionRequest,
  Mission,
  MissionObjective,
  MissionParticipant,
  UpdateMissionRequest,
} from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Query Types
// ============================================================================

/**
 * Mission list query parameters
 */
export interface MissionQueryParams {
  status?: string;
  missionType?: string;
  difficulty?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Paginated mission list response
 */
export interface PaginatedMissions {
  data: Mission[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export type MissionWorkflowPhase = 'dispatch' | 'quartermaster' | 'execution' | 'after_action';

export interface MissionWorkflowPhaseState {
  phase: MissionWorkflowPhase;
  title: string;
  description: string;
  completed: boolean;
  blockers: string[];
  suggestedStatus?: string;
  nextActions: string[];
}

export interface MissionWorkflowState {
  missionId: string;
  missionStatus: string;
  completedPhases: number;
  totalPhases: number;
  completionPercent: number;
  phases: MissionWorkflowPhaseState[];
}

// ============================================================================
// Service
// ============================================================================

class MissionService extends BaseService {
  protected basePath = '/api/v2/missions';

  // ==================== CRUD ====================

  async getMissions(params?: MissionQueryParams): Promise<PaginatedMissions> {
    try {
      this.log('getMissions', params);
      const queryString = this.buildQueryString(params as Record<string, unknown>);
      const response = await apiClient.getPaginated<Mission>(`${this.basePath}${queryString}`);
      return {
        data: response.data,
        pagination: {
          total: response.meta.pagination.total,
          page: response.meta.pagination.page ?? 1,
          pageSize: response.meta.pagination.limit,
          totalPages: response.meta.pagination.totalPages ?? 1,
          hasMore: response.meta.pagination.hasNext,
        },
      };
    } catch (error) {
      this.handleError(error, 'getMissions');
    }
  }

  async getMission(id: string): Promise<Mission> {
    try {
      this.log('getMission', id);
      const response = await apiClient.get<Mission>(`${this.basePath}/${id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getMission');
    }
  }

  async createMission(data: CreateMissionRequest): Promise<Mission> {
    try {
      this.log('createMission', data);
      const response = await apiClient.post<Mission>(this.basePath, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'createMission');
    }
  }

  async updateMission(id: string, data: UpdateMissionRequest): Promise<Mission> {
    try {
      this.log('updateMission', { id, data });
      const response = await apiClient.put<Mission>(`${this.basePath}/${id}`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateMission');
    }
  }

  async deleteMission(id: string): Promise<void> {
    try {
      this.log('deleteMission', id);
      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      this.handleError(error, 'deleteMission');
    }
  }

  // ==================== STATUS & LIFECYCLE ====================

  async updateStatus(id: string, status: string): Promise<Mission> {
    try {
      this.log('updateStatus', { id, status });
      const response = await apiClient.put<Mission>(`${this.basePath}/${id}/status`, { status });
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateStatus');
    }
  }

  async assignMission(id: string, data: AssignMissionRequest): Promise<Mission> {
    try {
      this.log('assignMission', { id, data });
      const response = await apiClient.post<Mission>(`${this.basePath}/${id}/assign`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'assignMission');
    }
  }

  async completeMission(id: string, data: CompleteMissionRequest): Promise<Mission> {
    try {
      this.log('completeMission', { id, data });
      const response = await apiClient.post<Mission>(`${this.basePath}/${id}/complete`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'completeMission');
    }
  }

  async getWorkflow(id: string): Promise<MissionWorkflowState> {
    try {
      this.log('getWorkflow', id);
      const response = await apiClient.get<MissionWorkflowState>(`${this.basePath}/${id}/workflow`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getWorkflow');
    }
  }

  async advanceWorkflow(id: string, phase: MissionWorkflowPhase, notes?: string): Promise<Mission> {
    try {
      this.log('advanceWorkflow', { id, phase, notes });
      const response = await apiClient.post<Mission>(`${this.basePath}/${id}/workflow/advance`, {
        phase,
        notes,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'advanceWorkflow');
    }
  }

  // ==================== SPECIAL QUERIES ====================

  async getActiveMissions(): Promise<Mission[]> {
    try {
      this.log('getActiveMissions');
      const response = await apiClient.get<Mission[]>(`${this.basePath}/active`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getActiveMissions');
    }
  }

  async getTemplates(): Promise<Mission[]> {
    try {
      this.log('getTemplates');
      const response = await apiClient.get<Mission[]>(`${this.basePath}/templates`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getTemplates');
    }
  }

  // ==================== PARTICIPANTS ====================

  async getParticipants(missionId: string): Promise<MissionParticipant[]> {
    try {
      this.log('getParticipants', missionId);
      const response = await apiClient.get<MissionParticipant[]>(
        `${this.basePath}/${missionId}/participants`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getParticipants');
    }
  }

  async addParticipant(
    missionId: string,
    data: { userId: string; role?: string }
  ): Promise<Mission> {
    try {
      this.log('addParticipant', { missionId, data });
      const response = await apiClient.post<Mission>(
        `${this.basePath}/${missionId}/participants`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'addParticipant');
    }
  }

  async removeParticipant(missionId: string, userId: string): Promise<void> {
    try {
      this.log('removeParticipant', { missionId, userId });
      await apiClient.delete(`${this.basePath}/${missionId}/participants/${userId}`);
    } catch (error) {
      this.handleError(error, 'removeParticipant');
    }
  }

  // ==================== OBJECTIVES ====================

  async addObjective(missionId: string, data: Omit<MissionObjective, 'id'>): Promise<Mission> {
    try {
      this.log('addObjective', { missionId, data });
      const response = await apiClient.post<Mission>(
        `${this.basePath}/${missionId}/objectives`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'addObjective');
    }
  }

  async updateObjective(
    missionId: string,
    objectiveId: string,
    data: Partial<MissionObjective>
  ): Promise<Mission> {
    try {
      this.log('updateObjective', { missionId, objectiveId, data });
      const response = await apiClient.put<Mission>(
        `${this.basePath}/${missionId}/objectives/${objectiveId}`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateObjective');
    }
  }

  async removeObjective(missionId: string, objectiveId: string): Promise<void> {
    try {
      this.log('removeObjective', { missionId, objectiveId });
      await apiClient.delete(`${this.basePath}/${missionId}/objectives/${objectiveId}`);
    } catch (error) {
      this.handleError(error, 'removeObjective');
    }
  }
}

export const missionService = new MissionService();
