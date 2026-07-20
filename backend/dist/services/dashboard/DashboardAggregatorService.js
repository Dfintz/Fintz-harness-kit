"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardAggregatorService = void 0;
const database_1 = require("../../config/database");
const Activity_1 = require("../../models/Activity");
const FleetInventory_1 = require("../../models/FleetInventory");
const MiningOperation_1 = require("../../models/MiningOperation");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const TradingRoute_1 = require("../../models/TradingRoute");
const UserShip_1 = require("../../models/UserShip");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const roleUtils_1 = require("../../utils/roleUtils");
const ActivityService_1 = require("../activity/ActivityService");
const SCStatsOrgAnalyticsService_1 = require("../analytics/SCStatsOrgAnalyticsService");
const BountyService_1 = require("../bounty/BountyService");
const NotificationService_1 = require("../communication/notifications/NotificationService");
const FleetService_1 = require("../fleet/FleetService");
const AllianceService_1 = require("../organization/AllianceService");
const MemberActivityService_1 = require("../organization/MemberActivityService");
const OnlinePresenceService_1 = require("../organization/OnlinePresenceService");
const OrgTierService_1 = require("../organization/OrgTierService");
const ReputationService_1 = require("../social/ReputationService");
const TeamService_1 = require("../team/TeamService");
class DashboardAggregatorService {
    static instance;
    fleetService = new FleetService_1.FleetService();
    activityService = new ActivityService_1.ActivityService();
    teamService = new TeamService_1.TeamService();
    notificationService = new NotificationService_1.NotificationService();
    memberActivityService = new MemberActivityService_1.MemberActivityService();
    scStatsService = new SCStatsOrgAnalyticsService_1.SCStatsOrgAnalyticsService();
    allianceService = new AllianceService_1.AllianceService();
    reputationService = new ReputationService_1.ReputationService();
    bountyService = new BountyService_1.BountyService();
    onlinePresenceService = new OnlinePresenceService_1.OnlinePresenceService();
    static getInstance() {
        if (!DashboardAggregatorService.instance) {
            DashboardAggregatorService.instance = new DashboardAggregatorService();
        }
        return DashboardAggregatorService.instance;
    }
    async getOrgSummary(userId, orgId, membershipRole) {
        const cacheKey = `org:${orgId}:dashboard:summary`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [fleetCount, activityCount, teamCount, notifications, unreadCount, totalMembers, activeMembers, scStats, orgShipCount, totalMemberShips, personalShipCount, upcomingActivities, membersByRole, orgEntity, tradingStats, inventoryStats, miningActiveCount, missionCount, allianceStats, bountyStats, reputationStats, onlineMembers,] = await Promise.all([
            this.fleetService.getFleetCount(orgId),
            this.activityService.count(orgId),
            this.teamService.count(orgId),
            this.notificationService.listForUser(userId, { page: 1, pageSize: 5 }),
            this.notificationService.getUnreadCount(userId),
            database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership).count({
                where: { organizationId: orgId, isActive: true },
            }),
            this.memberActivityService.getActiveMemberCount(orgId),
            this.safeSCStats(orgId),
            this.countMemberShipsSharedWithOrg(orgId),
            this.countAllMemberShips(orgId),
            this.countPersonalShips(userId),
            this.activityService
                .getUpcomingActivities({ organizationId: orgId, limit: 100 })
                .then(activities => activities.length)
                .catch(() => 0),
            this.safeMembersByRole(orgId),
            database_1.AppDataSource.getRepository(Organization_1.Organization).findOne({
                where: { id: orgId },
                select: ['id', 'name', 'rsiVerified', 'totalMembers'],
            }),
            this.safeTradingStats(orgId),
            this.safeInventoryStats(orgId),
            this.safeMiningActiveCount(orgId),
            this.activityService.count(orgId, { activityType: Activity_1.ActivityType.MISSION }).catch(() => 0),
            this.safeAllianceStats(orgId),
            this.safeBountyStats(orgId),
            this.safeReputationStats(userId, orgId),
            this.onlinePresenceService.getOnlineMemberCount(orgId).catch(() => 0),
        ]);
        const scale = OrgTierService_1.orgTierService.getScalingProfile(orgEntity?.totalMembers ?? totalMembers);
        const result = {
            fleets: { total: fleetCount, totalShips: orgShipCount, totalMemberShips, personalShipCount },
            activities: { total: activityCount, upcoming: upcomingActivities },
            teams: { total: teamCount },
            notifications: {
                recent: notifications.data,
                total: notifications.total,
                unreadCount,
            },
            organization: {
                id: orgId,
                name: orgEntity?.name ?? 'Unknown',
                role: (0, roleUtils_1.getRoleName)(membershipRole) || 'member',
                rsiVerified: orgEntity?.rsiVerified ?? false,
                scale,
                members: {
                    total: totalMembers,
                    active: activeMembers,
                    online: onlineMembers,
                    byRole: membersByRole,
                },
            },
            trading: tradingStats,
            inventory: inventoryStats,
            mining: { activeOperations: miningActiveCount },
            missions: { total: missionCount },
            alliances: allianceStats,
            bounties: bountyStats,
            reputation: reputationStats,
            scStats,
            timestamp: new Date().toISOString(),
        };
        await redis_1.cache.set(cacheKey, result, scale.dashboardCacheTtlSeconds);
        return result;
    }
    async getSoloSummary(userId) {
        const [notifications, unreadCount] = await Promise.all([
            this.notificationService.listForUser(userId, { page: 1, pageSize: 5 }),
            this.notificationService.getUnreadCount(userId),
        ]);
        return {
            fleets: null,
            activities: null,
            teams: null,
            notifications: {
                recent: notifications.data,
                total: notifications.total,
                unreadCount,
            },
            organization: null,
            trading: null,
            inventory: null,
            mining: null,
            missions: null,
            alliances: null,
            bounties: null,
            reputation: null,
            scStats: null,
            timestamp: new Date().toISOString(),
        };
    }
    async safeSCStats(orgId) {
        try {
            const stats = await this.scStatsService.getOrgAnalytics(orgId);
            if (!stats || stats.memberCount === 0) {
                return null;
            }
            return {
                verificationRate: stats.verificationRate,
                averageKD: stats.averageKD,
                averageTotalHours: stats.averageTotalHours,
                averageMissionsCompleted: stats.averageMissionsCompleted,
                memberCount: stats.memberCount,
                verifiedCount: stats.verifiedCount,
            };
        }
        catch {
            return null;
        }
    }
    async safeMembersByRole(orgId) {
        try {
            const rows = await database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership)
                .createQueryBuilder('m')
                .select('m.role', 'role')
                .addSelect('COUNT(*)::int', 'count')
                .where('m.organizationId = :orgId', { orgId })
                .andWhere('m.isActive = true')
                .groupBy('m.role')
                .getRawMany();
            const result = {};
            for (const row of rows) {
                result[row.role] = Number(row.count);
            }
            return result;
        }
        catch {
            return {};
        }
    }
    async safeTradingStats(orgId) {
        try {
            const result = await database_1.AppDataSource.getRepository(TradingRoute_1.TradingRoute)
                .createQueryBuilder('tr')
                .select('COUNT(tr.id)::int', 'activeRoutes')
                .addSelect('COALESCE(SUM(tr.estimatedProfit)::numeric, 0)', 'totalEstimatedProfit')
                .where('tr.organizationId = :orgId', { orgId })
                .andWhere('tr.status = :status', { status: TradingRoute_1.RouteStatus.ACTIVE })
                .getRawOne();
            return (result && {
                activeRoutes: result.activeRoutes || 0,
                totalEstimatedProfit: Number.parseFloat(result.totalEstimatedProfit || '0'),
            });
        }
        catch (error) {
            logger_1.logger.error('DashboardAggregator: safeTradingStats failed', { orgId, error });
            return null;
        }
    }
    async safeInventoryStats(orgId) {
        try {
            const result = await database_1.AppDataSource.getRepository(FleetInventory_1.FleetInventory)
                .createQueryBuilder('fi')
                .select('COUNT(fi.id)::int', 'totalItems')
                .addSelect('COALESCE(SUM(fi.totalValue)::numeric, 0)', 'totalValue')
                .where('fi.organizationId = :orgId', { orgId })
                .getRawOne();
            return (result && {
                totalItems: result.totalItems || 0,
                totalValue: Number.parseFloat(result.totalValue || '0'),
            });
        }
        catch (error) {
            logger_1.logger.error('DashboardAggregator: safeInventoryStats failed', { orgId, error });
            return null;
        }
    }
    async safeMiningActiveCount(orgId) {
        try {
            return await database_1.AppDataSource.getRepository(MiningOperation_1.MiningOperation)
                .createQueryBuilder('mo')
                .select('COUNT(mo.id)::int', 'count')
                .innerJoin(OrganizationMembership_1.OrganizationMembership, 'om', 'om.userId = mo.coordinatorId AND om.organizationId = :orgId AND om.isActive = true')
                .where('mo.status IN (:...statuses)', {
                statuses: [MiningOperation_1.MiningOperationStatus.PLANNED, MiningOperation_1.MiningOperationStatus.IN_PROGRESS],
            })
                .setParameter('orgId', orgId)
                .getRawOne()
                .then(result => result?.count || 0);
        }
        catch (error) {
            logger_1.logger.error('DashboardAggregator: safeMiningActiveCount failed', { orgId, error });
            return 0;
        }
    }
    async safeAllianceStats(orgId) {
        try {
            const stats = await this.allianceService.getAllianceStatistics(orgId);
            return {
                total: stats.total,
                mutual: stats.mutual,
                averageHealth: stats.averageHealth,
            };
        }
        catch {
            return null;
        }
    }
    async safeBountyStats(orgId) {
        try {
            const stats = await this.bountyService.getStatistics(orgId);
            return {
                totalBounties: stats.totalBounties,
                activeBounties: stats.activeBounties,
                completedBounties: stats.completedBounties,
            };
        }
        catch {
            return null;
        }
    }
    async safeReputationStats(userId, orgId) {
        try {
            const rep = await this.reputationService.getUnifiedReputation(userId, orgId);
            return {
                combinedScore: rep.combinedScore,
                reliability: rep.reliability,
            };
        }
        catch {
            return null;
        }
    }
    async countPersonalShips(userId) {
        try {
            return await database_1.AppDataSource.getRepository(UserShip_1.UserShip)
                .createQueryBuilder('ship')
                .where('ship.isActive = :isActive', { isActive: true })
                .andWhere('ship.userId = :userId', { userId })
                .andWhere('ship.status IN (:...statuses)', {
                statuses: [
                    UserShip_1.ShipOwnershipStatus.OWNED,
                    UserShip_1.ShipOwnershipStatus.PLEDGED,
                    UserShip_1.ShipOwnershipStatus.GIFTED,
                ],
            })
                .getCount();
        }
        catch (err) {
            logger_1.logger.warn('Failed to count personal ships', {
                userId,
                error: err instanceof Error ? err.message : String(err),
            });
            return 0;
        }
    }
    async countAllMemberShips(orgId) {
        try {
            return await database_1.AppDataSource.getRepository(UserShip_1.UserShip)
                .createQueryBuilder('ship')
                .innerJoin(OrganizationMembership_1.OrganizationMembership, 'm', 'm."userId" = ship."userId" AND m."organizationId" = :orgId AND m."isActive" = true', { orgId })
                .where('ship.isActive = :isActive', { isActive: true })
                .andWhere('ship.status IN (:...statuses)', {
                statuses: [
                    UserShip_1.ShipOwnershipStatus.OWNED,
                    UserShip_1.ShipOwnershipStatus.PLEDGED,
                    UserShip_1.ShipOwnershipStatus.GIFTED,
                ],
            })
                .getCount();
        }
        catch (err) {
            logger_1.logger.warn('Failed to count all member ships', {
                orgId,
                error: err instanceof Error ? err.message : String(err),
            });
            return 0;
        }
    }
    async countMemberShipsSharedWithOrg(orgId) {
        try {
            return await database_1.AppDataSource.getRepository(UserShip_1.UserShip)
                .createQueryBuilder('ship')
                .innerJoin(OrganizationMembership_1.OrganizationMembership, 'm', 'm."userId" = ship."userId" AND m."organizationId" = :orgId AND m."isActive" = true', { orgId })
                .where('ship.isActive = :isActive', { isActive: true })
                .andWhere('ship.sharingLevel IN (:...sharingLevels)', {
                sharingLevels: [
                    UserShip_1.ShipSharingLevel.ORGANIZATION,
                    UserShip_1.ShipSharingLevel.ALLIANCE,
                    UserShip_1.ShipSharingLevel.PUBLIC,
                ],
            })
                .andWhere('ship.status IN (:...statuses)', {
                statuses: [
                    UserShip_1.ShipOwnershipStatus.OWNED,
                    UserShip_1.ShipOwnershipStatus.PLEDGED,
                    UserShip_1.ShipOwnershipStatus.GIFTED,
                ],
            })
                .getCount();
        }
        catch (err) {
            logger_1.logger.warn('Failed to count member ships shared with org', {
                orgId,
                error: err instanceof Error ? err.message : String(err),
            });
            return 0;
        }
    }
}
exports.DashboardAggregatorService = DashboardAggregatorService;
//# sourceMappingURL=DashboardAggregatorService.js.map