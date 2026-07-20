/**
 * User Profile Service for Mobile
 * Provides methods to fetch user profile data respecting privacy settings.
 * Ported from frontend/src/services/userProfileService.ts
 */

import { apiClient } from './apiClient';
import { BaseService, extractData } from './baseService';

export interface ProfileOrgMembership {
  orgId: string;
  orgName: string;
  orgLogo?: string;
  roleName: string;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  role?: string;
  lastActiveAt?: string;
  createdAt?: string;
  isPrivateProfile?: boolean;
  showShips?: boolean;
  showActivity?: boolean;
  rsiHandle?: string;
  rsiVerified?: boolean;
  organizations?: ProfileOrgMembership[];
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'organization' | 'private';
  showEmail: boolean;
  showDiscord: boolean;
  showBio: boolean;
  showRsiInfo: boolean;
  showVerifiedBadge: boolean;
  showOrganizations: boolean;
  showPublicShips: boolean;
  showScStats: boolean;
  showActivity: boolean;
}

export interface LinkedAccount {
  provider: 'discord' | 'google' | 'twitch';
  providerId: string;
  username?: string;
  linkedAt: string;
}

export interface LinkedAccountsResponse {
  userId: string;
  accounts: LinkedAccount[];
  total: number;
}

export interface UserActivityStats {
  totalActivities: number;
  recentActivities: ActivitySummary[];
}

export interface ActivitySummary {
  id: string;
  action: string;
  entityType: string;
  timestamp: string;
  description?: string;
}

export interface UserShip {
  id: string;
  shipName: string;
  customName?: string;
  manufacturer?: string;
  status?: string;
  condition?: string;
  sharingLevel?: string;
  productionStatus?: string;
}

class UserProfileService extends BaseService {
  protected basePath = '/api/v2/users';

  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      this.log('getUserProfile', { userId });
      const response = await apiClient.get<UserProfile>(
        `${this.basePath}/${userId}/public-profile`
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getUserProfile');
    }
  }

  async getMyProfile(): Promise<UserProfile> {
    try {
      this.log('getMyProfile');
      const response = await apiClient.get<UserProfile>(`${this.basePath}/me`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getMyProfile');
    }
  }

  async getUserShips(userId: string): Promise<UserShip[]> {
    try {
      this.log('getUserShips', { userId });
      const pageSize = 100;
      const maxPages = 50;
      const ships: UserShip[] = [];

      for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
        const offset = pageIndex * pageSize;
        const response = await apiClient.get<UserShip[]>(`${this.basePath}/${userId}/ships`, {
          params: { limit: pageSize, offset },
        });

        const batch = extractData(response);
        if (!Array.isArray(batch) || batch.length === 0) {
          break;
        }

        ships.push(...batch);

        if (batch.length < pageSize) {
          break;
        }
      }

      const deduped = new Map<string, UserShip>();
      for (const ship of ships) {
        if (!deduped.has(ship.id)) {
          deduped.set(ship.id, ship);
        }
      }

      return Array.from(deduped.values());
    } catch (error) {
      return this.handleError(error, 'getUserShips');
    }
  }

  async getUserActivityStats(userId: string): Promise<UserActivityStats> {
    try {
      this.log('getUserActivityStats', { userId });
      const response = await apiClient.get<UserActivityStats>(
        `${this.basePath}/${userId}/activity/stats`
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getUserActivityStats');
    }
  }

  async updateMyProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      this.log('updateMyProfile', updates);
      const response = await apiClient.patch<UserProfile>(`${this.basePath}/me`, updates);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'updateMyProfile');
    }
  }

  async getLinkedAccounts(): Promise<LinkedAccountsResponse> {
    try {
      this.log('getLinkedAccounts');
      const response = await apiClient.get<LinkedAccountsResponse>(
        `${this.basePath}/me/linked-accounts`
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getLinkedAccounts');
    }
  }

  async getPrivacySettings(): Promise<PrivacySettings> {
    try {
      this.log('getPrivacySettings');
      const response = await apiClient.get<PrivacySettings>(`${this.basePath}/me/privacy-settings`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getPrivacySettings');
    }
  }

  async updatePrivacySettings(settings: Partial<PrivacySettings>): Promise<PrivacySettings> {
    try {
      this.log('updatePrivacySettings', settings);
      const response = await apiClient.put<PrivacySettings>(
        `${this.basePath}/me/privacy-settings`,
        settings
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'updatePrivacySettings');
    }
  }
}

export const userProfileService = new UserProfileService();
