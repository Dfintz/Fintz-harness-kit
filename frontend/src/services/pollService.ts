/**
 * Poll Service
 *
 * Frontend service for the Poll/Voting subsystem. Maps to the backend
 * endpoints at /api/v2/voting/polls.
 *
 * Sprint 26 — Bot vs Web Feature Parity
 */

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Types
// ============================================================================

export type PollType = 'single_choice' | 'multiple_choice' | 'ranked' | 'approval';
export type PollVisibility = 'public' | 'members_only' | 'role_restricted';
export type PollStatus = 'draft' | 'active' | 'closed' | 'cancelled';

export interface PollOption {
  id: string;
  label: string;
  description?: string;
  sortOrder: number;
}

export interface Poll {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  pollType: PollType;
  visibility: PollVisibility;
  options: PollOption[];
  isAnonymous: boolean;
  maxSelections: number;
  status: PollStatus;
  createdBy: string;
  createdByName?: string;
  endsAt?: string;
  closedBy?: string;
  closedAt?: string;
  allowedRoles?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PollOptionResult {
  optionId: string;
  label: string;
  voteCount: number;
  percentage: number;
}

export interface PollResults {
  pollId: string;
  totalVotes: number;
  optionCounts: Record<string, number>;
  options: PollOptionResult[];
  hasVoted: boolean;
  userVotes?: string[];
}

export interface MirrorPollToDiscordInput {
  guildId: string;
  channelId: string;
}

export interface PollDiscordMirror {
  id: string;
  pollId: string;
  organizationId: string;
  guildId: string;
  channelId: string;
  messageId?: string;
  status: string;
  createdAt: string;
  deliveredAt?: string;
}

export interface CreatePollInput {
  title: string;
  description?: string;
  pollType: PollType;
  visibility?: PollVisibility;
  options: Array<{ id: string; label: string; description?: string; sortOrder: number }>;
  isAnonymous?: boolean;
  maxSelections?: number;
  endsAt?: string;
  status?: 'draft' | 'active';
}

export interface UpdatePollInput {
  title?: string;
  description?: string | null;
  visibility?: PollVisibility;
  options?: Array<{ id: string; label: string; description?: string; sortOrder: number }>;
  isAnonymous?: boolean;
  maxSelections?: number;
  endsAt?: string | null;
}

export interface CastVoteInput {
  votes: Array<{ optionId: string; rank?: number }>;
}

export interface PollFilters {
  page?: number;
  limit?: number;
  status?: PollStatus;
  pollType?: PollType;
  createdBy?: string;
  searchTerm?: string;
  sortBy?: 'createdAt' | 'title' | 'endsAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedPollResponse {
  data: Poll[];
  pagination: {
    total: number;
    count: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    totalPages: number;
  };
}

// ============================================================================
// Service
// ============================================================================

class PollService extends BaseService {
  protected basePath = '/api/v2/voting/polls';

  async getPolls(filters?: PollFilters): Promise<PaginatedPollResponse> {
    try {
      this.log('getPolls', filters);
      const response = await apiClient.get<PaginatedPollResponse>(this.basePath, {
        params: filters,
      });
      // apiClient.get already unwraps Axios response.data, giving us {data: Poll[], pagination}
      // Return the full envelope — don't double-unwrap with .data
      const envelope = response as unknown as PaginatedPollResponse;
      return {
        data: Array.isArray(envelope.data)
          ? envelope.data
          : Array.isArray(envelope)
            ? (envelope as unknown as Poll[])
            : [],
        pagination: envelope.pagination ?? {
          total: 0,
          count: 0,
          page: 1,
          pageSize: 10,
          hasMore: false,
          totalPages: 0,
        },
      };
    } catch (error) {
      this.handleError(error, 'getPolls');
    }
  }

  async getPoll(id: string): Promise<Poll> {
    try {
      this.log('getPoll', id);
      const response = await apiClient.get<Poll>(`${this.basePath}/${encodeURIComponent(id)}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getPoll');
    }
  }

  async createPoll(data: CreatePollInput): Promise<Poll> {
    try {
      this.log('createPoll', data);
      const response = await apiClient.post<Poll>(this.basePath, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'createPoll');
    }
  }

  async updatePoll(id: string, data: UpdatePollInput): Promise<Poll> {
    try {
      this.log('updatePoll', { id, data });
      const response = await apiClient.put<Poll>(
        `${this.basePath}/${encodeURIComponent(id)}`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'updatePoll');
    }
  }

  async deletePoll(id: string): Promise<void> {
    try {
      this.log('deletePoll', id);
      await apiClient.delete(`${this.basePath}/${encodeURIComponent(id)}`);
    } catch (error) {
      this.handleError(error, 'deletePoll');
    }
  }

  async castVote(pollId: string, data: CastVoteInput): Promise<void> {
    try {
      this.log('castVote', { pollId, data });
      await apiClient.post(`${this.basePath}/${encodeURIComponent(pollId)}/vote`, data);
    } catch (error) {
      this.handleError(error, 'castVote');
    }
  }

  async getResults(pollId: string): Promise<PollResults> {
    try {
      this.log('getResults', pollId);
      const response = await apiClient.get<PollResults>(
        `${this.basePath}/${encodeURIComponent(pollId)}/results`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getResults');
    }
  }

  async closePoll(pollId: string): Promise<Poll> {
    try {
      this.log('closePoll', pollId);
      const response = await apiClient.post<Poll>(
        `${this.basePath}/${encodeURIComponent(pollId)}/close`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'closePoll');
    }
  }

  async mirrorPollToDiscord(
    pollId: string,
    data: MirrorPollToDiscordInput
  ): Promise<PollDiscordMirror> {
    try {
      this.log('mirrorPollToDiscord', { pollId, data });
      const response = await apiClient.post<PollDiscordMirror>(
        `${this.basePath}/${encodeURIComponent(pollId)}/mirrors`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'mirrorPollToDiscord');
    }
  }
}

export const pollService = new PollService();
