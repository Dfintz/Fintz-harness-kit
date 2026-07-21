import { PollStatus, PollType } from '../../../models/Poll';

const mockListPolls = jest.fn();
const mockResolveOrgIdForGuild = jest.fn();

// poll.ts lazily constructs services via getServices(); mock the service modules
// and the guild→org resolver so importing the command and running the list-page
// route never touches the DB.
jest.mock('../../../services/poll/PollService', () => ({
  PollService: jest.fn().mockImplementation(() => ({
    listPolls: (...args: unknown[]) => mockListPolls(...args),
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

/** Build `count` minimal active-poll fixtures shaped like the list view consumes. */
function polls(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `poll-${i + 1}`,
    title: `Poll ${i + 1}`,
    pollType: PollType.SINGLE_CHOICE,
    status: PollStatus.ACTIVE,
    endsAt: null,
  }));
}

/** Resolve `listPolls` with the given poll set wrapped in a paginated response. */
function resolveWithPolls(count: number): void {
  const data = polls(count);
  mockListPolls.mockResolvedValueOnce({
    data,
    pagination: {
      page: 1,
      limit: 100,
      total: data.length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  });
}

/** Minimal ButtonInteraction stub for the list-page route. */
function createButtonInteraction(customId: string) {
  return {
    customId,
    user: { id: 'discord-user-1', username: 'Voter' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  };
}

function navRowButtons(payload: {
  components?: Array<{ toJSON: () => { components: Array<Record<string, unknown>> } }>;
}): Array<Record<string, unknown>> {
  const row = payload.components?.[0];
  return row ? row.toJSON().components : [];
}

describe('poll list pagination (CMD-03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveOrgIdForGuild.mockResolvedValue('org-1');
  });

  it('updates in place with pagination controls when more than one page exists', async () => {
    resolveWithPolls(23);
    const interaction = createButtonInteraction('poll_listpage_0');

    await poll.handleButton?.(interaction as never);

    // Paging edits the existing ephemeral list (update), not a fresh reply/defer.
    expect(interaction.update).toHaveBeenCalledTimes(1);
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(mockResolveOrgIdForGuild).toHaveBeenCalledWith('guild-1');

    const payload = interaction.update.mock.calls[0][0];
    const [prev, indicator, next] = navRowButtons(payload);
    expect(indicator.label).toBe('Page 1 / 3');
    expect(prev.custom_id).toBe('poll_listpage_-1');
    expect(prev.disabled).toBe(true);
    expect(next.custom_id).toBe('poll_listpage_1');
    expect(next.disabled).toBe(false);
  });

  it('shows no pagination row when a single page fits', async () => {
    resolveWithPolls(4);
    const interaction = createButtonInteraction('poll_listpage_0');

    await poll.handleButton?.(interaction as never);

    const payload = interaction.update.mock.calls[0][0];
    expect(payload.components).toEqual([]);
  });

  it('renders the requested middle page with both controls enabled', async () => {
    resolveWithPolls(23);
    const interaction = createButtonInteraction('poll_listpage_1');

    await poll.handleButton?.(interaction as never);

    const payload = interaction.update.mock.calls[0][0];
    const [prev, indicator, next] = navRowButtons(payload);
    expect(indicator.label).toBe('Page 2 / 3');
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(false);
  });

  it('collapses to the empty-state when there are no active polls', async () => {
    resolveWithPolls(0);
    const interaction = createButtonInteraction('poll_listpage_2');

    await poll.handleButton?.(interaction as never);

    const payload = interaction.update.mock.calls[0][0];
    expect(payload.components).toEqual([]);
    expect(payload.embeds[0].data.title).toContain('No Active Polls');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
