import { VoiceChannelType } from '../../../types';

const createChannelMock = jest.fn();
const deleteByDiscordIdMock = jest.fn();
const getGuildChannelsMock = jest.fn().mockReturnValue([]);
const checkBotGuildPermissionsMock = jest.fn().mockReturnValue(true);

jest.mock('../../../services/communication', () => ({
  VoiceChannelService: {
    getInstance: () => ({
      createChannel: createChannelMock,
      deleteByDiscordId: deleteByDiscordIdMock,
      getGuildChannels: getGuildChannelsMock,
    }),
  },
}));

jest.mock('../../utils/discord', () => ({
  checkBotGuildPermissions: (...args: unknown[]) => checkBotGuildPermissionsMock(...args),
}));

jest.mock('../../embeds/voiceInterfaceEmbed', () => ({
  buildVoiceControlButtons: jest.fn(),
  buildVoiceExtendedButtons: jest.fn(),
  buildVoiceInterfaceEmbed: jest.fn(),
  buildVoiceModerationButtons: jest.fn(),
}));

jest.mock('../lfgLobbyHandler', () => ({
  handleLfgLobbyJoin: jest.fn().mockResolvedValue(undefined),
}));

import { bootstrapHubMembers, getChannelOwner, getDynamicChannels } from '../voiceAutoCreate';

describe('voiceAutoCreate move-failure cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getDynamicChannels().clear();
  });

  it('removes tracking and VoiceChannelService record when moving the creator fails', async () => {
    const tempChannel = {
      id: 'temp-1',
      name: 'Temp VC',
      delete: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue(undefined),
      isVoiceBased: () => true,
    };

    createChannelMock.mockReturnValue({
      id: 'svc-1',
      channelId: 'temp-1',
      type: VoiceChannelType.DYNAMIC,
      createdAt: new Date(),
    });

    const member = {
      id: 'user-1',
      displayName: 'Pilot One',
      user: { username: 'pilot-one' },
      presence: { activities: [] },
      voice: {
        setChannel: jest.fn().mockRejectedValue(new Error('disconnect during move')),
      },
    };

    const hubChannel = {
      id: 'hub-1',
      parentId: undefined,
      members: new Map([['user-1', member]]),
      permissionOverwrites: { cache: new Map() },
      isVoiceBased: () => true,
    };

    const guild = {
      id: 'guild-1',
      name: 'Guild One',
      members: { me: { id: 'bot-1' } },
      channels: {
        cache: new Map([['hub-1', hubChannel]]),
        create: jest.fn().mockResolvedValue(tempChannel),
      },
    };

    const created = await bootstrapHubMembers(
      guild as never,
      {
        autoCreateChannels: true,
        hubChannelId: 'hub-1',
        channelNameTemplate: '{nickname} Room',
      } as never
    );

    expect(created).toBe(0);
    expect(deleteByDiscordIdMock).toHaveBeenCalledWith('temp-1');
    expect(tempChannel.delete).toHaveBeenCalledWith('User disconnected before move');
    expect(getDynamicChannels().has('temp-1')).toBe(false);
    expect(getChannelOwner('temp-1')).toBeUndefined();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
