import { ChannelType, type Guild, PermissionFlagsBits } from 'discord.js';

import { checkBotGuildPermissions } from '../discord';
import {
  buildIssueChannelOverwrites,
  createIssueChannel,
  sanitizeChannelName,
} from '../issueChannel';

jest.mock('../discord', () => ({
  checkBotGuildPermissions: jest.fn(),
}));

const mockedCheckPerms = checkBotGuildPermissions as jest.MockedFunction<
  typeof checkBotGuildPermissions
>;

function makeGuild(overrides: Record<string, unknown> = {}): Guild {
  return {
    id: 'guild-1',
    name: 'Test Guild',
    roles: {
      everyone: { id: 'everyone-1' },
      cache: new Map([['role-1', { id: 'role-1' }]]),
      fetch: jest.fn(),
    },
    members: { me: { id: 'bot-1' } },
    channels: {
      cache: new Map([['cat-1', { id: 'cat-1', type: ChannelType.GuildCategory }]]),
      create: jest.fn().mockResolvedValue({ id: 'chan-1' }),
    },
    ...overrides,
  } as unknown as Guild;
}

const baseOpts = {
  initiatorId: 'user-1',
  roleId: 'role-1',
  categoryId: 'cat-1',
  name: 'apply-abc123',
};

describe('sanitizeChannelName', () => {
  it('lowercases and replaces unsafe chars with dashes', () => {
    expect(sanitizeChannelName('Apply ABC#123!')).toBe('apply-abc-123');
  });

  it('collapses and trims dashes', () => {
    expect(sanitizeChannelName('--a__b--')).toBe('a-b');
  });

  it('falls back to "issue" when empty after cleaning', () => {
    expect(sanitizeChannelName('###')).toBe('issue');
  });

  it('caps length at 90 chars', () => {
    expect(sanitizeChannelName('a'.repeat(200)).length).toBeLessThanOrEqual(90);
  });
});

describe('buildIssueChannelOverwrites', () => {
  it('denies @everyone ViewChannel and grants initiator + role + bot', () => {
    const guild = makeGuild();
    const overwrites = buildIssueChannelOverwrites(guild, 'user-1', 'role-1');

    const everyone = overwrites.find(o => o.id === 'everyone-1') as { deny?: bigint[] };
    expect(everyone.deny).toContain(PermissionFlagsBits.ViewChannel);

    const initiator = overwrites.find(o => o.id === 'user-1') as { allow?: bigint[] };
    expect(initiator.allow).toContain(PermissionFlagsBits.ViewChannel);
    expect(initiator.allow).toContain(PermissionFlagsBits.SendMessages);
    expect(initiator.allow).not.toContain(PermissionFlagsBits.ManageMessages);

    const role = overwrites.find(o => o.id === 'role-1') as { allow?: bigint[] };
    expect(role.allow).toContain(PermissionFlagsBits.ManageMessages);

    const bot = overwrites.find(o => o.id === 'bot-1') as { allow?: bigint[] };
    expect(bot.allow).toContain(PermissionFlagsBits.ManageChannels);
  });
});

describe('createIssueChannel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCheckPerms.mockReturnValue(true);
  });

  it('creates a private GuildText channel under the category', async () => {
    const guild = makeGuild();
    const channel = await createIssueChannel(guild, baseOpts);

    expect(channel).toEqual({ id: 'chan-1' });
    expect(guild.channels.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: ChannelType.GuildText, parent: 'cat-1' })
    );
  });

  it('returns null and does not create when the bot lacks ManageChannels', async () => {
    mockedCheckPerms.mockReturnValue(false);
    const guild = makeGuild();

    expect(await createIssueChannel(guild, baseOpts)).toBeNull();
    expect(guild.channels.create).not.toHaveBeenCalled();
  });

  it('returns null when the category is missing or not a category', async () => {
    const guild = makeGuild({ channels: { cache: new Map(), create: jest.fn() } });
    expect(await createIssueChannel(guild, baseOpts)).toBeNull();
  });

  it('returns null when the staff role cannot be resolved', async () => {
    const guild = makeGuild({
      roles: {
        everyone: { id: 'everyone-1' },
        cache: new Map(),
        fetch: jest.fn().mockResolvedValue(null),
      },
    });
    expect(await createIssueChannel(guild, baseOpts)).toBeNull();
  });

  it('returns null (non-fatal) when channel creation throws', async () => {
    const guild = makeGuild({
      channels: {
        cache: new Map([['cat-1', { id: 'cat-1', type: ChannelType.GuildCategory }]]),
        create: jest.fn().mockRejectedValue(new Error('Maximum number of channels reached')),
      },
    });
    expect(await createIssueChannel(guild, baseOpts)).toBeNull();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
