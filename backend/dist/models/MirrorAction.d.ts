import { TenantEntity } from './base/TenantEntity';
import { IncidentSeverity, IncidentType, ModerationIncident } from './ModerationIncident';
export declare enum MirrorActionType {
    WARNING = "warning",
    TIMEOUT = "timeout",
    KICK = "kick",
    BAN = "ban"
}
export declare enum MirrorActionStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    CANCELLED = "cancelled",
    FAILED = "failed"
}
export declare class MirrorAction extends TenantEntity {
    id: string;
    sourceIncidentId: string;
    sourceIncident?: ModerationIncident;
    sourceOrganizationId: string;
    sourceGuildId?: string;
    sourceGuildName?: string;
    targetDiscordId: string;
    targetUsername?: string;
    targetGuildId: string;
    targetGuildName?: string;
    actionType: MirrorActionType;
    severity: IncidentSeverity;
    status: MirrorActionStatus;
    reason?: string;
    originalReason?: string;
    durationMinutes?: number;
    moderatorId: string;
    moderatorDiscordId?: string;
    moderatorUsername?: string;
    confirmationRequired: boolean;
    confirmedAt?: Date;
    executedAt?: Date;
    errorMessage?: string;
    isBulkMirror: boolean;
    bulkMirrorId?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    needsConfirmation(): boolean;
    isPending(): boolean;
    isExecuted(): boolean;
    isBan(): boolean;
    getSeverityEmoji(): string;
    static actionTypeFromIncidentType(incidentType: IncidentType): MirrorActionType;
}
//# sourceMappingURL=MirrorAction.d.ts.map