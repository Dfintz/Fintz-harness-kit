import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum IntelAuditAction {
    INTEL_REPORT_FILED = "INTEL_REPORT_FILED",
    INTEL_REPORT_UPDATED = "INTEL_REPORT_UPDATED",
    INTEL_REPORT_SHARED = "INTEL_REPORT_SHARED",
    INTEL_REPORT_ARCHIVED = "INTEL_REPORT_ARCHIVED",
    INTEL_SOURCE_VERIFIED = "INTEL_SOURCE_VERIFIED",
    INTEL_SOURCE_COMPROMISED = "INTEL_SOURCE_COMPROMISED",
    INTEL_BRIEFING_CREATED = "INTEL_BRIEFING_CREATED",
    INTEL_ANALYSIS_COMPLETED = "INTEL_ANALYSIS_COMPLETED"
}
export interface IntelAuditEntry extends BaseDomainAuditEntry<IntelAuditAction> {
    intelId: string;
    reportTitle: string;
    classificationLevel?: string;
    targetId?: string;
    sourceCount?: number;
}
export declare class IntelAuditLogger extends DomainAuditLogger<IntelAuditAction, IntelAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): IntelAuditLogger;
    static resetInstance(): void;
    protected buildMessage(entry: IntelAuditEntry): string;
    protected buildResource(entry: IntelAuditEntry): string;
    logReportFiled(params: {
        organizationId: string;
        intelId: string;
        reportTitle: string;
        classificationLevel?: string;
        targetId?: string;
        performedById?: string;
        performedByName?: string;
    }): void;
    logReportShared(params: {
        organizationId: string;
        intelId: string;
        reportTitle: string;
        sharedWith: string[];
        classificationLevel?: string;
        performedById?: string;
        performedByName?: string;
    }): void;
}
export declare const intelAuditLogger: IntelAuditLogger;
//# sourceMappingURL=IntelAuditLogger.d.ts.map