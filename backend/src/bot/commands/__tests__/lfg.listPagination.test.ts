// Unit tests for the LFG active-list pagination view (C2 / CMD-03).
//
// lfg.ts has a heavy service-import surface (rate limiter, settings, social,
// reputation, presence monitor), so the pure list-view builder is exported and
// tested directly. The heavy modules are mocked at import so loading lfg.ts has
// no side effects (singletons/timers).

jest.mock('../../../services/shared/RedisRateLimiter', () => ({
  redisRateLimiter: { checkLimit: jest.fn(), recordHit: jest.fn() },
}));
const mockGetSettings = jest.fn();
const mockResolveOrganization = jest.fn();

jest.mock('../../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
  },
}));
jest.mock('../../../services/discord/GuildOrganizationService', () => ({
  GuildOrganizationService: {
    getInstance: jest.fn(() => ({
      resolveOrganization: (...args: unknown[]) => mockResolveOrganization(...args),
    })),
  },
}));
jest.mock('../../../services/social', () => ({
  SocialGroupService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock('../../../services/social/ReputationService', () => ({
  ReputationService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../services/communication', () => ({
  VoiceChannelService: { getInstance: jest.fn(() => ({})) },
}));
jest.mock('../../voice/lfgPresenceMonitor', () => ({
  LfgPresenceMonitor: { getInstance: jest.fn(() => ({})) },
}));

import { LFGActivity, LFGPost } from '../../../types';
import { _buildLfgListView, _resolveLfgMentionRoleIdForGuild } from '../lfg';

function makePost(i: number): LFGPost {
  return {
    id: `post-${i}`,
    activity: LFGActivity.PVE,
    description: `Op ${i}`,
    creatorId: `creator-${i}`,
    creatorName: `Pilot ${i}`,
    currentPlayers: 1,
    maxPlayers: 4,
    members: [],
    createdAt: new Date('2026-06-14T00:00:00.000Z'),
    expiresAt: new Date('2026-06-14T02:00:00.000Z'),
    guildId: 'guild-1',
    channelId: 'channel-1',
    status: 'open',
  };
}

function makePosts(n: number): LFGPost[] {
  return Array.from({ length: n }, (_, i) => makePost(i + 1));
}

describe('_buildLfgListView pagination', () => {
  it('renders the first page with nav controls when there are multiple pages', () => {
    const { embeds, components } = _buildLfgListView(makePosts(25), 0);

    // 10 per page → 25 posts = 3 pages, first page shows 10 fields.
    expect(embeds[0].data.fields).toHaveLength(10);
    expect(components).toHaveLength(1);

    const ids = components[0].components.map(c => c.toJSON().custom_id);
    // Prev/Next target page ± 1; the disabled Prev on page 0 targets -1 (never clicked,
    // and the handler ignores a negative page).
    expect(ids).toEqual(['lfg_listpage_-1', 'pagination_indicator_noop', 'lfg_listpage_1']);

    // Prev disabled on the first page, Next enabled.
    const [prev, indicator, next] = components[0].components.map(c => c.toJSON());
    expect(prev.disabled).toBe(true);
    expect(indicator.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    expect(embeds[0].data.footer?.text).toBe('Page 1 of 3 \u2022 25 posts');
  });

  it('omits the nav row and footer when everything fits on one page', () => {
    const { embeds, components } = _buildLfgListView(makePosts(4), 0);

    expect(embeds[0].data.fields).toHaveLength(4);
    expect(components).toHaveLength(0);
    expect(embeds[0].data.footer).toBeUndefined();
  });

  it('clamps a stale/out-of-range page to the last page', () => {
    // 25 posts = 3 pages (indices 0..2); requesting page 9 clamps to page 2 (5 items).
    const { embeds, components } = _buildLfgListView(makePosts(25), 9);

    expect(embeds[0].data.fields).toHaveLength(5);
    const [prev, , next] = components[0].components.map(c => c.toJSON());
    expect(prev.disabled).toBe(false); // not on the first page
    expect(next.disabled).toBe(true); // on the last page
    expect(embeds[0].data.footer?.text).toBe('Page 3 of 3 \u2022 25 posts');
  });

  it('builds page-targeted customIds for the middle page', () => {
    const { components } = _buildLfgListView(makePosts(25), 1);
    const ids = components[0].components.map(c => c.toJSON().custom_id);
    expect(ids).toEqual(['lfg_listpage_0', 'pagination_indicator_noop', 'lfg_listpage_2']);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});

describe('_resolveLfgMentionRoleIdForGuild', () => {
  beforeEach(() => {
    mockResolveOrganization.mockReset();
    mockGetSettings.mockReset();
  });

  it('resolves organization then returns mention role id from guild settings', async () => {
    mockResolveOrganization.mockResolvedValue('org-1');
    mockGetSettings.mockResolvedValue({
      lfgSettings: {
        lfgMentionRoleId: '123456789012345678',
      },
    });

    const result = await _resolveLfgMentionRoleIdForGuild('guild-1');

    expect(mockResolveOrganization).toHaveBeenCalledWith('guild-1');
    expect(mockGetSettings).toHaveBeenCalledWith('org-1', 'guild-1');
    expect(result).toBe('123456789012345678');
  });

  it('returns undefined when settings have no mention role id', async () => {
    mockResolveOrganization.mockResolvedValue('org-1');
    mockGetSettings.mockResolvedValue({ lfgSettings: {} });

    const result = await _resolveLfgMentionRoleIdForGuild('guild-1');

    expect(result).toBeUndefined();
  });

  it('returns undefined when resolution fails', async () => {
    mockResolveOrganization.mockRejectedValue(new Error('boom'));

    const result = await _resolveLfgMentionRoleIdForGuild('guild-1');

    expect(result).toBeUndefined();
  });
});
