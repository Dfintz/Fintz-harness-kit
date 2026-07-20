export declare enum AuditCategory {
    AUTHENTICATION = "AUTHENTICATION",
    AUTHORIZATION = "AUTHORIZATION",
    DATA_ACCESS = "DATA_ACCESS",
    PERMISSION = "PERMISSION",
    ACTIVITY = "ACTIVITY",
    ORGANIZATION = "ORGANIZATION",
    MEMBERSHIP = "MEMBERSHIP",
    RSI_SYNC = "RSI_SYNC",
    ENCRYPTION = "ENCRYPTION",
    INTEL = "INTEL",
    USER = "USER",
    ADMIN = "ADMIN",
    SECURITY = "SECURITY",
    FLEET = "FLEET",
    DIPLOMACY = "DIPLOMACY",
    FEDERATION = "FEDERATION",
    BOUNTY = "BOUNTY",
    MINING = "MINING",
    TRADE = "TRADE",
    DISCORD = "DISCORD",
    GAMIFICATION = "GAMIFICATION",
    VOICE = "VOICE",
    SYSTEM = "SYSTEM",
    APPROVAL = "APPROVAL"
}
export declare enum AuditSeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export interface AuditEvent {
    category: AuditCategory;
    action: string;
    message: string;
    severity?: AuditSeverity;
    userId?: string;
    username?: string;
    organizationId?: string;
    resource?: string;
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
    metadata?: Record<string, unknown>;
}
export interface StoredAuditEntry extends AuditEvent {
    id: string;
    timestamp: Date;
    correlationId: string;
}
export interface AuditFilter {
    userId?: string;
    organizationId?: string;
    category?: AuditCategory;
    action?: string;
    severity?: AuditSeverity;
    correlationId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}
export interface AuditStatistics {
    totalEvents: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    uniqueUsers: number;
    timeRange: {
        earliest: Date | null;
        latest: Date | null;
    };
}
export declare class AuditService {
    private static instance;
    private buffer;
    private bufferHead;
    private bufferCount;
    private readonly bufferSize;
    private constructor();
    static getInstance(): AuditService;
    static resetInstance(): void;
    log(event: AuditEvent): StoredAuditEntry;
    logAuthentication(success: boolean, userId: string | undefined, username: string | undefined, ipAddress?: string, userAgent?: string, reason?: string): StoredAuditEntry;
    logAuthorizationFailure(userId: string, username: string, role: string, resource: string, action: string, ipAddress?: string, userAgent?: string): StoredAuditEntry;
    logDataAccess(userId: string, username: string, resource: string, action: string, ipAddress?: string, userAgent?: string, metadata?: Record<string, unknown>): StoredAuditEntry;
    logPermissionChange(userId: string, targetUserId: string, organizationId: string, action: 'GRANTED' | 'REVOKED', resource: string, permissions: string, metadata?: Record<string, unknown>): StoredAuditEntry;
    logOrganizationEvent(action: string, organizationId: string, userId: string, message: string, metadata?: Record<string, unknown>): StoredAuditEntry;
    logRsiSync(organizationId: string, action: string, success: boolean, metadata?: Record<string, unknown>): StoredAuditEntry;
    logSecurityEvent(action: string, message: string, severity?: AuditSeverity, metadata?: Record<string, unknown>): StoredAuditEntry;
    query(filter?: AuditFilter): StoredAuditEntry[];
    getById(id: string): StoredAuditEntry | undefined;
    getStatistics(organizationId?: string): AuditStatistics;
    getEntryCount(): number;
    clear(): void;
    private bufferPush;
    private getBufferEntries;
}
export declare const auditService: AuditService;
export { AuditEventType } from '../../utils/auditLogger';
//# sourceMappingURL=AuditService.d.ts.map