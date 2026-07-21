import { MessageFlags } from 'discord.js';

import type { Giveaway } from '../../../services/discord/GiveawayService';

const mockListGiveaways = jest.fn();

// giveaway.ts resolves the list from GiveawayService.getInstance().listGiveaways();
// mock the whole module so importing the command never starts the real service
// (timers, etc.) and the list routes run against in-memory fixtures.
jest.mock('../../../services/discord/GiveawayService', () => ({
  GiveawayService: {
    getInstance: () => ({ listGiveaways: (...args: unknown[]) => mockListGiveaways(...args) }),
  },
}));

import { giveaway } from '../giveaway';

/** Build `count` valid in-memory Giveaway fixtures. */
function giveaways(count: number): Giveaway[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `g-${i + 1}`,
    guildId: 'guild-1',
    channelId: 'channel-1',
    messageId: `msg-${i + 1}`,
    hostId: 'host-1',
    hostName: 'Host',
    title: `Giveaway ${i + 1}`,
    description: 'desc',
    winners: 1,
    endsAt: new Date(Date.now() + 3_600_000),
    entries: [],
    ended: false,
    winnerIds: [],
  }));
}

/** Minimal ButtonInteraction stub for the list routes. */
function createButtonInteraction(customId: string) {
  return {
    customId,
    user: { id: 'discord-user-1', username: 'Pilot' },
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

describe('giveaway active-list pagination (C2 / CMD-03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page 1 with pagination controls when more than one page exists', async () => {
    mockListGiveaways.mockReturnValueOnce(giveaways(23));
    const interaction = createButtonInteraction('giveaway_panel_list');

    await giveaway.handleButton?.(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    const payload = interaction.editReply.mock.calls[0][0];
    const [prev, indicator, next] = navRowButtons(payload);
    expect(indicator.label).toBe('Page 1 / 3');
    expect(prev.custom_id).toBe('giveaway_listpage_-1');
    expect(prev.disabled).toBe(true);
    expect(next.custom_id).toBe('giveaway_listpage_1');
    expect(next.disabled).toBe(false);
  });

  it('shows no pagination row when a single page fits', async () => {
    mockListGiveaways.mockReturnValueOnce(giveaways(4));
    const interaction = createButtonInteraction('giveaway_panel_list');

    await giveaway.handleButton?.(interaction as never);

    const payload = interaction.editReply.mock.calls[0][0];
    expect(payload.components).toEqual([]);
  });

  it('updates the existing message in place when paging via giveaway_listpage_*', async () => {
    mockListGiveaways.mockReturnValueOnce(giveaways(23));
    const interaction = createButtonInteraction('giveaway_listpage_1');

    await giveaway.handleButton?.(interaction as never);

    expect(interaction.update).toHaveBeenCalledTimes(1);
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();

    const payload = interaction.update.mock.calls[0][0];
    const [prev, indicator, next] = navRowButtons(payload);
    expect(indicator.label).toBe('Page 2 / 3');
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(false);
  });

  it('shows the empty-state when there are no active giveaways', async () => {
    mockListGiveaways.mockReturnValueOnce(giveaways(0));
    const interaction = createButtonInteraction('giveaway_panel_list');

    await giveaway.handleButton?.(interaction as never);

    const payload = interaction.editReply.mock.calls[0][0];
    expect(String(payload.content)).toContain('No active giveaways');
  });

  // ARCH-09: the customId codec migration must keep rejecting malformed page ids
  // exactly as the previous `\d+` regex did — a disabled control's negative page
  // or a non-numeric segment is ignored without listing giveaways.
  it.each(['giveaway_listpage_-1', 'giveaway_listpage_abc', 'giveaway_listpage_'])(
    'ignores the malformed page id %s without paging',
    async customId => {
      const interaction = createButtonInteraction(customId);

      await giveaway.handleButton?.(interaction as never);

      expect(interaction.update).not.toHaveBeenCalled();
      expect(mockListGiveaways).not.toHaveBeenCalled();
    }
  );

afterAll(() => {
  jest.restoreAllMocks();
});
});
