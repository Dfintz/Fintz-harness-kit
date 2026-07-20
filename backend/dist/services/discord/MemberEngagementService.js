"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberEngagementService = void 0;
const database_1 = require("../../config/database");
const MemberEngagement_1 = require("../../models/MemberEngagement");
const logger_1 = require("../../utils/logger");
class MemberEngagementService {
    static instance;
    repo;
    constructor() {
        this.repo = database_1.AppDataSource.getRepository(MemberEngagement_1.MemberEngagement);
    }
    static getInstance() {
        if (!MemberEngagementService.instance) {
            MemberEngagementService.instance = new MemberEngagementService();
        }
        return MemberEngagementService.instance;
    }
    today() {
        return new Date().toISOString().slice(0, 10);
    }
    async incrementMessageCount(guildId, userId, count = 1) {
        const date = this.today();
        const sanitizedCount = Math.max(1, Math.min(Math.floor(count), 10000));
        try {
            const result = await this.repo
                .createQueryBuilder()
                .update(MemberEngagement_1.MemberEngagement)
                .set({ messageCount: () => '"messageCount" + :increment' })
                .setParameter('increment', sanitizedCount)
                .where('guildId = :guildId AND userId = :userId AND date = :date', {
                guildId,
                userId,
                date,
            })
                .execute();
            if (result.affected === 0) {
                const engagement = this.repo.create({
                    guildId,
                    userId,
                    date,
                    messageCount: sanitizedCount,
                    voiceMinutes: 0,
                    reactionsGiven: 0,
                    threadsCreated: 0,
                });
                await this.repo.save(engagement);
            }
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('duplicate key')) {
                await this.repo
                    .createQueryBuilder()
                    .update(MemberEngagement_1.MemberEngagement)
                    .set({ messageCount: () => '"messageCount" + :increment' })
                    .setParameter('increment', sanitizedCount)
                    .where('guildId = :guildId AND userId = :userId AND date = :date', {
                    guildId,
                    userId,
                    date,
                })
                    .execute();
            }
            else {
                logger_1.logger.error('Failed to increment message count', error);
            }
        }
    }
    async addVoiceMinutes(guildId, userId, minutes) {
        if (minutes <= 0) {
            return;
        }
        const date = this.today();
        try {
            const result = await this.repo
                .createQueryBuilder()
                .update(MemberEngagement_1.MemberEngagement)
                .set({ voiceMinutes: () => `"voiceMinutes" + ${Math.round(minutes)}` })
                .where('guildId = :guildId AND userId = :userId AND date = :date', {
                guildId,
                userId,
                date,
            })
                .execute();
            if (result.affected === 0) {
                const engagement = this.repo.create({
                    guildId,
                    userId,
                    date,
                    messageCount: 0,
                    voiceMinutes: Math.round(minutes),
                    reactionsGiven: 0,
                    threadsCreated: 0,
                });
                await this.repo.save(engagement);
            }
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('duplicate key')) {
                await this.repo
                    .createQueryBuilder()
                    .update(MemberEngagement_1.MemberEngagement)
                    .set({ voiceMinutes: () => `"voiceMinutes" + ${Math.round(minutes)}` })
                    .where('guildId = :guildId AND userId = :userId AND date = :date', {
                    guildId,
                    userId,
                    date,
                })
                    .execute();
            }
            else {
                logger_1.logger.error('Failed to add voice minutes', error);
            }
        }
    }
    async getUserStats(guildId, userId, days = 30) {
        const since = this.dateDaysAgo(days);
        const result = await this.repo
            .createQueryBuilder('e')
            .select('COALESCE(SUM(e.messageCount), 0)', 'messageCount')
            .addSelect('COALESCE(SUM(e.voiceMinutes), 0)', 'voiceMinutes')
            .where('e.guildId = :guildId AND e.userId = :userId AND e.date >= :since', {
            guildId,
            userId,
            since,
        })
            .getRawOne();
        return {
            messageCount: Number.parseInt(result?.messageCount ?? '0', 10),
            voiceMinutes: Number.parseInt(result?.voiceMinutes ?? '0', 10),
        };
    }
    async getLeaderboard(guildId, metric, days = 30, limit = 10) {
        const since = this.dateDaysAgo(days);
        const results = await this.repo
            .createQueryBuilder('e')
            .select('e.userId', 'userId')
            .addSelect(`SUM(e.${metric})`, 'total')
            .where('e.guildId = :guildId AND e.date >= :since', { guildId, since })
            .groupBy('e.userId')
            .orderBy('total', 'DESC')
            .limit(limit)
            .getRawMany();
        return results.map((r) => ({
            userId: r.userId,
            total: Number.parseInt(r.total, 10),
        }));
    }
    async getGuildAggregates(guildId, days) {
        const since = this.dateDaysAgo(days);
        const results = await this.repo
            .createQueryBuilder('e')
            .select('e.userId', 'userId')
            .addSelect('SUM(e.messageCount)', 'messageCount')
            .addSelect('SUM(e.voiceMinutes)', 'voiceMinutes')
            .where('e.guildId = :guildId AND e.date >= :since', { guildId, since })
            .groupBy('e.userId')
            .getRawMany();
        return results.map((r) => ({
            userId: r.userId,
            messageCount: Number.parseInt(r.messageCount, 10),
            voiceMinutes: Number.parseInt(r.voiceMinutes, 10),
        }));
    }
    async cleanupOldData(retentionDays) {
        const cutoff = this.dateDaysAgo(retentionDays);
        const result = await this.repo
            .createQueryBuilder()
            .delete()
            .from(MemberEngagement_1.MemberEngagement)
            .where('date < :cutoff', { cutoff })
            .execute();
        return result.affected ?? 0;
    }
    dateDaysAgo(days) {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString().slice(0, 10);
    }
}
exports.MemberEngagementService = MemberEngagementService;
//# sourceMappingURL=MemberEngagementService.js.map