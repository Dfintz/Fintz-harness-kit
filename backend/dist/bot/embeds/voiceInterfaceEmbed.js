"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVoiceInterfaceEmbed = buildVoiceInterfaceEmbed;
exports.buildVoiceControlButtons = buildVoiceControlButtons;
exports.buildVoiceModerationButtons = buildVoiceModerationButtons;
exports.buildVoiceExtendedButtons = buildVoiceExtendedButtons;
exports.buildVoiceTemplatesEmbed = buildVoiceTemplatesEmbed;
exports.buildVoiceChannelCreatedEmbed = buildVoiceChannelCreatedEmbed;
exports.buildVoiceAutoCreateConfiguredEmbed = buildVoiceAutoCreateConfiguredEmbed;
exports.buildMumbleStatusEmbed = buildMumbleStatusEmbed;
exports.parseVoiceInterfaceButtonId = parseVoiceInterfaceButtonId;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const embedBuilder_1 = require("../utils/embedBuilder");
function buildVoiceInterfaceEmbed(channelName, creatorDisplayName) {
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('🎤 Voice Channel Controls')
        .setDescription(`Welcome to **${(0, shared_types_1.decodeHtmlEntities)(channelName)}**!\n` +
        `Channel owner: **${(0, shared_types_1.decodeHtmlEntities)(creatorDisplayName)}**\n\n` +
        `Use the buttons below to manage your channel.`)
        .addFields({
        name: '🔒 Lock / Unlock',
        value: 'Control who can join your channel',
        inline: true,
    }, {
        name: '✏️ Rename / 👥 Limit',
        value: 'Customise name and user cap',
        inline: true,
    }, {
        name: '✅ Trust / 🚫 Block',
        value: 'Allow or deny specific users',
        inline: true,
    }, {
        name: '🔓 Unblock / 🗑️ Delete',
        value: 'Remove blocks or delete channel',
        inline: true,
    })
        .setFooter({ text: 'Only the channel owner can use these controls' })
        .setTimestamp()
        .build();
}
function buildVoiceControlButtons(channelId) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`voice_iface_lock_${channelId}`)
        .setLabel('Lock')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('🔒'), new discord_js_1.ButtonBuilder()
        .setCustomId(`voice_iface_unlock_${channelId}`)
        .setLabel('Unlock')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji('🔓'), new discord_js_1.ButtonBuilder()
        .setCustomId(`voice_iface_rename_${channelId}`)
        .setLabel('Rename')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('✏️'), new discord_js_1.ButtonBuilder()
        .setCustomId(`voice_iface_limit_${channelId}`)
        .setLabel('Limit')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('👥'));
}
function buildVoiceModerationButtons(channelId) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`voice_iface_trust_${channelId}`)
        .setLabel('Trust User')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji('✅'), new discord_js_1.ButtonBuilder()
        .setCustomId(`voice_iface_block_${channelId}`)
        .setLabel('Block User')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('🚫'), new discord_js_1.ButtonBuilder()
        .setCustomId(`voice_iface_claim_${channelId}`)
        .setLabel('Claim')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('👑'));
}
function buildVoiceExtendedButtons(channelId) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`voice_iface_unblock_${channelId}`)
        .setLabel('Unblock')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🔓'), new discord_js_1.ButtonBuilder()
        .setCustomId(`voice_iface_privacy_${channelId}`)
        .setLabel('Privacy')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('🔐'), new discord_js_1.ButtonBuilder()
        .setCustomId(`voice_iface_kick_${channelId}`)
        .setLabel('Kick')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('👢'), new discord_js_1.ButtonBuilder()
        .setCustomId(`voice_iface_delete_${channelId}`)
        .setLabel('Delete')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('🗑️'));
}
function buildVoiceTemplatesEmbed(templates) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('Available Voice Channel Templates')
        .setTimestamp();
    templates.forEach(template => {
        const autoDeleteText = template.autoDelete ? `${String(template.autoDeleteDelay)}min` : 'No';
        embed.addFields({
            name: `${template.name} (${template.id})`,
            value: [
                template.description,
                `Limit: ${template.userLimit === 0 ? 'Unlimited' : template.userLimit}`,
                `Bitrate: ${template.bitrate / 1000} kbps`,
                `Auto-Delete: ${autoDeleteText}`,
            ].join('\n'),
            inline: false,
        });
    });
    return embed;
}
function buildVoiceChannelCreatedEmbed(summary) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x00ff00)
        .setDescription(`\u2705 Created **${summary.channelName}** from **${summary.templateName}** template`)
        .addFields({ name: 'Channel', value: `<#${summary.channelId}>`, inline: true }, {
        name: 'User Limit',
        value: summary.userLimit === 0 || !summary.userLimit
            ? 'Unlimited'
            : summary.userLimit.toString(),
        inline: true,
    }, { name: 'Bitrate', value: `${summary.bitrate / 1000} kbps`, inline: true });
    if (summary.expiresAt) {
        embed.addFields({
            name: 'Auto-Delete',
            value: `<t:${Math.floor(summary.expiresAt.getTime() / 1000)}:R>`,
        });
    }
    return embed;
}
function buildVoiceAutoCreateConfiguredEmbed(summary) {
    return new discord_js_1.EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('\u2705 Voice Auto-Create Configured')
        .setDescription('Users who join the hub channel will get a temporary voice channel.')
        .addFields({ name: 'Hub Channel', value: `<#${summary.hubChannelId}>`, inline: true }, {
        name: 'Category',
        value: summary.parentCategoryId ? `<#${summary.parentCategoryId}>` : 'Guild root',
        inline: true,
    }, { name: 'Max Channels', value: `${summary.maxChannels}`, inline: true })
        .setTimestamp();
}
function buildMumbleStatusEmbed(status, hasAccess, connectInfo) {
    const isOnline = status?.online ?? false;
    const displayName = connectInfo.displayName ?? 'Platform Voice Server';
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🎧 ${displayName}`)
        .setColor(isOnline ? embedBuilder_1.EmbedColors.SUCCESS : embedBuilder_1.EmbedColors.ERROR)
        .setTimestamp();
    embed.addFields({
        name: 'Status',
        value: isOnline ? '🟢 **Online**' : '🔴 **Offline**',
        inline: true,
    });
    if (isOnline) {
        embed.addFields({
            name: 'Users',
            value: `**${status?.currentUsers ?? 0}** / ${status?.maxUsers ?? 0}`,
            inline: true,
        });
    }
    embed.addFields({
        name: 'Access',
        value: hasAccess ? '✅ You have access' : '⚠️ Federation membership required',
        inline: true,
    });
    if (status?.channels && status.channels.length > 0) {
        const channelLines = status.channels.slice(0, 10).map(ch => {
            const userCount = ch.users?.length ?? ch.userCount ?? 0;
            const users = userCount > 0 ? ` (${userCount} user${userCount !== 1 ? 's' : ''})` : '';
            return `📁 ${ch.name}${users}`;
        });
        embed.addFields({
            name: 'Channels',
            value: channelLines.join('\n') || 'No channels',
        });
    }
    if (connectInfo.connectUrl && isOnline && hasAccess) {
        embed.addFields({
            name: 'Connect',
            value: `\`${connectInfo.connectUrl}\``,
        });
    }
    embed.setFooter({
        text: `${connectInfo.serverType?.toUpperCase() ?? 'MUMBLE'} • Updated`,
    });
    return embed;
}
function parseVoiceInterfaceButtonId(customId) {
    const match = /^voice_iface_(lock|unlock|rename|limit|trust|block|claim|unblock|privacy|kick|delete)_(.+)$/.exec(customId);
    if (!match) {
        return null;
    }
    return {
        action: match[1],
        channelId: match[2],
    };
}
//# sourceMappingURL=voiceInterfaceEmbed.js.map