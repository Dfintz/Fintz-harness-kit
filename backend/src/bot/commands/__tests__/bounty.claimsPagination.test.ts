import { BountyClaimStatus } from '../../../models/BountyClaim';

const mockGetActiveClaimsByHunter = jest.fn();

// bounty.ts lazily constructs services via getServices(); mock the service module
// so importing the command and running the claims-page route never touches the DB.
jest.mock('../../../services/bounty', () => ({
  BountyService: jest.fn().mockImplementation(() => ({})),
  BountyClaimService: jest.fn().mockImplementation(() => ({
    getActiveClaimsByHunter: (...args: unknown[]) => mockGetActiveClaimsByHunter(...args),
  })),
  HunterProfileService: jest.fn().mockImplementation(() => ({})),
}));

import { bounty } from '../bounty';

/** Build `count` minimal active-claim fixtures shaped like the view consumes. */
function claims(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    bountyId: `bounty-${i + 1}-abcdefgh`,
    status: BountyClaimStatus.ACTIVE,
    claimedAt: new Date('2026-01-01T00:00:00Z'),
    evidence: [],
    bounty: { title: `Bounty ${i + 1}` },
  }));
}

/** Minimal ButtonInteraction stub for the claims-page route. */
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

describe('bounty My Claims pagination (C2 / CMD-03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates in place with pagination controls when more than one page exists', async () => {
    mockGetActiveClaimsByHunter.mockResolvedValueOnce(claims(23));
    const interaction = createButtonInteraction('bounty_claimspage_0');

    await bounty.handleButton?.(interaction as never);

    // Paging edits the existing ephemeral list (update), not a fresh reply/defer.
    expect(interaction.update).toHaveBeenCalledTimes(1);
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(mockGetActiveClaimsByHunter).toHaveBeenCalledWith('discord-user-1');

    const payload = interaction.update.mock.calls[0][0];
    const [prev, indicator, next] = navRowButtons(payload);
    expect(indicator.label).toBe('Page 1 / 3');
    expect(prev.custom_id).toBe('bounty_claimspage_-1');
    expect(prev.disabled).toBe(true);
    expect(next.custom_id).toBe('bounty_claimspage_1');
    expect(next.disabled).toBe(false);
  });

  it('shows no pagination row when a single page fits', async () => {
    mockGetActiveClaimsByHunter.mockResolvedValueOnce(claims(4));
    const interaction = createButtonInteraction('bounty_claimspage_0');

    await bounty.handleButton?.(interaction as never);

    const payload = interaction.update.mock.calls[0][0];
    expect(payload.components).toEqual([]);
  });

  it('renders the requested middle page with both controls enabled', async () => {
    mockGetActiveClaimsByHunter.mockResolvedValueOnce(claims(23));
    const interaction = createButtonInteraction('bounty_claimspage_1');

    await bounty.handleButton?.(interaction as never);

    const payload = interaction.update.mock.calls[0][0];
    const [prev, indicator, next] = navRowButtons(payload);
    expect(indicator.label).toBe('Page 2 / 3');
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(false);
  });

  it('collapses to the empty-state when there are no active claims', async () => {
    mockGetActiveClaimsByHunter.mockResolvedValueOnce(claims(0));
    const interaction = createButtonInteraction('bounty_claimspage_2');

    await bounty.handleButton?.(interaction as never);

    const payload = interaction.update.mock.calls[0][0];
    expect(String(payload.content)).toContain('no active bounty claims');
    expect(payload.components).toEqual([]);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
