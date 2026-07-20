/**
 * Team Service — API client for Wave 2.6 endpoints
 */

import type {
  AddTeamMemberRequest,
  CreateTeamRequest,
  Team,
  TeamMember,
  TeamTreeNode,
  UpdateTeamMemberRequest,
  UpdateTeamRequest,
} from '@sc-fleet-manager/shared-types';
import { apiClient } from './apiClient';
import { extractData } from './baseService';

class TeamService {
  /** List all teams for an org */
  async getTeams(orgId: string): Promise<Team[]> {
    const response = await apiClient.get<Team[]>(`/api/v2/organizations/${orgId}/teams`);
    return extractData(response);
  }

  /** Get team tree hierarchy */
  async getTeamTree(orgId: string): Promise<{ tree: TeamTreeNode[]; totalTeams: number }> {
    const response = await apiClient.get<{ tree: TeamTreeNode[]; totalTeams: number }>(
      `/api/v2/organizations/${orgId}/teams/tree`
    );
    return extractData(response);
  }

  /** Create a new team */
  async createTeam(orgId: string, data: CreateTeamRequest): Promise<Team> {
    const response = await apiClient.post<Team>(`/api/v2/organizations/${orgId}/teams`, data);
    return extractData(response);
  }

  /** Get a single team */
  async getTeamById(teamId: string): Promise<Team> {
    const response = await apiClient.get<Team>(`/api/v2/teams/${teamId}`);
    return extractData(response);
  }

  /** Update a team */
  async updateTeam(teamId: string, data: UpdateTeamRequest): Promise<Team> {
    const response = await apiClient.put<Team>(`/api/v2/teams/${teamId}`, data);
    return extractData(response);
  }

  /** Delete a team */
  async deleteTeam(teamId: string): Promise<void> {
    await apiClient.delete(`/api/v2/teams/${teamId}`);
  }

  /** Move team to a new parent */
  async moveTeam(teamId: string, parentTeamId: string | null): Promise<Team> {
    const response = await apiClient.put<Team>(`/api/v2/teams/${teamId}/move`, { parentTeamId });
    return extractData(response);
  }

  /** Reorder teams */
  async reorderTeams(
    orgId: string,
    orderedIds: string[],
    parentTeamId?: string | null
  ): Promise<void> {
    await apiClient.put(`/api/v2/organizations/${orgId}/teams/reorder`, {
      orderedIds,
      parentTeamId,
    });
  }

  // ── Members ──────────────────────────────────────────────────────────────

  /** Get team members */
  async getMembers(teamId: string): Promise<TeamMember[]> {
    const response = await apiClient.get<TeamMember[]>(`/api/v2/teams/${teamId}/members`);
    return extractData(response);
  }

  /** Add a member to a team */
  async addMember(teamId: string, data: AddTeamMemberRequest): Promise<TeamMember> {
    const response = await apiClient.post<TeamMember>(`/api/v2/teams/${teamId}/members`, data);
    return extractData(response);
  }

  /** Update a team member */
  async updateMember(
    teamId: string,
    memberId: string,
    data: UpdateTeamMemberRequest
  ): Promise<TeamMember> {
    const response = await apiClient.put<TeamMember>(
      `/api/v2/teams/${teamId}/members/${memberId}`,
      data
    );
    return extractData(response);
  }

  /** Remove a member from a team */
  async removeMember(teamId: string, memberId: string): Promise<void> {
    await apiClient.delete(`/api/v2/teams/${teamId}/members/${memberId}`);
  }
}

export const teamService = new TeamService();
