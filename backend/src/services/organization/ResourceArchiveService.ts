import { AppDataSource } from '../../data-source';
import { Fleet } from '../../models/Fleet';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';

/**
 * Resource-level archive service
 *
 * Handles soft-delete archival for tenant-scoped resources (Fleets, etc.).
 * Extends the archive subsystem beyond organization-level archival provided
 * by OrganizationArchiveService.
 */
export class ResourceArchiveService {
  private static instance: ResourceArchiveService;
  private fleetRepository = AppDataSource.getRepository(Fleet);

  private constructor() {}

  public static getInstance(): ResourceArchiveService {
    if (!ResourceArchiveService.instance) {
      ResourceArchiveService.instance = new ResourceArchiveService();
    }
    return ResourceArchiveService.instance;
  }

  // ==================== FLEET ARCHIVAL ====================

  /**
   * Archive a fleet (soft delete)
   */
  public async archiveFleet(
    fleetId: string,
    organizationId: string,
    archivedBy: string,
    reason?: string
  ): Promise<Fleet> {
    const fleet = await this.fleetRepository.findOne({
      where: { id: fleetId, organizationId },
    });

    if (!fleet) {
      throw new Error('Fleet not found');
    }

    if (fleet.isArchived) {
      throw new Error('Fleet is already archived');
    }

    fleet.isArchived = true;
    fleet.archivedAt = new Date();
    fleet.archivedBy = archivedBy;
    fleet.archiveReason = reason;

    const archived = await this.fleetRepository.save(fleet);

    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: archivedBy,
      message: `Fleet archived: ${fleet.name}`,
      metadata: {
        fleetId,
        organizationId,
        fleetName: fleet.name,
        reason,
        action: 'archive',
      },
    });

    logger.info('Fleet archived', {
      fleetId,
      organizationId,
      fleetName: fleet.name,
      archivedBy,
      reason,
    });

    return archived;
  }

  /**
   * Restore an archived fleet
   */
  public async restoreFleet(
    fleetId: string,
    organizationId: string,
    restoredBy: string
  ): Promise<Fleet> {
    const fleet = await this.fleetRepository.findOne({
      where: { id: fleetId, organizationId },
    });

    if (!fleet) {
      throw new Error('Fleet not found');
    }

    if (!fleet.isArchived) {
      throw new Error('Fleet is not archived');
    }

    fleet.isArchived = false;
    fleet.archivedAt = undefined;
    fleet.archivedBy = undefined;
    fleet.archiveReason = undefined;
    fleet.restoredAt = new Date();
    fleet.restoredBy = restoredBy;

    const restored = await this.fleetRepository.save(fleet);

    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: restoredBy,
      message: `Fleet restored: ${fleet.name}`,
      metadata: {
        fleetId,
        organizationId,
        fleetName: fleet.name,
        action: 'restore',
      },
    });

    logger.info('Fleet restored', {
      fleetId,
      organizationId,
      fleetName: fleet.name,
      restoredBy,
    });

    return restored;
  }

  /**
   * Permanently delete an archived fleet
   * Only allows deletion of fleets archived for a minimum period
   */
  public async permanentlyDeleteFleet(
    fleetId: string,
    organizationId: string,
    deletedBy: string,
    minimumArchiveDays: number = 30
  ): Promise<void> {
    const fleet = await this.fleetRepository.findOne({
      where: { id: fleetId, organizationId },
    });

    if (!fleet) {
      throw new Error('Fleet not found');
    }

    if (!fleet.isArchived) {
      throw new Error('Fleet must be archived before permanent deletion');
    }

    if (fleet.archivedAt) {
      const daysSinceArchive = Math.floor(
        (Date.now() - fleet.archivedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceArchive < minimumArchiveDays) {
        throw new Error(
          `Fleet must be archived for at least ${minimumArchiveDays} days before permanent deletion. Currently archived for ${daysSinceArchive} days.`
        );
      }
    }

    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: deletedBy,
      message: `Fleet permanently deleted: ${fleet.name}`,
      metadata: {
        fleetId,
        organizationId,
        fleetName: fleet.name,
        action: 'permanent_delete',
      },
    });

    await this.fleetRepository.delete(fleetId);

    logger.warn('Fleet permanently deleted', {
      fleetId,
      organizationId,
      fleetName: fleet.name,
      deletedBy,
    });
  }

  /**
   * Get all archived fleets for an organization
   */
  public async getArchivedFleets(organizationId: string): Promise<Fleet[]> {
    return this.fleetRepository.find({
      where: { organizationId, isArchived: true },
      order: { archivedAt: 'DESC' },
    });
  }

  /**
   * Get archived fleet by ID
   */
  public async getArchivedFleetById(
    fleetId: string,
    organizationId: string
  ): Promise<Fleet | null> {
    return this.fleetRepository.findOne({
      where: { id: fleetId, organizationId, isArchived: true },
    });
  }

  /**
   * Count archived fleets for an organization
   */
  public async getArchivedFleetCount(organizationId: string): Promise<number> {
    return this.fleetRepository.count({
      where: { organizationId, isArchived: true },
    });
  }
}

