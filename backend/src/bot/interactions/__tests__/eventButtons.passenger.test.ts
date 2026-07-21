import { MessageFlags } from 'discord.js';

import { handleJoinPassenger, handlePassengerSelectMenu } from '../eventButtons.passenger';

const mockGetAvailablePassengerSlots = jest.fn();
const mockJoinActivity = jest.fn();
const mockJoinShipAsPassenger = jest.fn();

jest.mock('../eventButtons.services', () => ({
  getActivityService: jest.fn(() => ({
    getAvailablePassengerSlots: mockGetAvailablePassengerSlots,
    joinActivity: mockJoinActivity,
    joinShipAsPassenger: mockJoinShipAsPassenger,
  })),
  getParticipantService: jest.fn(() => ({
    isParticipant: mockIsParticipant,
  })),
}));

const mockIsParticipant = jest.fn();
const mockResolveInternalUserId = jest.fn();
jest.mock('../eventButtons.identity', () => ({
  resolveInternalUserId: (...args: unknown[]) => mockResolveInternalUserId(...args),
}));

const mockRefreshEventEmbedFromChannel = jest.fn();
jest.mock('../eventButtons.refresh', () => ({
  refreshEventEmbedFromChannel: (...args: unknown[]) => mockRefreshEventEmbedFromChannel(...args),
}));

jest.mock('../eventButtons.security', () => ({
  sanitizeErrorForUser: (value: string) => value,
}));

const mockLogAuditEvent = jest.fn();
jest.mock('../../../utils/auditLogger', () => ({
  AuditEventType: {
    ACTIVITY_ACTION: 'ACTIVITY_ACTION',
  },
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

describe('eventButtons.passenger seam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveInternalUserId.mockResolvedValue('user-1');
    mockIsParticipant.mockResolvedValue(false);
  });

  it('round-trips fallback passenger identifier through emitted select value into join service', async () => {
    const buttonInteraction = makeButtonInteraction();
    mockGetAvailablePassengerSlots.mockResolvedValue([
      {
        shipId: undefined,
        shipType: 'Cutlass/Black',
        shipName: 'Crew::Bus',
        role: 'marine',
        ownerName: 'Owner',
        availableSlots: 2,
      },
    ]);

    await handleJoinPassenger(buttonInteraction, 'activity-1');

    const payload = buttonInteraction.editReply.mock.calls[0][0] as {
      components: Array<{
        toJSON: () => { components: Array<{ options: Array<{ value: string }> }> };
      }>;
    };
    const optionValue = payload.components[0].toJSON().components[0].options[0].value;

    const selectInteraction = makeSelectInteraction([optionValue]);
    await handlePassengerSelectMenu(selectInteraction, 'activity-1');

    expect(mockJoinActivity).toHaveBeenCalledWith(
      'activity-1',
      expect.objectContaining({ userId: 'user-1', role: 'member' })
    );
    expect(mockJoinShipAsPassenger).toHaveBeenCalledWith(
      'activity-1',
      'user-1',
      'Pilot',
      'Cutlass/Black::Crew::Bus',
      'marine'
    );
  });

  it('returns stale-selection message for invalid select value', async () => {
    const interaction = makeSelectInteraction(['invalid']);

    await handlePassengerSelectMenu(interaction, 'activity-1');

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: '⚠️ Selection is no longer valid. Click **Join as Passenger** and try again.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('returns link-account message when internal user id is missing', async () => {
    const buttonInteraction = makeButtonInteraction();
    mockGetAvailablePassengerSlots.mockResolvedValue([
      {
        shipId: 'ship-1',
        shipType: 'Arrow',
        shipName: 'Arrow',
        role: 'scout',
        ownerName: 'Owner',
        availableSlots: 1,
      },
    ]);

    await handleJoinPassenger(buttonInteraction, 'activity-1');

    const payload = buttonInteraction.editReply.mock.calls[0][0] as {
      components: Array<{
        toJSON: () => { components: Array<{ options: Array<{ value: string }> }> };
      }>;
    };
    const optionValue = payload.components[0].toJSON().components[0].options[0].value;

    mockResolveInternalUserId.mockResolvedValueOnce(null);
    const selectInteraction = makeSelectInteraction([optionValue]);
    await handlePassengerSelectMenu(selectInteraction, 'activity-1');

    expect(selectInteraction.followUp).toHaveBeenCalledWith({
      content: '❌ Please link your Discord account on the web app first, then try again.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('maps already-passenger service failures to the current message', async () => {
    mockJoinShipAsPassenger.mockRejectedValueOnce(new Error('already passenger'));
    const interaction = makeSelectInteraction(['psg:ship-1::marine']);

    await handlePassengerSelectMenu(interaction, 'activity-1');

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: '⚠️ You already hold a passenger seat in this event.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('maps full-seat service failures to the current message', async () => {
    mockJoinShipAsPassenger.mockRejectedValueOnce(new Error('seat full'));
    const interaction = makeSelectInteraction(['psg:ship-1::marine']);

    await handlePassengerSelectMenu(interaction, 'activity-1');

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: '❌ That seat just filled up. Try another!',
      flags: MessageFlags.Ephemeral,
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

function makeButtonInteraction(): {
  user: { id: string; username: string };
  deferReply: jest.Mock;
  editReply: jest.Mock;
} {
  return {
    user: { id: 'discord-1', username: 'Pilot' },
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}

function makeSelectInteraction(values: string[]): {
  values: string[];
  user: { id: string; username: string };
  guildId: string;
  channelId: string;
  deferUpdate: jest.Mock;
  followUp: jest.Mock;
} {
  return {
    values,
    user: { id: 'discord-1', username: 'Pilot' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
  };
}
