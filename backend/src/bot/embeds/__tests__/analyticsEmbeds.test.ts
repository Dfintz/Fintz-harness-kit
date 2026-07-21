import { buildBotAnalyticsSummaryEmbed } from '../analyticsEmbeds';

describe('buildBotAnalyticsSummaryEmbed', () => {
  it('builds the exact analytics summary shape', () => {
    const embed = buildBotAnalyticsSummaryEmbed({
      totalCommands: 12,
      successRate: '75.0',
      averageExecutionTime: 123.4,
      uptimeHours: 2,
      uptimeMinutes: 5,
      uniqueUsers: 7,
      wsPing: 42,
      uniqueGuilds: 3,
      topList: '1. `/ping` — 4\n2. `/help` — 3',
    });

    expect(embed.data.title).toBe('Bot Analytics Summary');
    expect(embed.data.color).toBe(0x0099ff);

    const fields = embed.data.fields ?? [];
    expect(fields).toHaveLength(7);

    expect(fields[0]).toMatchObject({
      name: 'Commands Today',
      value: '12 (75.0% success)',
      inline: true,
    });
    expect(fields[1]).toMatchObject({
      name: 'Avg Response',
      value: '123ms',
      inline: true,
    });
    expect(fields[2]).toMatchObject({
      name: 'Uptime',
      value: '2h 5m',
      inline: true,
    });
    expect(fields[3]).toMatchObject({
      name: 'Unique Users',
      value: '7',
      inline: true,
    });
    expect(fields[4]).toMatchObject({
      name: 'WebSocket Ping',
      value: '42ms',
      inline: true,
    });
    expect(fields[5]).toMatchObject({
      name: 'Guilds',
      value: '3',
      inline: true,
    });
    expect(fields[6]).toMatchObject({
      name: 'Top 5 Commands',
      value: '1. `/ping` — 4\n2. `/help` — 3',
      inline: false,
    });

    expect(embed.data.footer?.text).toBe('Full analytics at fringecore.space/bot-stats');
    expect(embed.data.timestamp).toBeDefined();
  });

  it('preserves the top-list fallback text verbatim', () => {
    const embed = buildBotAnalyticsSummaryEmbed({
      totalCommands: 0,
      successRate: '0.0',
      averageExecutionTime: 0,
      uptimeHours: 0,
      uptimeMinutes: 0,
      uniqueUsers: 0,
      wsPing: 0,
      uniqueGuilds: 0,
      topList: 'No data yet',
    });

    const fields = embed.data.fields ?? [];
    expect(fields[6]?.value).toBe('No data yet');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
