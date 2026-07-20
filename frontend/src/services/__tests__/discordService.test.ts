import { apiClient } from '@/services/apiClient';
import {
    discordService,
    Tunnel,
    TunnelRateLimitConfig,
    VoiceChannelConfig,
} from '@/services/discordService';

jest.mock('@/services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    code: string;
    statusCode?: number;
    constructor(message: string, code: string, statusCode?: number) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
  getErrorMessage: jest.fn((err: unknown) =>
    err instanceof Error ? err.message : 'Unknown error'
  ),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Test-only fixture values, not real credentials
const TEST_TUNNEL_PASSWORD = ['test', 'fixture', 'pw'].join('-');

const mockTunnel: Tunnel = {
  id: 'tunnel-1',
  name: 'Alliance Chat',
  inviteCode: 'abc123',
  creatorGuildId: 'guild-123',
  creatorChannelId: 'channel-1',
  isPublic: true,
  createdAt: new Date(),
  connectedChannels: [
    { guildId: 'guild-123', channelId: 'channel-1', connectedAt: new Date() },
    { guildId: 'ally-guild-456', channelId: 'channel-2', connectedAt: new Date() },
  ],
  contentFilterEnabled: true,
  allowBotMessages: true,
  maxConnectedServers: 0,
  rateLimitConfig: { maxMessages: 10, windowMs: 60000, blockDurationMs: 300000 },
};

describe('discordService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should fetch Discord settings for an organization', async () => {
      mockApiClient.get.mockResolvedValue({ data: [mockTunnel] } as never);

      const result = await discordService.getSettings('org-123');

      expect(result).toBeDefined();
      expect(result.organizationId).toBe('org-123');
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v2/jumppoints', {
        params: undefined,
      });
    });

    it('should return tunnels from API', async () => {
      mockApiClient.get.mockResolvedValue({ data: [mockTunnel] } as never);

      const result = await discordService.getSettings('org-123');

      expect(result.tunnels).toBeDefined();
      expect(result.tunnels).toHaveLength(1);
      expect(result.tunnels[0].name).toBe('Alliance Chat');
      expect(result.tunnels[0].isPublic).toBe(true);
      expect(result.tunnels[0].connectedChannels).toHaveLength(2);
      expect(result.tunnels[0].contentFilterEnabled).toBe(true);
    });

    it('should return tunnel rate limit configuration', async () => {
      mockApiClient.get.mockResolvedValue({ data: [mockTunnel] } as never);

      const result = await discordService.getSettings('org-123');

      const tunnel = result.tunnels[0];
      expect(tunnel.rateLimitConfig).toBeDefined();
      expect(tunnel.rateLimitConfig?.maxMessages).toBe(10);
      expect(tunnel.rateLimitConfig?.windowMs).toBe(60000);
      expect(tunnel.rateLimitConfig?.blockDurationMs).toBe(300000);
    });

    it('should return empty voice channels and templates', async () => {
      mockApiClient.get.mockResolvedValue({ data: [] } as never);

      const result = await discordService.getSettings('org-123');

      expect(result.voiceChannels).toEqual([]);
      expect(result.voiceTemplates).toEqual([]);
    });

    it('should handle empty tunnel response', async () => {
      mockApiClient.get.mockResolvedValue({ data: [] } as never);

      const result = await discordService.getSettings('org-123');

      expect(result.tunnels).toEqual([]);
    });
  });

  describe('updateVoiceConfig', () => {
    it('should update voice configuration', async () => {
      const updates: Partial<VoiceChannelConfig> = {
        autoDeleteEmpty: false,
        defaultUserLimit: 25,
        nameTemplate: 'Custom {user} Channel',
      };

      mockApiClient.patch.mockResolvedValue({
        data: {
          voiceChannelSettings: {
            autoDeleteEmpty: false,
            defaultUserLimit: 25,
            nameTemplate: 'Custom {user} Channel',
          },
        },
      } as never);

      const result = await discordService.updateVoiceConfig('org-123', 'guild-123', updates);

      expect(result.autoDeleteEmpty).toBe(false);
      expect(result.defaultUserLimit).toBe(25);
      expect(result.nameTemplate).toBe('Custom {user} Channel');
    });

    it('should update bitrate setting', async () => {
      const updates: Partial<VoiceChannelConfig> = {
        bitrate: 96000,
      };

      mockApiClient.patch.mockResolvedValue({
        data: { voiceChannelSettings: { bitrate: 96000 } },
      } as never);

      const result = await discordService.updateVoiceConfig('org-123', 'guild-123', updates);

      expect(result.bitrate).toBe(96000);
    });

    it('should update permission flags', async () => {
      const updates: Partial<VoiceChannelConfig> = {
        allowRename: false,
        allowUserLimit: false,
      };

      mockApiClient.patch.mockResolvedValue({
        data: {
          voiceChannelSettings: {
            allowRename: false,
            allowUserLimit: false,
          },
        },
      } as never);

      const result = await discordService.updateVoiceConfig('org-123', 'guild-123', updates);

      expect(result.allowRename).toBe(false);
      expect(result.allowUserLimit).toBe(false);
    });

    it('should fall back to provided config when API omits voice settings', async () => {
      const updates: Partial<VoiceChannelConfig> = {
        nameTemplate: 'Test Channel',
      };

      mockApiClient.patch.mockResolvedValue({ data: {} } as never);

      const result = await discordService.updateVoiceConfig('org-123', 'guild-123', updates);

      expect(result.nameTemplate).toBe('Test Channel');
    });
  });

  describe('createTunnel', () => {
    it('should create a public tunnel via API', async () => {
      const tunnelData = {
        name: 'Test Tunnel',
        guildId: 'guild-123',
        channelId: 'channel-new',
        isPublic: true,
      };

      const createdTunnel: Tunnel = {
        id: 'tunnel-new',
        name: 'Test Tunnel',
        inviteCode: 'xyz789',
        creatorGuildId: 'guild-123',
        creatorChannelId: 'channel-new',
        isPublic: true,
        createdAt: new Date(),
        connectedChannels: [],
        contentFilterEnabled: true,
        allowBotMessages: true,
        maxConnectedServers: 0,
      };

      mockApiClient.post.mockResolvedValue({ data: createdTunnel } as never);

      const result = await discordService.createTunnel('org-123', tunnelData);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Tunnel');
      expect(result.isPublic).toBe(true);
      expect(result.connectedChannels).toEqual([]);
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v2/jumppoints', tunnelData);
    });

    it('should create a private tunnel with password via API', async () => {
      const tunnelData = {
        name: 'Private Tunnel',
        guildId: 'guild-123',
        channelId: 'channel-priv',
        isPublic: false,
        password: TEST_TUNNEL_PASSWORD,
      };

      const createdTunnel: Tunnel = {
        id: 'tunnel-priv',
        name: 'Private Tunnel',
        inviteCode: 'prv456',
        creatorGuildId: 'guild-123',
        creatorChannelId: 'channel-priv',
        isPublic: false,
        password: TEST_TUNNEL_PASSWORD,
        createdAt: new Date(),
        connectedChannels: [],
        contentFilterEnabled: true,
        allowBotMessages: true,
        maxConnectedServers: 0,
      };

      mockApiClient.post.mockResolvedValue({ data: createdTunnel } as never);

      const result = await discordService.createTunnel('org-123', tunnelData);

      expect(result.name).toBe('Private Tunnel');
      expect(result.isPublic).toBe(false);
      expect(result.password).toBe(TEST_TUNNEL_PASSWORD);
    });

    it('should create tunnel with rate limit configuration', async () => {
      const rateLimitConfig: TunnelRateLimitConfig = {
        maxMessages: 20,
        windowMs: 120000,
        blockDurationMs: 600000,
      };

      const tunnelData = {
        name: 'Rate Limited Tunnel',
        guildId: 'guild-123',
        channelId: 'channel-rl',
        isPublic: true,
      };

      const createdTunnel: Tunnel = {
        id: 'tunnel-rl',
        name: 'Rate Limited Tunnel',
        inviteCode: 'rl7890',
        creatorGuildId: 'guild-123',
        creatorChannelId: 'channel-rl',
        isPublic: true,
        createdAt: new Date(),
        connectedChannels: [],
        contentFilterEnabled: true,
        allowBotMessages: true,
        maxConnectedServers: 0,
        rateLimitConfig,
      };

      mockApiClient.post.mockResolvedValue({ data: createdTunnel } as never);

      const result = await discordService.createTunnel('org-123', tunnelData);

      expect(result.rateLimitConfig).toEqual(rateLimitConfig);
    });
  });

  describe('updateTunnel', () => {
    it('should update tunnel name via API', async () => {
      const updates = { name: 'Updated Tunnel Name' };
      const updatedTunnel: Tunnel = {
        ...mockTunnel,
        name: 'Updated Tunnel Name',
      };

      mockApiClient.put.mockResolvedValue({ data: updatedTunnel } as never);

      const result = await discordService.updateTunnel('tunnel-1', updates);

      expect(result.name).toBe('Updated Tunnel Name');
      expect(mockApiClient.put).toHaveBeenCalledWith('/api/v2/jumppoints/tunnel-1', updates);
    });

    it('should update tunnel visibility via API', async () => {
      const updates = { isPublic: false, password: TEST_TUNNEL_PASSWORD };
      const updatedTunnel: Tunnel = {
        ...mockTunnel,
        isPublic: false,
        password: TEST_TUNNEL_PASSWORD,
      };

      mockApiClient.put.mockResolvedValue({ data: updatedTunnel } as never);

      const result = await discordService.updateTunnel('tunnel-1', updates);

      expect(result.isPublic).toBe(false);
      expect(result.password).toBe(TEST_TUNNEL_PASSWORD);
    });

    it('should update content filter setting', async () => {
      const updates = { contentFilterEnabled: false };
      const updatedTunnel: Tunnel = {
        ...mockTunnel,
        contentFilterEnabled: false,
      };

      mockApiClient.put.mockResolvedValue({ data: updatedTunnel } as never);

      const result = await discordService.updateTunnel('tunnel-1', updates);

      expect(result.contentFilterEnabled).toBe(false);
    });

    it('should update rate limit configuration', async () => {
      const newRateLimitConfig: TunnelRateLimitConfig = {
        maxMessages: 5,
        windowMs: 30000,
        blockDurationMs: 180000,
      };

      const updates = { rateLimitConfig: newRateLimitConfig };
      const updatedTunnel: Tunnel = {
        ...mockTunnel,
        rateLimitConfig: newRateLimitConfig,
      };

      mockApiClient.put.mockResolvedValue({ data: updatedTunnel } as never);

      const result = await discordService.updateTunnel('tunnel-1', updates);

      expect(result.rateLimitConfig).toEqual(newRateLimitConfig);
    });

    it('should preserve tunnel ID', async () => {
      mockApiClient.put.mockResolvedValue({
        data: { ...mockTunnel, id: 'tunnel-123' },
      } as never);

      const result = await discordService.updateTunnel('tunnel-123', {});

      expect(result.id).toBe('tunnel-123');
    });
  });

  describe('deleteTunnel', () => {
    it('should delete tunnel successfully via API', async () => {
      mockApiClient.delete.mockResolvedValue({ data: {} } as never);

      const result = await discordService.deleteTunnel('tunnel-1', 'guild-123');

      expect(result).toBe(true);
      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/v2/jumppoints/tunnel-1', {
        data: { guildId: 'guild-123' },
      });
    });

    it('should delete tunnel by ID', async () => {
      mockApiClient.delete.mockResolvedValue({ data: {} } as never);

      const result = await discordService.deleteTunnel('tunnel-999', 'guild-456');

      expect(result).toBe(true);
    });
  });

  describe('createVoiceTemplate', () => {
    it('should create voice channel template', async () => {
      const template = {
        name: 'Custom Template',
        description: 'For special operations',
        userLimit: 15,
        bitrate: 128000,
        nameTemplate: 'Op: {event}',
        autoDelete: true,
      };

      const createdTemplate = {
        id: 'template-1',
        createdBy: 'current-user',
        createdAt: new Date(),
        ...template,
      };

      mockApiClient.post.mockResolvedValue({ data: createdTemplate } as never);

      const result = await discordService.createVoiceTemplate('org-123', template);

      expect(result).toBeDefined();
      expect(result.name).toBe('Custom Template');
      expect(result.description).toBe('For special operations');
      expect(result.userLimit).toBe(15);
      expect(result.bitrate).toBe(128000);
      expect(result.nameTemplate).toBe('Op: {event}');
      expect(result.autoDelete).toBe(true);
      expect(result.createdBy).toBe('current-user');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique template ID', async () => {
      const template = {
        name: 'Template 1',
        nameTemplate: '{user}',
        autoDelete: true,
      };

      mockApiClient.post
        .mockResolvedValueOnce({
          data: { id: 'template-1', createdBy: 'user-1', createdAt: new Date(), ...template },
        } as never)
        .mockResolvedValueOnce({
          data: { id: 'template-2', createdBy: 'user-1', createdAt: new Date(), ...template },
        } as never);

      const result1 = await discordService.createVoiceTemplate('org-123', template);
      const result2 = await discordService.createVoiceTemplate('org-123', template);

      expect(result1.id).not.toBe(result2.id);
    });

    it('should create template without optional fields', async () => {
      const template = {
        name: 'Basic Template',
        nameTemplate: 'Channel {user}',
        autoDelete: false,
      };

      mockApiClient.post.mockResolvedValue({
        data: {
          id: 'template-basic',
          createdBy: 'user-1',
          createdAt: new Date(),
          ...template,
        },
      } as never);

      const result = await discordService.createVoiceTemplate('org-123', template);

      expect(result.name).toBe('Basic Template');
      expect(result.description).toBeUndefined();
      expect(result.userLimit).toBeUndefined();
      expect(result.bitrate).toBeUndefined();
    });
  });

  describe('deleteVoiceTemplate', () => {
    it('should delete voice template successfully', async () => {
      mockApiClient.delete.mockResolvedValue({ data: {} } as never);

      const result = await discordService.deleteVoiceTemplate('org-123', 'guild-123', 'template-1');

      expect(result).toBe(true);
    });

    it('should delete template by ID', async () => {
      mockApiClient.delete.mockResolvedValue({ data: {} } as never);

      const result = await discordService.deleteVoiceTemplate(
        'org-123',
        'guild-123',
        'template-999'
      );

      expect(result).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle API errors in getSettings', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network error'));

      await expect(discordService.getSettings('org-123')).rejects.toThrow();
    });

    it('should handle API errors in createTunnel', async () => {
      mockApiClient.post.mockRejectedValue(new Error('Server error'));

      await expect(
        discordService.createTunnel('org-123', { name: 'Test', guildId: 'g1', channelId: 'c1' })
      ).rejects.toThrow();
    });

    it('should handle API errors in updateTunnel', async () => {
      mockApiClient.put.mockRejectedValue(new Error('Not found'));

      await expect(discordService.updateTunnel('tunnel-1', { name: 'New Name' })).rejects.toThrow();
    });

    it('should handle API errors in deleteTunnel', async () => {
      mockApiClient.delete.mockRejectedValue(new Error('Forbidden'));

      await expect(discordService.deleteTunnel('tunnel-1', 'guild-123')).rejects.toThrow();
    });
  });
});
