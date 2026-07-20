import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum GamificationAuditAction {
    BADGE_CREATED = "BADGE_CREATED",
    BADGE_UPDATED = "BADGE_UPDATED",
    BADGE_DELETED = "BADGE_DELETED",
    BADGE_AWARDED = "BADGE_AWARDED",
    BADGE_REVOKED = "BADGE_REVOKED"
}
export interface GamificationAuditEntry extends BaseDomainAuditEntry<GamificationAuditAction> {
    achievementId: string;
    achievementName: string;
}
export declare class GamificationAuditLogger extends DomainAuditLogger<GamificationAuditAction, GamificationAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): GamificationAuditLogger;
    static resetInstance(): void;
    protected buildMessage(entry: GamificationAuditEntry): string;
    protected buildResource(entry: GamificationAuditEntry): string;
    logBadgeCreated(organizationId: string, achievementId: string, achievementName: string, performedById: string): void;
    logBadgeUpdated(organizationId: string, achievementId: string, achievementName: string, performedById: string, changes: Record<string, unknown>): void;
    logBadgeDeleted(organizationId: string, achievementId: string, achievementName: string, performedById: string): void;
    logBadgeAwarded(organizationId: string, achievementId: string, achievementName: string, userId: string, awardedBy: string): void;
    logBadgeRevoked(organizationId: string, achievementId: string, achievementName: string, userId: string, performedById: string): void;
}
export declare const gamificationAuditLogger: GamificationAuditLogger;
//# sourceMappingURL=GamificationAuditLogger.d.ts.map