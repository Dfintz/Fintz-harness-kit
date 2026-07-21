// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock DiscordAuditLogger
const mockLogAppAuthorized = jest.fn();
const mockLogAppDeauthorized = jest.fn();
jest.mock('../services/shared/DiscordAuditLogger', () => ({
  discordAuditLogger: {
    logAppAuthorized: mockLogAppAuthorized,
    logAppDeauthorized: mockLogAppDeauthorized,
  },
}));

// Mock GuildOrganizationService
const mockResolveOrganization = jest.fn();
const mockCreateOrUpdateMapping = jest.fn();
jest.mock('../services/discord/GuildOrganizationService', () => ({
  GuildOrganizationService: {
    getInstance: () => ({
      resolveOrganization: mockResolveOrganization,
      createOrUpdateMapping: mockCreateOrUpdateMapping,
    }),
  },
}));

// Mock DiscordSettingsService
const mockGetOrCreateSettings = jest.fn();
jest.mock('../services/discord/DiscordSettingsService', () => ({
  DiscordSettingsService: jest.fn().mockImplementation(() => ({
    getOrCreateSettings: mockGetOrCreateSettings,
  })),
}));

import { DiscordWebhookEventService } from '../services/discord/DiscordWebhookEventService';

describe('DiscordWebhookEventService', () => {
  let service: DiscordWebhookEventService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton for test isolation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (DiscordWebhookEventService as any).instance = undefined;
    service = DiscordWebhookEventService.getInstance();
  });

  describe('handleEvent', () => {
    it('should ignore payloads with no event body', async () => {
      await service.handleEvent({
        version: 1,
        application_id: '123',
        type: 1,
      });

      expect(mockLogAppAuthorized).not.toHaveBeenCalled();
      expect(mockLogAppDeauthorized).not.toHaveBeenCalled();
    });

    it('should ignore unknown event types', async () => {
      await service.handleEvent({
        version: 1,
        application_id: '123',
        type: 1,
        event: {
          type: 'SOME_FUTURE_EVENT',
          timestamp: new Date().toISOString(),
        },
      });

      expect(mockLogAppAuthorized).not.toHaveBeenCalled();
      expect(mockLogAppDeauthorized).not.toHaveBeenCalled();
    });
  });

  describe('APPLICATION_AUTHORIZED', () => {
    it('should ensure settings exist when guild is already mapped', async () => {
      mockResolveOrganization.mockResolvedValue('org-123');
      mockGetOrCreateSettings.mockResolvedValue({});

      await service.handleEvent({
        version: 1,
        application_id: '123',
        type: 1,
        event: {
          type: 'APPLICATION_AUTHORIZED',
          timestamp: new Date().toISOString(),
          data: {
            integration_type: 0,
            user: { id: 'user-456' },
            scopes: ['bot', 'applications.commands'],
            guild: { id: 'guild-789', name: 'Test Guild' },
          },
        },
      });

      expect(mockResolveOrganization).toHaveBeenCalledWith('guild-789');
      expect(mockGetOrCreateSettings).toHaveBeenCalledWith('org-123', 'guild-789', 'Test Guild');
      expect(mockLogAppAuthorized).toHaveBeenCalledWith(
        'org-123',
        'guild-789',
        'Test Guild',
        'user-456',
        0
      );
    });

    it('should log with "unknown" org when guild has no mapping', async () => {
      mockResolveOrganization.mockResolvedValue(null);

      await service.handleEvent({
        version: 1,
        application_id: '123',
        type: 1,
        event: {
          type: 'APPLICATION_AUTHORIZED',
          timestamp: new Date().toISOString(),
          data: {
            integration_type: 0,
            user: { id: 'user-456' },
            guild: { id: 'guild-new', name: 'New Guild' },
          },
        },
      });

      expect(mockResolveOrganization).toHaveBeenCalledWith('guild-new');
      expect(mockGetOrCreateSettings).not.toHaveBeenCalled();
      expect(mockLogAppAuthorized).toHaveBeenCalledWith(
        'unknown',
        'guild-new',
        'New Guild',
        'user-456',
        0
      );
    });

    it('should handle user-scoped installs (integration_type=1)', async () => {
      await service.handleEvent({
        version: 1,
        application_id: '123',
        type: 1,
        event: {
          type: 'APPLICATION_AUTHORIZED',
          timestamp: new Date().toISOString(),
          data: {
            integration_type: 1,
            user: { id: 'user-789' },
            scopes: ['applications.commands'],
          },
        },
      });

      expect(mockResolveOrganization).not.toHaveBeenCalled();
      expect(mockLogAppAuthorized).toHaveBeenCalledWith(
        'user-install',
        undefined,
        undefined,
        'user-789',
        1
      );
    });

    it('should handle missing data gracefully', async () => {
      await service.handleEvent({
        version: 1,
        application_id: '123',
        type: 1,
        event: {
          type: 'APPLICATION_AUTHORIZED',
          timestamp: new Date().toISOString(),
        },
      });

      expect(mockResolveOrganization).not.toHaveBeenCalled();
      expect(mockLogAppAuthorized).not.toHaveBeenCalled();
    });
  });

  describe('APPLICATION_DEAUTHORIZED', () => {
    it('should audit log the deauthorization', async () => {
      await service.handleEvent({
        version: 1,
        application_id: '123',
        type: 1,
        event: {
          type: 'APPLICATION_DEAUTHORIZED',
          timestamp: new Date().toISOString(),
          data: {
            user: { id: 'user-456' },
          },
        },
      });

      expect(mockLogAppDeauthorized).toHaveBeenCalledWith('user-456');
    });

    it('should handle missing data gracefully', async () => {
      await service.handleEvent({
        version: 1,
        application_id: '123',
        type: 1,
        event: {
          type: 'APPLICATION_DEAUTHORIZED',
          timestamp: new Date().toISOString(),
        },
      });

      expect(mockLogAppDeauthorized).not.toHaveBeenCalled();
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const instance1 = DiscordWebhookEventService.getInstance();
      const instance2 = DiscordWebhookEventService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
