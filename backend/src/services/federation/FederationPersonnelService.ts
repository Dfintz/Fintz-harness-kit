import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { FederationAmbassador } from '../../models/FederationAmbassador';
import { FederationMember } from '../../models/FederationMember';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { logger } from '../../utils/logger';

import { FederationAmbassadorService } from './FederationAmbassadorService';
import { requireFederationViewAccess } from './federationPermissions';

// ─── Data Interfaces ──────────────────────────────────────────

export interface FederationPersonnel {
  userId: string;
  userName: string;
  organizationId: string;
  organizationName: string;
  orgRole: string;
  title: string | null;
  isAmbassador: boolean;
  ambassadorRole: string | null;
  ambassadorTitle: string | null;
  joinedAt: Date | null;
}

export interface FederationPersonnelSummary {
  totalPersonnel: number;
  byOrganization: Record<string, number>;
  totalAmbassadors: number;
}

/**
 * FederationPersonnelService
 *
 * Aggregates member data across all federation member organizations
 * to provide a cross-org personnel directory. Ambassadors with 'view'
 * permission can see the directory. Ambassadors with 'hr' permission
 * can manage cross-org assignments.
 */
export class FederationPersonnelService {
  private static instance: FederationPersonnelService;
  private readonly memberRepository: Repository<FederationMember>;
  private readonly membershipRepository: Repository<OrganizationMembership>;
  private readonly ambassadorRepository: Repository<FederationAmbassador>;
  private readonly ambassadorService: FederationAmbassadorService;

  constructor() {
    this.memberRepository = AppDataSource.getRepository(FederationMember);
    this.membershipRepository = AppDataSource.getRepository(OrganizationMembership);
    this.ambassadorRepository = AppDataSource.getRepository(FederationAmbassador);
    this.ambassadorService = FederationAmbassadorService.getInstance();
  }

  public static getInstance(): FederationPersonnelService {
    if (!FederationPersonnelService.instance) {
      FederationPersonnelService.instance = new FederationPersonnelService();
    }
    return FederationPersonnelService.instance;
  }

  /**
   * List all personnel across federation member organizations.
   * Returns users from each active member org with their roles
   * and ambassador status.
   */
  async listPersonnel(federationId: string, userId: string): Promise<FederationPersonnel[]> {
    await requireFederationViewAccess(
      this.ambassadorService,
      federationId,
      userId,
      'federation personnel directory'
    );

    // Get all active member orgs
    const members = await this.memberRepository.find({
      where: { federationId, status: 'active' as const },
    });

    if (members.length === 0) {
      return [];
    }

    const orgIds = members.map(m => m.organizationId);
    const orgNameMap = new Map(members.map(m => [m.organizationId, m.organizationName]));

    // Get all ambassadors for this federation
    const ambassadors = await this.ambassadorRepository.find({
      where: { federationId, isActive: true },
    });
    const ambassadorMap = new Map(ambassadors.map(a => [a.userId, a]));

    // Get memberships from all member orgs
    const personnel: FederationPersonnel[] = [];

    for (const orgId of orgIds) {
      const memberships = await this.membershipRepository.find({
        where: { organizationId: orgId, isActive: true },
        relations: ['role', 'user'],
        take: 200,
      });

      for (const membership of memberships) {
        const amb = ambassadorMap.get(membership.userId);
        personnel.push({
          userId: membership.userId,
          userName: membership.user?.username ?? membership.userId.substring(0, 8),
          organizationId: orgId,
          organizationName: orgNameMap.get(orgId) ?? 'Unknown',
          orgRole: membership.role?.name ?? 'Member',
          title: membership.title ?? null,
          isAmbassador: !!amb,
          ambassadorRole: amb?.role ?? null,
          ambassadorTitle: amb?.title ?? null,
          joinedAt: membership.joinedAt ?? null,
        });
      }
    }

    logger.info('Federation personnel directory accessed', {
      federationId,
      totalPersonnel: personnel.length,
      orgCount: orgIds.length,
    });

    return personnel;
  }

  /**
   * Get personnel summary statistics.
   */
  async getPersonnelSummary(
    federationId: string,
    userId: string
  ): Promise<FederationPersonnelSummary> {
    await requireFederationViewAccess(
      this.ambassadorService,
      federationId,
      userId,
      'federation personnel summary'
    );

    const members = await this.memberRepository.find({
      where: { federationId, status: 'active' as const },
    });

    const byOrganization: Record<string, number> = {};
    let totalPersonnel = 0;

    for (const member of members) {
      const count = await this.membershipRepository.count({
        where: { organizationId: member.organizationId, isActive: true },
      });
      byOrganization[member.organizationName] = count;
      totalPersonnel += count;
    }

    const totalAmbassadors = await this.ambassadorRepository.count({
      where: { federationId, isActive: true },
    });

    return {
      totalPersonnel,
      byOrganization,
      totalAmbassadors,
    };
  }
}

