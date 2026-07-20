import { IncidentType, IncidentSeverity, IncidentStatus } from '../../models/ModerationIncident';
export declare enum GdprBlacklistAuditAction {
    DATA_EXPORT_REQUESTED = "BLACKLIST_DATA_EXPORT_REQUESTED",
    DATA_EXPORT_COMPLETED = "BLACKLIST_DATA_EXPORT_COMPLETED",
    DATA_DELETION_REQUESTED = "BLACKLIST_DATA_DELETION_REQUESTED",
    DATA_DELETION_COMPLETED = "BLACKLIST_DATA_DELETION_COMPLETED",
    DATA_ANONYMIZATION_COMPLETED = "BLACKLIST_DATA_ANONYMIZATION_COMPLETED"
}
export declare const BLACKLIST_RETENTION_PERIODS: {
    activeIncidents: number;
    expiredIncidents: number;
    mirrorActions: number;
    sharingConfig: number;
    anonymizedData: number;
};
export interface BlacklistDataExport {
    exportedAt: Date;
    discordUserId: string;
    incidentsAsTarget: ModerationIncidentExport[];
    incidentsAsModerator: ModerationIncidentExport[];
    mirrorActionsAsTarget: MirrorActionExport[];
    mirrorActionsAsModerator: MirrorActionExport[];
    sharingConfigurations?: BlacklistSharingConfigExport[];
    summary: {
        totalIncidentsAsTarget: number;
        totalIncidentsAsModerator: number;
        totalMirrorActionsAsTarget: number;
        totalMirrorActionsAsModerator: number;
        earliestRecord: Date | null;
        latestRecord: Date | null;
    };
}
export interface ModerationIncidentExport {
    id: string;
    guildId: string;
    guildName?: string;
    incidentType: IncidentType;
    severity: IncidentSeverity;
    status: IncidentStatus;
    reason?: string;
    durationMinutes?: number;
    isShared: boolean;
    isAutoDetected: boolean;
    createdAt: Date;
    expiresAt?: Date;
    revokedAt?: Date;
    revokeReason?: string;
}
export interface MirrorActionExport {
    id: string;
    sourceGuildId?: string;
    sourceGuildName?: string;
    targetGuildId: string;
    targetGuildName?: string;
    actionType: string;
    severity: IncidentSeverity;
    status: string;
    reason?: string;
    createdAt: Date;
    confirmedAt?: Date;
    executedAt?: Date;
}
export interface BlacklistSharingConfigExport {
    id: string;
    organizationId: string;
    shareWarnings: boolean;
    shareTimeouts: boolean;
    shareKicks: boolean;
    shareBans: boolean;
    receiveAlerts: boolean;
    minAlertSeverity: number;
    autoShareWithAllies: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface BlacklistDeletionResult {
    success: boolean;
    discordUserId: string;
    deletedCounts: {
        incidentsAsTarget: number;
        incidentsAsModerator: number;
        mirrorActionsAsTarget: number;
        mirrorActionsAsModerator: number;
    };
    totalDeleted: number;
    anonymizedCounts: {
        incidentsAnonymized: number;
        mirrorActionsAnonymized: number;
    };
    errors: string[];
    completedAt: Date;
}
export interface RetentionCleanupResult {
    entity: string;
    deletedCount: number;
    retentionDays: number;
    cutoffDate: Date;
    success: boolean;
    error?: string;
}
export declare class BlacklistGdprService {
    private incidentRepository;
    private mirrorRepository;
    private sharingConfigRepository;
    constructor();
    exportUserData(discordUserId: string, requestedBy: string, requestedByName: string, includeAdminData?: boolean): Promise<BlacklistDataExport>;
    deleteUserData(discordUserId: string, requestedBy: string, requestedByName: string, anonymizeForAudit?: boolean): Promise<BlacklistDeletionResult>;
    runRetentionCleanup(): Promise<RetentionCleanupResult[]>;
    getRetentionConfig(): typeof BLACKLIST_RETENTION_PERIODS;
    private mapIncidentToExport;
    private mapMirrorActionToExport;
    private mapSharingConfigToExport;
}
export declare const getBlacklistGdprService: () => BlacklistGdprService;
//# sourceMappingURL=BlacklistGdprService.d.ts.map