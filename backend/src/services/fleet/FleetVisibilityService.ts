import crypto from 'node:crypto';

import { In } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { AllianceDiplomacy, DiplomacyStatus } from '../../models/AllianceDiplomacy';
import { FederationMember } from '../../models/FederationMember';
import {
  FleetVisibilityAccessLevel,
  FleetVisibilityRule,
  FleetVisibilityScope,
} from '../../models/FleetVisibilityRule';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

import { FleetAuditAction, fleetAuditLogger } from './FleetAuditLogger';

/**
 * FleetVisibilityService
 *
 * Manages fleet visibility rules that control who can see a fleet
 * and at what level of detail (summary, composition, full).
 *
 * Rules are scoped to:
 * - organization: restricts by member security level (rank)
 * - alliance: grants access to a specific allied org
 * - federation: grants access to all member orgs of a federation
 */
export class FleetVisibilityService {
  private readonly ruleRepository = AppDataSource.getRepository(FleetVisibilityRule);
  private readonly allianceRepository = AppDataSource.getRepository(AllianceDiplomacy);
  private readonly federationMemberRepository = AppDataSource.getRepository(FederationMember);

  /**
   * Get all visibility rules for a fleet.
   */
  async getRulesForFleet(organizationId: string, fleetId: string): Promise<FleetVisibilityRule[]> {
    logger.info('FleetVisibilityService.getRulesForFleet', { organizationId, fleetId });

    return this.ruleRepository.find({
      where: { fleetId, organizationId },
      order: { scope: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Create a new visibility rule for a fleet.
   *
   * Validates scope-specific requirements:
   * - organization: requires minSecurityLevel (1-100)
   * - alliance: requires targetAllianceOrgId with active alliance
   * - federation: requires targetFederationId with active membership
   */
  async createRule(
    organizationId: string,
    fleetId: string,
    data: {
      scope: FleetVisibilityScope;
      accessLevel: FleetVisibilityAccessLevel;
      minSecurityLevel?: number;
      targetAllianceOrgId?: string;
      targetFederationId?: string;
    }
  ): Promise<FleetVisibilityRule> {
    logger.info('FleetVisibilityService.createRule', {
      organizationId,
      fleetId,
      scope: data.scope,
    });

    // Validate scope-specific fields
    await this.validateRuleData(organizationId, data);

    const rule = this.ruleRepository.create({
      id: crypto.randomUUID(),
      fleetId,
      organizationId,
      scope: data.scope,
      accessLevel: data.accessLevel,
      minSecurityLevel: data.scope === 'organization' ? data.minSecurityLevel : undefined,
      targetAllianceOrgId: data.scope === 'alliance' ? data.targetAllianceOrgId : undefined,
      targetFederationId: data.scope === 'federation' ? data.targetFederationId : undefined,
      isActive: true,
    });

    const saved = await this.ruleRepository.save(rule);

    fleetAuditLogger.log({
      action: FleetAuditAction.FLEET_UPDATED,
      fleetId,
      fleetName: '',
      organizationId,
      performedById: '',
      details: {
        change: 'visibility_rule_added',
        scope: data.scope,
        accessLevel: data.accessLevel,
      },
    });

    return saved;
  }

  /**
   * Update an existing visibility rule.
   */
  async updateRule(
    organizationId: string,
    ruleId: string,
    data: {
      accessLevel?: FleetVisibilityAccessLevel;
      minSecurityLevel?: number;
      isActive?: boolean;
    }
  ): Promise<FleetVisibilityRule> {
    logger.info('FleetVisibilityService.updateRule', { organizationId, ruleId });

    const rule = await this.ruleRepository.findOne({
      where: { id: ruleId, organizationId },
    });

    if (!rule) {
      throw new NotFoundError('Fleet visibility rule');
    }

    if (data.accessLevel !== undefined) {
      rule.accessLevel = data.accessLevel;
    }
    if (data.minSecurityLevel !== undefined && rule.scope === 'organization') {
      if (data.minSecurityLevel < 1 || data.minSecurityLevel > 100) {
        throw new ValidationError('minSecurityLevel must be between 1 and 100');
      }
      rule.minSecurityLevel = data.minSecurityLevel;
    }
    if (data.isActive !== undefined) {
      rule.isActive = data.isActive;
    }

    return this.ruleRepository.save(rule);
  }

  /**
   * Delete a visibility rule.
   */
  async deleteRule(organizationId: string, ruleId: string): Promise<void> {
    logger.info('FleetVisibilityService.deleteRule', { organizationId, ruleId });

    const rule = await this.ruleRepository.findOne({
      where: { id: ruleId, organizationId },
    });

    if (!rule) {
      throw new NotFoundError('Fleet visibility rule');
    }

    await this.ruleRepository.remove(rule);
  }

  /**
   * Look up a user's security level from their org membership.
   * Returns 1 (lowest) if no membership is found.
   */
  async getUserSecurityLevel(userId: string, organizationId: string): Promise<number> {
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    const membership = await membershipRepo.findOne({
      where: { userId, organizationId, isActive: true },
      select: ['securityLevel'],
    });
    return membership?.securityLevel ?? 1;
  }

  /**
   * Check what access level a requesting org/user has to a specific fleet.
   *
   * Evaluates all active visibility rules and returns the highest access level
   * that any matching rule grants. Returns null if no rule grants access.
   *
   * @param requestingOrgId - The organization requesting access
   * @param fleetOrgId - The organization that owns the fleet
   * @param fleetId - The fleet being accessed
   * @param requesterSecurityLevel - The requesting user's security level in their org
   */
  async resolveAccessLevel(
    requestingOrgId: string,
    fleetOrgId: string,
    fleetId: string,
    requesterSecurityLevel: number
  ): Promise<FleetVisibilityAccessLevel | null> {
    // Same-org access: check organization-scope rules
    if (requestingOrgId === fleetOrgId) {
      return this.resolveOrgLevelAccess(fleetId, fleetOrgId, requesterSecurityLevel);
    }

    // Cross-org access: check alliance and federation rules
    return this.resolveCrossOrgAccess(requestingOrgId, fleetOrgId, fleetId);
  }

  /**
   * Get all fleets visible to a requesting org through federation or alliance rules.
   */
  async getVisibleFleetIds(
    requestingOrgId: string
  ): Promise<Array<{ fleetId: string; accessLevel: FleetVisibilityAccessLevel }>> {
    // Find federations the requesting org belongs to
    const federationMemberships = await this.federationMemberRepository.find({
      where: { organizationId: requestingOrgId, status: 'active' },
      select: ['federationId'],
    });
    const federationIds = federationMemberships.map(m => m.federationId);

    // Find active alliances the requesting org has
    const alliances = await this.allianceRepository
      .createQueryBuilder('ad')
      .where('(ad.orgId1 = :orgId OR ad.orgId2 = :orgId) AND ad.status = :status', {
        orgId: requestingOrgId,
        status: DiplomacyStatus.ACTIVE,
      })
      .getMany();

    // Build conditions for matching rules
    const queryBuilder = this.ruleRepository
      .createQueryBuilder('rule')
      .where('rule.isActive = true')
      .andWhere('rule.organizationId != :requestingOrgId', { requestingOrgId });

    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    // Alliance rules: match on targetAllianceOrgId
    if (alliances.length > 0) {
      conditions.push(
        '(rule.scope = :allianceScope AND rule.targetAllianceOrgId = :requestingOrgId)'
      );
      params.allianceScope = 'alliance';
      params.requestingOrgId = requestingOrgId;
    }

    // Federation rules: match on targetFederationId
    if (federationIds.length > 0) {
      conditions.push(
        '(rule.scope = :fedScope AND rule.targetFederationId IN (:...federationIds))'
      );
      params.fedScope = 'federation';
      params.federationIds = federationIds;
    }

    if (conditions.length === 0) {
      return [];
    }

    queryBuilder.andWhere(`(${conditions.join(' OR ')})`, params);

    const rules = await queryBuilder.getMany();

    // Deduplicate by fleetId, keeping highest access level
    const fleetMap = new Map<string, FleetVisibilityAccessLevel>();
    for (const rule of rules) {
      const current = fleetMap.get(rule.fleetId);
      if (!current || this.accessLevelRank(rule.accessLevel) > this.accessLevelRank(current)) {
        fleetMap.set(rule.fleetId, rule.accessLevel);
      }
    }

    return Array.from(fleetMap.entries()).map(([fleetId, accessLevel]) => ({
      fleetId,
      accessLevel,
    }));
  }

  // ─── Private Helpers ─────────────────────────────────────────

  private async validateRuleData(
    organizationId: string,
    data: {
      scope: FleetVisibilityScope;
      minSecurityLevel?: number;
      targetAllianceOrgId?: string;
      targetFederationId?: string;
    }
  ): Promise<void> {
    switch (data.scope) {
      case 'organization':
        if (data.minSecurityLevel === undefined || data.minSecurityLevel === null) {
          throw new ValidationError('minSecurityLevel is required for organization scope');
        }
        if (data.minSecurityLevel < 1 || data.minSecurityLevel > 100) {
          throw new ValidationError('minSecurityLevel must be between 1 and 100');
        }
        break;

      case 'alliance': {
        if (!data.targetAllianceOrgId) {
          throw new ValidationError('targetAllianceOrgId is required for alliance scope');
        }
        // Verify active alliance exists
        const alliance = await this.allianceRepository.findOne({
          where: [
            {
              orgId1: organizationId,
              orgId2: data.targetAllianceOrgId,
              status: DiplomacyStatus.ACTIVE,
            },
            {
              orgId1: data.targetAllianceOrgId,
              orgId2: organizationId,
              status: DiplomacyStatus.ACTIVE,
            },
          ],
        });
        if (!alliance) {
          throw new ValidationError('No active alliance exists with the target organization');
        }
        break;
      }

      case 'federation': {
        if (!data.targetFederationId) {
          throw new ValidationError('targetFederationId is required for federation scope');
        }
        // Verify org is a member of the federation
        const membership = await this.federationMemberRepository.findOne({
          where: {
            federationId: data.targetFederationId,
            organizationId,
            status: 'active',
          },
        });
        if (!membership) {
          throw new ValidationError(
            'Organization is not an active member of the specified federation'
          );
        }
        break;
      }

      default:
        throw new ValidationError(`Invalid scope: ${data.scope}`);
    }
  }

  private async resolveOrgLevelAccess(
    fleetId: string,
    orgId: string,
    securityLevel: number
  ): Promise<FleetVisibilityAccessLevel | null> {
    const rules = await this.ruleRepository.find({
      where: {
        fleetId,
        organizationId: orgId,
        scope: 'organization' as FleetVisibilityScope,
        isActive: true,
      },
    });

    // If no org-level rules, the fleet uses default visibility (accessible to all org members)
    if (rules.length === 0) {
      return 'full';
    }

    // Find rules where the user's security level meets the minimum
    let highestAccess: FleetVisibilityAccessLevel | null = null;
    for (const rule of rules) {
      if (rule.minSecurityLevel && securityLevel >= rule.minSecurityLevel) {
        if (
          !highestAccess ||
          this.accessLevelRank(rule.accessLevel) > this.accessLevelRank(highestAccess)
        ) {
          highestAccess = rule.accessLevel;
        }
      }
    }

    return highestAccess;
  }

  private async resolveCrossOrgAccess(
    requestingOrgId: string,
    fleetOrgId: string,
    fleetId: string
  ): Promise<FleetVisibilityAccessLevel | null> {
    const rules = await this.ruleRepository.find({
      where: {
        fleetId,
        organizationId: fleetOrgId,
        isActive: true,
      },
    });

    // Check alliance rules
    const allianceRules = rules.filter(
      r => r.scope === 'alliance' && r.targetAllianceOrgId === requestingOrgId
    );

    // Check federation rules
    const federationRules = rules.filter(r => r.scope === 'federation');
    const matchingFedRules: FleetVisibilityRule[] = [];

    if (federationRules.length > 0) {
      const fedIds = federationRules
        .map(r => r.targetFederationId)
        .filter((id): id is string => !!id);

      if (fedIds.length > 0) {
        const memberships = await this.federationMemberRepository.find({
          where: {
            federationId: In(fedIds),
            organizationId: requestingOrgId,
            status: 'active',
          },
        });
        const memberFedIds = new Set(memberships.map(m => m.federationId));
        for (const rule of federationRules) {
          if (rule.targetFederationId && memberFedIds.has(rule.targetFederationId)) {
            matchingFedRules.push(rule);
          }
        }
      }
    }

    const allMatching = [...allianceRules, ...matchingFedRules];
    if (allMatching.length === 0) {
      return null;
    }

    // Return highest access level
    let highest: FleetVisibilityAccessLevel = allMatching[0].accessLevel;
    for (const rule of allMatching) {
      if (this.accessLevelRank(rule.accessLevel) > this.accessLevelRank(highest)) {
        highest = rule.accessLevel;
      }
    }

    return highest;
  }

  private accessLevelRank(level: FleetVisibilityAccessLevel): number {
    switch (level) {
      case 'summary':
        return 1;
      case 'composition':
        return 2;
      case 'full':
        return 3;
      default:
        return 0;
    }
  }
}

