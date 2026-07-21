import { Request, Response } from 'express';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { AuthRequest } from '../../middleware/auth';
import { FederationMember } from '../../models/FederationMember';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import {
  StarCommsAccessService,
  StarCommsFederationService,
} from '../../services/communication/starcomms';
import { ForbiddenError } from '../../utils/apiErrors';
import { sanitizeObject } from '../../utils/prototypePollutionPrevention';
import { BaseController } from '../BaseController';

export class StarCommsV2Controller extends BaseController {
  private readonly accessService = new StarCommsAccessService();
  private readonly federationService = new StarCommsFederationService();
  private readonly federationMemberRepo: Repository<FederationMember> =
    AppDataSource.getRepository(FederationMember);
  private readonly membershipRepo: Repository<OrganizationMembership> =
    AppDataSource.getRepository(OrganizationMembership);

  public listAccessible = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const userId = this.getUserId(request as AuthRequest);
      return this.accessService.listAccessibleIntegrations(userId);
    });
  };

  public getFederationConfig = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const federationId = authReq.params.federationId;
      const userId = this.getUserId(authReq);

      await this.ensureUserCanViewFederation(userId, federationId);
      return this.federationService.getFederationConfig(federationId);
    });
  };

  public updateFederationConfig = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const federationId = authReq.params.federationId;
      const userId = this.getUserId(authReq);
      const organizationId = this.getOrganizationId(authReq);

      await this.ensureUserCanViewFederation(userId, federationId);

      return this.federationService.updateFederationConfig(
        federationId,
        organizationId,
        userId,
        sanitizeObject(authReq.body)
      );
    });
  };

  public getFederationSharingSuggestions = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const federationId = authReq.params.federationId;
      const userId = this.getUserId(authReq);

      await this.ensureUserCanViewFederation(userId, federationId);
      return this.federationService.getFederationWhitelistSuggestions(federationId);
    });
  };

  private async ensureUserCanViewFederation(userId: string, federationId: string): Promise<void> {
    const memberships = await this.membershipRepo
      .createQueryBuilder('membership')
      .select(['membership."organizationId"'])
      .where('membership."userId" = :userId', { userId })
      .andWhere('membership."isActive" = true')
      .getMany();
    const organizationIds = memberships
      .map(membership => membership.organizationId)
      .filter((organizationId): organizationId is string => Boolean(organizationId));

    if (organizationIds.length === 0) {
      throw new ForbiddenError('You do not have access to this federation StarComms configuration');
    }

    const federationMembership = await this.federationMemberRepo
      .createQueryBuilder('member')
      .select(['member.id'])
      .where('member."federationId" = :federationId', { federationId })
      .andWhere('member."organizationId" = ANY(:organizationIds)', { organizationIds })
      .andWhere('member.status = :status', { status: 'active' as const })
      .getOne();

    if (!federationMembership) {
      throw new ForbiddenError('You do not have access to this federation StarComms configuration');
    }
  }

  private getUserId(req: AuthRequest): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenError('Authentication required');
    }
    return userId;
  }
}
