import type { Client, GuildMember, PartialGuildMember } from 'discord.js';

import { registerNotificationPreferenceListener } from '../notificationPreferenceListener';

const mockGetSettingsByGuildId = jest.fn();

jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {
    getSettingsByGuildId: (...args: unknown[]) => mockGetSettingsByGuildId(...args),
  },
}));

interface Harness {
  readonly client: Client;
  readonly handlers: Record<string, (...args: unknown[]) => void>;
  readonly send: jest.Mock;
}

function createClientHarness(): Harness {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const send = jest.fn().mockResolvedValue({ crosspost: jest.fn().mockResolvedValue({}) });

  const channel = {
    isTextBased: () => true,
    send,
    type: 0,
  };

  const guild = {
    channels: {
      cache: {
        get: jest.fn().mockReturnValue(channel),
      },
    },
  };

  const client = {
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
      return client;
    }),
    guilds: {
      cache: {
        get: jest.fn().mockReturnValue(guild),
      },
    },
  } as unknown as Client;

  return { client, handlers, send };
}

async function flushAsyncListeners(): Promise<void> {
  await new Promise<void>(resolve => setImmediate(resolve));
  await new Promise<void>(resolve => setImmediate(resolve));
}

describe('notificationPreferenceListener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettingsByGuildId.mockReset();
  });

  it('posts join notification when memberJoinNotifications is enabled', async () => {
    const { client, handlers, send } = createClientHarness();
    mockGetSettingsByGuildId.mockResolvedValue([
      {
        guildId: 'guild-1',
        notificationPreferences: {
          announcementChannelId: 'channel-1',
          memberJoinNotifications: true,
          enableMentionRolesToNotify: true,
          notificationMentionRoles: ['role-1', 'role-2'],
        },
      },
    ]);

    registerNotificationPreferenceListener(client);

    const member = {
      id: 'user-1',
      user: { bot: false, tag: 'Pilot#0001' },
      guild: { id: 'guild-1', name: 'Aurora' },
    } as unknown as GuildMember;

    handlers.guildMemberAdd(member);
    await flushAsyncListeners();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '<@&role-1> <@&role-2>',
        allowedMentions: { roles: ['role-1', 'role-2'] },
      })
    );
  });

  it('does not post join notification when memberJoinNotifications is disabled', async () => {
    const { client, handlers, send } = createClientHarness();
    mockGetSettingsByGuildId.mockResolvedValue([
      {
        guildId: 'guild-1',
        notificationPreferences: {
          announcementChannelId: 'channel-1',
          memberJoinNotifications: false,
        },
      },
    ]);

    registerNotificationPreferenceListener(client);

    const member = {
      id: 'user-1',
      user: { bot: false, tag: 'Pilot#0001' },
      guild: { id: 'guild-1', name: 'Aurora' },
    } as unknown as GuildMember;

    handlers.guildMemberAdd(member);
    await flushAsyncListeners();

    expect(send).not.toHaveBeenCalled();
  });

  it('posts leave notification when memberLeaveNotifications is enabled', async () => {
    const { client, handlers, send } = createClientHarness();
    mockGetSettingsByGuildId.mockResolvedValue([
      {
        guildId: 'guild-1',
        notificationPreferences: {
          announcementChannelId: 'channel-1',
          memberLeaveNotifications: true,
        },
      },
    ]);

    registerNotificationPreferenceListener(client);

    const member = {
      id: 'user-2',
      user: { tag: 'Departed#0002' },
      displayName: 'Departed',
      guild: { id: 'guild-1', name: 'Aurora' },
    } as unknown as PartialGuildMember;

    handlers.guildMemberRemove(member);
    await flushAsyncListeners();

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('posts role change notification when roleChangeNotifications is enabled and roles changed', async () => {
    const { client, handlers, send } = createClientHarness();
    mockGetSettingsByGuildId.mockResolvedValue([
      {
        guildId: 'guild-1',
        notificationPreferences: {
          announcementChannelId: 'channel-1',
          roleChangeNotifications: true,
        },
      },
    ]);

    registerNotificationPreferenceListener(client);

    const oldMember = {
      roles: { cache: new Map([['role-old', {}]]) },
      guild: { id: 'guild-1' },
    } as unknown as GuildMember;

    const newMember = {
      id: 'user-3',
      user: { tag: 'RoleSwap#0003' },
      guild: { id: 'guild-1', name: 'Aurora' },
      roles: { cache: new Map([['role-new', {}]]) },
    } as unknown as GuildMember;

    handlers.guildMemberUpdate(oldMember, newMember);
    await flushAsyncListeners();

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('uses trigger-specific channel when memberJoinChannelId is set', async () => {
    const { client, handlers, send } = createClientHarness();
    mockGetSettingsByGuildId.mockResolvedValue([
      {
        guildId: 'guild-1',
        notificationPreferences: {
          announcementChannelId: 'fallback-channel',
          memberJoinChannelId: 'join-specific-channel',
          memberJoinNotifications: true,
        },
      },
    ]);

    registerNotificationPreferenceListener(client);

    const member = {
      id: 'user-4',
      user: { bot: false, tag: 'NewPilot#0004' },
      guild: { id: 'guild-1', name: 'Aurora' },
    } as unknown as GuildMember;

    handlers.guildMemberAdd(member);
    await flushAsyncListeners();

    expect(send).toHaveBeenCalledTimes(1);
    // The guild channels.cache.get should have been called with the specific channel id
    const guildMock = (client.guilds.cache.get as jest.Mock).mock.results[0]?.value;
    expect(guildMock?.channels.cache.get).toHaveBeenCalledWith('join-specific-channel');
  });

  it('falls back to announcementChannelId when trigger-specific channelId is absent', async () => {
    const { client, handlers, send } = createClientHarness();
    mockGetSettingsByGuildId.mockResolvedValue([
      {
        guildId: 'guild-1',
        notificationPreferences: {
          announcementChannelId: 'fallback-channel',
          memberLeaveNotifications: true,
          // memberLeaveChannelId intentionally absent
        },
      },
    ]);

    registerNotificationPreferenceListener(client);

    const member = {
      id: 'user-5',
      user: { tag: 'LeftPilot#0005' },
      displayName: 'LeftPilot',
      guild: { id: 'guild-1', name: 'Aurora' },
    } as unknown as GuildMember;

    handlers.guildMemberRemove(member);
    await flushAsyncListeners();

    expect(send).toHaveBeenCalledTimes(1);
    const guildMock = (client.guilds.cache.get as jest.Mock).mock.results[0]?.value;
    expect(guildMock?.channels.cache.get).toHaveBeenCalledWith('fallback-channel');
  });

  it('skips posting when both trigger-specific channel and announcementChannelId are absent', async () => {
    const { client, handlers, send } = createClientHarness();
    mockGetSettingsByGuildId.mockResolvedValue([
      {
        guildId: 'guild-1',
        notificationPreferences: {
          // no announcementChannelId, no memberJoinChannelId
          memberJoinNotifications: true,
        },
      },
    ]);

    registerNotificationPreferenceListener(client);

    const member = {
      id: 'user-6',
      user: { bot: false, tag: 'Ghost#0006' },
      guild: { id: 'guild-1', name: 'Aurora' },
    } as unknown as GuildMember;

    handlers.guildMemberAdd(member);
    await flushAsyncListeners();

    expect(send).not.toHaveBeenCalled();
  });
});
