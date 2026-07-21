const mockTriggerMirrorSync = jest.fn();
const mockResolveActionActorContext = jest.fn();

jest.mock('../eventButtons.mirrorSync', () => ({
  triggerMirrorSync: (...args: unknown[]) => mockTriggerMirrorSync(...args),
}));

jest.mock('../eventButtons.actorContext', () => ({
  resolveActionActorContext: (...args: unknown[]) => mockResolveActionActorContext(...args),
}));

jest.mock('../eventButtons.services', () => ({
  getActivityService: jest.fn(() => ({
    leaveActivity: jest.fn().mockResolvedValue(undefined),
    leaveShipCrew: jest.fn().mockResolvedValue(undefined),
    leaveShipAsPassenger: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../eventButtons.identity', () => ({
  resolveInternalUserId: jest.fn().mockResolvedValue('internal-1'),
}));

jest.mock('../eventButtons.guestContext', () => ({
  resolveGuestContext: jest.fn().mockResolvedValue(null),
}));

const mockPreJoinChecks = jest.fn().mockResolvedValue({ allowed: true });
jest.mock('../eventButtons.preJoinChecks', () => ({
  preJoinChecks: (...args: unknown[]) => mockPreJoinChecks(...args),
}));

const mockHandleRSVPAction = jest.fn().mockResolvedValue(undefined);
jest.mock('../eventButtons.rsvp', () => ({
  RSVP_ACTIONS: { join: 'accepted', tentative: 'tentative', decline: 'declined' },
  handleRSVPAction: (...args: unknown[]) => mockHandleRSVPAction(...args),
}));

jest.mock('../eventButtons.tempRoles', () => ({
  handleTempRoleUpdate: jest.fn(),
}));

jest.mock('../eventButtons.refresh', () => ({
  refreshEventEmbed: jest.fn().mockResolvedValue(undefined),
  refreshEventEmbedFromChannel: jest.fn().mockResolvedValue(undefined),
}));
const refreshModule = jest.requireMock('../eventButtons.refresh') as {
  refreshEventEmbed: jest.Mock;
};

jest.mock('../eventButtons.shipCrew', () => ({
  handleJoinCrew: jest.fn(),
  handleRemoveShip: jest.fn(),
  handleCrewSelectMenu: jest.fn(),
  handleRemoveShipSelectMenu: jest.fn(),
}));

jest.mock('../eventButtons.requestShip', () => ({
  handleRequestShip: jest.fn(),
  handleReqShipModal: jest.fn(),
  handleReqShipRoleSelect: jest.fn(),
  handleReqShipTypeSelect: jest.fn(),
}));

jest.mock('../eventButtons.manageSlots', () => ({
  handleManageSlots: jest.fn(),
  handleManageSlotsModal: jest.fn(),
  handleManageSlotsShipSelect: jest.fn(),
}));

jest.mock('../eventButtons.passenger', () => ({
  handleJoinPassenger: jest.fn(),
  handlePassengerSelectMenu: jest.fn(),
}));

jest.mock('../eventButtons.bringFleet', () => ({
  handleBringFleet: jest.fn(),
  handleBringFleetSelect: jest.fn(),
  handleFleetInviteResponse: jest.fn(),
}));

jest.mock('../eventButtons.bringShip', () => ({
  handleBringShip: jest.fn(),
  handleBringShipModal: jest.fn(),
  handleHangarPageSelect: jest.fn(),
  handleHangarShipSelect: jest.fn(),
  handleNestShipSelect: jest.fn(),
}));

jest.mock('../eventButtons.cancel', () => ({
  handleCancelEventPrompt: jest.fn(),
  handleCancelEvent: jest.fn(),
  handleCancelEventDismiss: jest.fn(),
}));

jest.mock('../eventButtons.edit', () => ({
  handleEditEvent: jest.fn(),
  handleEditEventModal: jest.fn(),
}));

jest.mock('../eventButtons.clone', () => ({
  handleCloneEvent: jest.fn(),
  CLONE_SCHEDULE_SHIFT_MS: 0,
}));

jest.mock('../eventButtons.panelReminder', () => ({
  handleOpenActionsPanel: jest.fn(),
  handleRemindMe: jest.fn(),
  ephemeralLeaveConfirmation: jest.fn(() => '✅ Done.'),
}));

jest.mock('../eventButtons.messages', () => ({
  getUserFriendlyError: (message: string) => message,
}));

jest.mock('../eventButtons.security', () => ({
  sanitizeErrorForUser: (message: string) => message,
}));

jest.mock('../../embeds/eventEmbed', () => ({
  parseEventButtonId: jest.fn((id: string) => {
    const match = /^event_([^_]+)_(.+)$/.exec(id);
    return match ? { action: match[1], activityId: match[2] } : null;
  }),
}));

jest.mock('../../../utils/auditLogger', () => ({
  AuditEventType: {
    ACTIVITY_ACTION: 'ACTIVITY_ACTION',
  },
  logAuditEvent: jest.fn(),
}));

jest.mock('../../../utils/errorHandler', () => ({
  getErrorMessage: jest.fn(String),
}));

import { logAuditEvent } from '../../../utils/auditLogger';
import { handleEventButton } from '../eventButtons';

describe('eventButtons mirrorSync call-site routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTriggerMirrorSync.mockReturnValue(undefined);
    mockPreJoinChecks.mockResolvedValue({ allowed: true });
    mockResolveActionActorContext.mockResolvedValue({
      userId: 'internal-1',
      isDiscordGuest: false,
      guestContext: null,
    });
  });

  it('executes non-direct RSVP branch and calls triggerMirrorSync', async () => {
    const interaction = {
      customId: 'event_join_activity-1',
      user: { id: 'discord-user-1', username: 'Pilot' },
      guildId: 'guild-1',
      channelId: 'channel-1',
      message: { flags: { has: jest.fn(() => false) } },
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      deferReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
    };

    await handleEventButton(interaction as never);

    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1);
    expect(mockHandleRSVPAction).toHaveBeenCalledTimes(1);
    expect(mockTriggerMirrorSync).toHaveBeenCalledWith('activity-1', 'internal-1', 'Pilot', 'join');
  });

  it('short-circuits blocked non-direct action before mirror and audit side effects', async () => {
    mockPreJoinChecks.mockResolvedValueOnce({ allowed: false, reason: 'Blocked' });
    const interaction = {
      customId: 'event_join_activity-1',
      user: { id: 'discord-user-1', username: 'Pilot' },
      guildId: 'guild-1',
      channelId: 'channel-1',
      message: { flags: { has: jest.fn(() => false) } },
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      deferReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
    };

    await handleEventButton(interaction as never);

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: 'Blocked',
      flags: expect.any(Number),
    });
    expect(mockHandleRSVPAction).not.toHaveBeenCalled();
    expect(mockTriggerMirrorSync).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it('routes refresh errors through handleEventButton catch fallback and stops mirror/audit', async () => {
    refreshModule.refreshEventEmbed.mockRejectedValueOnce(new Error('refresh-failed'));
    const interaction = {
      customId: 'event_join_activity-1',
      user: { id: 'discord-user-1', username: 'Pilot' },
      guildId: 'guild-1',
      channelId: 'channel-1',
      message: { flags: { has: jest.fn(() => false) } },
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      deferReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
    };

    await handleEventButton(interaction as never);

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: expect.stringContaining('refresh-failed'),
      flags: expect.any(Number),
    });
    expect(mockTriggerMirrorSync).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it('exits early when actor context cannot be resolved', async () => {
    mockResolveActionActorContext.mockResolvedValueOnce(null);
    const interaction = {
      customId: 'event_join_activity-1',
      user: { id: 'discord-user-1', username: 'Pilot' },
      guildId: 'guild-1',
      channelId: 'channel-1',
      message: { flags: { has: jest.fn(() => false) } },
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      deferReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
    };

    await handleEventButton(interaction as never);

    expect(interaction.deferUpdate).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(mockHandleRSVPAction).not.toHaveBeenCalled();
    expect(mockTriggerMirrorSync).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it('preserves deferUpdate rejection behavior (no fallback followUp catch handling)', async () => {
    const interaction = {
      customId: 'event_join_activity-1',
      user: { id: 'discord-user-1', username: 'Pilot' },
      guildId: 'guild-1',
      channelId: 'channel-1',
      message: { flags: { has: jest.fn(() => false) } },
      deferUpdate: jest.fn().mockRejectedValue(new Error('defer-failed')),
      deferReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
    };

    await expect(handleEventButton(interaction as never)).rejects.toThrow('defer-failed');

    expect(interaction.followUp).not.toHaveBeenCalled();
    expect(mockHandleRSVPAction).not.toHaveBeenCalled();
    expect(mockTriggerMirrorSync).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
