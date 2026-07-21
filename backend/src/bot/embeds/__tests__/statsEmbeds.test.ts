import { EmbedColors } from '../../utils/embedBuilder';
import {
  buildEngagementLeaderboardEmbed,
  buildInviteLeaderboardEmbed,
  buildUserStatsEmbed,
} from '../statsEmbeds';

describe('buildUserStatsEmbed', () => {
  it('renders the title, INFO color, and message/voice fields', () => {
    const embed = buildUserStatsEmbed({ messageCount: 5, voiceMinutes: 125 });

    expect(embed.data.title).toBe('\u{1F4CA} Your Engagement Stats (30 days)');
    expect(embed.data.color).toBe(EmbedColors.INFO);
    expect(embed.data.color).toBe(0x5865f2);

    const fields = embed.data.fields ?? [];
    expect(fields).toHaveLength(2);
    expect(fields[0].name).toContain('Messages');
    expect(fields[0].value).toBe('5');
    expect(fields[1].name).toContain('Voice');
    expect(fields[1].value).toBe('2h 5m');
  });

  it('formats zero voice minutes as 0h 0m', () => {
    const embed = buildUserStatsEmbed({ messageCount: 0, voiceMinutes: 0 });
    const fields = embed.data.fields ?? [];

    expect(fields[1].value).toBe('0h 0m');
  });
});

describe('buildInviteLeaderboardEmbed', () => {
  it('renders the title, INFO color, and singular/plural invite lines', () => {
    const embed = buildInviteLeaderboardEmbed([
      { inviterUserId: 'u1', count: 1 },
      { inviterUserId: 'u2', count: 3 },
    ]);

    expect(embed.data.title).toBe('\u{1F4E8} Invite Leaderboard');
    expect(embed.data.color).toBe(EmbedColors.INFO);
    expect(embed.data.description).toBe(
      '**1.** <@u1> \u2014 1 invite\n**2.** <@u2> \u2014 3 invites'
    );
  });
});

describe('buildEngagementLeaderboardEmbed', () => {
  it('renders raw totals for the messageCount metric', () => {
    const embed = buildEngagementLeaderboardEmbed([{ userId: 'u1', total: 42 }], 'messageCount');

    expect(embed.data.title).toBe('\u{1F4CA} \u{1F4AC} Messages Leaderboard (30 days)');
    expect(embed.data.color).toBe(EmbedColors.INFO);
    expect(embed.data.description).toBe('**1.** <@u1> \u2014 42');
  });

  it('formats hours/minutes for the voiceMinutes metric', () => {
    const embed = buildEngagementLeaderboardEmbed([{ userId: 'u1', total: 125 }], 'voiceMinutes');

    expect(embed.data.title).toBe('\u{1F4CA} \u{1F3A4} Voice Leaderboard (30 days)');
    expect(embed.data.description).toBe('**1.** <@u1> \u2014 2h 5m');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
