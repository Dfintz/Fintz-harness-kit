import { AuditCategory } from '../audit/AuditService';
import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * Diplomacy audit event types
 */
export enum DiplomacyAuditAction {
  // ── Lifecycle ───────────────────────────────────────
  DIPLOMACY_PROPOSED = 'DIPLOMACY_PROPOSED',
  DIPLOMACY_APPROVED = 'DIPLOMACY_APPROVED',
  DIPLOMACY_SUSPENDED = 'DIPLOMACY_SUSPENDED',
  DIPLOMACY_TERMINATED = 'DIPLOMACY_TERMINATED',

  // ── Incidents ───────────────────────────────────────
  INCIDENT_REPORTED = 'INCIDENT_REPORTED',
  INCIDENT_RESOLVED = 'INCIDENT_RESOLVED',
}

/**
 * Diplomacy audit log entry
 */
export interface DiplomacyAuditEntry extends BaseDomainAuditEntry<DiplomacyAuditAction> {
  diplomacyId: string;
  orgId1: string;
  orgId2: string;
  allianceType?: string;
}

/**
 * DiplomacyAuditLogger
 *
 * Domain-specific audit logger for Alliance Diplomacy operations.
 * Singleton with circular buffer and AuditService delegation.
 */
export class DiplomacyAuditLogger extends DomainAuditLogger<
  DiplomacyAuditAction,
  DiplomacyAuditEntry
> {
  private static instance: DiplomacyAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.DIPLOMACY,
      domainLabel: 'Diplomacy',
    });
  }

  static getInstance(): DiplomacyAuditLogger {
    if (!DiplomacyAuditLogger.instance) {
      DiplomacyAuditLogger.instance = new DiplomacyAuditLogger();
    }
    return DiplomacyAuditLogger.instance;
  }

  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      DiplomacyAuditLogger.instance = undefined as unknown as DiplomacyAuditLogger;
    }
  }

  protected buildMessage(entry: DiplomacyAuditEntry): string {
    return `Diplomacy ${entry.action}: ${entry.orgId1} <-> ${entry.orgId2}`;
  }

  protected buildResource(entry: DiplomacyAuditEntry): string {
    return `diplomacy/${entry.diplomacyId}`;
  }

  // ── Convenience methods ─────────────────────────────────────────────

  logProposed(
    diplomacyId: string,
    orgId1: string,
    orgId2: string,
    allianceType: string,
    proposedById: string,
    proposedByName?: string
  ): void {
    this.log({
      action: DiplomacyAuditAction.DIPLOMACY_PROPOSED,
      diplomacyId,
      orgId1,
      orgId2,
      allianceType,
      organizationId: orgId1,
      performedById: proposedById,
      performedByName: proposedByName,
      details: { allianceType, targetOrgId: orgId2 },
    });
  }

  logApproved(
    diplomacyId: string,
    orgId1: string,
    orgId2: string,
    approvedById: string,
    approvedByName?: string
  ): void {
    this.log({
      action: DiplomacyAuditAction.DIPLOMACY_APPROVED,
      diplomacyId,
      orgId1,
      orgId2,
      organizationId: orgId2,
      performedById: approvedById,
      performedByName: approvedByName,
      details: { proposingOrgId: orgId1 },
    });
  }

  logSuspended(
    diplomacyId: string,
    orgId1: string,
    orgId2: string,
    suspendedByOrgId: string,
    performedById?: string
  ): void {
    this.log({
      action: DiplomacyAuditAction.DIPLOMACY_SUSPENDED,
      diplomacyId,
      orgId1,
      orgId2,
      organizationId: suspendedByOrgId,
      performedById,
      details: {},
    });
  }

  logTerminated(
    diplomacyId: string,
    orgId1: string,
    orgId2: string,
    terminatedByOrgId: string,
    performedById?: string
  ): void {
    this.log({
      action: DiplomacyAuditAction.DIPLOMACY_TERMINATED,
      diplomacyId,
      orgId1,
      orgId2,
      organizationId: terminatedByOrgId,
      performedById,
      details: {},
    });
  }

  logIncidentReported(
    diplomacyId: string,
    orgId1: string,
    orgId2: string,
    incidentId: string,
    severity: string,
    reportedById: string
  ): void {
    this.log({
      action: DiplomacyAuditAction.INCIDENT_REPORTED,
      diplomacyId,
      orgId1,
      orgId2,
      organizationId: orgId1,
      performedById: reportedById,
      details: { incidentId, severity },
    });
  }

  logIncidentResolved(
    diplomacyId: string,
    orgId1: string,
    orgId2: string,
    incidentId: string,
    resolvedByOrgId: string,
    performedById?: string
  ): void {
    this.log({
      action: DiplomacyAuditAction.INCIDENT_RESOLVED,
      diplomacyId,
      orgId1,
      orgId2,
      organizationId: resolvedByOrgId,
      performedById,
      details: { incidentId },
    });
  }
}

/** Singleton instance for convenience imports */
export const diplomacyAuditLogger = DiplomacyAuditLogger.getInstance();

