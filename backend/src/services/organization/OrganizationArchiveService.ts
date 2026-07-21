import { AppDataSource } from '../../data-source';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';

/**
 * Organization soft-delete and archival service
 * Issue #173: Implement organization soft-delete - Archive instead of hard delete
 */
export class OrganizationArchiveService {
  private static instance: OrganizationArchiveService;
  private organizationRepository = AppDataSource.getRepository(Organization);
  private userOrgRepository = AppDataSource.getRepository(OrganizationMembership);

  private constructor() {}

  public static getInstance(): OrganizationArchiveService {
    if (!OrganizationArchiveService.instance) {
      OrganizationArchiveService.instance = new OrganizationArchiveService();
    }
    return OrganizationArchiveService.instance;
  }

  /**
   * Archive an organization (soft delete)
   */
  public async archiveOrganization(
    organizationId: string,
    archivedBy: string,
    reason?: string
  ): Promise<Organization> {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    if (organization.isArchived) {
      throw new Error('Organization is already archived');
    }

    // Update organization with archive status
    organization.isArchived = true;
    organization.archivedAt = new Date();
    organization.archivedBy = archivedBy;
    organization.archiveReason = reason;

    const archived = await this.organizationRepository.save(organization);

    // Log the archive event
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: archivedBy,
      message: `Organization archived: ${organization.name}`,
      metadata: {
        organizationId,
        organizationName: organization.name,
        reason,
        action: 'archive',
      },
    });

    logger.info('Organization archived', {
      organizationId,
      organizationName: organization.name,
      archivedBy,
      reason,
    });

    return archived;
  }

  /**
   * Restore an archived organization
   */
  public async restoreOrganization(
    organizationId: string,
    restoredBy: string
  ): Promise<Organization> {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    if (!organization.isArchived) {
      throw new Error('Organization is not archived');
    }

    // Store previous archive info for audit
    const previousArchiveInfo = {
      archivedAt: organization.archivedAt,
      archivedBy: organization.archivedBy,
      archiveReason: organization.archiveReason,
    };

    // Clear archive status
    organization.isArchived = false;
    organization.archivedAt = undefined;
    organization.archivedBy = undefined;
    organization.archiveReason = undefined;
    organization.restoredAt = new Date();
    organization.restoredBy = restoredBy;

    const restored = await this.organizationRepository.save(organization);

    // Log the restore event
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: restoredBy,
      message: `Organization restored: ${organization.name}`,
      metadata: {
        organizationId,
        organizationName: organization.name,
        previousArchiveInfo,
        action: 'restore',
      },
    });

    logger.info('Organization restored', {
      organizationId,
      organizationName: organization.name,
      restoredBy,
    });

    return restored;
  }

  /**
   * Permanently delete an archived organization
   * Only allows deletion of organizations that have been archived for a minimum period
   */
  public async permanentlyDelete(
    organizationId: string,
    deletedBy: string,
    minimumArchiveDays: number = 30
  ): Promise<void> {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    if (!organization.isArchived) {
      throw new Error('Organization must be archived before permanent deletion');
    }

    // Check if minimum archive period has passed
    if (organization.archivedAt) {
      const daysSinceArchive = Math.floor(
        (Date.now() - organization.archivedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceArchive < minimumArchiveDays) {
        throw new Error(
          `Organization must be archived for at least ${minimumArchiveDays} days before permanent deletion. Currently archived for ${daysSinceArchive} days.`
        );
      }
    }

    // Delete all user-organization relationships
    await this.userOrgRepository.delete({ organizationId });

    // Log before deletion
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: deletedBy,
      message: `Organization permanently deleted: ${organization.name}`,
      metadata: {
        organizationId,
        organizationName: organization.name,
        action: 'permanent_delete',
      },
    });

    // Permanently delete the organization
    await this.organizationRepository.delete(organizationId);

    logger.warn('Organization permanently deleted', {
      organizationId,
      organizationName: organization.name,
      deletedBy,
    });
  }

  /**
   * Get all archived organizations
   */
  public async getArchivedOrganizations(): Promise<Organization[]> {
    return this.organizationRepository.find({
      where: { isArchived: true },
      order: { archivedAt: 'DESC' },
    });
  }

  /**
   * Get organizations pending permanent deletion
   * (archived for more than the specified days)
   */
  public async getOrganizationsPendingDeletion(
    minimumArchiveDays: number = 30
  ): Promise<Organization[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - minimumArchiveDays);

    return this.organizationRepository
      .createQueryBuilder('org')
      .where('org.isArchived = :isArchived', { isArchived: true })
      .andWhere('org.archivedAt <= :cutoffDate', { cutoffDate })
      .orderBy('org.archivedAt', 'ASC')
      .getMany();
  }

  /**
   * Schedule automatic permanent deletion of old archived organizations
   * This should be run as a scheduled job
   */
  public async cleanupOldArchivedOrganizations(
    daysBeforeDeletion: number = 90,
    systemUserId: string = 'system'
  ): Promise<number> {
    const organizationsToDelete = await this.getOrganizationsPendingDeletion(daysBeforeDeletion);

    let deletedCount = 0;
    for (const org of organizationsToDelete) {
      try {
        await this.permanentlyDelete(org.id, systemUserId, 0); // Skip minimum check since we already filtered
        deletedCount++;
      } catch (error: unknown) {
        logger.error('Failed to delete archived organization', {
          organizationId: org.id,
          error,
        });
      }
    }

    if (deletedCount > 0) {
      logger.info('Cleanup completed', {
        deletedCount,
        totalCandidates: organizationsToDelete.length,
      });
    }

    return deletedCount;
  }
}

