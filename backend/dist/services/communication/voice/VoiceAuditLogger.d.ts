import { BaseDomainAuditEntry, DomainAuditLogger } from '../../shared/DomainAuditLogger';
export declare enum VoiceAuditAction {
    CONFIG_CREATED = "VOICE_CONFIG_CREATED",
    CONFIG_UPDATED = "VOICE_CONFIG_UPDATED",
    CONFIG_DELETED = "VOICE_CONFIG_DELETED",
    ACCESS_GRANTED = "VOICE_ACCESS_GRANTED",
    ACCESS_DENIED = "VOICE_ACCESS_DENIED",
    SERVER_QUERIED = "VOICE_SERVER_QUERIED"
}
export interface VoiceAuditEntry extends BaseDomainAuditEntry<VoiceAuditAction> {
    entityId: string;
    entityType: 'organization' | 'federation';
    serverType?: string;
    serverAddress?: string;
}
export declare class VoiceAuditLogger extends DomainAuditLogger<VoiceAuditAction, VoiceAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): VoiceAuditLogger;
    protected buildMessage(entry: VoiceAuditEntry): string;
    protected buildResource(entry: VoiceAuditEntry): string;
    logConfigCreated(entityId: string, entityType: 'organization' | 'federation', orgId: string, userId: string, serverType: string, host: string, port: number): void;
    logConfigUpdated(entityId: string, entityType: 'organization' | 'federation', orgId: string, userId: string, changes: Record<string, unknown>): void;
    logConfigDeleted(entityId: string, entityType: 'organization' | 'federation', orgId: string, userId: string): void;
    logAccessDenied(entityId: string, entityType: 'organization' | 'federation', orgId: string, userId: string, reason: string): void;
}
export declare const voiceAuditLogger: VoiceAuditLogger;
//# sourceMappingURL=VoiceAuditLogger.d.ts.map