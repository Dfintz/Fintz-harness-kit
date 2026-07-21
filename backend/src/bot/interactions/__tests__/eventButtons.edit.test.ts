import { MessageFlags } from 'discord.js';

const mockGetActivityById = jest.fn();
const mockUpdateActivity = jest.fn();
const mockGetParticipants = jest.fn();
const mockResolveInternalUserId = jest.fn();
const mockLaunchEventEditWizard = jest.fn();
const mockResolveDiscordIdMap = jest.fn();
const mockBuildEmbedDataFromActivity = jest.fn();
const mockBuildEventEmbed = jest.fn();
const mockBuildEventComponentRows = jest.fn();
const mockPublishMirrorRefresh = jest.fn();
const mockLogAuditEvent = jest.fn();

jest.mock('../eventButtons.services', () => ({
  getActivityService: jest.fn(() => ({
    getActivityById: mockGetActivityById,
    updateActivity: mockUpdateActivity,
  })),
  getParticipantService: jest.fn(() => ({
    getParticipants: mockGetParticipants,
  })),
}));

jest.mock('../eventButtons.identity', () => ({
  resolveInternalUserId: (...args: unknown[]) => mockResolveInternalUserId(...args),
}));

jest.mock('../eventEditWizard', () => ({
  launchEventEditWizard: (...args: unknown[]) => mockLaunchEventEditWizard(...args),
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

jest.mock('../../mirrorSyncPublisher', () => ({
  publishMirrorRefresh: (...args: unknown[]) => mockPublishMirrorRefresh(...args),
}));

jest.mock('../../../utils/auditLogger', () => ({
  AuditEventType: {
    ACTIVITY_ACTION: 'ACTIVITY_ACTION',
  },
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

jest.mock('../eventButtons.security', () => ({
  sanitizeErrorForUser: (value: string) => value,
}));

import { handleEditEvent, handleEditEventModal } from '../eventButtons.edit';

describe('eventButtons.edit seam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveInternalUserId.mockResolvedValue('internal-1');
    mockGetParticipants.mockResolvedValue([]);
    mockResolveDiscordIdMap.mockResolvedValue(new Map());
    mockBuildEmbedDataFromActivity.mockReturnValue({});
    mockBuildEventEmbed.mockReturnValue({ title: 'embed' });
    mockBuildEventComponentRows.mockReturnValue([]);
  });

  it('handleEditEvent returns stale activity guard', async () => {
    const interaction = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce(null);

    await handleEditEvent(interaction as never, 'activity-1');

    expect(interaction.reply).toHaveBeenCalledWith({
      content: '⚠️ Activity no longer exists.',
      flags: MessageFlags.Ephemeral,
    });
    expect(mockLaunchEventEditWizard).not.toHaveBeenCalled();
  });

  it('handleEditEvent enforces creator guard and allows discord fallback', async () => {
    const denied = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce({ creatorId: 'someone-else', status: 'scheduled' });

    await handleEditEvent(denied as never, 'activity-1');

    expect(denied.reply).toHaveBeenCalledWith({
      content: '❌ Only the event creator can edit this event.',
      flags: MessageFlags.Ephemeral,
    });

    const fallback = createButtonInteraction();
    mockResolveInternalUserId.mockResolvedValueOnce(null);
    mockGetActivityById.mockResolvedValueOnce({
      creatorId: 'discord-user-1',
      status: 'scheduled',
    });

    await handleEditEvent(fallback as never, 'activity-1');

    expect(mockLaunchEventEditWizard).toHaveBeenCalledWith(fallback, 'activity-1');
  });

  it('handleEditEvent blocks cancelled/completed statuses', async () => {
    const cancelled = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce({ creatorId: 'internal-1', status: 'cancelled' });

    await handleEditEvent(cancelled as never, 'activity-1');

    expect(cancelled.reply).toHaveBeenCalledWith({
      content: '⚠️ Cannot edit a cancelled event.',
      flags: MessageFlags.Ephemeral,
    });

    const completed = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce({ creatorId: 'internal-1', status: 'completed' });

    await handleEditEvent(completed as never, 'activity-1');

    expect(completed.reply).toHaveBeenCalledWith({
      content: '⚠️ Cannot edit a completed event.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('handleEditEventModal validates title/max/date input', async () => {
    const baseActivity = { creatorId: 'internal-1', status: 'scheduled' };

    const titleMissing = createModalInteraction({
      edit_title: '   ',
      edit_description: '',
      edit_location: '',
      edit_max_participants: '',
      edit_start_date: '',
    });
    mockGetActivityById.mockResolvedValueOnce(baseActivity);
    await handleEditEventModal(titleMissing as never, 'activity-1');
    expect(titleMissing.editReply).toHaveBeenCalledWith({ content: '❌ Title is required.' });

    const badMax = createModalInteraction({
      edit_title: 'Op',
      edit_description: '',
      edit_location: '',
      edit_max_participants: '0',
      edit_start_date: '',
    });
    mockGetActivityById.mockResolvedValueOnce(baseActivity);
    await handleEditEventModal(badMax as never, 'activity-1');
    expect(badMax.editReply).toHaveBeenCalledWith({
      content: '❌ Max participants must be between 1 and 100.',
    });

    const badDate = createModalInteraction({
      edit_title: 'Op',
      edit_description: '',
      edit_location: '',
      edit_max_participants: '',
      edit_start_date: 'not-a-date',
    });
    mockGetActivityById.mockResolvedValueOnce(baseActivity);
    await handleEditEventModal(badDate as never, 'activity-1');
    expect(badDate.editReply).toHaveBeenCalledWith({
      content: '❌ Invalid date. Use format `YYYY-MM-DD HH:mm` in UTC.',
    });
  });

  it('handleEditEventModal supports discord creator fallback and null-clears optional fields', async () => {
    const interaction = createModalInteraction({
      edit_title: 'Updated op',
      edit_description: '   ',
      edit_location: '',
      edit_max_participants: '',
      edit_start_date: '',
    });

    mockResolveInternalUserId.mockResolvedValueOnce(null);
    mockGetActivityById
      .mockResolvedValueOnce({ creatorId: 'discord-user-1', status: 'scheduled' })
      .mockResolvedValueOnce({
        id: 'activity-1',
        creatorId: 'discord-user-1',
        status: 'scheduled',
      });

    await handleEditEventModal(interaction as never, 'activity-1');

    expect(mockUpdateActivity).toHaveBeenCalledWith('activity-1', {
      title: 'Updated op',
      description: null,
      location: null,
      maxParticipants: null,
    });
    expect(mockPublishMirrorRefresh).toHaveBeenCalledWith('activity-1', 'discord-user-1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EVENT_EDIT' })
    );
  });

  it('handleEditEventModal swallows embed refresh failure and still succeeds', async () => {
    const interaction = createModalInteraction({
      edit_title: 'Updated op',
      edit_description: 'desc',
      edit_location: 'Orison',
      edit_max_participants: '12',
      edit_start_date: '2026-07-01 20:30',
    });
    interaction.message = {
      edit: jest.fn().mockRejectedValue(new Error('boom')),
    };

    mockGetActivityById
      .mockResolvedValueOnce({ creatorId: 'internal-1', status: 'scheduled' })
      .mockResolvedValueOnce({ id: 'activity-1', creatorId: 'internal-1', status: 'scheduled' });

    await handleEditEventModal(interaction as never, 'activity-1');

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: '✅ Event updated successfully.',
    });
    expect(mockPublishMirrorRefresh).toHaveBeenCalledWith('activity-1', 'discord-user-1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EVENT_EDIT' })
    );
  });

  it('handleEditEventModal refresh payload is mention-safe on success path', async () => {
    const messageEdit = jest.fn().mockResolvedValue(undefined);
    const interaction = createModalInteraction({
      edit_title: 'Updated op',
      edit_description: 'desc',
      edit_location: 'Orison',
      edit_max_participants: '12',
      edit_start_date: '',
    });
    interaction.message = { edit: messageEdit };

    mockGetActivityById
      .mockResolvedValueOnce({ creatorId: 'internal-1', status: 'scheduled' })
      .mockResolvedValueOnce({ id: 'activity-1', creatorId: 'internal-1', status: 'scheduled' });

    await handleEditEventModal(interaction as never, 'activity-1');

    expect(messageEdit).toHaveBeenCalledWith({
      embeds: [{ title: 'embed' }],
      components: [],
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});

function createButtonInteraction(): {
  user: { id: string; username: string };
  replied: boolean;
  deferred: boolean;
  reply: jest.Mock;
  followUp: jest.Mock;
} {
  return {
    user: { id: 'discord-user-1', username: 'Pilot' },
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
  };
}

function createModalInteraction(fieldsMap: Record<string, string>): {
  user: { id: string; username: string };
  guildId: string;
  channelId: string;
  message: { edit: jest.Mock } | null;
  deferReply: jest.Mock;
  editReply: jest.Mock;
  fields: { getTextInputValue: (key: string) => string };
} {
  return {
    user: { id: 'discord-user-1', username: 'Pilot' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    message: null,
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    fields: {
      getTextInputValue: (key: string) => fieldsMap[key] ?? '',
    },
  };
}
