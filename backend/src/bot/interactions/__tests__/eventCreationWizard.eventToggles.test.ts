import {
  handleWizardButton,
  handleWizardModal,
  handleWizardSelectMenu,
  launchEventCreationWizard,
} from '../eventCreationWizard';

const mockCreateActivity = jest.fn();
const mockUpdateActivity = jest.fn();
const mockGetParticipants = jest.fn();
const mockResolveOrganization = jest.fn();
const mockGetUserByDiscordId = jest.fn();
const mockGetSettings = jest.fn();
const mockCreateDiscordEvent = jest.fn();
const mockBuildEventEmbed = jest.fn().mockReturnValue({});
const mockBuildEventComponentRows = jest.fn().mockReturnValue([]);
const mockCreateEventTempVoiceChannel = jest.fn();

jest.mock('../../../services/activity', () => ({
  ActivityService: jest.fn().mockImplementation(() => ({
    createActivity: (...args: unknown[]) => mockCreateActivity(...args),
    updateActivity: (...args: unknown[]) => mockUpdateActivity(...args),
  })),
  ActivityParticipantService: jest.fn().mockImplementation(() => ({
    getParticipants: (...args: unknown[]) => mockGetParticipants(...args),
  })),
}));

jest.mock('../../../services/discord/GuildOrganizationService', () => ({
  GuildOrganizationService: {
    getInstance: () => ({
      resolveOrganization: (...args: unknown[]) => mockResolveOrganization(...args),
    }),
  },
}));

jest.mock('../../../services/user/UserService', () => ({
  UserService: jest.fn().mockImplementation(() => ({
    getUserByDiscordId: (...args: unknown[]) => mockGetUserByDiscordId(...args),
  })),
}));

jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
  },
}));

jest.mock('../../../services/discord/DiscordEventService', () => ({
  DiscordEventService: {
    getInstance: () => ({
      createEvent: (...args: unknown[]) => mockCreateDiscordEvent(...args),
    }),
  },
}));

jest.mock('../../embeds/eventEmbed', () => ({
  buildEventEmbed: (...args: unknown[]) => mockBuildEventEmbed(...args),
  buildEventComponentRows: (...args: unknown[]) => mockBuildEventComponentRows(...args),
}));

jest.mock('../../voice/voiceAutoCreate', () => ({
  createEventTempVoiceChannel: (...args: unknown[]) => mockCreateEventTempVoiceChannel(...args),
}));

interface FlowResult {
  readonly sentMessageStartThread: jest.Mock;
  readonly sentChannelSend: jest.Mock;
}

interface RunFlowOptions {
  readonly userId: string;
  readonly createDiscordEvent: boolean;
  readonly createEventThread: boolean;
  readonly voiceMode?: 'none' | 'current' | 'temp';
  readonly currentVoiceChannel?: { id: string; name: string } | null;
  readonly tempVoiceChannel?: { channelId: string; channelName: string } | null;
}

function makeLaunchInteraction(userId: string) {
  return {
    guildId: 'guild-1',
    channelId: 'channel-1',
    user: { id: userId, username: 'WizardUser' },
    member: undefined,
    reply: jest.fn().mockResolvedValue(undefined),
  } as const;
}

function makeModalInteraction(userId: string, customId: string, values: Record<string, string>) {
  return {
    customId,
    guildId: 'guild-1',
    user: { id: userId, username: 'WizardUser' },
    fields: {
      getTextInputValue: (fieldId: string) => values[fieldId] ?? '',
    },
    reply: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    isModalSubmit: () => true,
  } as const;
}

function makeSelectInteraction(userId: string, customId: string, values: string[]) {
  return {
    customId,
    guildId: 'guild-1',
    user: { id: userId, username: 'WizardUser' },
    values,
    reply: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    showModal: jest.fn().mockResolvedValue(undefined),
  } as const;
}

function makeFinishInteraction(
  userId: string,
  sentMessageStartThread: jest.Mock,
  options?: { currentVoiceChannel?: { id: string; name: string } | null }
) {
  const sentChannelSend = jest.fn().mockResolvedValue({
    startThread: sentMessageStartThread,
    crosspost: jest.fn().mockResolvedValue(undefined),
  });

  const channel = {
    isTextBased: () => true,
    send: sentChannelSend,
    type: 0,
  };

  return {
    interaction: {
      customId: 'event_wiz_finish',
      guildId: 'guild-1',
      user: { id: userId, username: 'WizardUser' },
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      guild: {
        channels: {
          cache: {
            get: jest.fn().mockReturnValue(channel),
          },
        },
        members: {
          cache: {
            get: jest.fn().mockReturnValue({
              id: userId,
              voice: { channel: options?.currentVoiceChannel ?? undefined },
            }),
          },
        },
      },
    },
    sentChannelSend,
  } as const;
}

async function runWizardFinishFlow(options: RunFlowOptions): Promise<FlowResult> {
  mockResolveOrganization.mockResolvedValue('org-1');
  mockGetUserByDiscordId.mockResolvedValue({ id: 'internal-user-1', username: 'InternalUser' });
  mockGetParticipants.mockResolvedValue([]);
  mockGetSettings.mockResolvedValue({
    eventSettings: {
      createDiscordEvent: options.createDiscordEvent,
      createEventThread: options.createEventThread,
      eventAnnouncementChannelId: 'channel-announce',
      enableEventMentions: false,
      autoPublishAnnouncements: false,
    },
  });

  mockCreateActivity.mockResolvedValue({
    id: `activity-${options.userId}`,
    title: 'Wizard Event',
    activityType: 'event',
    status: 'open',
    description: 'Event from wizard',
    location: 'Area 18',
    scheduledStartDate: new Date('2026-06-07T20:00:00.000Z'),
    createdAt: new Date('2026-06-05T20:00:00.000Z'),
  });

  mockUpdateActivity.mockResolvedValue(undefined);
  mockCreateDiscordEvent.mockResolvedValue(options.createDiscordEvent ? 'discord-event-1' : null);
  mockCreateEventTempVoiceChannel.mockResolvedValue(options.tempVoiceChannel ?? undefined);

  const launchInteraction = makeLaunchInteraction(options.userId);
  await launchEventCreationWizard(launchInteraction as never);

  const titleModal = makeModalInteraction(options.userId, 'event_wiz_modal_title', {
    event_wiz_input_title: 'Wizard Event',
  });
  await handleWizardModal(titleModal as never);

  const dateModal = makeModalInteraction(options.userId, 'event_wiz_modal_datetime', {
    event_wiz_input_date: '2026-06-07',
    event_wiz_input_time: '20:00',
  });
  await handleWizardModal(dateModal as never);

  if (options.voiceMode === 'current') {
    const selectInteraction = makeSelectInteraction(options.userId, 'event_wiz_select_voice_mode', [
      'current',
    ]);
    await handleWizardSelectMenu(selectInteraction as never);
  }

  if (options.voiceMode === 'temp') {
    const selectInteraction = makeSelectInteraction(options.userId, 'event_wiz_select_voice_mode', [
      'temp',
    ]);
    await handleWizardSelectMenu(selectInteraction as never);

    const voiceModal = makeModalInteraction(options.userId, 'event_wiz_modal_voice', {
      event_wiz_input_voicelimit: '8',
    });
    await handleWizardModal(voiceModal as never);
  }

  const sentMessageStartThread = jest.fn().mockResolvedValue(undefined);
  const { interaction: finishInteraction, sentChannelSend } = makeFinishInteraction(
    options.userId,
    sentMessageStartThread,
    { currentVoiceChannel: options.currentVoiceChannel }
  );

  await handleWizardButton(finishInteraction as never);

  return { sentMessageStartThread, sentChannelSend };
}

describe('eventCreationWizard toggle regressions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateEventTempVoiceChannel.mockResolvedValue(undefined);
  });

  it('resumes an active draft when launch is invoked again by the same user', async () => {
    const userId = 'resume-user-1';

    const firstLaunch = makeLaunchInteraction(userId);
    await launchEventCreationWizard(firstLaunch as never);

    const titleModal = makeModalInteraction(userId, 'event_wiz_modal_title', {
      event_wiz_input_title: 'Resumable Draft Title',
    });
    await handleWizardModal(titleModal as never);

    const secondLaunch = makeLaunchInteraction(userId);
    await launchEventCreationWizard(secondLaunch as never);

    const secondReply = secondLaunch.reply.mock.calls[0]?.[0] as {
      readonly content?: string;
      readonly embeds?: Array<{
        toJSON: () => { fields?: Array<{ name?: string; value?: string }> };
      }>;
    };

    expect(secondReply?.content).toContain('Resumed your existing event draft');
    const fields = secondReply.embeds?.[0]?.toJSON().fields ?? [];
    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Title',
          value: 'Resumable Draft Title',
        }),
      ])
    );
  });

  it('creates a Discord scheduled event when createDiscordEvent is enabled', async () => {
    await runWizardFinishFlow({
      userId: 'discord-user-1',
      createDiscordEvent: true,
      createEventThread: false,
    });

    expect(mockCreateDiscordEvent).toHaveBeenCalledTimes(1);
    expect(mockCreateDiscordEvent).toHaveBeenCalledWith(
      'guild-1',
      expect.objectContaining({
        title: 'Wizard Event',
        participantCount: 1,
      })
    );
    expect(mockCreateDiscordEvent.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        participantCap: undefined,
      })
    );
  });

  it('does not create a Discord scheduled event when createDiscordEvent is disabled', async () => {
    await runWizardFinishFlow({
      userId: 'discord-user-2',
      createDiscordEvent: false,
      createEventThread: false,
    });

    expect(mockCreateDiscordEvent).not.toHaveBeenCalled();
  });

  it('creates an event discussion thread when createEventThread is enabled', async () => {
    const flow = await runWizardFinishFlow({
      userId: 'discord-user-3',
      createDiscordEvent: false,
      createEventThread: true,
    });

    expect(flow.sentChannelSend).toHaveBeenCalledTimes(1);
    expect(flow.sentMessageStartThread).toHaveBeenCalledTimes(1);
  });

  it('does not create an event discussion thread when createEventThread is disabled', async () => {
    const flow = await runWizardFinishFlow({
      userId: 'discord-user-4',
      createDiscordEvent: false,
      createEventThread: false,
    });

    expect(flow.sentChannelSend).toHaveBeenCalledTimes(1);
    expect(flow.sentMessageStartThread).not.toHaveBeenCalled();
  });

  it('links the creator current voice channel when current voice mode is selected', async () => {
    await runWizardFinishFlow({
      userId: 'voice-user-1',
      createDiscordEvent: false,
      createEventThread: false,
      voiceMode: 'current',
      currentVoiceChannel: { id: 'voice-123', name: 'Ready Room' },
    });

    expect(mockCreateEventTempVoiceChannel).not.toHaveBeenCalled();
    expect(mockUpdateActivity).toHaveBeenCalledWith(
      'activity-voice-user-1',
      expect.objectContaining({
        voiceChannelId: 'voice-123',
        voiceChannelName: 'Ready Room',
        voiceChannel: expect.objectContaining({
          channelId: 'voice-123',
          autoCreate: false,
          autoDelete: false,
        }),
      })
    );
  });

  it('creates a temporary event voice channel when temp voice mode is selected', async () => {
    await runWizardFinishFlow({
      userId: 'voice-user-2',
      createDiscordEvent: false,
      createEventThread: false,
      voiceMode: 'temp',
      tempVoiceChannel: { channelId: 'temp-voice-1', channelName: 'Raid VC' },
    });

    expect(mockCreateEventTempVoiceChannel).toHaveBeenCalledTimes(1);
    expect(mockUpdateActivity).toHaveBeenCalledWith(
      'activity-voice-user-2',
      expect.objectContaining({
        voiceChannelId: 'temp-voice-1',
        voiceChannelName: expect.any(String),
        voiceChannel: expect.objectContaining({
          channelId: 'temp-voice-1',
          autoCreate: true,
          autoDelete: true,
        }),
      })
    );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
