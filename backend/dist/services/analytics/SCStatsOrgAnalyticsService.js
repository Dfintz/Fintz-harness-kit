"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCStatsOrgAnalyticsService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const SCStatsCsvImport_1 = require("../../models/SCStatsCsvImport");
const UserGameplayPreferences_1 = require("../../models/UserGameplayPreferences");
const logger_1 = require("../../utils/logger");
class SCStatsOrgAnalyticsService {
    preferencesRepo;
    membershipRepo;
    constructor() {
        this.preferencesRepo = data_source_1.AppDataSource.getRepository(UserGameplayPreferences_1.UserGameplayPreferences);
        this.membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    }
    async getOrgAnalytics(organizationId) {
        const memberCount = await this.membershipRepo.count({
            where: { organizationId, isActive: true },
        });
        if (memberCount === 0) {
            return this.emptyAnalytics();
        }
        const aggregates = await this.preferencesRepo
            .createQueryBuilder('p')
            .select('COUNT(*)::int', 'verifiedCount')
            .addSelect('COALESCE(AVG(p."scstats_kd_ratio"), 0)', 'averageKD')
            .addSelect('COALESCE(AVG(p."scstats_total_hours"), 0)', 'averageTotalHours')
            .addSelect('COALESCE(AVG(p."scstats_missions_completed"), 0)', 'averageMissionsCompleted')
            .where(qb => {
            const subQuery = qb
                .subQuery()
                .select('m.userId')
                .from(OrganizationMembership_1.OrganizationMembership, 'm')
                .where('m.organizationId = :orgId')
                .andWhere('m.isActive = true')
                .getQuery();
            return `p."userId" IN ${subQuery}`;
        })
            .andWhere('p."scstats_verified" = true')
            .setParameter('orgId', organizationId)
            .getRawOne();
        const verifiedCount = aggregates?.verifiedCount ?? 0;
        const verificationRate = memberCount > 0 ? (verifiedCount / memberCount) * 100 : 0;
        const topPerformers = await this.preferencesRepo
            .createQueryBuilder('p')
            .select('p."userId"', 'userId')
            .addSelect('p."scstats_kd_ratio"', 'kdRatio')
            .addSelect('p."scstats_total_hours"', 'totalHours')
            .where(qb => {
            const subQuery = qb
                .subQuery()
                .select('m2.userId')
                .from(OrganizationMembership_1.OrganizationMembership, 'm2')
                .where('m2.organizationId = :orgId')
                .andWhere('m2.isActive = true')
                .getQuery();
            return `p."userId" IN ${subQuery}`;
        })
            .andWhere('p."scstats_verified" = true')
            .andWhere('p."scstats_kd_ratio" IS NOT NULL')
            .setParameter('orgId', organizationId)
            .orderBy('p."scstats_kd_ratio"', 'DESC')
            .limit(10)
            .getRawMany();
        const memberIds = await this.membershipRepo
            .createQueryBuilder('m')
            .select('m.userId', 'userId')
            .where('m.organizationId = :orgId', { orgId: organizationId })
            .andWhere('m.isActive = true')
            .getRawMany()
            .then(rows => rows.map(r => r.userId));
        const { careerBreakdown, skillDistribution } = await this.calculateCareerAnalytics(memberIds);
        logger_1.logger.info('Org SCStats analytics generated', {
            organizationId,
            memberCount,
            verifiedCount,
        });
        return {
            memberCount,
            verifiedCount,
            verificationRate,
            averageKD: Number(aggregates?.averageKD ?? 0),
            averageTotalHours: Number(aggregates?.averageTotalHours ?? 0),
            averageMissionsCompleted: Number(aggregates?.averageMissionsCompleted ?? 0),
            topPerformers: topPerformers.map(p => ({
                userId: p.userId,
                kdRatio: Number(p.kdRatio ?? 0),
                totalHours: Number(p.totalHours ?? 0),
            })),
            skillDistribution,
            careerBreakdown,
        };
    }
    async calculateCareerAnalytics(memberIds) {
        if (memberIds.length === 0) {
            return { careerBreakdown: [], skillDistribution: {} };
        }
        const csvImportRepo = data_source_1.AppDataSource.getRepository(SCStatsCsvImport_1.SCStatsCsvImport);
        const imports = await csvImportRepo.find({
            where: { userId: (0, typeorm_1.In)(memberIds) },
            select: ['userId', 'summary'],
        });
        const careerTotals = new Map();
        const distribution = {};
        for (const csvImport of imports) {
            const summary = csvImport.summary;
            if (!summary) {
                continue;
            }
            const hoursByCareer = summary.hoursByCareer;
            if (!Array.isArray(hoursByCareer) || hoursByCareer.length === 0) {
                continue;
            }
            this.aggregateCareerEntries(hoursByCareer, careerTotals, distribution);
        }
        const careerBreakdown = [...careerTotals.entries()]
            .map(([career, { hours, shipCount }]) => ({
            career,
            hours: Math.round(hours * 100) / 100,
            shipCount,
        }))
            .sort((a, b) => b.hours - a.hours);
        return { careerBreakdown, skillDistribution: distribution };
    }
    aggregateCareerEntries(entries, careerTotals, distribution) {
        for (const entry of entries) {
            const hours = Number(entry.hours) || 0;
            if (hours <= 0) {
                continue;
            }
            const career = String(entry.career ?? '');
            if (!career || career === '__proto__' || career === 'constructor' || career === 'prototype') {
                continue;
            }
            const shipCount = Number(entry.shipCount) || 0;
            const existing = careerTotals.get(career);
            if (existing) {
                existing.hours += hours;
                existing.shipCount += shipCount;
            }
            else {
                careerTotals.set(career, { hours, shipCount });
            }
            if (!distribution[career]) {
                distribution[career] = { low: 0, medium: 0, high: 0, expert: 0 };
            }
            distribution[career][this.bucketFlightHours(hours)]++;
        }
    }
    bucketFlightHours(hours) {
        if (hours < 50) {
            return 'low';
        }
        if (hours < 200) {
            return 'medium';
        }
        if (hours < 500) {
            return 'high';
        }
        return 'expert';
    }
    emptyAnalytics() {
        return {
            memberCount: 0,
            verifiedCount: 0,
            verificationRate: 0,
            averageKD: 0,
            averageTotalHours: 0,
            averageMissionsCompleted: 0,
            topPerformers: [],
            skillDistribution: {},
            careerBreakdown: [],
        };
    }
}
exports.SCStatsOrgAnalyticsService = SCStatsOrgAnalyticsService;
//# sourceMappingURL=SCStatsOrgAnalyticsService.js.map