import { FindOptionsWhere, In } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { BlacklistSharingConfig } from '../../models/BlacklistSharingConfig';
import { MirrorAction } from '../../models/MirrorAction';
import {
  IncidentSeverity,
  IncidentStatus,
  ModerationIncident,
} from '../../models/ModerationIncident';
import {
  OrganizationRelationship,
  RelationshipStatus,
  RelationshipType,
} from '../../models/OrganizationRelationship';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';
import { emitToOrganization } from '../../websocket/websocketServer';
import { TenantService } from '../base/TenantService';
import { domainEvents } from '../shared/DomainEventBus';

/**
 * Audit event types for blacklist sharing
 */
export enum BlacklistSharingAuditAction {
  CONFIG_CREATED = 'BLACKLIST_CONFIG_CREATED',
  CONFIG_UPDATED = 'BLACKLIST_CONFIG_UPDATED',
  INCIDENT_SHARED_WITH_ALLIES = 'INCIDENT_SHARED_WITH_ALLIES',
  ALERT_SENT = 'BLACKLIST_ALERT_SENT',
}

/**
 * DTO for updating sharing configuration
 */
export interface UpdateSharingConfigDTO {
  shareWarnings?: boolean;
  shareTimeouts?: boolean;
  shareKicks?: boolean;
  shareBans?: boolean;
  receiveAlerts?: boolean;
  minAlertSeverity?: number;
  alertChannelId?: string | null;
  autoShareWithAllies?: boolean;
  autoShareMinSeverity?: number;
  autoEnforceEnabled?: boolean;
  autoEnforceTimeouts?: boolean;
  autoEnforceKicks?: boolean;
}

/**
 * Allied organization info for incident feed
 */
export interface AlliedOrgInfo {
  organizationId: string;
  organizationName?: string;
  relationshipType: RelationshipType;
}

/**
 * Incident with source organization info for feed
 */
export interface SharedIncident {
  incident: ModerationIncident;
  sourceOrganizationId: string;
  sourceOrganizationName?: string;
  isFromAlly: boolean;
}

/**
 * Result of checking a user across own and allied incidents
 */
export interface CrossAllianceCheckResult {
  ownIncidents: ModerationIncident[];
  alliedIncidents: SharedIncident[];
  totalIncidents: number;
  highestSeverity: IncidentSeverity;
  hasActiveIncident: boolean;
}

/**
 * BlacklistSharingService
 *
 * Manages blacklist sharing configuration and alliance-wide incident sharing.
 * Part of Phase 2: Cross-Discord Blacklist System - Alliance-Wide Sharing.
 *
 * Features:
 * - Configure sharing preferences per organization
 * - Share incidents with allied organizations
 * - Query incident feed from allies
 * - Real-time notifications via WebSocket
 */
export class BlacklistSharingService extends TenantService<BlacklistSharingConfig> {
  private static instance: BlacklistSharingService | null = null;
  private readonly relationshipRepository = AppDataSource.getRepository(OrganizationRelationship);
  private readonly incidentRepository = AppDataSource.getRepository(ModerationIncident);

  constructor() {
    super(AppDataSource.getRepository(BlacklistSharingConfig), {
      enableCache: true,
      cacheTTL: 600, // 10 minutes - config doesn't change often
      cacheCheckPeriod: 120,
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): BlacklistSharingService {
    if (!BlacklistSharingService.instance) {
      BlacklistSharingService.instance = new BlacklistSharingService();
    }
    return BlacklistSharingService.instance;
  }

  // ==================== CONFIGURATION MANAGEMENT ====================

  /**
   * Get sharing configuration for an organization
   * Creates default config if none exists
   */
  async getConfig(organizationId: string): Promise<BlacklistSharingConfig> {
    const whereClause: FindOptionsWhere<BlacklistSharingConfig> = { organizationId };
    let config = await this.findOne(organizationId, whereClause);

    if (!config) {
      // Create default configuration
      config = await this.createDefaultConfig(organizationId);
    }

    return config;
  }

  /**
   * Create default sharing configuration for an organization
   */
  private async createDefaultConfig(organizationId: string): Promise<BlacklistSharingConfig> {
    const config = await this.create(organizationId, {
      shareWarnings: false,
      shareTimeouts: true,
      shareKicks: true,
      shareBans: true,
      receiveAlerts: true,
      minAlertSeverity: 2,
      autoShareWithAllies: false,
      autoShareMinSeverity: 3,
    });

    logger.info(`Created default blacklist sharing config for org: ${organizationId}`);
    return config;
  }

  /**
   * Update sharing configuration
   */
  async updateConfig(
    organizationId: string,
    userId: string,
    userName: string,
    dto: UpdateSharingConfigDTO
  ): Promise<BlacklistSharingConfig> {
    // Get or create config
    const config = await this.getConfig(organizationId);

    // Validate severity values
    if (
      dto.minAlertSeverity !== undefined &&
      (dto.minAlertSeverity < 1 || dto.minAlertSeverity > 5)
    ) {
      throw new Error('minAlertSeverity must be between 1 and 5');
    }
    if (
      dto.autoShareMinSeverity !== undefined &&
      (dto.autoShareMinSeverity < 1 || dto.autoShareMinSeverity > 5)
    ) {
      throw new Error('autoShareMinSeverity must be between 1 and 5');
    }

    // Apply updates
    const updated = await this.update(
      organizationId,
      config.id,
      dto as Partial<BlacklistSharingConfig>
    );

    if (updated) {
      logAuditEvent({
        eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
        userId,
        username: userName,
        resource: `blacklist_sharing_config/${config.id}`,
        action: BlacklistSharingAuditAction.CONFIG_UPDATED,
        message: `Blacklist sharing config updated for org ${organizationId}`,
        metadata: { updates: Object.keys(dto) },
      });

      logger.info(`Blacklist sharing config updated for org: ${organizationId}`, {
        updatedBy: userName,
        changes: Object.keys(dto),
      });

      return updated;
    }

    return config;
  }

  // ==================== ALLIANCE MANAGEMENT ====================

  /**
   * Get allied organizations for an organization
   * Returns organizations with positive relationship types
   */
  async getAlliedOrganizations(organizationId: string): Promise<AlliedOrgInfo[]> {
    const positiveRelationshipTypes = [
      RelationshipType.ALLIED,
      RelationshipType.PARTNERSHIP,
      RelationshipType.COOPERATIVE,
      RelationshipType.AFFILIATED,
    ];

    const relationships = await this.relationshipRepository.find({
      where: [
        {
          organizationId,
          type: In(positiveRelationshipTypes),
          status: RelationshipStatus.ACTIVE,
          isMutual: true,
        },
        {
          targetOrganizationId: organizationId,
          type: In(positiveRelationshipTypes),
          status: RelationshipStatus.ACTIVE,
          isMutual: true,
        },
      ],
    });

    // Extract unique allied org IDs
    const alliedOrgs: AlliedOrgInfo[] = [];
    const seenOrgs = new Set<string>();

    for (const rel of relationships) {
      const alliedOrgId =
        rel.organizationId === organizationId ? rel.targetOrganizationId : rel.organizationId;

      if (!seenOrgs.has(alliedOrgId)) {
        seenOrgs.add(alliedOrgId);
        alliedOrgs.push({
          organizationId: alliedOrgId,
          relationshipType: rel.type,
        });
      }
    }

    return alliedOrgs;
  }

  // ==================== INCIDENT SHARING ====================

  /**
   * Share an incident with allied organizations based on config
   * Called when an incident is created or shared
   */
  async shareIncidentWithAllies(
    incident: ModerationIncident,
    organizationId: string,
    userId: string,
    userName: string
  ): Promise<string[]> {
    const config = await this.getConfig(organizationId);
    const sharedWithOrgIds: string[] = [];

    // Check if incident type should be shared
    if (!config.shouldShareIncidentType(incident.incidentType)) {
      logger.debug(`Incident type ${incident.incidentType} not configured for sharing`);
      return sharedWithOrgIds;
    }

    // Get allied organizations
    const allies = await this.getAlliedOrganizations(organizationId);

    if (allies.length === 0) {
      logger.debug(`No allied organizations for org ${organizationId}`);
      return sharedWithOrgIds;
    }

    // Notify each ally that has alerts enabled
    for (const ally of allies) {
      try {
        const allyConfig = await this.getConfig(ally.organizationId);

        // Check if ally wants to receive alerts for this severity
        if (allyConfig.shouldAlert(incident.severity)) {
          // Send WebSocket notification
          this.sendIncidentAlert(ally.organizationId, incident, organizationId);
          sharedWithOrgIds.push(ally.organizationId);

          // Wave 2.1 — emit shared moderation action for ally's audit trail
          domainEvents.emit('member:moderation_action', {
            timestamp: new Date().toISOString(),
            userId: incident.targetDiscordId,
            organizationId: ally.organizationId,
            incidentId: incident.id,
            incidentType: incident.incidentType,
            severity:
              typeof incident.severity === 'number'
                ? incident.severity
                : Number(incident.severity) || 5,
            moderatorId: incident.moderatorId,
            reason: incident.reason ?? undefined,
            isShared: true,
          });

          // Auto-enforce: if ally has auto-enforcement enabled for this type,
          // create a mirror action and execute it immediately (except bans)
          await this.tryAutoEnforce(allyConfig, ally.organizationId, incident, organizationId);
        }
      } catch (error: unknown) {
        logger.error(`Failed to notify ally ${ally.organizationId}:`, error);
      }
    }

    if (sharedWithOrgIds.length > 0) {
      logAuditEvent({
        eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
        userId,
        username: userName,
        resource: `moderation_incident/${incident.id}`,
        action: BlacklistSharingAuditAction.INCIDENT_SHARED_WITH_ALLIES,
        message: `Incident shared with ${sharedWithOrgIds.length} allied organizations`,
        metadata: {
          incidentId: incident.id,
          incidentType: incident.incidentType,
          severity: incident.severity,
          sharedWithCount: sharedWithOrgIds.length,
        },
      });

      logger.info(`Incident ${incident.id} shared with ${sharedWithOrgIds.length} allies`);
    }

    return sharedWithOrgIds;
  }

  /**
   * Send incident alert via WebSocket to an organization
   */
  private sendIncidentAlert(
    targetOrgId: string,
    incident: ModerationIncident,
    sourceOrgId: string
  ): void {
    const alertData = {
      type: 'BLACKLIST_INCIDENT_ALERT',
      data: {
        incidentId: incident.id,
        incidentType: incident.incidentType,
        severity: incident.severity,
        targetDiscordId: incident.targetDiscordId,
        targetUsername: incident.targetUsername,
        reason: incident.reason,
        sourceOrganizationId: sourceOrgId,
        guildName: incident.guildName,
        createdAt: incident.createdAt,
        isShared: true,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      emitToOrganization(targetOrgId, 'blacklist:incident', alertData);

      logAuditEvent({
        eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
        resource: `moderation_incident/${incident.id}`,
        action: BlacklistSharingAuditAction.ALERT_SENT,
        message: `Blacklist alert sent to org ${targetOrgId}`,
        metadata: {
          targetOrgId,
          incidentId: incident.id,
          severity: incident.severity,
        },
      });
    } catch (error: unknown) {
      logger.error(`Failed to send WebSocket alert to org ${targetOrgId}:`, error);
    }
  }

  /**
   * Attempt to auto-enforce a mirrored incident on the ally's guilds.
   * Only timeout and kick are auto-enforced; bans are always manual.
   */
  private async tryAutoEnforce(
    allyConfig: BlacklistSharingConfig,
    allyOrgId: string,
    incident: ModerationIncident,
    sourceOrgId: string
  ): Promise<void> {
    if (!allyConfig.shouldAutoEnforce(incident.incidentType)) {
      return;
    }

    try {
      // Lazy-import to avoid circular dependency
      const { GuildOrganizationService } = await import('./GuildOrganizationService');
      const { MirrorActionService } = await import('./MirrorActionService');
      const { MirrorEnforcementService } = await import('./MirrorEnforcementService');

      const guildOrgService = GuildOrganizationService.getInstance();
      const mirrorService = MirrorActionService.getInstance();
      const enforcementService = MirrorEnforcementService.getInstance();

      const guilds = await guildOrgService.getGuildsForOrganization(allyOrgId);
      if (guilds.length === 0) {
        logger.debug(`No guilds for org ${allyOrgId}, skipping auto-enforce`);
        return;
      }

      for (const guildMapping of guilds) {
        try {
          const result = await mirrorService.createMirrorAction(allyOrgId, {
            sourceIncidentId: incident.id,
            sourceOrganizationId: sourceOrgId,
            sourceGuildId: incident.guildId,
            sourceGuildName: incident.guildName,
            targetDiscordId: incident.targetDiscordId,
            targetUsername: incident.targetUsername,
            targetGuildId: guildMapping.guildId,
            targetGuildName: guildMapping.guildName,
            actionType: MirrorAction.actionTypeFromIncidentType(incident.incidentType),
            severity: incident.severity,
            reason: incident.reason,
            originalReason: incident.reason,
            durationMinutes: incident.durationMinutes,
            moderatorId: 'system',
            moderatorUsername: 'Auto-Enforce',
          });

          if (result.success && !result.requiresConfirmation) {
            await enforcementService.executeAction(allyOrgId, result.action);
          }
        } catch (error: unknown) {
          logger.error(
            `Auto-enforce failed for guild ${guildMapping.guildId} in org ${allyOrgId}:`,
            error
          );
        }
      }
    } catch (error: unknown) {
      logger.error(`Auto-enforce setup failed for org ${allyOrgId}:`, error);
    }
  }

  // ==================== INCIDENT FEED ====================

  /**
   * Get incident feed for moderators
   * Includes own incidents and shared incidents from allies
   */
  async getIncidentFeed(
    organizationId: string,
    options?: {
      page?: number;
      limit?: number;
      minSeverity?: IncidentSeverity;
      includeOwn?: boolean;
      includeShared?: boolean;
      status?: IncidentStatus;
    }
  ): Promise<{
    incidents: SharedIncident[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;
    const includeOwn = options?.includeOwn !== false;
    const includeShared = options?.includeShared !== false;

    // Build query
    const queryBuilder = this.incidentRepository.createQueryBuilder('incident');

    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    // Own incidents
    if (includeOwn) {
      conditions.push('incident.organizationId = :organizationId');
      params.organizationId = organizationId;
    }

    // Shared incidents from allies
    if (includeShared) {
      const allies = await this.getAlliedOrganizations(organizationId);
      const allyIds = allies.map(a => a.organizationId);

      if (allyIds.length > 0) {
        const allyCondition =
          '(incident.organizationId IN (:...allyIds) AND incident.isShared = true)';
        conditions.push(allyCondition);
        params.allyIds = allyIds;
      }
    }

    if (conditions.length === 0) {
      return {
        incidents: [],
        total: 0,
        page,
        totalPages: 0,
      };
    }

    queryBuilder.where(`(${conditions.join(' OR ')})`, params);
    queryBuilder.andWhere('incident.deletedAt IS NULL');

    // Apply filters
    if (options?.minSeverity) {
      queryBuilder.andWhere('incident.severity >= :minSeverity', {
        minSeverity: options.minSeverity,
      });
    }

    if (options?.status) {
      queryBuilder.andWhere('incident.status = :status', { status: options.status });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination and sorting
    queryBuilder.orderBy('incident.createdAt', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const incidents = await queryBuilder.getMany();

    // Transform to SharedIncident format
    const sharedIncidents: SharedIncident[] = incidents.map(incident => ({
      incident,
      sourceOrganizationId: incident.organizationId,
      isFromAlly: incident.organizationId !== organizationId,
    }));

    return {
      incidents: sharedIncidents,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Check a user across own and allied incidents
   * Returns incidents from own org and shared incidents from allies
   */
  async checkUserAcrossAllies(
    organizationId: string,
    targetDiscordId: string
  ): Promise<CrossAllianceCheckResult> {
    // Get own incidents
    const ownIncidents = await this.incidentRepository.find({
      where: {
        organizationId,
        targetDiscordId,
      },
      order: { createdAt: 'DESC' },
    });

    // Get allied incidents
    const allies = await this.getAlliedOrganizations(organizationId);
    const allyIds = allies.map(a => a.organizationId);

    let alliedIncidents: SharedIncident[] = [];

    if (allyIds.length > 0) {
      const sharedFromAllies = await this.incidentRepository.find({
        where: {
          organizationId: In(allyIds),
          targetDiscordId,
          isShared: true,
        },
        order: { createdAt: 'DESC' },
      });

      alliedIncidents = sharedFromAllies.map((incident: ModerationIncident) => ({
        incident,
        sourceOrganizationId: incident.organizationId,
        isFromAlly: true,
      }));
    }

    // Calculate summary stats
    const allIncidents = [...ownIncidents, ...alliedIncidents.map(ai => ai.incident)];
    let highestSeverity = IncidentSeverity.WARNING;
    let hasActiveIncident = false;

    for (const incident of allIncidents) {
      if (incident.severity > highestSeverity) {
        highestSeverity = incident.severity;
      }
      if (incident.status === IncidentStatus.ACTIVE) {
        hasActiveIncident = true;
      }
    }

    return {
      ownIncidents,
      alliedIncidents,
      totalIncidents: allIncidents.length,
      highestSeverity,
      hasActiveIncident,
    };
  }
}

