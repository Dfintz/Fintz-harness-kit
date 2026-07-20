"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPanelCustomId = buildPanelCustomId;
exports.parsePanelCustomId = parsePanelCustomId;
exports.buildButton = buildButton;
exports.buildRow = buildRow;
exports.buildCommandPanel = buildCommandPanel;
exports.replyWithCommandPanel = replyWithCommandPanel;
exports.formatPanelBreadcrumb = formatPanelBreadcrumb;
exports.buildPanelBackButton = buildPanelBackButton;
exports.stripLeadingPanelEmoji = stripLeadingPanelEmoji;
exports.decorateSubpanel = decorateSubpanel;
exports.buildEphemeralPanelEmbed = buildEphemeralPanelEmbed;
exports.replyEphemeralPanel = replyEphemeralPanel;
exports.updateEphemeralPanel = updateEphemeralPanel;
const discord_js_1 = require("discord.js");
const embedBuilder_1 = require("./embedBuilder");
function buildPanelCustomId(prefix, subcommand) {
    return `${prefix}_panel_${subcommand}`;
}
function parsePanelCustomId(customId, prefix) {
    const panelPrefix = `${prefix}_panel_`;
    if (!customId.startsWith(panelPrefix)) {
        return null;
    }
    return customId.slice(panelPrefix.length);
}
function buildButton(customId, label, emoji, style = discord_js_1.ButtonStyle.Secondary) {
    return new discord_js_1.ButtonBuilder().setCustomId(customId).setLabel(label).setEmoji(emoji).setStyle(style);
}
function buildRow(...buttons) {
    return new discord_js_1.ActionRowBuilder().addComponents(...buttons);
}
function buildCommandPanel(config) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(config.color ?? embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle(config.title)
        .setDescription(config.description);
    if (config.footer) {
        embed.setFooter({ text: config.footer });
    }
    const rows = [];
    let currentRow = new discord_js_1.ActionRowBuilder();
    let buttonsInRow = 0;
    for (const btn of config.buttons) {
        if (buttonsInRow >= 5) {
            rows.push(currentRow);
            currentRow = new discord_js_1.ActionRowBuilder();
            buttonsInRow = 0;
        }
        if (rows.length >= 5) {
            break;
        }
        const button = new discord_js_1.ButtonBuilder()
            .setCustomId(buildPanelCustomId(config.prefix, btn.subcommand))
            .setLabel(btn.label)
            .setStyle(btn.style ?? discord_js_1.ButtonStyle.Secondary);
        if (btn.emoji) {
            button.setEmoji(btn.emoji);
        }
        currentRow.addComponents(button);
        buttonsInRow++;
    }
    if (buttonsInRow > 0) {
        rows.push(currentRow);
    }
    return { embed, components: rows };
}
const DEFAULT_COMMAND_PANEL_REPLY_OPTIONS = {
    flags: discord_js_1.MessageFlags.Ephemeral,
};
async function replyWithCommandPanel(interaction, config, replyOptions = DEFAULT_COMMAND_PANEL_REPLY_OPTIONS) {
    const { embed, components } = buildCommandPanel(config);
    await interaction.reply({
        embeds: [embed],
        components,
        ...replyOptions,
    });
}
const PANEL_CONTINUE_FOOTER = 'Use the buttons below to continue';
const PANEL_RETURN_FOOTER = 'Run the command again to return to the root panel';
const PANEL_BREADCRUMB_ICON = '🧭';
const PANEL_BREADCRUMB_SEPARATOR = ' › ';
const PANEL_BACK_EMOJI = '⬅️';
function formatPanelBreadcrumb(trail) {
    const segments = trail.map(segment => segment.trim()).filter(segment => segment.length > 0);
    return `${PANEL_BREADCRUMB_ICON} ${segments.join(PANEL_BREADCRUMB_SEPARATOR)}`;
}
function buildPanelBackButton(customId, label = 'Back') {
    return buildButton(customId, label, PANEL_BACK_EMOJI, discord_js_1.ButtonStyle.Secondary);
}
function stripLeadingPanelEmoji(title) {
    return title.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}
function decorateSubpanel(panel, decoration) {
    const backRow = buildRow(buildPanelBackButton(decoration.backCustomId, decoration.backLabel));
    return {
        ...panel,
        breadcrumb: decoration.breadcrumb,
        rows: [...(panel.rows ?? []), backRow],
    };
}
function buildEphemeralPanelEmbed(content) {
    const hasRows = (content.rows ?? []).length > 0;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle(content.title)
        .setDescription(content.description)
        .setFooter({ text: hasRows ? PANEL_CONTINUE_FOOTER : PANEL_RETURN_FOOTER })
        .setTimestamp();
    const trail = content.breadcrumb ?? [];
    if (trail.length > 0) {
        embed.setAuthor({ name: formatPanelBreadcrumb(trail) });
    }
    return embed;
}
async function replyEphemeralPanel(interaction, content) {
    const rows = content.rows ?? [];
    const hasRows = rows.length > 0;
    const embed = buildEphemeralPanelEmbed(content);
    await interaction.reply({
        embeds: [embed],
        ...(hasRows ? { components: rows } : {}),
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function updateEphemeralPanel(interaction, content) {
    const rows = content.rows ?? [];
    await interaction.update({
        embeds: [buildEphemeralPanelEmbed(content)],
        components: rows,
    });
}
//# sourceMappingURL=commandPanelBuilder.js.map