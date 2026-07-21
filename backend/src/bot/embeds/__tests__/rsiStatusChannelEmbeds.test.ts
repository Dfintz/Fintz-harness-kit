import { EmbedColors } from '../../utils/embedBuilder';
import { buildRsiStatusChannelMenuEmbed } from '../rsiStatusChannelEmbeds';

describe('rsiStatusChannelEmbeds', () => {
  it('buildRsiStatusChannelMenuEmbed preserves static copy and footer', () => {
    const embed = buildRsiStatusChannelMenuEmbed(
      'Application (Platform): *not set*',
      'Servers (Persistent Universe): *not set*'
    );

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toBe('🏷️ RSI Status Channels');
    expect(embed.data.description).toContain(
      'Show RSI status as a channel name with a status emoji that auto-updates every 5 minutes.'
    );
    expect(embed.data.description).toContain(
      '• 🟢 Operational · 🟡 Degraded · 🔧 Maintenance · 🔴 Outage · ⚪ Unknown'
    );
    expect(embed.data.description).toContain(
      '**Create channels** — the bot makes two locked voice channels for you.'
    );
    expect(embed.data.description).toContain(
      '**Use existing** — search and pick a channel below; the bot keeps its name in sync.'
    );
    expect(embed.data.footer?.text).toBe('Requires the Manage Channels permission.');
    expect(embed.data.timestamp).toBeUndefined();
  });

  it('renders provided status lines for existing and bot-created channels', () => {
    const embed = buildRsiStatusChannelMenuEmbed(
      'Application (Platform): <#123> (existing)',
      'Servers (Persistent Universe): <#456> (bot-created)'
    );

    expect(embed.data.description).toContain('Application (Platform): <#123> (existing)');
    expect(embed.data.description).toContain('Servers (Persistent Universe): <#456> (bot-created)');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
