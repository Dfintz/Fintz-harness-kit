/**
 * DmNotificationService Tests
 *
 * Tests for the DM Notification Service:
 * - Event type enabled checking
 * - Embed builder methods
 * - Send notifications (fire-and-forget with error handling)
 * - Default settings
 */

jest.mock('../../../config/database', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import {
  DEFAULT_DM_NOTIFICATION_SETTINGS,
  DmEventType,
  DmNotificationService,
  DmNotificationSettings,
} from '../../../services/discord/DmNotificationService';
import { DiscordUserPreferenceService } from '../../../services/discord/DiscordUserPreferenceService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockClient() {
  const mockUser = {
    send: jest.fn().mockResolvedValue({}),
    tag: 'TestUser#1234',
  };
  return {
    users: {
      fetch: jest.fn().mockResolvedValue(mockUser),
    },
    _mockUser: mockUser,
  };
}

function getService(): DmNotificationService {
  // Reset singleton for test isolation
  (DmNotificationService as any).instance = undefined;
  return DmNotificationService.getInstance();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DmNotificationService', () => {
  const originalFailClosedFlag = process.env.DM_NOTIFICATION_PREFS_FAIL_CLOSED;

  beforeEach(() => {
    delete process.env.DM_NOTIFICATION_PREFS_FAIL_CLOSED;
  });

  afterAll(() => {
    if (originalFailClosedFlag === undefined) {
      delete process.env.DM_NOTIFICATION_PREFS_FAIL_CLOSED;
    } else {
      process.env.DM_NOTIFICATION_PREFS_FAIL_CLOSED = originalFailClosedFlag;
    }
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const a = DmNotificationService.getInstance();
      const b = DmNotificationService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('DEFAULT_DM_NOTIFICATION_SETTINGS', () => {
    it('should have enabled true by default', () => {
      expect(DEFAULT_DM_NOTIFICATION_SETTINGS.enabled).toBe(true);
    });

    it('should have all ticket events enabled', () => {
      expect(DEFAULT_DM_NOTIFICATION_SETTINGS.ticketCreatedNotify).toBe(true);
      expect(DEFAULT_DM_NOTIFICATION_SETTINGS.ticketAssignedNotify).toBe(true);
      expect(DEFAULT_DM_NOTIFICATION_SETTINGS.ticketClosedNotify).toBe(true);
      expect(DEFAULT_DM_NOTIFICATION_SETTINGS.ticketEscalatedNotify).toBe(true);
    });

    it('should have recruitment events enabled', () => {
      expect(DEFAULT_DM_NOTIFICATION_SETTINGS.recruitmentReceivedNotify).toBe(true);
      expect(DEFAULT_DM_NOTIFICATION_SETTINGS.recruitmentAcceptedNotify).toBe(true);
      expect(DEFAULT_DM_NOTIFICATION_SETTINGS.recruitmentDeniedNotify).toBe(true);
    });
  });

  describe('isEventEnabled', () => {
    it('should return false when global enabled is false', () => {
      const service = getService();
      const settings: DmNotificationSettings = {
        ...DEFAULT_DM_NOTIFICATION_SETTINGS,
        enabled: false,
      };
      expect(service.isEventEnabled(DmEventType.TICKET_CREATED, settings)).toBe(false);
    });

    it('should return true when both global and specific event are enabled', () => {
      const service = getService();
      const settings: DmNotificationSettings = {
        ...DEFAULT_DM_NOTIFICATION_SETTINGS,
        enabled: true,
        ticketCreatedNotify: true,
      };
      expect(service.isEventEnabled(DmEventType.TICKET_CREATED, settings)).toBe(true);
    });

    it('should return false when specific event is disabled', () => {
      const service = getService();
      const settings: DmNotificationSettings = {
        ...DEFAULT_DM_NOTIFICATION_SETTINGS,
        enabled: true,
        ticketClosedNotify: false,
      };
      expect(service.isEventEnabled(DmEventType.TICKET_CLOSED, settings)).toBe(false);
    });

    it('should map RECRUITMENT_RECEIVED to recruitmentReceived setting', () => {
      const service = getService();
      const settings: DmNotificationSettings = {
        ...DEFAULT_DM_NOTIFICATION_SETTINGS,
        enabled: true,
        recruitmentReceivedNotify: false,
      };
      expect(service.isEventEnabled(DmEventType.RECRUITMENT_RECEIVED, settings)).toBe(false);
    });

    it('should return true for unmapped event types (defaults to enabled)', () => {
      const service = getService();
      const settings: DmNotificationSettings = {
        ...DEFAULT_DM_NOTIFICATION_SETTINGS,
        enabled: true,
      };
      // LFG_PLAYER_JOINED should be mapped
      expect(service.isEventEnabled(DmEventType.LFG_PLAYER_JOINED, settings)).toBe(true);
    });
  });

  describe('sendNotifications', () => {
    it('should send DMs to all recipients', async () => {
      const service = getService();
      const mockClient = createMockClient();
      service.initialize(mockClient as any);

      const embed = service.buildTicketCreatedEmbed('42', 'Bug Report', 'TestUser');

      await service.sendNotifications({
        eventType: DmEventType.TICKET_CREATED,
        recipientDiscordIds: ['user-1', 'user-2'],
        embed,
      });

      expect(mockClient.users.fetch).toHaveBeenCalledTimes(2);
      expect(mockClient._mockUser.send).toHaveBeenCalledTimes(2);
    });

    it('should not throw when DMs fail (user has DMs disabled)', async () => {
      const service = getService();
      const mockClient = createMockClient();
      mockClient.users.fetch.mockRejectedValue(new Error('Cannot send messages to this user'));
      service.initialize(mockClient as any);

      const embed = service.buildTicketClosedEmbed('42', 'Resolved');

      // Should not throw
      await expect(
        service.sendNotifications({
          eventType: DmEventType.TICKET_CLOSED,
          recipientDiscordIds: ['user-1'],
          embed,
        })
      ).resolves.not.toThrow();
    });

    it('should skip sending when no client is initialized', async () => {
      const service = getService();
      // Do not initialize client

      const embed = service.buildTicketCreatedEmbed('1', 'Test', 'User');

      // Should not throw
      await expect(
        service.sendNotifications({
          eventType: DmEventType.TICKET_CREATED,
          recipientDiscordIds: ['user-1'],
          embed,
        })
      ).resolves.not.toThrow();
    });

    it('should fail-open on preference lookup error by default', async () => {
      const service = getService();
      const mockClient = createMockClient();
      service.initialize(mockClient as any);

      const prefService = DiscordUserPreferenceService.getInstance();
      const prefSpy = jest
        .spyOn(prefService, 'filterDmEnabled')
        .mockRejectedValue(new Error('preference service unavailable'));

      const embed = service.buildTicketCreatedEmbed('42', 'Bug Report', 'TestUser');

      await service.sendNotifications({
        eventType: DmEventType.TICKET_CREATED,
        recipientDiscordIds: ['user-1', 'user-2'],
        embed,
        guildId: 'guild-1',
      });

      expect(prefSpy).toHaveBeenCalledTimes(1);
      expect(mockClient.users.fetch).toHaveBeenCalledTimes(2);
      prefSpy.mockRestore();
    });

    it('should fail-closed on preference lookup error when flag is enabled', async () => {
      process.env.DM_NOTIFICATION_PREFS_FAIL_CLOSED = 'true';

      const service = getService();
      const mockClient = createMockClient();
      service.initialize(mockClient as any);

      const prefService = DiscordUserPreferenceService.getInstance();
      const prefSpy = jest
        .spyOn(prefService, 'filterDmEnabled')
        .mockRejectedValue(new Error('preference service unavailable'));

      const embed = service.buildTicketCreatedEmbed('42', 'Bug Report', 'TestUser');

      const result = await service.sendNotifications({
        eventType: DmEventType.TICKET_CREATED,
        recipientDiscordIds: ['user-1', 'user-2'],
        embed,
        guildId: 'guild-1',
      });

      expect(prefSpy).toHaveBeenCalledTimes(1);
      expect(mockClient.users.fetch).not.toHaveBeenCalled();
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      prefSpy.mockRestore();
    });
  });

  describe('embed builders', () => {
    let service: DmNotificationService;

    beforeEach(() => {
      service = getService();
    });

    it('buildTicketCreatedEmbed should include ticket number and subject', () => {
      const embed = service.buildTicketCreatedEmbed('#42', 'Login Issue', 'Technical');
      const json = embed.toJSON();
      expect(json.description).toContain('#42');
      expect(json.fields?.some(f => f.value.includes('Login Issue'))).toBe(true);
    });

    it('buildTicketAssignedEmbed should include assignee name', () => {
      const embed = service.buildTicketAssignedEmbed('#7', 'Admin');
      const json = embed.toJSON();
      expect(json.description).toContain('#7');
      expect(json.description).toContain('Admin');
    });

    it('buildTicketRepliedEmbed should include responder name', () => {
      const embed = service.buildTicketRepliedEmbed('#3', 'ModeratorX', 'Looking into it');
      const json = embed.toJSON();
      expect(json.description).toContain('ModeratorX');
    });

    it('buildTicketClosedEmbed should include resolution', () => {
      const embed = service.buildTicketClosedEmbed('#5', 'Fixed in patch 3.24');
      const json = embed.toJSON();
      expect(json.fields?.some(f => f.value.includes('Fixed in patch 3.24'))).toBe(true);
    });

    it('buildTicketEscalatedEmbed should include reason', () => {
      const embed = service.buildTicketEscalatedEmbed('#10', 'No response in 48h');
      const json = embed.toJSON();
      expect(json.fields?.some(f => f.value.includes('No response in 48h'))).toBe(true);
    });

    it('buildRecruitmentReceivedEmbed should include applicant name', () => {
      const embed = service.buildRecruitmentReceivedEmbed('StarPilot', 'Freelancer');
      const json = embed.toJSON();
      expect(json.description).toContain('StarPilot');
    });

    it('buildRecruitmentAcceptedEmbed should include org name', () => {
      const embed = service.buildRecruitmentAcceptedEmbed('Stanton Corp');
      const json = embed.toJSON();
      expect(json.description).toContain('Stanton Corp');
    });

    it('buildRecruitmentDeniedEmbed should include reason', () => {
      const embed = service.buildRecruitmentDeniedEmbed('Stanton Corp', 'Not enough experience');
      const json = embed.toJSON();
      expect(json.fields?.some(f => f.value.includes('Not enough experience'))).toBe(true);
    });

    it('buildLfgJoinedEmbed should include member and activity', () => {
      const embed = service.buildLfgJoinedEmbed('Mining', 'Gamer42', 3, 4);
      const json = embed.toJSON();
      expect(json.description).toContain('Gamer42');
      expect(json.description).toContain('Mining');
    });
  });

  // -------------------------------------------------------------------------
  // Persistent retry queue (PR5 — F5)
  // -------------------------------------------------------------------------

  describe('persistent retry queue', () => {
    type MockRepo = {
      create: jest.Mock;
      save: jest.Mock;
      find: jest.Mock;
      delete: jest.Mock;
    };

    function createMockRepo(): MockRepo {
      return {
        create: jest.fn(input => ({ ...input })),
        save: jest.fn().mockImplementation(async row => row),
        find: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };
    }

    function installRepo(repo: MockRepo | null) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AppDataSource } = require('../../../config/database');
      (AppDataSource.getRepository as jest.Mock).mockReturnValue(repo);
    }

    afterEach(() => {
      installRepo(null);
    });

    it('persists a row when a live send fails', async () => {
      const repo = createMockRepo();
      installRepo(repo);

      const service = getService();
      const mockClient = createMockClient();
      mockClient.users.fetch.mockRejectedValue(new Error('Cannot send messages to this user'));
      service.initialize(mockClient as any);

      const embed = service.buildTicketClosedEmbed('99', 'Resolved');

      await service.sendNotifications({
        eventType: DmEventType.TICKET_CLOSED,
        recipientDiscordIds: ['user-x'],
        embed,
        guildId: 'guild-1',
        content: 'hello',
      });

      expect(repo.save).toHaveBeenCalledTimes(1);
      const saved = repo.save.mock.calls[0][0];
      expect(saved.recipientDiscordId).toBe('user-x');
      expect(saved.eventType).toBe(DmEventType.TICKET_CLOSED);
      expect(saved.guildId).toBe('guild-1');
      expect(saved.content).toBe('hello');
      expect(saved.attemptCount).toBe(1);
      expect(saved.embedJson).toBeDefined();
      expect(saved.lastError).toContain('Cannot send messages');
      expect(saved.nextRetryAt).toBeInstanceOf(Date);
      expect(saved.expiresAt).toBeInstanceOf(Date);
      // nextRetryAt ≈ now + 5min; expiresAt ≈ now + 24h
      const delta = saved.expiresAt.getTime() - saved.nextRetryAt.getTime();
      expect(delta).toBeGreaterThan(23 * 60 * 60 * 1000);
    });

    it('does not throw if the repository is unavailable', async () => {
      installRepo(null);

      const service = getService();
      const mockClient = createMockClient();
      mockClient.users.fetch.mockRejectedValue(new Error('boom'));
      service.initialize(mockClient as any);

      const embed = service.buildTicketCreatedEmbed('1', 'X', 'Y');

      await expect(
        service.sendNotifications({
          eventType: DmEventType.TICKET_CREATED,
          recipientDiscordIds: ['u'],
          embed,
        })
      ).resolves.not.toThrow();
    });

    it('retryFailedDms returns zeros when no client is initialized', async () => {
      const repo = createMockRepo();
      installRepo(repo);

      const service = getService();
      // No initialize()

      const result = await service.retryFailedDms();
      expect(result).toEqual({ expired: 0, succeeded: 0, rescheduled: 0, dropped: 0 });
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('retryFailedDms deletes the row on successful retry', async () => {
      const repo = createMockRepo();
      const dueRow = {
        id: 'row-1',
        recipientDiscordId: 'user-1',
        eventType: DmEventType.TICKET_CREATED,
        guildId: null,
        content: null,
        embedJson: { title: 'queued' },
        attemptCount: 1,
        nextRetryAt: new Date(Date.now() - 1000),
        lastError: 'old error',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date(),
      };
      repo.find.mockResolvedValue([dueRow]);
      installRepo(repo);

      const service = getService();
      const mockClient = createMockClient();
      service.initialize(mockClient as any);

      const result = await service.retryFailedDms();

      expect(mockClient.users.fetch).toHaveBeenCalledWith('user-1');
      expect(mockClient._mockUser.send).toHaveBeenCalledWith({ embeds: [{ title: 'queued' }] });
      expect(repo.delete).toHaveBeenCalledWith('row-1');
      expect(result).toEqual({ expired: 0, succeeded: 1, rescheduled: 0, dropped: 0 });
    });

    it('retryFailedDms reschedules with backoff on failure', async () => {
      const repo = createMockRepo();
      const dueRow = {
        id: 'row-2',
        recipientDiscordId: 'user-2',
        eventType: DmEventType.TICKET_CREATED,
        guildId: null,
        content: null,
        embedJson: { title: 'q' },
        attemptCount: 1,
        nextRetryAt: new Date(Date.now() - 1000),
        lastError: null,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date(),
      };
      repo.find.mockResolvedValue([dueRow]);
      installRepo(repo);

      const service = getService();
      const mockClient = createMockClient();
      mockClient.users.fetch.mockRejectedValue(new Error('still failing'));
      service.initialize(mockClient as any);

      const before = Date.now();
      const result = await service.retryFailedDms();

      expect(result).toEqual({ expired: 0, succeeded: 0, rescheduled: 1, dropped: 0 });
      expect(repo.save).toHaveBeenCalledTimes(1);
      const saved = repo.save.mock.calls[0][0];
      expect(saved.attemptCount).toBe(2);
      expect(saved.lastError).toBe('still failing');
      // attempt 2 → +30 min
      const delay = saved.nextRetryAt.getTime() - before;
      expect(delay).toBeGreaterThanOrEqual(29 * 60 * 1000);
      expect(delay).toBeLessThanOrEqual(31 * 60 * 1000);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('retryFailedDms drops the row at MAX_ATTEMPTS', async () => {
      const repo = createMockRepo();
      // attemptCount=3 → next failure makes it 4 = MAX_ATTEMPTS, should drop
      const dueRow = {
        id: 'row-3',
        recipientDiscordId: 'user-3',
        eventType: DmEventType.TICKET_CREATED,
        guildId: null,
        content: null,
        embedJson: { title: 'q' },
        attemptCount: 3,
        nextRetryAt: new Date(Date.now() - 1000),
        lastError: null,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date(),
      };
      repo.find.mockResolvedValue([dueRow]);
      installRepo(repo);

      const service = getService();
      const mockClient = createMockClient();
      mockClient.users.fetch.mockRejectedValue(new Error('final failure'));
      service.initialize(mockClient as any);

      const result = await service.retryFailedDms();

      expect(result).toEqual({ expired: 0, succeeded: 0, rescheduled: 0, dropped: 1 });
      expect(repo.delete).toHaveBeenCalledWith('row-3');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('retryFailedDms drops expired rows without retrying', async () => {
      const repo = createMockRepo();
      const expiredRow = {
        id: 'row-4',
        recipientDiscordId: 'user-4',
        eventType: DmEventType.TICKET_CREATED,
        guildId: null,
        content: null,
        embedJson: { title: 'q' },
        attemptCount: 2,
        nextRetryAt: new Date(Date.now() - 1000),
        lastError: null,
        expiresAt: new Date(Date.now() - 1000), // already expired
        createdAt: new Date(),
      };
      repo.find.mockResolvedValue([expiredRow]);
      installRepo(repo);

      const service = getService();
      const mockClient = createMockClient();
      service.initialize(mockClient as any);

      const result = await service.retryFailedDms();

      expect(result).toEqual({ expired: 1, succeeded: 0, rescheduled: 0, dropped: 0 });
      expect(repo.delete).toHaveBeenCalledWith('row-4');
      expect(mockClient.users.fetch).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
