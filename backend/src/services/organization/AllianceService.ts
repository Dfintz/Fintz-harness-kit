import { In, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Activity } from '../../models/Activity';
import { AllianceDiplomacy, DiplomacyStatus } from '../../models/AllianceDiplomacy';
import { Organization } from '../../models/Organization';
import {
  OrganizationRelationship,
  RelationshipStatus,
  RelationshipType,
} from '../../models/OrganizationRelationship';

/**
 * Service for managing organization alliances
 * Handles alliance-specific operations including counts, shared activities, and statistics
 */
export class AllianceService {
  private relationshipRepository: Repository<OrganizationRelationship>;
  private diplomacyRepository: Repository<AllianceDiplomacy>;
  private activityRepository: Repository<Activity>;
  private organizationRepository: Repository<Organization>;

  constructor() {
    this.relationshipRepository = AppDataSource.getRepository(OrganizationRelationship);
    this.diplomacyRepository = AppDataSource.getRepository(AllianceDiplomacy);
    this.activityRepository = AppDataSource.getRepository(Activity);
    this.organizationRepository = AppDataSource.getRepository(Organization);
  }

  /**
   * Get count of active allies for an organization
   */
  async getAllianceCount(organizationId: string): Promise<number> {
    const count = await this.relationshipRepository.count({
      where: {
        organizationId,
        type: RelationshipType.ALLIED,
        status: RelationshipStatus.ACTIVE,
      },
    });

    return count;
  }

  /**
   * Get all active allies for an organization
   */
  async getAlliances(organizationId: string): Promise<OrganizationRelationship[]> {
    const alliances = await this.relationshipRepository.find({
      where: {
        organizationId,
        type: RelationshipType.ALLIED,
        status: RelationshipStatus.ACTIVE,
      },
      order: {
        establishedDate: 'DESC',
      },
    });

    return alliances;
  }

  /**
   * Get alliance details with diplomacy information
   */
  async getAllianceDetails(organizationId: string) {
    const alliances = await this.getAlliances(organizationId);

    // Batch-load target org names
    const targetOrgIds = alliances.map(a => a.targetOrganizationId);
    const targetOrgs =
      targetOrgIds.length > 0
        ? await this.organizationRepository.find({ where: { id: In(targetOrgIds) } })
        : [];
    const orgNameMap = new Map(targetOrgs.map(o => [o.id, o.name]));

    // Batch-load diplomacy records (eliminates N+1 per-alliance query)
    const diplomacies =
      targetOrgIds.length > 0
        ? await this.diplomacyRepository.find({
            where: [
              { orgId1: organizationId, orgId2: In(targetOrgIds) },
              { orgId1: In(targetOrgIds), orgId2: organizationId },
            ],
          })
        : [];
    const diplomacyMap = new Map(
      diplomacies.map(d => {
        const key = d.orgId1 === organizationId ? d.orgId2 : d.orgId1;
        return [key, d];
      })
    );

    const details = alliances.map(alliance => ({
      relationship: alliance,
      targetOrganizationName:
        orgNameMap.get(alliance.targetOrganizationId) ?? 'Unknown Organization',
      diplomacy: diplomacyMap.get(alliance.targetOrganizationId) ?? null,
      healthScore: alliance.calculateHealthScore(),
      trustLevel: alliance.getTrustLevel(),
    }));

    return details;
  }

  /**
   * Get alliance statistics
   */
  async getAllianceStatistics(organizationId: string) {
    const alliances = await this.getAlliances(organizationId);

    const totalAlliances = alliances.length;
    const healthScores = alliances.map(a => a.calculateHealthScore());
    const averageHealth =
      healthScores.length > 0
        ? healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length
        : 0;

    const strongAlliances = alliances.filter(a => a.calculateHealthScore() >= 80).length;
    const needingReview = alliances.filter(a => a.needsReview()).length;
    const mutualAlliances = alliances.filter(a => a.isMutual).length;

    return {
      total: totalAlliances,
      averageHealth: Math.round(averageHealth),
      strong: strongAlliances,
      needingReview,
      mutual: mutualAlliances,
      mutualPercentage:
        totalAlliances > 0 ? Math.round((mutualAlliances / totalAlliances) * 100) : 0,
    };
  }

  /**
   * Get shared activities with allied organizations
   */
  async getSharedActivities(
    organizationId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
    }
  ) {
    const alliances = await this.getAlliances(organizationId);
    const alliedOrgIds = alliances.map(a => a.targetOrganizationId);

    if (alliedOrgIds.length === 0) {
      return {
        activities: [],
        total: 0,
      };
    }

    const queryBuilder = this.activityRepository.createQueryBuilder('activity');

    queryBuilder.where('activity.organizationId IN (:...orgIds)', {
      orgIds: [organizationId, ...alliedOrgIds],
    });

    if (options?.status) {
      queryBuilder.andWhere('activity.status = :status', { status: options.status });
    }

    const total = await queryBuilder.getCount();

    queryBuilder
      .orderBy('activity.createdAt', 'DESC')
      .skip(options?.offset || 0)
      .take(options?.limit || 20);

    const activities = await queryBuilder.getMany();

    return {
      activities,
      total,
    };
  }

  /**
   * Get alliance-wide statistics for dashboard
   */
  async getAllianceWideStats(organizationId: string) {
    const alliances = await this.getAlliances(organizationId);
    const alliedOrgIds = alliances.map(a => a.targetOrganizationId);

    // Single query with conditional counts instead of 2 separate COUNT queries
    const orgIds = [organizationId, ...alliedOrgIds];
    const stats = await this.activityRepository
      .createQueryBuilder('activity')
      .select(`SUM(CASE WHEN activity.status = 'active' THEN 1 ELSE 0 END)::int`, 'activeCount')
      .addSelect(
        `SUM(CASE WHEN activity.status = 'scheduled' THEN 1 ELSE 0 END)::int`,
        'scheduledCount'
      )
      .where('activity.organizationId IN (:...orgIds)', { orgIds })
      .getRawOne<{ activeCount: number; scheduledCount: number }>();

    return {
      allianceCount: alliances.length,
      activeSharedActivities: stats?.activeCount ?? 0,
      upcomingSharedActivities: stats?.scheduledCount ?? 0,
      alliedOrganizations: alliedOrgIds,
    };
  }

  /**
   * Check if two organizations are allied
   */
  async areAllied(org1Id: string, org2Id: string): Promise<boolean> {
    const relationship = await this.relationshipRepository.findOne({
      where: {
        organizationId: org1Id,
        targetOrganizationId: org2Id,
        type: RelationshipType.ALLIED,
        status: RelationshipStatus.ACTIVE,
      },
    });

    return !!relationship;
  }

  /**
   * Get pending alliance proposals
   */
  async getPendingAllianceProposals(organizationId: string) {
    const proposals = await this.relationshipRepository.find({
      where: {
        organizationId,
        type: RelationshipType.ALLIED,
        status: RelationshipStatus.PENDING,
      },
    });

    return proposals;
  }

  /**
   * Get active diplomacy relations for an organization
   */
  async getActiveDiplomacy(organizationId: string) {
    const diplomacy = await this.diplomacyRepository.find({
      where: [
        { orgId1: organizationId, status: DiplomacyStatus.ACTIVE },
        { orgId2: organizationId, status: DiplomacyStatus.ACTIVE },
      ],
    });

    return diplomacy;
  }
}

