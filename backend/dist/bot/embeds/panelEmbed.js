"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPanelEmbed = buildPanelEmbed;
exports.buildPanelButtons = buildPanelButtons;
exports.parsePanelButtonId = parsePanelButtonId;
exports.buildPanelModal = buildPanelModal;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const embedBuilder_1 = require("../utils/embedBuilder");
function buildPanelEmbed(config) {
    const embed = embedBuilder_1.SCFleetEmbed.create()
        .setColor(config.color ?? embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle((0, shared_types_1.decodeHtmlEntities)(config.title))
        .setDescription((0, shared_types_1.decodeHtmlEntities)(config.description));
    for (const btn of config.buttons) {
        embed.addFields({
            name: `${btn.emoji ?? ''} ${(0, shared_types_1.decodeHtmlEntities)(btn.label)}`.trim(),
            value: (0, shared_types_1.decodeHtmlEntities)(btn.description),
            inline: true,
        });
    }
    if (config.footer) {
        embed.setFooter({ text: (0, shared_types_1.decodeHtmlEntities)(config.footer) });
    }
    return embed.setTimestamp().build();
}
function buildPanelButtons(config) {
    const row = new discord_js_1.ActionRowBuilder();
    for (const btn of config.buttons) {
        const builder = new discord_js_1.ButtonBuilder()
            .setCustomId(`${config.prefix}_panel_${btn.action}`)
            .setLabel((0, shared_types_1.decodeHtmlEntities)(btn.label))
            .setStyle(btn.style);
        if (btn.emoji) {
            builder.setEmoji(btn.emoji);
        }
        row.addComponents(builder);
    }
    return row;
}
function parsePanelButtonId(customId) {
    const match = /^([a-z]+)_panel_([a-z_]+)$/.exec(customId);
    if (!match) {
        return null;
    }
    return { prefix: match[1], action: match[2] };
}
function buildPanelModal(customId, title, fields) {
    const modal = new discord_js_1.ModalBuilder().setCustomId(customId).setTitle((0, shared_types_1.decodeHtmlEntities)(title));
    for (const field of fields.slice(0, 5)) {
        let resolvedStyle;
        if (field.style === 'paragraph') {
            resolvedStyle = discord_js_1.TextInputStyle.Paragraph;
        }
        else if (field.style === 'short') {
            resolvedStyle = discord_js_1.TextInputStyle.Short;
        }
        else {
            resolvedStyle = field.style;
        }
        const input = new discord_js_1.TextInputBuilder()
            .setCustomId(field.customId)
            .setStyle(resolvedStyle)
            .setRequired(field.required ?? true);
        if (field.placeholder) {
            input.setPlaceholder((0, shared_types_1.decodeHtmlEntities)(field.placeholder));
        }
        if (field.minLength !== undefined) {
            input.setMinLength(field.minLength);
        }
        if (field.maxLength !== undefined) {
            input.setMaxLength(field.maxLength);
        }
        if (field.value !== undefined) {
            input.setValue((0, shared_types_1.decodeHtmlEntities)(field.value));
        }
        modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel((0, shared_types_1.decodeHtmlEntities)(field.label)).setTextInputComponent(input));
    }
    return modal;
}
//# sourceMappingURL=panelEmbed.js.map