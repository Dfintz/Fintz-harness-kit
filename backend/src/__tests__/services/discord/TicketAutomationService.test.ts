/**
 * TicketAutomationService Tests
 *
 * Tests for the Ticket Automation Service:
 * - Auto-close inactive tickets
 * - Auto-escalate unresponded tickets
 * - Auto-delete resolved tickets
 * - Guild-level automation run
 */

jest.mock('../../../config/database', () => {
  const mockRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    metadata: { name: 'Ticket' },
  };
  return {
    AppDataSource: {
      getRepository: jest.fn().mockReturnValue(mockRepo),
      _mockRepo: mockRepo,
    },
  };
});
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../services/discord/DmNotificationService', () => {
  const mockInstance = {
    sendNotifications: jest.fn().mockResolvedValue(undefined),
    buildTicketClosedEmbed: jest.fn().mockReturnValue({ toJSON: () => ({}) }),
    buildTicketEscalatedEmbed: jest.fn().mockReturnValue({ toJSON: () => ({}) }),
  };
  return {
    DmNotificationService: {
      getInstance: jest.fn().mockReturnValue(mockInstance),
    },
    DmEventType: {
      TICKET_CLOSED: 'TICKET_CLOSED',
      TICKET_ESCALATED: 'TICKET_ESCALATED',
    },
  };
});
jest.mock('../../../services/discord/TicketTranscriptService', () => {
  const mockInstance = {
    generateTranscript: jest.fn().mockReturnValue({
      ticketNumber: 1,
      subject: 'Test',
      html: '<html></html>',
      plainText: 'Test transcript',
    }),
    postToChannel: jest.fn().mockResolvedValue(undefined),
  };
  return {
    TicketTranscriptService: {
      getInstance: jest.fn().mockReturnValue(mockInstance),
    },
  };
});
jest.mock('../../../services/discord/DiscordSettingsService', () => {
  return {
    DiscordSettingsService: jest.fn().mockImplementation(() => ({
      getSettings: jest.fn().mockResolvedValue({
        ticketSettings: {
          transcriptChannelId: 'transcript-channel',
          escalationRoleId: 'escalation-role',
        },
      }),
    })),
  };
});

import { AppDataSource } from '../../../config/database';
import { TicketStatus } from '../../../models/Ticket';
import {
  TicketAutomationRules,
  TicketAutomationService,
} from '../../../services/discord/TicketAutomationService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getService(): TicketAutomationService {
  (TicketAutomationService as any).instance = undefined;
  return TicketAutomationService.getInstance();
}

function getMockRepo() {
  return (AppDataSource as any)._mockRepo;
}

function createMockClient() {
  const mockChannel = { send: jest.fn().mockResolvedValue({}) };
  return {
    channels: {
      fetch: jest.fn().mockResolvedValue(mockChannel),
    },
    guilds: {
      cache: new Map(),
    },
    _mockChannel: mockChannel,
  };
}

function createMockTicket(overrides: Record<string, any> = {}) {
  return {
    id: 'ticket-1',
    ticketNumber: 42,
    subject: 'Test Ticket',
    category: 'General',
    organizationId: 'org-1',
    creatorId: 'user-1',
    creatorDiscordId: 'discord-user-1',
    creatorName: 'TestUser',
    status: TicketStatus.OPEN,
    tags: [],
    messages: [
      {
        id: 'msg-1',
        authorId: 'user-1',
        authorName: 'TestUser',
        content: 'Need help',
        createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000), // 72h ago
        isInternal: false,
      },
    ],
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
    discordChannelId: 'ticket-channel-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TicketAutomationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      (TicketAutomationService as any).instance = undefined;
      const a = TicketAutomationService.getInstance();
      const b = TicketAutomationService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('runForGuild', () => {
    it('should skip when all rules are disabled (0)', async () => {
      const service = getService();
      const rules: TicketAutomationRules = {
        autoCloseInactiveHours: 0,
        autoEscalateHours: 0,
        autoDeleteResolvedDays: 0,
      };

      const result = await service.runForGuild('org-1', 'guild-1', rules);
      expect(result.autoClosed).toBe(0);
      expect(result.autoEscalated).toBe(0);
      expect(result.autoDeleted).toBe(0);
    });

    it('should auto-close inactive tickets', async () => {
      const service = getService();
      const mockClient = createMockClient();
      service.initialize(mockClient as any);

      const inactiveTicket = createMockTicket(); // 72h old with no recent messages
      getMockRepo().find.mockResolvedValue([inactiveTicket]);

      const rules: TicketAutomationRules = {
        autoCloseInactiveHours: 24, // Close after 24h
        notifyOnAutoClose: true,
      };

      const result = await service.runForGuild('org-1', 'guild-1', rules);
      expect(result.autoClosed).toBe(1);
      expect(getMockRepo().save).toHaveBeenCalled();
      expect(inactiveTicket.status).toBe(TicketStatus.CLOSED);
      expect(inactiveTicket.tags).toContain('auto-closed');
    });

    it('should send close DM with guildId when auto-closing and notifyOnAutoClose is true', async () => {
      const service = getService();
      const mockClient = createMockClient();
      service.initialize(mockClient as any);

      const inactiveTicket = createMockTicket();
      getMockRepo().find.mockResolvedValue([inactiveTicket]);

      const rules: TicketAutomationRules = {
        autoCloseInactiveHours: 24,
        notifyOnAutoClose: true,
      };

      const { DmNotificationService } = require('../../../services/discord/DmNotificationService');
      const mockDmService = DmNotificationService.getInstance();

      await service.runForGuild('org-1', 'guild-1', rules);

      // Verify sendNotifications was called with guildId
      expect(mockDmService.sendNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'TICKET_CLOSED',
          recipientDiscordIds: ['discord-user-1'],
          guildId: 'guild-1',
        })
      );
    });

    it('should NOT auto-close tickets with recent activity', async () => {
      const service = getService();
      service.initialize(createMockClient() as any);

      const recentTicket = createMockTicket({
        messages: [
          {
            id: 'msg-1',
            authorId: 'user-1',
            authorName: 'User',
            content: 'Just updated',
            createdAt: new Date(), // Just now
            isInternal: false,
          },
        ],
      });
      getMockRepo().find.mockResolvedValue([recentTicket]);

      const rules: TicketAutomationRules = {
        autoCloseInactiveHours: 24,
      };

      const result = await service.runForGuild('org-1', 'guild-1', rules);
      expect(result.autoClosed).toBe(0);
    });

    it('should auto-escalate tickets with no staff reply', async () => {
      const service = getService();
      service.initialize(createMockClient() as any);

      const unrepliedTicket = createMockTicket({
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      });
      getMockRepo().find.mockResolvedValue([unrepliedTicket]);

      const rules: TicketAutomationRules = {
        autoEscalateHours: 12,
        notifyOnAutoEscalate: true,
      };

      const result = await service.runForGuild('org-1', 'guild-1', rules);
      expect(result.autoEscalated).toBe(1);
      expect(unrepliedTicket.tags).toContain('escalated');
    });

    it('should NOT escalate tickets that already have a staff reply', async () => {
      const service = getService();
      service.initialize(createMockClient() as any);

      const repliedTicket = createMockTicket({
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        messages: [
          {
            id: 'msg-1',
            authorId: 'user-1',
            authorName: 'User',
            content: 'Help please',
            createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
            isInternal: false,
          },
          {
            id: 'msg-2',
            authorId: 'staff-1', // Different from creatorId user-1
            authorName: 'Staff',
            content: 'On it!',
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            isInternal: false,
          },
        ],
      });
      getMockRepo().find.mockResolvedValue([repliedTicket]);

      const rules: TicketAutomationRules = {
        autoEscalateHours: 12,
      };

      const result = await service.runForGuild('org-1', 'guild-1', rules);
      expect(result.autoEscalated).toBe(0);
    });

    it('should NOT escalate already-escalated tickets', async () => {
      const service = getService();
      service.initialize(createMockClient() as any);

      const alreadyEscalated = createMockTicket({
        tags: ['escalated'],
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      });
      getMockRepo().find.mockResolvedValue([alreadyEscalated]);

      const rules: TicketAutomationRules = {
        autoEscalateHours: 12,
      };

      const result = await service.runForGuild('org-1', 'guild-1', rules);
      expect(result.autoEscalated).toBe(0);
    });

    it('should auto-delete old resolved tickets', async () => {
      const service = getService();

      getMockRepo().delete.mockResolvedValue({ affected: 3 });

      const rules: TicketAutomationRules = {
        autoDeleteResolvedDays: 30,
      };

      const result = await service.runForGuild('org-1', 'guild-1', rules);
      expect(result.autoDeleted).toBe(3);
      expect(getMockRepo().delete).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const service = getService();
      getMockRepo().find.mockRejectedValue(new Error('Database error'));

      const rules: TicketAutomationRules = {
        autoCloseInactiveHours: 24,
      };

      const result = await service.runForGuild('org-1', 'guild-1', rules);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Database error');
    });
  });
});
