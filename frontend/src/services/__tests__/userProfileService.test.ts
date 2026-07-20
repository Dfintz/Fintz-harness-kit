import { apiClient } from '@/services/apiClient';
import {
  ActivitySummary,
  UserActivityStats,
  UserProfile,
  userProfileService,
  UserShip,
} from '@/services/userProfileService';

// Mock the apiClient
jest.mock('../apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

describe('userProfileService', () => {
  const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should fetch user profile by ID', async () => {
      const mockProfile: UserProfile = {
        id: 'user-123',
        username: 'testuser',
        displayName: 'Test User',
        bio: 'Test bio',
        avatar: 'avatar-url',
        role: 'member',
        lastActiveAt: '2024-01-01T00:00:00Z',
        createdAt: '2023-01-01T00:00:00Z',
        isPrivateProfile: false,
        showShips: true,
        showActivity: true,
      };

      mockApiClient.get.mockResolvedValue({
        success: true as const,
        data: mockProfile,
        meta: { timestamp: new Date().toISOString(), requestId: 'test' },
      });

      const result = await userProfileService.getUserProfile('user-123');

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v2/users/user-123/public-profile');
      expect(result).toEqual(mockProfile);
    });

    it('should handle API errors when fetching user profile', async () => {
      const error = new Error('User not found');
      mockApiClient.get.mockRejectedValue(error);

      await expect(userProfileService.getUserProfile('invalid-user')).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('getMyProfile', () => {
    it('should fetch current user profile', async () => {
      const mockProfile: UserProfile = {
        id: 'current-user',
        username: 'currentuser',
        displayName: 'Current User',
        role: 'admin',
        isPrivateProfile: false,
      };

      mockApiClient.get.mockResolvedValue({
        success: true as const,
        data: mockProfile,
        meta: { timestamp: new Date().toISOString(), requestId: 'test' },
      });

      const result = await userProfileService.getMyProfile();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v2/users/me');
      expect(result).toEqual(mockProfile);
    });

    it('should handle authentication errors', async () => {
      const error = new Error('Unauthorized');
      mockApiClient.get.mockRejectedValue(error);

      await expect(userProfileService.getMyProfile()).rejects.toThrow('Unauthorized');
    });
  });

  describe('getUserShips', () => {
    it('should fetch user ships', async () => {
      const mockShips: UserShip[] = [
        {
          id: 'ship-1',
          shipName: 'Aurora',
          manufacturer: 'Roberts Space Industries',
        },
        {
          id: 'ship-2',
          shipName: 'Cutlass',
          manufacturer: 'Drake Interplanetary',
        },
      ];

      mockApiClient.get.mockResolvedValue({
        success: true as const,
        data: mockShips,
        meta: { timestamp: new Date().toISOString(), requestId: 'test' },
      });

      const result = await userProfileService.getUserShips('user-123');

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v2/users/user-123/ships', {
        params: { limit: 100, offset: 0 },
      });
      expect(result).toEqual(mockShips);
      expect(result).toHaveLength(2);
    });

    it('should fetch and merge multiple pages when user has more than 100 ships', async () => {
      const pageOne: UserShip[] = Array.from({ length: 100 }, (_, index) => ({
        id: `ship-${String(index + 1)}`,
        shipName: `Ship ${String(index + 1)}`,
      }));
      const pageTwo: UserShip[] = [
        { id: 'ship-101', shipName: 'Perseus', manufacturer: 'RSI' },
        { id: 'ship-102', shipName: 'Carrack', manufacturer: 'Anvil' },
      ];

      mockApiClient.get
        .mockResolvedValueOnce({
          success: true as const,
          data: pageOne,
          meta: { timestamp: new Date().toISOString(), requestId: 'test-page-1' },
        })
        .mockResolvedValueOnce({
          success: true as const,
          data: pageTwo,
          meta: { timestamp: new Date().toISOString(), requestId: 'test-page-2' },
        });

      const result = await userProfileService.getUserShips('user-123');

      expect(mockApiClient.get).toHaveBeenNthCalledWith(1, '/api/v2/users/user-123/ships', {
        params: { limit: 100, offset: 0 },
      });
      expect(mockApiClient.get).toHaveBeenNthCalledWith(2, '/api/v2/users/user-123/ships', {
        params: { limit: 100, offset: 100 },
      });

      expect(result).toHaveLength(102);
      expect(result[100]).toEqual(pageTwo[0]);
      expect(result[101]).toEqual(pageTwo[1]);
    });

    it('should return empty array when user has no ships', async () => {
      mockApiClient.get.mockResolvedValue({
        success: true as const,
        data: [],
        meta: { timestamp: new Date().toISOString(), requestId: 'test' },
      });

      const result = await userProfileService.getUserShips('user-123');

      expect(result).toEqual([]);
    });

    it('should respect privacy settings when ships are private', async () => {
      const error = new Error('Ships are private');
      mockApiClient.get.mockRejectedValue(error);

      await expect(userProfileService.getUserShips('private-user')).rejects.toThrow(
        'Ships are private'
      );
    });
  });

  describe('getUserActivityStats', () => {
    it('should fetch user activity statistics', async () => {
      const mockStats: UserActivityStats = {
        totalActivities: 42,
        recentActivities: [
          {
            id: 'act-1',
            action: 'created',
            entityType: 'fleet',
            timestamp: '2024-01-01T00:00:00Z',
            description: 'Created fleet Alpha',
          },
          {
            id: 'act-2',
            action: 'updated',
            entityType: 'ship',
            timestamp: '2024-01-02T00:00:00Z',
            description: 'Updated ship loadout',
          },
        ],
      };

      mockApiClient.get.mockResolvedValue({
        success: true as const,
        data: mockStats,
        meta: { timestamp: new Date().toISOString(), requestId: 'test' },
      });

      const result = await userProfileService.getUserActivityStats('user-123');

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v2/users/user-123/activity/stats');
      expect(result).toEqual(mockStats);
      expect(result.totalActivities).toBe(42);
      expect(result.recentActivities).toHaveLength(2);
    });

    it('should respect privacy settings for activity stats', async () => {
      const error = new Error('Activity is private');
      mockApiClient.get.mockRejectedValue(error);

      await expect(userProfileService.getUserActivityStats('private-user')).rejects.toThrow(
        'Activity is private'
      );
    });
  });

  describe('getUserActivityTimeline', () => {
    it('should fetch user activity timeline with default days', async () => {
      const mockTimeline: ActivitySummary[] = [
        {
          id: 'act-1',
          action: 'joined',
          entityType: 'organization',
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          id: 'act-2',
          action: 'participated',
          entityType: 'event',
          timestamp: '2024-01-02T00:00:00Z',
          description: 'Fleet operation',
        },
      ];

      mockApiClient.get.mockResolvedValue({
        success: true as const,
        data: mockTimeline,
        meta: { timestamp: new Date().toISOString(), requestId: 'test' },
      });

      const result = await userProfileService.getUserActivityTimeline('user-123');

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/v2/users/user-123/activity/timeline?days=30'
      );
      expect(result).toEqual(mockTimeline);
      expect(result).toHaveLength(2);
    });

    it('should fetch activity timeline with custom days parameter', async () => {
      const mockTimeline: ActivitySummary[] = [];
      mockApiClient.get.mockResolvedValue({
        success: true as const,
        data: mockTimeline,
        meta: { timestamp: new Date().toISOString(), requestId: 'test' },
      });

      await userProfileService.getUserActivityTimeline('user-123', 7);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/v2/users/user-123/activity/timeline?days=7'
      );
    });

    it('should return empty array for malformed API response', async () => {
      mockApiClient.get.mockResolvedValue({
        success: true as const,
        data: null,
        meta: { timestamp: new Date().toISOString(), requestId: 'test' },
      });

      const result = await userProfileService.getUserActivityTimeline('user-123');

      expect(result).toEqual([]);
    });

    it('should return empty array if API returns non-array data', async () => {
      mockApiClient.get.mockResolvedValue({
        success: true as const,
        data: { invalid: 'data' },
        meta: { timestamp: new Date().toISOString(), requestId: 'test' },
      });

      const result = await userProfileService.getUserActivityTimeline('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('updateMyProfile', () => {
    it('should update current user profile', async () => {
      const updates: Partial<UserProfile> = {
        displayName: 'Updated Name',
        bio: 'Updated bio',
        showShips: false,
        showActivity: false,
      };

      const mockUpdatedProfile: UserProfile = {
        id: 'current-user',
        username: 'currentuser',
        displayName: 'Updated Name',
        bio: 'Updated bio',
        role: 'member',
        showShips: false,
        showActivity: false,
      };

      mockApiClient.patch.mockResolvedValue({
        success: true as const,
        data: mockUpdatedProfile,
        meta: { timestamp: new Date().toISOString(), requestId: 'test' },
      });

      const result = await userProfileService.updateMyProfile(updates);

      expect(mockApiClient.patch).toHaveBeenCalledWith('/api/v2/users/me', updates);
      expect(result).toEqual(mockUpdatedProfile);
      expect(result.displayName).toBe('Updated Name');
      expect(result.bio).toBe('Updated bio');
    });

    it('should update privacy settings', async () => {
      const updates: Partial<UserProfile> = {
        isPrivateProfile: true,
        showShips: false,
        showActivity: false,
      };

      const mockUpdatedProfile: UserProfile = {
        id: 'current-user',
        username: 'currentuser',
        role: 'member',
        isPrivateProfile: true,
        showShips: false,
        showActivity: false,
      };

      mockApiClient.patch.mockResolvedValue({
        success: true as const,
        data: mockUpdatedProfile,
        meta: { timestamp: new Date().toISOString(), requestId: 'test' },
      });

      const result = await userProfileService.updateMyProfile(updates);

      expect(result.isPrivateProfile).toBe(true);
      expect(result.showShips).toBe(false);
      expect(result.showActivity).toBe(false);
    });

    it('should handle validation errors', async () => {
      const error = new Error('Invalid profile data');
      mockApiClient.patch.mockRejectedValue(error);

      await expect(userProfileService.updateMyProfile({ displayName: '' })).rejects.toThrow(
        'Invalid profile data'
      );
    });

    it('should update only avatar field', async () => {
      const updates: Partial<UserProfile> = {
        avatar: 'new-avatar-url',
      };

      const mockUpdatedProfile: UserProfile = {
        id: 'current-user',
        username: 'currentuser',
        role: 'member',
        avatar: 'new-avatar-url',
      };

      mockApiClient.patch.mockResolvedValue({
        success: true as const,
        data: mockUpdatedProfile,
        meta: { timestamp: new Date().toISOString(), requestId: 'test' },
      });

      const result = await userProfileService.updateMyProfile(updates);

      expect(result.avatar).toBe('new-avatar-url');
    });
  });
});
