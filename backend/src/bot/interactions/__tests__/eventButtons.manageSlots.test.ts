import {
  handleManageSlots,
  handleManageSlotsModal,
  handleManageSlotsShipSelect,
} from '../eventButtons.manageSlots';

const mockGetActivityById = jest.fn();
const mockGetShipManagementCapabilities = jest.fn();
const mockSetCrewSlots = jest.fn();
const mockSetPassengerSlots = jest.fn();

jest.mock('../eventButtons.services', () => ({
  getActivityService: jest.fn(() => ({
    getActivityById: mockGetActivityById,
    getShipManagementCapabilities: mockGetShipManagementCapabilities,
    setCrewSlots: mockSetCrewSlots,
    setPassengerSlots: mockSetPassengerSlots,
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
  sanitizeErrorForUser: (v: string) => v,
}));

const mockLogAuditEvent = jest.fn();
jest.mock('../../../utils/auditLogger', () => ({
  AuditEventType: {
    ACTIVITY_ACTION: 'ACTIVITY_ACTION',
  },
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

describe('eventButtons.manageSlots seam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveInternalUserId.mockResolvedValue('user-1');
    mockGetShipManagementCapabilities.mockResolvedValue({ manageableShipIdentifiers: ['ship-1'] });
  });

  it('handleManageSlots builds manageslots select customId', async () => {
    const interaction = makeButtonInteraction();
    mockGetActivityById.mockResolvedValue({
      id: 'activity-1',
      ships: [
        {
          id: 'ship-1',
          shipId: 'ship-1',
          shipName: 'Cutlass',
          shipType: 'Cutlass Black',
          ownerId: 'owner-1',
          crewAssigned: 1,
          crewCapacity: 3,
        },
      ],
      shipAssignments: [],
    });

    await handleManageSlots(interaction, 'activity-1');

    const payload = interaction.editReply.mock.calls[0][0] as {
      components: Array<{ components: Array<{ data: { custom_id: string } }> }>;
    };
    expect(payload.components[0].components[0].data.custom_id).toBe(
      'event_manageslotsselect_activity-1'
    );
  });

  it('handleManageSlotsShipSelect uses encoded identifier in modal customId', async () => {
    const interaction = makeSelectInteraction(['sid:ship%2Falpha:0']);
    mockGetActivityById.mockResolvedValue({
      id: 'activity-1',
      ships: [
        {
          id: 'ship-id',
          shipId: 'ship/alpha',
          shipName: 'C2',
          shipType: 'Hercules C2',
          ownerId: 'owner-1',
          crewSlots: [{ role: 'pilot', capacity: 1 }],
          passengers: [{ role: 'marine', capacity: 2 }],
        },
      ],
      shipAssignments: [],
    });
    mockGetShipManagementCapabilities.mockResolvedValue({
      manageableShipIdentifiers: ['ship/alpha'],
    });

    await handleManageSlotsShipSelect(interaction, 'activity-1');

    const modalArg = interaction.showModal.mock.calls[0][0] as { data: { custom_id: string } };
    expect(modalArg.data.custom_id).toBe('event_manageslots_modal_activity-1__ship%2Falpha');

    const modal = interaction.showModal.mock.calls[0][0] as {
      toJSON?: () => Record<string, unknown>;
      data?: Record<string, unknown>;
    };
    const payload = typeof modal.toJSON === 'function' ? modal.toJSON() : (modal.data ?? {});

    const crewInput = findObjectByCustomId(payload, 'slots_crew');
    const passengerInput = findObjectByCustomId(payload, 'slots_passenger');

    expect(crewInput).toBeTruthy();
    expect(passengerInput).toBeTruthy();
    expect(crewInput).not.toHaveProperty('label');
    expect(passengerInput).not.toHaveProperty('label');
  });

  it('handleManageSlotsModal skips crew write on blank crew but still clears passengers', async () => {
    const interaction = makeModalInteraction({
      slots_crew: '',
      slots_passenger: '',
    });

    await handleManageSlotsModal(interaction, 'activity-1', 'ship-1');

    expect(mockSetCrewSlots).not.toHaveBeenCalled();
    expect(mockSetPassengerSlots).toHaveBeenCalledWith('activity-1', 'user-1', 'ship-1', []);
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
} {
  return {
    user: { id: 'discord-1', username: 'Pilot' },
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}

function makeSelectInteraction(values: string[]): {
  values: string[];
  user: { id: string };
  replied: boolean;
  deferred: boolean;
  reply: jest.Mock;
  showModal: jest.Mock;
} {
  return {
    values,
    user: { id: 'discord-1' },
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    showModal: jest.fn().mockResolvedValue(undefined),
  };
}

function makeModalInteraction(fieldsMap: Record<string, string>): {
  user: { id: string; username: string };
  guildId: string;
  channelId: string;
  deferReply: jest.Mock;
  editReply: jest.Mock;
  fields: { getTextInputValue: (key: string) => string };
} {
  return {
    user: { id: 'discord-1', username: 'Pilot' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    fields: {
      getTextInputValue: (key: string) => fieldsMap[key] ?? '',
    },
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
