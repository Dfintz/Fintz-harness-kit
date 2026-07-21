// Unmock DiscordService to test the real implementation
jest.unmock('../../../services/discord/DiscordService');

import { ChannelType, TextChannel } from 'discord.js';

import { DiscordService } from '../../../services/discord/DiscordService';

// Mock Discord.js
jest.mock('discord.js', () => {
  const mockClient = {
    login: jest.fn().mockResolvedValue(undefined),
    isReady: jest.fn().mockReturnValue(true),
    user: { tag: 'TestBot#1234' },
    channels: {
      cache: {
        get: jest.fn(),
      },
    },
    guilds: {
      fetch: jest.fn(),
    },
    on: jest.fn(),
    once: jest.fn((event, callback) => {
      // Immediately call the 'ready' event callback
      if (event === 'ready') {
        setImmediate(callback);
      }
    }),
    destroy: jest.fn(),
  };

  return {
    Client: jest.fn(() => mockClient),
    GatewayIntentBits: {
      Guilds: 1,
      GuildMembers: 2,
      GuildMessages: 4,
      MessageContent: 8,
    },
    Partials: {
      Message: 'Message',
      Channel: 'Channel',
      Reaction: 'Reaction',
    },
    ChannelType: {
      GuildText: 0,
      DM: 1,
    },
  };
});

// Mock NodeCache
jest.mock('node-cache', () =>
  jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    flushAll: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      keys: 0,
      hits: 0,
      misses: 0,
      ksize: 0,
      vsize: 0,
    }),
  }))
);

// Mock logger
// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('DiscordService', () => {
  let discordService: DiscordService;
  const mockBotToken = 'test-bot-token';
  const mockClientId = 'test-client-id';
  const mockClientSecret = 'test-client-secret';
  const mockRedirectUri = 'http://localhost:3000/auth/discord/callback';

  beforeEach(() => {
    discordService = new DiscordService(
      mockBotToken,
      mockClientId,
      mockClientSecret,
      mockRedirectUri
    );
    mockFetch.mockClear();
  });

  afterAll(async () => {
    // Clean up Discord client mock
    if (discordService) {
      await discordService.disconnect();
    }
  });

  // ========================================
  // INITIALIZATION TESTS
  // ========================================

  describe('constructor', () => {
    it('should create a service instance with valid parameters', () => {
      expect(discordService).toBeInstanceOf(DiscordService);
    });

    it('should throw error if bot token is missing', () => {
      expect(() => new DiscordService('', mockClientId, mockClientSecret, mockRedirectUri)).toThrow(
        'Discord bot token is required'
      );
    });

    it('should throw error if SSO parameters are missing', () => {
      expect(() => new DiscordService(mockBotToken, '', mockClientSecret, mockRedirectUri)).toThrow(
        'Discord SSO requires clientId, clientSecret, and redirectUri'
      );
    });
  });

  describe('isReady', () => {
    it('should return true when client is ready', () => {
      expect(discordService.isReady()).toBe(true);
    });
  });

  // ========================================
  // SSO AUTHENTICATION TESTS
  // ========================================

  describe('generateAuthUrl', () => {
    it('should generate a valid authorization URL with state parameter', () => {
      const state = 'random-state-123';
      const url = discordService.generateAuthUrl(state);

      expect(url).toContain('https://discord.com/api/oauth2/authorize');
      expect(url).toContain(`client_id=${mockClientId}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(mockRedirectUri)}`);
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=identify+email');
      expect(url).toContain(`state=${state}`);
    });

    it('should throw error if state parameter is missing', () => {
      expect(() => discordService.generateAuthUrl('')).toThrow(
        'State parameter is required for CSRF protection'
      );
    });
  });

  describe('authenticateUser', () => {
    it('should successfully exchange code for access token', async () => {
      const mockCode = 'auth-code-123';
      const mockResponse = {
        access_token: 'access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'refresh-token',
        scope: 'identify email',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await discordService.authenticateUser(mockCode);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
    });

    it('should throw error if code is missing', async () => {
      await expect(discordService.authenticateUser('')).rejects.toThrow(
        'Authorization code is required'
      );
    });

    it('should use custom redirect URI when provided', async () => {
      const mockCode = 'auth-code-123';
      const customRedirectUri = 'https://custom-frontend.com/callback';
      const mockResponse = {
        access_token: 'access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'refresh-token',
        scope: 'identify email',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await discordService.authenticateUser(mockCode, customRedirectUri);

      expect(result).toEqual(mockResponse);

      // Verify the fetch was called with the custom redirect URI
      const fetchCall = mockFetch.mock.calls[0];
      const body = fetchCall[1].body.toString();
      expect(body).toContain(`redirect_uri=${encodeURIComponent(customRedirectUri)}`);
    });

    it('should throw error if Discord API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({ error: 'invalid_grant' }),
        json: jest.fn().mockResolvedValue({ error: 'invalid_grant' }),
      });

      await expect(discordService.authenticateUser('bad-code')).rejects.toThrow(
        'Discord authentication failed'
      );
    });
  });

  describe('getUserInfo', () => {
    it('should successfully fetch user information', async () => {
      const mockAccessToken = 'access-token';
      const mockUserInfo = {
        id: '123456789',
        username: 'TestUser',
        discriminator: '1234',
        avatar: 'avatar-hash',
        email: 'test@example.com',
        verified: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUserInfo),
      });

      const result = await discordService.getUserInfo(mockAccessToken);

      expect(result).toEqual(mockUserInfo);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/users/@me',
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockAccessToken}` },
        })
      );
    });

    it('should throw error if access token is missing', async () => {
      await expect(discordService.getUserInfo('')).rejects.toThrow('Access token is required');
    });
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      const mockRefreshToken = 'refresh-token';
      const mockResponse = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new-refresh-token',
        scope: 'identify email',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await discordService.refreshAccessToken(mockRefreshToken);

      expect(result).toEqual(mockResponse);
    });

    it('should throw error if refresh token is missing', async () => {
      await expect(discordService.refreshAccessToken('')).rejects.toThrow(
        'Refresh token is required'
      );
    });
  });

  describe('shouldRefreshToken', () => {
    it('should return true if token expires within 24 hours', () => {
      const soon = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours from now
      expect(discordService.shouldRefreshToken(soon)).toBe(true);
    });

    it('should return false if token expires after 24 hours', () => {
      const later = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now
      expect(discordService.shouldRefreshToken(later)).toBe(false);
    });
  });

  describe('revokeToken', () => {
    it('should successfully revoke access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await expect(discordService.revokeToken('access-token')).resolves.not.toThrow();
    });

    it('should throw error if access token is missing', async () => {
      await expect(discordService.revokeToken('')).rejects.toThrow('Access token is required');
    });
  });

  // ========================================
  // BOT OPERATIONS TESTS
  // ========================================

  describe('sendMessage', () => {
    it('should send a message to a text channel', async () => {
      const mockChannel = {
        type: ChannelType.GuildText,
        send: jest.fn().mockResolvedValue({}),
      } as unknown as TextChannel;

      const mockClient = (discordService as any).client;
      mockClient.channels.cache.get.mockReturnValue(mockChannel);

      await discordService.sendMessage('channel-id', 'Test message');

      expect(mockChannel.send).toHaveBeenCalledWith('Test message');
    });

    it('should throw error if channel is not found', async () => {
      const mockClient = (discordService as any).client;
      mockClient.channels.cache.get.mockReturnValue(null);

      await expect(discordService.sendMessage('invalid-channel', 'Test')).rejects.toThrow();
    });
  });

  describe('listenForCommands', () => {
    it('should register command listener', () => {
      const mockHandler = jest.fn();
      const mockClient = (discordService as any).client;

      discordService.listenForCommands('!', mockHandler);

      expect(mockClient.on).toHaveBeenCalledWith('messageCreate', expect.any(Function));
    });
  });

  // ========================================
  // ROLE MANAGEMENT TESTS
  // ========================================

  describe('getUserRoles', () => {
    it('should fetch user roles from Discord', async () => {
      const mockRoles = new Map([
        ['role1', { id: 'role1', name: 'Admin' }],
        ['role2', { id: 'role2', name: 'Member' }],
      ]);

      const mockMember = {
        roles: {
          cache: mockRoles,
        },
      };

      const mockGuild = {
        members: {
          fetch: jest.fn().mockResolvedValue(mockMember),
        },
      };

      const mockClient = (discordService as any).client;
      mockClient.guilds.fetch.mockResolvedValue(mockGuild);

      const result = await discordService.getUserRoles('guild-id', 'user-id');

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Admin' }),
          expect.objectContaining({ name: 'Member' }),
        ])
      );
    });
  });

  describe('assignRole', () => {
    it('should assign a role to a user', async () => {
      const mockMember = {
        roles: {
          add: jest.fn().mockResolvedValue(undefined),
        },
      };

      const mockGuild = {
        members: {
          fetch: jest.fn().mockResolvedValue(mockMember),
          me: {
            permissions: { has: jest.fn().mockReturnValue(true) },
            roles: { highest: { position: 10 } },
          },
        },
        roles: {
          cache: new Map([['role-id', { name: 'TestRole', position: 1 }]]),
        },
      };

      const mockClient = (discordService as any).client;
      mockClient.guilds.fetch.mockResolvedValue(mockGuild);

      const result = await discordService.assignRole('guild-id', 'user-id', 'role-id');

      expect(result).toContain('Role assigned');
      expect(mockMember.roles.add).toHaveBeenCalledWith('role-id');
    });
  });

  describe('removeRole', () => {
    it('should remove a role from a user', async () => {
      const mockMember = {
        roles: {
          remove: jest.fn().mockResolvedValue(undefined),
        },
      };

      const mockGuild = {
        members: {
          fetch: jest.fn().mockResolvedValue(mockMember),
          me: {
            permissions: { has: jest.fn().mockReturnValue(true) },
            roles: { highest: { position: 10 } },
          },
        },
      };

      const mockClient = (discordService as any).client;
      mockClient.guilds.fetch.mockResolvedValue(mockGuild);

      const result = await discordService.removeRole('guild-id', 'user-id', 'role-id');

      expect(result).toContain('Role removed');
      expect(mockMember.roles.remove).toHaveBeenCalledWith('role-id');
    });
  });

  // ========================================
  // CACHE MANAGEMENT TESTS
  // ========================================

  describe('clearRoleCache', () => {
    it('should clear the role cache', () => {
      expect(() => discordService.clearRoleCache()).not.toThrow();
    });
  });

  describe('getRoleCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = discordService.getRoleCacheStats();
      expect(stats).toBeDefined();
    });
  });

  // ========================================
  // LIFECYCLE TESTS
  // ========================================

  describe('disconnect', () => {
    it('should disconnect from Discord', async () => {
      const mockClient = (discordService as any).client;
      await discordService.disconnect();
      expect(mockClient.destroy).toHaveBeenCalled();
    });
  });
});

// ========================================
// SINGLETON TESTS
// ========================================

describe('DiscordService Singleton', () => {
  // Clear the singleton instance before each test
  beforeEach(() => {
    // Access the private singleton to reset it
    const module = require('../../../services/discord/DiscordService');
    // Reset the singleton instance by re-importing
    jest.resetModules();
  });

  describe('initializeDiscordService', () => {
    it('should initialize the Discord service singleton', () => {
      const { initializeDiscordService } = require('../../../services/discord/DiscordService');
      const service = initializeDiscordService('token', 'clientId', 'clientSecret', 'redirectUri');
      expect(service).toBeDefined();
    });

    it('should return the same instance on subsequent calls', () => {
      const { initializeDiscordService } = require('../../../services/discord/DiscordService');
      const service1 = initializeDiscordService('token', 'clientId', 'clientSecret', 'redirectUri');
      const service2 = initializeDiscordService('token', 'clientId', 'clientSecret', 'redirectUri');
      expect(service1).toBe(service2);
    });
  });

  describe('isDiscordServiceInitialized', () => {
    it('should return false when service is not initialized', () => {
      const { isDiscordServiceInitialized } = require('../../../services/discord/DiscordService');
      expect(isDiscordServiceInitialized()).toBe(false);
    });

    it('should return true when service is initialized', () => {
      const {
        initializeDiscordService,
        isDiscordServiceInitialized,
      } = require('../../../services/discord/DiscordService');
      initializeDiscordService('token', 'clientId', 'clientSecret', 'redirectUri');
      expect(isDiscordServiceInitialized()).toBe(true);
    });
  });

  describe('getDiscordService', () => {
    it('should throw error when service is not initialized', () => {
      const { getDiscordService } = require('../../../services/discord/DiscordService');
      expect(() => getDiscordService()).toThrow('Discord service not initialized');
    });

    it('should return the service instance when initialized', () => {
      const {
        initializeDiscordService,
        getDiscordService,
      } = require('../../../services/discord/DiscordService');
      const service = initializeDiscordService('token', 'clientId', 'clientSecret', 'redirectUri');
      expect(getDiscordService()).toBe(service);
    });
  });
});
