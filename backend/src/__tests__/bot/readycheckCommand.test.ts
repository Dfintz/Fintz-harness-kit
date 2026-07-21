// Mock all services before importing the command to prevent EntityMetadataNotFoundError
jest.mock('../../services/activity/ActivityService');
jest.mock('../../services/activity/ReadyCheckService');
jest.mock('../../services/user/UserService');
jest.mock('../../services/discord/GuildOrganizationService');
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../bot/utils/realtimeEmit', () => ({
  emitRealtimeToOrg: jest.fn(),
}));
jest.mock('../../bot/utils/guildContext', () => ({
  resolveGuildContext: jest.fn(),
}));
jest.mock('../../bot/utils/commandPanelBuilder', () => ({
  replyWithCommandPanel: jest.fn(),
  parsePanelCustomId: jest.fn(),
  buildPanelCustomId: jest.fn(),
  buildCommandPanel: jest.fn(),
}));

import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';

import { _resetServicesForTesting, readycheck } from '../../bot/commands/readycheck';
import { parsePanelCustomId, replyWithCommandPanel } from '../../bot/utils/commandPanelBuilder';
import { resolveGuildContext } from '../../bot/utils/guildContext';
import { emitRealtimeToOrg } from '../../bot/utils/realtimeEmit';
import { ActivityService } from '../../services/activity/ActivityService';
import { ReadyCheckService } from '../../services/activity/ReadyCheckService';
import { UserService } from '../../services/user/UserService';

// ---------------------------------------------------------------------------
// Helpers to build mock interactions
// ---------------------------------------------------------------------------

function createMockInteraction(
  overrides: Record<string, unknown> = {}
): ChatInputCommandInteraction {
  return {
    guildId: 'guild-123',
    user: { id: 'discord-123', username: 'TestUser', displayName: 'Test User' },
    reply: jest.fn(),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    followUp: jest.fn(),
    replied: false,
    deferred: false,
    ...overrides,
  } as unknown as ChatInputCommandInteraction;
}

function createMockButtonInteraction(customId: string): ButtonInteraction {
  return {
    customId,
    guildId: 'guild-123',
    user: { id: 'discord-123', username: 'TestUser', displayName: 'Test User' },
    reply: jest.fn(),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    followUp: jest.fn(),
    replied: false,
    deferred: false,
  } as unknown as ButtonInteraction;
}

function createMockSelectMenuInteraction(
  customId: string,
  values: string[]
): StringSelectMenuInteraction {
  return {
    customId,
    values,
    guildId: 'guild-123',
    user: { id: 'discord-123', username: 'TestUser', displayName: 'Test User' },
    reply: jest.fn(),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    deleteReply: jest.fn(),
    followUp: jest.fn(),
    showModal: jest.fn(),
    replied: false,
    deferred: false,
  } as unknown as StringSelectMenuInteraction;
}

function createMockModalInteraction(
  customId: string,
  fields: Record<string, string>
): ModalSubmitInteraction {
  return {
    customId,
    guildId: 'guild-123',
    user: { id: 'discord-123', username: 'TestUser', displayName: 'Test User' },
    reply: jest.fn(),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    followUp: jest.fn(),
    replied: false,
    deferred: false,
    fields: {
      getTextInputValue: jest.fn((key: string) => fields[key] ?? ''),
    },
  } as unknown as ModalSubmitInteraction;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('readycheck command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetServicesForTesting();
  });

  describe('Command Registration', () => {
    it('should have correct command name', () => {
      expect(readycheck.data.name).toBe('readycheck');
    });

    it('should have a description', () => {
      expect(readycheck.data.description).toBe('Start and manage ready checks for activities');
    });

    it('should be guild-only', () => {
      expect(readycheck.guildOnly).toBe(true);
    });

    it('should have events category', () => {
      expect(readycheck.category).toBe('events');
    });

    it('should have execute function', () => {
      expect(typeof readycheck.execute).toBe('function');
    });

    it('should have handleButton function', () => {
      expect(typeof readycheck.handleButton).toBe('function');
    });

    it('should have handleSelectMenu function', () => {
      expect(typeof readycheck.handleSelectMenu).toBe('function');
    });

    it('should have handleModal function', () => {
      expect(typeof readycheck.handleModal).toBe('function');
    });

    it('should have a cooldown of 5 seconds', () => {
      expect(readycheck.cooldown).toBe(5);
    });
  });

  describe('execute', () => {
    it('should reply with command panel', async () => {
      const interaction = createMockInteraction();
      await readycheck.execute(interaction);

      expect(replyWithCommandPanel).toHaveBeenCalledWith(
        interaction,
        expect.objectContaining({
          prefix: 'readycheck',
          title: expect.stringContaining('Ready Check'),
          buttons: expect.arrayContaining([
            expect.objectContaining({ subcommand: 'start' }),
            expect.objectContaining({ subcommand: 'status' }),
            expect.objectContaining({ subcommand: 'cancel' }),
          ]),
        })
      );
    });
  });

  describe('handleButton', () => {
    const mockActivities = [
      {
        id: 'activity-1',
        title: 'Test Operation',
        scheduledStartDate: new Date('2026-06-01'),
      },
      {
        id: 'activity-2',
        title: 'Mining Run',
        scheduledStartDate: new Date('2026-06-02'),
      },
    ];

    beforeEach(() => {
      (resolveGuildContext as jest.Mock).mockResolvedValue({
        guildId: 'guild-123',
        organizationId: 'org-1',
      });
    });

    it('should show activity select menu for "start" button', async () => {
      (parsePanelCustomId as jest.Mock).mockReturnValue('start');
      const mockGetUpcoming = jest.fn().mockResolvedValue(mockActivities);
      (ActivityService as jest.Mock).mockImplementation(() => ({
        getUpcomingActivities: mockGetUpcoming,
      }));

      const interaction = createMockButtonInteraction('readycheck_panel_start');
      await readycheck.handleButton!(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Select an activity'),
          components: expect.any(Array),
        })
      );
    });

    it('should show "no upcoming activities" when none exist', async () => {
      (parsePanelCustomId as jest.Mock).mockReturnValue('start');
      const mockGetUpcoming = jest.fn().mockResolvedValue([]);
      (ActivityService as jest.Mock).mockImplementation(() => ({
        getUpcomingActivities: mockGetUpcoming,
      }));

      const interaction = createMockButtonInteraction('readycheck_panel_start');
      await readycheck.handleButton!(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith('No upcoming activities found.');
    });

    it('should return early when guild context cannot be resolved', async () => {
      (parsePanelCustomId as jest.Mock).mockReturnValue('start');
      (resolveGuildContext as jest.Mock).mockResolvedValue(null);

      const interaction = createMockButtonInteraction('readycheck_panel_start');
      await readycheck.handleButton!(interaction);

      // Should not attempt to build activity select
      expect(interaction.editReply).not.toHaveBeenCalled();
    });

    it('should return early for unrecognised panel button', async () => {
      (parsePanelCustomId as jest.Mock).mockReturnValue(null);

      const interaction = createMockButtonInteraction('other_button');
      await readycheck.handleButton!(interaction);

      expect(interaction.deferReply).not.toHaveBeenCalled();
    });

    it('should process thread vote buttons for ready responses', async () => {
      (UserService as jest.Mock).mockImplementation(() => ({
        getUserByDiscordId: jest.fn().mockResolvedValue({
          id: 'platform-user-1',
          username: 'TestUser',
        }),
      }));

      const mockRespond = jest.fn().mockResolvedValue({
        activityTitle: 'Test Operation',
        responses: {
          'platform-user-1': { userId: 'platform-user-1', userName: 'TestUser', response: 'ready' },
          'platform-user-2': {
            userId: 'platform-user-2',
            userName: 'OtherUser',
            response: 'pending',
          },
        },
        totalParticipants: 2,
        status: 'pending',
      });
      (ReadyCheckService as jest.Mock).mockImplementation(() => ({
        respond: mockRespond,
      }));

      const interaction = createMockButtonInteraction('readycheck_vote_ready_activity-1');
      await readycheck.handleButton!(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
      expect(mockRespond).toHaveBeenCalledWith(
        'activity-1',
        'platform-user-1',
        'TestUser',
        'ready'
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) })
      );
      expect(emitRealtimeToOrg).toHaveBeenCalledWith(
        'org-1',
        'activity:ready_check_response',
        expect.objectContaining({ activityId: 'activity-1', response: 'ready' })
      );
    });

    it('should reject thread vote when Discord account is not linked', async () => {
      (UserService as jest.Mock).mockImplementation(() => ({
        getUserByDiscordId: jest.fn().mockResolvedValue(null),
      }));

      const mockRespond = jest.fn();
      (ReadyCheckService as jest.Mock).mockImplementation(() => ({
        respond: mockRespond,
      }));

      const interaction = createMockButtonInteraction('readycheck_vote_notready_activity-1');
      await readycheck.handleButton!(interaction);

      expect(mockRespond).not.toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('not linked'));
    });
  });

  describe('handleSelectMenu', () => {
    const mockActivity = {
      id: 'activity-1',
      title: 'Test Operation',
      organizationId: 'org-1',
    };

    beforeEach(() => {
      (resolveGuildContext as jest.Mock).mockResolvedValue({
        guildId: 'guild-123',
        organizationId: 'org-1',
      });

      // Mock user resolution
      (UserService as jest.Mock).mockImplementation(() => ({
        getUserByDiscordId: jest.fn().mockResolvedValue({
          id: 'platform-user-1',
          username: 'TestUser',
        }),
      }));
    });

    it('should show duration modal for start_select', async () => {
      const mockGetById = jest.fn().mockResolvedValue(mockActivity);
      (ActivityService as jest.Mock).mockImplementation(() => ({
        getActivityById: mockGetById,
      }));

      const interaction = createMockSelectMenuInteraction('readycheck_start_select', [
        'activity-1',
      ]);
      await readycheck.handleSelectMenu!(interaction);

      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            custom_id: 'readycheck_duration_modal_activity-1',
          }),
        })
      );
    });

    it('should redirect legacy respond select menus to thread buttons', async () => {
      const mockGetById = jest.fn().mockResolvedValue(mockActivity);
      (ActivityService as jest.Mock).mockImplementation(() => ({
        getActivityById: mockGetById,
      }));

      const mockRespond = jest.fn();
      (ReadyCheckService as jest.Mock).mockImplementation(() => ({
        respond: mockRespond,
      }));

      const interaction = createMockSelectMenuInteraction('readycheck_respond_ready_select', [
        'activity-1',
      ]);
      await readycheck.handleSelectMenu!(interaction);

      expect(mockRespond).not.toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('thread-first'),
        })
      );
    });

    it('should show status embed for status_select', async () => {
      const mockGetById = jest.fn().mockResolvedValue(mockActivity);
      (ActivityService as jest.Mock).mockImplementation(() => ({
        getActivityById: mockGetById,
      }));

      const mockGetActive = jest.fn().mockResolvedValue({
        id: 'rc-1',
        activityId: 'activity-1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        totalParticipants: 3,
        responses: {
          u1: { userId: 'u1', userName: 'User1', response: 'ready' },
          u2: { userId: 'u2', userName: 'User2', response: 'pending' },
          u3: { userId: 'u3', userName: 'User3', response: 'not_ready' },
        },
      });
      (ReadyCheckService as jest.Mock).mockImplementation(() => ({
        getActiveReadyCheck: mockGetActive,
      }));

      const interaction = createMockSelectMenuInteraction('readycheck_status_select', [
        'activity-1',
      ]);
      await readycheck.handleSelectMenu!(interaction);

      expect(mockGetActive).toHaveBeenCalledWith('activity-1');
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) })
      );
    });

    it('should show "no active ready check" for status when none exists', async () => {
      const mockGetById = jest.fn().mockResolvedValue(mockActivity);
      (ActivityService as jest.Mock).mockImplementation(() => ({
        getActivityById: mockGetById,
      }));

      const mockGetActive = jest.fn().mockResolvedValue(null);
      (ReadyCheckService as jest.Mock).mockImplementation(() => ({
        getActiveReadyCheck: mockGetActive,
      }));

      const interaction = createMockSelectMenuInteraction('readycheck_status_select', [
        'activity-1',
      ]);
      await readycheck.handleSelectMenu!(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('No active ready check')
      );
    });

    it('should cancel and emit event for cancel_select', async () => {
      const mockGetById = jest.fn().mockResolvedValue(mockActivity);
      (ActivityService as jest.Mock).mockImplementation(() => ({
        getActivityById: mockGetById,
      }));

      const mockCancel = jest.fn().mockResolvedValue(undefined);
      (ReadyCheckService as jest.Mock).mockImplementation(() => ({
        cancelReadyCheck: mockCancel,
      }));

      const interaction = createMockSelectMenuInteraction('readycheck_cancel_select', [
        'activity-1',
      ]);
      await readycheck.handleSelectMenu!(interaction);

      expect(mockCancel).toHaveBeenCalledWith('activity-1', 'platform-user-1', 'TestUser');
      expect(emitRealtimeToOrg).toHaveBeenCalledWith(
        'org-1',
        'activity:ready_check_cancelled',
        expect.objectContaining({ activityId: 'activity-1' })
      );
    });

    it('should reject when activity does not belong to guild org', async () => {
      const wrongOrgActivity = { ...mockActivity, organizationId: 'other-org' };
      const mockGetById = jest.fn().mockResolvedValue(wrongOrgActivity);
      (ActivityService as jest.Mock).mockImplementation(() => ({
        getActivityById: mockGetById,
      }));

      const interaction = createMockSelectMenuInteraction('readycheck_start_select', [
        'activity-1',
      ]);
      await readycheck.handleSelectMenu!(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('not found'),
          flags: MessageFlags.Ephemeral,
        })
      );
    });

    it('should reject when Discord user is not linked', async () => {
      const mockGetById = jest.fn().mockResolvedValue(mockActivity);
      (ActivityService as jest.Mock).mockImplementation(() => ({
        getActivityById: mockGetById,
      }));

      // User not linked
      (UserService as jest.Mock).mockImplementation(() => ({
        getUserByDiscordId: jest.fn().mockResolvedValue(null),
      }));

      const interaction = createMockSelectMenuInteraction('readycheck_start_select', [
        'activity-1',
      ]);
      await readycheck.handleSelectMenu!(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('not linked'),
          flags: MessageFlags.Ephemeral,
        })
      );
    });

    it('should handle service errors gracefully', async () => {
      const mockGetById = jest.fn().mockResolvedValue(mockActivity);
      (ActivityService as jest.Mock).mockImplementation(() => ({
        getActivityById: mockGetById,
      }));

      const mockCancel = jest.fn().mockRejectedValue(new Error('No active ready check'));
      (ReadyCheckService as jest.Mock).mockImplementation(() => ({
        cancelReadyCheck: mockCancel,
      }));

      const interaction = createMockSelectMenuInteraction('readycheck_cancel_select', [
        'activity-1',
      ]);
      await readycheck.handleSelectMenu!(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('No active ready check') })
      );
    });
  });

  describe('handleModal', () => {
    beforeEach(() => {
      (resolveGuildContext as jest.Mock).mockResolvedValue({
        guildId: 'guild-123',
        organizationId: 'org-1',
      });

      (UserService as jest.Mock).mockImplementation(() => ({
        getUserByDiscordId: jest.fn().mockResolvedValue({
          id: 'platform-user-1',
          username: 'TestUser',
        }),
      }));
    });

    it('should initiate ready check with default duration', async () => {
      const mockInitiate = jest.fn().mockResolvedValue({
        id: 'rc-1',
        activityId: 'activity-1',
        activityTitle: 'Test Operation',
        totalParticipants: 3,
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
      });
      (ReadyCheckService as jest.Mock).mockImplementation(() => ({
        initiateReadyCheck: mockInitiate,
      }));

      const interaction = createMockModalInteraction('readycheck_duration_modal_activity-1', {
        duration: '',
      });
      await readycheck.handleModal!(interaction);

      expect(mockInitiate).toHaveBeenCalledWith(
        'activity-1',
        'org-1',
        'platform-user-1',
        'TestUser',
        120
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) })
      );
      expect(emitRealtimeToOrg).toHaveBeenCalledWith(
        'org-1',
        'activity:ready_check_initiated',
        expect.objectContaining({ activityId: 'activity-1' })
      );
    });

    it('should initiate ready check with custom duration', async () => {
      const mockInitiate = jest.fn().mockResolvedValue({
        id: 'rc-1',
        activityId: 'activity-1',
        activityTitle: 'Test Operation',
        totalParticipants: 3,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
      (ReadyCheckService as jest.Mock).mockImplementation(() => ({
        initiateReadyCheck: mockInitiate,
      }));

      const interaction = createMockModalInteraction('readycheck_duration_modal_activity-1', {
        duration: '60',
      });
      await readycheck.handleModal!(interaction);

      expect(mockInitiate).toHaveBeenCalledWith(
        'activity-1',
        'org-1',
        'platform-user-1',
        'TestUser',
        60
      );
    });

    it('should reject invalid duration', async () => {
      const interaction = createMockModalInteraction('readycheck_duration_modal_activity-1', {
        duration: '5',
      });
      await readycheck.handleModal!(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('between 30 and 600')
      );
    });

    it('should reject non-numeric duration', async () => {
      const interaction = createMockModalInteraction('readycheck_duration_modal_activity-1', {
        duration: 'abc',
      });
      await readycheck.handleModal!(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('between 30 and 600')
      );
    });

    it('should ignore non-readycheck modals', async () => {
      const interaction = createMockModalInteraction('other_modal_123', { duration: '120' });
      await readycheck.handleModal!(interaction);

      expect(interaction.deferReply).not.toHaveBeenCalled();
    });

    it('should reject when Discord user is not linked', async () => {
      (UserService as jest.Mock).mockImplementation(() => ({
        getUserByDiscordId: jest.fn().mockResolvedValue(null),
      }));

      const interaction = createMockModalInteraction('readycheck_duration_modal_activity-1', {
        duration: '120',
      });
      await readycheck.handleModal!(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('not linked'));
    });

    it('should handle service errors gracefully', async () => {
      const mockInitiate = jest
        .fn()
        .mockRejectedValue(new Error('A ready check is already active for this activity'));
      (ReadyCheckService as jest.Mock).mockImplementation(() => ({
        initiateReadyCheck: mockInitiate,
      }));

      const interaction = createMockModalInteraction('readycheck_duration_modal_activity-1', {
        duration: '120',
      });
      await readycheck.handleModal!(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('already active'),
        })
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
