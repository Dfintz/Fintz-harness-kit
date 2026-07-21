import { EmbedColors } from '../../utils/embedBuilder';
import {
  buildCommunityAnnouncementsEmbed,
  buildCommunityCustomEmbedsEmbed,
  buildCommunityGiveawaysEmbed,
  buildCommunityHubEmbed,
  buildCommunityPollsEmbed,
  buildCommunityReactionRolesEmbed,
} from '../communityEmbeds';

describe('communityEmbeds', () => {
  it('buildCommunityHubEmbed preserves the hub contract', () => {
    const embed = buildCommunityHubEmbed();

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toBe('🎉 Community Tools');
    expect(embed.data.description).toContain('🎁 **Giveaways**');
    expect(embed.data.description).toContain('🎭 **Reaction Roles**');
    expect(embed.data.footer?.text).toBe('Click a button below to open that tool');
    expect(embed.data.timestamp).toBeTruthy();
  });

  it.each([
    ['giveaways', buildCommunityGiveawaysEmbed, '🎁 Giveaways', 'Create and manage giveaways.'],
    ['polls', buildCommunityPollsEmbed, '🗳️ Polls', 'Create and manage organization polls.'],
    [
      'announcements',
      buildCommunityAnnouncementsEmbed,
      '📢 Announcements',
      'Create, manage, and send announcements.',
    ],
    [
      'custom embeds',
      buildCommunityCustomEmbedsEmbed,
      '📝 Custom Embeds',
      'Create and send custom embed messages.',
    ],
    [
      'reaction roles',
      buildCommunityReactionRolesEmbed,
      '🎭 Reaction Roles',
      'Create button-based role self-assignment panels.',
    ],
  ])(
    'builds the %s child panel contract without footer or timestamp',
    (_name, builder, expectedTitle, expectedDescription) => {
      const embed = builder();

      expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
      expect(embed.data.title).toBe(expectedTitle);
      expect(embed.data.description).toBe(expectedDescription);
      expect(embed.data.footer).toBeUndefined();
      expect(embed.data.timestamp).toBeUndefined();
    }
  );

afterAll(() => {
  jest.restoreAllMocks();
});
});
