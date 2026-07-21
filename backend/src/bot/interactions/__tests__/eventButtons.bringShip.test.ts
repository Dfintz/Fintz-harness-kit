import { MessageFlags } from 'discord.js';

const mockGetActivityById = jest.fn();
const mockGetParticipants = jest.fn();
const mockIsParticipant = jest.fn();
const mockJoinActivity = jest.fn();
const mockAddShip = jest.fn();
const mockLoanShips = jest.fn();
const mockUpdateActivity = jest.fn();

jest.mock('../eventButtons.services', () => ({
  getActivityService: jest.fn(() => ({
    getActivityById: mockGetActivityById,
    joinActivity: mockJoinActivity,
    addShip: mockAddShip,
    loanShips: mockLoanShips,
    updateActivity: mockUpdateActivity,
  })),
  getParticipantService: jest.fn(() => ({
    isParticipant: mockIsParticipant,
    getParticipants: mockGetParticipants,
  })),
}));

const mockResolveInternalUserId = jest.fn();
jest.mock('../eventButtons.identity', () => ({
  resolveInternalUserId: (...args: unknown[]) => mockResolveInternalUserId(...args),
}));

const mockGetHangarSuggestions = jest.fn();
const mockBuildShipOptions = jest.fn();
const mockBuildHangarGroups = jest.fn();
const mockResolveShipTaxonomy = jest.fn();
const mockIsBundledShipName = jest.fn();

jest.mock('../eventButtons.hangarSuggestions', () => ({
  getHangarSuggestions: (...args: unknown[]) => mockGetHangarSuggestions(...args),
  buildShipOptions: (...args: unknown[]) => mockBuildShipOptions(...args),
  resolveShipTaxonomy: (...args: unknown[]) => mockResolveShipTaxonomy(...args),
  isBundledShipName: (...args: unknown[]) => mockIsBundledShipName(...args),
}));

jest.mock('../eventButtons.hangarGroups', () => ({
  MAX_HANGAR_OPTIONS: 25,
  buildHangarGroups: (...args: unknown[]) => mockBuildHangarGroups(...args),
}));

const mockRefreshEventEmbedFromChannel = jest.fn();
jest.mock('../eventButtons.refresh', () => ({
  refreshEventEmbedFromChannel: (...args: unknown[]) => mockRefreshEventEmbedFromChannel(...args),
}));

jest.mock('../eventButtons.requirements', () => ({
  parseRequiredShipTypes: jest.fn(() => []),
  computeFilledCounts: jest.fn(),
}));

jest.mock('../eventButtons.security', () => ({
  sanitizeDiscordInput: (v: string) => v,
  sanitizeErrorForUser: (v: string) => v,
}));

jest.mock('../../constants/shipTaxonomy', () => ({
  getShipRoleEmoji: jest.fn(() => '🚀'),
}));

jest.mock('@sc-fleet-manager/shared-types', () => ({
  getCarrierCapability: jest.fn(() => null),
}));

const mockRepoFindOne = jest.fn();
const mockGetRepository = jest.fn(() => ({ findOne: mockRepoFindOne }));
jest.mock('../../../config/database', () => ({
  AppDataSource: {
    isInitialized: true,
    getRepository: (...args: unknown[]) => mockGetRepository(...args),
  },
}));

import {
  handleBringShip,
  handleBringShipModal,
  handleHangarPageSelect,
  handleHangarShipSelect,
  handleNestShipSelect,
} from '../eventButtons.bringShip';

describe('eventButtons.bringShip seam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveInternalUserId.mockResolvedValue('user-1');
    mockGetActivityById.mockResolvedValue({ id: 'activity-1', ships: [], shipAssignments: [] });
    mockGetHangarSuggestions.mockResolvedValue([]);
    mockBuildShipOptions.mockReturnValue([]);
    mockBuildHangarGroups.mockReturnValue([]);
    mockResolveShipTaxonomy.mockReturnValue({ roleCategory: 'Bespoke', shipType: 'Cutlass Black' });
    mockIsBundledShipName.mockReturnValue(false);
    mockRepoFindOne.mockResolvedValue(null);
    mockIsParticipant.mockResolvedValue(true);
  });

  it('handleBringShip renders hangarship select for <=25 suggestions', async () => {
    const interaction = makeButtonInteraction();
    const suggestions = [{ id: 's1', matchesRequirement: false }];
    mockGetHangarSuggestions.mockResolvedValue(suggestions);
    mockBuildShipOptions.mockReturnValue([{ label: 'Ship A', description: 'A', value: 'ship-a' }]);

    await handleBringShip(interaction as never, 'activity-1');

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        components: [expect.any(Object)],
      })
    );
    const payload = interaction.editReply.mock.calls[0][0] as {
      components: Array<{ components: Array<{ data: { custom_id: string } }> }>;
    };
    expect(payload.components[0].components[0].data.custom_id).toBe('event_hangarship_activity-1');
  });

  it('handleBringShip renders hangarpage select for >25 suggestions', async () => {
    const interaction = makeButtonInteraction();
    const suggestions = Array.from({ length: 26 }, (_, i) => ({
      id: `s-${i}`,
      matchesRequirement: false,
    }));
    mockGetHangarSuggestions.mockResolvedValue(suggestions);
    mockBuildHangarGroups.mockReturnValue([
      { label: 'Combat', ships: [{ id: 's-1' }], key: 'combat', emoji: '⚔️' },
    ]);

    await handleBringShip(interaction as never, 'activity-1');

    const payload = interaction.editReply.mock.calls[0][0] as {
      components: Array<{ components: Array<{ data: { custom_id: string } }> }>;
    };
    expect(payload.components[0].components[0].data.custom_id).toBe('event_hangarpage_activity-1');
  });

  it('handleBringShip returns link-account message when user is unlinked', async () => {
    const interaction = makeButtonInteraction();
    mockResolveInternalUserId.mockResolvedValue(null);

    await handleBringShip(interaction as never, 'activity-1');

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Link your account'),
      })
    );
  });

  it('handleHangarShipSelect opens manual-entry modal for __manual__', async () => {
    const interaction = makeSelectInteraction('event_hangarship_activity-1', ['__manual__']);

    await handleHangarShipSelect(interaction as never, 'activity-1');

    expect(interaction.showModal).toHaveBeenCalledWith(expect.any(Object));
    const modal = interaction.showModal.mock.calls[0][0] as {
      data: { custom_id: string; components?: unknown[] };
      toJSON?: () => Record<string, unknown>;
    };
    expect(modal.data.custom_id).toBe('event_bringship_modal_activity-1');

    const modalPayload = typeof modal.toJSON === 'function' ? modal.toJSON() : modal.data;

    const shipNameInput = findObjectByCustomId(modalPayload, 'ship_name');
    const shipTypeInput = findObjectByCustomId(modalPayload, 'ship_type');
    const shipRoleInput = findObjectByCustomId(modalPayload, 'ship_role');
    const maxCrewInput = findObjectByCustomId(modalPayload, 'max_crew');

    expect(shipNameInput).toBeTruthy();
    expect(shipTypeInput).toBeTruthy();
    expect(shipRoleInput).toBeTruthy();
    expect(maxCrewInput).toBeTruthy();

    // LabelBuilder owns visible labels in Label components; nested text inputs must not include one.
    expect(shipNameInput).not.toHaveProperty('label');
    expect(shipTypeInput).not.toHaveProperty('label');
    expect(shipRoleInput).not.toHaveProperty('label');
    expect(maxCrewInput).not.toHaveProperty('label');
  });

  it('handleHangarPageSelect routes __manual__ through hangar-ship modal flow', async () => {
    const interaction = makeSelectInteraction('event_hangarpage_activity-1', ['__manual__']);

    await handleHangarPageSelect(interaction as never, 'activity-1');

    expect(interaction.showModal).toHaveBeenCalledWith(expect.any(Object));
  });

  it('handleBringShipModal rejects invalid max crew without service calls', async () => {
    const interaction = makeModalInteraction('event_bringship_modal_activity-1', {
      ship_name: 'Stargazer',
      ship_type: 'Cutlass Black',
      ship_role: 'Combat',
      max_crew: '0',
    });

    await handleBringShipModal(interaction as never, 'activity-1');

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('between 1 and 100'),
      })
    );
    expect(mockAddShip).not.toHaveBeenCalled();
    expect(mockLoanShips).not.toHaveBeenCalled();
  });

  it('handleNestShipSelect handles __none__ without docking', async () => {
    const interaction = makeSelectInteraction('event_nestship_activity-1_child', ['__none__']);

    await handleNestShipSelect(interaction as never, 'activity-1', 'child');

    expect(interaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('kept as independent'),
      })
    );
  });

  it('handleNestShipSelect decodes childShipKey and docks selected carrier', async () => {
    const interaction = makeSelectInteraction('event_nestship_activity-1_child', [
      'carrier-1__hangar',
    ]);
    mockGetActivityById.mockResolvedValue({
      id: 'activity-1',
      ships: [
        { id: 'carrier-1', shipType: 'Carrack', shipName: 'Carrier One' },
        {
          id: 'child-1',
          shipType: 'Arrow',
          shipName: 'Child One',
          isTransported: false,
        },
      ],
      shipAssignments: [],
    });

    await handleNestShipSelect(interaction as never, 'activity-1', encodeURIComponent('child-1'));

    expect(mockUpdateActivity).toHaveBeenCalled();
    expect(mockRefreshEventEmbedFromChannel).toHaveBeenCalledWith(interaction, 'activity-1');
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

function makeSelectInteraction(
  customId: string,
  values: string[]
): {
  customId: string;
  values: string[];
  user: { id: string; username: string };
  deferUpdate: jest.Mock;
  update: jest.Mock;
  editReply: jest.Mock;
  showModal: jest.Mock;
  followUp: jest.Mock;
  replied: boolean;
  deferred: boolean;
  guildId: string;
  channelId: string;
} {
  return {
    customId,
    values,
    user: { id: 'discord-1', username: 'Pilot' },
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    showModal: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    replied: false,
    deferred: false,
    guildId: 'guild-1',
    channelId: 'channel-1',
  };
}

function makeModalInteraction(
  customId: string,
  fields: Record<string, string>
): {
  customId: string;
  user: { id: string; username: string };
  fields: { getTextInputValue: (key: string) => string };
  deferReply: jest.Mock;
  editReply: jest.Mock;
  followUp: jest.Mock;
  guildId: string;
  channelId: string;
} {
  return {
    customId,
    user: { id: 'discord-1', username: 'Pilot' },
    fields: {
      getTextInputValue: (key: string) => fields[key],
    },
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    guildId: 'guild-1',
    channelId: 'channel-1',
  };
}

function findObjectByCustomId(
  value: unknown,
  customId: string
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findObjectByCustomId(item, customId);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (record.custom_id === customId) {
    return record;
  }

  for (const nested of Object.values(record)) {
    const found = findObjectByCustomId(nested, customId);
    if (found) {
      return found;
    }
  }

  return undefined;
}
