import { Between, In } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Organization } from '../../models/Organization';
import { ActivitySeverity, OrgActivityAction, OrganizationActivity } from '../../models/OrganizationActivity';
import { ActivityMetrics, AnalyticsPeriod, EngagementMetrics, GrowthMetrics, HierarchyHealth, MemberStats, OrganizationAnalytics, ResourceUsage } from '../../models/OrganizationAnalytics';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { OrganizationPermission } from '../../models/OrganizationPermission';
import { OrganizationRelationship, RelationshipStatus } from '../../models/OrganizationRelationship';
import { logger } from '../../utils/logger';

/**
 * Service for organization analytics
 * Generates and manages analytics data for organizations
 */
export class OrganizationAnalyticsService {
    private readonly analyticsRepository = AppDataSource.getRepository(OrganizationAnalytics);
    private readonly orgRepository = AppDataSource.getRepository(Organization);
    private readonly activityRepository = AppDataSource.getRepository(OrganizationActivity);
    private readonly permissionRepository = AppDataSource.getRepository(OrganizationPermission);
    private readonly membershipRepository = AppDataSource.getRepository(OrganizationMembership);
    private readonly relationshipRepository = AppDataSource.getRepository(OrganizationRelationship);

    /**
     * Generate analytics for an organization
     * @param orgId Organization ID
     * @param period Analytics period
     * @param startDate Period start date
     * @param endDate Period end date
     * @returns Generated analytics
     */
    public async generateAnalytics(
        orgId: string,
        period: AnalyticsPeriod = AnalyticsPeriod.DAILY,
        startDate?: Date,
        endDate?: Date
    ): Promise<OrganizationAnalytics> {
        // Set default dates if not provided
        endDate ??= new Date();
        startDate ??= this.calculateStartDate(endDate, period);

        const org = await this.orgRepository.findOne({ 
            where: { id: orgId },
            relations: ['children', 'parentOrg']
        });

        if (!org) {
            throw new Error('Organization not found');
        }

        // Generate all metrics
        const memberStats = await this.generateMemberStats(orgId, startDate, endDate);
        const activityMetrics = await this.generateActivityMetrics(orgId, startDate, endDate);
        const engagementMetrics = await this.generateEngagementMetrics(orgId, startDate, endDate, memberStats, activityMetrics);
        const growthMetrics = await this.generateGrowthMetrics(orgId, startDate, endDate, period);
        const hierarchyHealth = await this.generateHierarchyHealth(orgId);
        const resourceUsage = await this.generateResourceUsage(orgId, startDate, endDate);

        // Create analytics snapshot
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

        // Calculate health score
        analytics.calculateHealthScore();

        // Generate alerts and recommendations
        analytics.generateAlerts();
        analytics.generateRecommendations();

        // Compare with previous period
        const previousAnalytics = await this.getPreviousPeriodAnalytics(orgId, period, startDate);
        analytics.compareWithPrevious(previousAnalytics);

        // Save analytics snapshot
        return this.analyticsRepository.save(analytics);
    }

    /**
     * Generate member statistics
     */
    private async generateMemberStats(
        orgId: string,
        startDate: Date,
        endDate: Date
    ): Promise<MemberStats> {
        // Get organization with members
        const org = await this.orgRepository.findOne({ where: { id: orgId } });
        if (!org) {throw new Error('Organization not found');}

        // Get member additions in period
        const memberAdditions = await this.activityRepository.count({
            where: {
                organizationId: orgId,
                action: OrgActivityAction.MEMBER_ADDED,
                timestamp: Between(startDate, endDate)
            }
        });

        // Get member removals in period
        const memberRemovals = await this.activityRepository.count({
            where: {
                organizationId: orgId,
                action: OrgActivityAction.MEMBER_REMOVED,
                timestamp: Between(startDate, endDate)
            }
        });

        // Calculate member growth rate
        const totalMembers = org.totalMembers ?? 0;
        const previousTotal = totalMembers - memberAdditions + memberRemovals;
        const memberGrowthRate = previousTotal > 0 
            ? ((totalMembers - previousTotal) / previousTotal) * 100 
            : 0;

        // Get role distribution from activities
        const roleChanges = await this.activityRepository.find({
            where: {
                organizationId: orgId,
                action: OrgActivityAction.MEMBER_ROLE_CHANGED
            },
            order: { timestamp: 'DESC' },
            take: 100
        });

        const membersByRole: Record<string, number> = {};
        roleChanges.forEach((activity: OrganizationActivity) => {
            if (activity.metadata?.newRole) {
                const role = activity.metadata.newRole as string;
                membersByRole[role] = (membersByRole[role] ?? 0) + 1;
            }
        });

        // Count distinct active members (users who performed any action in the period)
        const activeUserIds: { count: string } | undefined = await this.activityRepository
            .createQueryBuilder('activity')
            .select('COUNT(DISTINCT activity.actorId)', 'count')
            .where('activity.organizationId = :orgId', { orgId })
            .andWhere('activity.actorId IS NOT NULL')
            .andWhere('activity.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
            .getRawOne();
        const activeMembers = Math.min(
            Number.parseInt(activeUserIds?.count ?? '0', 10),
            totalMembers
        );
        const inactiveMembers = Math.max(totalMembers - activeMembers, 0);

        // Calculate average tenure from membership join dates
        const tenureResult: { avgDays: string } | undefined = await this.membershipRepository
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

    /**
     * Generate activity metrics
     */
    private async generateActivityMetrics(
        orgId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ActivityMetrics> {
        // Get all activities in period
        const activities = await this.activityRepository.find({
            where: {
                organizationId: orgId,
                timestamp: Between(startDate, endDate)
            }
        });

        const totalActivities = activities.length;

        // Group by type
        const activitiesByType: Record<string, number> = {};
        activities.forEach(activity => {
            activitiesByType[activity.action] = (activitiesByType[activity.action] ?? 0) + 1;
        });

        // Group by severity
        const activitiesBySeverity: Record<string, number> = {};
        activities.forEach(activity => {
            activitiesBySeverity[activity.severity] = (activitiesBySeverity[activity.severity] ?? 0) + 1;
        });

        // Calculate activity trend (daily)
        const activityTrend = this.calculateActivityTrend(activities, startDate, endDate);

        // Find most active users
        const userActivityMap = new Map<string, number>();
        activities.forEach(activity => {
            if (activity.actorId) {
                userActivityMap.set(
                    activity.actorId,
                    (userActivityMap.get(activity.actorId) ?? 0) + 1
                );
            }
        });

        const mostActiveUsers = Array.from(userActivityMap.entries())
            .map(([userId, count]) => ({ userId, activityCount: count }))
            .sort((a, b) => b.activityCount - a.activityCount)
            .slice(0, 10);

        // Calculate peak activity times
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

    /**
     * Generate engagement metrics
     */
    private async generateEngagementMetrics(
        orgId: string,
        startDate: Date,
        endDate: Date,
        memberStats: MemberStats,
        activityMetrics: ActivityMetrics
    ): Promise<EngagementMetrics> {
        const totalMembers = memberStats.totalMembers;
        const activeMembers = memberStats.activeMembers;

        // Calculate engagement score (0-100)
        let engagementScore = 0;
        
        // Factor 1: Active users percentage (40%)
        const activePercentage = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0;
        engagementScore += (activePercentage * 0.4);

        // Factor 2: Activities per user (30%)
        const activitiesPerUser = totalMembers > 0 
            ? activityMetrics.totalActivities / totalMembers 
            : 0;
        const activityScore = Math.min((activitiesPerUser / 10) * 30, 30);
        engagementScore += activityScore;

        // Factor 3: Recent activity (30%)
        const daysSinceLastActivity = await this.getDaysSinceLastActivity(orgId);
        const recencyScore = Math.max(30 - (daysSinceLastActivity * 2), 0);
        engagementScore += recencyScore;

        // Determine engagement trend
        const avgActivitiesPerDay = activityMetrics.averageActivitiesPerDay;
        let engagementTrend: 'INCREASING' | 'STABLE' | 'DECREASING' = 'STABLE';
        
        if (avgActivitiesPerDay > 20) {engagementTrend = 'INCREASING';}
        else if (avgActivitiesPerDay < 5) {engagementTrend = 'DECREASING';}

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

    /**
     * Generate growth metrics
     */
    private async generateGrowthMetrics(
        orgId: string,
        startDate: Date,
        endDate: Date,
        _period: AnalyticsPeriod
    ): Promise<GrowthMetrics> {
        // Get member growth over time
        const memberGrowth = await this.calculateMemberGrowthTrend(orgId, startDate, endDate);

        // Calculate growth rate
        const firstCount = memberGrowth[0]?.count ?? 0;
        const lastCount = memberGrowth.at(-1)?.count ?? 0;
        const growthRate = firstCount > 0 
            ? ((lastCount - firstCount) / firstCount) * 100 
            : 0;

        // Get removals for churn calculation
        const churnData = await this.activityRepository.count({
            where: {
                organizationId: orgId,
                action: OrgActivityAction.MEMBER_REMOVED,
                timestamp: Between(startDate, endDate)
            }
        });

        const avgMembers = (firstCount + lastCount) / 2;
        const churnRate = avgMembers > 0 ? (churnData / avgMembers) * 100 : 0;
        const retentionRate = 100 - churnRate;

        // Get sub-org growth
        const subOrgCreations = await this.activityRepository.count({
            where: {
                organizationId: orgId,
                action: OrgActivityAction.SUB_ORG_CREATED,
                timestamp: Between(startDate, endDate)
            }
        });

        return {
            memberGrowth,
            growthRate,
            projectedGrowth: growthRate * 1.1, // Simple projection
            churnRate,
            retentionRate,
            netGrowth: lastCount - firstCount,
            subOrgGrowth: subOrgCreations
        };
    }

    /**
     * Generate hierarchy health metrics
     */
    private async generateHierarchyHealth(orgId: string): Promise<HierarchyHealth> {
        const org = await this.orgRepository.findOne({
            where: { id: orgId },
            relations: ['children']
        });

        if (!org) {throw new Error('Organization not found');}

        // Get all descendants
        const descendants = await this.getAllDescendants(orgId);
        
        // Calculate depth
        const depth = Math.max(...descendants.map(d => d.level), org.level);

        // Calculate balance (0-100)
        const childCounts = descendants.map(d => d.childCount ?? 0);
        const avgChildren = childCounts.length > 0 
            ? childCounts.reduce((a, b) => a + b, 0) / childCounts.length 
            : 0;
        const variance = childCounts.length > 0
            ? childCounts.reduce((sum, count) => sum + Math.pow(count - avgChildren, 2), 0) / childCounts.length
            : 0;
        const balance = Math.max(0, 100 - Math.sqrt(variance) * 10);

        // Count leaf and middle nodes
        const leafNodeCount = descendants.filter(d => (d.childCount ?? 0) === 0).length;
        const middleNodeCount = descendants.length - leafNodeCount;

        // Find deepest path
        const deepestOrg = descendants.reduce((prev, current) => 
            current.level > prev.level ? current : prev, org);
        const deepestPath = deepestOrg.path ? deepestOrg.path.split('.') : [org.id];

        // Find widest level
        const levelCounts = new Map<number, number>();
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

    /**
     * Generate resource usage metrics
     */
    private async generateResourceUsage(
        orgId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ResourceUsage> {
        // Get permission checks (from activities)
        const failedAccess = await this.activityRepository.count({
            where: {
                organizationId: orgId,
                action: OrgActivityAction.ACCESS_DENIED,
                timestamp: Between(startDate, endDate)
            }
        });

        // Get error activities
        const errors = await this.activityRepository.count({
            where: {
                organizationId: orgId,
                severity: ActivitySeverity.ERROR,
                timestamp: Between(startDate, endDate)
            }
        });

        const totalActivities = await this.activityRepository.count({
            where: {
                organizationId: orgId,
                timestamp: Between(startDate, endDate)
            }
        });

        const errorRate = totalActivities > 0 ? (errors / totalActivities) * 100 : 0;

        // Get resources by type from activities
        const activities = await this.activityRepository.find({
            where: {
                organizationId: orgId,
                timestamp: Between(startDate, endDate)
            },
            select: ['resourceType']
        });

        const resourcesByType: Record<string, number> = {};
        activities.forEach(activity => {
            if (activity.resourceType) {
                resourcesByType[activity.resourceType] = (resourcesByType[activity.resourceType] ?? 0) + 1;
            }
        });

        // Count active relationships by type (alliance/diplomacy tracking)
        const relationships = await this.relationshipRepository.find({
            where: {
                organizationId: orgId,
                status: RelationshipStatus.ACTIVE,
            },
            select: ['type'],
        });
        relationships.forEach(rel => {
            const key = `relationship_${rel.type}`;
            resourcesByType[key] = (resourcesByType[key] ?? 0) + 1;
        });
        resourcesByType['total_relationships'] = relationships.length;

        return {
            storageUsed: 0, // Would need actual storage calculation
            apiCallsThisPeriod: totalActivities,
            permissionChecks: failedAccess,
            averageResponseTime: 150, // Would need actual tracking
            errorRate,
            resourcesByType
        };
    }

    /**
     * Get analytics dashboard for organization
     */
    public async getDashboard(
        orgId: string,
        period: AnalyticsPeriod = AnalyticsPeriod.DAILY,
        refresh: boolean = false
    ): Promise<Record<string, unknown>> {
        // If refresh requested, generate new analytics
        if (refresh) {
            const analytics = await this.generateAnalytics(orgId, period);
            return analytics.getDashboardSummary();
        }

        // Try to get latest snapshot
        let analytics = await this.analyticsRepository.findOne({
            where: {
                organizationId: orgId,
                period,
                isSnapshot: true
            },
            order: { createdAt: 'DESC' }
        });

        // If no recent snapshot or outdated, generate new one
        if (!analytics || this.isOutdated(analytics.createdAt, period)) {
            analytics = await this.generateAnalytics(orgId, period);
        }

        return analytics.getDashboardSummary();
    }

    /**
     * Export analytics data
     */
    public async exportAnalytics(
        orgId: string,
        period: AnalyticsPeriod = AnalyticsPeriod.WEEKLY,
        format: 'json' | 'csv' = 'json'
    ): Promise<string | object> {
        const analytics = await this.generateAnalytics(orgId, period);

        if (format === 'csv') {
            return this.convertToCSV(analytics);
        }

        return analytics;
    }

    /**
     * Get organization analytics summary
     * @param orgId Organization ID
     * @param period Analytics period (optional)
     * @returns Analytics summary with key metrics
     */
    public async getOrganizationAnalytics(
        orgId: string,
        period: AnalyticsPeriod = AnalyticsPeriod.DAILY
    ): Promise<{
        totalMembers: number;
        activeMembers: number;
        growth: number;
        engagement: number;
    }> {
        const analytics = await this.generateAnalytics(orgId, period);
        
        return {
            totalMembers: analytics.memberStats.totalMembers,
            activeMembers: analytics.memberStats.activeMembers,
            growth: analytics.growthMetrics.growthRate,
            engagement: analytics.engagementMetrics.engagementScore
        };
    }

    /**
     * Get analytics for a specific period
     * @param orgId Organization ID
     * @param period Analytics period
     * @returns Analytics data for the specified period
     */
    public async getAnalyticsByPeriod(
        orgId: string,
        period: AnalyticsPeriod | string
    ): Promise<{
        period: string;
        data: OrganizationAnalytics;
    }> {
        // Normalize period string to enum
        let analyticsPeriod: AnalyticsPeriod;
        if (typeof period === 'string') {
            const periodUpper = period.toUpperCase();
            analyticsPeriod = AnalyticsPeriod[periodUpper as keyof typeof AnalyticsPeriod] || AnalyticsPeriod.DAILY;
        } else {
            analyticsPeriod = period;
        }

        const analytics = await this.generateAnalytics(orgId, analyticsPeriod);
        
        return {
            period: (analyticsPeriod as string).toLowerCase(),
            data: analytics
        };
    }

    /**
     * Compare multiple organizations
     * @param orgIds Array of organization IDs to compare
     * @param period Analytics period for comparison
     * @returns Comparison data for all organizations
     */
    public async compareOrganizations(
        orgIds: string[],
        period: AnalyticsPeriod = AnalyticsPeriod.MONTHLY
    ): Promise<{
        organizations: Array<{
            id: string;
            metrics: {
                members: number;
                activeMembers: number;
                growth: number;
                engagement: number;
                activities: number;
                retentionRate: number;
            };
        }>;
    }> {
        const comparisons = await Promise.all(
            orgIds.map(async (orgId) => {
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
                } catch (error: unknown) {
                    // Log the error for debugging purposes
                    logger.warn('Failed to generate analytics for organization comparison', {
                        orgId,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    
                    // Return default metrics if organization not found or error occurs
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
            })
        );

        return {
            organizations: comparisons
        };
    }

    // ==================== Helper Methods ====================

    private calculateStartDate(endDate: Date, period: AnalyticsPeriod): Date {
        const start = new Date(endDate);
        
        switch (period) {
            case AnalyticsPeriod.DAILY:
                start.setDate(start.getDate() - 1);
                break;
            case AnalyticsPeriod.WEEKLY:
                start.setDate(start.getDate() - 7);
                break;
            case AnalyticsPeriod.MONTHLY:
                start.setMonth(start.getMonth() - 1);
                break;
            case AnalyticsPeriod.QUARTERLY:
                start.setMonth(start.getMonth() - 3);
                break;
            case AnalyticsPeriod.YEARLY:
                start.setFullYear(start.getFullYear() - 1);
                break;
        }

        return start;
    }

    private async getPreviousPeriodAnalytics(
        orgId: string,
        period: AnalyticsPeriod,
        currentStart: Date
    ): Promise<OrganizationAnalytics | null> {
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

    private calculateActivityTrend(
        activities: OrganizationActivity[],
        _startDate: Date,
        _endDate: Date
    ): Array<{ date: string; count: number }> {
        const dayMap = new Map<string, number>();
        
        activities.forEach(activity => {
            const date = new Date(activity.timestamp).toISOString().split('T')[0];
            dayMap.set(date, (dayMap.get(date) ?? 0) + 1);
        });

        return Array.from(dayMap.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    private async calculateMemberGrowthTrend(
        orgId: string,
        startDate: Date,
        endDate: Date
    ): Promise<Array<{ date: string; count: number }>> {
        const activities = await this.activityRepository.find({
            where: {
                organizationId: orgId,
                action: In([OrgActivityAction.MEMBER_ADDED, OrgActivityAction.MEMBER_REMOVED]),
                timestamp: Between(startDate, endDate)
            },
            order: { timestamp: 'ASC' }
        });

        const org = await this.orgRepository.findOne({ where: { id: orgId } });
        let currentCount = org?.totalMembers ?? 0;

        // Work backwards from current count
        const growth: Array<{ date: string; count: number }> = [];
        const dayMap = new Map<string, number>();

        // Count net changes per day
        activities.forEach(activity => {
            const date = new Date(activity.timestamp).toISOString().split('T')[0];
            const change = activity.action === OrgActivityAction.MEMBER_ADDED ? -1 : 1; // Reverse because we're going backward
            dayMap.set(date, (dayMap.get(date) ?? 0) + change);
        });

        // Generate trend
        const dates = Array.from(dayMap.keys()).sort((a, b) => b.localeCompare(a));
        dates.forEach(date => {
            growth.unshift({ date, count: currentCount });
            currentCount += dayMap.get(date) ?? 0;
        });

        return growth;
    }

    private async getAllDescendants(orgId: string): Promise<Organization[]> {
        return this.orgRepository
            .createQueryBuilder('org')
            .where('org.path LIKE :path', { path: `%${orgId}%` })
            .andWhere('org.id != :orgId', { orgId })
            .getMany();
    }

    private async getDaysSinceLastActivity(orgId: string): Promise<number> {
        const lastActivity = await this.activityRepository.findOne({
            where: { organizationId: orgId },
            order: { timestamp: 'DESC' }
        });

        if (!lastActivity) {return 999;}

        const daysDiff = Math.floor(
            (Date.now() - lastActivity.timestamp.getTime()) / (1000 * 60 * 60 * 24)
        );

        return daysDiff;
    }

    private async getLastActivityDate(orgId: string): Promise<Date | null> {
        const lastActivity = await this.activityRepository.findOne({
            where: { organizationId: orgId },
            order: { timestamp: 'DESC' }
        });

        return lastActivity?.timestamp || null;
    }

    private isOutdated(createdAt: Date, period: AnalyticsPeriod): boolean {
        const now = Date.now();
        const created = createdAt.getTime();
        const hoursDiff = (now - created) / (1000 * 60 * 60);

        switch (period) {
            case AnalyticsPeriod.DAILY:
                return hoursDiff > 1; // Refresh every hour
            case AnalyticsPeriod.WEEKLY:
                return hoursDiff > 24; // Refresh daily
            case AnalyticsPeriod.MONTHLY:
                return hoursDiff > 24 * 7; // Refresh weekly
            default:
                return hoursDiff > 24;
        }
    }

    private convertToCSV(analytics: OrganizationAnalytics): string {
        const summary = analytics.getDashboardSummary();
        const rows: string[] = [];
        
        // Header
        rows.push('Metric,Value');
        
        // Add all summary fields
        Object.entries(summary).forEach(([key, value]) => {
            if (typeof value !== 'object') {
                rows.push(`${key},${value}`);
            }
        });

        return rows.join('\n');
    }
}

