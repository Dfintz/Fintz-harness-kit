"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWikiNoResultsEmbed = buildWikiNoResultsEmbed;
exports.buildWikiSearchEmbed = buildWikiSearchEmbed;
exports.buildWikiPageEmbed = buildWikiPageEmbed;
const appUrls_1 = require("../utils/appUrls");
const embedBuilder_1 = require("../utils/embedBuilder");
function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
function stripMarkdown(text) {
    return text.replaceAll(/[#*_~`>|[\]()]/g, '').trim();
}
function buildWikiNoResultsEmbed(query) {
    return embedBuilder_1.SCFleetEmbed.warning('No Wiki Results', `No pages matched **"${truncate(query, 80)}"**. Try a different search term.`).build();
}
function buildWikiSearchEmbed(query, results) {
    const lines = results.map((result, i) => {
        const snippet = result.snippet
            ? truncate(stripMarkdown(result.snippet), 100)
            : 'No preview available.';
        return `**${i + 1}.** \u{1F4C4} **${result.title}** (\`${result.slug}\`)\n> ${snippet}`;
    });
    const wikiUrl = (0, appUrls_1.buildAppUrl)('/wiki');
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle(`Wiki Search: "${truncate(query, 60)}"`)
        .setDescription(lines.join('\n\n'))
        .setFooter({
        text: `${results.length} result${results.length === 1 ? '' : 's'} \u2022 ${wikiUrl}`,
    })
        .setTimestamp()
        .build()
        .setURL(wikiUrl);
}
function buildWikiPageEmbed(page) {
    const contentPreview = page.content
        ? truncate(stripMarkdown(page.content), 1800)
        : '*No content yet.*';
    const pageUrl = (0, appUrls_1.buildAppUrl)(`/wiki/${encodeURIComponent(page.slug)}`);
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle(`\u{1F4D6} ${page.title}`)
        .setDescription(contentPreview)
        .addFields({ name: 'Slug', value: `\`${page.slug}\``, inline: true }, { name: 'Version', value: `${page.version}`, inline: true }, {
        name: 'Status',
        value: page.isLocked ? '\u{1F512} Locked' : '\u{1F4DD} Editable',
        inline: true,
    })
        .setFooter({ text: `Open on the web: ${pageUrl}` })
        .setTimestamp(new Date(page.updatedAt))
        .build()
        .setURL(pageUrl);
}
//# sourceMappingURL=wikiEmbeds.js.map