import { PollStatus, PollType } from '../../../models/Poll';

const mockGetPollById = jest.fn();
const mockClosePoll = jest.fn();
const mockResolveOrgIdForGuild = jest.fn();

// poll.ts lazily constructs services via getServices(); mock the service modules
// and the guild→org resolver so importing the command and exercising the
// close-confirmation flow never touches the DB.
jest.mock('../../../services/poll/PollService', () => ({
  PollService: jest.fn().mockImplementation(() => ({
    getPollById: (...args: unknown[]) => mockGetPollById(...args),
    closePoll: (...args: unknown[]) => mockClosePoll(...args),
  })),
}));
jest.mock('../../../services/poll/DiscordPollService', () => ({
  DiscordPollService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../services/discord/GuildOrganizationService', () => ({
  GuildOrganizationService: { getInstance: jest.fn().mockReturnValue({}) },
}));
jest.mock('../../../services/user/UserService', () => ({
  UserService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../utils/guildContext', () => ({
  resolveOrgIdForGuild: (...args: unknown[]) => mockResolveOrgIdForGuild(...args),
}));

import { poll } from '../poll';

/** Minimal StringSelectMenuInteraction stub for the close picker selection. */
function createCloseSelectInteraction(pollId: string) {
  return {
    customId: 'poll_pick_close',
    values: [pollId],
    user: { id: 'discord-user-1', username: 'Closer' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}

/** Minimal ButtonInteraction stub for confirm/cancel follow-ups. */
function createButtonInteraction(customId: string) {
  return {
    customId,
    user: { id: 'discord-user-1', username: 'Closer' },
    guildId: 'guild-1',
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}

function firstComponentRow(payload: {
  components?: Array<{ toJSON: () => { components: Array<Record<string, unknown>> } }>;
}): Array<Record<string, unknown>> {
  const row = payload.components?.[0];
  return row ? row.toJSON().components : [];
}

describe('poll close confirmation (C2 / CMD-01)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveOrgIdForGuild.mockResolvedValue('org-1');
  });

  it('shows a confirmation prompt naming the poll instead of closing immediately', async () => {
    mockGetPollById.mockResolvedValueOnce({
      id: 'poll-1',
      title: 'Op Night Vote',
      status: PollStatus.ACTIVE,
      pollType: PollType.SINGLE_CHOICE,
    });
    const interaction = createCloseSelectInteraction('poll-1');

    await poll.handleSelectMenu!(interaction as never);

    // Did NOT close the poll yet.
    expect(mockClosePoll).not.toHaveBeenCalled();
    // Prompt content names the poll and uses the uniform "can't be undone" copy.
    const payload = interaction.editReply.mock.calls[0][0] as {
      content: string;
      components: Array<{ toJSON: () => { components: Array<Record<string, unknown>> } }>;
    };
    expect(payload.content).toContain('Op Night Vote');
    expect(payload.content).toContain("can't be undone");
    // Confirm button carries the routing customId that triggers the real close.
    const buttons = firstComponentRow(payload);
    const customIds = buttons.map(b => b.custom_id);
    expect(customIds).toContain('poll_confirmclose_poll-1');
    expect(customIds).toContain('poll_canceldismiss_poll-1');
  });

  it('rejects a missing poll before prompting', async () => {
    mockGetPollById.mockResolvedValueOnce(null);
    const interaction = createCloseSelectInteraction('poll-missing');

    await poll.handleSelectMenu!(interaction as never);

    expect(mockClosePoll).not.toHaveBeenCalled();
    const payload = interaction.editReply.mock.calls[0][0] as { components?: unknown[] };
    // Error embed only — no confirm buttons.
    expect(payload.components).toBeUndefined();
  });

  it('rejects an already-closed poll before prompting', async () => {
    mockGetPollById.mockResolvedValueOnce({
      id: 'poll-1',
      title: 'Closed Poll',
      status: PollStatus.CLOSED,
      pollType: PollType.SINGLE_CHOICE,
    });
    const interaction = createCloseSelectInteraction('poll-1');

    await poll.handleSelectMenu!(interaction as never);

    expect(mockClosePoll).not.toHaveBeenCalled();
    const payload = interaction.editReply.mock.calls[0][0] as { components?: unknown[] };
    expect(payload.components).toBeUndefined();
  });

  it('closes the poll when the confirm button is clicked', async () => {
    mockClosePoll.mockResolvedValueOnce({ id: 'poll-1', title: 'Op Night Vote' });
    const interaction = createButtonInteraction('poll_confirmclose_poll-1');

    await poll.handleButton!(interaction as never);

    expect(mockClosePoll).toHaveBeenCalledWith('org-1', 'poll-1', 'discord-user-1', 'Closer');
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('dismisses without closing when the cancel button is clicked', async () => {
    const interaction = createButtonInteraction('poll_canceldismiss_poll-1');

    await poll.handleButton!(interaction as never);

    expect(mockClosePoll).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Cancelled') })
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
