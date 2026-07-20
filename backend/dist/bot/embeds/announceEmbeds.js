"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPreviewEmbed = buildPreviewEmbed;
exports.getStatusEmoji = getStatusEmoji;
exports.buildAnnouncementCreatedEmbed = buildAnnouncementCreatedEmbed;
exports.buildAnnouncementCreatedFromTemplateEmbed = buildAnnouncementCreatedFromTemplateEmbed;
exports.buildAllianceDeliveryResultEmbed = buildAllianceDeliveryResultEmbed;
exports.buildAnnouncementStatusEmbed = buildAnnouncementStatusEmbed;
exports.buildAnnouncementListEmbed = buildAnnouncementListEmbed;
exports.buildTemplatesPanelEmbed = buildTemplatesPanelEmbed;
exports.buildTemplatesListEmbed = buildTemplatesListEmbed;
exports.buildAnnouncementScheduledEmbed = buildAnnouncementScheduledEmbed;
exports.buildTemplateCreatedEmbed = buildTemplateCreatedEmbed;
const discord_js_1 = require("discord.js");
const Announcement_1 = require("../../models/Announcement");
const embedBuilder_1 = require("../utils/embedBuilder");
function buildPreviewEmbed(title, content, config) {
    const embed = new discord_js_1.EmbedBuilder().setTitle(title).setDescription(content);
    if (config.color) {
        const colorInt = Number.parseInt(config.color.replace('#', ''), 16);
        embed.setColor(colorInt);
    }
    if (config.imageUrl) {
        embed.setImage(config.imageUrl);
    }
    if (config.thumbnailUrl) {
        embed.setThumbnail(config.thumbnailUrl);
    }
    if (config.timestamp) {
        embed.setTimestamp();
    }
    return embed;
}
function getStatusEmoji(status) {
    switch (status) {
        case Announcement_1.AnnouncementStatus.DRAFT:
            return '\u{1F4DD}';
        case Announcement_1.AnnouncementStatus.SCHEDULED:
            return '\u{1F4C5}';
        case Announcement_1.AnnouncementStatus.SENDING:
            return '\u23f3';
        case Announcement_1.AnnouncementStatus.SENT:
            return '\u2705';
        case Announcement_1.AnnouncementStatus.FAILED:
            return '\u274c';
        case Announcement_1.AnnouncementStatus.CANCELLED:
            return '\u{1F6AB}';
        default:
            return '\u{1F4C4}';
    }
}
function buildAnnouncementCreatedEmbed(announcementId, createdByUsername) {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SUCCESS)
        .setTitle('\u2705 Announcement Created')
        .setDescription('Your announcement has been created as a draft.')
        .addFields({ name: 'Announcement ID', value: `\`${announcementId}\``, inline: true }, { name: 'Status', value: '\u{1F4DD} Draft', inline: true }, { name: 'Created By', value: createdByUsername, inline: true })
        .setFooter({ text: `Use /announce send id:${announcementId} or the panel to send` });
}
function buildAnnouncementCreatedFromTemplateEmbed(announcementId, title) {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SUCCESS)
        .setTitle('\u2705 Announcement Created from Template')
        .setDescription('Your announcement has been created as a draft.')
        .addFields({ name: 'Announcement ID', value: `\`${announcementId}\``, inline: true }, { name: 'Title', value: title, inline: true }, { name: 'Status', value: '\u{1F4DD} Draft', inline: true });
}
function buildAllianceDeliveryResultEmbed(result) {
    return new discord_js_1.EmbedBuilder()
        .setColor(result.success
        ? embedBuilder_1.EmbedColors.SUCCESS
        : result.successfulDeliveries > 0
            ? embedBuilder_1.EmbedColors.WARNING
            : embedBuilder_1.EmbedColors.ERROR)
        .setTitle(result.success
        ? '\u2705 Alliance Announcement Sent'
        : result.successfulDeliveries > 0
            ? '\u26a0\uFE0F Partial Alliance Delivery'
            : '\u274c Alliance Delivery Failed')
        .addFields({ name: 'Announcement ID', value: `\`${result.announcementId}\``, inline: true }, { name: 'Alliance Orgs', value: `${result.allianceOrgs.length}`, inline: true }, { name: 'Successful', value: `${result.successfulDeliveries}`, inline: true }, { name: 'Failed', value: `${result.failedDeliveries}`, inline: true });
}
function buildAnnouncementStatusEmbed(status) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle(`\u{1F4CA} Announcement Status: ${status.announcement.title}`)
        .addFields({ name: 'ID', value: `\`${status.announcement.id}\``, inline: true }, {
        name: 'Status',
        value: `${getStatusEmoji(status.announcement.status)} ${status.announcement.status}`,
        inline: true,
    }, {
        name: 'Created By',
        value: status.announcement.createdByName || status.announcement.createdBy,
        inline: true,
    });
    if (status.deliveries.length > 0) {
        embed.addFields({ name: '\n\u{1F4EC} Delivery Summary', value: '\u200B', inline: false }, { name: 'Total', value: `${status.summary.total}`, inline: true }, { name: 'Delivered', value: `\u2705 ${status.summary.delivered}`, inline: true }, { name: 'Failed', value: `\u274c ${status.summary.failed}`, inline: true });
    }
    return embed;
}
function buildAnnouncementListEmbed(announcements, total) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('\u{1F4E2} Announcements')
        .setDescription(`Showing ${announcements.length} of ${total} announcements`)
        .setTimestamp();
    announcements.forEach(announcement => {
        const emoji = getStatusEmoji(announcement.status);
        const truncated = announcement.content.length > 50
            ? `${announcement.content.substring(0, 50)}...`
            : announcement.content;
        embed.addFields({
            name: `${emoji} ${announcement.title}`,
            value: `ID: \`${announcement.id}\`\n${truncated}`,
            inline: false,
        });
    });
    return embed;
}
function buildTemplatesPanelEmbed() {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.INFO)
        .setTitle('\u{1F4CB} Announcement Templates')
        .setDescription('Manage your announcement templates.')
        .setFooter({ text: 'Templates let you quickly create announcements from predefined formats' });
}
function buildTemplatesListEmbed(templates, total) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('\u{1F4CB} Announcement Templates')
        .setDescription(`Showing ${templates.length} of ${total} templates`)
        .setTimestamp();
    templates.forEach(template => {
        const globalBadge = template.isGlobal ? '\u{1F310} ' : '';
        const truncated = template.content.length > 50 ? `${template.content.substring(0, 50)}...` : template.content;
        embed.addFields({
            name: `${globalBadge}${template.name}`,
            value: `ID: \`${template.id}\`\nTitle: ${template.title || 'N/A'}\n${truncated}`,
            inline: false,
        });
    });
    return embed;
}
function buildAnnouncementScheduledEmbed(announcementId, scheduledAt, channelId) {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('\u{1F4C5} Announcement Scheduled')
        .addFields({ name: 'Announcement ID', value: `\`${announcementId}\``, inline: true }, { name: 'Scheduled For', value: scheduledAt.toLocaleString(), inline: true }, { name: 'Channel', value: `<#${channelId}>`, inline: true })
        .setFooter({ text: 'Use /announce cancel to cancel this scheduled announcement' });
}
function buildTemplateCreatedEmbed(templateId, templateName, createdByUsername) {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SUCCESS)
        .setTitle('\u2705 Template Created')
        .setDescription(`Template "${templateName}" has been created.`)
        .addFields({ name: 'Template ID', value: `\`${templateId}\``, inline: true }, { name: 'Type', value: '\u{1F3E2} Organization', inline: true }, { name: 'Created By', value: createdByUsername, inline: true });
}
//# sourceMappingURL=announceEmbeds.js.map