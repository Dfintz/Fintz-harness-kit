import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { AllianceDiplomacy, AllianceType, DiplomacyStatus } from '../../models/AllianceDiplomacy';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';

import { diplomacyAuditLogger } from './DiplomacyAuditLogger';

export interface ProposeDiplomacyDto {
  orgId1: string;
  orgId2: string;
  allianceType: AllianceType;
  proposedBy: string;
  terms?: AllianceDiplomacy['terms'];
  notes?: string;
}

export class AllianceDiplomacyService {
  private readonly repository: Repository<AllianceDiplomacy>;

  constructor() {
    this.repository = AppDataSource.getRepository(AllianceDiplomacy);
  }

  async propose(dto: ProposeDiplomacyDto): Promise<AllianceDiplomacy> {
    logger.debug('AllianceDiplomacyService.propose', {
      orgId1: dto.orgId1,
      orgId2: dto.orgId2,
    });

    if (dto.orgId1 === dto.orgId2) {
      throw new ValidationError('Cannot propose diplomacy with your own organization');
    }

    const diplomacy = this.repository.create({
      id: crypto.randomUUID(),
      orgId1: dto.orgId1,
      orgId2: dto.orgId2,
      allianceType: dto.allianceType,
      proposedBy: dto.proposedBy,
      terms: dto.terms ?? [],
      incidents: [],
      notes: dto.notes,
      status: DiplomacyStatus.PROPOSED,
    });

    await this.repository.save(diplomacy);

    diplomacyAuditLogger.logProposed(
      diplomacy.id,
      dto.orgId1,
      dto.orgId2,
      dto.allianceType,
      dto.proposedBy
    );

    return diplomacy;
  }

  /**
   * List diplomacy relations for a specific organization.
   * Returns only records where the org is a party (orgId1 or orgId2).
   */
  async findAll(
    orgId: string,
    pagination: PaginationOptions
  ): Promise<PaginatedResponse<AllianceDiplomacy>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;
    const sortBy = pagination.sortBy ?? 'createdAt';
    const sortOrder = pagination.sortOrder ?? 'DESC';

    const [data, total] = await this.repository.findAndCount({
      where: [{ orgId1: orgId }, { orgId2: orgId }],
      skip,
      take: limit,
      order: { [sortBy]: sortOrder },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Find a diplomacy relation by ID, scoped to the requesting organization.
   * Throws NotFoundError if the record doesn't exist or the org is not a party.
   */
  async findById(id: string, orgId: string): Promise<AllianceDiplomacy> {
    const diplomacy = await this.repository.findOne({
      where: [
        { id, orgId1: orgId },
        { id, orgId2: orgId },
      ],
    });
    if (!diplomacy) {
      throw new NotFoundError('Diplomacy relation');
    }
    return diplomacy;
  }

  /**
   * Approve a proposed diplomacy.
   * Only the target organization (orgId2) can approve a proposal.
   */
  async approve(id: string, orgId: string, approvedBy: string): Promise<AllianceDiplomacy> {
    const diplomacy = await this.findById(id, orgId);

    if (diplomacy.orgId2 !== orgId) {
      throw new ForbiddenError('Only the target organization can approve a diplomacy proposal', {
        resource: 'diplomacy',
        action: 'approve',
        scope: orgId,
        resourceId: id,
      });
    }

    if (diplomacy.status !== DiplomacyStatus.PROPOSED) {
      throw new ValidationError('Diplomacy is not in proposed status');
    }

    diplomacy.status = DiplomacyStatus.ACTIVE;
    diplomacy.approvedBy = approvedBy;
    diplomacy.startDate = new Date();

    await this.repository.save(diplomacy);

    diplomacyAuditLogger.logApproved(diplomacy.id, diplomacy.orgId1, diplomacy.orgId2, approvedBy);

    return diplomacy;
  }

  async suspend(id: string, orgId: string): Promise<AllianceDiplomacy> {
    const diplomacy = await this.findById(id, orgId);
    diplomacy.status = DiplomacyStatus.SUSPENDED;
    await this.repository.save(diplomacy);

    diplomacyAuditLogger.logSuspended(diplomacy.id, diplomacy.orgId1, diplomacy.orgId2, orgId);

    return diplomacy;
  }

  async terminate(id: string, orgId: string): Promise<AllianceDiplomacy> {
    const diplomacy = await this.findById(id, orgId);
    diplomacy.status = DiplomacyStatus.TERMINATED;
    diplomacy.endDate = new Date();
    await this.repository.save(diplomacy);

    diplomacyAuditLogger.logTerminated(diplomacy.id, diplomacy.orgId1, diplomacy.orgId2, orgId);

    return diplomacy;
  }

  async reportIncident(
    id: string,
    orgId: string,
    incident: {
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      reportedBy: string;
    }
  ): Promise<AllianceDiplomacy> {
    const diplomacy = await this.findById(id, orgId);

    const incidentId = crypto.randomUUID();
    diplomacy.incidents.push({
      incidentId,
      description: incident.description,
      severity: incident.severity,
      reportedBy: incident.reportedBy,
      timestamp: new Date(),
      resolved: false,
    });

    await this.repository.save(diplomacy);

    diplomacyAuditLogger.logIncidentReported(
      diplomacy.id,
      diplomacy.orgId1,
      diplomacy.orgId2,
      incidentId,
      incident.severity,
      incident.reportedBy
    );

    return diplomacy;
  }

  async resolveIncident(id: string, orgId: string, incidentId: string): Promise<AllianceDiplomacy> {
    const diplomacy = await this.findById(id, orgId);

    const incident = diplomacy.incidents.find(i => i.incidentId === incidentId);
    if (!incident) {
      throw new NotFoundError('Incident');
    }

    incident.resolved = true;
    await this.repository.save(diplomacy);

    diplomacyAuditLogger.logIncidentResolved(
      diplomacy.id,
      diplomacy.orgId1,
      diplomacy.orgId2,
      incidentId,
      orgId
    );

    return diplomacy;
  }
}

