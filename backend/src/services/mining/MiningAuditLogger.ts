import { AuditCategory } from '../audit/AuditService';
import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * Mining audit event types for comprehensive logging.
 * Tracks mining operations and resource harvesting.
 */
export enum MiningAuditAction {
  MINING_SESSION_STARTED = 'MINING_SESSION_STARTED',
  MINING_SESSION_ENDED = 'MINING_SESSION_ENDED',
  ORE_HARVESTED = 'ORE_HARVESTED',
  ORE_PROCESSED = 'ORE_PROCESSED',
  MINING_CLAIM_FILED = 'MINING_CLAIM_FILED',
  MINING_CLAIM_ABANDONED = 'MINING_CLAIM_ABANDONED',
  MINING_QUOTA_EXCEEDED = 'MINING_QUOTA_EXCEEDED',
  MINING_EQUIPMENT_DAMAGED = 'MINING_EQUIPMENT_DAMAGED',
}

/**
 * Mining audit log entry interface
 */
export interface MiningAuditEntry extends BaseDomainAuditEntry<MiningAuditAction> {
  miningSessionId: string;
  userId: string;
  locationId?: string;
  quantityHarvested?: number;
  resourceType?: string;
}

/**
 * MiningAuditLogger
 *
 * Domain-specific audit logger for mining operations.
 */
export class MiningAuditLogger extends DomainAuditLogger<MiningAuditAction, MiningAuditEntry> {
  private static instance: MiningAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.MINING,
      domainLabel: 'Mining',
    });
  }

  static getInstance(): MiningAuditLogger {
    if (!MiningAuditLogger.instance) {
      MiningAuditLogger.instance = new MiningAuditLogger();
    }
    return MiningAuditLogger.instance;
  }

  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      MiningAuditLogger.instance = undefined as unknown as MiningAuditLogger;
    }
  }

  protected buildMessage(entry: MiningAuditEntry): string {
    return `Mining ${entry.action}: User ${entry.userId} - Session ${entry.miningSessionId}`;
  }

  protected buildResource(entry: MiningAuditEntry): string {
    return `mining/${entry.miningSessionId}`;
  }

  logSessionStarted(params: {
    organizationId: string;
    miningSessionId: string;
    userId: string;
    locationId?: string;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: MiningAuditAction.MINING_SESSION_STARTED,
      miningSessionId: params.miningSessionId,
      userId: params.userId,
      locationId: params.locationId,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: {
        locationId: params.locationId,
      },
    });
  }

  logOreHarvested(params: {
    organizationId: string;
    miningSessionId: string;
    userId: string;
    quantityHarvested: number;
    resourceType: string;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: MiningAuditAction.ORE_HARVESTED,
      miningSessionId: params.miningSessionId,
      userId: params.userId,
      quantityHarvested: params.quantityHarvested,
      resourceType: params.resourceType,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: {
        quantityHarvested: params.quantityHarvested,
        resourceType: params.resourceType,
      },
    });
  }
}

export const miningAuditLogger = MiningAuditLogger.getInstance();

