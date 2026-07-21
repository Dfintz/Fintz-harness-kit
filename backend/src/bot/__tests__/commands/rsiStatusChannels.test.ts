jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../utils/redis', () => ({
  redisClient: {
    getClient: jest.fn(() => ({
      hset: jest.fn().mockResolvedValue(undefined),
      hdel: jest.fn().mockResolvedValue(undefined),
      hgetall: jest.fn().mockResolvedValue({}),
    })),
  },
}));

jest.mock('../../../services/external/RsiStatusService', () => ({
  rsiStatusService: { getStatus: jest.fn() },
}));

jest.mock('../../BotClientManager', () => {
  const client = { guilds: { cache: new Map<string, unknown>() } };
  return {
    BotClientManager: {
      getInstance: () => ({ getClient: () => client }),
    },
  };
});

import type { ChannelSelectMenuInteraction } from 'discord.js';

import type { RsiStatusSnapshot } from '../../../services/external/RsiStatusService';
import { rsiStatusService } from '../../../services/external/RsiStatusService';
import { BotClientManager } from '../../BotClientManager';
import {
  __resetStatusChannelsForTest,
  assignExistingStatusChannel,
  computeChannelName,
  getComponentStatusEmoji,
  getRoleEmoji,
  hasActiveStatusChannels,
  ROLE_COMPONENT,
  stripStatusEmoji,
  updateStatusChannels,
} from '../../commands/rsiStatusChannels';

const getStatusMock = rsiStatusService.getStatus as jest.Mock;

function snapshot(platform: string, pu: string): RsiStatusSnapshot {
  return {
    components: [
      { name: 'Platform', status: platform },
      { name: 'Persistent Universe', status: pu },
    ],
    overallStatus: 'test',
    latestIncident: null,
    fetchedAt: new Date(),
  };
}

interface FakeChannel {
  id: string;
  name: string;
  manageable: boolean;
  setName: jest.Mock;
  delete: jest.Mock;
}

function makeChannel(name: string): FakeChannel {
  const channel: FakeChannel = {
    id: 'chan-1',
    name,
    manageable: true,
    setName: jest.fn(async (newName: string) => {
      channel.name = newName;
      return channel;
    }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  return channel;
}

function makeGuild(channel: FakeChannel | null) {
  return {
    id: 'guild-1',
    members: { me: { permissions: { has: () => true } } },
    roles: { everyone: { id: 'everyone' } },
    channels: {
      fetch: jest.fn().mockResolvedValue(channel),
      cache: new Map(),
    },
  };
}

function makeSelectInteraction(
  guild: ReturnType<typeof makeGuild>,
  channelId: string
): { interaction: ChannelSelectMenuInteraction; editReply: jest.Mock } {
  const editReply = jest.fn().mockResolvedValue(undefined);
  const interaction = {
    guild,
    memberPermissions: { has: () => true },
    values: [channelId],
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply,
  } as unknown as ChannelSelectMenuInteraction;
  return { interaction, editReply };
}

function seedClientGuild(guild: unknown): void {
  const client = BotClientManager.getInstance().getClient() as unknown as {
    guilds: { cache: Map<string, unknown> };
  };
  client.guilds.cache.set('guild-1', guild);
}

describe('rsiStatusChannels — pure helpers', () => {
  describe('getComponentStatusEmoji', () => {
    it.each([
      ['Operational', '🟢'],
      ['Degraded Performance', '🟡'],
      ['Partial Outage', '🟡'],
      ['Under Maintenance', '🔧'],
      ['Major Outage', '🔴'],
      ['Unknown', '⚪'],
      ['something weird', '⚪'],
    ])('maps "%s" → %s', (status, emoji) => {
      expect(getComponentStatusEmoji(status)).toBe(emoji);
    });
  });

  describe('stripStatusEmoji', () => {
    it('removes a leading status emoji and separator', () => {
      expect(stripStatusEmoji('🟢 RSI Platform')).toBe('RSI Platform');
      expect(stripStatusEmoji('🔴│Servers')).toBe('Servers');
    });

    it('leaves names without a status emoji untouched', () => {
      expect(stripStatusEmoji('rsi-platform')).toBe('rsi-platform');
    });
  });

  describe('computeChannelName', () => {
    it('prefixes the emoji and clamps to 100 chars', () => {
      expect(computeChannelName('🟢', 'Platform')).toBe('🟢 Platform');
      expect(computeChannelName('🟢', 'x'.repeat(200)).length).toBe(100);
    });
  });

  describe('getRoleEmoji', () => {
    it('reads the Platform component for the application role', () => {
      expect(getRoleEmoji(snapshot('Operational', 'Major Outage'), 'application')).toBe('🟢');
    });

    it('reads the Persistent Universe component for the server role', () => {
      expect(getRoleEmoji(snapshot('Operational', 'Major Outage'), 'server')).toBe('🔴');
    });

    it('falls back to unknown when the component is missing', () => {
      const empty: RsiStatusSnapshot = {
        components: [],
        overallStatus: 'test',
        latestIncident: null,
        fetchedAt: new Date(),
      };
      expect(getRoleEmoji(empty, 'application')).toBe('⚪');
    });
  });

  it('maps roles to the expected RSI components', () => {
    expect(ROLE_COMPONENT.application).toBe('Platform');
    expect(ROLE_COMPONENT.server).toBe('Persistent Universe');
  });
});

describe('rsiStatusChannels — channel updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetStatusChannelsForTest();
    getStatusMock.mockResolvedValue(snapshot('Operational', 'Operational'));
  });

  it('renames an assigned channel to reflect the status emoji', async () => {
    const channel = makeChannel('rsi-platform');
    const guild = makeGuild(channel);
    seedClientGuild(guild);

    const { interaction, editReply } = makeSelectInteraction(guild, 'chan-1');
    await assignExistingStatusChannel(interaction, 'application');

    expect(hasActiveStatusChannels()).toBe(true);
    expect(channel.setName).toHaveBeenCalledWith('🟢 rsi-platform', expect.any(String));
    expect(editReply).toHaveBeenCalled();
  });

  it('does not rename again when the name already matches', async () => {
    const channel = makeChannel('rsi-platform');
    const guild = makeGuild(channel);
    seedClientGuild(guild);

    const { interaction } = makeSelectInteraction(guild, 'chan-1');
    await assignExistingStatusChannel(interaction, 'application');
    expect(channel.setName).toHaveBeenCalledTimes(1);

    await updateStatusChannels(snapshot('Operational', 'Operational'));
    // Name already '🟢 rsi-platform' → no extra rename.
    expect(channel.setName).toHaveBeenCalledTimes(1);
  });

  it('drops a tracked channel that no longer exists', async () => {
    const channel = makeChannel('rsi-platform');
    const guild = makeGuild(channel);
    seedClientGuild(guild);

    const { interaction } = makeSelectInteraction(guild, 'chan-1');
    await assignExistingStatusChannel(interaction, 'application');
    expect(hasActiveStatusChannels()).toBe(true);

    // Channel vanished.
    (guild.channels.fetch as jest.Mock).mockResolvedValue(null);
    await updateStatusChannels(snapshot('Operational', 'Operational'));

    expect(hasActiveStatusChannels()).toBe(false);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
