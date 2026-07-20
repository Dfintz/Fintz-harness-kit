"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelCounterService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const database_1 = require("../../config/database");
const MemberEngagement_1 = require("../../models/MemberEngagement");
const logger_1 = require("../../utils/logger");
class ChannelCounterService {
    static instance;
    repo;
    guildFetchCache = new Map();
    static GUILD_FETCH_TTL_MS = 10 * 60 * 1000;
    constructor() {
        this.repo = database_1.AppDataSource.getRepository(MemberEngagement_1.ChannelCounter);
    }
    static getInstance() {
        if (!ChannelCounterService.instance) {
            ChannelCounterService.instance = new ChannelCounterService();
        }
        return ChannelCounterService.instance;
    }
    async createCounter(guildId, channelId, counterType, nameTemplate = '{value}') {
        const counter = this.repo.create({
            guildId,
            channelId,
            counterType,
            nameTemplate,
            enabled: true,
        });
        return this.repo.save(counter);
    }
    async deleteCounter(guildId, channelId) {
        const result = await this.repo.delete({ guildId, channelId });
        return (result.affected ?? 0) > 0;
    }
    async getCountersForGuild(guildId) {
        return this.repo.find({ where: { guildId, enabled: true } });
    }
    async updateCounters(client, guildId) {
        const counters = await this.getCountersForGuild(guildId);
        if (counters.length === 0) {
            return;
        }
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return;
        }
        for (const counter of counters) {
            try {
                const value = await this.resolveCounterValue(guild, counter.counterType);
                const newName = (0, shared_types_1.decodeHtmlEntities)(counter.nameTemplate).replace('{value}', String(value));
                const channel = await guild.channels.fetch(counter.channelId).catch(() => null);
                if (!channel) {
                    logger_1.logger.warn(`Counter channel ${counter.channelId} not found in guild ${guildId}`);
                    continue;
                }
                if (channel.name !== newName) {
                    await channel.setName(newName, 'Stat counter update');
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to update counter ${counter.channelId}:`, error);
            }
        }
    }
    async resolveCounterValue(guild, counterType) {
        switch (counterType) {
            case 'member_count':
                return guild.memberCount;
            case 'online_count': {
                const cached = this.guildFetchCache.get(guild.id);
                if (cached && cached.expiresAt > Date.now()) {
                    return cached.data.approximatePresenceCount ?? 0;
                }
                const fetched = await guild.fetch();
                this.guildFetchCache.set(guild.id, {
                    data: fetched,
                    expiresAt: Date.now() + ChannelCounterService.GUILD_FETCH_TTL_MS,
                });
                return fetched.approximatePresenceCount ?? 0;
            }
            case 'voice_count': {
                let count = 0;
                for (const channel of guild.channels.cache.values()) {
                    if (channel.type === discord_js_1.ChannelType.GuildVoice ||
                        channel.type === discord_js_1.ChannelType.GuildStageVoice) {
                        count += channel.members.size;
                    }
                }
                return count;
            }
            default:
                return 0;
        }
    }
}
exports.ChannelCounterService = ChannelCounterService;
//# sourceMappingURL=ChannelCounterService.js.map