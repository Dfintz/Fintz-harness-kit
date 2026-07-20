/**
 * Badge Service
 *
 * Frontend service for the Custom Titles & Badges subsystem.
 * Maps to backend endpoints at /api/v2/achievements.
 */

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Types
// ============================================================================

export type AchievementType = 'title' | 'badge';
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Achievement {
  id: string;
  type: AchievementType;
  organizationId?: string;
  federationId?: string;
  name: string;
  description?: string;
  category?: string;
  rarity: AchievementRarity;
  icon?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserAchievement {
  id: string;
  achievementId: string;
  achievement?: Achievement & {
    organization?: { id: string; name: string; logo?: string };
  };
  userId: string;
  organizationId: string;
  awardedBy: string;
  isDisplayed: boolean;
  displaySlot: number | null;
  awardedAt: string;
}

export interface BadgeRecipient {
  id: string;
  achievementId: string;
  userId: string;
  organizationId: string;
  awardedBy: string;
  isDisplayed: boolean;
  displaySlot: number | null;
  awardedAt: string;
  user?: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
}

export interface CreateAchievementInput {
  name: string;
  type?: AchievementType;
  description?: string;
  category?: string;
  rarity?: AchievementRarity;
  icon?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateAchievementInput {
  name?: string;
  type?: AchievementType;
  description?: string;
  category?: string;
  rarity?: AchievementRarity;
  icon?: string | null;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

export interface AchievementFilters {
  category?: string;
  rarity?: AchievementRarity;
  type?: AchievementType;
  page?: number;
  limit?: number;
}

export interface PaginatedAchievementResponse {
  data: Achievement[];
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

class BadgeService extends BaseService {
  protected basePath = '/api/v2/achievements';

  async list(filters?: AchievementFilters): Promise<PaginatedAchievementResponse> {
    try {
      this.log('list', filters);
      const response = await apiClient.get<PaginatedAchievementResponse>(this.basePath, {
        params: filters,
      });
      const envelope = response as unknown as PaginatedAchievementResponse;
      return {
        data: Array.isArray(envelope.data)
          ? envelope.data
          : Array.isArray(envelope)
            ? (envelope as unknown as Achievement[])
            : [],
        pagination: envelope.pagination ?? {
          total: 0,
          count: 0,
          page: 1,
          pageSize: 20,
          hasMore: false,
          totalPages: 0,
        },
      };
    } catch (error: unknown) {
      this.handleError(error, 'list');
    }
  }

  async getById(achievementId: string): Promise<Achievement> {
    try {
      this.log('getById', achievementId);
      const response = await apiClient.get<{ success: boolean; data: Achievement }>(
        `${this.basePath}/${encodeURIComponent(achievementId)}`
      );
      return (response as unknown as { data: Achievement }).data;
    } catch (error: unknown) {
      this.handleError(error, 'getById');
    }
  }

  async create(input: CreateAchievementInput): Promise<Achievement> {
    try {
      this.log('create', input);
      const response = await apiClient.post<{ success: boolean; data: Achievement }>(
        this.basePath,
        input
      );
      return (response as unknown as { data: Achievement }).data;
    } catch (error: unknown) {
      this.handleError(error, 'create');
    }
  }

  async update(achievementId: string, input: UpdateAchievementInput): Promise<Achievement> {
    try {
      this.log('update', { achievementId, input });
      const response = await apiClient.put<{ success: boolean; data: Achievement }>(
        `${this.basePath}/${encodeURIComponent(achievementId)}`,
        input
      );
      return (response as unknown as { data: Achievement }).data;
    } catch (error: unknown) {
      this.handleError(error, 'update');
    }
  }

  async remove(achievementId: string): Promise<void> {
    try {
      this.log('remove', achievementId);
      await apiClient.delete(`${this.basePath}/${encodeURIComponent(achievementId)}`);
    } catch (error: unknown) {
      this.handleError(error, 'remove');
    }
  }

  async award(achievementId: string, userId: string): Promise<UserAchievement> {
    try {
      this.log('award', { achievementId, userId });
      const response = await apiClient.post<{ success: boolean; data: UserAchievement }>(
        `${this.basePath}/${encodeURIComponent(achievementId)}/award`,
        { userId }
      );
      return (response as unknown as { data: UserAchievement }).data;
    } catch (error: unknown) {
      this.handleError(error, 'award');
    }
  }

  async revoke(achievementId: string, userId: string): Promise<void> {
    try {
      this.log('revoke', { achievementId, userId });
      await apiClient.post(`${this.basePath}/${encodeURIComponent(achievementId)}/revoke`, {
        userId,
      });
    } catch (error: unknown) {
      this.handleError(error, 'revoke');
    }
  }

  async getUserBadges(userId: string): Promise<UserAchievement[]> {
    try {
      this.log('getUserBadges', userId);
      const response = await apiClient.get<{ success: boolean; data: UserAchievement[] }>(
        `${this.basePath}/user/${encodeURIComponent(userId)}`
      );
      const result = response as unknown as { data: UserAchievement[] };
      return Array.isArray(result.data) ? result.data : [];
    } catch (error: unknown) {
      this.handleError(error, 'getUserBadges');
    }
  }

  async toggleDisplay(userAchievementId: string, isDisplayed: boolean): Promise<UserAchievement> {
    try {
      this.log('toggleDisplay', { userAchievementId, isDisplayed });
      const response = await apiClient.patch<{ success: boolean; data: UserAchievement }>(
        `${this.basePath}/display/${encodeURIComponent(userAchievementId)}`,
        { isDisplayed }
      );
      return (response as unknown as { data: UserAchievement }).data;
    } catch (error: unknown) {
      this.handleError(error, 'toggleDisplay');
    }
  }

  async getRecipients(achievementId: string): Promise<BadgeRecipient[]> {
    try {
      this.log('getRecipients', achievementId);
      const response = await apiClient.get<{ success: boolean; data: BadgeRecipient[] }>(
        `${this.basePath}/${encodeURIComponent(achievementId)}/recipients`
      );
      const result = response as unknown as { data: BadgeRecipient[] };
      return Array.isArray(result.data) ? result.data : [];
    } catch (error: unknown) {
      this.handleError(error, 'getRecipients');
    }
  }
}

export const badgeService = new BadgeService();
