"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startVoiceOnlineEmbedJob = startVoiceOnlineEmbedJob;
exports.setOnlineEmbedChannel = setOnlineEmbedChannel;
const discord_js_1 = require("discord.js");
const VoiceServerService_1 = require("../services/communication/voice/VoiceServerService");
const logger_1 = require("../utils/logger");
const redis_1 = require("../utils/redis");
const JOB_NAME = 'voice-online-embed';
const INTERVAL_MS = 2 * 60 * 1000;
const REDIS_MSG_KEY = 'voice:online-embed:messageId';
const REDIS_CHANNEL_KEY = 'voice:online-embed:channelId';
let timer = null;
function buildOnlineEmbed(status, displayName) {
    const isOnline = status.online;
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`🎧 ${displayName} — Who's Online`)
        .setColor(isOnline ? 0x57f287 : 0xed4245)
        .setTimestamp()
        .setFooter({ text: 'Auto-updates every 2 minutes' });
    if (!isOnline) {
        embed.setDescription('*Server is currently offline*');
        return embed;
    }
    embed.addFields({
        name: 'Status',
        value: `🟢 **Online** — ${status.currentUsers}/${status.maxUsers} users`,
    });
    if (status.channels && status.channels.length > 0) {
        const lines = [];
        for (const ch of status.channels) {
            const users = ch.users ?? [];
            if (users.length > 0 || ch.userCount > 0) {
                lines.push(`📁 **${ch.name}** (${users.length || ch.userCount})`);
                for (const u of users.slice(0, 15)) {
                    const muteIcon = u.isDeafened ? '🔇' : u.isMuted ? '🔕' : '🎙️';
                    const duration = u.sessionMinutes ? ` — ${Math.round(u.sessionMinutes)}m` : '';
                    lines.push(`  ${muteIcon} ${u.displayName}${duration}`);
                }
            }
        }
        if (lines.length > 0) {
            const content = lines.join('\n').slice(0, 1020);
            embed.addFields({ name: 'Channels', value: content });
        }
    }
    if (status.currentUsers === 0) {
        embed.setDescription('*No users currently connected*');
    }
    return embed;
}
async function updateOnlineEmbed(client) {
    try {
        const channelId = await redis_1.cache.get(REDIS_CHANNEL_KEY);
        if (!channelId) {
            return;
        }
        const voiceService = VoiceServerService_1.VoiceServerService.getInstance();
        const federationId = process.env.PLATFORM_MUMBLE_FEDERATION_ID;
        if (!federationId) {
            return;
        }
        const [status, connectInfo] = await Promise.all([
            voiceService.getFederationVoiceStatus(federationId),
            voiceService.getPlatformConnectInfo(),
        ]);
        const embed = buildOnlineEmbed(status, connectInfo.displayName ?? 'Platform Voice Server');
        const channel = client.channels.cache.get(channelId);
        if (!channel?.isTextBased()) {
            return;
        }
        const existingMsgId = await redis_1.cache.get(REDIS_MSG_KEY);
        if (existingMsgId) {
            try {
                const msg = await channel.messages.fetch(existingMsgId);
                await msg.edit({ embeds: [embed] });
                return;
            }
            catch {
                await redis_1.cache.del(REDIS_MSG_KEY);
            }
        }
        const newMsg = await channel.send({ embeds: [embed] });
        await redis_1.cache.set(REDIS_MSG_KEY, newMsg.id, 0);
        try {
            await newMsg.pin();
        }
        catch {
        }
    }
    catch (error) {
        logger_1.logger.debug(`[${JOB_NAME}] Failed to update online embed`, {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
function startVoiceOnlineEmbedJob(client) {
    logger_1.logger.info(`[${JOB_NAME}] Starting (interval: ${INTERVAL_MS / 1000}s)`);
    timer = setInterval(() => void updateOnlineEmbed(client), INTERVAL_MS);
    return {
        cleanup: () => {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            logger_1.logger.info(`[${JOB_NAME}] Stopped`);
        },
    };
}
async function setOnlineEmbedChannel(channelId) {
    await redis_1.cache.set(REDIS_CHANNEL_KEY, channelId, 0);
    logger_1.logger.info(`[${JOB_NAME}] Online embed channel set to ${channelId}`);
}
//# sourceMappingURL=voiceOnlineEmbedJob.js.map