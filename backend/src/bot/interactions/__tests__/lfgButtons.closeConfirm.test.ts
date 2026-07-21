import { MessageFlags } from 'discord.js';

const mockGetPost = jest.fn();
const mockGetActivePostsByGuild = jest.fn();
const mockClosePost = jest.fn();
const mockFinalizeClosedSession = jest.fn();
const mockDeletePost = jest.fn();
const mockResolveOrganization = jest.fn();

// SocialGroupService / GuildOrganizationService are lazily constructed inside
// lfgButtons.ts; mock the modules so importing it never touches Redis/DB.
jest.mock('../../../services/social', () => ({
  SocialGroupService: {
    getInstance: jest.fn().mockReturnValue({
      getPost: (...args: unknown[]) => mockGetPost(...args),
      getActivePostsByGuild: (...args: unknown[]) => mockGetActivePostsByGuild(...args),
      closePost: (...args: unknown[]) => mockClosePost(...args),
      finalizeClosedSession: (...args: unknown[]) => mockFinalizeClosedSession(...args),
      deletePost: (...args: unknown[]) => mockDeletePost(...args),
    }),
  },
}));
jest.mock('../../../services/discord/GuildOrganizationService', () => ({
  GuildOrganizationService: {
    getInstance: jest.fn().mockReturnValue({
      resolveOrganization: (...args: unknown[]) => mockResolveOrganization(...args),
    }),
  },
}));
jest.mock('../../../services/social/ReputationService', () => ({
  ReputationService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../services/shared/RedisRateLimiter', () => ({
  redisRateLimiter: { check: jest.fn().mockResolvedValue({ allowed: true }) },
}));
jest.mock('../../../websocket/controllers/lfgWebSocketController', () => ({
  emitLfgMemberJoined: jest.fn(),
  emitLfgMemberLeft: jest.fn(),
  emitLfgSessionCancelled: jest.fn(),
}));
jest.mock('../../../utils/auditLogger', () => ({
  AuditEventType: { ACTIVITY_ACTION: 'ACTIVITY_ACTION' },
  logAuditEvent: jest.fn(),
}));
// Avoid importing the heavy /lfg command module for two constants.
jest.mock('../../commands/lfg', () => ({
  JOIN_LIMIT_PER_HOUR: 5,
  lfgJoinRateLimitKey: () => 'lfg:join:test',
}));
// Mock the embed module: parseLfgButtonId must mirror the real grammar; the
// builders are opaque sentinels (not asserted on). buildConfirmationPrompt is
// left REAL so we can assert the prompt copy + routing customIds.
jest.mock('../../embeds/lfgEmbed', () => ({
  parseLfgButtonId: (customId: string) => {
    const m = /^lfg_(join|leave|close)_(.+)$/.exec(customId);
    return m ? { action: m[1], postId: m[2] } : null;
  },
  parseLfgRatingId: () => null,
  buildLfgButtons: jest.fn(() => ({ __row: 'lfg-buttons' })),
  buildLfgEmbed: jest.fn(() => ({ __embed: 'lfg-embed' })),
  buildLfgRatingDetailButton: jest.fn(),
  buildLfgRatingStarButtons: jest.fn(),
  buildTeamSuggestionButtons: jest.fn(),
  buildTeamSuggestionEmbed: jest.fn(),
  STAR_LABELS: {},
  THUMB_LABELS: {},
}));

import { handleLfgButton } from '../lfgButtons';

const CREATOR_ID = 'discord-creator-1';

/** Minimal ButtonInteraction stub for LFG close-flow routes. */
function createInteraction(
  customId: string,
  opts: { userId?: string; messageId?: string; publicMessage?: unknown } = {}
) {
  const messagesFetch = jest.fn().mockResolvedValue(opts.publicMessage ?? null);
  return {
    customId,
    user: { id: opts.userId ?? CREATOR_ID, username: 'Closer' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    message: { id: opts.messageId ?? 'public-msg-1' },
    channel: { messages: { fetch: messagesFetch } },
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    _messagesFetch: messagesFetch,
  };
}

function rowComponents(payload: {
  components?: Array<{ toJSON: () => { components: Array<Record<string, unknown>> } }>;
}): Array<Record<string, unknown>> {
  const row = payload.components?.[0];
  return row ? row.toJSON().components : [];
}

const activePost = (overrides: Record<string, unknown> = {}) => ({
  id: 'lfg-1700000000000',
  activity: 'Bunker',
  creatorId: CREATOR_ID,
  status: 'open',
  ...overrides,
});

describe('LFG close — confirm by default (C2 / CMD-01)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActivePostsByGuild.mockResolvedValue([]);
    mockResolveOrganization.mockResolvedValue('org-1');
    mockFinalizeClosedSession.mockResolvedValue(undefined);
  });

  it('shows a confirmation prompt (carrying the public message id) instead of closing', async () => {
    mockGetPost.mockReturnValue(activePost());
    const interaction = createInteraction('lfg_close_lfg-1700000000000', {
      messageId: '100000000000000042',
    });

    await handleLfgButton(interaction as never);

    expect(mockClosePost).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
    expect(String(payload.content)).toContain('Bunker');
    expect(String(payload.content)).toContain("can't be undone");

    const [confirm, cancel] = rowComponents(payload);
    // Confirm carries the public message id so the real close edits THAT message.
    expect(confirm.custom_id).toBe('lfg_confirmclose_100000000000000042_lfg-1700000000000');
    expect(cancel.custom_id).toBe('lfg_canceldismiss_lfg-1700000000000');
  });

  it('rejects a non-creator up front without prompting or closing', async () => {
    mockGetPost.mockReturnValue(activePost({ creatorId: 'someone-else' }));
    const interaction = createInteraction('lfg_close_lfg-1700000000000', {
      userId: 'not-the-creator',
    });

    await handleLfgButton(interaction as never);

    expect(mockClosePost).not.toHaveBeenCalled();
    const payload = interaction.reply.mock.calls[0][0];
    expect(String(payload.content)).toContain('Only the creator');
    // No confirm buttons on a rejection.
    expect(payload.components).toBeUndefined();
  });

  it('shows an "expired" notice when the post no longer exists', async () => {
    mockGetPost.mockReturnValue(undefined);
    const interaction = createInteraction('lfg_close_lfg-gone');

    await handleLfgButton(interaction as never);

    expect(mockClosePost).not.toHaveBeenCalled();
    const payload = interaction.reply.mock.calls[0][0];
    expect(String(payload.content)).toContain('expired');
  });

  it('dismisses without closing when the cancel button is clicked', async () => {
    const interaction = createInteraction('lfg_canceldismiss_lfg-1700000000000');

    await handleLfgButton(interaction as never);

    expect(mockClosePost).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(String(interaction.reply.mock.calls[0][0].content)).toContain('Cancelled');
  });

  it('on confirm: closes the post, edits the PUBLIC message by id, and collapses the prompt', async () => {
    mockClosePost.mockReturnValue(activePost({ status: 'closed' }));
    const publicMessage = {
      edit: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const interaction = createInteraction('lfg_confirmclose_100000000000000042_lfg-1700000000000', {
      publicMessage,
    });

    await handleLfgButton(interaction as never);

    // Real close ran with (postId, userId).
    expect(mockClosePost).toHaveBeenCalledWith('lfg-1700000000000', CREATOR_ID);
    // Resolved the PUBLIC message by the id encoded in the customId (not interaction.message).
    expect(interaction._messagesFetch).toHaveBeenCalledWith('100000000000000042');
    expect(publicMessage.edit).toHaveBeenCalled();
    // Ephemeral prompt collapsed via update (never a fresh public reply).
    expect(interaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('closed'), components: [] })
    );
    expect(mockFinalizeClosedSession).toHaveBeenCalled();
  });

  it('on confirm: surfaces a non-creator close failure without acknowledging success', async () => {
    mockClosePost.mockImplementation(() => {
      throw new Error('Only the creator can close this LFG post');
    });
    const interaction = createInteraction('lfg_confirmclose_100000000000000042_lfg-1700000000000', {
      userId: 'not-the-creator',
    });

    await handleLfgButton(interaction as never);

    expect(interaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Only the creator') })
    );
    expect(mockFinalizeClosedSession).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
