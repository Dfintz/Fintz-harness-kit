import { apiClient } from './apiClient';

/** Organization membership for profile display */
export interface ProfileOrgMembership {
  orgId: string;
  orgName: string;
  orgLogo?: string;
  roleName: string;
}

/**
 * User profile information for public display
 */
export interface UserProfile {
  id: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  role?: string;
  lastActiveAt?: string;
  createdAt?: string;
  // Privacy-respecting fields
  isPrivateProfile?: boolean;
  showShips?: boolean;
  showActivity?: boolean;
  showScStats?: boolean;
  showRsiInfo?: boolean;
  showVerifiedBadge?: boolean;
  showOrganizations?: boolean;
  // RSI verification fields
  rsiHandle?: string;
  rsiVerified?: boolean;
  // Organization memberships
  organizations?: ProfileOrgMembership[];
}

/**
 * Public profile privacy settings
 */
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

/**
 * Linked OAuth account information
 */
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

/**
 * User activity information
 */
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

/**
 * User ship information
 */
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

/**
 * User profile service
 * Provides methods to fetch user profile data respecting privacy settings
 */
export const userProfileService = {
  /**
   * Get user profile by ID
   * @param userId - User ID to fetch profile for
   * @returns User profile data
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const response = await apiClient.get<UserProfile>(`/api/v2/users/${userId}/public-profile`);
    return response.data;
  },

  /**
   * Get current user's profile
   * @returns Current user profile data
   */
  async getMyProfile(): Promise<UserProfile> {
    const response = await apiClient.get<UserProfile>(`/api/v2/users/me`);
    return response.data;
  },

  /**
   * Get user's ships (respects privacy settings)
   * @param userId - User ID
   * @returns List of user ships
   */
  async getUserShips(userId: string): Promise<UserShip[]> {
    // The endpoint is paginated (max 100 items per page). Fetch all pages so
    // large hangars are fully available in ship pickers (e.g. event join/loan).
    const pageSize = 100;
    const maxPages = 50;
    const ships: UserShip[] = [];

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const offset = pageIndex * pageSize;
      const response = await apiClient.get<UserShip[]>(`/api/v2/users/${userId}/ships`, {
        params: { limit: pageSize, offset },
      });

      const batch = Array.isArray(response.data) ? response.data : [];
      if (batch.length === 0) {
        break;
      }

      ships.push(...batch);

      if (batch.length < pageSize) {
        break;
      }
    }

    // Preserve first-seen order while protecting against duplicate IDs across pages.
    const deduped = new Map<string, UserShip>();
    for (const ship of ships) {
      if (!deduped.has(ship.id)) {
        deduped.set(ship.id, ship);
      }
    }

    return Array.from(deduped.values());
  },

  /**
   * Get user's activity stats (respects privacy settings)
   * @param userId - User ID
   * @returns User activity statistics
   */
  async getUserActivityStats(userId: string): Promise<UserActivityStats> {
    const response = await apiClient.get<UserActivityStats>(
      `/api/v2/users/${userId}/activity/stats`
    );
    return response.data;
  },

  /**
   * Get user's activity timeline (respects privacy settings)
   * @param userId - User ID
   * @param days - Number of days to fetch (default: 30)
   * @returns Activity timeline data
   */
  async getUserActivityTimeline(userId: string, days: number = 30): Promise<ActivitySummary[]> {
    const response = await apiClient.get<ActivitySummary[]>(
      `/api/v2/users/${userId}/activity/timeline?days=${days}`
    );
    // Ensure we always return an array, even if API response is malformed
    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * Update current user's profile
   * @param updates - Profile fields to update
   * @returns Updated profile
   */
  async updateMyProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const response = await apiClient.patch<UserProfile>(`/api/v2/users/me`, updates);
    return response.data;
  },

  /**
   * Get current user's linked OAuth accounts
   */
  async getLinkedAccounts(): Promise<LinkedAccountsResponse> {
    const response = await apiClient.get<LinkedAccountsResponse>(
      `/api/v2/users/me/linked-accounts`
    );
    return response.data;
  },

  /**
   * Unlink an OAuth provider from the current user's account
   * @param provider - Provider to unlink (google, twitch)
   */
  async unlinkAccount(provider: string): Promise<void> {
    await apiClient.delete(`/api/v2/users/me/linked-accounts/${provider}`);
  },

  /**
   * Get current user's privacy settings
   */
  async getPrivacySettings(): Promise<PrivacySettings> {
    const response = await apiClient.get<PrivacySettings>('/api/v2/users/me/privacy-settings');
    return response.data;
  },

  /**
   * Update current user's privacy settings
   */
  async updatePrivacySettings(updates: Partial<PrivacySettings>): Promise<PrivacySettings> {
    const response = await apiClient.patch<PrivacySettings>(
      '/api/v2/users/me/privacy-settings',
      updates
    );
    return response.data;
  },
};
