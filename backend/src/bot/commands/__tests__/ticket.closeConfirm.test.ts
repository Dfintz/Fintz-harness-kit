import { ButtonStyle, MessageFlags } from 'discord.js';

const mockGet = jest.fn().mockResolvedValue({
  data: {
    id: 'ticket-uuid-1',
    ticketNumber: 'T-42',
    subject: 'Test subject',
    category: 'general',
    creatorName: 'TestUser',
    createdAt: '2026-07-01T00:00:00.000Z',
    creatorDiscordId: 'discord-creator-1',
    messages: [],
  },
});
const mockPut = jest.fn().mockResolvedValue({ data: {} });
const mockGetSettingsByGuildId = jest.fn().mockResolvedValue([]);
const mockLogActivity = jest.fn().mockResolvedValue(undefined);
const mockOpenTicketChannel = jest.fn().mockResolvedValue(undefined);
const mockCloseTicketChannel = jest.fn().mockResolvedValue(undefined);
const mockGetTranscriptInstance = jest.fn();
const mockBuildTicketClosedEmbed = jest.fn().mockReturnValue({ setColor: jest.fn() });
const mockSendNotifications = jest.fn().mockResolvedValue({ sent: 1, failed: 0, errors: [] });

// ticket.ts uses botApiClient for the close API calls, discordSettingsService to
// read twoStepCloseEnabled, TicketActivityLogService for the close audit log,
// ticketIssueChannel for channel lifecycle, TicketTranscriptService for
// transcripts, and DmNotificationService for creator DM — mock all.
jest.mock('../../utils/botApiClient', () => ({
  botApiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}));

jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {
    getSettingsByGuildId: (...args: unknown[]) => mockGetSettingsByGuildId(...args),
  },
}));

jest.mock('../../../services/discord/TicketActivityLogService', () => ({
  TicketActivityLogService: {
    getInstance: () => ({ logActivity: (...args: unknown[]) => mockLogActivity(...args) }),
  },
}));

jest.mock('../ticketIssueChannel', () => ({
  openTicketChannel: (...args: unknown[]) => mockOpenTicketChannel(...args),
  closeTicketChannel: (...args: unknown[]) => mockCloseTicketChannel(...args),
}));

jest.mock('../../../services/discord/TicketTranscriptService', () => ({
  TicketTranscriptService: {
    getInstance: () => mockGetTranscriptInstance(),
  },
}));

jest.mock('../../../services/discord/DmNotificationService', () => ({
  DmEventType: { TICKET_CLOSED: 'ticket_closed' },
  DmNotificationService: {
    getInstance: () => ({
      buildTicketClosedEmbed: (...args: unknown[]) => mockBuildTicketClosedEmbed(...args),
      sendNotifications: (...args: unknown[]) => mockSendNotifications(...args),
    }),
  },
}));

import { parseTicketCancelCloseTicketNumber, ticket } from '../ticket';

/** Minimal ButtonInteraction stub exposing the members the close routes touch. */
function createButtonInteraction(customId: string, includeGuild = false) {
  return {
    customId,
    user: { id: 'discord-user-1', username: 'Agent' },
    guildId: 'guild-1',
    guild: includeGuild ? { id: 'guild-1' } : undefined,
    channelId: 'channel-1',
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    showModal: jest.fn().mockResolvedValue(undefined),
  };
}

/** Extract the rendered button components from a captured reply payload. */
function buttonsFromReply(payload: {
  components?: Array<{ toJSON: () => { components: Array<Record<string, unknown>> } }>;
}): Array<Record<string, unknown>> {
  const row = payload.components?.[0];
  return row ? row.toJSON().components : [];
}

describe('ticket close — two-step confirm converged onto shared primitive (C2)', () => {
  const mockGenerateTranscript = jest.fn().mockReturnValue({ ticketNumber: 'T-42' });
  const mockPostToChannel = jest.fn().mockResolvedValue(true);

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no transcript channel configured — transcript is a no-op.
    mockGetSettingsByGuildId.mockResolvedValue([]);
    mockGetTranscriptInstance.mockReturnValue({
      generateTranscript: mockGenerateTranscript,
      postToChannel: mockPostToChannel,
    });
  });

  it('shows the shared confirmation prompt when two-step close is enabled', async () => {
    mockGetSettingsByGuildId.mockResolvedValueOnce([
      { ticketSettings: { twoStepCloseEnabled: true } },
    ]);
    const interaction = createButtonInteraction('ticket_close_T-42');

    await ticket.handleButton?.(interaction as never);

    // Prompt only — no defer, no close API call yet.
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.flags).toBe(MessageFlags.Ephemeral);

    const [confirm, cancel] = buttonsFromReply(payload);
    expect(confirm.custom_id).toBe('ticket_confirmclose_T-42');
    expect(confirm.style).toBe(ButtonStyle.Danger);
    expect(confirm.label).toBe('Confirm Close');
    expect(cancel.custom_id).toBe('ticket_cancelclose_T-42');
    expect(cancel.style).toBe(ButtonStyle.Secondary);
  });

  it('closes directly (no prompt) when two-step close is disabled', async () => {
    mockGetSettingsByGuildId.mockResolvedValueOnce([
      { ticketSettings: { twoStepCloseEnabled: false } },
    ]);
    const interaction = createButtonInteraction('ticket_close_T-42');

    await ticket.handleButton?.(interaction as never);

    // Legacy behavior preserved: defer + close immediately, no confirmation buttons.
    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(String(mockPut.mock.calls[0][0])).toContain('/close');
  });

  it('sends a resolution body when resolving via ticket_resolve_* button', async () => {
    const interaction = createButtonInteraction('ticket_resolve_T-42');

    await ticket.handleButton?.(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(String(mockPut.mock.calls[0][0])).toContain('/resolve');
    expect(mockPut.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        resolution: expect.stringContaining('Resolved via Discord button by'),
      })
    );
  });

  it('dismisses with the uniform cancelled message on cancel', async () => {
    const interaction = createButtonInteraction('ticket_cancelclose_T-42');

    await ticket.handleButton?.(interaction as never);

    expect(mockPut).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const payload = interaction.reply.mock.calls[0][0];
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
    expect(String(payload.content)).toContain('Cancelled');
  });

  it('performs the close on confirm', async () => {
    const interaction = createButtonInteraction('ticket_confirmclose_T-42');

    await ticket.handleButton?.(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(String(mockPut.mock.calls[0][0])).toContain('/close');
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('calls closeTicketChannel (fire-and-forget) when guild is present on confirm', async () => {
    const interaction = createButtonInteraction(
      'ticket_confirmclose_T-42',
      /* includeGuild */ true
    );

    await ticket.handleButton?.(interaction as never);

    expect(mockCloseTicketChannel).toHaveBeenCalledWith(interaction.guild, 'ticket-uuid-1', 'T-42');
  });

  it('skips closeTicketChannel when guild is absent on confirm', async () => {
    const interaction = createButtonInteraction(
      'ticket_confirmclose_T-42',
      /* includeGuild */ false
    );

    await ticket.handleButton?.(interaction as never);

    expect(mockCloseTicketChannel).not.toHaveBeenCalled();
  });

  it('calls _postCloseTranscript when transcriptChannelId is configured on confirm', async () => {
    mockGetSettingsByGuildId.mockResolvedValue([
      { ticketSettings: { transcriptChannelId: 'tc-chan-1' } },
    ]);
    const interaction = createButtonInteraction('ticket_confirmclose_T-42');

    await ticket.handleButton?.(interaction as never);

    expect(mockGenerateTranscript).toHaveBeenCalledWith(
      'T-42',
      'Test subject',
      'general',
      'TestUser',
      expect.any(Date),
      expect.any(Array)
    );
    expect(mockPostToChannel).toHaveBeenCalledWith('tc-chan-1', expect.any(Object));
  });

  it('calls closeTicketChannel (fire-and-forget) on direct close when guild is present', async () => {
    mockGetSettingsByGuildId.mockResolvedValueOnce([
      { ticketSettings: { twoStepCloseEnabled: false } },
    ]);
    const interaction = createButtonInteraction('ticket_close_T-42', /* includeGuild */ true);

    await ticket.handleButton?.(interaction as never);

    expect(mockCloseTicketChannel).toHaveBeenCalledWith(interaction.guild, 'ticket-uuid-1', 'T-42');
  });

  it('sends close DM to creator (fire-and-forget) on confirm when creatorDiscordId present', async () => {
    const interaction = createButtonInteraction('ticket_confirmclose_T-42');

    await ticket.handleButton?.(interaction as never);

    expect(mockBuildTicketClosedEmbed).toHaveBeenCalledWith('T-42', undefined);
    expect(mockSendNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ticket_closed',
        recipientDiscordIds: ['discord-creator-1'],
        guildId: 'guild-1',
      })
    );
  });

  it('sends close DM on direct close when creatorDiscordId present', async () => {
    mockGetSettingsByGuildId.mockResolvedValueOnce([
      { ticketSettings: { twoStepCloseEnabled: false } },
    ]);
    const interaction = createButtonInteraction('ticket_close_T-42');

    await ticket.handleButton?.(interaction as never);

    expect(mockSendNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ticket_closed',
        recipientDiscordIds: ['discord-creator-1'],
      })
    );
  });

  it('skips close DM when creatorDiscordId is absent', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        id: 'ticket-uuid-1',
        ticketNumber: 'T-42',
        subject: 'Test subject',
        category: 'general',
        creatorName: 'TestUser',
        // No creatorDiscordId
        messages: [],
      },
    });
    const interaction = createButtonInteraction('ticket_confirmclose_T-42');

    await ticket.handleButton?.(interaction as never);

    expect(mockSendNotifications).not.toHaveBeenCalled();
  });
});

describe('ticket cancel-close parser helper (C9)', () => {
  it('parses the ticket number from the cancel-close customId', () => {
    expect(parseTicketCancelCloseTicketNumber('ticket_cancelclose_T-42')).toBe('T-42');
  });

  it('ignores extra params and keeps the first ticket-number segment', () => {
    expect(parseTicketCancelCloseTicketNumber('ticket_cancelclose_T-42_extra')).toBe('T-42');
  });

  it.each(['ticket_confirmclose_T-42', 'ticket_cancelclose', 'ticket_cancelclose_'])(
    'returns null for non-cancelclose ids: %s',
    customId => {
      expect(parseTicketCancelCloseTicketNumber(customId)).toBeNull();
    }
  );

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
