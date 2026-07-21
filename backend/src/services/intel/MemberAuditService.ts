/**
 * MemberAuditService — Core flag engine for Membership Audit & Intel (Wave 2.1).
 *
 * Responsibilities:
 *  1. CRUD for MemberAuditEvent flags (create, list with filters, resolve/dismiss/escalate).
 *  2. Subscribe to DomainEventBus events and auto-create flags.
 *  3. Cross-reference joined RSI orgs against the OrgWatchlistEntry table
 *     to auto-elevate severity when a member joins a hostile/redacted org.
 *  4. Aggregate flag stats per user within an org.
 *
 * Consumers: IntelController (REST API in Phase C), upcoming WebSocket push.
 */

import {
  CreateManualFlagDto,
  CreateMemberFlagDto,
  DEFAULT_FLAG_SEVERITY,
  FlagSeverity,
  FlagStatus,
  ListFlagsQuery,
  MemberFlagSummary,
  MemberFlagType,
  ResolveFlagDto,
  UserFlagStats,
} from '@sc-fleet-manager/shared-types';
import { FindOptionsWhere, In, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { MemberAuditEvent } from '../../models/MemberAuditEvent';
import { OrgWatchlistEntry } from '../../models/OrgWatchlistEntry';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { emitToOrganization } from '../../websocket/websocketServer';
import {
  domainEvents,
  type ActivityCancelledPayload,
  type MemberDiscordLeftPayload,
  type MemberDiscordRoleChangedPayload,
  type MemberDiscordTimeoutPayload,
  type MemberDiscordUnlinkedPayload,
  type MemberPlatformLeftPayload,
  type ModerationActionPayload,
  type PrimaryOrgSwitchedPayload,
  type RsiHandleChangedPayload,
  type RsiOrgDissolvedPayload,
  type RsiOrgJoinedPayload,
  type RsiOrgLeftPayload,
  type RsiRankChangedPayload,
  type RsiSyncFailedPayload,
  type TeamDeletedPayload,
  type TeamMemberRemovedPayload,
} from '../shared/DomainEventBus';

/* ------------------------------------------------------------------ */
/*  Paginated result wrapper                                           */
/* ------------------------------------------------------------------ */

export interface PaginatedFlags {
  data: MemberFlagSummary[];
  pagination: {
    total: number;
    count: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    totalPages: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

export class MemberAuditService {
  private readonly flagRepo: Repository<MemberAuditEvent>;
  private readonly watchlistRepo: Repository<OrgWatchlistEntry>;
  private subscribed = false;

  constructor() {
    this.flagRepo = AppDataSource.getRepository(MemberAuditEvent);
    this.watchlistRepo = AppDataSource.getRepository(OrgWatchlistEntry);
  }

  /* ================================================================ */
  /*  Domain Event Subscriptions                                       */
  /* ================================================================ */

  /**
   * Wire up all DomainEventBus listeners.
   * Idempotent — safe to call more than once.
   */
  subscribeToEvents(): void {
    if (this.subscribed) {
      return;
    }
    this.subscribed = true;

    domainEvents.on('member:discord_left', p => this.onDiscordLeft(p));
    domainEvents.on('member:discord_role_changed', p => this.onDiscordRoleChanged(p));
    domainEvents.on('member:discord_timeout', p => this.onDiscordTimeout(p));
    domainEvents.on('member:rsi_org_left', p => this.onRsiOrgLeft(p));
    domainEvents.on('member:rsi_org_joined', p => this.onRsiOrgJoined(p));
    domainEvents.on('member:rsi_rank_changed', p => this.onRsiRankChanged(p));
    domainEvents.on('member:moderation_action', p => this.onModerationAction(p));
    domainEvents.on('member:primary_org_switched', p => this.onPrimaryOrgSwitched(p));
    domainEvents.on('member:platform_left', p => this.onPlatformLeft(p));
    domainEvents.on('member:rsi_sync_failed', p => this.onRsiSyncFailed(p));
    domainEvents.on('member:rsi_handle_changed', p => this.onRsiHandleChanged(p));
    domainEvents.on('member:rsi_org_dissolved', p => this.onRsiOrgDissolved(p));
    domainEvents.on('member:discord_unlinked', p => this.onDiscordUnlinked(p));

    // Wave 2 cross-system events
    domainEvents.on('team:member_removed', p => this.onTeamMemberRemoved(p));
    domainEvents.on('team:deleted', p => this.onTeamDeleted(p));
    domainEvents.on('activity:cancelled', p => this.onActivityCancelled(p));

    logger.info('MemberAuditService: subscribed to 16 domain events');
  }

  /* ---------- Event handlers (private) ---------- */

  private async onDiscordLeft(p: MemberDiscordLeftPayload): Promise<void> {
    let severity: FlagSeverity;
    if (p.reason === 'ban') {
      severity = FlagSeverity.CRITICAL;
    } else if (p.reason === 'kick') {
      severity = FlagSeverity.HIGH;
    } else {
      severity = DEFAULT_FLAG_SEVERITY[MemberFlagType.DISCORD_LEFT];
    }

    await this.createFlag({
      userId: p.userId,
      organizationId: p.organizationId,
      flagType: MemberFlagType.DISCORD_LEFT,
      severity,
      description: `Member left Discord server "${p.guildName}" (${p.reason ?? 'unknown reason'})`,
      metadata: {
        discordId: p.discordId,
        discordUsername: p.discordUsername,
        guildId: p.guildId,
        guildName: p.guildName,
        reason: p.reason,
      },
    });
  }

  private async onDiscordRoleChanged(p: MemberDiscordRoleChangedPayload): Promise<void> {
    await this.createFlag({
      userId: p.userId,
      organizationId: p.organizationId,
      flagType: MemberFlagType.DISCORD_ROLE_CHANGED,
      description: this.buildRoleChangeDescription(p),
      metadata: {
        discordId: p.discordId,
        guildId: p.guildId,
        addedRoles: [...p.addedRoles],
        removedRoles: [...p.removedRoles],
      },
    });
  }

  private async onDiscordTimeout(p: MemberDiscordTimeoutPayload): Promise<void> {
    // Timeouts are tracked via moderation_action — only create a
    // standalone flag if there's no associated incident yet.
    await this.createFlag({
      userId: p.userId,
      organizationId: p.organizationId,
      flagType: MemberFlagType.MODERATION_ACTION_RECEIVED,
      severity: FlagSeverity.HIGH,
      description: this.buildTimeoutDescription(p),
      metadata: {
        discordId: p.discordId,
        guildId: p.guildId,
        guildName: p.guildName,
        durationMinutes: p.durationMinutes,
        moderatorDiscordId: p.moderatorDiscordId,
        reason: p.reason,
        source: 'discord_timeout',
      },
    });
  }

  private async onRsiOrgLeft(p: RsiOrgLeftPayload): Promise<void> {
    await this.createFlag({
      userId: p.userId,
      organizationId: p.organizationId,
      flagType: MemberFlagType.RSI_ORG_LEFT,
      description: `Left RSI organization "${p.rsiOrgName}" [${p.rsiOrgSid}]`,
      metadata: {
        rsiHandle: p.rsiHandle,
        rsiOrgSid: p.rsiOrgSid,
        rsiOrgName: p.rsiOrgName,
      },
    });
  }

  private async onRsiOrgJoined(p: RsiOrgJoinedPayload): Promise<void> {
    // Watchlist now tracks citizens, not orgs — org-level flags are
    // triggered by isHostile/isRedacted from the RSI sync only.

    if (p.isHostile) {
      await this.createFlag({
        userId: p.userId,
        organizationId: p.organizationId,
        flagType: MemberFlagType.JOINED_HOSTILE_ORG,
        severity: FlagSeverity.CRITICAL,
        description: `Joined hostile RSI organization "${p.rsiOrgName}" [${p.rsiOrgSid}]`,
        metadata: {
          rsiHandle: p.rsiHandle,
          rsiOrgSid: p.rsiOrgSid,
          rsiOrgName: p.rsiOrgName,
        },
      });
    } else if (p.isRedacted) {
      await this.createFlag({
        userId: p.userId,
        organizationId: p.organizationId,
        flagType: MemberFlagType.JOINED_REDACTED_ORG,
        severity: FlagSeverity.HIGH,
        description: `Joined redacted RSI organization "${p.rsiOrgName}" [${p.rsiOrgSid}]`,
        metadata: {
          rsiHandle: p.rsiHandle,
          rsiOrgSid: p.rsiOrgSid,
          rsiOrgName: p.rsiOrgName,
        },
      });
    }
    // If neither hostile nor redacted — no flag
  }

  private async onRsiRankChanged(p: RsiRankChangedPayload): Promise<void> {
    await this.createFlag({
      userId: p.userId,
      organizationId: p.organizationId,
      flagType: MemberFlagType.RSI_RANK_CHANGED,
      description: `RSI rank changed from "${p.oldRank}" to "${p.newRank}" in [${p.rsiOrgSid}]`,
      metadata: {
        rsiHandle: p.rsiHandle,
        rsiOrgSid: p.rsiOrgSid,
        oldRank: p.oldRank,
        newRank: p.newRank,
      },
    });
  }

  private async onModerationAction(p: ModerationActionPayload): Promise<void> {
    const flagType = p.isShared
      ? MemberFlagType.MODERATION_ACTION_SHARED
      : MemberFlagType.MODERATION_ACTION_RECEIVED;

    const severity = this.moderationSeverityToFlag(p.severity);

    await this.createFlag({
      userId: p.userId,
      organizationId: p.organizationId,
      flagType,
      severity,
      description: this.buildModerationDescription(p),
      metadata: {
        incidentId: p.incidentId,
        incidentType: p.incidentType,
        moderationSeverity: p.severity,
        moderatorId: p.moderatorId,
        isShared: p.isShared,
      },
      relatedEntityId: p.incidentId,
      relatedEntityType: 'moderation_incident',
    });
  }

  private async onPrimaryOrgSwitched(p: PrimaryOrgSwitchedPayload): Promise<void> {
    // Emit flag to the PREVIOUS org (they're the ones who care)
    if (p.previousOrgId) {
      await this.createFlag({
        userId: p.userId,
        organizationId: p.previousOrgId,
        flagType: MemberFlagType.PRIMARY_ORG_SWITCHED,
        description: `Member switched primary organization away from this org`,
        metadata: {
          previousOrgId: p.previousOrgId,
          newOrgId: p.newOrgId,
        },
      });
    }
  }

  private async onPlatformLeft(p: MemberPlatformLeftPayload): Promise<void> {
    await this.createFlag({
      userId: p.userId,
      organizationId: p.organizationId,
      flagType: MemberFlagType.PLATFORM_LEFT,
      description: `Member "${p.username}" left the platform`,
      metadata: {
        username: p.username,
      },
    });
  }

  /* ─────── P0: RSI sync failure ──────────────────────────────────── */

  private async onRsiSyncFailed(p: RsiSyncFailedPayload): Promise<void> {
    // Only auto-flag after 3+ consecutive failures to avoid transient noise
    if (p.consecutiveFailures < 3) {
      return;
    }

    const isAccountGone = p.failureReason === 'account_not_found';
    const severity = isAccountGone ? FlagSeverity.CRITICAL : FlagSeverity.HIGH;
    const desc = isAccountGone
      ? `RSI account "${p.rsiHandle}" appears to be deleted (${p.consecutiveFailures} consecutive sync failures)`
      : `RSI sync failing for "${p.rsiHandle}" — ${p.failureReason} (${p.consecutiveFailures} consecutive failures)`;

    await this.createFlag({
      userId: p.userId,
      organizationId: p.organizationId,
      flagType: MemberFlagType.RSI_SYNC_FAILED,
      severity,
      description: desc,
      metadata: {
        rsiHandle: p.rsiHandle,
        failureReason: p.failureReason,
        consecutiveFailures: p.consecutiveFailures,
      },
    });
  }

  /* ─────── P0: RSI handle / name changed ─────────────────────────── */

  private async onRsiHandleChanged(p: RsiHandleChangedPayload): Promise<void> {
    await this.createFlag({
      userId: p.userId,
      organizationId: p.organizationId,
      flagType: MemberFlagType.RSI_HANDLE_CHANGED,
      description: `RSI handle changed from "${p.oldHandle}" to "${p.newHandle}"`,
      metadata: {
        oldHandle: p.oldHandle,
        newHandle: p.newHandle,
        rsiOrgSid: p.rsiOrgSid,
      },
    });
  }

  /* ─────── P1: RSI org dissolved ─────────────────────────────────── */

  private async onRsiOrgDissolved(p: RsiOrgDissolvedPayload): Promise<void> {
    // Create a flag per affected user
    for (const userId of p.affectedUserIds) {
      await this.createFlag({
        userId,
        organizationId: p.organizationId,
        flagType: MemberFlagType.RSI_ORG_DISSOLVED,
        description: `RSI organization "${p.rsiOrgName}" [${p.rsiOrgSid}] no longer exists`,
        metadata: {
          rsiOrgSid: p.rsiOrgSid,
          rsiOrgName: p.rsiOrgName,
          totalAffected: p.affectedUserIds.length,
        },
      });
    }
  }

  /* ─────── P2: Discord unlinked ──────────────────────────────────── */

  private async onDiscordUnlinked(p: MemberDiscordUnlinkedPayload): Promise<void> {
    await this.createFlag({
      userId: p.userId,
      organizationId: p.organizationId,
      flagType: MemberFlagType.DISCORD_UNLINKED,
      description: `Member unlinked Discord account (${p.discordUsername ?? p.discordId})`,
      metadata: {
        discordId: p.discordId,
        discordUsername: p.discordUsername,
      },
    });
  }

  /* ─────── Wave 2 cross-system events ──────────────────────────────── */

  private async onTeamMemberRemoved(p: TeamMemberRemovedPayload): Promise<void> {
    const severity = p.reason === 'platform_left' ? FlagSeverity.MEDIUM : FlagSeverity.INFO;

    await this.createFlag({
      userId: p.userId,
      organizationId: p.organizationId,
      flagType: MemberFlagType.TEAM_MEMBER_REMOVED,
      severity,
      description: p.reason
        ? `Member removed from team "${p.teamName}" (${p.reason})`
        : `Member removed from team "${p.teamName}"`,
      metadata: {
        teamId: p.teamId,
        teamName: p.teamName,
        reason: p.reason,
      },
    });
  }

  private async onTeamDeleted(p: TeamDeletedPayload): Promise<void> {
    // Only flag if team had active members — empty team deletion is unremarkable
    if (p.memberCount === 0) {
      return;
    }

    await this.createFlag({
      userId: 'system',
      organizationId: p.organizationId,
      flagType: MemberFlagType.TEAM_DELETED_WITH_MEMBERS,
      description: `Team "${p.teamName}" deleted with ${p.memberCount} active member${p.memberCount === 1 ? '' : 's'}`,
      metadata: {
        teamId: p.teamId,
        teamName: p.teamName,
        memberCount: p.memberCount,
      },
    });
  }

  private async onActivityCancelled(p: ActivityCancelledPayload): Promise<void> {
    await this.createFlag({
      userId: 'system',
      organizationId: p.organizationId,
      flagType: MemberFlagType.ACTIVITY_CANCELLED,
      description: [
        'Activity cancelled',
        p.reason ? `: ${p.reason}` : '',
        ` (${p.participantCount} participant${p.participantCount === 1 ? '' : 's'} affected)`,
      ].join(''),
      metadata: {
        activityId: p.activityId,
        reason: p.reason,
        participantCount: p.participantCount,
      },
    });
  }

  /* ================================================================ */
  /*  CRUD Operations                                                  */
  /* ================================================================ */

  /**
   * Create a system-generated flag.
   * Uses `DEFAULT_FLAG_SEVERITY` when no severity is provided.
   */
  async createFlag(dto: CreateMemberFlagDto): Promise<MemberAuditEvent> {
    const flag = this.flagRepo.create({
      userId: dto.userId,
      organizationId: dto.organizationId,
      flagType: dto.flagType,
      severity: dto.severity ?? DEFAULT_FLAG_SEVERITY[dto.flagType],
      status: FlagStatus.OPEN,
      description: dto.description,
      metadata: dto.metadata,
      relatedEntityId: dto.relatedEntityId,
      relatedEntityType: dto.relatedEntityType,
      isAutoGenerated: dto.isAutoGenerated ?? true,
    });

    const saved = await this.flagRepo.save(flag);

    logger.info('MemberAuditService: flag created', {
      flagId: saved.id,
      flagType: saved.flagType,
      severity: saved.severity,
      organizationId: saved.organizationId,
      userId: saved.userId,
    });

    // F6 — Push real-time WebSocket event to the org
    try {
      emitToOrganization(saved.organizationId, 'intel:flag:created', {
        id: saved.id,
        userId: saved.userId,
        flagType: saved.flagType,
        severity: saved.severity,
        status: saved.status,
        description: saved.description,
        isAutoGenerated: saved.isAutoGenerated,
        createdAt: saved.createdAt.toISOString(),
      });
    } catch {
      // WebSocket may not be initialised in test/CLI contexts
    }

    return saved;
  }

  /**
   * Create a manual flag (by an intel officer).
   */
  async createManualFlag(
    organizationId: string,
    targetUserId: string,
    officerId: string,
    dto: CreateManualFlagDto
  ): Promise<MemberAuditEvent> {
    return this.createFlag({
      userId: targetUserId,
      organizationId,
      flagType: MemberFlagType.MANUAL,
      severity: dto.severity,
      description: dto.description,
      metadata: {
        ...dto.metadata,
        createdByOfficer: officerId,
      },
      isAutoGenerated: false,
    });
  }

  /**
   * Get a single flag by ID (scoped to organization).
   */
  async getFlagById(organizationId: string, flagId: string): Promise<MemberAuditEvent | null> {
    return this.flagRepo.findOne({
      where: { id: flagId, organizationId },
    });
  }

  /**
   * List flags with optional filters + pagination.
   */
  async listFlags(organizationId: string, query: ListFlagsQuery = {}): Promise<PaginatedFlags> {
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(Math.max(query.pageSize ?? 25, 1), 100);
    const skip = (page - 1) * pageSize;

    try {
      const where: FindOptionsWhere<MemberAuditEvent> = { organizationId };

      if (query.userId) {
        where.userId = query.userId;
      }
      if (query.statuses?.length) {
        where.status = In(query.statuses);
      }
      if (query.flagTypes?.length) {
        where.flagType = In(query.flagTypes);
      }
      if (query.severities?.length) {
        where.severity = In(query.severities);
      }
      if (query.isAutoGenerated !== undefined) {
        where.isAutoGenerated = query.isAutoGenerated;
      }

      const qb = this.flagRepo.createQueryBuilder('flag').where(where);

      // Date range filters
      if (query.dateFrom) {
        qb.andWhere('flag.createdAt >= :dateFrom', { dateFrom: query.dateFrom });
      }
      if (query.dateTo) {
        qb.andWhere('flag.createdAt <= :dateTo', { dateTo: query.dateTo });
      }

      // Sorting (allowlist to prevent SQL injection)
      const sortBy = query.sortBy ?? 'createdAt';
      const sortOrder = query.sortOrder ?? 'DESC';
      const ALLOWED_SORT = new Set([
        'createdAt',
        'updatedAt',
        'flagType',
        'severity',
        'status',
        'userId',
      ]);
      const safeSortBy = ALLOWED_SORT.has(sortBy) ? sortBy : 'createdAt';
      qb.orderBy(`flag.${safeSortBy}`, sortOrder);

      // Pagination
      const [items, total] = await qb.skip(skip).take(pageSize).getManyAndCount();
      const totalPages = Math.ceil(total / pageSize);

      return {
        data: items.map(f => this.toSummary(f)),
        pagination: {
          total,
          count: items.length,
          page,
          pageSize,
          hasMore: page < totalPages,
          totalPages,
        },
      };
    } catch (err: unknown) {
      logger.error('MemberAuditService.listFlags failed', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        organizationId,
      });
      return {
        data: [],
        pagination: {
          total: 0,
          count: 0,
          page,
          pageSize,
          hasMore: false,
          totalPages: 0,
        },
      };
    }
  }

  /**
   * Resolve, dismiss, or escalate a flag.
   */
  async resolveFlag(
    organizationId: string,
    flagId: string,
    officerId: string,
    dto: ResolveFlagDto
  ): Promise<MemberAuditEvent> {
    const flag = await this.flagRepo.findOne({
      where: { id: flagId, organizationId },
    });

    if (!flag) {
      throw new NotFoundError('Flag not found');
    }

    if (!flag.isOpen()) {
      throw new ValidationError(`Flag is already ${flag.status}`);
    }

    flag.status = dto.status;
    flag.resolvedBy = officerId;
    flag.resolvedAt = new Date();
    flag.resolutionNote = dto.resolutionNote;

    const saved = await this.flagRepo.save(flag);

    logger.info('MemberAuditService: flag resolved', {
      flagId: saved.id,
      newStatus: saved.status,
      resolvedBy: officerId,
      organizationId,
    });

    return saved;
  }

  /**
   * Get aggregated flag stats for a user within an organization.
   */
  async getUserFlagStats(organizationId: string, userId: string): Promise<UserFlagStats> {
    try {
      const flags = await this.flagRepo.find({
        where: { organizationId, userId },
        select: ['severity', 'status', 'createdAt'],
        order: { createdAt: 'DESC' },
      });

      let highestSeverityWeight = 0;
      let highestSeverity: FlagSeverity | null = null;

      const counts = {
        openFlags: 0,
        resolvedFlags: 0,
        dismissedFlags: 0,
        escalatedFlags: 0,
      };

      for (const flag of flags) {
        if (flag.status === FlagStatus.OPEN) {
          counts.openFlags++;
        } else if (flag.status === FlagStatus.RESOLVED) {
          counts.resolvedFlags++;
        } else if (flag.status === FlagStatus.DISMISSED) {
          counts.dismissedFlags++;
        } else if (flag.status === FlagStatus.ESCALATED) {
          counts.escalatedFlags++;
        }

        const weight = MemberAuditEvent.prototype.getSeverityWeight.call(flag);
        if (weight > highestSeverityWeight) {
          highestSeverityWeight = weight;
          highestSeverity = flag.severity;
        }
      }

      return {
        userId,
        organizationId,
        totalFlags: flags.length,
        ...counts,
        highestSeverity,
        lastFlagAt: flags.length > 0 ? flags[0].createdAt.toISOString() : null,
      };
    } catch (err: unknown) {
      logger.error('MemberAuditService.getUserFlagStats failed', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        organizationId,
        userId,
      });
      return {
        userId,
        organizationId,
        totalFlags: 0,
        openFlags: 0,
        resolvedFlags: 0,
        dismissedFlags: 0,
        escalatedFlags: 0,
        highestSeverity: null,
        lastFlagAt: null,
      };
    }
  }

  /* ================================================================ */
  /*  Watchlist Cross-Reference                                        */
  /* ================================================================ */

  /**
   * Look up a watchlist entry for a given RSI handle within the org.
   */
  private async findWatchlistEntry(
    organizationId: string,
    rsiHandle: string
  ): Promise<OrgWatchlistEntry | null> {
    return this.watchlistRepo.findOne({
      where: { organizationId, rsiHandle },
    });
  }

  /* ================================================================ */
  /*  Private helpers                                                   */
  /* ================================================================ */

  /**
   * Map numeric moderation severity (1-10) to FlagSeverity.
   */
  private moderationSeverityToFlag(numericSeverity: number): FlagSeverity {
    if (numericSeverity >= 8) {
      return FlagSeverity.CRITICAL;
    }
    if (numericSeverity >= 5) {
      return FlagSeverity.HIGH;
    }
    if (numericSeverity >= 3) {
      return FlagSeverity.MEDIUM;
    }
    return FlagSeverity.INFO;
  }

  /**
   * Build a role-change description from the payload.
   */
  private buildTimeoutDescription(p: MemberDiscordTimeoutPayload): string {
    const base = `Discord timeout (${p.durationMinutes} min) in ${p.guildName}`;
    return p.reason ? `${base} — ${p.reason}` : base;
  }

  private buildModerationDescription(p: ModerationActionPayload): string {
    const prefix = p.isShared ? 'Shared moderation' : 'Moderation';
    const base = `${prefix} action: ${p.incidentType}`;
    return p.reason ? `${base} — ${p.reason}` : base;
  }

  private buildRoleChangeDescription(p: MemberDiscordRoleChangedPayload): string {
    const parts: string[] = [];
    if (p.addedRoles.length > 0) {
      parts.push(`added: ${p.addedRoles.length} role(s)`);
    }
    if (p.removedRoles.length > 0) {
      parts.push(`removed: ${p.removedRoles.length} role(s)`);
    }
    return `Discord role change — ${parts.join(', ')}`;
  }

  /**
   * Map a MemberAuditEvent entity to the API summary DTO.
   */
  public toSummary(flag: MemberAuditEvent): MemberFlagSummary {
    return {
      id: flag.id,
      userId: flag.userId,
      organizationId: flag.organizationId,
      flagType: flag.flagType,
      severity: flag.severity,
      status: flag.status,
      description: flag.description,
      metadata: flag.metadata,
      relatedEntityId: flag.relatedEntityId,
      relatedEntityType: flag.relatedEntityType,
      isAutoGenerated: flag.isAutoGenerated,
      createdAt: flag.createdAt.toISOString(),
      resolvedAt: flag.resolvedAt?.toISOString(),
      resolvedBy: flag.resolvedBy,
      resolutionNote: flag.resolutionNote,
    };
  }
}

