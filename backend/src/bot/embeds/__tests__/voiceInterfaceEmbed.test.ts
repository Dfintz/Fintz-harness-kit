import {
  type VoiceServerChannel,
  type VoiceServerStatus,
  type VoiceServerUser,
} from '@sc-fleet-manager/shared-types';

import {
  buildVoiceAutoCreateConfiguredEmbed,
  buildVoiceChannelCreatedEmbed,
  buildMumbleStatusEmbed,
  buildVoiceTemplatesEmbed,
  type VoiceTemplateSummary,
} from '../voiceInterfaceEmbed';

describe('buildVoiceTemplatesEmbed', () => {
  it('renders title/color/timestamp and one field per template', () => {
    const templates: VoiceTemplateSummary[] = [
      {
        id: 'gaming',
        name: 'Gaming',
        description: 'Play together',
        userLimit: 6,
        bitrate: 64000,
        autoDelete: true,
        autoDeleteDelay: 10,
      },
    ];

    const embed = buildVoiceTemplatesEmbed(templates);

    expect(embed.data.color).toBe(0x0099ff);
    expect(embed.data.title).toBe('Available Voice Channel Templates');
    expect(embed.data.timestamp).toBeDefined();
    expect(embed.data.fields).toHaveLength(1);
    expect(embed.data.fields?.[0]?.name).toBe('Gaming (gaming)');
    expect(embed.data.fields?.[0]?.value).toBe(
      ['Play together', 'Limit: 6', 'Bitrate: 64 kbps', 'Auto-Delete: 10min'].join('\n')
    );
  });

  it('formats unlimited/no auto-delete and supports empty template list', () => {
    const single: VoiceTemplateSummary[] = [
      {
        id: 'default',
        name: 'Default',
        description: 'Default room',
        userLimit: 0,
        bitrate: 96000,
        autoDelete: false,
        autoDeleteDelay: 0,
      },
    ];

    const embed = buildVoiceTemplatesEmbed(single);
    expect(embed.data.fields?.[0]?.value).toBe(
      ['Default room', 'Limit: Unlimited', 'Bitrate: 96 kbps', 'Auto-Delete: No'].join('\n')
    );

    const emptyEmbed = buildVoiceTemplatesEmbed([]);
    expect(emptyEmbed.data.fields).toBeUndefined();
  });
});

describe('buildVoiceChannelCreatedEmbed', () => {
  it('renders create success contract with auto-delete field', () => {
    const expiresAt = new Date('2026-06-24T10:00:00.000Z');

    const embed = buildVoiceChannelCreatedEmbed({
      channelName: 'Alpha Wing',
      templateName: 'Gaming',
      channelId: '1234567890123',
      userLimit: 4,
      bitrate: 64000,
      expiresAt,
    });

    expect(embed.data.color).toBe(0x00ff00);
    expect(embed.data.title).toBeUndefined();
    expect(embed.data.timestamp).toBeUndefined();
    expect(embed.data.footer).toBeUndefined();
    expect(embed.data.description).toBe('\u2705 Created **Alpha Wing** from **Gaming** template');
    expect(embed.data.fields).toEqual([
      { name: 'Channel', value: '<#1234567890123>', inline: true },
      { name: 'User Limit', value: '4', inline: true },
      { name: 'Bitrate', value: '64 kbps', inline: true },
      {
        name: 'Auto-Delete',
        value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
      },
    ]);
  });

  it('formats unlimited user limit and omits auto-delete when expiresAt is missing', () => {
    const embed = buildVoiceChannelCreatedEmbed({
      channelName: 'Default Room',
      templateName: 'Default',
      channelId: '456',
      userLimit: 0,
      bitrate: 96000,
    });

    expect(embed.data.fields).toEqual([
      { name: 'Channel', value: '<#456>', inline: true },
      { name: 'User Limit', value: 'Unlimited', inline: true },
      { name: 'Bitrate', value: '96 kbps', inline: true },
    ]);
  });
});

describe('buildVoiceAutoCreateConfiguredEmbed', () => {
  it('renders configured embed contract with category mention', () => {
    const embed = buildVoiceAutoCreateConfiguredEmbed({
      hubChannelId: '111',
      parentCategoryId: '222',
      maxChannels: 10,
    });

    expect(embed.data.color).toBe(0x00ff00);
    expect(embed.data.title).toBe('\u2705 Voice Auto-Create Configured');
    expect(embed.data.description).toBe(
      'Users who join the hub channel will get a temporary voice channel.'
    );
    expect(embed.data.timestamp).toBeDefined();
    expect(embed.data.fields).toEqual([
      { name: 'Hub Channel', value: '<#111>', inline: true },
      { name: 'Category', value: '<#222>', inline: true },
      { name: 'Max Channels', value: '10', inline: true },
    ]);
  });

  it('falls back category to Guild root when parent category is missing', () => {
    const embed = buildVoiceAutoCreateConfiguredEmbed({
      hubChannelId: '333',
      maxChannels: 25,
    });

    expect(embed.data.fields).toEqual([
      { name: 'Hub Channel', value: '<#333>', inline: true },
      { name: 'Category', value: 'Guild root', inline: true },
      { name: 'Max Channels', value: '25', inline: true },
    ]);
  });
});

describe('buildMumbleStatusEmbed', () => {
  const makeUser = (displayName: string, channelId: number): VoiceServerUser => ({
    displayName,
    channelId,
    isMuted: false,
    isDeafened: false,
    onlineSince: '2026-06-24T10:00:00.000Z',
  });

  const makeChannel = (
    id: number,
    name: string,
    userCount: number,
    users?: VoiceServerUser[]
  ): VoiceServerChannel => ({
    id,
    name,
    parentId: null,
    userCount,
    users,
  });

  it('renders online contract with users/channels/connect/footer', () => {
    const status: VoiceServerStatus = {
      online: true,
      currentUsers: 3,
      maxUsers: 20,
      channels: [
        makeChannel(1, 'General', 2, [makeUser('Alpha', 1), makeUser('Bravo', 1)]),
        makeChannel(2, 'Ops', 1),
      ],
    };

    const embed = buildMumbleStatusEmbed(status, true, {
      connectUrl: 'mumble://voice.example.com',
      serverType: 'mumble',
      displayName: 'Platform Voice',
    });

    expect(embed.data.title).toBe('🎧 Platform Voice');
    expect(embed.data.color).toBeDefined();
    expect(embed.data.timestamp).toBeDefined();
    expect(embed.data.fields).toEqual([
      { name: 'Status', value: '🟢 **Online**', inline: true },
      { name: 'Users', value: '**3** / 20', inline: true },
      { name: 'Access', value: '✅ You have access', inline: true },
      { name: 'Channels', value: '📁 General (2 users)\n📁 Ops (1 user)' },
      { name: 'Connect', value: '`mumble://voice.example.com`' },
    ]);
    expect(embed.data.footer?.text).toBe('MUMBLE • Updated');
  });

  it('caps channels list to first 10 entries', () => {
    const status: VoiceServerStatus = {
      online: true,
      currentUsers: 12,
      maxUsers: 64,
      channels: Array.from({ length: 12 }, (_, idx) => makeChannel(idx + 1, `Room ${idx + 1}`, 0)),
    };

    const embed = buildMumbleStatusEmbed(status, true, {
      connectUrl: 'mumble://voice.example.com',
    });

    const channelsField = embed.data.fields?.find(field => field.name === 'Channels');
    expect(channelsField).toBeDefined();
    const lines = channelsField?.value?.split('\n') ?? [];
    expect(lines).toHaveLength(10);
    expect(lines[0]).toBe('📁 Room 1');
    expect(lines[9]).toBe('📁 Room 10');
    expect(lines.some(line => line.includes('Room 11'))).toBe(false);
  });

  it('suppresses connect field when online but access is denied', () => {
    const status: VoiceServerStatus = {
      online: true,
      currentUsers: 1,
      maxUsers: 20,
      channels: [makeChannel(1, 'General', 1, [makeUser('Pilot', 1)])],
    };

    const embed = buildMumbleStatusEmbed(status, false, {
      connectUrl: 'mumble://voice.example.com',
      serverType: 'mumble',
      displayName: 'Platform Voice',
    });

    expect(embed.data.fields?.find(field => field.name === 'Users')).toBeDefined();
    expect(embed.data.fields?.find(field => field.name === 'Connect')).toBeUndefined();
    expect(embed.data.fields?.find(field => field.name === 'Access')?.value).toBe(
      '⚠️ Federation membership required'
    );
  });

  it('renders offline contract with fallback display name and no users/channels/connect fields', () => {
    const embed = buildMumbleStatusEmbed(null, false, {});

    expect(embed.data.title).toBe('🎧 Platform Voice Server');
    expect(embed.data.color).toBeDefined();
    expect(embed.data.fields).toEqual([
      { name: 'Status', value: '🔴 **Offline**', inline: true },
      { name: 'Access', value: '⚠️ Federation membership required', inline: true },
    ]);
    expect(embed.data.footer?.text).toBe('MUMBLE • Updated');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
