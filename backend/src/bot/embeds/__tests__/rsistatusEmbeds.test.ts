import { EmbedColors } from '../../utils/embedBuilder';
import { buildRsiStatusRootMenuEmbed } from '../rsistatusEmbeds';

describe('rsistatusEmbeds', () => {
  it('buildRsiStatusRootMenuEmbed preserves title, color, and description contract', () => {
    const embed = buildRsiStatusRootMenuEmbed();

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toBe('🛰️ RSI Status Monitor');
    expect(embed.data.description).toBe(
      'Check the current RSI service status, deploy a live-updating panel, or mirror the ' +
        'status into channel names with an emoji.'
    );
  });

  it('buildRsiStatusRootMenuEmbed does not set timestamp or footer', () => {
    const embed = buildRsiStatusRootMenuEmbed();

    expect(embed.data.timestamp).toBeUndefined();
    expect(embed.data.footer).toBeUndefined();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
