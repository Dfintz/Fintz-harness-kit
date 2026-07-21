import { PollStatus, PollType } from '../../../models/Poll';
import { PollMirrorStatus } from '../../../models/PollDiscordMirror';

const mockListPolls = jest.fn();
const mockGetPollById = jest.fn();
const mockGetResults = jest.fn();
const mockMirrorPollToGuild = jest.fn();
const mockResolveOrgIdForGuild = jest.fn();

// poll.ts lazily constructs services via getServices(); mock the service modules
// and the guild→org resolver so importing the command and exercising the picker
// never touches the DB.
jest.mock('../../../services/poll/PollService', () => ({
  PollService: jest.fn().mockImplementation(() => ({
    listPolls: (...args: unknown[]) => mockListPolls(...args),
    getPollById: (...args: unknown[]) => mockGetPollById(...args),
    getResults: (...args: unknown[]) => mockGetResults(...args),
  })),
}));
jest.mock('../../../services/poll/DiscordPollService', () => ({
  DiscordPollService: jest.fn().mockImplementation(() => ({
    mirrorPollToGuild: (...args: unknown[]) => mockMirrorPollToGuild(...args),
  })),
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

/** Build `count` minimal active-poll fixtures. */
function polls(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `poll-${i + 1}`,
    title: `Poll ${i + 1}`,
    pollType: PollType.SINGLE_CHOICE,
    status: PollStatus.ACTIVE,
    endsAt: null,
  }));
}

/** Resolve `listPolls` with `count` active polls wrapped in a paginated response. */
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

/** Minimal panel ButtonInteraction stub (opens the picker). */
function createPanelButton(action: string) {
  return {
    customId: `poll_panel_${action}`,
    user: { id: 'discord-user-1', username: 'Picker' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}

/** Minimal StringSelectMenuInteraction stub (picker selection). */
function createSelect(action: string, pollId: string) {
  return {
    customId: `poll_pick_${action}`,
    values: [pollId],
    user: { id: 'discord-user-1', username: 'Picker' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}

function selectMenuFromPayload(payload: {
  components?: Array<{ toJSON: () => { components: Array<Record<string, unknown>> } }>;
}): Record<string, unknown> | undefined {
  const row = payload.components?.[0];
  return row ? row.toJSON().components[0] : undefined;
}

describe('poll picker (CMD-02 native select)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveOrgIdForGuild.mockResolvedValue('org-1');
  });

  it.each(['post', 'results', 'close'])(
    'renders a poll select menu for the "%s" panel button',
    async action => {
      resolveWithPolls(3);
      const interaction = createPanelButton(action);

      await poll.handleButton!(interaction as never);

      expect(interaction.deferReply).toHaveBeenCalled();
      const payload = interaction.editReply.mock.calls[0][0] as {
        components: Array<{ toJSON: () => { components: Array<Record<string, unknown>> } }>;
      };
      const menu = selectMenuFromPayload(payload);
      expect(menu?.custom_id).toBe(`poll_pick_${action}`);
      // One option per active poll.
      expect((menu?.options as unknown[]).length).toBe(3);
    }
  );

  it('shows a "no active polls" message (no select) when there are none', async () => {
    resolveWithPolls(0);
    const interaction = createPanelButton('post');

    await poll.handleButton!(interaction as never);

    const payload = interaction.editReply.mock.calls[0][0] as { components?: unknown[] };
    expect(payload.components).toBeUndefined();
  });

  it('caps the picker at 25 options and notes the truncation', async () => {
    resolveWithPolls(30);
    const interaction = createPanelButton('results');

    await poll.handleButton!(interaction as never);

    const payload = interaction.editReply.mock.calls[0][0] as {
      content: string;
      components: Array<{ toJSON: () => { components: Array<Record<string, unknown>> } }>;
    };
    const menu = selectMenuFromPayload(payload);
    expect((menu?.options as unknown[]).length).toBe(25);
    expect(payload.content).toContain('first 25 of 30');
  });

  it('routes a "post" selection to mirror the picked poll', async () => {
    mockGetPollById.mockResolvedValueOnce({
      id: 'poll-2',
      title: 'Picked Poll',
      status: PollStatus.ACTIVE,
      pollType: PollType.SINGLE_CHOICE,
    });
    mockMirrorPollToGuild.mockResolvedValueOnce({ status: PollMirrorStatus.ACTIVE });
    const interaction = createSelect('post', 'poll-2');

    await poll.handleSelectMenu!(interaction as never);

    expect(mockGetPollById).toHaveBeenCalledWith('org-1', 'poll-2');
    expect(mockMirrorPollToGuild).toHaveBeenCalled();
  });

  it('routes a "results" selection to fetch results for the picked poll', async () => {
    mockGetPollById.mockResolvedValueOnce({
      id: 'poll-3',
      title: 'Results Poll',
      status: PollStatus.ACTIVE,
      pollType: PollType.SINGLE_CHOICE,
    });
    mockGetResults.mockResolvedValueOnce(null);
    const interaction = createSelect('results', 'poll-3');

    await poll.handleSelectMenu!(interaction as never);

    expect(mockGetPollById).toHaveBeenCalledWith('org-1', 'poll-3');
    expect(mockGetResults).toHaveBeenCalledWith('org-1', 'poll-3', 'discord-user-1');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
