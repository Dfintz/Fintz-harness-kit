import { AppDataSource } from '../../../data-source';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { cache } from '../../../utils/redis';
import { GuildOrganizationService } from '../../discord/GuildOrganizationService';
import { UserPreferencesService } from '../../user/UserPreferencesService';
import { OnlinePresenceService } from '../OnlinePresenceService';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../user/UserPreferencesService');
jest.mock('../../../utils/redis', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));
jest.mock('../../discord/GuildOrganizationService');

describe('OnlinePresenceService', () => {
  let service: OnlinePresenceService;
  let mockUserOrgRepository: jest.Mocked<Record<string, jest.Mock>>;
  let mockUserPreferencesService: jest.Mocked<UserPreferencesService>;
  let mockIO: any;
  let mockGuildOrgService: { getGuildsForOrganization: jest.Mock };

  // Test data
  const testOrgId = 'org-123';
  const testUserId1 = 'user-1';
  const testUserId2 = 'user-2';
  const testUsername1 = 'user1';
  const testUsername2 = 'user2';

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup repository mocks
    mockUserOrgRepository = {
      find: jest.fn(),
    } as jest.Mocked<Record<string, jest.Mock>>;

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock) = jest.fn(entity => {
      if (entity === OrganizationMembership) {
        return mockUserOrgRepository;
      }
      return {};
    });

    // Mock UserPreferencesService
    mockUserPreferencesService = {
      getPreference: jest.fn(),
    } as any;
    (UserPreferencesService as jest.Mock).mockImplementation(() => mockUserPreferencesService);

    // Mock GuildOrganizationService
    mockGuildOrgService = {
      getGuildsForOrganization: jest.fn().mockResolvedValue([]),
    };
    (GuildOrganizationService.getInstance as jest.Mock) = jest.fn(() => mockGuildOrgService);

    // Mock Socket.IO
    mockIO = {
      in: jest.fn().mockReturnThis(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      fetchSockets: jest.fn(),
    };

    service = new OnlinePresenceService();
    // Inject Socket.IO instance into service
    service.setSocketServer(mockIO);
  });

  describe('getOnlineMemberCount', () => {
    it('should return count of unique online users from WebSocket', async () => {
      // Arrange
      const mockSockets = [
        { userId: testUserId1 },
        { userId: testUserId1 }, // Same user, different connection
        { userId: testUserId2 },
      ];
      mockIO.fetchSockets.mockResolvedValue(mockSockets);

      // Act
      const count = await service.getOnlineMemberCount(testOrgId);

      // Assert
      expect(count).toBe(2);
      expect(mockIO.in).toHaveBeenCalledWith(`org:${testOrgId}`);
    });

    it('should return 0 when no users are online and no Discord data', async () => {
      // Arrange
      mockIO.fetchSockets.mockResolvedValue([]);

      // Act
      const count = await service.getOnlineMemberCount(testOrgId);

      // Assert
      expect(count).toBe(0);
    });

    it('should return 0 on error', async () => {
      // Arrange
      mockIO.fetchSockets.mockRejectedValue(new Error('Connection error'));

      // Act
      const count = await service.getOnlineMemberCount(testOrgId);

      // Assert
      expect(count).toBe(0);
    });

    it('should return Discord online count when WebSocket count is 0', async () => {
      // Arrange - no WebSocket connections
      mockIO.fetchSockets.mockResolvedValue([]);

      // But Discord has presence data
      mockGuildOrgService.getGuildsForOrganization.mockResolvedValue([{ guildId: 'guild-1' }]);
      (cache.get as jest.Mock).mockResolvedValue({
        online: 10,
        idle: 3,
        dnd: 2,
        total: 15,
        updatedAt: Date.now(),
      });

      // Act
      const count = await service.getOnlineMemberCount(testOrgId);

      // Assert
      expect(count).toBe(15);
    });

    it('should return higher of WebSocket and Discord counts', async () => {
      // Arrange - 2 WebSocket users
      const mockSockets = [{ userId: testUserId1 }, { userId: testUserId2 }];
      mockIO.fetchSockets.mockResolvedValue(mockSockets);

      // And 25 Discord users
      mockGuildOrgService.getGuildsForOrganization.mockResolvedValue([{ guildId: 'guild-1' }]);
      (cache.get as jest.Mock).mockResolvedValue({
        online: 20,
        idle: 3,
        dnd: 2,
        total: 25,
        updatedAt: Date.now(),
      });

      // Act
      const count = await service.getOnlineMemberCount(testOrgId);

      // Assert
      expect(count).toBe(25);
    });

    it('should sum presence across multiple guilds', async () => {
      // Arrange
      mockIO.fetchSockets.mockResolvedValue([]);
      mockGuildOrgService.getGuildsForOrganization.mockResolvedValue([
        { guildId: 'guild-1' },
        { guildId: 'guild-2' },
      ]);
      (cache.get as jest.Mock)
        .mockResolvedValueOnce({ online: 5, idle: 1, dnd: 0, total: 6, updatedAt: Date.now() })
        .mockResolvedValueOnce({ online: 3, idle: 2, dnd: 1, total: 6, updatedAt: Date.now() });

      // Act
      const count = await service.getOnlineMemberCount(testOrgId);

      // Assert
      expect(count).toBe(12);
    });

    it('should gracefully handle missing Redis data', async () => {
      // Arrange
      mockIO.fetchSockets.mockResolvedValue([]);
      mockGuildOrgService.getGuildsForOrganization.mockResolvedValue([{ guildId: 'guild-1' }]);
      (cache.get as jest.Mock).mockResolvedValue(null);

      // Act
      const count = await service.getOnlineMemberCount(testOrgId);

      // Assert
      expect(count).toBe(0);
    });

    it('should gracefully handle GuildOrganizationService errors', async () => {
      // Arrange
      mockIO.fetchSockets.mockResolvedValue([{ userId: testUserId1 }]);
      mockGuildOrgService.getGuildsForOrganization.mockRejectedValue(new Error('DB error'));

      // Act
      const count = await service.getOnlineMemberCount(testOrgId);

      // Assert - should still return WebSocket count
      expect(count).toBe(1);
    });
  });

  describe('getOnlineMembers', () => {
    it('should return online members who have showOnlineStatus enabled', async () => {
      // Arrange
      const mockSockets = [
        {
          userId: testUserId1,
          username: testUsername1,
          handshake: { time: 1000 },
        },
        {
          userId: testUserId2,
          username: testUsername2,
          handshake: { time: 2000 },
        },
      ];
      mockIO.fetchSockets.mockResolvedValue(mockSockets);
      mockUserPreferencesService.getPreference.mockResolvedValue(true);

      // Act
      const members = await service.getOnlineMembers(testOrgId);

      // Assert
      expect(members).toHaveLength(2);
      expect(members[0]).toEqual({
        userId: testUserId1,
        username: testUsername1,
        connectedAt: 1000,
      });
      expect(mockUserPreferencesService.getPreference).toHaveBeenCalledTimes(2);
    });

    it('should exclude users who have showOnlineStatus disabled', async () => {
      // Arrange
      const mockSockets = [
        {
          userId: testUserId1,
          username: testUsername1,
          handshake: { time: 1000 },
        },
        {
          userId: testUserId2,
          username: testUsername2,
          handshake: { time: 2000 },
        },
      ];
      mockIO.fetchSockets.mockResolvedValue(mockSockets);
      mockUserPreferencesService.getPreference
        .mockResolvedValueOnce(true) // user1 has it enabled
        .mockResolvedValueOnce(false); // user2 has it disabled

      // Act
      const members = await service.getOnlineMembers(testOrgId);

      // Assert
      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe(testUserId1);
    });

    it('should deduplicate users with multiple connections', async () => {
      // Arrange
      const mockSockets = [
        {
          userId: testUserId1,
          username: testUsername1,
          handshake: { time: 1000 },
        },
        {
          userId: testUserId1,
          username: testUsername1,
          handshake: { time: 2000 }, // Later connection
        },
      ];
      mockIO.fetchSockets.mockResolvedValue(mockSockets);
      mockUserPreferencesService.getPreference.mockResolvedValue(true);

      // Act
      const members = await service.getOnlineMembers(testOrgId);

      // Assert
      expect(members).toHaveLength(1);
      expect(members[0].connectedAt).toBe(1000); // Should keep earliest connection
    });

    it('should return empty array on error', async () => {
      // Arrange
      mockIO.fetchSockets.mockRejectedValue(new Error('Connection error'));

      // Act
      const members = await service.getOnlineMembers(testOrgId);

      // Assert
      expect(members).toEqual([]);
    });
  });

  describe('isUserOnline', () => {
    it('should return true when user has active connection', async () => {
      // Arrange
      const mockSockets = [{ userId: testUserId1 }, { userId: testUserId2 }];
      mockIO.fetchSockets = jest.fn().mockResolvedValue(mockSockets);

      // Act
      const isOnline = await service.isUserOnline(testUserId1);

      // Assert
      expect(isOnline).toBe(true);
    });

    it('should return false when user has no active connection', async () => {
      // Arrange
      const mockSockets = [{ userId: testUserId2 }];
      mockIO.fetchSockets = jest.fn().mockResolvedValue(mockSockets);

      // Act
      const isOnline = await service.isUserOnline(testUserId1);

      // Assert
      expect(isOnline).toBe(false);
    });

    it('should return false on error', async () => {
      // Arrange
      mockIO.fetchSockets = jest.fn().mockRejectedValue(new Error('Connection error'));

      // Act
      const isOnline = await service.isUserOnline(testUserId1);

      // Assert
      expect(isOnline).toBe(false);
    });
  });

  describe('getOnlineCountsForOrganizations', () => {
    it('should return counts for multiple organizations', async () => {
      // Arrange
      const orgIds = ['org-1', 'org-2'];
      const mockSockets1 = [{ userId: testUserId1 }];
      const mockSockets2 = [{ userId: testUserId1 }, { userId: testUserId2 }];

      let callCount = 0;
      mockIO.fetchSockets.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? mockSockets1 : mockSockets2);
      });

      // Act
      const counts = await service.getOnlineCountsForOrganizations(orgIds);

      // Assert
      expect(counts.get('org-1')).toBe(1);
      expect(counts.get('org-2')).toBe(2);
    });
  });

  describe('emitPresenceEvent', () => {
    it('should emit event when user has showOnlineStatus enabled', async () => {
      // Arrange
      mockUserPreferencesService.getPreference.mockResolvedValue(true);

      // Act
      await service.emitPresenceEvent(testOrgId, 'user_online', testUserId1, testUsername1);

      // Assert
      expect(mockIO.to).toHaveBeenCalledWith(`org:${testOrgId}`);
      expect(mockIO.emit).toHaveBeenCalledWith('presence', {
        event: 'user_online',
        userId: testUserId1,
        username: testUsername1,
        timestamp: expect.any(Number),
      });
    });

    it('should not emit event when user has showOnlineStatus disabled', async () => {
      // Arrange
      mockUserPreferencesService.getPreference.mockResolvedValue(false);

      // Act
      await service.emitPresenceEvent(testOrgId, 'user_online', testUserId1, testUsername1);

      // Assert
      expect(mockIO.emit).not.toHaveBeenCalled();
    });

    it('should default to emitting when preference is not set', async () => {
      // Arrange
      mockUserPreferencesService.getPreference.mockResolvedValue(undefined);

      // Act
      await service.emitPresenceEvent(testOrgId, 'user_online', testUserId1, testUsername1);

      // Assert
      expect(mockIO.emit).toHaveBeenCalled();
    });
  });

  describe('getUserOrganizations', () => {
    it('should return list of organization IDs for user', async () => {
      // Arrange
      const mockMemberships = [
        { organizationId: 'org-1' },
        { organizationId: 'org-2' },
      ] as OrganizationMembership[];
      mockUserOrgRepository.find.mockResolvedValue(mockMemberships);

      // Act
      const orgIds = await service.getUserOrganizations(testUserId1);

      // Assert
      expect(orgIds).toEqual(['org-1', 'org-2']);
      expect(mockUserOrgRepository.find).toHaveBeenCalledWith({
        where: { userId: testUserId1, isActive: true },
        select: ['organizationId'],
      });
    });

    it('should return empty array on error', async () => {
      // Arrange
      mockUserOrgRepository.find.mockRejectedValue(new Error('Database error'));

      // Act
      const orgIds = await service.getUserOrganizations(testUserId1);

      // Assert
      expect(orgIds).toEqual([]);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

