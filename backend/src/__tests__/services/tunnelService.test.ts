/**
 * TunnelService Tests
 *
 * These tests verify the TunnelService functionality with mocked TypeORM repository.
 * The service uses async/await patterns with PostgreSQL persistence.
 */

// Mock modules BEFORE any imports
jest.mock('../../config/database', () => {
  const mockRepository = {
    create: jest.fn((data: any) => ({
      ...data,
      id: data.id || `tunnel-${Date.now()}`,
      createdAt: new Date(),
    })),
    save: jest.fn((entity: any) => Promise.resolve(entity)),
    findOne: jest.fn(),
    find: jest.fn(() => Promise.resolve([])),
    delete: jest.fn(() => Promise.resolve({ affected: 1 })),
    createQueryBuilder: jest.fn(() => ({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(() => Promise.resolve(null)),
    })),
  };

  return {
    AppDataSource: {
      getRepository: jest.fn(() => mockRepository),
      isInitialized: true,
    },
  };
});

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { AppDataSource } from '../../config/database';
import { TunnelService } from '../../services/discord/TunnelService';

describe('TunnelService', () => {
  let tunnelService: TunnelService;
  let mockRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get fresh mock repository reference
    mockRepo = (AppDataSource.getRepository as jest.Mock)();

    // Create new instance for each test
    tunnelService = new TunnelService();
  });

  describe('createTunnel', () => {
    it('should create a new public tunnel', async () => {
      const tunnelData = {
        name: 'Test Tunnel',
        creatorGuildId: 'guild123',
        creatorChannelId: 'channel456',
        isPublic: true,
        connectedChannels: [
          { guildId: 'guild123', channelId: 'channel456', connectedAt: expect.any(Date) },
        ],
        contentFilterEnabled: true,
      };

      mockRepo.create.mockReturnValue({
        ...tunnelData,
        id: 'test-tunnel-id',
        createdAt: new Date(),
      });
      mockRepo.save.mockResolvedValue({
        ...tunnelData,
        id: 'test-tunnel-id',
        createdAt: new Date(),
      });

      const tunnel = await tunnelService.createTunnel(
        'Test Tunnel',
        'guild123',
        'channel456',
        true
      );

      expect(tunnel).toBeDefined();
      expect(tunnel.name).toBe('Test Tunnel');
      expect(tunnel.creatorGuildId).toBe('guild123');
      expect(tunnel.isPublic).toBe(true);
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should create a private tunnel with password', async () => {
      const tunnelData = {
        name: 'Private Tunnel',
        creatorGuildId: 'guild123',
        creatorChannelId: 'channel456',
        isPublic: false,
        password: 'secret123',
        connectedChannels: [
          { guildId: 'guild123', channelId: 'channel456', connectedAt: expect.any(Date) },
        ],
        contentFilterEnabled: true,
      };

      mockRepo.create.mockReturnValue({
        ...tunnelData,
        id: 'test-tunnel-id',
        createdAt: new Date(),
      });
      mockRepo.save.mockResolvedValue({
        ...tunnelData,
        id: 'test-tunnel-id',
        createdAt: new Date(),
      });

      const tunnel = await tunnelService.createTunnel(
        'Private Tunnel',
        'guild123',
        'channel456',
        false,
        'secret123'
      );

      expect(tunnel).toBeDefined();
      expect(tunnel.isPublic).toBe(false);
      expect(tunnel.password).toBe('secret123');
    });
  });

  describe('getTunnel', () => {
    it('should return undefined for non-existent tunnel', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const retrieved = await tunnelService.getTunnel('nonexistent');

      expect(retrieved).toBeUndefined();
    });

    it('should return tunnel when found', async () => {
      const tunnelEntity = {
        id: 'test-id',
        name: 'Test Tunnel',
        creatorGuildId: 'guild123',
        creatorChannelId: 'channel456',
        isPublic: true,
        connectedChannels: [],
        contentFilterEnabled: true,
        createdAt: new Date(),
      };
      mockRepo.findOne.mockResolvedValue(tunnelEntity);

      const retrieved = await tunnelService.getTunnel('test-id');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-id');
    });
  });

  describe('listPublicTunnels', () => {
    it('should return empty array when no tunnels exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const publicTunnels = await tunnelService.listPublicTunnels();

      expect(publicTunnels).toEqual([]);
    });

    it('should return public tunnels', async () => {
      const tunnels = [
        {
          id: '1',
          name: 'Public 1',
          isPublic: true,
          connectedChannels: [],
          creatorGuildId: 'g1',
          creatorChannelId: 'c1',
          contentFilterEnabled: true,
          createdAt: new Date(),
        },
        {
          id: '2',
          name: 'Public 2',
          isPublic: true,
          connectedChannels: [],
          creatorGuildId: 'g2',
          creatorChannelId: 'c2',
          contentFilterEnabled: true,
          createdAt: new Date(),
        },
      ];
      mockRepo.find.mockResolvedValue(tunnels);

      const publicTunnels = await tunnelService.listPublicTunnels();

      expect(publicTunnels).toHaveLength(2);
      expect(publicTunnels.every(t => t.isPublic)).toBe(true);
    });
  });

  describe('connectToTunnel', () => {
    it('should throw error for non-existent tunnel', async () => {
      mockRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      await expect(
        tunnelService.connectToTunnel('nonexistent', 'guild1', 'channel1')
      ).rejects.toThrow('Tunnel not found');
    });

    it('should throw error for wrong password on private tunnel', async () => {
      const privateTunnel = {
        id: 'private-tunnel',
        name: 'Private',
        isPublic: false,
        password: 'correct-password',
        connectedChannels: [{ guildId: 'g1', channelId: 'c1', connectedAt: new Date() }],
        creatorGuildId: 'g1',
        creatorChannelId: 'c1',
      };

      mockRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(privateTunnel),
      });

      await expect(
        tunnelService.connectToTunnel('private-tunnel', 'guild2', 'channel2', 'wrong-password')
      ).rejects.toThrow('Invalid password');
    });
  });

  describe('disconnectFromTunnel', () => {
    it('should throw error for non-existent tunnel', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        tunnelService.disconnectFromTunnel('nonexistent', 'guild1', 'channel1')
      ).rejects.toThrow('Tunnel not found');
    });
  });

  describe('deleteTunnel', () => {
    it('should throw error for non-existent tunnel', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(tunnelService.deleteTunnel('nonexistent', 'guild1')).rejects.toThrow(
        'Tunnel not found'
      );
    });

    it('should throw error when non-creator tries to delete', async () => {
      const tunnel = {
        id: 'test-tunnel',
        name: 'Test',
        creatorGuildId: 'guild1',
        creatorChannelId: 'channel1',
        connectedChannels: [],
      };
      mockRepo.findOne.mockResolvedValue(tunnel);

      await expect(tunnelService.deleteTunnel('test-tunnel', 'guild2')).rejects.toThrow(
        'Only the creator can delete this tunnel'
      );
    });

    it('should delete tunnel when creator requests', async () => {
      const tunnel = {
        id: 'test-tunnel',
        name: 'Test',
        creatorGuildId: 'guild1',
        creatorChannelId: 'channel1',
        connectedChannels: [],
      };
      mockRepo.findOne.mockResolvedValue(tunnel);
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await tunnelService.deleteTunnel('test-tunnel', 'guild1');

      expect(result).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith('test-tunnel');
    });
  });

  describe('getConnectedChannels', () => {
    it('should return empty array for non-existent tunnel', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const channels = tunnelService.getConnectedChannels('nonexistent');

      expect(channels).toEqual([]);
    });

    it('should return connected channels', async () => {
      const tunnel = {
        id: 'test-tunnel',
        name: 'Test',
        creatorGuildId: 'guild1',
        creatorChannelId: 'channel1',
        connectedChannels: [
          { guildId: 'guild1', channelId: 'channel1', connectedAt: new Date() },
          { guildId: 'guild2', channelId: 'channel2', connectedAt: new Date() },
        ],
      };
      mockRepo.findOne.mockResolvedValue(tunnel);

      // First call getTunnel to populate the cache
      await tunnelService.getTunnel('test-tunnel');

      const channels = tunnelService.getConnectedChannels('test-tunnel');

      expect(channels).toHaveLength(2);
    });

    it('should exclude specified channel', async () => {
      const tunnel = {
        id: 'test-tunnel',
        name: 'Test',
        creatorGuildId: 'guild1',
        creatorChannelId: 'channel1',
        connectedChannels: [
          { guildId: 'guild1', channelId: 'channel1', connectedAt: new Date() },
          { guildId: 'guild2', channelId: 'channel2', connectedAt: new Date() },
        ],
      };
      mockRepo.findOne.mockResolvedValue(tunnel);

      // First call getTunnel to populate the cache
      await tunnelService.getTunnel('test-tunnel');

      const channels = tunnelService.getConnectedChannels('test-tunnel', 'channel1');

      expect(channels).toHaveLength(1);
      expect(channels[0].channelId).toBe('channel2');
    });
  });

  describe('updateWebhook', () => {
    it('should return false for non-existent tunnel', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await tunnelService.updateWebhook(
        'nonexistent',
        'channel1',
        'https://example.com'
      );

      expect(result).toBe(false);
    });

    it('should return false for non-connected channel', async () => {
      const tunnel = {
        id: 'test-tunnel',
        name: 'Test',
        creatorGuildId: 'guild1',
        creatorChannelId: 'channel1',
        connectedChannels: [{ guildId: 'guild1', channelId: 'channel1', connectedAt: new Date() }],
      };
      mockRepo.findOne.mockResolvedValue(tunnel);

      const result = await tunnelService.updateWebhook(
        'test-tunnel',
        'channel999',
        'https://example.com'
      );

      expect(result).toBe(false);
    });

    it('should update webhook for connected channel', async () => {
      const tunnel = {
        id: 'test-tunnel',
        name: 'Test',
        creatorGuildId: 'guild1',
        creatorChannelId: 'channel1',
        connectedChannels: [
          {
            guildId: 'guild1',
            channelId: 'channel1',
            connectedAt: new Date(),
            webhookUrl: undefined,
          },
        ],
      };
      mockRepo.findOne.mockResolvedValue(tunnel);
      mockRepo.save.mockResolvedValue(tunnel);

      const result = await tunnelService.updateWebhook(
        'test-tunnel',
        'channel1',
        'https://discord.com/api/webhooks/123/abc'
      );

      expect(result).toBe(true);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('findTunnelByChannel', () => {
    it('should return undefined when no tunnel found for channel', async () => {
      const result = tunnelService.findTunnelByChannel('channel999');

      expect(result).toBeUndefined();
    });

    it('should find tunnel by connected channel', async () => {
      const tunnel = {
        id: 'test-tunnel',
        name: 'Test',
        creatorGuildId: 'guild1',
        creatorChannelId: 'channel1',
        connectedChannels: [
          { guildId: 'guild1', channelId: 'channel1', connectedAt: new Date() },
          { guildId: 'guild2', channelId: 'channel2', connectedAt: new Date() },
        ],
        isPublic: true,
        contentFilterEnabled: true,
        createdAt: new Date(),
      };
      mockRepo.findOne.mockResolvedValue(tunnel);

      // First populate cache
      await tunnelService.getTunnel('test-tunnel');

      const result = tunnelService.findTunnelByChannel('channel2');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-tunnel');
    });
  });

  describe('findTunnelByChannelAsync (cross-shard cache freshness)', () => {
    const tunnelV1 = {
      id: 'tunnel-fresh',
      name: 'Fresh',
      creatorGuildId: 'guild1',
      creatorChannelId: 'channel1',
      connectedChannels: [
        { guildId: 'guild1', channelId: 'channel1', connectedAt: new Date() },
        { guildId: 'guild2', channelId: 'channel2', connectedAt: new Date() },
      ],
      isPublic: true,
      contentFilterEnabled: true,
      createdAt: new Date(),
    };

    afterEach(() => {
      jest.useRealTimers();
    });

    it('serves a warm cache hit without re-reading the DB within the freshness window', async () => {
      jest.useFakeTimers();
      mockRepo.find.mockResolvedValue([tunnelV1]);

      // First lookup warms the cache via the DB-fallback (find) path.
      const first = await tunnelService.findTunnelByChannelAsync('channel2');
      expect(first?.id).toBe('tunnel-fresh');

      // A second lookup shortly after must hit the cache and not re-read the row.
      mockRepo.findOne.mockClear();
      const second = await tunnelService.findTunnelByChannelAsync('channel2');

      expect(second?.id).toBe('tunnel-fresh');
      expect(mockRepo.findOne).not.toHaveBeenCalled();
    });

    it('re-reads a stale cache entry so new connections propagate after inactivity', async () => {
      jest.useFakeTimers();
      mockRepo.find.mockResolvedValue([tunnelV1]);

      // Warm the cache with the original two-channel tunnel.
      await tunnelService.findTunnelByChannelAsync('channel2');
      expect(tunnelService.getConnectedChannels('tunnel-fresh')).toHaveLength(2);

      // A third channel joins on another shard; the DB now holds the newer state.
      const tunnelV2 = {
        ...tunnelV1,
        connectedChannels: [
          ...tunnelV1.connectedChannels,
          { guildId: 'guild3', channelId: 'channel3', connectedAt: new Date() },
        ],
      };
      mockRepo.findOne.mockResolvedValue(tunnelV2);

      // Once the freshness window elapses, the next relay lookup must refresh from the DB.
      jest.advanceTimersByTime(61_000);
      const refreshed = await tunnelService.findTunnelByChannelAsync('channel2');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'tunnel-fresh' } });
      expect(refreshed?.connectedChannels).toHaveLength(3);
      expect(tunnelService.getConnectedChannels('tunnel-fresh')).toHaveLength(3);
    });

    it('drops a tunnel deleted on another shard once its cache entry goes stale', async () => {
      jest.useFakeTimers();
      mockRepo.find.mockResolvedValue([tunnelV1]);

      await tunnelService.findTunnelByChannelAsync('channel2');

      // Tunnel was deleted elsewhere — DB returns null on refresh.
      mockRepo.findOne.mockResolvedValue(null);
      jest.advanceTimersByTime(61_000);

      const result = await tunnelService.findTunnelByChannelAsync('channel2');

      expect(result).toBeUndefined();
      expect(tunnelService.getConnectedChannels('tunnel-fresh')).toEqual([]);
    });
  });

  describe('getTunnelSync', () => {
    it('should return undefined for non-cached tunnel', () => {
      const result = tunnelService.getTunnelSync('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should return cached tunnel synchronously', async () => {
      const tunnel = {
        id: 'test-tunnel',
        name: 'Test',
        creatorGuildId: 'guild1',
        creatorChannelId: 'channel1',
        connectedChannels: [],
        isPublic: true,
        contentFilterEnabled: true,
        createdAt: new Date(),
      };
      mockRepo.findOne.mockResolvedValue(tunnel);

      // Populate cache first
      await tunnelService.getTunnel('test-tunnel');

      // Now access synchronously
      const result = tunnelService.getTunnelSync('test-tunnel');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-tunnel');
    });
  });

  describe('Analytics', () => {
    describe('recordMessageRelay', () => {
      it('should record successful message relay', () => {
        tunnelService.recordMessageRelay('tunnel-1', false);

        const analytics = tunnelService.getTunnelAnalytics('tunnel-1');

        expect(analytics).toBeDefined();
        expect(analytics?.messagesRelayed).toBe(1);
        expect(analytics?.messagesBlocked).toBe(0);
      });

      it('should record blocked message', () => {
        tunnelService.recordMessageRelay('tunnel-1', true);

        const analytics = tunnelService.getTunnelAnalytics('tunnel-1');

        expect(analytics).toBeDefined();
        expect(analytics?.messagesRelayed).toBe(0);
        expect(analytics?.messagesBlocked).toBe(1);
      });

      it('should track multiple messages', () => {
        tunnelService.recordMessageRelay('tunnel-1', false);
        tunnelService.recordMessageRelay('tunnel-1', false);
        tunnelService.recordMessageRelay('tunnel-1', true);

        const analytics = tunnelService.getTunnelAnalytics('tunnel-1');

        expect(analytics?.messagesRelayed).toBe(2);
        expect(analytics?.messagesBlocked).toBe(1);
      });
    });

    describe('getTunnelAnalytics', () => {
      it('should return null for non-existent tunnel analytics', () => {
        const analytics = tunnelService.getTunnelAnalytics('nonexistent');

        expect(analytics).toBeNull();
      });

      it('should return analytics with all fields', () => {
        tunnelService.recordMessageRelay('tunnel-1', false);

        const analytics = tunnelService.getTunnelAnalytics('tunnel-1');

        expect(analytics).toBeDefined();
        expect(analytics?.tunnelId).toBe('tunnel-1');
        expect(analytics?.messagesRelayed).toBeDefined();
        expect(analytics?.messagesBlocked).toBeDefined();
        expect(analytics?.lastActivity).toBeDefined();
        expect(analytics?.peakConnectionCount).toBeDefined();
        expect(analytics?.totalUniqueGuilds).toBeDefined();
      });
    });

    describe('getSystemStats', () => {
      it('should return system-wide statistics', () => {
        const stats = tunnelService.getSystemStats();

        expect(stats).toBeDefined();
        expect(stats.totalTunnels).toBeDefined();
        expect(stats.activeTunnels).toBeDefined();
        expect(stats.totalConnections).toBeDefined();
        expect(stats.totalMessagesRelayed).toBeDefined();
        expect(stats.totalMessagesBlocked).toBeDefined();
        expect(stats.mostActiveHour).toBeDefined();
        expect(stats.tunnelsByVisibility).toBeDefined();
        expect(stats.topTunnels).toBeDefined();
        expect(Array.isArray(stats.topTunnels)).toBe(true);
      });

      it('should track message counts across tunnels', () => {
        tunnelService.recordMessageRelay('tunnel-1', false);
        tunnelService.recordMessageRelay('tunnel-1', false);
        tunnelService.recordMessageRelay('tunnel-2', false);

        const stats = tunnelService.getSystemStats();

        expect(stats.totalMessagesRelayed).toBe(3);
        expect(stats.totalMessagesBlocked).toBe(0);
      });

      it('should track blocked messages', () => {
        tunnelService.recordMessageRelay('tunnel-1', true);
        tunnelService.recordMessageRelay('tunnel-2', true);

        const stats = tunnelService.getSystemStats();

        expect(stats.totalMessagesBlocked).toBe(2);
      });
    });

    describe('getHourlyActivity', () => {
      it('should return hourly activity map', () => {
        const activity = tunnelService.getHourlyActivity();

        expect(activity).toBeDefined();
        expect(activity.size).toBe(24);
      });

      it('should track messages by hour', () => {
        // Record some messages to trigger hourly tracking
        tunnelService.recordMessageRelay('tunnel-1', false);

        const activity = tunnelService.getHourlyActivity();
        const currentHour = new Date().getHours();

        // Current hour should have at least 1 message
        expect(activity.get(currentHour)).toBeGreaterThanOrEqual(1);
      });
    });

    describe('resetAnalytics', () => {
      it('should reset all analytics data', () => {
        // Record some data
        tunnelService.recordMessageRelay('tunnel-1', false);
        tunnelService.recordMessageRelay('tunnel-1', false);

        // Verify data exists
        let analytics = tunnelService.getTunnelAnalytics('tunnel-1');
        expect(analytics?.messagesRelayed).toBe(2);

        // Reset
        tunnelService.resetAnalytics();

        // Verify data is cleared
        analytics = tunnelService.getTunnelAnalytics('tunnel-1');
        expect(analytics).toBeNull();
      });

      it('should reset system stats', () => {
        tunnelService.recordMessageRelay('tunnel-1', false);

        let stats = tunnelService.getSystemStats();
        expect(stats.totalMessagesRelayed).toBeGreaterThan(0);

        tunnelService.resetAnalytics();

        stats = tunnelService.getSystemStats();
        expect(stats.totalMessagesRelayed).toBe(0);
        expect(stats.totalMessagesBlocked).toBe(0);
      });
    });
  });

  describe('Caching', () => {
    it('should cache tunnels after first fetch', async () => {
      const tunnel = {
        id: 'test-tunnel',
        name: 'Test',
        creatorGuildId: 'guild1',
        creatorChannelId: 'channel1',
        connectedChannels: [],
        isPublic: true,
        contentFilterEnabled: true,
        createdAt: new Date(),
      };
      mockRepo.findOne.mockResolvedValue(tunnel);

      // First call - loads from DB
      await tunnelService.getTunnel('test-tunnel');
      expect(mockRepo.findOne).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await tunnelService.getTunnel('test-tunnel');
      expect(mockRepo.findOne).toHaveBeenCalledTimes(1); // Still 1 - cached
    });

    it('should update cache when tunnel is modified', async () => {
      const tunnel = {
        id: 'test-tunnel',
        name: 'Test',
        creatorGuildId: 'guild1',
        creatorChannelId: 'channel1',
        connectedChannels: [{ guildId: 'guild1', channelId: 'channel1', connectedAt: new Date() }],
        isPublic: true,
        contentFilterEnabled: true,
        createdAt: new Date(),
      };
      mockRepo.findOne.mockResolvedValue(tunnel);
      mockRepo.save.mockResolvedValue({ ...tunnel, name: 'Updated' });

      // Populate cache
      await tunnelService.getTunnel('test-tunnel');

      // Update webhook (which saves to DB)
      await tunnelService.updateWebhook('test-tunnel', 'channel1', 'https://example.com');

      // Cache should be updated
      const cached = tunnelService.getTunnelSync('test-tunnel');
      expect(cached).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should create tunnel with rate limit config', async () => {
      const rateLimitConfig = {
        maxMessagesPerMinute: 10,
        maxMessagesPerHour: 100,
      };

      mockRepo.create.mockReturnValue({
        id: 'test-tunnel',
        name: 'Test',
        creatorGuildId: 'guild1',
        creatorChannelId: 'channel1',
        isPublic: true,
        rateLimitConfig,
        connectedChannels: [
          { guildId: 'guild1', channelId: 'channel1', connectedAt: expect.any(Date) },
        ],
        contentFilterEnabled: true,
        createdAt: new Date(),
      });
      mockRepo.save.mockResolvedValue({
        id: 'test-tunnel',
        name: 'Test',
        creatorGuildId: 'guild1',
        creatorChannelId: 'channel1',
        isPublic: true,
        rateLimitConfig,
        connectedChannels: [{ guildId: 'guild1', channelId: 'channel1', connectedAt: new Date() }],
        contentFilterEnabled: true,
        createdAt: new Date(),
      });

      const tunnel = await tunnelService.createTunnel(
        'Test',
        'guild1',
        'channel1',
        true,
        undefined,
        { rateLimitConfig }
      );

      expect(tunnel.rateLimitConfig).toEqual(rateLimitConfig);
    });
  });

  describe('getTunnelConfig', () => {
    it('should return config for existing tunnel', async () => {
      const tunnel = {
        id: 'test-tunnel',
        name: 'Test',
        creatorGuildId: 'guild1',
        creatorChannelId: 'channel1',
        connectedChannels: [],
        isPublic: true,
        contentFilterEnabled: true,
        rateLimitConfig: { maxMessagesPerMinute: 10, maxMessagesPerHour: 100 },
        createdAt: new Date(),
      };
      mockRepo.findOne.mockResolvedValue(tunnel);

      await tunnelService.getTunnel('test-tunnel');

      const config = tunnelService.getTunnelConfig('test-tunnel');

      expect(config.contentFilterEnabled).toBe(true);
      expect(config.rateLimitConfig).toEqual(tunnel.rateLimitConfig);
    });

    it('should return default config for non-existent tunnel', () => {
      const config = tunnelService.getTunnelConfig('nonexistent');

      expect(config.contentFilterEnabled).toBe(false);
      expect(config.rateLimitConfig).toBeUndefined();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
