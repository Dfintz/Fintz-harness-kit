"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeEngagementTracking = initializeEngagementTracking;
const InviteTrackingService_1 = require("../../services/discord/InviteTrackingService");
const MemberEngagementService_1 = require("../../services/discord/MemberEngagementService");
const logger_1 = require("../../utils/logger");
const voiceSessions = new Map();
const MAX_VOICE_SESSIONS = 50_000;
function sessionKey(guildId, userId) {
    return `${guildId}:${userId}`;
}
let engagementService = null;
let inviteTrackingService = null;
function getEngagementService() {
    engagementService ??= MemberEngagementService_1.MemberEngagementService.getInstance();
    return engagementService;
}
function getInviteTrackingService() {
    inviteTrackingService ??= InviteTrackingService_1.InviteTrackingService.getInstance();
    return inviteTrackingService;
}
function initializeEngagementTracking(client) {
    const messageBuffer = new Map();
    const FLUSH_INTERVAL_MS = 30_000;
    const flushMessageBuffer = async () => {
        if (messageBuffer.size === 0) {
            return;
        }
        const batch = new Map(messageBuffer);
        messageBuffer.clear();
        for (const [key, count] of batch) {
            try {
                const [guildId, userId] = key.split(':');
                await getEngagementService().incrementMessageCount(guildId, userId, count);
            }
            catch (error) {
                logger_1.logger.debug('Engagement: batch flush error for key', error);
            }
        }
    };
    setInterval(() => {
        void flushMessageBuffer();
    }, FLUSH_INTERVAL_MS);
    client.on('messageCreate', (message) => {
        try {
            if (message.author.bot || !message.guild || message.system) {
                return;
            }
            const key = `${message.guild.id}:${message.author.id}`;
            messageBuffer.set(key, (messageBuffer.get(key) ?? 0) + 1);
        }
        catch (error) {
            logger_1.logger.debug('Engagement: message tracking error', error);
        }
    });
    client.on('voiceStateUpdate', (oldState, newState) => {
        try {
            const userId = newState.id;
            const guildId = newState.guild.id;
            const key = sessionKey(guildId, userId);
            if (!oldState.channelId && newState.channelId) {
                if (voiceSessions.size < MAX_VOICE_SESSIONS) {
                    voiceSessions.set(key, Date.now());
                }
                return;
            }
            if (oldState.channelId && !newState.channelId) {
                const joinTime = voiceSessions.get(key);
                voiceSessions.delete(key);
                if (joinTime) {
                    const minutes = (Date.now() - joinTime) / 60_000;
                    if (minutes >= 1) {
                        getEngagementService()
                            .addVoiceMinutes(guildId, userId, minutes)
                            .catch(err => logger_1.logger.debug('Engagement: voice persist error', err));
                    }
                }
                return;
            }
        }
        catch (error) {
            logger_1.logger.debug('Engagement: voice tracking error', error);
        }
    });
    client.on('guildMemberAdd', async (member) => {
        try {
            await getInviteTrackingService().handleMemberJoin(member);
        }
        catch (error) {
            logger_1.logger.debug('Engagement: invite tracking error', error);
        }
    });
    for (const guild of client.guilds.cache.values()) {
        getInviteTrackingService()
            .cacheGuildInvites(guild)
            .catch(err => logger_1.logger.debug(`Engagement: failed to cache invites for ${guild.name}`, err));
    }
    client.on('inviteCreate', async (invite) => {
        if (invite.guild) {
            await getInviteTrackingService()
                .cacheGuildInvites(invite.guild)
                .catch(() => { });
        }
    });
    client.on('inviteDelete', async (invite) => {
        if (invite.guild) {
            await getInviteTrackingService()
                .cacheGuildInvites(invite.guild)
                .catch(() => { });
        }
    });
    logger_1.logger.info('📊 Engagement tracking initialized (messages, voice, invites)');
    setInterval(() => {
        const cutoff = Date.now() - 24 * 60 * 60_000;
        for (const [key, joinTime] of voiceSessions) {
            if (joinTime < cutoff) {
                voiceSessions.delete(key);
            }
        }
    }, 60 * 60_000);
}
//# sourceMappingURL=engagementTracker.js.map