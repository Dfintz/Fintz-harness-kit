"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiveawayService = void 0;
const crypto_1 = require("crypto");
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const REDIS_PREFIX = 'bot:giveaway:';
class GiveawayService {
    static instance;
    client = null;
    giveaways = new Map();
    timerIds = new Map();
    cleanupTimers = new Map();
    idCounter = 0;
    static MAX_GIVEAWAYS_PER_GUILD = 50;
    static CLEANUP_DELAY_MS = 60 * 60 * 1000;
    static getInstance() {
        if (!GiveawayService.instance) {
            GiveawayService.instance = new GiveawayService();
        }
        return GiveawayService.instance;
    }
    initialize(client) {
        this.client = client;
        this.loadFromRedis().catch(err => logger_1.logger.warn('GiveawayService: Failed to load persisted giveaways from Redis', err));
        logger_1.logger.info('GiveawayService initialized');
    }
    async loadFromRedis() {
        const keys = await redis_1.cache.keys(`${REDIS_PREFIX}*`);
        if (!keys.length) {
            return;
        }
        let loaded = 0;
        for (const key of keys) {
            const data = await redis_1.cache.get(key);
            if (!data) {
                continue;
            }
            data.endsAt = new Date(data.endsAt);
            data.entries = (data.entries || []).map(e => ({
                ...e,
                enteredAt: new Date(e.enteredAt),
            }));
            this.giveaways.set(data.id, data);
            loaded++;
            if (!data.ended) {
                const remaining = data.endsAt.getTime() - Date.now();
                if (remaining <= 0) {
                    this.endGiveaway(data.id).catch(err => logger_1.logger.warn('GiveawayService: Failed to auto-end expired giveaway on load', err));
                }
                else {
                    const timer = setTimeout(() => {
                        this.endGiveaway(data.id).catch(err => logger_1.logger.warn('Auto-end giveaway failed:', err));
                    }, remaining);
                    timer.unref();
                    this.timerIds.set(data.id, timer);
                }
            }
            else {
                const cleanupTimer = setTimeout(() => {
                    this.giveaways.delete(data.id);
                    this.cleanupTimers.delete(data.id);
                    redis_1.cache.del(`${REDIS_PREFIX}${data.id}`).catch(() => { });
                }, GiveawayService.CLEANUP_DELAY_MS);
                cleanupTimer.unref();
                this.cleanupTimers.set(data.id, cleanupTimer);
            }
        }
        if (loaded > 0) {
            logger_1.logger.info(`GiveawayService: Restored ${loaded} giveaways from Redis`);
        }
    }
    async persistGiveaway(giveaway) {
        try {
            await redis_1.cache.set(`${REDIS_PREFIX}${giveaway.id}`, giveaway);
        }
        catch (err) {
            logger_1.logger.warn('GiveawayService: Failed to persist giveaway to Redis', err);
        }
    }
    async unpersistGiveaway(giveawayId) {
        try {
            await redis_1.cache.del(`${REDIS_PREFIX}${giveawayId}`);
        }
        catch (err) {
            logger_1.logger.warn('GiveawayService: Failed to remove giveaway from Redis', err);
        }
    }
    createGiveaway(options) {
        const { guildId, channelId, hostId, hostName, title, description, winners, durationMinutes, requiredRoleId, } = options;
        const activeCount = Array.from(this.giveaways.values()).filter(g => g.guildId === guildId && !g.ended).length;
        if (activeCount >= GiveawayService.MAX_GIVEAWAYS_PER_GUILD) {
            return `Maximum of ${GiveawayService.MAX_GIVEAWAYS_PER_GUILD} active giveaways per server.`;
        }
        this.idCounter += 1;
        const id = `giveaway_${Date.now()}_${this.idCounter}`;
        const giveaway = {
            id,
            guildId,
            channelId,
            messageId: '',
            hostId,
            hostName,
            title,
            description,
            winners: Math.max(1, Math.min(winners, 20)),
            requiredRoleId,
            endsAt: new Date(Date.now() + durationMinutes * 60 * 1000),
            entries: [],
            ended: false,
            winnerIds: [],
        };
        this.giveaways.set(id, giveaway);
        this.persistGiveaway(giveaway).catch(() => { });
        const timer = setTimeout(() => {
            this.endGiveaway(id).catch(err => logger_1.logger.warn('Auto-end giveaway failed:', err));
        }, durationMinutes * 60 * 1000);
        timer.unref();
        this.timerIds.set(id, timer);
        return giveaway;
    }
    setMessageId(giveawayId, messageId) {
        const g = this.giveaways.get(giveawayId);
        if (g) {
            g.messageId = messageId;
            this.persistGiveaway(g).catch(() => { });
        }
    }
    async addEntry(giveawayId, userId, username, member) {
        const g = this.giveaways.get(giveawayId);
        if (!g) {
            return 'Giveaway not found.';
        }
        if (g.ended) {
            return 'This giveaway has already ended.';
        }
        if (g.entries.some(e => e.userId === userId)) {
            return 'You have already entered this giveaway.';
        }
        if (g.requiredRoleId && member) {
            if (!member.roles.cache.has(g.requiredRoleId)) {
                return `You need the <@&${g.requiredRoleId}> role to enter this giveaway.`;
            }
        }
        g.entries.push({ userId, username, enteredAt: new Date() });
        this.persistGiveaway(g).catch(() => { });
        return null;
    }
    async endGiveaway(giveawayId) {
        const g = this.giveaways.get(giveawayId);
        if (!g || g.ended) {
            return [];
        }
        g.ended = true;
        const timer = this.timerIds.get(giveawayId);
        if (timer) {
            clearTimeout(timer);
            this.timerIds.delete(giveawayId);
        }
        const pool = [...g.entries];
        const winners = [];
        for (let i = 0; i < g.winners && pool.length > 0; i++) {
            const idx = (0, crypto_1.randomInt)(pool.length);
            winners.push(pool[idx].userId);
            pool.splice(idx, 1);
        }
        g.winnerIds = winners;
        this.persistGiveaway(g).catch(() => { });
        await this.updateGiveawayMessage(g);
        const cleanupTimer = setTimeout(() => {
            this.giveaways.delete(giveawayId);
            this.cleanupTimers.delete(giveawayId);
            this.unpersistGiveaway(giveawayId).catch(() => { });
        }, GiveawayService.CLEANUP_DELAY_MS);
        cleanupTimer.unref();
        this.cleanupTimers.set(giveawayId, cleanupTimer);
        return winners;
    }
    getGiveaway(giveawayId) {
        return this.giveaways.get(giveawayId);
    }
    listGiveaways(guildId) {
        return Array.from(this.giveaways.values()).filter(g => g.guildId === guildId && !g.ended);
    }
    buildGiveawayEmbed(giveaway) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`🎉 ${(0, shared_types_1.decodeHtmlEntities)(giveaway.title)}`)
            .setDescription((0, shared_types_1.decodeHtmlEntities)(giveaway.description))
            .setColor(giveaway.ended ? 0x95a5a6 : 0xf1c40f)
            .addFields({ name: '🏆 Winners', value: `${giveaway.winners}`, inline: true }, { name: '🎟️ Entries', value: `${giveaway.entries.length}`, inline: true }, {
            name: '⏰ Ends',
            value: giveaway.ended
                ? '**ENDED**'
                : `<t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>`,
            inline: true,
        })
            .setFooter({
            text: `Hosted by ${(0, shared_types_1.decodeHtmlEntities)(giveaway.hostName)} | ID: ${giveaway.id}`,
        })
            .setTimestamp();
        if (giveaway.requiredRoleId) {
            embed.addFields({
                name: '🔒 Required Role',
                value: `<@&${giveaway.requiredRoleId}>`,
                inline: true,
            });
        }
        if (giveaway.ended && giveaway.winnerIds.length > 0) {
            embed.addFields({
                name: '🎊 Winners',
                value: giveaway.winnerIds.map(id => `<@${id}>`).join(', '),
                inline: false,
            });
        }
        else if (giveaway.ended) {
            embed.addFields({
                name: '🎊 Winners',
                value: 'No valid entries.',
                inline: false,
            });
        }
        return embed;
    }
    buildGiveawayButtons(giveawayId, ended) {
        return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`giveaway_enter_${giveawayId}`)
            .setLabel('Enter Giveaway')
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setEmoji('🎟️')
            .setDisabled(ended));
    }
    async updateGiveawayMessage(giveaway) {
        if (!this.client || !giveaway.messageId) {
            return;
        }
        try {
            const channel = await this.client.channels.fetch(giveaway.channelId).catch(() => null);
            if (!channel || !(channel instanceof discord_js_1.TextChannel)) {
                return;
            }
            const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
            if (!message) {
                return;
            }
            const embed = this.buildGiveawayEmbed(giveaway);
            const row = this.buildGiveawayButtons(giveaway.id, giveaway.ended);
            await message.edit({ embeds: [embed], components: [row] });
        }
        catch (error) {
            logger_1.logger.warn('Failed to update giveaway message:', error);
        }
    }
    shutdown() {
        for (const timer of this.timerIds.values()) {
            clearTimeout(timer);
        }
        for (const timer of this.cleanupTimers.values()) {
            clearTimeout(timer);
        }
        this.timerIds.clear();
        this.cleanupTimers.clear();
        this.giveaways.clear();
        this.client = null;
        logger_1.logger.info('GiveawayService shut down');
    }
}
exports.GiveawayService = GiveawayService;
//# sourceMappingURL=GiveawayService.js.map