import { TenantEntity } from './base/TenantEntity';
export declare const LONG_TIMEOUT_THRESHOLD_MINUTES = 60;
export declare enum IncidentType {
    WARNING = "warning",
    TIMEOUT = "timeout",
    LONG_TIMEOUT = "long_timeout",
    KICK = "kick",
    BAN = "ban"
}
export declare enum IncidentSeverity {
    WARNING = 1,
    TIMEOUT = 2,
    LONG_TIMEOUT = 3,
    KICK = 4,
    BAN = 5
}
export declare enum IncidentStatus {
    ACTIVE = "active",
    EXPIRED = "expired",
    REVOKED = "revoked"
}
export declare class ModerationIncident extends TenantEntity {
    id: string;
    guildId: string;
    guildName?: string;
    targetDiscordId: string;
    targetUsername?: string;
    moderatorId: string;
    moderatorDiscordId?: string;
    moderatorUsername?: string;
    incidentType: IncidentType;
    severity: IncidentSeverity;
    status: IncidentStatus;
    reason?: string;
    durationMinutes?: number;
    isShared: boolean;
    isAutoDetected: boolean;
    discordAuditLogId?: string;
    metadata?: Record<string, unknown>;
    expiresAt?: Date;
    revokedBy?: string;
    revokedAt?: Date;
    revokeReason?: string;
    createdAt: Date;
    updatedAt: Date;
    isActive(): boolean;
    isExpired(): boolean;
    getSeverityLabel(): string;
    getSeverityEmoji(): string;
    static calculateSeverity(type: IncidentType, durationMinutes?: number): IncidentSeverity;
}
//# sourceMappingURL=ModerationIncident.d.ts.map