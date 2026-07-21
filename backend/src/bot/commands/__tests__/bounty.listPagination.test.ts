import { BountyType } from '../../../models/Bounty';

const mockSearchBounties = jest.fn();
const mockResolveGuildContext = jest.fn();

// bounty.ts lazily constructs services via getServices(); mock the service module
// and the guild→org resolver so importing the command and running the list-page
// route never touches the DB.
jest.mock('../../../services/bounty', () => ({
  BountyService: jest.fn().mockImplementation(() => ({
    searchBounties: (...args: unknown[]) => mockSearchBounties(...args),
  })),
  BountyClaimService: jest.fn().mockImplementation(() => ({})),
  HunterProfileService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../utils/guildContext', () => ({
  resolveGuildContext: (...args: unknown[]) => mockResolveGuildContext(...args),
}));

import { bounty } from '../bounty';

/** Build `count` minimal active-bounty fixtures shaped like the list view consumes. */
function bounties(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `bounty-${i + 1}`,
    title: `Bounty ${i + 1}`,
    bountyType: BountyType.KILL,
    rewardAmount: 1000 * (i + 1),
    rewardDescription: null,
  }));
}

/**
 * Resolve `searchBounties` with one server page: `pageItems` rows plus the
 * server-reported `total` / `totalPages` (1-based `page`).
 */
function resolvePage(pageItems: number, total: number, totalPages: number, page = 1): void {
  mockSearchBounties.mockResolvedValueOnce({
    bounties: bounties(pageItems),
    total,
    page,
    totalPages,
  });
}

/** Minimal ButtonInteraction stub for the list-page route. */
function createButtonInteraction(customId: string) {
  return {
    customId,
    user: { id: 'discord-user-1', username: 'Hunter' },
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

describe('bounty active-list pagination (CMD-03, server-paginated)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveGuildContext.mockResolvedValue({ guildId: 'guild-1', organizationId: 'org-1' });
  });

  it('updates in place with pagination controls when more than one server page exists', async () => {
    resolvePage(10, 23, 3); // page 1 of 3
    const interaction = createButtonInteraction('bounty_listpage_0');

    await bounty.handleButton?.(interaction as never);

    // Paging edits the existing ephemeral list (update), not a fresh reply/defer.
    expect(interaction.update).toHaveBeenCalledTimes(1);
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
    // Server query asked for page 1 (uiPage 0 + 1) with the list page size.
    expect(mockSearchBounties).toHaveBeenCalledWith('org-1', expect.any(Object), 1, 10);

    const payload = interaction.update.mock.calls[0][0];
    const [prev, indicator, next] = navRowButtons(payload);
    expect(indicator.label).toBe('Page 1 / 3');
    expect(prev.custom_id).toBe('bounty_listpage_-1');
    expect(prev.disabled).toBe(true);
    expect(next.custom_id).toBe('bounty_listpage_1');
    expect(next.disabled).toBe(false);
  });

  it('shows no pagination row when a single server page fits', async () => {
    resolvePage(4, 4, 1);
    const interaction = createButtonInteraction('bounty_listpage_0');

    await bounty.handleButton?.(interaction as never);

    const payload = interaction.update.mock.calls[0][0];
    expect(payload.components).toEqual([]);
  });

  it('renders the requested middle page with both controls enabled', async () => {
    resolvePage(10, 23, 3, 2); // page 2 of 3
    const interaction = createButtonInteraction('bounty_listpage_1');

    await bounty.handleButton?.(interaction as never);

    expect(mockSearchBounties).toHaveBeenCalledWith('org-1', expect.any(Object), 2, 10);
    const payload = interaction.update.mock.calls[0][0];
    const [prev, indicator, next] = navRowButtons(payload);
    expect(indicator.label).toBe('Page 2 / 3');
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(false);
  });

  it('collapses to the empty-state when there are no active bounties', async () => {
    resolvePage(0, 0, 0);
    const interaction = createButtonInteraction('bounty_listpage_2');

    await bounty.handleButton?.(interaction as never);

    const payload = interaction.update.mock.calls[0][0];
    expect(String(payload.content)).toContain('No active bounties');
    expect(payload.components).toEqual([]);
  });

  it('does not act when the guild is not linked to an organization', async () => {
    mockResolveGuildContext.mockResolvedValueOnce(null); // resolver handles its own guidance reply
    const interaction = createButtonInteraction('bounty_listpage_0');

    await bounty.handleButton?.(interaction as never);

    expect(interaction.update).not.toHaveBeenCalled();
    expect(mockSearchBounties).not.toHaveBeenCalled();
  });

  // ARCH-09: the customId codec migration must keep rejecting malformed page ids
  // exactly as the previous `\d+` regex did — a disabled control's negative page
  // or a non-numeric segment is ignored without resolving the guild or querying.
  it.each(['bounty_listpage_-1', 'bounty_listpage_abc', 'bounty_listpage_'])(
    'ignores the malformed page id %s without resolving the guild or querying',
    async customId => {
      const interaction = createButtonInteraction(customId);

      await bounty.handleButton?.(interaction as never);

      expect(interaction.update).not.toHaveBeenCalled();
      expect(mockResolveGuildContext).not.toHaveBeenCalled();
      expect(mockSearchBounties).not.toHaveBeenCalled();
    }
  );

afterAll(() => {
  jest.restoreAllMocks();
});
});
