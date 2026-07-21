import { MessageFlags } from 'discord.js';

import { buildCrewSelectValue } from '../eventButtons.crewSelect';
import {
  handleCrewSelectMenu,
  handleJoinCrew,
  handleRemoveShip,
  handleRemoveShipSelectMenu,
} from '../eventButtons.shipCrew';

const mockGetActivityById = jest.fn();
const mockRemoveOwnedShip = jest.fn();
const mockJoinShipAsCrew = jest.fn();
const mockJoinActivity = jest.fn();
const mockIsParticipant = jest.fn();

jest.mock('../eventButtons.services', () => ({
  getActivityService: jest.fn(() => ({
    getActivityById: mockGetActivityById,
    removeOwnedShip: mockRemoveOwnedShip,
    joinShipAsCrew: mockJoinShipAsCrew,
    joinActivity: mockJoinActivity,
  })),
  getParticipantService: jest.fn(() => ({
    isParticipant: mockIsParticipant,
  })),
}));

const mockResolveInternalUserId = jest.fn();
jest.mock('../eventButtons.identity', () => ({
  resolveInternalUserId: (...args: unknown[]) => mockResolveInternalUserId(...args),
}));

const mockRefreshEventEmbedFromChannel = jest.fn();
jest.mock('../eventButtons.refresh', () => ({
  refreshEventEmbedFromChannel: (...args: unknown[]) => mockRefreshEventEmbedFromChannel(...args),
}));

jest.mock('../eventButtons.security', () => ({
  sanitizeDiscordInput: (v: string) => v,
  sanitizeErrorForUser: (v: string) => v,
  truncate: (v: string) => v,
}));

const mockLogAuditEvent = jest.fn();
jest.mock('../../../utils/auditLogger', () => ({
  AuditEventType: {
    ACTIVITY_ACTION: 'ACTIVITY_ACTION',
  },
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

describe('eventButtons.shipCrew seam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveInternalUserId.mockResolvedValue('user-1');
    mockGetActivityById.mockResolvedValue({ id: 'activity-1', ships: [], shipAssignments: [] });
    mockIsParticipant.mockResolvedValue(true);
  });

  it('handleRemoveShip builds removeship select customId', async () => {
    const interaction = makeButtonInteraction();
    mockGetActivityById.mockResolvedValue({
      id: 'activity-1',
      ships: [
        {
          id: 'ship-1',
          ownerId: 'user-1',
          shipName: 'Carrack',
          shipType: 'Carrack',
          crewMembers: [],
          crewAssigned: 0,
          crewCapacity: 6,
        },
      ],
      shipAssignments: [],
    });

    await handleRemoveShip(interaction as never, 'activity-1');

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    const payload = interaction.editReply.mock.calls[0][0] as {
      components: Array<{ components: Array<{ data: { custom_id: string } }> }>;
    };
    expect(payload.components[0].components[0].data.custom_id).toBe(
      'event_removeshipselect_activity-1'
    );
  });

  it('handleRemoveShipSelectMenu removes ship, refreshes embed, and audits', async () => {
    const interaction = makeSelectInteraction([buildCrewSelectValue('ship-1', 0)]);
    mockGetActivityById.mockResolvedValue({
      id: 'activity-1',
      ships: [
        {
          id: 'ship-1',
          ownerId: 'user-1',
          shipName: 'Carrack',
          shipType: 'Carrack',
          crewMembers: [{ position: 'Pilot' }],
        },
      ],
      shipAssignments: [],
    });

    await handleRemoveShipSelectMenu(interaction as never, 'activity-1');

    expect(mockRemoveOwnedShip).toHaveBeenCalledWith('activity-1', 'user-1', 'ship-1', 0);
    expect(mockRefreshEventEmbedFromChannel).toHaveBeenCalledWith(interaction, 'activity-1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EVENT_SHIP_REMOVED',
      })
    );
  });

  it('handleRemoveShipSelectMenu maps service errors via getUserFriendlyError', async () => {
    const interaction = makeSelectInteraction([buildCrewSelectValue('ship-1', 0)]);
    mockGetActivityById.mockResolvedValue({
      id: 'activity-1',
      ships: [{ id: 'ship-1', ownerId: 'user-1', shipType: 'Carrack' }],
      shipAssignments: [],
    });
    mockRemoveOwnedShip.mockRejectedValue(new Error('activity not found'));

    await handleRemoveShipSelectMenu(interaction as never, 'activity-1');

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '⚠️ Activity no longer exists.',
        flags: MessageFlags.Ephemeral,
      })
    );
  });

  it('handleJoinCrew builds crew select customId', async () => {
    const interaction = makeButtonInteraction();
    mockGetActivityById.mockResolvedValue({
      id: 'activity-1',
      ships: [
        {
          id: 'ship-1',
          shipType: 'Carrack',
          shipName: 'Carrack',
          ownerId: 'owner-1',
          captainName: 'Captain',
          currentCrew: 1,
          maxCrew: 6,
        },
      ],
      shipAssignments: [],
    });

    await handleJoinCrew(interaction as never, 'activity-1');

    const payload = interaction.editReply.mock.calls[0][0] as {
      components: Array<{ components: Array<{ data: { custom_id: string } }> }>;
    };
    expect(payload.components[0].components[0].data.custom_id).toBe('event_crewselect_activity-1');
  });

  it('handleCrewSelectMenu auto-joins participant and joins ship crew', async () => {
    const interaction = makeSelectInteraction([buildCrewSelectValue('ship-1', 0)]);
    mockIsParticipant.mockResolvedValue(false);
    mockGetActivityById.mockResolvedValue({
      id: 'activity-1',
      ships: [
        {
          id: 'ship-1',
          shipType: 'Carrack',
          shipName: 'Carrack',
          ownerId: 'owner-1',
          currentCrew: 1,
          maxCrew: 4,
          crewMembers: [{ position: 'Pilot' }],
        },
      ],
      shipAssignments: [],
    });

    await handleCrewSelectMenu(interaction as never, 'activity-1');

    expect(mockJoinActivity).toHaveBeenCalledWith(
      'activity-1',
      expect.objectContaining({ userId: 'user-1', role: 'member' })
    );
    expect(mockJoinShipAsCrew).toHaveBeenCalledWith(
      'activity-1',
      'user-1',
      'Pilot',
      'ship-1',
      'Co-pilot'
    );
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EVENT_CREW_JOINED' })
    );
  });

  it('handleCrewSelectMenu returns specific already-crew message', async () => {
    const interaction = makeSelectInteraction([buildCrewSelectValue('ship-1', 0)]);
    mockGetActivityById.mockResolvedValue({
      id: 'activity-1',
      ships: [
        {
          id: 'ship-1',
          shipType: 'Carrack',
          shipName: 'Carrack',
          ownerId: 'owner-1',
          currentCrew: 1,
          maxCrew: 4,
        },
      ],
      shipAssignments: [],
    });
    mockJoinShipAsCrew.mockRejectedValue(new Error('already crew'));

    await handleCrewSelectMenu(interaction as never, 'activity-1');

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '⚠️ You are already crew on this ship.',
      })
    );
  });

  it('handleCrewSelectMenu keeps generic error inline (no friendly mapping)', async () => {
    const interaction = makeSelectInteraction([buildCrewSelectValue('ship-1', 0)]);
    mockGetActivityById.mockResolvedValue({
      id: 'activity-1',
      ships: [
        {
          id: 'ship-1',
          shipType: 'Carrack',
          shipName: 'Carrack',
          ownerId: 'owner-1',
          currentCrew: 1,
          maxCrew: 4,
        },
      ],
      shipAssignments: [],
    });
    mockJoinShipAsCrew.mockRejectedValue(new Error('activity not found'));

    await handleCrewSelectMenu(interaction as never, 'activity-1');

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '❌ Error: activity not found',
      })
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

function makeButtonInteraction(): {
  user: { id: string; username: string };
  deferReply: jest.Mock;
  editReply: jest.Mock;
  followUp: jest.Mock;
  guildId: string;
  channelId: string;
} {
  return {
    user: { id: 'discord-1', username: 'Pilot' },
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    guildId: 'guild-1',
    channelId: 'channel-1',
  };
}

function makeSelectInteraction(values: string[]): {
  values: string[];
  user: { id: string; username: string };
  deferUpdate: jest.Mock;
  followUp: jest.Mock;
  guildId: string;
  channelId: string;
} {
  return {
    values,
    user: { id: 'discord-1', username: 'Pilot' },
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    guildId: 'guild-1',
    channelId: 'channel-1',
  };
}
