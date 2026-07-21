import { EmbedBuilder } from 'discord.js';

import { buildAppUrl } from '../utils/appUrls';
import { EmbedColors, SCFleetEmbed } from '../utils/embedBuilder';

/**
 * Pure builders for the `/wiki` command embeds (no-results, search, page).
 *
 * Extracted from `commands/wiki.ts` so the three embeds live in one place, render through the
 * shared `SCFleetEmbed` factory, and gain clickable title deep links to the web wiki. Inputs are
 * narrow structural shapes (not the TypeORM entity) so the builders stay decoupled and testable.
 */

/** Minimal shape needed to render a single wiki page embed. */
export interface WikiPageInput {
  title: string;
  slug: string;
  content?: string | null;
  version: number;
  isLocked: boolean;
  updatedAt: string | Date;
}

/** Minimal shape needed to render one wiki search result line. */
export interface WikiSearchResultInput {
  title: string;
  slug: string;
  snippet?: string | null;
}

/** Truncate text to a max length with an ellipsis. */
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Strip common Markdown control characters for plain-text previews. */
function stripMarkdown(text: string): string {
  return text.replaceAll(/[#*_~`>|[\]()]/g, '').trim();
}

/** Embed shown when a wiki search matches no pages. */
export function buildWikiNoResultsEmbed(query: string): EmbedBuilder {
  return SCFleetEmbed.warning(
    'No Wiki Results',
    `No pages matched **"${truncate(query, 80)}"**. Try a different search term.`
  ).build();
}

/** Embed listing wiki search hits, with a clickable title deep link to the web wiki index. */
export function buildWikiSearchEmbed(
  query: string,
  results: readonly WikiSearchResultInput[]
): EmbedBuilder {
  const lines = results.map((result, i) => {
    const snippet = result.snippet
      ? truncate(stripMarkdown(result.snippet), 100)
      : 'No preview available.';
    return `**${i + 1}.** \u{1F4C4} **${result.title}** (\`${result.slug}\`)\n> ${snippet}`;
  });

  const wikiUrl = buildAppUrl('/wiki');

  return SCFleetEmbed.create()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle(`Wiki Search: "${truncate(query, 60)}"`)
    .setDescription(lines.join('\n\n'))
    .setFooter({
      text: `${results.length} result${results.length === 1 ? '' : 's'} \u2022 ${wikiUrl}`,
    })
    .setTimestamp()
    .build()
    .setURL(wikiUrl);
}

/** Embed rendering a single wiki page, with a clickable title deep link to that page on the web. */
export function buildWikiPageEmbed(page: WikiPageInput): EmbedBuilder {
  const contentPreview = page.content
    ? truncate(stripMarkdown(page.content), 1800)
    : '*No content yet.*';

  const pageUrl = buildAppUrl(`/wiki/${encodeURIComponent(page.slug)}`);

  return SCFleetEmbed.create()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle(`\u{1F4D6} ${page.title}`)
    .setDescription(contentPreview)
    .addFields(
      { name: 'Slug', value: `\`${page.slug}\``, inline: true },
      { name: 'Version', value: `${page.version}`, inline: true },
      {
        name: 'Status',
        value: page.isLocked ? '\u{1F512} Locked' : '\u{1F4DD} Editable',
        inline: true,
      }
    )
    .setFooter({ text: `Open on the web: ${pageUrl}` })
    .setTimestamp(new Date(page.updatedAt))
    .build()
    .setURL(pageUrl);
}
