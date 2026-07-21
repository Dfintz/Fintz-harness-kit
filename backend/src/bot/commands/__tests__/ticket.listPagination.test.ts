import { MessageFlags } from 'discord.js';

const mockGet = jest.fn();

// ticket.ts uses botApiClient for the list fetch; mock it so the list routes run
// without network access. (discordSettingsService / TicketActivityLogService are
// only touched by the close routes, not the list routes exercised here.)
jest.mock('../../utils/botApiClient', () => ({
  botApiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    put: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

import { ticket } from '../ticket';

/** Build a fake open-ticket API payload with `count` tickets. */
function ticketPayload(count: number) {
  const data = Array.from({ length: count }, (_, i) => ({
    ticketNumber: `T-${i + 1}`,
    subject: `Subject ${i + 1}`,
    status: 'open',
    category: 'general',
    priority: 'normal',
    createdAt: new Date().toISOString(),
  }));
  return { data: { data } };
}

/** Minimal ButtonInteraction stub for the list routes. */
function createButtonInteraction(customId: string) {
  return {
    customId,
    user: { id: 'discord-user-1', username: 'Agent' },
    guildId: 'guild-1',
    channelId: 'channel-1',
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    memberPermissions: { has: () => false },
  };
}

function navRowButtons(payload: {
  components?: Array<{ toJSON: () => { components: Array<Record<string, unknown>> } }>;
}): Array<Record<string, unknown>> {
  const row = payload.components?.[0];
  return row ? row.toJSON().components : [];
}

describe('ticket open-list pagination (C2 / CMD-03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page 1 with pagination controls when there are more than one page', async () => {
    mockGet.mockResolvedValueOnce(ticketPayload(23));
    const interaction = createButtonInteraction('ticket_panel_list');

    await ticket.handleButton?.(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(interaction.editReply).toHaveBeenCalledTimes(1);

    const payload = interaction.editReply.mock.calls[0][0];
    const [prev, indicator, next] = navRowButtons(payload);
    expect(String(indicator.label)).toBe('Page 1 / 3');
    expect(prev.custom_id).toBe('ticket_listpage_-1');
    expect(prev.disabled).toBe(true);
    expect(next.custom_id).toBe('ticket_listpage_1');
    expect(next.disabled).toBe(false);
  });

  it('shows no pagination row when a single page fits', async () => {
    mockGet.mockResolvedValueOnce(ticketPayload(4));
    const interaction = createButtonInteraction('ticket_panel_list');

    await ticket.handleButton?.(interaction as never);

    const payload = interaction.editReply.mock.calls[0][0];
    expect(payload.components).toEqual([]);
  });

  it('updates the existing message in place when paging via ticket_listpage_*', async () => {
    mockGet.mockResolvedValueOnce(ticketPayload(23));
    const interaction = createButtonInteraction('ticket_listpage_1');

    await ticket.handleButton?.(interaction as never);

    // Paging edits the existing ephemeral list (update), not a fresh reply.
    expect(interaction.update).toHaveBeenCalledTimes(1);
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();

    const payload = interaction.update.mock.calls[0][0];
    const [prev, indicator, next] = navRowButtons(payload);
    expect(String(indicator.label)).toBe('Page 2 / 3');
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(false);
  });

  it('shows the empty-state when the user has no open tickets', async () => {
    mockGet.mockResolvedValueOnce(ticketPayload(0));
    const interaction = createButtonInteraction('ticket_panel_list');

    await ticket.handleButton?.(interaction as never);

    const payload = interaction.editReply.mock.calls[0][0];
    expect(String(payload.content)).toContain('no open tickets');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
