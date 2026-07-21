import {
  buildActiveLfgGroupsEmbed,
  buildDiscoveredOpportunitiesEmbed,
  buildLfgStatsEmbed,
  buildNoGroupsFoundEmbed,
  buildNoOpportunitiesEmbed,
} from '../discoverEmbeds';

describe('discoverEmbeds', () => {
  it('builds no-opportunities and no-groups embeds', () => {
    const opportunities = buildNoOpportunitiesEmbed();
    expect(opportunities.data.title).toBe('🔍 No Opportunities Found');
    expect(opportunities.data.color).toBe(0xffaa00);

    const groups = buildNoGroupsFoundEmbed('No groups right now');
    expect(groups.data.title).toBe('🔍 No Groups Found');
    expect(groups.data.description).toBe('No groups right now');
    expect(groups.data.color).toBe(0xffaa00);
  });

  it('builds opportunities and groups list embeds with footers', () => {
    const opportunities = buildDiscoveredOpportunitiesEmbed(['line one', 'line two'], {
      total: 12,
      page: 1,
      totalPages: 2,
    });
    expect(opportunities.data.title).toBe('🔍 Discovered Opportunities');
    expect(opportunities.data.description).toContain('line one');
    expect(opportunities.data.footer?.text).toContain('Showing 2 of 12 results');

    const groups = buildActiveLfgGroupsEmbed(['group line'], 1);
    expect(groups.data.title).toBe('🎮 Active LFG Groups');
    expect(groups.data.description).toContain('group line');
    expect(groups.data.footer?.text).toContain('1 group found');
  });

  it('builds lfg stats embed and zero-session fallback text', () => {
    const withSessions = buildLfgStatsEmbed('Pilot One', 'https://example.com/avatar.png', {
      totalSessions: 5,
      successfulSessions: 4,
      failedSessions: 1,
      successRate: 80,
      averageDuration: 45,
      favoriteActivity: 'Mining',
      totalPlayersEncountered: 23,
    });

    expect(withSessions.data.title).toBe('📊 LFG Stats — Pilot One');
    expect(withSessions.data.thumbnail?.url).toBe('https://example.com/avatar.png');
    expect(withSessions.data.fields).toHaveLength(7);
    expect(withSessions.data.fields?.[0]).toMatchObject({
      name: '🎮 Total Sessions',
      value: '5',
      inline: true,
    });

    const noSessions = buildLfgStatsEmbed('Pilot Two', 'https://example.com/avatar2.png', {
      totalSessions: 0,
      successfulSessions: 0,
      failedSessions: 0,
      successRate: 0,
      averageDuration: null,
      favoriteActivity: null,
      totalPlayersEncountered: 0,
    });

    expect(noSessions.data.description).toBe(
      'No LFG sessions recorded yet. Use `/lfg create` to start grouping!'
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
