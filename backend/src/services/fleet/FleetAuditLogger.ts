import { AppDataSource } from '../../config/database';
import { FleetAuditLog } from '../../models/FleetAuditLog';
import { logger } from '../../utils/logger';
import { AuditCategory } from '../audit/AuditService';
import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * Fleet audit event types for comprehensive logging.
 * Follows the ActivityAuditLogger pattern — domain-specific enum with
 * delegation to the centralized AuditService facade.
 */
export enum FleetAuditAction {
  // ── Fleet Lifecycle ─────────────────────────────────
  FLEET_CREATED = 'FLEET_CREATED',
  FLEET_UPDATED = 'FLEET_UPDATED',
  FLEET_DELETED = 'FLEET_DELETED',
  FLEET_ARCHIVED = 'FLEET_ARCHIVED',
  FLEET_RESTORED = 'FLEET_RESTORED',

  // ── Ship Assignment ─────────────────────────────────
  SHIP_ADDED_TO_FLEET = 'SHIP_ADDED_TO_FLEET',
  SHIP_REMOVED_FROM_FLEET = 'SHIP_REMOVED_FROM_FLEET',
  SHIPS_BULK_ADDED = 'SHIPS_BULK_ADDED',

  // ── Hierarchy / Nesting ─────────────────────────────
  FLEET_NESTED = 'FLEET_NESTED',
  FLEET_UNNESTED = 'FLEET_UNNESTED',
  FLEET_REORDERED = 'FLEET_REORDERED',

  // ── Team Lifecycle ──────────────────────────────────
  FLEET_TEAM_CREATED = 'FLEET_TEAM_CREATED',
  FLEET_TEAM_CAPACITY_UPDATED = 'FLEET_TEAM_CAPACITY_UPDATED',
  FLEET_TEAM_REPARENTED = 'FLEET_TEAM_REPARENTED',
  FLEET_TEAM_DELETED = 'FLEET_TEAM_DELETED',

  // ── Crew Position Changes ──────────────────────────
  CREW_MEMBER_ASSIGNED = 'CREW_MEMBER_ASSIGNED',
  CREW_MEMBER_UNASSIGNED = 'CREW_MEMBER_UNASSIGNED',
  CREW_MEMBER_UNAVAILABLE = 'CREW_MEMBER_UNAVAILABLE',
  CREW_POSITION_SELECTED = 'CREW_POSITION_SELECTED',
  CREW_POSITION_VACATED = 'CREW_POSITION_VACATED',

  // ── Health Gate Events ──────────────────────────────
  FLEET_GATE_PASSED = 'FLEET_GATE_PASSED',
  FLEET_GATE_FAILED = 'FLEET_GATE_FAILED',
}

/**
 * Crew fill impact metadata attached to audit events that affect crew readiness.
 */
export interface CrewFillImpact {
  readonly filledBefore: number;
  readonly filledAfter: number;
  readonly required: number;
  readonly rateBefore: number;
  readonly rateAfter: number;
}

/**
 * Fleet audit log entry interface
 */
export interface FleetAuditEntry extends BaseDomainAuditEntry<FleetAuditAction> {
  fleetId: string;
  fleetName: string;
}

/**
 * FleetAuditLogger
 *
 * Domain-specific audit logger for Fleet services.
 * Delegates to the centralized AuditService facade for Winston logging
 * while maintaining a local circular buffer for fleet-specific queries.
 *
 * Follows the ActivityAuditLogger pattern (singleton, circular buffer,
 * AuditService delegation).
 */
export class FleetAuditLogger extends DomainAuditLogger<FleetAuditAction, FleetAuditEntry> {
  private static instance: FleetAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.FLEET,
      domainLabel: 'Fleet',
    });
  }

  static getInstance(): FleetAuditLogger {
    if (!FleetAuditLogger.instance) {
      FleetAuditLogger.instance = new FleetAuditLogger();
    }
    return FleetAuditLogger.instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      FleetAuditLogger.instance = undefined as unknown as FleetAuditLogger;
    }
  }

  protected buildMessage(entry: FleetAuditEntry): string {
    return `Fleet ${entry.action}: ${entry.fleetName}`;
  }

  protected buildResource(entry: FleetAuditEntry): string {
    return `fleet/${entry.fleetId}`;
  }

  /**
   * Log a fleet audit event.
   * Overrides base to include fleet-specific metadata in the AuditService call
   * and persist to the fleet_audit_logs table for durability across restarts.
   */
  override log(entry: Omit<FleetAuditEntry, 'timestamp'>): void {
    // The base class handles circular buffer + AuditService delegation,
    // but we add fleet-specific metadata to the details.
    const enriched = {
      ...entry,
      details: {
        ...entry.details,
        fleetId: entry.fleetId,
        fleetName: entry.fleetName,
      },
    };
    super.log(enriched);

    // Persist to PostgreSQL (fire-and-forget — never block the caller)
    this.persistToDatabase(entry).catch(err => {
      logger.warn('Failed to persist fleet audit log to database', {
        action: entry.action,
        fleetId: entry.fleetId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  /**
   * Persist a fleet audit entry to the fleet_audit_logs table.
   */
  private async persistToDatabase(entry: Omit<FleetAuditEntry, 'timestamp'>): Promise<void> {
    if (!AppDataSource.isInitialized) {
      return;
    }

    const repo = AppDataSource.getRepository(FleetAuditLog);
    const record = repo.create({
      action: entry.action,
      fleetId: entry.fleetId,
      fleetName: entry.fleetName,
      organizationId: entry.organizationId,
      performedById: entry.performedById ?? undefined,
      performedByName: entry.performedByName ?? undefined,
      details: entry.details,
    });
    await repo.save(record);
  }

  // ── Convenience methods ─────────────────────────────────────────────

  logShipAdded(
    organizationId: string,
    fleetId: string,
    fleetName: string,
    shipId: string,
    shipName: string,
    performedById?: string,
    performedByName?: string
  ): void {
    this.log({
      action: FleetAuditAction.SHIP_ADDED_TO_FLEET,
      fleetId,
      fleetName,
      organizationId,
      performedById,
      performedByName,
      details: { shipId, shipName },
    });
  }

  logShipRemoved(params: {
    organizationId: string;
    fleetId: string;
    fleetName: string;
    shipId: string;
    shipName: string;
    crewFillImpact?: CrewFillImpact;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: FleetAuditAction.SHIP_REMOVED_FROM_FLEET,
      fleetId: params.fleetId,
      fleetName: params.fleetName,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: {
        shipId: params.shipId,
        shipName: params.shipName,
        ...(params.crewFillImpact && { crewFillImpact: params.crewFillImpact }),
      },
    });
  }

  logFleetNested(
    organizationId: string,
    childFleetId: string,
    childFleetName: string,
    parentFleetId: string,
    parentFleetName: string,
    performedById?: string,
    performedByName?: string
  ): void {
    this.log({
      action: FleetAuditAction.FLEET_NESTED,
      fleetId: childFleetId,
      fleetName: childFleetName,
      organizationId,
      performedById,
      performedByName,
      details: { parentFleetId, parentFleetName },
    });
  }

  logFleetUnnested(
    organizationId: string,
    childFleetId: string,
    childFleetName: string,
    previousParentFleetId: string,
    previousParentFleetName: string,
    performedById?: string,
    performedByName?: string
  ): void {
    this.log({
      action: FleetAuditAction.FLEET_UNNESTED,
      fleetId: childFleetId,
      fleetName: childFleetName,
      organizationId,
      performedById,
      performedByName,
      details: { previousParentFleetId, previousParentFleetName },
    });
  }

  logCrewMemberUnavailable(params: {
    organizationId: string;
    fleetId: string;
    fleetName: string;
    memberId: string;
    memberName: string;
    previousStatus: string;
    newStatus: string;
    crewFillImpact?: CrewFillImpact;
  }): void {
    this.log({
      action: FleetAuditAction.CREW_MEMBER_UNAVAILABLE,
      fleetId: params.fleetId,
      fleetName: params.fleetName,
      organizationId: params.organizationId,
      details: {
        memberId: params.memberId,
        memberName: params.memberName,
        previousStatus: params.previousStatus,
        newStatus: params.newStatus,
        ...(params.crewFillImpact && { crewFillImpact: params.crewFillImpact }),
      },
    });
  }

  logGateChange(
    organizationId: string,
    fleetId: string,
    fleetName: string,
    passed: boolean,
    gate: string,
    crewFillImpact: CrewFillImpact,
    trigger: string
  ): void {
    this.log({
      action: passed ? FleetAuditAction.FLEET_GATE_PASSED : FleetAuditAction.FLEET_GATE_FAILED,
      fleetId,
      fleetName,
      organizationId,
      details: {
        gate,
        trigger,
        crewFillImpact,
      },
    });
  }

  logTeamCreated(
    organizationId: string,
    fleetId: string,
    fleetName: string,
    teamId: string,
    teamName: string,
    maxMembers: number
  ): void {
    this.log({
      action: FleetAuditAction.FLEET_TEAM_CREATED,
      fleetId,
      fleetName,
      organizationId,
      details: { teamId, teamName, maxMembers },
    });
  }

  logTeamCapacityUpdated(params: {
    organizationId: string;
    fleetId: string;
    fleetName: string;
    teamId: string;
    previousCapacity: number;
    newCapacity: number;
    totalCrewPositions: number;
    standbySlots: number;
  }): void {
    this.log({
      action: FleetAuditAction.FLEET_TEAM_CAPACITY_UPDATED,
      fleetId: params.fleetId,
      fleetName: params.fleetName,
      organizationId: params.organizationId,
      details: {
        teamId: params.teamId,
        previousCapacity: params.previousCapacity,
        newCapacity: params.newCapacity,
        totalCrewPositions: params.totalCrewPositions,
        standbySlots: params.standbySlots,
      },
    });
  }

  // ── Query methods ───────────────────────────────────────────────────

  /**
   * Get filtered fleet audit log entries from the database.
   * Falls back to the in-memory circular buffer when the DB is unavailable.
   */
  async getFleetAuditLog(options?: {
    fleetId?: string;
    organizationId?: string;
    action?: FleetAuditAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<FleetAuditEntry[]> {
    // Try the database first for durable results
    if (AppDataSource.isInitialized) {
      try {
        return await this.queryFromDatabase(options);
      } catch (err: unknown) {
        logger.warn('Fleet audit DB query failed, falling back to in-memory buffer', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Fallback: in-memory circular buffer
    return this.getAuditLog({
      organizationId: options?.organizationId,
      action: options?.action,
      startDate: options?.startDate,
      endDate: options?.endDate,
      limit: options?.limit,
      filter: options?.fleetId ? e => e.fleetId === options.fleetId : undefined,
    });
  }

  /**
   * Query persisted audit logs from the fleet_audit_logs table.
   */
  private async queryFromDatabase(options?: {
    fleetId?: string;
    organizationId?: string;
    action?: FleetAuditAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<FleetAuditEntry[]> {
    const repo = AppDataSource.getRepository(FleetAuditLog);
    const qb = repo.createQueryBuilder('log');

    if (options?.fleetId) {
      qb.andWhere('log.fleetId = :fleetId', { fleetId: options.fleetId });
    }
    if (options?.organizationId) {
      qb.andWhere('log.organizationId = :organizationId', {
        organizationId: options.organizationId,
      });
    }
    if (options?.action) {
      qb.andWhere('log.action = :action', { action: options.action });
    }
    if (options?.startDate) {
      qb.andWhere('log.createdAt >= :startDate', { startDate: options.startDate });
    }
    if (options?.endDate) {
      qb.andWhere('log.createdAt <= :endDate', { endDate: options.endDate });
    }

    qb.orderBy('log.createdAt', 'DESC');
    qb.take(options?.limit ?? 100);

    const rows = await qb.getMany();

    return rows.map(row => ({
      action: row.action as FleetAuditAction,
      fleetId: row.fleetId,
      fleetName: row.fleetName,
      organizationId: row.organizationId,
      performedById: row.performedById,
      performedByName: row.performedByName,
      details: row.details,
      timestamp: row.createdAt,
    }));
  }
}

/** Singleton instance for convenience imports */
export const fleetAuditLogger = FleetAuditLogger.getInstance();

