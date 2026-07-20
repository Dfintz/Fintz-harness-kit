"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LfgPresenceMonitor = void 0;
const discord_js_1 = require("discord.js");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const social_1 = require("../../services/social");
const types_1 = require("../../types");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const lfgEmbed_1 = require("../embeds/lfgEmbed");
const COOLDOWN_MS = 60 * 60 * 1000;
const LFG_OPTIN_REDIS_PREFIX = 'bot:lfg:autopost:optin:';
const LFG_OPTIN_TTL_SECONDS = 90 * 24 * 60 * 60;
const GAME_ACTIVITY_MAP = {
    'star citizen': types_1.LFGActivity.OTHER,
    'star citizen alpha': types_1.LFGActivity.OTHER,
    'arena commander': types_1.LFGActivity.PVP,
    'star marine': types_1.LFGActivity.PVP,
};
function mapGameToActivity(gameName) {
    const lower = gameName.toLowerCase();
    for (const [pattern, activity] of Object.entries(GAME_ACTIVITY_MAP)) {
        if (lower.includes(pattern)) {
            return activity;
        }
    }
    return types_1.LFGActivity.OTHER;
}
function compositeKey(userId, guildId) {
    return `${userId}:${guildId}`;
}
class LfgPresenceMonitor {
    static instance = null;
    optIns = new Map();
    cooldowns = new Map();
    cleanupInterval = null;
    lfgService = social_1.SocialGroupService.getInstance();
    constructor() { }
    static getInstance() {
        if (!LfgPresenceMonitor.instance) {
            LfgPresenceMonitor.instance = new LfgPresenceMonitor();
            LfgPresenceMonitor.instance.cleanupInterval = setInterval(() => LfgPresenceMonitor.instance?.cleanupCooldowns(), 30 * 60_000);
            if (typeof LfgPresenceMonitor.instance.cleanupInterval.unref === 'function') {
                LfgPresenceMonitor.instance.cleanupInterval.unref();
            }
        }
        return LfgPresenceMonitor.instance;
    }
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.cooldowns.clear();
        this.optIns.clear();
    }
    optIn(userId, guildId, prefs) {
        const key = compositeKey(userId, guildId);
        this.optIns.set(key, prefs);
        this.persistOptIn(key, prefs);
    }
    optOut(userId, guildId) {
        const key = compositeKey(userId, guildId);
        this.optIns.delete(key);
        this.cooldowns.delete(key);
        this.unpersistOptIn(key);
    }
    isOptedIn(userId, guildId) {
        return this.optIns.has(compositeKey(userId, guildId));
    }
    async hydrate() {
        try {
            const keys = await redis_1.cache.keys(`${LFG_OPTIN_REDIS_PREFIX}*`);
            let loaded = 0;
            for (const fullKey of keys) {
                const prefs = await redis_1.cache.get(fullKey);
                if (!prefs) {
                    continue;
                }
                const key = fullKey.slice(LFG_OPTIN_REDIS_PREFIX.length);
                this.optIns.set(key, prefs);
                this.persistOptIn(key, prefs);
                loaded++;
            }
            if (loaded > 0) {
                logger_1.logger.info(`LfgPresenceMonitor: Restored ${loaded} auto-LFG opt-ins from Redis`);
            }
        }
        catch (err) {
            logger_1.logger.warn('LfgPresenceMonitor: Failed to hydrate opt-ins from Redis', err);
        }
    }
    persistOptIn(key, prefs) {
        redis_1.cache
            .set(`${LFG_OPTIN_REDIS_PREFIX}${key}`, prefs, LFG_OPTIN_TTL_SECONDS)
            .catch((err) => logger_1.logger.warn('LfgPresenceMonitor: Failed to persist opt-in to Redis', err));
    }
    unpersistOptIn(key) {
        redis_1.cache
            .del(`${LFG_OPTIN_REDIS_PREFIX}${key}`)
            .catch((err) => logger_1.logger.warn('LfgPresenceMonitor: Failed to remove opt-in from Redis', err));
    }
    async handlePresenceUpdate(oldPresence, newPresence, _client) {
        const userId = newPresence.userId;
        const guild = newPresence.guild;
        if (!guild) {
            return;
        }
        const key = compositeKey(userId, guild.id);
        const prefs = this.optIns.get(key);
        if (!prefs) {
            return;
        }
        const newGame = newPresence.activities.find(a => a.type === discord_js_1.ActivityType.Playing);
        if (!newGame) {
            return;
        }
        const oldGame = oldPresence?.activities.find(a => a.type === discord_js_1.ActivityType.Playing);
        if (oldGame?.name === newGame.name) {
            return;
        }
        let member = null;
        try {
            member = await guild.members.fetch(userId);
        }
        catch {
            return;
        }
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
            return;
        }
        const now = Date.now();
        const cd = this.cooldowns.get(key);
        if (cd && now - cd.lastAutoPost < COOLDOWN_MS) {
            return;
        }
        let textChannel = null;
        let mentionRoleId;
        try {
            const all = await DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(guild.id);
            const settings = all?.[0];
            const networkLfg = settings?.lfgNetworkSettings;
            const lfg = settings?.lfgSettings;
            const defaultGame = lfg?.defaultGame ?? 'Star Citizen';
            const isNonDefaultGame = newGame.name.toLowerCase() !== defaultGame.toLowerCase();
            const voiceScope = networkLfg?.autoLfgVoiceChannelScope ?? 'all';
            const allowedVoiceChannelIds = Array.isArray(networkLfg?.autoLfgAllowedVoiceChannelIds)
                ? networkLfg.autoLfgAllowedVoiceChannelIds
                : [];
            if (voiceScope === 'selected' && !allowedVoiceChannelIds.includes(voiceChannel.id)) {
                logger_1.logger.debug('Auto-LFG: user in non-whitelisted voice channel for selected-only scope', {
                    guildId: guild.id,
                    userId,
                    voiceChannelId: voiceChannel.id,
                    allowedVoiceChannelCount: allowedVoiceChannelIds.length,
                });
                return;
            }
            mentionRoleId = lfg?.lfgMentionRoleId;
            const candidates = [
                networkLfg?.lfgChannelId,
                isNonDefaultGame ? lfg?.otherGamesChannelId : undefined,
                lfg?.publicLfgChannelId,
            ];
            for (const id of candidates) {
                if (!id) {
                    continue;
                }
                const ch = guild.channels.cache.get(id);
                if (ch && ch.isTextBased() && !ch.isVoiceBased() && !ch.isThread()) {
                    textChannel = ch;
                    break;
                }
            }
        }
        catch (err) {
            logger_1.logger.debug('Auto-LFG: failed to resolve configured LFG channel', {
                guildId: guild.id,
                error: err instanceof Error ? err.message : String(err),
            });
        }
        if (!textChannel) {
            logger_1.logger.warn(`Auto-LFG: no configured LFG channel for guild ${guild.id} — falling back to systemChannel`);
            textChannel = guild.systemChannel;
            if (!textChannel) {
                const channels = guild.channels.cache.filter((ch) => ch.isTextBased() && !ch.isVoiceBased() && !ch.isThread());
                textChannel = channels.first() ?? null;
            }
        }
        if (!textChannel) {
            logger_1.logger.warn(`Auto-LFG: No text channel available in guild ${guild.id}`);
            return;
        }
        const activity = mapGameToActivity(newGame.name);
        const description = `🤖 Auto-LFG: ${member.displayName} is playing **${newGame.name}** — join the voice chat!`;
        try {
            const post = this.lfgService.createPost(activity, description, userId, member.displayName, prefs.maxPlayers, guild.id, textChannel.id, 60, { voiceChannelId: voiceChannel.id, isAutoLfg: true, game: newGame.name });
            const embed = (0, lfgEmbed_1.buildLfgEmbed)(post);
            const buttons = (0, lfgEmbed_1.buildLfgButtons)(post.id);
            let content;
            if (mentionRoleId) {
                content = `<@&${mentionRoleId}>`;
            }
            const sentMessage = await textChannel.send({
                content,
                embeds: [embed],
                components: [buttons],
                allowedMentions: mentionRoleId ? { roles: [mentionRoleId] } : undefined,
            });
            this.lfgService.setMessageId(post.id, sentMessage.id);
            this.cooldowns.set(key, { lastAutoPost: now });
            logger_1.logger.info(`🤖 Auto-LFG created for ${member.displayName} in ${guild.name}: ` +
                `${newGame.name} → post ${post.id} (VC: ${voiceChannel.name})`);
        }
        catch (error) {
            logger_1.logger.error('Auto-LFG post creation failed:', error);
        }
    }
    cleanupCooldowns() {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this.cooldowns) {
            if (now - entry.lastAutoPost > COOLDOWN_MS * 2) {
                this.cooldowns.delete(key);
                removed++;
            }
        }
        return removed;
    }
}
exports.LfgPresenceMonitor = LfgPresenceMonitor;
//# sourceMappingURL=lfgPresenceMonitor.js.map