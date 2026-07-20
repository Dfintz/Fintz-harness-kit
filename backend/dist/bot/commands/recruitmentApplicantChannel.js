"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveApplicantChannelConfig = resolveApplicantChannelConfig;
exports.openApplicantChannel = openApplicantChannel;
exports.closeApplicantChannel = closeApplicantChannel;
const discord_js_1 = require("discord.js");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const recruitmentEmbeds_1 = require("../embeds/recruitmentEmbeds");
const issueChannel_1 = require("../utils/issueChannel");
const REDIS_KEY = 'recruitment:applicantChannels';
function resolveApplicantChannelConfig(settingsRows) {
    const configured = (settingsRows ?? []).filter(row => {
        const rs = row.recruitmentSettings;
        const reviewerRoleId = rs?.staffPingRoleId ?? rs?.pendingRoleId ?? rs?.acceptRoleId;
        return Boolean(rs?.applicantChannelEnabled && rs?.applicantChannelCategoryId && reviewerRoleId);
    });
    if (configured.length === 0) {
        return null;
    }
    if (configured.length > 1) {
        logger_1.logger.warn('recruitment: applicant channel ambiguous — multiple org settings rows enable it for this guild; skipping to avoid cross-org exposure');
        return null;
    }
    const rs = configured[0].recruitmentSettings;
    const reviewerRoleId = rs?.staffPingRoleId ?? rs?.pendingRoleId ?? rs?.acceptRoleId;
    return {
        categoryId: rs?.applicantChannelCategoryId ?? '',
        roleId: reviewerRoleId ?? '',
    };
}
function getApplicationId(application) {
    const id = application.id ?? application.applicationId;
    return typeof id === 'string' && id.length > 0 ? id : undefined;
}
function topicMarker(applicationId) {
    return `app:${applicationId}`;
}
function findChannelIdByTopic(guild, applicationId) {
    const marker = topicMarker(applicationId);
    const match = guild.channels.cache.find(ch => ch instanceof discord_js_1.TextChannel && typeof ch.topic === 'string' && ch.topic.includes(marker));
    return match?.id ?? null;
}
async function findChannelIdByTopicDurable(guild, applicationId) {
    const cached = findChannelIdByTopic(guild, applicationId);
    if (cached) {
        return cached;
    }
    try {
        const fetched = await guild.channels.fetch();
        const marker = topicMarker(applicationId);
        const match = fetched.find(ch => ch instanceof discord_js_1.TextChannel && typeof ch.topic === 'string' && ch.topic.includes(marker));
        return match?.id ?? null;
    }
    catch {
        return null;
    }
}
async function getTrackedChannel(applicationId) {
    try {
        const client = redis_1.redisClient.getClient();
        if (!client) {
            return null;
        }
        const raw = await client.hget(REDIS_KEY, applicationId);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
async function trackChannel(applicationId, entry) {
    try {
        const client = redis_1.redisClient.getClient();
        if (!client) {
            return;
        }
        await client.hset(REDIS_KEY, applicationId, JSON.stringify(entry));
    }
    catch (error) {
        logger_1.logger.warn('recruitment: failed to persist applicant channel mapping', {
            error: error instanceof Error ? error.message : 'unknown',
        });
    }
}
async function untrackChannel(applicationId) {
    try {
        const client = redis_1.redisClient.getClient();
        if (client) {
            await client.hdel(REDIS_KEY, applicationId);
        }
    }
    catch {
    }
}
async function openApplicantChannel(interaction, recruitmentId, application) {
    try {
        const guild = interaction.guild;
        if (!guild) {
            return;
        }
        const settingsRows = await DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(guild.id);
        const config = resolveApplicantChannelConfig(settingsRows);
        if (!config) {
            return;
        }
        const applicationId = getApplicationId(application);
        if (!applicationId) {
            return;
        }
        const alreadyOpen = (await getTrackedChannel(applicationId)) !== null ||
            findChannelIdByTopic(guild, applicationId) !== null;
        if (alreadyOpen) {
            return;
        }
        const channel = await (0, issueChannel_1.createIssueChannel)(guild, {
            initiatorId: interaction.user.id,
            roleId: config.roleId,
            categoryId: config.categoryId,
            name: `apply-${applicationId.slice(0, 6)}`,
            topic: `Recruitment application • ${topicMarker(applicationId)} • applicant <@${interaction.user.id}>`,
            reason: `Recruitment application ${applicationId}`,
        });
        if (!channel) {
            return;
        }
        await trackChannel(applicationId, { channelId: channel.id, guildId: guild.id });
        const embed = (0, recruitmentEmbeds_1.buildApplicantChannelReceivedEmbed)(interaction.user.id, config.roleId);
        await channel.send({ content: `<@&${config.roleId}>`, embeds: [embed] });
        logger_1.logger.info('recruitment: opened applicant channel', {
            applicationId,
            channelId: channel.id,
            guildId: guild.id,
            recruitmentId,
        });
    }
    catch (error) {
        logger_1.logger.warn('recruitment: failed to open applicant channel', {
            error: error instanceof Error ? error.message : 'unknown',
        });
    }
}
async function closeApplicantChannel(guild, applicationId, reason) {
    try {
        if (!guild) {
            return;
        }
        const tracked = await getTrackedChannel(applicationId);
        const channelId = tracked?.channelId ?? (await findChannelIdByTopicDurable(guild, applicationId));
        if (channelId) {
            await (0, issueChannel_1.deleteIssueChannel)(guild, channelId, reason);
            logger_1.logger.info('recruitment: closed applicant channel', {
                applicationId,
                channelId,
                guildId: guild.id,
            });
        }
        await untrackChannel(applicationId);
    }
    catch (error) {
        logger_1.logger.warn('recruitment: failed to close applicant channel', {
            error: error instanceof Error ? error.message : 'unknown',
        });
    }
}
//# sourceMappingURL=recruitmentApplicantChannel.js.map