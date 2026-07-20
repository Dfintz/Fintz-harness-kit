"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationAnalyticsService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
const OrganizationActivity_1 = require("../../models/OrganizationActivity");
const OrganizationAnalytics_1 = require("../../models/OrganizationAnalytics");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const OrganizationPermission_1 = require("../../models/OrganizationPermission");
const OrganizationRelationship_1 = require("../../models/OrganizationRelationship");
const logger_1 = require("../../utils/logger");
class OrganizationAnalyticsService {
    analyticsRepository = data_source_1.AppDataSource.getRepository(OrganizationAnalytics_1.OrganizationAnalytics);
    orgRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
    activityRepository = data_source_1.AppDataSource.getRepository(OrganizationActivity_1.OrganizationActivity);
    permissionRepository = data_source_1.AppDataSource.getRepository(OrganizationPermission_1.OrganizationPermission);
    membershipRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    relationshipRepository = data_source_1.AppDataSource.getRepository(OrganizationRelationship_1.OrganizationRelationship);
    async generateAnalytics(orgId, period = OrganizationAnalytics_1.AnalyticsPeriod.DAILY, startDate, endDate) {
        endDate ??= new Date();
        startDate ??= this.calculateStartDate(endDate, period);
        const org = await this.orgRepository.findOne({
            where: { id: orgId },
            relations: ['children', 'parentOrg']
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        const memberStats = await this.generateMemberStats(orgId, startDate, endDate);
        const activityMetrics = await this.generateActivityMetrics(orgId, startDate, endDate);
        const engagementMetrics = await this.generateEngagementMetrics(orgId, startDate, endDate, memberStats, activityMetrics);
        const growthMetrics = await this.generateGrowthMetrics(orgId, startDate, endDate, period);
        const hierarchyHealth = await this.generateHierarchyHealth(orgId);
        const resourceUsage = await this.generateResourceUsage(orgId, startDate, endDate);
        const analytics = this.analyticsRepository.create({
            organizationId: orgId,
            period,
            periodStart: startDate,
            periodEnd: endDate,
            memberStats,
            activityMetrics,
            engagementMetrics,
            growthMetrics,
            hierarchyHealth,
            resourceUsage,
            isSnapshot: true
        });
        analytics.calculateHealthScore();
        analytics.generateAlerts();
        analytics.generateRecommendations();
        const previousAnalytics = await this.getPreviousPeriodAnalytics(orgId, period, startDate);
        analytics.compareWithPrevious(previousAnalytics);
        return this.analyticsRepository.save(analytics);
    }
    async generateMemberStats(orgId, startDate, endDate) {
        const org = await this.orgRepository.findOne({ where: { id: orgId } });
        if (!org) {
            throw new Error('Organization not found');
        }
        const memberAdditions = await this.activityRepository.count({
            where: {
                organizationId: orgId,
                action: OrganizationActivity_1.OrgActivityAction.MEMBER_ADDED,
                timestamp: (0, typeorm_1.Between)(startDate, endDate)
            }
        });
        const memberRemovals = await this.activityRepository.count({
            where: {
                organizationId: orgId,
                action: OrganizationActivity_1.OrgActivityAction.MEMBER_REMOVED,
                timestamp: (0, typeorm_1.Between)(startDate, endDate)
            }
        });
        const totalMembers = org.totalMembers ?? 0;
        const previousTotal = totalMembers - memberAdditions + memberRemovals;
        const memberGrowthRate = previousTotal > 0
            ? ((totalMembers - previousTotal) / previousTotal) * 100
            : 0;
        const roleChanges = await this.activityRepository.find({
            where: {
                organizationId: orgId,
                action: OrganizationActivity_1.OrgActivityAction.MEMBER_ROLE_CHANGED
            },
            order: { timestamp: 'DESC' },
            take: 100
        });
        const membersByRole = {};
        roleChanges.forEach((activity) => {
            if (activity.metadata?.newRole) {
                const role = activity.metadata.newRole;
                membersByRole[role] = (membersByRole[role] ?? 0) + 1;
            }
        });
        const activeUserIds = await this.activityRepository
            .createQueryBuilder('activity')
            .select('COUNT(DISTINCT activity.actorId)', 'count')
            .where('activity.organizationId = :orgId', { orgId })
            .andWhere('activity.actorId IS NOT NULL')
            .andWhere('activity.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
            .getRawOne();
        const activeMembers = Math.min(Number.parseInt(activeUserIds?.count ?? '0', 10), totalMembers);
        const inactiveMembers = Math.max(totalMembers - activeMembers, 0);
        const tenureResult = await this.membershipRepository
            .createQueryBuilder('membership')
            .select('AVG(EXTRACT(EPOCH FROM (NOW() - membership.joinedAt)) / 86400)', 'avgDays')
            .where('membership.organizationId = :orgId', { orgId })
            .andWhere('membership.isActive = true')
            .andWhere('membership.joinedAt IS NOT NULL')
            .getRawOne();
        const averageTenure = Math.round(Number.parseFloat(tenureResult?.avgDays ?? '0')) || 0;
        return {
            totalMembers,
            directMembers: org.directMembers ?? 0,
            activeMembers,
            inactiveMembers,
            newMembersThisPeriod: memberAdditions,
            removedMembersThisPeriod: memberRemovals,
            membersByRole,
            averageTenure,
            memberGrowthRate
        };
    }
    async generateActivityMetrics(orgId, startDate, endDate) {
        const activities = await this.activityRepository.find({
            where: {
                organizationId: orgId,
                timestamp: (0, typeorm_1.Between)(startDate, endDate)
            }
        });
        const totalActivities = activities.length;
        const activitiesByType = {};
        activities.forEach(activity => {
            activitiesByType[activity.action] = (activitiesByType[activity.action] ?? 0) + 1;
        });
        const activitiesBySeverity = {};
        activities.forEach(activity => {
            activitiesBySeverity[activity.severity] = (activitiesBySeverity[activity.severity] ?? 0) + 1;
        });
        const activityTrend = this.calculateActivityTrend(activities, startDate, endDate);
        const userActivityMap = new Map();
        activities.forEach(activity => {
            if (activity.actorId) {
                userActivityMap.set(activity.actorId, (userActivityMap.get(activity.actorId) ?? 0) + 1);
            }
        });
        const mostActiveUsers = Array.from(userActivityMap.entries())
            .map(([userId, count]) => ({ userId, activityCount: count }))
            .sort((a, b) => b.activityCount - a.activityCount)
            .slice(0, 10);
        const hourlyActivity = new Array(24).fill(0);
        activities.forEach(activity => {
            const hour = new Date(activity.timestamp).getHours();
            hourlyActivity[hour]++;
        });
        const peakActivityTimes = hourlyActivity
            .map((count, hour) => ({ hour, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const averageActivitiesPerDay = daysDiff > 0 ? totalActivities / daysDiff : 0;
        return {
            totalActivities,
            activitiesByType,
            activitiesBySeverity,
            activityTrend,
            mostActiveUsers,
            peakActivityTimes,
            averageActivitiesPerDay
        };
    }
    async generateEngagementMetrics(orgId, startDate, endDate, memberStats, activityMetrics) {
        const totalMembers = memberStats.totalMembers;
        const activeMembers = memberStats.activeMembers;
        let engagementScore = 0;
        const activePercentage = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0;
        engagementScore += (activePercentage * 0.4);
        const activitiesPerUser = totalMembers > 0
            ? activityMetrics.totalActivities / totalMembers
            : 0;
        const activityScore = Math.min((activitiesPerUser / 10) * 30, 30);
        engagementScore += activityScore;
        const daysSinceLastActivity = await this.getDaysSinceLastActivity(orgId);
        const recencyScore = Math.max(30 - (daysSinceLastActivity * 2), 0);
        engagementScore += recencyScore;
        const avgActivitiesPerDay = activityMetrics.averageActivitiesPerDay;
        let engagementTrend = 'STABLE';
        if (avgActivitiesPerDay > 20) {
            engagementTrend = 'INCREASING';
        }
        else if (avgActivitiesPerDay < 5) {
            engagementTrend = 'DECREASING';
        }
        const lastActivityDate = await this.getLastActivityDate(orgId);
        const dormantMembers = totalMembers - activeMembers;
        const highlyEngagedMembers = Math.floor(activeMembers * 0.3);
        return {
            engagementScore: Math.round(engagementScore),
            activeUsersPercentage: activePercentage,
            averageActivitiesPerUser: activitiesPerUser,
            lastActivityDate,
            dormantMembers,
            highlyEngagedMembers,
            engagementTrend
        };
    }
    async generateGrowthMetrics(orgId, startDate, endDate, _period) {
        const memberGrowth = await this.calculateMemberGrowthTrend(orgId, startDate, endDate);
        const firstCount = memberGrowth[0]?.count ?? 0;
        const lastCount = memberGrowth.at(-1)?.count ?? 0;
        const growthRate = firstCount > 0
            ? ((lastCount - firstCount) / firstCount) * 100
            : 0;
        const churnData = await this.activityRepository.count({
            where: {
                organizationId: orgId,
                action: OrganizationActivity_1.OrgActivityAction.MEMBER_REMOVED,
                timestamp: (0, typeorm_1.Between)(startDate, endDate)
            }
        });
        const avgMembers = (firstCount + lastCount) / 2;
        const churnRate = avgMembers > 0 ? (churnData / avgMembers) * 100 : 0;
        const retentionRate = 100 - churnRate;
        const subOrgCreations = await this.activityRepository.count({
            where: {
                organizationId: orgId,
                action: OrganizationActivity_1.OrgActivityAction.SUB_ORG_CREATED,
                timestamp: (0, typeorm_1.Between)(startDate, endDate)
            }
        });
        return {
            memberGrowth,
            growthRate,
            projectedGrowth: growthRate * 1.1,
            churnRate,
            retentionRate,
            netGrowth: lastCount - firstCount,
            subOrgGrowth: subOrgCreations
        };
    }
    async generateHierarchyHealth(orgId) {
        const org = await this.orgRepository.findOne({
            where: { id: orgId },
            relations: ['children']
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        const descendants = await this.getAllDescendants(orgId);
        const depth = Math.max(...descendants.map(d => d.level), org.level);
        const childCounts = descendants.map(d => d.childCount ?? 0);
        const avgChildren = childCounts.length > 0
            ? childCounts.reduce((a, b) => a + b, 0) / childCounts.length
            : 0;
        const variance = childCounts.length > 0
            ? childCounts.reduce((sum, count) => sum + Math.pow(count - avgChildren, 2), 0) / childCounts.length
            : 0;
        const balance = Math.max(0, 100 - Math.sqrt(variance) * 10);
        const leafNodeCount = descendants.filter(d => (d.childCount ?? 0) === 0).length;
        const middleNodeCount = descendants.length - leafNodeCount;
        const deepestOrg = descendants.reduce((prev, current) => current.level > prev.level ? current : prev, org);
        const deepestPath = deepestOrg.path ? deepestOrg.path.split('.') : [org.id];
        const levelCounts = new Map();
        descendants.forEach(d => {
            levelCounts.set(d.level, (levelCounts.get(d.level) ?? 0) + 1);
        });
        const widestLevel = Math.max(...Array.from(levelCounts.values()), 0);
        return {
            depth,
            balance,
            averageChildrenPerNode: avgChildren,
            leafNodeCount,
            middleNodeCount,
            totalSubOrgs: descendants.length,
            deepestPath,
            widestLevel
        };
    }
    async generateResourceUsage(orgId, startDate, endDate) {
        const failedAccess = await this.activityRepository.count({
            where: {
                organizationId: orgId,
                action: OrganizationActivity_1.OrgActivityAction.ACCESS_DENIED,
                timestamp: (0, typeorm_1.Between)(startDate, endDate)
            }
        });
        const errors = await this.activityRepository.count({
            where: {
                organizationId: orgId,
                severity: OrganizationActivity_1.ActivitySeverity.ERROR,
                timestamp: (0, typeorm_1.Between)(startDate, endDate)
            }
        });
        const totalActivities = await this.activityRepository.count({
            where: {
                organizationId: orgId,
                timestamp: (0, typeorm_1.Between)(startDate, endDate)
            }
        });
        const errorRate = totalActivities > 0 ? (errors / totalActivities) * 100 : 0;
        const activities = await this.activityRepository.find({
            where: {
                organizationId: orgId,
                timestamp: (0, typeorm_1.Between)(startDate, endDate)
            },
            select: ['resourceType']
        });
        const resourcesByType = {};
        activities.forEach(activity => {
            if (activity.resourceType) {
                resourcesByType[activity.resourceType] = (resourcesByType[activity.resourceType] ?? 0) + 1;
            }
        });
        const relationships = await this.relationshipRepository.find({
            where: {
                organizationId: orgId,
                status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
            },
            select: ['type'],
        });
        relationships.forEach(rel => {
            const key = `relationship_${rel.type}`;
            resourcesByType[key] = (resourcesByType[key] ?? 0) + 1;
        });
        resourcesByType['total_relationships'] = relationships.length;
        return {
            storageUsed: 0,
            apiCallsThisPeriod: totalActivities,
            permissionChecks: failedAccess,
            averageResponseTime: 150,
            errorRate,
            resourcesByType
        };
    }
    async getDashboard(orgId, period = OrganizationAnalytics_1.AnalyticsPeriod.DAILY, refresh = false) {
        if (refresh) {
            const analytics = await this.generateAnalytics(orgId, period);
            return analytics.getDashboardSummary();
        }
        let analytics = await this.analyticsRepository.findOne({
            where: {
                organizationId: orgId,
                period,
                isSnapshot: true
            },
            order: { createdAt: 'DESC' }
        });
        if (!analytics || this.isOutdated(analytics.createdAt, period)) {
            analytics = await this.generateAnalytics(orgId, period);
        }
        return analytics.getDashboardSummary();
    }
    async exportAnalytics(orgId, period = OrganizationAnalytics_1.AnalyticsPeriod.WEEKLY, format = 'json') {
        const analytics = await this.generateAnalytics(orgId, period);
        if (format === 'csv') {
            return this.convertToCSV(analytics);
        }
        return analytics;
    }
    async getOrganizationAnalytics(orgId, period = OrganizationAnalytics_1.AnalyticsPeriod.DAILY) {
        const analytics = await this.generateAnalytics(orgId, period);
        return {
            totalMembers: analytics.memberStats.totalMembers,
            activeMembers: analytics.memberStats.activeMembers,
            growth: analytics.growthMetrics.growthRate,
            engagement: analytics.engagementMetrics.engagementScore
        };
    }
    async getAnalyticsByPeriod(orgId, period) {
        let analyticsPeriod;
        if (typeof period === 'string') {
            const periodUpper = period.toUpperCase();
            analyticsPeriod = OrganizationAnalytics_1.AnalyticsPeriod[periodUpper] || OrganizationAnalytics_1.AnalyticsPeriod.DAILY;
        }
        else {
            analyticsPeriod = period;
        }
        const analytics = await this.generateAnalytics(orgId, analyticsPeriod);
        return {
            period: analyticsPeriod.toLowerCase(),
            data: analytics
        };
    }
    async compareOrganizations(orgIds, period = OrganizationAnalytics_1.AnalyticsPeriod.MONTHLY) {
        const comparisons = await Promise.all(orgIds.map(async (orgId) => {
            try {
                const analytics = await this.generateAnalytics(orgId, period);
                return {
                    id: orgId,
                    metrics: {
                        members: analytics.memberStats.totalMembers,
                        activeMembers: analytics.memberStats.activeMembers,
                        growth: analytics.growthMetrics.growthRate,
                        engagement: analytics.engagementMetrics.engagementScore,
                        activities: analytics.activityMetrics.totalActivities,
                        retentionRate: analytics.growthMetrics.retentionRate
                    }
                };
            }
            catch (error) {
                logger_1.logger.warn('Failed to generate analytics for organization comparison', {
                    orgId,
                    error: error instanceof Error ? error.message : String(error)
                });
                return {
                    id: orgId,
                    metrics: {
                        members: 0,
                        activeMembers: 0,
                        growth: 0,
                        engagement: 0,
                        activities: 0,
                        retentionRate: 0
                    }
                };
            }
        }));
        return {
            organizations: comparisons
        };
    }
    calculateStartDate(endDate, period) {
        const start = new Date(endDate);
        switch (period) {
            case OrganizationAnalytics_1.AnalyticsPeriod.DAILY:
                start.setDate(start.getDate() - 1);
                break;
            case OrganizationAnalytics_1.AnalyticsPeriod.WEEKLY:
                start.setDate(start.getDate() - 7);
                break;
            case OrganizationAnalytics_1.AnalyticsPeriod.MONTHLY:
                start.setMonth(start.getMonth() - 1);
                break;
            case OrganizationAnalytics_1.AnalyticsPeriod.QUARTERLY:
                start.setMonth(start.getMonth() - 3);
                break;
            case OrganizationAnalytics_1.AnalyticsPeriod.YEARLY:
                start.setFullYear(start.getFullYear() - 1);
                break;
        }
        return start;
    }
    async getPreviousPeriodAnalytics(orgId, period, currentStart) {
        const previousEnd = new Date(currentStart);
        const previousStart = this.calculateStartDate(previousEnd, period);
        return this.analyticsRepository.findOne({
            where: {
                organizationId: orgId,
                period,
                periodStart: previousStart,
                isSnapshot: true
            }
        });
    }
    calculateActivityTrend(activities, _startDate, _endDate) {
        const dayMap = new Map();
        activities.forEach(activity => {
            const date = new Date(activity.timestamp).toISOString().split('T')[0];
            dayMap.set(date, (dayMap.get(date) ?? 0) + 1);
        });
        return Array.from(dayMap.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
    async calculateMemberGrowthTrend(orgId, startDate, endDate) {
        const activities = await this.activityRepository.find({
            where: {
                organizationId: orgId,
                action: (0, typeorm_1.In)([OrganizationActivity_1.OrgActivityAction.MEMBER_ADDED, OrganizationActivity_1.OrgActivityAction.MEMBER_REMOVED]),
                timestamp: (0, typeorm_1.Between)(startDate, endDate)
            },
            order: { timestamp: 'ASC' }
        });
        const org = await this.orgRepository.findOne({ where: { id: orgId } });
        let currentCount = org?.totalMembers ?? 0;
        const growth = [];
        const dayMap = new Map();
        activities.forEach(activity => {
            const date = new Date(activity.timestamp).toISOString().split('T')[0];
            const change = activity.action === OrganizationActivity_1.OrgActivityAction.MEMBER_ADDED ? -1 : 1;
            dayMap.set(date, (dayMap.get(date) ?? 0) + change);
        });
        const dates = Array.from(dayMap.keys()).sort((a, b) => b.localeCompare(a));
        dates.forEach(date => {
            growth.unshift({ date, count: currentCount });
            currentCount += dayMap.get(date) ?? 0;
        });
        return growth;
    }
    async getAllDescendants(orgId) {
        return this.orgRepository
            .createQueryBuilder('org')
            .where('org.path LIKE :path', { path: `%${orgId}%` })
            .andWhere('org.id != :orgId', { orgId })
            .getMany();
    }
    async getDaysSinceLastActivity(orgId) {
        const lastActivity = await this.activityRepository.findOne({
            where: { organizationId: orgId },
            order: { timestamp: 'DESC' }
        });
        if (!lastActivity) {
            return 999;
        }
        const daysDiff = Math.floor((Date.now() - lastActivity.timestamp.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff;
    }
    async getLastActivityDate(orgId) {
        const lastActivity = await this.activityRepository.findOne({
            where: { organizationId: orgId },
            order: { timestamp: 'DESC' }
        });
        return lastActivity?.timestamp || null;
    }
    isOutdated(createdAt, period) {
        const now = Date.now();
        const created = createdAt.getTime();
        const hoursDiff = (now - created) / (1000 * 60 * 60);
        switch (period) {
            case OrganizationAnalytics_1.AnalyticsPeriod.DAILY:
                return hoursDiff > 1;
            case OrganizationAnalytics_1.AnalyticsPeriod.WEEKLY:
                return hoursDiff > 24;
            case OrganizationAnalytics_1.AnalyticsPeriod.MONTHLY:
                return hoursDiff > 24 * 7;
            default:
                return hoursDiff > 24;
        }
    }
    convertToCSV(analytics) {
        const summary = analytics.getDashboardSummary();
        const rows = [];
        rows.push('Metric,Value');
        Object.entries(summary).forEach(([key, value]) => {
            if (typeof value !== 'object') {
                rows.push(`${key},${value}`);
            }
        });
        return rows.join('\n');
    }
}
exports.OrganizationAnalyticsService = OrganizationAnalyticsService;
//# sourceMappingURL=OrganizationAnalyticsService.js.map