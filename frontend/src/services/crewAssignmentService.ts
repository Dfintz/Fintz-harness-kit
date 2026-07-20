import { apiClient as api } from './apiClient';

import type {
  AddCrewMemberInput,
  CreateCrewAssignmentInput,
  CrewAssignment,
} from '@sc-fleet-manager/shared-types';

/**
 * Crew Assignment Service - API client for crew assignment management
 *
 * Handles crew assignment CRUD operations via v2 API:
 * - Create/list/get assignments
 * - Add/remove crew members within assignments
 * - Update assignment status
 */
export const crewAssignmentService = {
  /**
   * Create a new crew assignment
   */
  async createAssignment(data: CreateCrewAssignmentInput): Promise<CrewAssignment> {
    const response = await api.post<CrewAssignment>('/api/v2/crew-assignments', data);
    return response.data;
  },

  /**
   * List crew assignments (paginated)
   */
  async getAssignments(params?: {
    page?: number;
    limit?: number;
  }): Promise<{ data: CrewAssignment[]; pagination: Record<string, unknown> }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));

    const queryString = queryParams.toString();
    const url = queryString
      ? `/api/v2/crew-assignments?${queryString}`
      : '/api/v2/crew-assignments';
    const response = await api.get<{ data: CrewAssignment[]; pagination: Record<string, unknown> }>(
      url
    );
    return response.data;
  },

  /**
   * Get a specific crew assignment by ID
   */
  async getAssignmentById(id: string): Promise<CrewAssignment> {
    const response = await api.get<CrewAssignment>(`/api/v2/crew-assignments/${id}`);
    return response.data;
  },

  /**
   * Add a crew member to an assignment
   */
  async addCrewMember(assignmentId: string, data: AddCrewMemberInput): Promise<CrewAssignment> {
    const response = await api.post<CrewAssignment>(
      `/api/v2/crew-assignments/${assignmentId}/crew`,
      data
    );
    return response.data;
  },

  /**
   * Remove a crew member from an assignment
   */
  async removeCrewMember(assignmentId: string, userId: string): Promise<CrewAssignment> {
    const response = await api.delete<CrewAssignment>(
      `/api/v2/crew-assignments/${assignmentId}/crew/${userId}`
    );
    return response.data;
  },

  /**
   * Update assignment status
   */
  async updateStatus(
    assignmentId: string,
    status: 'active' | 'inactive' | 'completed'
  ): Promise<CrewAssignment> {
    const response = await api.put<CrewAssignment>(
      `/api/v2/crew-assignments/${assignmentId}/status`,
      { status }
    );
    return response.data;
  },
};
