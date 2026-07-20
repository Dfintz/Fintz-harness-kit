import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum DiplomacyAuditAction {
    DIPLOMACY_PROPOSED = "DIPLOMACY_PROPOSED",
    DIPLOMACY_APPROVED = "DIPLOMACY_APPROVED",
    DIPLOMACY_SUSPENDED = "DIPLOMACY_SUSPENDED",
    DIPLOMACY_TERMINATED = "DIPLOMACY_TERMINATED",
    INCIDENT_REPORTED = "INCIDENT_REPORTED",
    INCIDENT_RESOLVED = "INCIDENT_RESOLVED"
}
export interface DiplomacyAuditEntry extends BaseDomainAuditEntry<DiplomacyAuditAction> {
    diplomacyId: string;
    orgId1: string;
    orgId2: string;
    allianceType?: string;
}
export declare class DiplomacyAuditLogger extends DomainAuditLogger<DiplomacyAuditAction, DiplomacyAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): DiplomacyAuditLogger;
    static resetInstance(): void;
    protected buildMessage(entry: DiplomacyAuditEntry): string;
    protected buildResource(entry: DiplomacyAuditEntry): string;
    logProposed(diplomacyId: string, orgId1: string, orgId2: string, allianceType: string, proposedById: string, proposedByName?: string): void;
    logApproved(diplomacyId: string, orgId1: string, orgId2: string, approvedById: string, approvedByName?: string): void;
    logSuspended(diplomacyId: string, orgId1: string, orgId2: string, suspendedByOrgId: string, performedById?: string): void;
    logTerminated(diplomacyId: string, orgId1: string, orgId2: string, terminatedByOrgId: string, performedById?: string): void;
    logIncidentReported(diplomacyId: string, orgId1: string, orgId2: string, incidentId: string, severity: string, reportedById: string): void;
    logIncidentResolved(diplomacyId: string, orgId1: string, orgId2: string, incidentId: string, resolvedByOrgId: string, performedById?: string): void;
}
export declare const diplomacyAuditLogger: DiplomacyAuditLogger;
//# sourceMappingURL=DiplomacyAuditLogger.d.ts.map