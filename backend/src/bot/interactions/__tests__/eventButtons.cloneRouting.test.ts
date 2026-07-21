const mockHandleCloneEvent = jest.fn();

jest.mock('../eventButtons.clone', () => ({
  handleCloneEvent: (...args: unknown[]) => mockHandleCloneEvent(...args),
}));

jest.mock('../eventButtons.services', () => ({
  getActivityService: jest.fn(() => ({
    leaveActivity: jest.fn(),
    leaveShipCrew: jest.fn(),
    leaveShipAsPassenger: jest.fn(),
    getActivityById: jest.fn(),
  })),
  getReminderService: jest.fn(() => ({
    getActivityReminders: jest.fn(),
    createActivityReminders: jest.fn(),
  })),
}));

jest.mock('../eventButtons.identity', () => ({
  resolveInternalUserId: jest.fn().mockResolvedValue('internal-1'),
}));

jest.mock('../eventButtons.guestContext', () => ({
  resolveGuestContext: jest.fn().mockResolvedValue(null),
}));

jest.mock('../eventButtons.preJoinChecks', () => ({
  preJoinChecks: jest.fn().mockResolvedValue({ allowed: true }),
}));

jest.mock('../eventButtons.rsvp', () => ({
  RSVP_ACTIONS: {},
  handleRSVPAction: jest.fn(),
}));

jest.mock('../eventButtons.tempRoles', () => ({
  handleTempRoleUpdate: jest.fn(),
}));

jest.mock('../eventButtons.refresh', () => ({
  refreshEventEmbed: jest.fn(),
  refreshEventEmbedFromChannel: jest.fn(),
}));

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
  buildEventActionPanelComponents: jest.fn(),
  buildEventComponentRows: jest.fn(),
  buildEventEmbed: jest.fn(),
}));

jest.mock('../../mirrorSyncPublisher', () => ({
  publishMirrorSync: jest.fn(),
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

jest.mock('../eventReminderOffset', () => ({
  pickReminderOffset: jest.fn(),
}));

import { handleEventButton } from '../eventButtons';

const identityModule = jest.requireMock('../eventButtons.identity') as {
  resolveInternalUserId: jest.Mock;
};

const guestContextModule = jest.requireMock('../eventButtons.guestContext') as {
  resolveGuestContext: jest.Mock;
};

describe('eventButtons clone direct-action routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleCloneEvent.mockResolvedValue(undefined);
  });

  it('routes event_clone_* through direct-action handler (deferReply, not deferUpdate path)', async () => {
    const interaction = {
      customId: 'event_clone_activity-1',
      user: { id: 'discord-user-1', username: 'Pilot' },
      message: { flags: { has: jest.fn(() => false) } },
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      deferReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
    };

    await handleEventButton(interaction as never);

    expect(mockHandleCloneEvent).toHaveBeenCalledWith(interaction, 'activity-1');
    expect(interaction.deferUpdate).not.toHaveBeenCalled();
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(identityModule.resolveInternalUserId).not.toHaveBeenCalled();
    expect(guestContextModule.resolveGuestContext).not.toHaveBeenCalled();
  });

  it('does not route direct-action failures through non-direct followUp fallback', async () => {
    const interaction = {
      customId: 'event_clone_activity-1',
      user: { id: 'discord-user-1', username: 'Pilot' },
      message: { flags: { has: jest.fn(() => false) } },
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      deferReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
    };
    mockHandleCloneEvent.mockRejectedValueOnce(new Error('clone-failed'));

    await expect(handleEventButton(interaction as never)).rejects.toThrow('clone-failed');

    expect(interaction.followUp).not.toHaveBeenCalled();
    expect(interaction.deferUpdate).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
