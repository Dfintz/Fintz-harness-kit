import { MessageFlags } from 'discord.js';

const mockGetActivityById = jest.fn();
const mockCloneActivity = jest.fn();
const mockResolveInternalUserId = jest.fn();
const mockBuildEmbedDataFromActivity = jest.fn();
const mockBuildEventEmbed = jest.fn();
const mockBuildEventComponentRows = jest.fn();
const mockLogAuditEvent = jest.fn();

jest.mock('../eventButtons.services', () => ({
  getActivityService: jest.fn(() => ({
    getActivityById: mockGetActivityById,
    cloneActivity: mockCloneActivity,
  })),
}));

jest.mock('../eventButtons.identity', () => ({
  resolveInternalUserId: (...args: unknown[]) => mockResolveInternalUserId(...args),
}));

jest.mock('../eventButtons.embedData', () => ({
  buildEmbedDataFromActivity: (...args: unknown[]) => mockBuildEmbedDataFromActivity(...args),
}));

jest.mock('../../embeds/eventEmbed', () => ({
  buildEventEmbed: (...args: unknown[]) => mockBuildEventEmbed(...args),
  buildEventComponentRows: (...args: unknown[]) => mockBuildEventComponentRows(...args),
}));

jest.mock('../eventButtons.security', () => ({
  sanitizeErrorForUser: (value: string) => value,
}));

jest.mock('../../../utils/auditLogger', () => ({
  AuditEventType: {
    ACTIVITY_ACTION: 'ACTIVITY_ACTION',
  },
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

import { CLONE_SCHEDULE_SHIFT_MS, handleCloneEvent } from '../eventButtons.clone';

describe('eventButtons.clone seam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveInternalUserId.mockResolvedValue('internal-1');
    mockBuildEmbedDataFromActivity.mockReturnValue({});
    mockBuildEventEmbed.mockReturnValue({ title: 'embed' });
    mockBuildEventComponentRows.mockReturnValue([]);
  });

  it('returns stale-event guard when activity missing', async () => {
    const interaction = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce(null);

    await handleCloneEvent(interaction as never, 'activity-1');

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: '⚠️ Activity no longer exists.',
    });
  });

  it('denies non-creator and allows creator via discord fallback', async () => {
    const deny = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce({ creatorId: 'someone-else' });

    await handleCloneEvent(deny as never, 'activity-1');

    expect(deny.editReply).toHaveBeenCalledWith({
      content: '❌ Only the event creator can clone this event.',
    });

    const allow = createButtonInteraction();
    mockResolveInternalUserId.mockResolvedValueOnce(null);
    mockGetActivityById.mockResolvedValueOnce({
      id: 'activity-1',
      creatorId: 'discord-user-1',
      title: 'Op',
    });
    mockCloneActivity.mockResolvedValueOnce({ id: 'clone-1', title: 'Op' });

    await handleCloneEvent(allow as never, 'activity-1');

    expect(mockCloneActivity).toHaveBeenCalledWith('activity-1', {});
  });

  it('applies one-week shift to start/end and posts in send-capable channel', async () => {
    const interaction = createButtonInteraction();
    const channel = {
      isTextBased: jest.fn(() => true),
      send: jest.fn().mockResolvedValue(undefined),
    };
    interaction.channel = channel;

    const start = new Date('2026-07-01T12:00:00Z');
    const end = new Date('2026-07-01T14:00:00Z');

    mockGetActivityById.mockResolvedValueOnce({
      id: 'activity-1',
      creatorId: 'internal-1',
      title: 'Weekly Op',
      scheduledStartDate: start,
      scheduledEndDate: end,
    });
    mockCloneActivity.mockResolvedValueOnce({
      id: 'clone-1',
      scheduledStartDate: new Date(start.getTime() + CLONE_SCHEDULE_SHIFT_MS),
      title: 'Weekly Op',
    });

    await handleCloneEvent(interaction as never, 'activity-1');

    expect(mockCloneActivity).toHaveBeenCalledWith('activity-1', {
      scheduledStartDate: new Date(start.getTime() + CLONE_SCHEDULE_SHIFT_MS),
      scheduledEndDate: new Date(end.getTime() + CLONE_SCHEDULE_SHIFT_MS),
    });
    expect(channel.send).toHaveBeenCalledWith({
      embeds: [{ title: 'embed' }],
      components: [],
    });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('scheduled for <t:'),
      })
    );
  });

  it('handles unscheduled clone with no channel send and logs audit', async () => {
    const interaction = createButtonInteraction();

    mockGetActivityById.mockResolvedValueOnce({
      id: 'activity-1',
      creatorId: 'internal-1',
      title: 'No Date Op',
    });
    mockCloneActivity.mockResolvedValueOnce({
      id: 'clone-1',
      title: 'No Date Op',
    });

    await handleCloneEvent(interaction as never, 'activity-1');

    expect(mockCloneActivity).toHaveBeenCalledWith('activity-1', {});
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('with no date set yet'),
      })
    );
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EVENT_CLONE',
        metadata: { sourceActivityId: 'activity-1', clonedActivityId: 'clone-1' },
      })
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

function createButtonInteraction(): {
  user: { id: string; username: string };
  guildId: string;
  channelId: string;
  channel: unknown;
  deferReply: jest.Mock;
  editReply: jest.Mock;
} {
  return {
    user: { id: 'discord-user-1', username: 'Pilot' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel: null,
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}
