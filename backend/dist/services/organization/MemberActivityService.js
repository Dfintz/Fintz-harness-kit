"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberActivityService = void 0;
const data_source_1 = require("../../data-source");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const redis_1 = require("../../utils/redis");
class MemberActivityService {
    userRepo = data_source_1.AppDataSource.getRepository(User_1.User);
    userOrgRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    ACTIVE_THRESHOLD_DAYS = 30;
    async getActiveMemberCount(organizationId) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - this.ACTIVE_THRESHOLD_DAYS);
        const activeCount = await this.userRepo
            .createQueryBuilder('user')
            .where(qb => {
            const subQuery = qb
                .subQuery()
                .select('m.userId')
                .from(OrganizationMembership_1.OrganizationMembership, 'm')
                .where('m.organizationId = :orgId')
                .andWhere('m.isActive = true')
                .getQuery();
            return `user.id IN ${subQuery}`;
        })
            .andWhere('user.lastActiveAt >= :threshold', { threshold: thresholdDate })
            .setParameter('orgId', organizationId)
            .getCount();
        return activeCount;
    }
    async getActivityTrends(organizationId, days = 30) {
        const cacheKey = `org:${organizationId}:activity:trends:${days}`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const totalMembers = await this.userOrgRepo.count({
            where: { organizationId, isActive: true },
        });
        if (totalMembers === 0) {
            return {
                period: { start: startDate, end: endDate },
                dailyActiveMembers: [],
                averageActiveMembers: 0,
                totalMembers: 0,
                activeRate: 0,
            };
        }
        const dailyCounts = await this.userRepo
            .createQueryBuilder('user')
            .select('DATE(user.lastActiveAt)', 'date')
            .addSelect('COUNT(*)', 'count')
            .where(qb => {
            const subQuery = qb
                .subQuery()
                .select('m.userId')
                .from(OrganizationMembership_1.OrganizationMembership, 'm')
                .where('m.organizationId = :orgId')
                .andWhere('m.isActive = true')
                .getQuery();
            return `user.id IN ${subQuery}`;
        })
            .andWhere('user.lastActiveAt >= :startDate', { startDate })
            .andWhere('user.lastActiveAt <= :endDate', { endDate })
            .setParameter('orgId', organizationId)
            .groupBy('DATE(user.lastActiveAt)')
            .orderBy('DATE(user.lastActiveAt)', 'ASC')
            .getRawMany();
        const countMap = new Map();
        dailyCounts.forEach((row) => {
            const dateStr = new Date(row.date).toISOString().split('T')[0];
            countMap.set(dateStr, parseInt(row.count));
        });
        const dailyActiveMembers = [];
        let totalActive = 0;
        for (let i = 0; i < days; i++) {
            const date = new Date(endDate);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const count = countMap.get(dateStr) || 0;
            dailyActiveMembers.unshift({
                date: dateStr,
                count,
            });
            totalActive += count;
        }
        const averageActiveMembers = totalActive / days;
        const currentActiveCount = await this.getActiveMemberCount(organizationId);
        const activeRate = (currentActiveCount / totalMembers) * 100;
        const result = {
            period: { start: startDate, end: endDate },
            dailyActiveMembers,
            averageActiveMembers: Math.round(averageActiveMembers * 100) / 100,
            totalMembers,
            activeRate: Math.round(activeRate * 100) / 100,
        };
        await redis_1.cache.set(cacheKey, result, 600);
        return result;
    }
    async getActiveMembers(organizationId, limit = 100) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - this.ACTIVE_THRESHOLD_DAYS);
        const activeUsers = await this.userRepo
            .createQueryBuilder('user')
            .select(['user.id', 'user.username', 'user.lastActiveAt'])
            .where(qb => {
            const subQuery = qb
                .subQuery()
                .select('m.userId')
                .from(OrganizationMembership_1.OrganizationMembership, 'm')
                .where('m.organizationId = :orgId')
                .andWhere('m.isActive = true')
                .getQuery();
            return `user.id IN ${subQuery}`;
        })
            .andWhere('user.lastActiveAt >= :threshold', { threshold: thresholdDate })
            .setParameter('orgId', organizationId)
            .orderBy('user.lastActiveAt', 'DESC')
            .limit(limit)
            .getMany();
        return activeUsers.map(user => ({
            userId: user.id,
            username: user.username,
            lastActiveAt: user.lastActiveAt || new Date(),
        }));
    }
}
exports.MemberActivityService = MemberActivityService;
//# sourceMappingURL=MemberActivityService.js.map