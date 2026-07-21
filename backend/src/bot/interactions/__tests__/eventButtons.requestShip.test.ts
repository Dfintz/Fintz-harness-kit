import { MessageFlags } from 'discord.js';

import {
  handleReqShipModal,
  handleReqShipRoleSelect,
  handleReqShipTypeSelect,
  handleRequestShip,
} from '../eventButtons.requestShip';

const mockGetActivityById = jest.fn();
const mockUpdateActivity = jest.fn();

jest.mock('../eventButtons.services', () => ({
  getActivityService: jest.fn(() => ({
    getActivityById: mockGetActivityById,
    updateActivity: mockUpdateActivity,
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
  sanitizeErrorForUser: (value: string) => value,
}));

jest.mock('../eventButtons.requirements', () => ({
  parseRequiredShipTypes: jest.fn(() => []),
}));

const mockLogAuditEvent = jest.fn();
jest.mock('../../../utils/auditLogger', () => ({
  AuditEventType: {
    ACTIVITY_ACTION: 'ACTIVITY_ACTION',
  },
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

describe('eventButtons.requestShip seam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveInternalUserId.mockResolvedValue('user-1');
    mockGetActivityById.mockResolvedValue({ id: 'activity-1', creatorId: 'user-1' });
  });

  it('handleRequestShip builds reqship role select customId', async () => {
    const interaction = makeButtonInteraction();

    await handleRequestShip(interaction, 'activity-1');

    const payload = interaction.editReply.mock.calls[0][0] as {
      components: Array<{ components: Array<{ data: { custom_id: string } }> }>;
    };
    expect(payload.components[0].components[0].data.custom_id).toBe('event_reqshiprole_activity-1');
  });

  it('handleReqShipRoleSelect builds reqship type select customId', async () => {
    const interaction = makeSelectInteraction(['Combat']);

    await handleReqShipRoleSelect(interaction, 'activity-1');

    const payload = interaction.editReply.mock.calls[0][0] as {
      components: Array<{ components: Array<{ data: { custom_id: string } }> }>;
    };
    expect(payload.components[0].components[0].data.custom_id).toBe(
      'event_reqshiptype_activity-1_Combat'
    );
  });

  it('handleReqShipTypeSelect rejects unknown role values', async () => {
    const interaction = {
      values: ['any'],
      replied: false,
      deferred: false,
      reply: jest.fn().mockResolvedValue(undefined),
      showModal: jest.fn().mockResolvedValue(undefined),
    };

    await handleReqShipTypeSelect(interaction, 'activity-1', 'invalid-role');

    expect(interaction.reply).toHaveBeenCalledWith({
      content: '⚠️ Unknown ship role.',
      flags: MessageFlags.Ephemeral,
    });
    expect(interaction.showModal).not.toHaveBeenCalled();
  });

  it('handleReqShipTypeSelect modal payload omits nested text input labels', async () => {
    const interaction = {
      values: ['__any__'],
      replied: false,
      deferred: false,
      reply: jest.fn().mockResolvedValue(undefined),
      showModal: jest.fn().mockResolvedValue(undefined),
    };

    await handleReqShipTypeSelect(interaction as never, 'activity-1', 'Combat');

    expect(interaction.showModal).toHaveBeenCalledWith(expect.any(Object));

    const modal = interaction.showModal.mock.calls[0][0] as {
      toJSON?: () => Record<string, unknown>;
      data?: Record<string, unknown>;
    };

    const payload = typeof modal.toJSON === 'function' ? modal.toJSON() : (modal.data ?? {});

    const roleInput = findObjectByCustomId(payload, 'req_role');
    const typeInput = findObjectByCustomId(payload, 'req_type');
    const countInput = findObjectByCustomId(payload, 'req_count');
    const strictInput = findObjectByCustomId(payload, 'req_strict');

    expect(roleInput).toBeTruthy();
    expect(typeInput).toBeTruthy();
    expect(countInput).toBeTruthy();
    expect(strictInput).toBeTruthy();

    expect(roleInput).not.toHaveProperty('label');
    expect(typeInput).not.toHaveProperty('label');
    expect(countInput).not.toHaveProperty('label');
    expect(strictInput).not.toHaveProperty('label');
  });

  it('handleReqShipModal appends requirement and refreshes embed', async () => {
    const interaction = makeModalInteraction({
      req_role: 'combat',
      req_type: 'Hornet F7C',
      req_count: '2',
      req_strict: 'required',
    });
    mockGetActivityById.mockResolvedValue({
      id: 'activity-1',
      creatorId: 'user-1',
      requiredShipTypes: '[]',
    });

    await handleReqShipModal(interaction, 'activity-1');

    expect(mockUpdateActivity).toHaveBeenCalledWith('activity-1', {
      requiredShipTypes: JSON.stringify([
        {
          role: 'combat',
          type: 'Hornet F7C',
          count: 2,
          filled: 0,
          strictness: 'required',
        },
      ]),
    });
    expect(mockRefreshEventEmbedFromChannel).toHaveBeenCalledWith(interaction, 'activity-1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EVENT_SHIP_REQUESTED' })
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
} {
  return {
    user: { id: 'discord-1', username: 'Pilot' },
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}

function makeSelectInteraction(values: string[]): {
  values: string[];
  deferUpdate: jest.Mock;
  editReply: jest.Mock;
} {
  return {
    values,
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
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
