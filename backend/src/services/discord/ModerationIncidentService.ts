import { AppDataSource } from '../../data-source';
import {
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  ModerationIncident,
} from '../../models/ModerationIncident';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';
import { TenantService } from '../base/TenantService';

/**
 * Moderation incident audit event types
 */
export enum ModerationAuditAction {
  INCIDENT_CREATED = 'INCIDENT_CREATED',
  INCIDENT_UPDATED = 'INCIDENT_UPDATED',
  INCIDENT_REVOKED = 'INCIDENT_REVOKED',
  INCIDENT_SHARED = 'INCIDENT_SHARED',
  INCIDENT_UNSHARED = 'INCIDENT_UNSHARED',
  INCIDENT_AUTO_DETECTED = 'INCIDENT_AUTO_DETECTED',
  INCIDENT_EXPIRED = 'INCIDENT_EXPIRED',
}

/**
 * DTO for creating a new incident
 */
export interface CreateIncidentDTO {
  guildId: string;
  guildName?: string;
  targetDiscordId: string;
  targetUsername?: string;
  moderatorDiscordId?: string;
  moderatorUsername?: string;
  incidentType: IncidentType;
  reason?: string;
  durationMinutes?: number;
  isShared?: boolean;
  isAutoDetected?: boolean;
  discordAuditLogId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating an incident
 */
export interface UpdateIncidentDTO {
  reason?: string;
  isShared?: boolean;
  metadata?: Record<string, unknown>;
  status?: IncidentStatus;
}

/**
 * Search filters for incidents
 */
export interface IncidentSearchFilters {
  targetDiscordId?: string;
  guildId?: string;
  incidentType?: IncidentType;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  minSeverity?: IncidentSeverity;
  isShared?: boolean;
  isAutoDetected?: boolean;
  moderatorId?: string;
  searchTerm?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  includeExpired?: boolean;
  sortBy?: 'createdAt' | 'severity' | 'incidentType';
  sortOrder?: 'asc' | 'desc';
}

/**
 * User incident summary for lookup
 */
export interface UserIncidentSummary {
  targetDiscordId: string;
  targetUsername?: string;
  totalIncidents: number;
  activeIncidents: number;
  highestSeverity: IncidentSeverity;
  incidentsByType: Record<IncidentType, number>;
  incidentsBySeverity: Record<IncidentSeverity, number>;
  sharedIncidents: number;
  firstIncident?: Date;
  lastIncident?: Date;
  incidents: ModerationIncident[];
}

/**
 * Incident statistics
 */
export interface IncidentStatistics {
  totalIncidents: number;
  activeIncidents: number;
  revokedIncidents: number;
  expiredIncidents: number;
  sharedIncidents: number;
  autoDetectedIncidents: number;
  byType: Record<IncidentType, number>;
  bySeverity: Record<IncidentSeverity, number>;
  uniqueTargets: number;
  averageSeverity: number;
}

/**
 * ModerationIncidentService
 *
 * Core service for tracking moderation incidents across Discord servers.
 * Supports 5 severity levels: Warning, Timeout, Long Timeout, Kick, Ban.
 *
 * Features:
 * - Create, update, revoke incidents
 * - Automatic detection from Discord events
 * - Manual incident reporting
 * - User incident lookup and history
 * - Cross-organization sharing
 * - Comprehensive search and filtering
 * - Statistics and analytics
 *
 * MULTI-TENANCY: This service is tenant-aware and automatically filters incidents by organization.
 * CACHING: Enabled with 5-minute TTL for improved performance
 * AUDIT LOGGING: Comprehensive audit trail for all incident operations
 */
export class ModerationIncidentService extends TenantService<ModerationIncident> {
  private static instance: ModerationIncidentService | null = null;

  constructor() {
    super(AppDataSource.getRepository(ModerationIncident), {
      enableCache: true,
      cacheTTL: 300, // 5 minutes
      cacheCheckPeriod: 60, // 1 minute
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ModerationIncidentService {
    if (!ModerationIncidentService.instance) {
      ModerationIncidentService.instance = new ModerationIncidentService();
    }
    return ModerationIncidentService.instance;
  }

  /**
   * Log an incident audit event
   */
  private logIncidentAudit(
    action: ModerationAuditAction,
    incident: ModerationIncident,
    performedById: string,
    performedByName: string,
    details?: Record<string, unknown>
  ): void {
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: performedById,
      username: performedByName,
      resource: `moderation_incident/${incident.id}`,
      action,
      message: `Moderation ${action}: ${incident.incidentType} on ${incident.targetDiscordId}`,
      metadata: {
        incidentId: incident.id,
        incidentType: incident.incidentType,
        severity: incident.severity,
        targetDiscordId: incident.targetDiscordId,
        ...details,
      },
    });

    logger.debug('Moderation incident audit logged', {
      action,
      incidentId: incident.id,
      performedBy: performedByName,
    });
  }

  // ==================== CREATE INCIDENT ====================

  /**
   * Create a new moderation incident
   * @param organizationId - Organization creating the incident
   * @param moderatorId - Platform user ID of the moderator
   * @param moderatorName - Name of the moderator
   * @param dto - Incident data
   */
  async createIncident(
    organizationId: string,
    moderatorId: string,
    moderatorName: string,
    dto: CreateIncidentDTO
  ): Promise<ModerationIncident> {
    // Calculate severity from type and duration
    const severity = ModerationIncident.calculateSeverity(dto.incidentType, dto.durationMinutes);

    // Calculate expiration for timeouts
    let expiresAt: Date | undefined;
    if (dto.durationMinutes && dto.durationMinutes > 0) {
      expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + dto.durationMinutes);
    }

    const incident = await this.create(organizationId, {
      guildId: dto.guildId,
      guildName: dto.guildName,
      targetDiscordId: dto.targetDiscordId,
      targetUsername: dto.targetUsername,
      moderatorId,
      moderatorDiscordId: dto.moderatorDiscordId,
      moderatorUsername: dto.moderatorUsername || moderatorName,
      incidentType: dto.incidentType,
      severity,
      status: IncidentStatus.ACTIVE,
      reason: dto.reason,
      durationMinutes: dto.durationMinutes,
      isShared: dto.isShared || false,
      isAutoDetected: dto.isAutoDetected || false,
      discordAuditLogId: dto.discordAuditLogId,
      metadata: dto.metadata,
      expiresAt,
    });

    this.logIncidentAudit(
      dto.isAutoDetected
        ? ModerationAuditAction.INCIDENT_AUTO_DETECTED
        : ModerationAuditAction.INCIDENT_CREATED,
      incident,
      moderatorId,
      moderatorName,
      { severity, incidentType: dto.incidentType }
    );

    logger.info(
      `Moderation incident created: ${incident.id} (${dto.incidentType}) for ${dto.targetDiscordId}`,
      {
        organizationId,
        guildId: dto.guildId,
        severity,
        isAutoDetected: dto.isAutoDetected,
      }
    );

    return incident;
  }

  /**
   * Create incident from Discord event (auto-detection)
   */
  async createFromDiscordEvent(
    organizationId: string,
    systemUserId: string,
    guildId: string,
    guildName: string,
    targetDiscordId: string,
    targetUsername: string | undefined,
    moderatorDiscordId: string,
    moderatorUsername: string,
    incidentType: IncidentType,
    reason?: string,
    durationMinutes?: number,
    discordAuditLogId?: string
  ): Promise<ModerationIncident> {
    return this.createIncident(organizationId, systemUserId, 'System', {
      guildId,
      guildName,
      targetDiscordId,
      targetUsername,
      moderatorDiscordId,
      moderatorUsername,
      incidentType,
      reason,
      durationMinutes,
      isAutoDetected: true,
      discordAuditLogId,
    });
  }

  // ==================== GET INCIDENT ====================

  /**
   * Find an incident by its Discord audit-log entry ID (dedup check)
   */
  async findByAuditLogId(
    organizationId: string,
    auditLogId: string
  ): Promise<ModerationIncident | null> {
    return this.repository.findOne({
      where: {
        organizationId,
        discordAuditLogId: auditLogId,
      },
    });
  }

  /**
   * Get an incident by ID
   */
  async getIncidentById(
    organizationId: string,
    incidentId: string
  ): Promise<ModerationIncident | null> {
    return this.findById(organizationId, incidentId);
  }

  // ==================== UPDATE INCIDENT ====================

  /**
   * Update an incident
   */
  async updateIncident(
    organizationId: string,
    incidentId: string,
    userId: string,
    userName: string,
    dto: UpdateIncidentDTO
  ): Promise<ModerationIncident | null> {
    const incident = await this.findById(organizationId, incidentId);
    if (!incident) {
      return null;
    }

    const updated = await this.update(organizationId, incidentId, dto);

    if (updated) {
      this.logIncidentAudit(ModerationAuditAction.INCIDENT_UPDATED, updated, userId, userName, {
        updates: Object.keys(dto),
      });
    }

    return updated;
  }

  // ==================== REVOKE INCIDENT ====================

  /**
   * Revoke an active incident
   */
  async revokeIncident(
    organizationId: string,
    incidentId: string,
    userId: string,
    userName: string,
    reason?: string
  ): Promise<ModerationIncident | null> {
    const incident = await this.findById(organizationId, incidentId);
    if (!incident) {
      throw new Error('Incident not found');
    }

    if (incident.status !== IncidentStatus.ACTIVE) {
      throw new Error('Only active incidents can be revoked');
    }

    const updated = await this.update(organizationId, incidentId, {
      status: IncidentStatus.REVOKED,
      revokedBy: userId,
      revokedAt: new Date(),
      revokeReason: reason,
    });

    if (updated) {
      this.logIncidentAudit(ModerationAuditAction.INCIDENT_REVOKED, updated, userId, userName, {
        reason,
      });

      logger.info(`Moderation incident revoked: ${incidentId} by ${userName}`);
    }

    return updated;
  }

  // ==================== SHARE INCIDENT ====================

  /**
   * Share an incident with other organizations
   */
  async shareIncident(
    organizationId: string,
    incidentId: string,
    userId: string,
    userName: string
  ): Promise<ModerationIncident | null> {
    const incident = await this.findById(organizationId, incidentId);
    if (!incident) {
      return null;
    }

    if (incident.isShared) {
      return incident; // Already shared
    }

    const updated = await this.update(organizationId, incidentId, {
      isShared: true,
    });

    if (updated) {
      this.logIncidentAudit(ModerationAuditAction.INCIDENT_SHARED, updated, userId, userName);

      logger.info(`Moderation incident shared: ${incidentId} by ${userName}`);
    }

    return updated;
  }

  /**
   * Unshare an incident
   */
  async unshareIncident(
    organizationId: string,
    incidentId: string,
    userId: string,
    userName: string
  ): Promise<ModerationIncident | null> {
    const incident = await this.findById(organizationId, incidentId);
    if (!incident) {
      return null;
    }

    if (!incident.isShared) {
      return incident; // Already not shared
    }

    const updated = await this.update(organizationId, incidentId, {
      isShared: false,
    });

    if (updated) {
      this.logIncidentAudit(ModerationAuditAction.INCIDENT_UNSHARED, updated, userId, userName);
    }

    return updated;
  }

  // ==================== LOOKUP USER ====================

  /**
   * Look up a user's incident history
   */
  async lookupUser(
    organizationId: string,
    targetDiscordId: string,
    includeShared: boolean = true
  ): Promise<UserIncidentSummary> {
    const queryBuilder = this.repository.createQueryBuilder('incident');

    // Base query for own org's incidents
    queryBuilder.where('incident.organizationId = :organizationId', { organizationId });
    queryBuilder.andWhere('incident.targetDiscordId = :targetDiscordId', { targetDiscordId });
    queryBuilder.andWhere('incident.deletedAt IS NULL');

    // If including shared, also get shared incidents from other orgs
    if (includeShared) {
      queryBuilder.orWhere(
        'incident.isShared = true AND incident.targetDiscordId = :targetDiscordId',
        { targetDiscordId }
      );
    }

    queryBuilder.orderBy('incident.createdAt', 'DESC');

    const incidents = await queryBuilder.getMany();

    // Calculate summary
    const activeIncidents = incidents.filter(i => i.isActive());
    const incidentsByType = this.initializeByType();
    const incidentsBySeverity = this.initializeBySeverity();
    let highestSeverity = IncidentSeverity.WARNING;

    for (const incident of incidents) {
      incidentsByType[incident.incidentType]++;
      incidentsBySeverity[incident.severity]++;
      if (incident.severity > highestSeverity) {
        highestSeverity = incident.severity;
      }
    }

    return {
      targetDiscordId,
      targetUsername: incidents[0]?.targetUsername,
      totalIncidents: incidents.length,
      activeIncidents: activeIncidents.length,
      highestSeverity,
      incidentsByType,
      incidentsBySeverity,
      sharedIncidents: incidents.filter(i => i.isShared).length,
      firstIncident: incidents.length > 0 ? incidents[incidents.length - 1].createdAt : undefined,
      lastIncident: incidents.length > 0 ? incidents[0].createdAt : undefined,
      incidents,
    };
  }

  /**
   * Get shared incidents for a user (cross-organization lookup)
   */
  async getSharedIncidentsForUser(targetDiscordId: string): Promise<ModerationIncident[]> {
    return this.repository
      .createQueryBuilder('incident')
      .where('incident.targetDiscordId = :targetDiscordId', { targetDiscordId })
      .andWhere('incident.isShared = true')
      .andWhere('incident.status = :status', { status: IncidentStatus.ACTIVE })
      .andWhere('incident.deletedAt IS NULL')
      .orderBy('incident.severity', 'DESC')
      .addOrderBy('incident.createdAt', 'DESC')
      .getMany();
  }

  // ==================== SEARCH AND LIST ====================

  /**
   * Search incidents with filters
   */
  async searchIncidents(
    organizationId: string,
    filters: IncidentSearchFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ incidents: ModerationIncident[]; total: number; page: number; totalPages: number }> {
    const queryBuilder = this.repository.createQueryBuilder('incident');

    // Base filter by organization
    queryBuilder.where('incident.organizationId = :organizationId', { organizationId });
    queryBuilder.andWhere('incident.deletedAt IS NULL');

    // Target filter
    if (filters.targetDiscordId) {
      queryBuilder.andWhere('incident.targetDiscordId = :targetDiscordId', {
        targetDiscordId: filters.targetDiscordId,
      });
    }

    // Guild filter
    if (filters.guildId) {
      queryBuilder.andWhere('incident.guildId = :guildId', { guildId: filters.guildId });
    }

    // Type filter
    if (filters.incidentType) {
      queryBuilder.andWhere('incident.incidentType = :incidentType', {
        incidentType: filters.incidentType,
      });
    }

    // Severity filters
    if (filters.severity) {
      queryBuilder.andWhere('incident.severity = :severity', { severity: filters.severity });
    }
    if (filters.minSeverity) {
      queryBuilder.andWhere('incident.severity >= :minSeverity', {
        minSeverity: filters.minSeverity,
      });
    }

    // Status filter
    if (filters.status) {
      queryBuilder.andWhere('incident.status = :status', { status: filters.status });
    }

    // Shared filter
    if (filters.isShared !== undefined) {
      queryBuilder.andWhere('incident.isShared = :isShared', { isShared: filters.isShared });
    }

    // Auto-detected filter
    if (filters.isAutoDetected !== undefined) {
      queryBuilder.andWhere('incident.isAutoDetected = :isAutoDetected', {
        isAutoDetected: filters.isAutoDetected,
      });
    }

    // Moderator filter
    if (filters.moderatorId) {
      queryBuilder.andWhere('incident.moderatorId = :moderatorId', {
        moderatorId: filters.moderatorId,
      });
    }

    // Date range filters
    if (filters.createdAfter) {
      queryBuilder.andWhere('incident.createdAt >= :createdAfter', {
        createdAfter: filters.createdAfter,
      });
    }
    if (filters.createdBefore) {
      queryBuilder.andWhere('incident.createdAt <= :createdBefore', {
        createdBefore: filters.createdBefore,
      });
    }

    // Search term filter
    if (filters.searchTerm) {
      queryBuilder.andWhere(
        '(incident.targetUsername ILIKE :search OR incident.reason ILIKE :search OR incident.targetDiscordId ILIKE :search)',
        { search: `%${filters.searchTerm}%` }
      );
    }

    // Sorting
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    queryBuilder.orderBy(`incident.${sortBy}`, sortOrder);

    // Pagination
    const total = await queryBuilder.getCount();
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const incidents = await queryBuilder.getMany();

    return {
      incidents,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get incidents for a specific guild
   */
  async getGuildIncidents(
    organizationId: string,
    guildId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ incidents: ModerationIncident[]; total: number; page: number; totalPages: number }> {
    return this.searchIncidents(organizationId, { guildId }, page, limit);
  }

  /**
   * Get active incidents for organization
   */
  async getActiveIncidents(
    organizationId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ incidents: ModerationIncident[]; total: number; page: number; totalPages: number }> {
    return this.searchIncidents(organizationId, { status: IncidentStatus.ACTIVE }, page, limit);
  }

  // ==================== STATISTICS ====================

  /**
   * Get incident statistics for an organization
   */
  async getStatistics(organizationId: string): Promise<IncidentStatistics> {
    const incidents = await this.findAll(organizationId);

    const activeIncidents = incidents.filter(i => i.status === IncidentStatus.ACTIVE);
    const revokedIncidents = incidents.filter(i => i.status === IncidentStatus.REVOKED);
    const expiredIncidents = incidents.filter(i => i.status === IncidentStatus.EXPIRED);
    const sharedIncidents = incidents.filter(i => i.isShared);
    const autoDetectedIncidents = incidents.filter(i => i.isAutoDetected);

    const byType = this.initializeByType();
    const bySeverity = this.initializeBySeverity();

    let totalSeverity = 0;
    const uniqueTargets = new Set<string>();

    for (const incident of incidents) {
      byType[incident.incidentType]++;
      bySeverity[incident.severity]++;
      totalSeverity += incident.severity;
      uniqueTargets.add(incident.targetDiscordId);
    }

    return {
      totalIncidents: incidents.length,
      activeIncidents: activeIncidents.length,
      revokedIncidents: revokedIncidents.length,
      expiredIncidents: expiredIncidents.length,
      sharedIncidents: sharedIncidents.length,
      autoDetectedIncidents: autoDetectedIncidents.length,
      byType,
      bySeverity,
      uniqueTargets: uniqueTargets.size,
      averageSeverity: incidents.length > 0 ? totalSeverity / incidents.length : 0,
    };
  }

  // ==================== EXPIRATION ====================

  /**
   * Expire incidents that have passed their expiration date
   * This should be called periodically by a job scheduler
   */
  async expireIncidents(): Promise<number> {
    const now = new Date();

    const result = await this.repository
      .createQueryBuilder()
      .update(ModerationIncident)
      .set({ status: IncidentStatus.EXPIRED })
      .where('status = :status', { status: IncidentStatus.ACTIVE })
      .andWhere('expiresAt IS NOT NULL')
      .andWhere('expiresAt < :now', { now })
      .andWhere('deletedAt IS NULL')
      .execute();

    const count = result.affected || 0;
    if (count > 0) {
      logger.info(`Expired ${count} moderation incidents`);
    }

    return count;
  }

  // ==================== HELPER METHODS ====================

  private initializeByType(): Record<IncidentType, number> {
    return {
      [IncidentType.WARNING]: 0,
      [IncidentType.TIMEOUT]: 0,
      [IncidentType.LONG_TIMEOUT]: 0,
      [IncidentType.KICK]: 0,
      [IncidentType.BAN]: 0,
    };
  }

  private initializeBySeverity(): Record<IncidentSeverity, number> {
    return {
      [IncidentSeverity.WARNING]: 0,
      [IncidentSeverity.TIMEOUT]: 0,
      [IncidentSeverity.LONG_TIMEOUT]: 0,
      [IncidentSeverity.KICK]: 0,
      [IncidentSeverity.BAN]: 0,
    };
  }
}

