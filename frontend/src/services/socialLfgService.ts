import { apiClient } from './apiClient';
import { BaseService, unwrapArrayResponse, unwrapResponse } from './baseService';

export interface SocialGroup {
  id: string;
  activity: string;
  description: string;
  creatorId: string;
  creatorName: string;
  currentPlayers: number;
  maxPlayers: number;
  members: string[];
  guildId: string;
  channelId: string;
  status: 'open' | 'full' | 'closed';
}

export interface CreateSocialGroupInput {
  activity: string;
  description: string;
  creatorName: string;
  maxPlayers: number;
  guildId: string;
  channelId: string;
  expirationMinutes?: number;
}

export interface LfgSession {
  id: string;
  hostUserId: string;
  organizationId: string;
  activityType: string;
  title: string;
  description?: string;
  maxPlayers: number;
  minPlayers?: number;
  currentPlayers: string[];
  status: 'open' | 'full' | 'in-progress' | 'completed' | 'cancelled';
}

export interface CreateLfgSessionInput {
  organizationId: string;
  activityType: string;
  title: string;
  description?: string;
  maxPlayers: number;
  minPlayers?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
  ttlSeconds?: number;
}

export interface ConvertGroupToTeamInput {
  teamName: string;
  teamType?: string;
  organizationId: string;
}

export interface ConvertGroupToTeamResult {
  teamId: string;
  memberCount: number;
}

class SocialLfgService extends BaseService {
  protected basePath = '/api/v2/social';

  async getGroups(guildId?: string): Promise<SocialGroup[]> {
    try {
      const query = guildId ? `?guildId=${encodeURIComponent(guildId)}` : '';
      const response = await apiClient.get<SocialGroup[]>(`${this.basePath}/groups${query}`);
      return unwrapArrayResponse<SocialGroup>(response);
    } catch (error) {
      this.handleError(error, 'getGroups');
    }
  }

  async createGroup(input: CreateSocialGroupInput): Promise<SocialGroup> {
    try {
      const response = await apiClient.post<SocialGroup>(`${this.basePath}/groups`, input);
      return unwrapResponse<SocialGroup>(response);
    } catch (error) {
      this.handleError(error, 'createGroup');
    }
  }

  async joinGroup(groupId: string): Promise<SocialGroup> {
    try {
      const response = await apiClient.post<SocialGroup>(`${this.basePath}/groups/${groupId}/join`);
      return unwrapResponse<SocialGroup>(response);
    } catch (error) {
      this.handleError(error, 'joinGroup');
    }
  }

  async leaveGroup(groupId: string): Promise<SocialGroup> {
    try {
      const response = await apiClient.post<SocialGroup>(
        `${this.basePath}/groups/${groupId}/leave`
      );
      return unwrapResponse<SocialGroup>(response);
    } catch (error) {
      this.handleError(error, 'leaveGroup');
    }
  }

  async closeGroup(groupId: string): Promise<SocialGroup> {
    try {
      const response = await apiClient.post<SocialGroup>(
        `${this.basePath}/groups/${groupId}/close`
      );
      return unwrapResponse<SocialGroup>(response);
    } catch (error) {
      this.handleError(error, 'closeGroup');
    }
  }

  async getSessionById(sessionId: string): Promise<LfgSession> {
    try {
      const response = await apiClient.get<LfgSession>(`${this.basePath}/sessions/${sessionId}`);
      return unwrapResponse<LfgSession>(response);
    } catch (error) {
      this.handleError(error, 'getSessionById');
    }
  }

  async getSessions(filters?: {
    organizationId?: string;
    activityType?: string;
    status?: string;
    minAvailableSlots?: number;
    tags?: string;
  }): Promise<LfgSession[]> {
    try {
      const query = this.buildQueryString(filters);
      const response = await apiClient.get<LfgSession[]>(`${this.basePath}/sessions${query}`);
      return unwrapArrayResponse<LfgSession>(response);
    } catch (error) {
      this.handleError(error, 'getSessions');
    }
  }

  async createSession(input: CreateLfgSessionInput): Promise<LfgSession> {
    try {
      const response = await apiClient.post<LfgSession>(`${this.basePath}/sessions`, input);
      return unwrapResponse<LfgSession>(response);
    } catch (error) {
      this.handleError(error, 'createSession');
    }
  }

  async joinSession(sessionId: string): Promise<LfgSession> {
    try {
      const response = await apiClient.post<LfgSession>(
        `${this.basePath}/sessions/${sessionId}/join`
      );
      return unwrapResponse<LfgSession>(response);
    } catch (error) {
      this.handleError(error, 'joinSession');
    }
  }

  async leaveSession(sessionId: string): Promise<LfgSession> {
    try {
      const response = await apiClient.post<LfgSession>(
        `${this.basePath}/sessions/${sessionId}/leave`
      );
      return unwrapResponse<LfgSession>(response);
    } catch (error) {
      this.handleError(error, 'leaveSession');
    }
  }

  async startSession(sessionId: string): Promise<LfgSession> {
    try {
      const response = await apiClient.post<LfgSession>(
        `${this.basePath}/sessions/${sessionId}/start`
      );
      return unwrapResponse<LfgSession>(response);
    } catch (error) {
      this.handleError(error, 'startSession');
    }
  }

  async completeSession(sessionId: string): Promise<LfgSession> {
    try {
      const response = await apiClient.post<LfgSession>(
        `${this.basePath}/sessions/${sessionId}/complete`
      );
      return unwrapResponse<LfgSession>(response);
    } catch (error) {
      this.handleError(error, 'completeSession');
    }
  }

  async cancelSession(sessionId: string): Promise<LfgSession> {
    try {
      const response = await apiClient.post<LfgSession>(
        `${this.basePath}/sessions/${sessionId}/cancel`
      );
      return unwrapResponse<LfgSession>(response);
    } catch (error) {
      this.handleError(error, 'cancelSession');
    }
  }

  async convertGroupToTeam(
    groupId: string,
    input: ConvertGroupToTeamInput
  ): Promise<ConvertGroupToTeamResult> {
    try {
      this.log('convertGroupToTeam', { groupId, ...input });
      const response = await apiClient.post<ConvertGroupToTeamResult>(
        `${this.basePath}/groups/${groupId}/convert-to-team`,
        input
      );
      return unwrapResponse<ConvertGroupToTeamResult>(response);
    } catch (error) {
      this.handleError(error, 'convertGroupToTeam');
    }
  }
}

export const socialLfgService = new SocialLfgService();
