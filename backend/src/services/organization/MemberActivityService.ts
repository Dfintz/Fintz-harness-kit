import { AppDataSource } from '../../data-source';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { cache } from '../../utils/redis';

/**
 * Service for tracking and analyzing member activity
 * Provides methods to calculate active member counts and activity trends
 */
export class MemberActivityService {
  private userRepo = AppDataSource.getRepository(User);
  private userOrgRepo = AppDataSource.getRepository(OrganizationMembership);

  /**
   * Activity threshold in days - users active within this period are considered "active"
   */
  private readonly ACTIVE_THRESHOLD_DAYS = 30;

  /**
   * Get the count of active members in an organization
   * Active members are those who have been active within the last 30 days
   *
   * @param organizationId The organization ID
   * @returns Promise<number> Count of active members
   */
  async getActiveMemberCount(organizationId: string): Promise<number> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - this.ACTIVE_THRESHOLD_DAYS);

    // Subquery avoids building IN clause with 25K member IDs
    const activeCount = await this.userRepo
      .createQueryBuilder('user')
      .where(qb => {
        const subQuery = qb
          .subQuery()
          .select('m.userId')
          .from(OrganizationMembership, 'm')
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

  /**
   * Get activity trends for an organization over time
   * Returns daily active member counts for the specified number of days
   *
   * @param organizationId The organization ID
   * @param days Number of days to include (default: 30)
   * @returns Promise with activity trend data
   */
  async getActivityTrends(
    organizationId: string,
    days: number = 30
  ): Promise<{
    period: { start: Date; end: Date };
    dailyActiveMembers: Array<{ date: string; count: number }>;
    averageActiveMembers: number;
    totalMembers: number;
    activeRate: number;
  }> {
    // Redis cache: 10 min TTL (Phase 5.4)
    const cacheKey = `org:${organizationId}:activity:trends:${days}`;
    const cached = await cache.get<{
      period: { start: Date; end: Date };
      dailyActiveMembers: Array<{ date: string; count: number }>;
      averageActiveMembers: number;
      totalMembers: number;
      activeRate: number;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get total member count via COUNT (avoids loading all members)
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

    // Subquery avoids building IN clause with 25K member IDs
    const dailyCounts = await this.userRepo
      .createQueryBuilder('user')
      .select('DATE(user.lastActiveAt)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where(qb => {
        const subQuery = qb
          .subQuery()
          .select('m.userId')
          .from(OrganizationMembership, 'm')
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

    // Create a map of dates to counts
    const countMap = new Map<string, number>();
    dailyCounts.forEach((row: { date: string; count: string }) => {
      const dateStr = new Date(row.date).toISOString().split('T')[0];
      countMap.set(dateStr, parseInt(row.count));
    });

    // Fill in all days in the range (including days with 0 activity)
    const dailyActiveMembers: Array<{ date: string; count: number }> = [];
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

    // Calculate current active rate (active in last 30 days)
    const currentActiveCount = await this.getActiveMemberCount(organizationId);
    const activeRate = (currentActiveCount / totalMembers) * 100;

    const result = {
      period: { start: startDate, end: endDate },
      dailyActiveMembers,
      averageActiveMembers: Math.round(averageActiveMembers * 100) / 100,
      totalMembers,
      activeRate: Math.round(activeRate * 100) / 100,
    };

    await cache.set(cacheKey, result, 600); // 10 min

    return result;
  }

  /**
   * Get active member details for an organization
   * Returns list of active members with their last active timestamp
   *
   * @param organizationId The organization ID
   * @param limit Maximum number of results (default: 100)
   * @returns Promise with array of active member details
   */
  async getActiveMembers(
    organizationId: string,
    limit: number = 100
  ): Promise<Array<{ userId: string; username: string; lastActiveAt: Date }>> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - this.ACTIVE_THRESHOLD_DAYS);

    // Subquery avoids building IN clause with 25K member IDs
    const activeUsers = await this.userRepo
      .createQueryBuilder('user')
      .select(['user.id', 'user.username', 'user.lastActiveAt'])
      .where(qb => {
        const subQuery = qb
          .subQuery()
          .select('m.userId')
          .from(OrganizationMembership, 'm')
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

