"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerNotificationPreferenceListener = registerNotificationPreferenceListener;
const discord_js_1 = require("discord.js");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const logger_1 = require("../../utils/logger");
function collectTargets(settings, toggleSelector, channelIdSelector) {
    const targets = [];
    for (const guildSettings of settings) {
        const preferences = guildSettings.notificationPreferences;
        if (!preferences || !toggleSelector(preferences)) {
            continue;
        }
        const guildId = guildSettings.guildId;
        const specificChannelId = channelIdSelector?.(preferences);
        const channelId = specificChannelId || preferences.announcementChannelId;
        if (!guildId || !channelId) {
            continue;
        }
        const mentionRoleIds = preferences.enableMentionRolesToNotify && Array.isArray(preferences.notificationMentionRoles)
            ? Array.from(new Set(preferences.notificationMentionRoles.filter(Boolean)))
            : [];
        targets.push({
            guildId,
            channelId,
            mentionRoleIds,
            autoPublish: preferences.autoPublishAnnouncements === true,
        });
    }
    return targets;
}
async function postNotification(client, target, embed) {
    const guild = client.guilds.cache.get(target.guildId);
    const channel = guild?.channels.cache.get(target.channelId);
    if (!channel?.isTextBased()) {
        return;
    }
    const content = target.mentionRoleIds.length > 0
        ? target.mentionRoleIds.map(roleId => `<@&${roleId}>`).join(' ')
        : undefined;
    const sentMessage = await channel.send({
        content,
        embeds: [embed],
        allowedMentions: target.mentionRoleIds.length > 0 ? { roles: target.mentionRoleIds } : { parse: [] },
    });
    if (target.autoPublish &&
        channel.type === discord_js_1.ChannelType.GuildAnnouncement &&
        sentMessage?.crosspost) {
        try {
            await sentMessage.crosspost();
        }
        catch (error) {
            logger_1.logger.warn('Failed to crosspost notification-preference message', {
                guildId: target.guildId,
                channelId: target.channelId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
async function postForGuildEvent(client, guildId, toggleSelector, buildEmbed, channelIdSelector) {
    const settings = await DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(guildId);
    const targets = collectTargets(settings, toggleSelector, channelIdSelector);
    if (targets.length === 0) {
        return;
    }
    const embed = buildEmbed();
    await Promise.allSettled(targets.map(target => postNotification(client, target, embed)));
}
async function handleMemberJoin(client, member) {
    if (member.user.bot) {
        return;
    }
    await postForGuildEvent(client, member.guild.id, preferences => preferences.memberJoinNotifications === true, () => new discord_js_1.EmbedBuilder()
        .setColor(0x00c853)
        .setTitle('Member Joined')
        .setDescription(`**Member:** <@${member.id}>\n**Server:** ${member.guild.name}`)
        .setTimestamp(), preferences => preferences.memberJoinChannelId);
}
async function handleMemberLeave(client, member) {
    const displayName = member.user?.tag ?? member.displayName ?? member.id;
    await postForGuildEvent(client, member.guild.id, preferences => preferences.memberLeaveNotifications === true, () => new discord_js_1.EmbedBuilder()
        .setColor(0xff5252)
        .setTitle('Member Left')
        .setDescription(`**Member:** ${displayName}\n**Server:** ${member.guild.name}`)
        .setTimestamp(), preferences => preferences.memberLeaveChannelId);
}
async function handleRoleChange(client, oldMember, newMember) {
    const oldRoleCache = oldMember.roles?.cache;
    if (!oldRoleCache) {
        return;
    }
    const oldRoleIds = new Set(oldRoleCache.keys());
    const newRoleIds = new Set(newMember.roles.cache.keys());
    const added = [...newRoleIds].filter(roleId => !oldRoleIds.has(roleId));
    const removed = [...oldRoleIds].filter(roleId => !newRoleIds.has(roleId));
    if (added.length === 0 && removed.length === 0) {
        return;
    }
    const lines = [];
    for (const roleId of added) {
        lines.push(`+ <@&${roleId}>`);
    }
    for (const roleId of removed) {
        lines.push(`- <@&${roleId}>`);
    }
    await postForGuildEvent(client, newMember.guild.id, preferences => preferences.roleChangeNotifications === true, () => new discord_js_1.EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('Role Changes')
        .setDescription(`**Member:** ${newMember.user.tag}\n${lines.join('\n')}`)
        .setTimestamp(), preferences => preferences.roleChangeChannelId);
}
function registerNotificationPreferenceListener(client) {
    client.on('guildMemberAdd', member => {
        handleMemberJoin(client, member).catch(error => {
            logger_1.logger.warn('Failed to post member join notification preference message', {
                guildId: member.guild.id,
                memberId: member.id,
                error: error instanceof Error ? error.message : String(error),
            });
        });
    });
    client.on('guildMemberRemove', member => {
        handleMemberLeave(client, member).catch(error => {
            logger_1.logger.warn('Failed to post member leave notification preference message', {
                guildId: member.guild.id,
                memberId: member.id,
                error: error instanceof Error ? error.message : String(error),
            });
        });
    });
    client.on('guildMemberUpdate', (oldMember, newMember) => {
        handleRoleChange(client, oldMember, newMember).catch(error => {
            logger_1.logger.warn('Failed to post role-change notification preference message', {
                guildId: newMember.guild.id,
                memberId: newMember.id,
                error: error instanceof Error ? error.message : String(error),
            });
        });
    });
    logger_1.logger.info('Registered notification-preference listener (join/leave/role changes)');
}
//# sourceMappingURL=notificationPreferenceListener.js.map