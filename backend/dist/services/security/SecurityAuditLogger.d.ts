import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum SecurityAuditAction {
    SECURITY_INCIDENT_REPORTED = "SECURITY_INCIDENT_REPORTED",
    SECURITY_VULNERABILITY_PATCHED = "SECURITY_VULNERABILITY_PATCHED",
    SUSPICIOUS_ACTIVITY_DETECTED = "SUSPICIOUS_ACTIVITY_DETECTED",
    BRUTE_FORCE_ATTEMPT = "BRUTE_FORCE_ATTEMPT",
    UNAUTHORIZED_ACCESS_ATTEMPT = "UNAUTHORIZED_ACCESS_ATTEMPT",
    API_KEY_ROTATED = "API_KEY_ROTATED",
    CERTIFICATE_RENEWED = "CERTIFICATE_RENEWED",
    SECURITY_AUDIT_RUN = "SECURITY_AUDIT_RUN"
}
export interface SecurityAuditEntry extends BaseDomainAuditEntry<SecurityAuditAction> {
    securityEventId: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description?: string;
    sourceIp?: string;
    targetResource?: string;
}
export declare class SecurityAuditLogger extends DomainAuditLogger<SecurityAuditAction, SecurityAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): SecurityAuditLogger;
    static resetInstance(): void;
    protected buildMessage(entry: SecurityAuditEntry): string;
    protected buildResource(entry: SecurityAuditEntry): string;
    logIncident(params: {
        organizationId: string;
        securityEventId: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        description?: string;
        sourceIp?: string;
        targetResource?: string;
        performedById?: string;
        performedByName?: string;
    }): void;
}
export declare const securityAuditLogger: SecurityAuditLogger;
//# sourceMappingURL=SecurityAuditLogger.d.ts.map