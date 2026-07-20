"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationPreferencesService = void 0;
const database_1 = require("../../../config/database");
const NotificationPreferences_1 = require("../../../models/NotificationPreferences");
const logger_1 = require("../../../utils/logger");
class NotificationPreferencesService {
    repo;
    constructor() {
        this.repo = database_1.AppDataSource.getRepository(NotificationPreferences_1.NotificationPreferences);
    }
    async getOrCreate(userId) {
        let prefs = await this.repo.findOne({ where: { userId } });
        if (!prefs) {
            prefs = this.repo.create({
                userId,
                muteAll: false,
                channels: { ...NotificationPreferences_1.DEFAULT_CHANNELS },
                categories: { ...NotificationPreferences_1.DEFAULT_CATEGORIES },
                digestFrequency: 'daily',
            });
            prefs = await this.repo.save(prefs);
            logger_1.logger.info('Created default notification preferences', { userId });
        }
        prefs.channels = { ...NotificationPreferences_1.DEFAULT_CHANNELS, ...prefs.channels };
        prefs.categories = { ...NotificationPreferences_1.DEFAULT_CATEGORIES, ...prefs.categories };
        return prefs;
    }
    async update(userId, dto) {
        const prefs = await this.getOrCreate(userId);
        if (dto.muteAll !== undefined) {
            prefs.muteAll = dto.muteAll;
        }
        if (dto.channels) {
            prefs.channels = { ...prefs.channels, ...dto.channels };
        }
        if (dto.categories) {
            prefs.categories = { ...prefs.categories, ...dto.categories };
        }
        if (dto.digestFrequency) {
            prefs.digestFrequency = dto.digestFrequency;
        }
        const saved = await this.repo.save(prefs);
        logger_1.logger.info('Updated notification preferences', { userId, changes: dto });
        return saved;
    }
    async shouldDeliver(userId, channel, category) {
        const prefs = await this.getOrCreate(userId);
        if (category === 'system') {
            return true;
        }
        if (prefs.muteAll) {
            return false;
        }
        return prefs.channels[channel] !== false && prefs.categories[category] !== false;
    }
    async deleteForUser(userId) {
        const result = await this.repo.delete({ userId });
        return result.affected ?? 0;
    }
}
exports.NotificationPreferencesService = NotificationPreferencesService;
//# sourceMappingURL=NotificationPreferencesService.js.map