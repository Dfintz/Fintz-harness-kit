"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discordUserPreferenceService = exports.DiscordUserPreferenceService = void 0;
const database_1 = require("../../config/database");
const DiscordUserPreference_1 = require("../../models/DiscordUserPreference");
const logger_1 = require("../../utils/logger");
class DiscordUserPreferenceService {
    static instance;
    repo;
    constructor() {
        this.repo = database_1.AppDataSource.getRepository(DiscordUserPreference_1.DiscordUserPreference);
    }
    static getInstance() {
        DiscordUserPreferenceService.instance ??= new DiscordUserPreferenceService();
        return DiscordUserPreferenceService.instance;
    }
    async getOrCreate(userId, guildId) {
        let pref = await this.repo.findOne({
            where: { userId, guildId },
        });
        if (!pref) {
            pref = this.repo.create({
                userId,
                guildId,
                dmEnabled: true,
                lfgPingOptIn: true,
                eventReminderOptIn: true,
                ticketDmOptIn: true,
                recruitmentDmOptIn: true,
                moderationAlertOptIn: true,
            });
            await this.repo.save(pref);
            logger_1.logger.info(`Created Discord user preference for user:${userId} guild:${guildId}`);
        }
        return pref;
    }
    async get(userId, guildId) {
        return this.repo.findOne({ where: { userId, guildId } });
    }
    async update(userId, guildId, updates) {
        const pref = await this.getOrCreate(userId, guildId);
        Object.assign(pref, updates);
        await this.repo.save(pref);
        logger_1.logger.info(`Updated Discord user preference for user:${userId} guild:${guildId}`);
        return pref;
    }
    async isDmEnabled(userId, guildId) {
        const pref = await this.get(userId, guildId);
        return pref?.dmEnabled ?? true;
    }
    async filterDmEnabled(userIds, guildId) {
        if (userIds.length === 0) {
            return new Set();
        }
        const prefs = await this.repo
            .createQueryBuilder('pref')
            .where('pref.guildId = :guildId', { guildId })
            .andWhere('pref.userId IN (:...userIds)', { userIds })
            .andWhere('pref.dmEnabled = false')
            .getMany();
        const optedOut = new Set(prefs.map(p => p.userId));
        return new Set(userIds.filter(id => !optedOut.has(id)));
    }
    async getGuildPreferences(guildId) {
        return this.repo.find({ where: { guildId } });
    }
}
exports.DiscordUserPreferenceService = DiscordUserPreferenceService;
exports.discordUserPreferenceService = DiscordUserPreferenceService.getInstance();
//# sourceMappingURL=DiscordUserPreferenceService.js.map