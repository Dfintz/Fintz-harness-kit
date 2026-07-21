/**
 * Handler-level interaction tests for eventButtons.
 * Covers backend-driven slot permissions and fleet bring/invite behavior.
 */

const mockActivityService = {
  getActivityById: jest.fn(),
  getShipManagementCapabilities: jest.fn(),
  getAvailablePassengerSlots: jest.fn(),
  bringFleetAndInviteMembers: jest.fn(),
  getFleetBringPlan: jest.fn(),
  bringFleetToActivity: jest.fn(),
  leaveShipCrew: jest.fn(),
  leaveShipAsPassenger: jest.fn(),
  joinActivity: jest.fn(),
  joinShipAsPassenger: jest.fn(),
  inviteFleetMembers: jest.fn(),
  updateRSVPStatus: jest.fn(),
};

const mockParticipantService = {
  isLeader: jest.fn(),
  isParticipant: jest.fn(),
  addShip: jest.fn(),
};

const mockFleetService = {
  getAllFleets: jest.fn(),
};

const mockUserService = {
  getUserByDiscordId: jest.fn(),
};

const mockTempRoleService = {
  assignTempRole: jest.fn(),
  removeTempRole: jest.fn(),
};

jest.mock('../../services/activity', () => ({
  ActivityService: jest.fn().mockImplementation(() => mockActivityService),
}));

jest.mock('../../services/activity/ActivityParticipantService', () => ({
  ActivityParticipantService: jest.fn().mockImplementation(() => mockParticipantService),
}));

jest.mock('../../services/fleet/FleetService', () => ({
  FleetService: jest.fn().mockImplementation(() => mockFleetService),
}));

jest.mock('../../services/user/UserService', () => ({
  UserService: jest.fn().mockImplementation(() => mockUserService),
}));

jest.mock('../../services/activity/EventTempRoleService', () => ({
  EventTempRoleService: {
    getInstance: jest.fn().mockReturnValue(mockTempRoleService),
  },
}));

jest.mock('../../bot/interactions/eventEditWizard', () => ({
  launchEventEditWizard: jest.fn(),
}));

const mockRefreshEventEmbed = jest.fn();
const mockRefreshEventEmbedFromChannel = jest.fn();
jest.mock('../../bot/interactions/eventButtons.refresh', () => ({
  refreshEventEmbed: (...args: unknown[]) => mockRefreshEventEmbed(...args),
  refreshEventEmbedFromChannel: (...args: unknown[]) => mockRefreshEventEmbedFromChannel(...args),
}));

type EventButtonsModule = typeof import('../../bot/interactions/eventButtons');
type HangarSuggestion = import('../../bot/interactions/eventButtons').HangarSuggestion;
const {
  buildHangarGroups,
  handleBringFleetSelect,
  handleEventButton,
  handleFleetInviteResponse,
  handleManageSlotsShipSelect,
  handlePassengerSelectMenu,
} = require('../../bot/interactions/eventButtons') as EventButtonsModule;

type FakeUser = {
  id: string;
  username: string;
};

interface FakeButtonInteraction {
  customId: string;
  user: FakeUser;
  guildId: string | null;
  channelId: string | null;
  replied: boolean;
  deferred: boolean;
  deferReply: jest.Mock;
  editReply: jest.Mock;
  deferUpdate: jest.Mock;
  reply: jest.Mock;
  followUp: jest.Mock;
}

interface FakeSelectInteraction {
  values: string[];
  user: FakeUser;
  guildId: string | null;
  channelId: string | null;
  replied: boolean;
  deferred: boolean;
  deferUpdate: jest.Mock;
  followUp: jest.Mock;
  reply: jest.Mock;
  showModal: jest.Mock;
  channel: null;
  client: { users: { fetch: jest.Mock } };
}

function makeButtonInteraction(customId: string, discordId: string): FakeButtonInteraction {
  return {
    customId,
    user: { id: discordId, username: 'Tester' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    replied: false,
    deferred: false,
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
  };
}

function makeSelectInteraction(values: string[], discordId: string): FakeSelectInteraction {
  return {
    values,
    user: { id: discordId, username: 'Tester' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    replied: false,
    deferred: false,
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    showModal: jest.fn().mockResolvedValue(undefined),
    channel: null,
    client: { users: { fetch: jest.fn().mockResolvedValue({ send: jest.fn() }) } },
  };
}

function makeActivity(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'activity-1',
    creatorId: 'creator-1',
    organizationId: 'org-1',
    ships: [
      {
        id: 'ship-1',
        shipId: 'ship-1',
        shipName: 'Cutlass Black',
        shipType: 'Cutlass Black',
        ownerId: 'owner-1',
        contributedByUserId: 'contrib-1',
        crewAssigned: 1,
        crewCapacity: 3,
      },
    ],
    shipAssignments: [],
    ...overrides,
  };
}

function getSelectOptionValuesFromLastEditReply(interaction: FakeButtonInteraction): string[] {
  const call = interaction.editReply.mock.calls.at(-1);
  const payload = call?.[0] as
    | {
        components?: Array<{
          toJSON?: () => {
            components?: Array<{ options?: Array<{ value: string }> }>;
          };
        }>;
      }
    | undefined;
  const row = payload?.components?.[0];
  if (!row || typeof row.toJSON !== 'function') {
    return [];
  }

  const rowJson = row.toJSON();
  return (rowJson.components?.[0]?.options ?? []).map(option => option.value);
}

describe('eventButtons handler-level permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUserService.getUserByDiscordId.mockResolvedValue({ id: 'user-1' });
    mockParticipantService.isLeader.mockResolvedValue(false);
    mockParticipantService.isParticipant.mockResolvedValue(false);
    mockActivityService.getActivityById.mockResolvedValue(makeActivity());
    mockActivityService.getShipManagementCapabilities.mockResolvedValue({
      manageableShipIdentifiers: ['ship-1'],
    });
    mockActivityService.getAvailablePassengerSlots.mockResolvedValue([]);
    mockActivityService.bringFleetAndInviteMembers.mockResolvedValue({
      status: 'full',
      invited: ['m1', 'm2'],
      skipped: [],
      activity: makeActivity(),
    });
    mockActivityService.getFleetBringPlan.mockResolvedValue({
      fleetName: 'Alpha Fleet',
      memberShips: new Map(),
      orphanShipIds: [],
    });
    mockActivityService.bringFleetToActivity.mockResolvedValue(makeActivity());
    mockActivityService.inviteFleetMembers.mockResolvedValue({
      invited: ['m1', 'm2'],
      skipped: [],
    });
    mockActivityService.updateRSVPStatus.mockResolvedValue(makeActivity());
    mockActivityService.joinActivity.mockResolvedValue(undefined);
    mockActivityService.joinShipAsPassenger.mockResolvedValue(undefined);
    mockFleetService.getAllFleets.mockResolvedValue([]);
  });

  it('opens passenger seat selector with encoded fallback identifier', async () => {
    mockActivityService.getAvailablePassengerSlots.mockResolvedValue([
      {
        shipId: undefined,
        shipType: 'Cutlass/Black',
        shipName: 'Crew::Bus',
        role: 'marine',
        ownerName: 'Owner',
        availableSlots: 2,
      },
    ]);

    const interaction = makeButtonInteraction('event_joinpassenger_activity-1', 'discord-user-1');
    await handleEventButton(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Select a passenger seat'),
      })
    );

    const optionValues = getSelectOptionValuesFromLastEditReply(interaction);
    expect(optionValues[0]).toBe('psg:Cutlass%2FBlack%3A%3ACrew%3A%3ABus::marine');
  });

  it('auto-joins participant before taking passenger seat', async () => {
    const interaction = makeSelectInteraction(['psg:ship-1::marine'], 'discord-user-1');

    await handlePassengerSelectMenu(interaction as never, 'activity-1');

    expect(mockActivityService.joinActivity).toHaveBeenCalledWith(
      'activity-1',
      expect.objectContaining({ userId: 'user-1', role: 'member' })
    );
    expect(mockActivityService.joinShipAsPassenger).toHaveBeenCalledWith(
      'activity-1',
      'user-1',
      'Tester',
      'ship-1',
      'marine'
    );
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '🎖️ Joined as **Marine**!',
      })
    );
  });

  it('opens manage-slots selector when backend exposes manageable ships', async () => {
    mockUserService.getUserByDiscordId.mockResolvedValue({ id: 'leader-1' });
    mockActivityService.getShipManagementCapabilities.mockResolvedValue({
      manageableShipIdentifiers: ['ship-1'],
    });

    const interaction = makeButtonInteraction('event_manageslots_activity-1', 'discord-user-1');
    await handleEventButton(interaction as never);

    expect(mockActivityService.getShipManagementCapabilities).toHaveBeenCalledWith(
      'activity-1',
      'leader-1'
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Select a ship to edit'),
      })
    );
  });

  it('returns a permission-focused message when ships exist but none are manageable', async () => {
    mockUserService.getUserByDiscordId.mockResolvedValue({ id: 'outsider-1' });
    mockActivityService.getShipManagementCapabilities.mockResolvedValue({
      manageableShipIdentifiers: [],
    });
    mockActivityService.getActivityById.mockResolvedValue(
      makeActivity({
        creatorId: 'creator-1',
        ships: [
          {
            id: 'ship-1',
            shipId: 'ship-1',
            shipName: 'Cutlass Black',
            shipType: 'Cutlass Black',
            ownerId: 'owner-1',
            contributedByUserId: 'contrib-1',
            crewAssigned: 1,
            crewCapacity: 3,
          },
        ],
      })
    );

    const interaction = makeButtonInteraction('event_manageslots_activity-1', 'discord-outsider');
    await handleEventButton(interaction as never);

    expect(mockActivityService.getShipManagementCapabilities).toHaveBeenCalledWith(
      'activity-1',
      'outsider-1'
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('cannot manage their slots'),
      })
    );
  });

  it('returns a no-ships message when the activity has no ships', async () => {
    mockActivityService.getActivityById.mockResolvedValue(
      makeActivity({ ships: [], shipAssignments: [] })
    );

    const interaction = makeButtonInteraction('event_manageslots_activity-1', 'discord-user-1');
    await handleEventButton(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('No ships in this event yet'),
      })
    );
  });

  it('returns stale-ship guidance when selection no longer exists', async () => {
    mockActivityService.getActivityById.mockResolvedValue(
      makeActivity({
        ships: [
          {
            id: 'ship-available',
            shipId: 'ship-available',
            shipName: 'Arrow',
            shipType: 'Arrow',
            ownerId: 'owner-1',
            contributedByUserId: 'contrib-1',
          },
        ],
      })
    );

    const interaction = makeSelectInteraction(['sid:ship-missing:0'], 'discord-user-1');
    await handleManageSlotsShipSelect(interaction as never, 'activity-1');

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Ship no longer available'),
      })
    );
    expect(interaction.showModal).not.toHaveBeenCalled();
  });

  it('brings orphan + own ships up front and invites members for the per-member flow', async () => {
    mockUserService.getUserByDiscordId.mockResolvedValue({ id: 'leader-1' });
    mockActivityService.getFleetBringPlan.mockResolvedValue({
      fleetName: 'Alpha Fleet',
      // leader-1 owns ship-a; m1 owns ship-b (offered to them individually)
      memberShips: new Map([
        ['leader-1', [{ shipId: 'ship-a', shipName: 'Cutlass', maxCrew: 3 }]],
        ['m1', [{ shipId: 'ship-b', shipName: 'Freelancer', maxCrew: 4 }]],
      ]),
      orphanShipIds: ['ship-orphan'],
    });
    mockActivityService.inviteFleetMembers.mockResolvedValue({ invited: ['m1'], skipped: [] });

    const interaction = makeSelectInteraction(['fleet-1'], 'discord-leader');
    await handleBringFleetSelect(interaction as never, 'activity-1');

    // Up-front bring = orphan ships + the actor's own ships (NOT other members' ships).
    expect(mockActivityService.bringFleetToActivity).toHaveBeenCalledWith(
      'activity-1',
      'leader-1',
      'fleet-1',
      expect.arrayContaining(['ship-orphan', 'ship-a'])
    );
    const broughtIds = mockActivityService.bringFleetToActivity.mock.calls[0][3] as string[];
    expect(broughtIds).not.toContain('ship-b');

    expect(mockActivityService.inviteFleetMembers).toHaveBeenCalledWith(
      'activity-1',
      'leader-1',
      'fleet-1'
    );
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Fleet **Alpha Fleet** brought in.'),
      })
    );
  });

  it('still completes when there are no ships to bring up front', async () => {
    mockUserService.getUserByDiscordId.mockResolvedValue({ id: 'leader-1' });
    mockActivityService.getFleetBringPlan.mockResolvedValue({
      fleetName: 'Empty Fleet',
      memberShips: new Map(),
      orphanShipIds: [],
    });
    mockActivityService.inviteFleetMembers.mockResolvedValue({
      invited: [],
      skipped: ['leader-1'],
    });

    const interaction = makeSelectInteraction(['fleet-1'], 'discord-leader');
    await handleBringFleetSelect(interaction as never, 'activity-1');

    // No ships → no up-front bring call.
    expect(mockActivityService.bringFleetToActivity).not.toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Added **0** ship(s)'),
      })
    );
  });

  it('lets event creator select from all org fleets', async () => {
    mockUserService.getUserByDiscordId.mockResolvedValue({ id: 'creator-1' });
    mockActivityService.getActivityById.mockResolvedValue(
      makeActivity({
        creatorId: 'creator-1',
        organizationId: 'org-1',
      })
    );
    mockFleetService.getAllFleets.mockResolvedValue([
      {
        id: 'fleet-1',
        name: 'Fleet A',
        leaderId: 'other-1',
        secondInCommandId: null,
        shipIds: [],
        members: [],
      },
      {
        id: 'fleet-2',
        name: 'Fleet B',
        leaderId: 'other-2',
        secondInCommandId: null,
        shipIds: [],
        members: [],
      },
    ]);

    const interaction = makeButtonInteraction('event_bringfleet_activity-1', 'discord-creator');
    await handleEventButton(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('As organiser, you can bring any org fleet'),
      })
    );

    const optionValues = getSelectOptionValuesFromLastEditReply(interaction);
    const sortedOptionValues = [...optionValues].sort((a, b) => a.localeCompare(b));
    expect(sortedOptionValues).toEqual(['fleet-1', 'fleet-2']);
  });

  it('filters bring-fleet options to led fleets for non-creators', async () => {
    mockUserService.getUserByDiscordId.mockResolvedValue({ id: 'leader-1' });
    mockActivityService.getActivityById.mockResolvedValue(
      makeActivity({
        creatorId: 'creator-1',
        organizationId: 'org-1',
      })
    );
    mockFleetService.getAllFleets.mockResolvedValue([
      {
        id: 'fleet-led',
        name: 'Led Fleet',
        leaderId: 'leader-1',
        secondInCommandId: null,
        shipIds: [],
        members: [],
      },
      {
        id: 'fleet-other',
        name: 'Other Fleet',
        leaderId: 'other-1',
        secondInCommandId: null,
        shipIds: [],
        members: [],
      },
    ]);

    const interaction = makeButtonInteraction('event_bringfleet_activity-1', 'discord-leader');
    await handleEventButton(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('All its ships will be added and its members invited'),
      })
    );

    const optionValues = getSelectOptionValuesFromLastEditReply(interaction);
    expect(optionValues).toEqual(['fleet-led']);
  });

  it('denies bring-fleet for non-creators who do not lead a fleet', async () => {
    mockUserService.getUserByDiscordId.mockResolvedValue({ id: 'member-1' });
    mockActivityService.getActivityById.mockResolvedValue(
      makeActivity({
        creatorId: 'creator-1',
        organizationId: 'org-1',
      })
    );
    mockFleetService.getAllFleets.mockResolvedValue([
      {
        id: 'fleet-1',
        name: 'Fleet A',
        leaderId: 'other-1',
        secondInCommandId: null,
        shipIds: [],
        members: [],
      },
    ]);

    const interaction = makeButtonInteraction('event_bringfleet_activity-1', 'discord-member');
    await handleEventButton(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('You don’t lead any fleets in this org'),
      })
    );
  });
});

describe('buildHangarGroups', () => {
  const makeSuggestion = (
    name: string,
    matchesRequirement: boolean,
    roleCategory?: string
  ): HangarSuggestion => ({
    userShipId: `id-${name}`,
    displayName: name,
    catalogueName: name,
    roleCategory: roleCategory as HangarSuggestion['roleCategory'],
    maxCrew: 1,
    matchesRequirement,
  });

  it('keeps every ship in menu-safe groups (no truncated partial list)', () => {
    // 55 ships, all "matching" — mirrors a no-requirements event where the old
    // grouping collapsed everything into one 55-item group and then truncated.
    const ships = Array.from({ length: 55 }, (_, i) =>
      makeSuggestion(`Ship ${String(i).padStart(2, '0')}`, true)
    );

    const groups = buildHangarGroups(ships);

    // Every group fits a single Discord select menu.
    for (const group of groups) {
      expect(group.ships.length).toBeLessThanOrEqual(24);
    }

    // No ship is dropped and none is duplicated across groups.
    const ids = groups.flatMap(g => g.ships.map(s => s.userShipId));
    expect(ids).toHaveLength(55);
    expect(new Set(ids).size).toBe(55);

    // Group keys (used as select option values) are unique.
    const keys = groups.map(g => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('surfaces requirement-matching ships first in their own group', () => {
    const ships = [
      makeSuggestion('Bravo', false, 'Industrial'),
      makeSuggestion('Alpha', true, 'Combat'),
    ];

    const groups = buildHangarGroups(ships);

    // The first group is the matching bucket (marked with ✅).
    expect(groups[0].emoji).toBe('✅');
    expect(groups[0].ships.map(s => s.userShipId)).toEqual(['id-Alpha']);
  });

  it('groups purely by role when every ship matches (no requirements)', () => {
    const ships = [
      makeSuggestion('Aurora', true, 'Combat'),
      makeSuggestion('Caterpillar', true, 'Logistics'),
    ];

    const groups = buildHangarGroups(ships);
    const labels = groups.map(g => g.label);

    expect(labels).toEqual(expect.arrayContaining(['Combat', 'Logistics']));
    // No "Matching ·" prefix — the matching split is skipped when nothing differs.
    expect(labels.some(l => l.startsWith('Matching'))).toBe(false);
  });
});

describe('handleEventButton — Ship & Crew action panel', () => {
  it('opens an ephemeral action panel (2 rows) when the trigger is clicked', async () => {
    const interaction = makeButtonInteraction('event_actions_activity-1', 'discord-user-1');
    await handleEventButton(interaction as never);

    // The trigger is dispatched directly to the panel opener — no RSVP defer/refresh.
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.deferUpdate).not.toHaveBeenCalled();

    const replyArg = interaction.reply.mock.calls[0][0] as {
      content: string;
      components: unknown[];
    };
    expect(replyArg.content).toEqual(expect.stringContaining('Ship & Crew'));
    expect(replyArg.components).toHaveLength(2);
  });

  it('leavecrew from ephemeral source refreshes via channel lookup and collapses panel', async () => {
    mockUserService.getUserByDiscordId.mockResolvedValueOnce({ id: 'user-1' });
    const interaction = makeButtonInteraction('event_leavecrew_activity-1', 'discord-user-1');
    (interaction as unknown as { message?: unknown }).message = {
      flags: { has: jest.fn(() => true) },
    };

    await handleEventButton(interaction as never);

    expect(mockActivityService.leaveShipCrew).toHaveBeenCalledWith('activity-1', 'user-1');
    expect(mockRefreshEventEmbedFromChannel).toHaveBeenCalledWith(interaction, 'activity-1');
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: '✅ You left the ship crew.',
      components: [],
    });
  });

  it('leavepassenger from ephemeral source refreshes via channel lookup and collapses panel', async () => {
    mockUserService.getUserByDiscordId.mockResolvedValueOnce({ id: 'user-1' });
    const interaction = makeButtonInteraction('event_leavepassenger_activity-1', 'discord-user-1');
    (interaction as unknown as { message?: unknown }).message = {
      flags: { has: jest.fn(() => true) },
    };

    await handleEventButton(interaction as never);

    expect(mockActivityService.leaveShipAsPassenger).toHaveBeenCalledWith('activity-1', 'user-1');
    expect(mockRefreshEventEmbedFromChannel).toHaveBeenCalledWith(interaction, 'activity-1');
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: '✅ You left your passenger seat.',
      components: [],
    });
  });
});

describe('handleFleetInviteResponse — per-member fleet DM', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserService.getUserByDiscordId.mockResolvedValue({ id: 'member-1' });
    mockActivityService.updateRSVPStatus.mockResolvedValue(makeActivity());
  });

  it('accepts and loans the member’s own fleet ship on "joinship"', async () => {
    mockActivityService.getFleetBringPlan.mockResolvedValue({
      fleetName: 'Alpha Fleet',
      memberShips: new Map([
        ['member-1', [{ shipId: 'ship-b', shipName: 'Freelancer', maxCrew: 4 }]],
      ]),
      orphanShipIds: [],
    });

    const interaction = makeButtonInteraction(
      'event_fleetjoinship_activity-1_fleet-1',
      'discord-member'
    );
    await handleFleetInviteResponse(interaction as never, 'joinship', 'activity-1', 'fleet-1');

    expect(mockActivityService.updateRSVPStatus).toHaveBeenCalledWith(
      'activity-1',
      'member-1',
      'accepted',
      expect.anything()
    );
    expect(mockParticipantService.addShip).toHaveBeenCalledWith(
      'activity-1',
      'member-1',
      expect.objectContaining({ shipName: 'Freelancer', maxCrew: 4 })
    );
  });

  it('accepts without adding a ship on "joinonly"', async () => {
    const interaction = makeButtonInteraction(
      'event_fleetjoinonly_activity-1_fleet-1',
      'discord-member'
    );
    await handleFleetInviteResponse(interaction as never, 'joinonly', 'activity-1', 'fleet-1');

    expect(mockActivityService.updateRSVPStatus).toHaveBeenCalledWith(
      'activity-1',
      'member-1',
      'accepted',
      expect.anything()
    );
    expect(mockParticipantService.addShip).not.toHaveBeenCalled();
  });

  it('declines the RSVP on "decline" without touching ships', async () => {
    const interaction = makeButtonInteraction(
      'event_fleetdecline_activity-1_fleet-1',
      'discord-member'
    );
    await handleFleetInviteResponse(interaction as never, 'decline', 'activity-1', 'fleet-1');

    expect(mockActivityService.updateRSVPStatus).toHaveBeenCalledWith(
      'activity-1',
      'member-1',
      'declined',
      expect.anything()
    );
    expect(mockParticipantService.addShip).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
