"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGuildMemberAdd = handleGuildMemberAdd;
exports.handleGuildMemberUpdate = handleGuildMemberUpdate;
exports.handleGuildMemberRemove = handleGuildMemberRemove;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const discord_1 = require("../../bot/utils/discord");
const logger_1 = require("../../utils/logger");
const DiscordSettingsService_1 = require("./DiscordSettingsService");
function isOnboardingPending(member) {
    return member.pending === true;
}
async function assignWelcomeAutoRoles(member, autoRoleIds, reason) {
    if (autoRoleIds.length === 0) {
        return;
    }
    if (!(0, discord_1.checkBotGuildPermissions)(member.guild, discord_js_1.PermissionFlagsBits.ManageRoles)) {
        logger_1.logger.warn(`WelcomeService: bot lacks ManageRoles in guild ${member.guild.name}, skipping auto-roles`);
        return;
    }
    let assignedCount = 0;
    for (const roleId of autoRoleIds) {
        if (member.roles.cache.has(roleId)) {
            continue;
        }
        try {
            await member.roles.add(roleId, reason);
            assignedCount += 1;
        }
        catch (err) {
            logger_1.logger.warn(`Failed to assign auto-role ${roleId} to ${member.user.tag}: ${err}`);
        }
    }
    if (assignedCount > 0) {
        logger_1.logger.info(`Assigned ${assignedCount} auto-role(s) to ${member.user.tag} in ${member.guild.name}`);
    }
}
function resolveTemplate(template, member) {
    return (0, shared_types_1.decodeHtmlEntities)(template)
        .replaceAll('{user}', `<@${member.id}>`)
        .replaceAll('{username}', member.user?.username ?? member.displayName ?? 'Member')
        .replaceAll('{server}', member.guild.name)
        .replaceAll('{memberCount}', member.guild.memberCount.toString());
}
async function handleGuildMemberAdd(member) {
    try {
        const settings = await getGuildWelcomeSettings(member.guild.id);
        if (!settings) {
            return;
        }
        if (member.user.bot && settings.notificationPreferences?.excludeBotJoins !== false) {
            logger_1.logger.debug(`Skipping welcome for bot ${member.user.tag} in ${member.guild.name}`);
            return;
        }
        const welcome = settings.welcomeSettings;
        if (!welcome) {
            return;
        }
        const autoRoleIds = welcome.autoRoleIds ?? [];
        if (isOnboardingPending(member)) {
            logger_1.logger.info(`Delaying auto-role assignment for pending member ${member.user.tag} in ${member.guild.name}`);
        }
        else {
            await assignWelcomeAutoRoles(member, autoRoleIds, 'Welcome auto-role');
        }
        if (welcome.welcomeEnabled && welcome.welcomeChannelId) {
            const channel = member.guild.channels.cache.get(welcome.welcomeChannelId);
            if (channel?.isTextBased()) {
                const message = welcome.welcomeMessage ??
                    'Welcome to **{server}**, {user}! You are member #{memberCount}.';
                const resolved = resolveTemplate(message, member);
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(0x00c853)
                    .setTitle('Welcome!')
                    .setDescription(resolved)
                    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
                    .setTimestamp();
                await channel.send({ embeds: [embed] });
            }
        }
        if (welcome.welcomeDmEnabled) {
            try {
                const dmMessage = welcome.welcomeDmMessage ?? 'Welcome to **{server}**! We are glad to have you.';
                const resolved = resolveTemplate(dmMessage, member);
                await member.user.send(resolved);
            }
            catch {
            }
        }
    }
    catch (error) {
        logger_1.logger.error(`Welcome handler error for ${member.user?.tag}:`, error);
    }
}
async function handleGuildMemberUpdate(oldMember, newMember) {
    try {
        if (newMember.user.bot) {
            return;
        }
        const transitionedToAccepted = !isOnboardingPending(newMember) && oldMember.pending !== false;
        if (!transitionedToAccepted) {
            return;
        }
        const settings = await getGuildWelcomeSettings(newMember.guild.id);
        const autoRoleIds = settings?.welcomeSettings?.autoRoleIds ?? [];
        await assignWelcomeAutoRoles(newMember, autoRoleIds, 'Welcome auto-role after onboarding');
    }
    catch (error) {
        logger_1.logger.error(`Welcome update handler error for ${newMember.user?.tag}:`, error);
    }
}
async function handleGuildMemberRemove(member) {
    try {
        const settings = await getGuildWelcomeSettings(member.guild.id);
        if (!settings) {
            return;
        }
        const welcome = settings.welcomeSettings;
        if (!welcome?.goodbyeEnabled || !welcome.goodbyeChannelId) {
            return;
        }
        const channel = member.guild.channels.cache.get(welcome.goodbyeChannelId);
        if (!channel?.isTextBased()) {
            return;
        }
        const message = welcome.goodbyeMessage ??
            '{username} has left **{server}**. We now have {memberCount} members.';
        const resolved = resolveTemplate(message, member);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xff5252)
            .setTitle('Goodbye')
            .setDescription(resolved)
            .setTimestamp();
        await channel.send({ embeds: [embed] });
        const recruitConfig = settings.recruitmentSettings;
        const leaveAction = recruitConfig?.actionOnApplicantLeave;
        if (leaveAction && leaveAction !== 'nothing' && member.id) {
            try {
                const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
                const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v2';
                if (leaveAction === 'withdraw') {
                    await axios
                        .post(`${API_BASE_URL}/recruitments/applications/withdraw-by-user`, {
                        discordUserId: member.id,
                        guildId: member.guild.id,
                    })
                        .catch(() => { });
                    logger_1.logger.info(`Auto-withdrew applications for leaving member ${member.user?.tag}`);
                }
                else if (leaveAction === 'notify') {
                    const staffChannel = recruitConfig?.applicationChannelId
                        ? member.guild.channels.cache.get(recruitConfig.applicationChannelId)
                        : null;
                    if (staffChannel?.isTextBased()) {
                        const notifyEmbed = new discord_js_1.EmbedBuilder()
                            .setColor(0xffab00)
                            .setTitle('Applicant Left Server')
                            .setDescription(`**${(0, shared_types_1.decodeHtmlEntities)(member.user?.tag ?? member.displayName)}** left the server while having a pending application.`)
                            .setTimestamp();
                        await staffChannel.send({ embeds: [notifyEmbed] });
                    }
                }
            }
            catch {
            }
        }
    }
    catch (error) {
        logger_1.logger.error(`Goodbye handler error for ${member.user?.tag}:`, error);
    }
}
async function getGuildWelcomeSettings(guildId) {
    try {
        const service = new DiscordSettingsService_1.DiscordSettingsService();
        const allSettings = await service.getSettingsByGuildId(guildId);
        return allSettings?.[0] ?? null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=WelcomeService.js.map