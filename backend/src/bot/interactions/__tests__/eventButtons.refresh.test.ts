import { MessageFlags } from 'discord.js';

const mockGetActivityById = jest.fn();
const mockGetParticipants = jest.fn();
const mockResolveDiscordIdMap = jest.fn();
const mockBuildEmbedDataFromActivity = jest.fn();
const mockBuildEventEmbed = jest.fn();
const mockBuildEventComponentRows = jest.fn();
const mockBuildMirroredEventEmbed = jest.fn();
const mockBuildMirroredEventComponents = jest.fn();
const mockPublishMirrorRefresh = jest.fn();

jest.mock('../eventButtons.services', () => ({
  getActivityService: jest.fn(() => ({
    getActivityById: (...args: unknown[]) => mockGetActivityById(...args),
  })),
  getParticipantService: jest.fn(() => ({
    getParticipants: (...args: unknown[]) => mockGetParticipants(...args),
  })),
}));

jest.mock('../eventButtons.embedData', () => ({
  buildEmbedDataFromActivity: (...args: unknown[]) => mockBuildEmbedDataFromActivity(...args),
  collectUserIdsForEmbed: jest.fn(() => ['user-1']),
  resolveDiscordIdMap: (...args: unknown[]) => mockResolveDiscordIdMap(...args),
}));

jest.mock('../../embeds/eventEmbed', () => ({
  buildEventEmbed: (...args: unknown[]) => mockBuildEventEmbed(...args),
  buildEventComponentRows: (...args: unknown[]) => mockBuildEventComponentRows(...args),
}));

jest.mock('../../embeds/mirroredEventMessage', () => ({
  buildMirroredEventEmbed: (...args: unknown[]) => mockBuildMirroredEventEmbed(...args),
  buildMirroredEventComponents: (...args: unknown[]) => mockBuildMirroredEventComponents(...args),
}));

jest.mock('../../mirrorSyncPublisher', () => ({
  publishMirrorRefresh: (...args: unknown[]) => mockPublishMirrorRefresh(...args),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

import { refreshEventEmbed, refreshEventEmbedFromChannel } from '../eventButtons.refresh';

describe('eventButtons.refresh mention-safe update flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetParticipants.mockResolvedValue([]);
    mockResolveDiscordIdMap.mockResolvedValue(new Map());
    mockBuildEmbedDataFromActivity.mockReturnValue({});
    mockBuildEventEmbed.mockReturnValue({ title: 'embed' });
    mockBuildEventComponentRows.mockReturnValue([]);
    mockBuildMirroredEventEmbed.mockResolvedValue({ title: 'mirror-embed' });
    mockBuildMirroredEventComponents.mockReturnValue(['mirror-components']);
  });

  it('refreshEventEmbed emits stale activity as ephemeral follow-up', async () => {
    const interaction = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce(null);

    await refreshEventEmbed(interaction as never, 'activity-1');

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: '⚠️ Activity no longer exists.',
      flags: MessageFlags.Ephemeral,
    });
    expect(mockPublishMirrorRefresh).not.toHaveBeenCalled();
  });

  it('refreshEventEmbed updates components and publishes mirror refresh without mentions', async () => {
    const interaction = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce({
      id: 'activity-1',
      status: 'scheduled',
    });

    await refreshEventEmbed(interaction as never, 'activity-1');

    expect(interaction.editReply).toHaveBeenCalledWith({
      embeds: [{ title: 'embed' }],
      components: [],
    });
    expect(mockPublishMirrorRefresh).toHaveBeenCalledWith('activity-1');
  });

  it('refreshEventEmbedFromChannel refreshes matching message and publishes mirror refresh', async () => {
    const edit = jest.fn().mockResolvedValue(undefined);
    const interaction = createChannelInteraction([
      {
        embeds: [{ footer: { text: 'ID: activity-1' } }],
        edit,
      },
    ]);

    mockGetActivityById.mockResolvedValueOnce({
      id: 'activity-1',
      status: 'open',
    });

    await refreshEventEmbedFromChannel(interaction as never, 'activity-1');

    expect(edit).toHaveBeenCalledWith({
      embeds: [{ title: 'embed' }],
      components: [],
    });
    expect(mockPublishMirrorRefresh).toHaveBeenCalledWith('activity-1');
  });

  it('refreshEventEmbedFromChannel exits quietly when no matching message exists', async () => {
    const interaction = createChannelInteraction([
      {
        embeds: [{ footer: { text: 'ID: activity-other' } }],
        edit: jest.fn().mockResolvedValue(undefined),
      },
    ]);

    await refreshEventEmbedFromChannel(interaction as never, 'activity-1');

    expect(mockGetActivityById).not.toHaveBeenCalled();
    expect(mockPublishMirrorRefresh).not.toHaveBeenCalled();
  });

  it('refreshEventEmbedFromChannel keeps mirrored styling for mirrored messages', async () => {
    const edit = jest.fn().mockResolvedValue(undefined);
    const interaction = createChannelInteraction([
      {
        embeds: [{ footer: { text: 'ID: activity-1  •  Mirror ID: mirror-123' } }],
        edit,
      },
    ]);

    mockGetActivityById.mockResolvedValueOnce({
      id: 'activity-1',
      status: 'open',
    });

    await refreshEventEmbedFromChannel(interaction as never, 'activity-1');

    expect(mockBuildMirroredEventEmbed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'activity-1' }),
      'mirror-123'
    );
    expect(edit).toHaveBeenCalledWith({
      embeds: [{ title: 'mirror-embed' }],
      components: ['mirror-components'],
    });
    expect(mockPublishMirrorRefresh).toHaveBeenCalledWith('activity-1');
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

function createButtonInteraction(): {
  followUp: jest.Mock;
  editReply: jest.Mock;
} {
  return {
    followUp: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}

function createChannelInteraction(
  messages: Array<{ embeds: Array<{ footer?: { text?: string } }>; edit: jest.Mock }>
): {
  channel: {
    messages: {
      fetch: jest.Mock;
    };
  };
} {
  return {
    channel: {
      messages: {
        fetch: jest.fn().mockResolvedValue(messages),
      },
    },
  };
}
