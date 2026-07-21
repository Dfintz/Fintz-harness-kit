import type { VoiceServerWhitelistSuggestion } from '@sc-fleet-manager/shared-types';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../../data-source';
import {
  ExternalIntegration,
  IntegrationType,
  SyncDirection,
} from '../../../models/ExternalIntegration';
import { Federation } from '../../../models/Federation';
import { FederationMember } from '../../../models/FederationMember';
import { Organization } from '../../../models/Organization';
import { NotFoundError } from '../../../utils/apiErrors';
import { ExternalIntegrationService } from '../../external/ExternalIntegrationService';

type StarCommsSettings = {
  fleetId?: string;
  name?: string;
  enabled?: boolean;
  status?: ExternalIntegration['status'];
  starCommsConfig?: ExternalIntegration['starCommsConfig'];
};

export class StarCommsFederationService {
  private readonly fedRepo: Repository<Federation>;
  private readonly fedMemberRepo: Repository<FederationMember>;
  private readonly orgRepo: Repository<Organization>;
  private readonly integrationRepo: Repository<ExternalIntegration>;
  private readonly integrationService: ExternalIntegrationService;

  constructor(
    fedRepo: Repository<Federation> = AppDataSource.getRepository(Federation),
    fedMemberRepo: Repository<FederationMember> = AppDataSource.getRepository(FederationMember),
    orgRepo: Repository<Organization> = AppDataSource.getRepository(Organization),
    integrationRepo: Repository<ExternalIntegration> = AppDataSource.getRepository(
      ExternalIntegration
    ),
    integrationService: ExternalIntegrationService = new ExternalIntegrationService()
  ) {
    this.fedRepo = fedRepo;
    this.fedMemberRepo = fedMemberRepo;
    this.orgRepo = orgRepo;
    this.integrationRepo = integrationRepo;
    this.integrationService = integrationService;
  }

  public async getFederationConfig(federationId: string): Promise<ExternalIntegration | null> {
    await this.ensureFederationExists(federationId);
    return this.integrationRepo
      .createQueryBuilder('integration')
      .where('integration.type = :type', { type: IntegrationType.STARCOMMS })
      .andWhere('integration."ownerType" = :ownerType', { ownerType: 'federation' })
      .andWhere('integration."ownerId" = :ownerId', { ownerId: federationId })
      .orderBy('integration."createdAt"', 'DESC')
      .getOne();
  }

  public async updateFederationConfig(
    federationId: string,
    actorOrganizationId: string,
    actorUserId: string,
    input: StarCommsSettings
  ): Promise<ExternalIntegration> {
    await this.ensureFederationMembership(federationId, actorOrganizationId);

    const existing = await this.integrationRepo
      .createQueryBuilder('integration')
      .where('integration.type = :type', { type: IntegrationType.STARCOMMS })
      .andWhere('integration."ownerType" = :ownerType', { ownerType: 'federation' })
      .andWhere('integration."ownerId" = :ownerId', { ownerId: federationId })
      .orderBy('integration."createdAt"', 'DESC')
      .getOne();

    if (!existing) {
      const federationMember = await this.fedMemberRepo
        .createQueryBuilder('member')
        .where('member."federationId" = :federationId', { federationId })
        .andWhere('member."organizationId" = :organizationId', {
          organizationId: actorOrganizationId,
        })
        .andWhere('member.status = :status', { status: 'active' as const })
        .getOne();

      const createDto = {
        fleetId: input.fleetId ?? actorOrganizationId,
        ownerType: 'federation' as const,
        ownerId: federationId,
        name: input.name ?? 'Federation StarComms',
        description: 'Federation-owned StarComms integration',
        type: IntegrationType.STARCOMMS,
        syncDirection: SyncDirection.BIDIRECTIONAL,
        authConfig: { type: 'none' as const },
        starCommsConfig: input.starCommsConfig,
        createdBy: actorUserId,
      };

      // Reuse existing integration lifecycle behavior (status init + connection test).
      return this.integrationService.createIntegration({
        ...createDto,
        description:
          federationMember?.organizationName && createDto.description
            ? `${createDto.description} (${federationMember.organizationName})`
            : createDto.description,
      });
    }

    return this.integrationService.updateIntegration(existing.id, {
      name: input.name,
      enabled: input.enabled,
      status: input.status,
      starCommsConfig: input.starCommsConfig,
      ownerType: 'federation',
      ownerId: federationId,
    });
  }

  public async getFederationWhitelistSuggestions(
    federationId: string
  ): Promise<VoiceServerWhitelistSuggestion[]> {
    await this.ensureFederationExists(federationId);

    const members = await this.fedMemberRepo
      .createQueryBuilder('member')
      .select(['member."organizationId"', 'member."organizationName"'])
      .where('member."federationId" = :federationId', { federationId })
      .andWhere('member.status = :status', { status: 'active' as const })
      .getMany();

    const suggestions = new Map<string, VoiceServerWhitelistSuggestion>();

    members.forEach(member => {
      if (!suggestions.has(member.organizationId)) {
        suggestions.set(member.organizationId, {
          type: 'organization',
          targetId: member.organizationId,
          targetName: member.organizationName || member.organizationId,
          source: 'federation_membership',
          sourceLabel: 'Federation Member Organization',
          alreadyWhitelisted: false,
        });
      }
    });

    const memberOrgIds = [...new Set(members.map(member => member.organizationId))];
    if (memberOrgIds.length > 0) {
      const sharedMemberships = await this.fedMemberRepo
        .createQueryBuilder('member')
        .select(['member."federationId"', 'member."organizationId"'])
        .where('member."organizationId" = ANY(:orgIds)', { orgIds: memberOrgIds })
        .andWhere('member.status = :status', { status: 'active' as const })
        .getMany();

      const sharedFedCounts = new Map<string, number>();
      sharedMemberships.forEach(membership => {
        if (membership.federationId !== federationId) {
          sharedFedCounts.set(
            membership.federationId,
            (sharedFedCounts.get(membership.federationId) ?? 0) + 1
          );
        }
      });

      const sharedFedIds = Array.from(sharedFedCounts.keys());
      if (sharedFedIds.length > 0) {
        const sharedFeds = await this.fedRepo
          .createQueryBuilder('federation')
          .select(['federation.id', 'federation.name'])
          .where('federation.id = ANY(:ids)', { ids: sharedFedIds })
          .getMany();

        sharedFeds.forEach(sharedFed => {
          if (!suggestions.has(sharedFed.id)) {
            const count = sharedFedCounts.get(sharedFed.id) ?? 0;
            suggestions.set(sharedFed.id, {
              type: 'federation',
              targetId: sharedFed.id,
              targetName: sharedFed.name,
              source: 'federation_membership',
              sourceLabel:
                count === 1
                  ? 'Shared Member Organization'
                  : `Shared Member Organizations (${count})`,
              alreadyWhitelisted: false,
            });
          }
        });
      }

      const orgs = await this.orgRepo
        .createQueryBuilder('organization')
        .select(['organization.id', 'organization.name'])
        .where('organization.id = ANY(:ids)', { ids: memberOrgIds })
        .getMany();

      orgs.forEach(org => {
        if (!suggestions.has(org.id)) {
          suggestions.set(org.id, {
            type: 'organization',
            targetId: org.id,
            targetName: org.name,
            source: 'federation_membership',
            sourceLabel: 'Federation Member Organization',
            alreadyWhitelisted: false,
          });
        }
      });
    }

    return Array.from(suggestions.values());
  }

  private async ensureFederationExists(federationId: string): Promise<void> {
    const federation = await this.fedRepo
      .createQueryBuilder('federation')
      .select(['federation.id'])
      .where('federation.id = :federationId', { federationId })
      .getOne();

    if (!federation) {
      throw new NotFoundError('Federation not found');
    }
  }

  private async ensureFederationMembership(
    federationId: string,
    organizationId: string
  ): Promise<void> {
    await this.ensureFederationExists(federationId);

    const member = await this.fedMemberRepo
      .createQueryBuilder('member')
      .select(['member.id'])
      .where('member."federationId" = :federationId', { federationId })
      .andWhere('member."organizationId" = :organizationId', { organizationId })
      .andWhere('member.status = :status', { status: 'active' as const })
      .getOne();

    if (!member) {
      throw new NotFoundError('Federation membership not found');
    }
  }
}
