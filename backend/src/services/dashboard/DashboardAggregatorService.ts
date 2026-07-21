/**
 * DashboardAggregatorService
 *
 * Pulls stats from existing services (fleet, activity, team, trading, etc.)
 * into a unified dashboard payload. Extracted from DashboardSummaryController
 * so the aggregation logic is reusable across controllers, jobs, and WebSocket
 * handlers.
 */
import { AppDataSource } from '../../config/database';
import { ActivityType } from '../../models/Activity';
import { FleetInventory } from '../../models/FleetInventory';
import { MiningOperation, MiningOperationStatus } from '../../models/MiningOperation';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import type { Role } from '../../models/Role';
import { RouteStatus, TradingRoute } from '../../models/TradingRoute';
import { ShipOwnershipStatus, ShipSharingLevel, UserShip } from '../../models/UserShip';
import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';
import { getRoleName } from '../../utils/roleUtils';
import { ActivityService } from '../activity/ActivityService';
import { SCStatsOrgAnalyticsService } from '../analytics/SCStatsOrgAnalyticsService';
import { BountyService } from '../bounty/BountyService';
import { NotificationService } from '../communication/notifications/NotificationService';
import { FleetService } from '../fleet/FleetService';
import { AllianceService } from '../organization/AllianceService';
import { MemberActivityService } from '../organization/MemberActivityService';
import { OnlinePresenceService } from '../organization/OnlinePresenceService';
import { orgTierService } from '../organization/OrgTierService';
import { ReputationService } from '../social/ReputationService';
import { TeamService } from '../team/TeamService';

// ──────────────────────────────────────────────────────────────────
// Public Types
// ──────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  fleets: {
    total: number;
    totalShips: number;
    totalMemberShips: number;
    personalShipCount: number;
  } | null;
  activities: { total: number; upcoming: number } | null;
  teams: { total: number } | null;
  notifications: {
    recent: unknown[];
    total: number;
    unreadCount: number;
  };
  organization: {
    id: string;
    name: string;
    role: string;
    rsiVerified: boolean;
    scale: {
      tier: string;
      memberCount: number;
      dashboardCacheTtlSeconds: number;
      recommendedPageSize: number;
    };
    members: {
      total: number;
      active: number;
      online: number;
      byRole: Record<string, number>;
    };
  } | null;
  trading: { activeRoutes: number; totalEstimatedProfit: number } | null;
  inventory: { totalItems: number; totalValue: number } | null;
  mining: { activeOperations: number } | null;
  missions: { total: number } | null;
  alliances: { total: number; mutual: number; averageHealth: number } | null;
  bounties: {
    totalBounties: number;
    activeBounties: number;
    completedBounties: number;
  } | null;
  reputation: { combinedScore: number; reliability: string } | null;
  scStats: {
    verificationRate: number;
    averageKD: number;
    averageTotalHours: number;
    averageMissionsCompleted: number;
    memberCount: number;
    verifiedCount: number;
  } | null;
  timestamp: string;
}

// ──────────────────────────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────────────────────────

export class DashboardAggregatorService {
  private static instance: DashboardAggregatorService;

  private readonly fleetService = new FleetService();
  private readonly activityService = new ActivityService();
  private readonly teamService = new TeamService();
  private readonly notificationService = new NotificationService();
  private readonly memberActivityService = new MemberActivityService();
  private readonly scStatsService = new SCStatsOrgAnalyticsService();
  private readonly allianceService = new AllianceService();
  private readonly reputationService = new ReputationService();
  private readonly bountyService = new BountyService();
  private readonly onlinePresenceService = new OnlinePresenceService();

  static getInstance(): DashboardAggregatorService {
    if (!DashboardAggregatorService.instance) {
      DashboardAggregatorService.instance = new DashboardAggregatorService();
    }
    return DashboardAggregatorService.instance;
  }

  /**
   * Build the full aggregated summary for an org user.
   */
  async getOrgSummary(
    userId: string,
    orgId: string,
    membershipRole?: Role | string | null
  ): Promise<DashboardSummary> {
    // Redis cache: 5 min TTL (Phase 5.1)
    const cacheKey = `org:${orgId}:dashboard:summary`;
    const cached = await cache.get<DashboardSummary>(cacheKey);
    if (cached) {
      return cached;
    }

    const [
      fleetCount,
      activityCount,
      teamCount,
      notifications,
      unreadCount,
      totalMembers,
      activeMembers,
      scStats,
      orgShipCount,
      totalMemberShips,
      personalShipCount,
      upcomingActivities,
      membersByRole,
      orgEntity,
      tradingStats,
      inventoryStats,
      miningActiveCount,
      missionCount,
      allianceStats,
      bountyStats,
      reputationStats,
      onlineMembers,
    ] = await Promise.all([
      this.fleetService.getFleetCount(orgId),
      this.activityService.count(orgId),
      this.teamService.count(orgId),
      this.notificationService.listForUser(userId, { page: 1, pageSize: 5 }),
      this.notificationService.getUnreadCount(userId),
      AppDataSource.getRepository(OrganizationMembership).count({
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
      AppDataSource.getRepository(Organization).findOne({
        where: { id: orgId },
        select: ['id', 'name', 'rsiVerified', 'totalMembers'],
      }),
      this.safeTradingStats(orgId),
      this.safeInventoryStats(orgId),
      this.safeMiningActiveCount(orgId),
      this.activityService.count(orgId, { activityType: ActivityType.MISSION }).catch(() => 0),
      this.safeAllianceStats(orgId),
      this.safeBountyStats(orgId),
      this.safeReputationStats(userId, orgId),
      this.onlinePresenceService.getOnlineMemberCount(orgId).catch(() => 0),
    ]);

    const scale = orgTierService.getScalingProfile(orgEntity?.totalMembers ?? totalMembers);

    const result: DashboardSummary = {
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
        role: getRoleName(membershipRole) || 'member',
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

    await cache.set(cacheKey, result, scale.dashboardCacheTtlSeconds);

    return result;
  }

  /**
   * Build a minimal summary for a solo user (no org membership).
   */
  async getSoloSummary(userId: string): Promise<DashboardSummary> {
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

  // ─── Safe helpers (non-critical — return null/0 on failure) ────

  private async safeSCStats(orgId: string): Promise<DashboardSummary['scStats']> {
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
    } catch {
      return null;
    }
  }

  private async safeMembersByRole(orgId: string): Promise<Record<string, number>> {
    try {
      const rows: { role: string; count: string }[] = await AppDataSource.getRepository(
        OrganizationMembership
      )
        .createQueryBuilder('m')
        .select('m.role', 'role')
        .addSelect('COUNT(*)::int', 'count')
        .where('m.organizationId = :orgId', { orgId })
        .andWhere('m.isActive = true')
        .groupBy('m.role')
        .getRawMany();

      const result: Record<string, number> = {};
      for (const row of rows) {
        result[row.role] = Number(row.count);
      }
      return result;
    } catch {
      return {};
    }
  }

  private async safeTradingStats(
    orgId: string
  ): Promise<{ activeRoutes: number; totalEstimatedProfit: number } | null> {
    try {
      const result = await AppDataSource.getRepository(TradingRoute)
        .createQueryBuilder('tr')
        .select('COUNT(tr.id)::int', 'activeRoutes')
        .addSelect('COALESCE(SUM(tr.estimatedProfit)::numeric, 0)', 'totalEstimatedProfit')
        .where('tr.organizationId = :orgId', { orgId })
        .andWhere('tr.status = :status', { status: RouteStatus.ACTIVE })
        .getRawOne();

      return (
        result && {
          activeRoutes: result.activeRoutes || 0,
          totalEstimatedProfit: Number.parseFloat(result.totalEstimatedProfit || '0'),
        }
      );
    } catch (error: unknown) {
      logger.error('DashboardAggregator: safeTradingStats failed', { orgId, error });
      return null;
    }
  }

  private async safeInventoryStats(
    orgId: string
  ): Promise<{ totalItems: number; totalValue: number } | null> {
    try {
      const result = await AppDataSource.getRepository(FleetInventory)
        .createQueryBuilder('fi')
        .select('COUNT(fi.id)::int', 'totalItems')
        .addSelect('COALESCE(SUM(fi.totalValue)::numeric, 0)', 'totalValue')
        .where('fi.organizationId = :orgId', { orgId })
        .getRawOne();

      return (
        result && {
          totalItems: result.totalItems || 0,
          totalValue: Number.parseFloat(result.totalValue || '0'),
        }
      );
    } catch (error: unknown) {
      logger.error('DashboardAggregator: safeInventoryStats failed', { orgId, error });
      return null;
    }
  }

  private async safeMiningActiveCount(orgId: string): Promise<number> {
    try {
      return await AppDataSource.getRepository(MiningOperation)
        .createQueryBuilder('mo')
        .select('COUNT(mo.id)::int', 'count')
        .innerJoin(
          OrganizationMembership,
          'om',
          'om.userId = mo.coordinatorId AND om.organizationId = :orgId AND om.isActive = true'
        )
        .where('mo.status IN (:...statuses)', {
          statuses: [MiningOperationStatus.PLANNED, MiningOperationStatus.IN_PROGRESS],
        })
        .setParameter('orgId', orgId)
        .getRawOne()
        .then(result => result?.count || 0);
    } catch (error: unknown) {
      logger.error('DashboardAggregator: safeMiningActiveCount failed', { orgId, error });
      return 0;
    }
  }

  private async safeAllianceStats(
    orgId: string
  ): Promise<{ total: number; mutual: number; averageHealth: number } | null> {
    try {
      const stats = await this.allianceService.getAllianceStatistics(orgId);
      return {
        total: stats.total,
        mutual: stats.mutual,
        averageHealth: stats.averageHealth,
      };
    } catch {
      return null;
    }
  }

  private async safeBountyStats(orgId: string): Promise<{
    totalBounties: number;
    activeBounties: number;
    completedBounties: number;
  } | null> {
    try {
      const stats = await this.bountyService.getStatistics(orgId);
      return {
        totalBounties: stats.totalBounties,
        activeBounties: stats.activeBounties,
        completedBounties: stats.completedBounties,
      };
    } catch {
      return null;
    }
  }

  private async safeReputationStats(
    userId: string,
    orgId: string
  ): Promise<{ combinedScore: number; reliability: string } | null> {
    try {
      const rep = await this.reputationService.getUnifiedReputation(userId, orgId);
      return {
        combinedScore: rep.combinedScore,
        reliability: rep.reliability,
      };
    } catch {
      return null;
    }
  }

  /**
   * Count the current user's personal ships (all active, owned/pledged/gifted).
   */
  private async countPersonalShips(userId: string): Promise<number> {
    try {
      return await AppDataSource.getRepository(UserShip)
        .createQueryBuilder('ship')
        .where('ship.isActive = :isActive', { isActive: true })
        .andWhere('ship.userId = :userId', { userId })
        .andWhere('ship.status IN (:...statuses)', {
          statuses: [
            ShipOwnershipStatus.OWNED,
            ShipOwnershipStatus.PLEDGED,
            ShipOwnershipStatus.GIFTED,
          ],
        })
        .getCount();
    } catch (err: unknown) {
      logger.warn('Failed to count personal ships', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    }
  }

  /**
   * Count ALL active member ships in the org (regardless of sharing level).
   */
  private async countAllMemberShips(orgId: string): Promise<number> {
    try {
      // JOIN avoids building IN clause with 25K member IDs
      return await AppDataSource.getRepository(UserShip)
        .createQueryBuilder('ship')
        .innerJoin(
          OrganizationMembership,
          'm',
          'm."userId" = ship."userId" AND m."organizationId" = :orgId AND m."isActive" = true',
          { orgId }
        )
        .where('ship.isActive = :isActive', { isActive: true })
        .andWhere('ship.status IN (:...statuses)', {
          statuses: [
            ShipOwnershipStatus.OWNED,
            ShipOwnershipStatus.PLEDGED,
            ShipOwnershipStatus.GIFTED,
          ],
        })
        .getCount();
    } catch (err: unknown) {
      logger.warn('Failed to count all member ships', {
        orgId,
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    }
  }

  /**
   * Count member personal ships shared with the organization.
   * Includes ships with sharingLevel ORGANIZATION, ALLIANCE, or PUBLIC
   * from active org members with status owned/pledged/gifted.
   */
  private async countMemberShipsSharedWithOrg(orgId: string): Promise<number> {
    try {
      // JOIN avoids building IN clause with 25K member IDs
      return await AppDataSource.getRepository(UserShip)
        .createQueryBuilder('ship')
        .innerJoin(
          OrganizationMembership,
          'm',
          'm."userId" = ship."userId" AND m."organizationId" = :orgId AND m."isActive" = true',
          { orgId }
        )
        .where('ship.isActive = :isActive', { isActive: true })
        .andWhere('ship.sharingLevel IN (:...sharingLevels)', {
          sharingLevels: [
            ShipSharingLevel.ORGANIZATION,
            ShipSharingLevel.ALLIANCE,
            ShipSharingLevel.PUBLIC,
          ],
        })
        .andWhere('ship.status IN (:...statuses)', {
          statuses: [
            ShipOwnershipStatus.OWNED,
            ShipOwnershipStatus.PLEDGED,
            ShipOwnershipStatus.GIFTED,
          ],
        })
        .getCount();
    } catch (err: unknown) {
      logger.warn('Failed to count member ships shared with org', {
        orgId,
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    }
  }
}

