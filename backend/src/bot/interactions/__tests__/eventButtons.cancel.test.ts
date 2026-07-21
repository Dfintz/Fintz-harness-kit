import { ButtonStyle, MessageFlags } from 'discord.js';

const mockGetActivityById = jest.fn();
const mockGetParticipants = jest.fn();
const mockResolveInternalUserId = jest.fn();
const mockResolveDiscordIdMap = jest.fn();
const mockBuildEmbedDataFromActivity = jest.fn();
const mockBuildEventEmbed = jest.fn();
const mockPublishMirrorRefresh = jest.fn();
const mockLogAuditEvent = jest.fn();
const mockCancelActivity = jest.fn();

jest.mock('../eventButtons.services', () => ({
  getActivityService: jest.fn(() => ({
    getActivityById: mockGetActivityById,
  })),
  getParticipantService: jest.fn(() => ({
    getParticipants: mockGetParticipants,
  })),
}));

jest.mock('../eventButtons.identity', () => ({
  resolveInternalUserId: (...args: unknown[]) => mockResolveInternalUserId(...args),
}));

jest.mock('../eventButtons.embedData', () => ({
  buildEmbedDataFromActivity: (...args: unknown[]) => mockBuildEmbedDataFromActivity(...args),
  collectUserIdsForEmbed: jest.fn(() => ['user-1']),
  resolveDiscordIdMap: (...args: unknown[]) => mockResolveDiscordIdMap(...args),
}));

jest.mock('../../embeds/eventEmbed', () => ({
  buildEventEmbed: (...args: unknown[]) => mockBuildEventEmbed(...args),
}));

jest.mock('../../mirrorSyncPublisher', () => ({
  publishMirrorRefresh: (...args: unknown[]) => mockPublishMirrorRefresh(...args),
}));

jest.mock('../../../utils/auditLogger', () => ({
  AuditEventType: {
    ACTIVITY_ACTION: 'ACTIVITY_ACTION',
  },
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

jest.mock('../../../services/activity/ActivityEventService', () => ({
  ActivityEventService: jest.fn().mockImplementation(() => ({
    cancelActivity: (...args: unknown[]) => mockCancelActivity(...args),
  })),
}));

import {
  handleCancelEvent,
  handleCancelEventDismiss,
  handleCancelEventPrompt,
} from '../eventButtons.cancel';

describe('eventButtons.cancel seam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveInternalUserId.mockResolvedValue('internal-1');
    mockResolveDiscordIdMap.mockResolvedValue(new Map());
    mockBuildEmbedDataFromActivity.mockReturnValue({});
    mockBuildEventEmbed.mockReturnValue({ title: 'embed' });
    mockGetParticipants.mockResolvedValue([]);
    mockCancelActivity.mockResolvedValue(undefined);
  });

  it('prompt path builds confirm and dismiss ids exactly', async () => {
    const interaction = createButtonInteraction();

    await handleCancelEventPrompt(interaction as never, 'act-123');

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.flags).toBe(MessageFlags.Ephemeral);

    const [confirm, cancel] = buttonsFromReply(payload);
    expect(confirm.custom_id).toBe('event_confirmcancel_act-123');
    expect(confirm.style).toBe(ButtonStyle.Danger);
    expect(cancel.custom_id).toBe('event_canceldismiss_act-123');
    expect(cancel.style).toBe(ButtonStyle.Secondary);
  });

  it('dismiss path does not touch activity lookup or cancellation', async () => {
    const interaction = createButtonInteraction();

    await handleCancelEventDismiss(interaction as never);

    expect(mockGetActivityById).not.toHaveBeenCalled();
    expect(mockCancelActivity).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);
  });

  it('confirm path returns stale-event message when activity is missing', async () => {
    const interaction = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce(null);

    await handleCancelEvent(interaction as never, 'act-123');

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: '⚠️ Activity no longer exists.',
    });
  });

  it('accepts creator match via internal UUID and completes happy path side effects', async () => {
    const interaction = createButtonInteraction();
    const publicMessage = {
      embeds: [{ footer: { text: 'ID: act-123' } }],
      edit: jest.fn().mockResolvedValue(undefined),
    };
    const updatedActivity = {
      id: 'act-123',
      creatorId: 'internal-1',
      organizationId: 'org-1',
      status: 'scheduled',
    };
    mockGetActivityById
      .mockResolvedValueOnce(updatedActivity)
      .mockResolvedValueOnce(updatedActivity);
    interaction.channel = {
      messages: {
        fetch: jest.fn().mockResolvedValue([publicMessage]),
      },
    };

    await handleCancelEvent(interaction as never, 'act-123');

    expect(mockCancelActivity).toHaveBeenCalledWith(
      'act-123',
      'internal-1',
      'Cancelled via Discord button',
      'org-1'
    );
    expect(publicMessage.edit).toHaveBeenCalledWith({
      embeds: [{ title: 'embed' }],
      components: [],
    });
    expect(mockPublishMirrorRefresh).toHaveBeenCalledWith('act-123', 'discord-user-1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EVENT_CANCEL' })
    );
  });

  it('accepts creator match via discord snowflake fallback', async () => {
    const interaction = createButtonInteraction();
    const activity = {
      id: 'act-123',
      creatorId: 'discord-user-1',
      organizationId: 'org-1',
      status: 'scheduled',
    };
    mockGetActivityById.mockResolvedValue(activity);
    interaction.channel = null;

    await handleCancelEvent(interaction as never, 'act-123');

    expect(mockCancelActivity).toHaveBeenCalledWith(
      'act-123',
      'internal-1',
      'Cancelled via Discord button',
      'org-1'
    );
  });

  it('rejects non-creator user', async () => {
    const interaction = createButtonInteraction();
    mockGetActivityById.mockResolvedValue({ creatorId: 'someone-else', status: 'scheduled' });

    await handleCancelEvent(interaction as never, 'act-123');

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: '❌ Only the event creator can cancel this event.',
    });
  });

  it('rejects already-cancelled and completed events', async () => {
    const cancelled = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce({ creatorId: 'internal-1', status: 'cancelled' });

    await handleCancelEvent(cancelled as never, 'act-123');

    expect(cancelled.editReply).toHaveBeenCalledWith({
      content: '⚠️ This event is already cancelled.',
    });

    const completed = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce({ creatorId: 'internal-1', status: 'completed' });

    await handleCancelEvent(completed as never, 'act-123');

    expect(completed.editReply).toHaveBeenCalledWith({
      content: '⚠️ Cannot cancel a completed event.',
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

function createButtonInteraction(): {
  customId: string;
  user: { id: string; username: string };
  guildId: string;
  channelId: string;
  replied: boolean;
  deferred: boolean;
  channel: unknown;
  reply: jest.Mock;
  deferReply: jest.Mock;
  editReply: jest.Mock;
} {
  return {
    customId: 'event_cancel_act-123',
    user: { id: 'discord-user-1', username: 'Pilot' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    replied: false,
    deferred: false,
    channel: null,
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}

function buttonsFromReply(payload: {
  components?: Array<{ toJSON: () => { components: Array<Record<string, unknown>> } }>;
}): Array<Record<string, unknown>> {
  const row = payload.components?.[0];
  return row ? row.toJSON().components : [];
}
