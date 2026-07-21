import type { Client } from 'discord.js';

import type { DiscordGuildSettings } from '../../../models/DiscordGuildSettings';
import { domainEvents } from '../../../services/shared/DomainEventBus';
import { registerActivityAnnouncementListeners } from '../activityListener';

const mockGetOrganizationSettings = jest.fn();
const mockCreateEvent = jest.fn();
const mockGetOrgVoiceConfig = jest.fn().mockResolvedValue(null);
const mockPublishMirrorRefresh = jest.fn();
const mockGetUserById = jest.fn();
const mockCreateEventTempVoiceChannel = jest.fn();
const mockActivityUpdate = jest.fn();

jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {
    getOrganizationSettings: (...args: unknown[]) => mockGetOrganizationSettings(...args),
  },
}));

jest.mock('../../../services/discord/DiscordEventService', () => ({
  DiscordEventService: {
    getInstance: () => ({
      createEvent: (...args: unknown[]) => mockCreateEvent(...args),
    }),
  },
}));

jest.mock('../../../services/user/UserService', () => ({
  UserService: jest.fn().mockImplementation(() => ({
    getUserById: (...args: unknown[]) => mockGetUserById(...args),
  })),
}));

jest.mock('../../../services/communication/voice/VoiceServerService', () => ({
  VoiceServerService: {
    getInstance: () => ({
      getOrgVoiceConfig: (...args: unknown[]) => mockGetOrgVoiceConfig(...args),
    }),
  },
}));

jest.mock('../../mirrorSyncPublisher', () => ({
  publishMirrorRefresh: (...args: unknown[]) => mockPublishMirrorRefresh(...args),
}));

jest.mock('../../voice/voiceAutoCreate', () => ({
  createEventTempVoiceChannel: (...args: unknown[]) => mockCreateEventTempVoiceChannel(...args),
}));

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    isInitialized: true,
    getRepository: jest.fn(() => ({
      update: (...args: unknown[]) => mockActivityUpdate(...args),
      findOne: jest.fn().mockResolvedValue(null),
    })),
  },
}));

interface Harness {
  readonly client: Client;
  readonly send: jest.Mock;
  readonly startThread: jest.Mock;
}

function createClientHarness(): Harness {
  const startThread = jest.fn().mockResolvedValue({});
  const crosspost = jest.fn().mockResolvedValue({});
  const send = jest.fn().mockResolvedValue({ startThread, crosspost });

  const channel = {
    isTextBased: () => true,
    send,
    type: 0,
  };

  const activeVoiceChannel = {
    id: 'voice-1',
    name: 'Ready Room',
  };

  const member = {
    id: 'discord-user-1',
    displayName: 'Discord Pilot',
    voice: {
      channel: activeVoiceChannel,
    },
  };

  const guild = {
    channels: {
      cache: {
        get: jest.fn().mockReturnValue(channel),
      },
    },
    members: {
      cache: {
        get: jest.fn().mockReturnValue(member),
      },
      fetch: jest.fn().mockResolvedValue(member),
    },
  };

  const client = {
    guilds: {
      cache: {
        get: jest.fn().mockReturnValue(guild),
      },
    },
  } as unknown as Client;

  return { client, send, startThread };
}

async function flushAsyncListeners(): Promise<void> {
  await new Promise<void>(resolve => setImmediate(resolve));
  await new Promise<void>(resolve => setImmediate(resolve));
}

describe('activityListener event toggle regressions', () => {
  beforeEach(() => {
    domainEvents.removeAllListeners();
    jest.clearAllMocks();
    mockGetOrganizationSettings.mockReset();
    mockCreateEvent.mockReset();
    mockGetOrgVoiceConfig.mockResolvedValue(null);
    mockGetUserById.mockResolvedValue({ id: 'user-1', discordId: 'discord-user-1' });
    mockCreateEventTempVoiceChannel.mockResolvedValue(undefined);
    mockActivityUpdate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    domainEvents.removeAllListeners();
  });

  it('auto-creates Discord scheduled events when enabled even without announcement channel', async () => {
    const { client, send } = createClientHarness();

    const orgSettings = [
      {
        guildId: 'guild-1',
        eventSettings: {
          createDiscordEvent: true,
        },
      },
    ] as unknown as DiscordGuildSettings[];

    mockGetOrganizationSettings.mockResolvedValue(orgSettings);
    mockCreateEvent.mockResolvedValue(null);

    registerActivityAnnouncementListeners(client);

    domainEvents.emit('activity:created', {
      activityId: 'activity-1',
      organizationId: 'org-1',
      activityType: 'event',
      title: 'Alpha Operation',
      hostUserId: 'host-1',
      scheduledAt: new Date('2026-06-05T20:00:00.000Z').toISOString(),
      maxParticipants: 12,
      timestamp: new Date('2026-06-05T19:00:00.000Z').toISOString(),
    });

    await flushAsyncListeners();

    expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    expect(mockCreateEvent).toHaveBeenCalledWith(
      'guild-1',
      expect.objectContaining({
        title: 'Alpha Operation',
        participantCount: 1,
        participantCap: 12,
      })
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('suppresses announcements when notificationPreferences.eventNotifications is disabled', async () => {
    const { client, send } = createClientHarness();

    const orgSettings = [
      {
        guildId: 'guild-1',
        eventSettings: {
          eventAnnouncementChannelId: 'channel-1',
          createDiscordEvent: false,
        },
        notificationPreferences: {
          eventNotifications: false,
        },
      },
    ] as unknown as DiscordGuildSettings[];

    mockGetOrganizationSettings.mockResolvedValue(orgSettings);

    registerActivityAnnouncementListeners(client);

    domainEvents.emit('activity:created', {
      activityId: 'activity-2a',
      organizationId: 'org-1',
      activityType: 'event',
      title: 'Silent Operation',
      hostUserId: 'host-1',
      scheduledAt: new Date('2026-06-05T20:00:00.000Z').toISOString(),
      timestamp: new Date('2026-06-05T19:00:00.000Z').toISOString(),
    });

    await flushAsyncListeners();

    expect(send).not.toHaveBeenCalled();
  });

  it('creates an announcement thread when createEventThread is enabled', async () => {
    const { client, send, startThread } = createClientHarness();

    const orgSettings = [
      {
        guildId: 'guild-1',
        eventSettings: {
          eventAnnouncementChannelId: 'channel-1',
          createEventThread: true,
          createDiscordEvent: false,
        },
      },
    ] as unknown as DiscordGuildSettings[];

    mockGetOrganizationSettings.mockResolvedValue(orgSettings);

    registerActivityAnnouncementListeners(client);

    domainEvents.emit('activity:created', {
      activityId: 'activity-2',
      organizationId: 'org-1',
      activityType: 'event',
      title: 'Bravo Operation',
      hostUserId: 'host-1',
      scheduledAt: new Date('2026-06-05T20:00:00.000Z').toISOString(),
      timestamp: new Date('2026-06-05T19:00:00.000Z').toISOString(),
    });

    await flushAsyncListeners();

    expect(send).toHaveBeenCalledTimes(1);
    expect(startThread).toHaveBeenCalledTimes(1);
  });

  it('does not create an announcement thread when createEventThread is disabled', async () => {
    const { client, send, startThread } = createClientHarness();

    const orgSettings = [
      {
        guildId: 'guild-1',
        eventSettings: {
          eventAnnouncementChannelId: 'channel-1',
          createEventThread: false,
          createDiscordEvent: false,
        },
      },
    ] as unknown as DiscordGuildSettings[];

    mockGetOrganizationSettings.mockResolvedValue(orgSettings);

    registerActivityAnnouncementListeners(client);

    domainEvents.emit('activity:created', {
      activityId: 'activity-3',
      organizationId: 'org-1',
      activityType: 'event',
      title: 'Charlie Operation',
      hostUserId: 'host-1',
      scheduledAt: new Date('2026-06-05T20:00:00.000Z').toISOString(),
      timestamp: new Date('2026-06-05T19:00:00.000Z').toISOString(),
    });

    await flushAsyncListeners();

    expect(send).toHaveBeenCalledTimes(1);
    expect(startThread).not.toHaveBeenCalled();
  });

  it('links the creator active Discord voice channel for web-created current mode events', async () => {
    const { client } = createClientHarness();

    const orgSettings = [
      {
        guildId: 'guild-1',
        eventSettings: {
          createDiscordEvent: false,
        },
      },
    ] as unknown as DiscordGuildSettings[];

    mockGetOrganizationSettings.mockResolvedValue(orgSettings);

    registerActivityAnnouncementListeners(client);

    domainEvents.emit('activity:created', {
      activityId: 'activity-current',
      organizationId: 'org-1',
      activityType: 'event',
      title: 'Current Voice Event',
      hostUserId: 'user-1',
      voiceChannelMode: 'current',
      scheduledAt: new Date('2026-06-05T20:00:00.000Z').toISOString(),
      timestamp: new Date('2026-06-05T19:00:00.000Z').toISOString(),
    });

    await flushAsyncListeners();

    expect(mockCreateEventTempVoiceChannel).not.toHaveBeenCalled();
    expect(mockActivityUpdate).toHaveBeenCalledWith(
      { id: 'activity-current' },
      expect.objectContaining({
        voiceChannelId: 'voice-1',
        voiceChannelName: 'Ready Room',
      })
    );
  });

  it('creates and links a temp Discord voice channel for web-created temp mode events', async () => {
    const { client } = createClientHarness();

    const orgSettings = [
      {
        guildId: 'guild-1',
        eventSettings: {
          createDiscordEvent: false,
          eventVoiceCategoryId: 'category-1',
        },
      },
    ] as unknown as DiscordGuildSettings[];

    mockGetOrganizationSettings.mockResolvedValue(orgSettings);
    mockCreateEventTempVoiceChannel.mockResolvedValue({
      channelId: 'temp-voice-1',
      channelName: 'Raid Voice',
    });

    registerActivityAnnouncementListeners(client);

    domainEvents.emit('activity:created', {
      activityId: 'activity-temp',
      organizationId: 'org-1',
      activityType: 'event',
      title: 'Temp Voice Event',
      hostUserId: 'user-1',
      voiceChannelMode: 'temp',
      voiceChannelLimit: 8,
      scheduledAt: new Date('2026-06-05T20:00:00.000Z').toISOString(),
      estimatedDuration: 120,
      timestamp: new Date('2026-06-05T19:00:00.000Z').toISOString(),
    });

    await flushAsyncListeners();

    expect(mockCreateEventTempVoiceChannel).toHaveBeenCalledTimes(1);
    expect(mockActivityUpdate).toHaveBeenCalledWith(
      { id: 'activity-temp' },
      expect.objectContaining({
        voiceChannelId: 'temp-voice-1',
        voiceChannelName: 'Raid Voice',
      })
    );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
