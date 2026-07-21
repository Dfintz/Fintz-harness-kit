import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AppDataSource } from '../../data-source';
import { IntelAuditAction, IntelAuditLog } from '../../models/IntelAuditLog';
import { IntelAccessLevel } from '../../models/IntelEntry';
import { IntelOfficer, IntelOfficerRank } from '../../models/IntelOfficer';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';

export interface AppointOfficerInput {
  organizationId: string;
  userId: string;
  rank: IntelOfficerRank;
  accessLevel: IntelAccessLevel;
  specializations?: string[];
  notes?: string;
}

export interface UpdateOfficerInput {
  rank?: IntelOfficerRank;
  accessLevel?: IntelAccessLevel;
  specializations?: string[];
  notes?: string;
  isActive?: boolean;
}

/**
 * Service for managing Intel officers
 */
export class IntelOfficerService {
  private readonly intelOfficerRepo: Repository<IntelOfficer>;
  private readonly auditLogRepo: Repository<IntelAuditLog>;
  private readonly userOrgRepo: Repository<OrganizationMembership>;

  constructor() {
    this.intelOfficerRepo = AppDataSource.getRepository(IntelOfficer);
    this.auditLogRepo = AppDataSource.getRepository(IntelAuditLog);
    this.userOrgRepo = AppDataSource.getRepository(OrganizationMembership);
  }

  /**
   * Check if user can manage Intel officers (must be org owner)
   */
  async canManageOfficers(userId: string, organizationId: string): Promise<boolean> {
    try {
      const userOrg = await this.userOrgRepo.findOne({
        where: { userId, organizationId, isActive: true },
      });

      return getRoleName(userOrg?.role) === 'owner' || getRoleName(userOrg?.role) === 'founder';
    } catch (error: unknown) {
      logger.error('Error checking officer management permission:', error);
      return false;
    }
  }

  /**
   * Appoint an Intel officer
   */
  async appointOfficer(
    input: AppointOfficerInput,
    appointedBy: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelOfficer> {
    try {
      // Check if appointer is org owner
      const canManage = await this.canManageOfficers(appointedBy, input.organizationId);
      if (!canManage) {
        throw new ForbiddenError('Only organization owner can appoint Intel officers');
      }

      // Check if target user is member of org
      const targetUserOrg = await this.userOrgRepo.findOne({
        where: {
          userId: input.userId,
          organizationId: input.organizationId,
          isActive: true,
        },
        relations: ['user'],
      });

      if (!targetUserOrg) {
        throw new ValidationError('Target user is not a member of this organization');
      }

      // Check if already an Intel officer
      const existing = await this.intelOfficerRepo.findOne({
        where: {
          userId: input.userId,
          organizationId: input.organizationId,
        },
      });

      if (existing) {
        if (existing.isActive) {
          throw new ConflictError('User is already an active Intel officer');
        }
        // Reactivate if previously deactivated
        existing.isActive = true;
        existing.rank = input.rank;
        existing.accessLevel = input.accessLevel;
        existing.specializations = input.specializations?.join(',');
        existing.notes = input.notes;
        existing.appointedBy = appointedBy;
        existing.revokedBy = undefined;
        existing.revokedAt = undefined;

        const updated = await this.intelOfficerRepo.save(existing);

        await this.logAudit({
          organizationId: input.organizationId,
          userId: appointedBy,
          action: IntelAuditAction.OFFICER_APPOINTED,
          description: `Reappointed ${targetUserOrg.user?.username ?? targetUserOrg.userId} as Intel officer`,
          ipAddress,
          userAgent,
          severity: 'info',
          metadata: {
            officerId: existing.id,
            targetUserId: input.userId,
            rank: input.rank,
            accessLevel: input.accessLevel,
          },
        });

        return updated;
      }

      // Validate rank limitations
      await this.validateRankLimitations(input.organizationId, input.rank);

      const officer = this.intelOfficerRepo.create({
        id: uuidv4(),
        organizationId: input.organizationId,
        userId: input.userId,
        rank: input.rank,
        accessLevel: input.accessLevel,
        specializations: input.specializations?.join(','),
        notes: input.notes,
        appointedBy,
        isActive: true,
      });

      const saved = await this.intelOfficerRepo.save(officer);

      // Log activity
      await this.logAudit({
        organizationId: input.organizationId,
        userId: appointedBy,
        action: IntelAuditAction.OFFICER_APPOINTED,
        description: `Appointed ${targetUserOrg.user?.username ?? input.userId} as Intel officer`,
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: {
          officerId: saved.id,
          targetUserId: input.userId,
          rank: input.rank,
          accessLevel: input.accessLevel,
        },
      });

      logger.info('Intel officer appointed', {
        officerId: saved.id,
        organizationId: input.organizationId,
        userId: input.userId,
        rank: input.rank,
      });

      return saved;
    } catch (error: unknown) {
      logger.error('Error appointing Intel officer:', error);
      throw error;
    }
  }

  /**
   * Validate rank limitations (e.g., only one CHIEF per org)
   */
  private async validateRankLimitations(
    organizationId: string,
    rank: IntelOfficerRank
  ): Promise<void> {
    if (rank === IntelOfficerRank.CHIEF) {
      const existingChief = await this.intelOfficerRepo.findOne({
        where: {
          organizationId,
          rank: IntelOfficerRank.CHIEF,
          isActive: true,
        },
      });

      if (existingChief) {
        throw new ConflictError('Organization can only have one Chief Intel officer');
      }
    }
  }

  /**
   * Update Intel officer
   */
  async updateOfficer(
    officerId: string,
    userId: string,
    organizationId: string,
    input: UpdateOfficerInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelOfficer> {
    try {
      const officer = await this.intelOfficerRepo.findOne({
        where: { id: officerId, organizationId },
        relations: ['user'],
      });

      if (!officer) {
        throw new NotFoundError('Intel officer');
      }

      // Check permission
      const canManage = await this.canManageOfficers(userId, organizationId);
      if (!canManage) {
        throw new ForbiddenError('Only organization owner can update Intel officers');
      }

      // Validate rank change
      if (input.rank && input.rank !== officer.rank) {
        await this.validateRankLimitations(organizationId, input.rank);
      }

      // Track changes
      const oldValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};
      let action = IntelAuditAction.OFFICER_ACCESS_CHANGED;

      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined && (officer as unknown as Record<string, unknown>)[key] !== value) {
          oldValues[key] = (officer as unknown as Record<string, unknown>)[key];
          newValues[key] = value;

          if (key === 'rank') {
            const oldRankValue = getRankValue(officer.rank);
            const newRankValue = getRankValue(value as IntelOfficerRank);
            action =
              newRankValue > oldRankValue
                ? IntelAuditAction.OFFICER_PROMOTED
                : IntelAuditAction.OFFICER_DEMOTED;
          }
        }
      }

      if (input.specializations) {
        officer.specializations = input.specializations.join(',');
      }

      Object.assign(officer, {
        rank: input.rank,
        accessLevel: input.accessLevel,
        notes: input.notes,
        isActive: input.isActive,
      });

      const updated = await this.intelOfficerRepo.save(officer);

      // Log activity
      await this.logAudit({
        organizationId,
        userId,
        action,
        description: `Updated Intel officer ${officer.user?.username ?? officer.userId}`,
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: {
          officerId,
          changes: Object.keys(newValues),
          oldValues,
          newValues,
        },
      });

      logger.info('Intel officer updated', {
        officerId,
        organizationId,
        changes: Object.keys(newValues),
      });

      return updated;
    } catch (error: unknown) {
      logger.error('Error updating Intel officer:', error);
      throw error;
    }
  }

  /**
   * Remove/revoke Intel officer
   */
  async removeOfficer(
    officerId: string,
    userId: string,
    organizationId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const officer = await this.intelOfficerRepo.findOne({
        where: { id: officerId, organizationId },
        relations: ['user'],
      });

      if (!officer) {
        throw new NotFoundError('Intel officer');
      }

      // Check permission
      const canManage = await this.canManageOfficers(userId, organizationId);
      if (!canManage) {
        throw new ForbiddenError('Only organization owner can remove Intel officers');
      }

      officer.isActive = false;
      officer.revokedBy = userId;
      officer.revokedAt = new Date();
      if (reason) {
        const prefix = officer.notes ? `${officer.notes}\n` : '';
        officer.notes = `${prefix}Revoked: ${reason}`;
      }

      await this.intelOfficerRepo.save(officer);

      // Log activity
      await this.logAudit({
        organizationId,
        userId,
        action: IntelAuditAction.OFFICER_REMOVED,
        description: `Removed Intel officer ${officer.user?.username ?? officer.userId}`,
        ipAddress,
        userAgent,
        severity: 'warning',
        metadata: {
          officerId,
          targetUserId: officer.userId,
          reason,
        },
      });

      logger.info('Intel officer removed', {
        officerId,
        organizationId,
        targetUserId: officer.userId,
      });
    } catch (error: unknown) {
      logger.error('Error removing Intel officer:', error);
      throw error;
    }
  }

  /**
   * Get all Intel officers for organization
   */
  async getOfficers(
    organizationId: string,
    userId: string,
    options: {
      includeInactive?: boolean;
      rank?: IntelOfficerRank;
    } = {}
  ): Promise<IntelOfficer[]> {
    try {
      // Check if user has access (must be owner or Intel officer)
      const userOrg = await this.userOrgRepo.findOne({
        where: { userId, organizationId },
      });

      const isOwner =
        getRoleName(userOrg?.role) === 'owner' || getRoleName(userOrg?.role) === 'founder';
      const isOfficer = await this.intelOfficerRepo.findOne({
        where: { userId, organizationId, isActive: true },
      });

      if (!isOwner && !isOfficer) {
        throw new ForbiddenError('User does not have access to view Intel officers');
      }

      const queryBuilder = this.intelOfficerRepo
        .createQueryBuilder('officer')
        .leftJoin('officer.user', 'user')
        .addSelect(['user.id', 'user.username'])
        .where('officer.organizationId = :organizationId', { organizationId });

      if (!options.includeInactive) {
        queryBuilder.andWhere('officer.isActive = :isActive', { isActive: true });
      }

      if (options.rank) {
        queryBuilder.andWhere('officer.rank = :rank', { rank: options.rank });
      }

      queryBuilder.orderBy('officer.appointedAt', 'ASC');

      return await queryBuilder.getMany();
    } catch (error: unknown) {
      logger.error('Error getting Intel officers:', error);
      throw error;
    }
  }

  /**
   * Get single Intel officer
   */
  async getOfficer(
    officerId: string,
    userId: string,
    organizationId: string
  ): Promise<IntelOfficer> {
    try {
      const officer = await this.intelOfficerRepo.findOne({
        where: { id: officerId, organizationId },
      });

      if (!officer) {
        throw new NotFoundError('Intel officer');
      }

      // Check access
      const userOrg = await this.userOrgRepo.findOne({
        where: { userId, organizationId },
      });

      const isOwner =
        getRoleName(userOrg?.role) === 'owner' || getRoleName(userOrg?.role) === 'founder';
      const isOfficer = await this.intelOfficerRepo.findOne({
        where: { userId, organizationId, isActive: true },
      });

      if (!isOwner && !isOfficer) {
        throw new ForbiddenError('User does not have access to view Intel officers');
      }

      return officer;
    } catch (error: unknown) {
      logger.error('Error getting Intel officer:', error);
      throw error;
    }
  }

  /**
   * Log audit entry
   */
  private async logAudit(data: {
    organizationId: string;
    userId: string;
    action: IntelAuditAction;
    description?: string;
    ipAddress?: string;
    userAgent?: string;
    severity?: 'info' | 'warning' | 'critical';
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const auditLog = this.auditLogRepo.create({
        id: uuidv4(),
        ...data,
        severity: data.severity || 'info',
      });

      await this.auditLogRepo.save(auditLog);
    } catch (error: unknown) {
      logger.error('Error logging Intel audit:', error);
    }
  }
}

/**
 * Helper function to get numeric rank value for comparison
 */
function getRankValue(rank: IntelOfficerRank): number {
  const rankValues = {
    [IntelOfficerRank.JUNIOR]: 1,
    [IntelOfficerRank.OFFICER]: 2,
    [IntelOfficerRank.SENIOR]: 3,
    [IntelOfficerRank.LEAD]: 4,
    [IntelOfficerRank.CHIEF]: 5,
  };
  return rankValues[rank] || 0;
}

