import { EmbedColors } from '../../utils/embedBuilder';
import {
  buildBriefingUsageEmbed,
  buildGeneratedMissionBriefingEmbed,
  buildQuickMissionBriefingEmbed,
} from '../briefingEmbeds';

describe('briefingEmbeds', () => {
  it('builds usage embed contract', () => {
    const embed = buildBriefingUsageEmbed({
      requestCount: 4,
      dailyLimit: 20,
      remaining: 16,
      totalTokens: 12345,
    });

    expect(embed.data.color).toBe(EmbedColors.INFO);
    expect(embed.data.title).toBe('📊 Briefing Usage');
    expect(embed.data.fields).toHaveLength(4);
    expect(embed.data.fields?.[0]).toMatchObject({ name: 'Used Today', value: '4', inline: true });
    expect(embed.data.fields?.[3]).toMatchObject({
      name: 'Total Tokens',
      value: '12,345',
      inline: true,
    });
    expect(embed.data.footer?.text).toBe('Limits reset daily at midnight UTC');
    expect(embed.data.timestamp).toBeDefined();
  });

  it('builds generated mission briefing embed contract', () => {
    const embed = buildGeneratedMissionBriefingEmbed({
      missionTitle: 'Operation Hammerfall',
      briefingText: 'Primary objective details',
      modelUsed: 'gpt-x',
      tokensUsed: 4567,
      missionId: 'mission-123',
    });

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toBe('Briefing: Operation Hammerfall');
    expect(embed.data.description).toBe('Primary objective details');
    expect(embed.data.fields).toHaveLength(2);
    expect(embed.data.fields?.[1]).toMatchObject({ name: 'Tokens', value: '4,567', inline: true });
    expect(embed.data.footer?.text).toBe('Mission ID: mission-123');
    expect(embed.data.timestamp).toBeDefined();
  });

  it('builds quick mission briefing embed contract and fallback text', () => {
    const embed = buildQuickMissionBriefingEmbed({
      missionTypeLabel: 'Combat',
      briefingText: '',
      modelUsed: 'gpt-x',
      tokensUsed: 98,
    });

    expect(embed.data.color).toBe(EmbedColors.QUANTUM_GOLD);
    expect(embed.data.title).toBe('Quick Briefing: Combat Mission');
    expect(embed.data.description).toBe('*No briefing content generated.*');
    expect(embed.data.fields).toHaveLength(3);
    expect(embed.data.fields?.[0]).toMatchObject({ name: 'Difficulty', value: 'Medium' });
    expect(embed.data.footer?.text).toBe('Quick briefing — not attached to a saved mission');
    expect(embed.data.timestamp).toBeDefined();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
