import { IncidentSeverity, IncidentStatus, IncidentType, ModerationIncident } from '../../models/ModerationIncident';
import { TenantService } from '../base/TenantService';
export declare enum ModerationAuditAction {
    INCIDENT_CREATED = "INCIDENT_CREATED",
    INCIDENT_UPDATED = "INCIDENT_UPDATED",
    INCIDENT_REVOKED = "INCIDENT_REVOKED",
    INCIDENT_SHARED = "INCIDENT_SHARED",
    INCIDENT_UNSHARED = "INCIDENT_UNSHARED",
    INCIDENT_AUTO_DETECTED = "INCIDENT_AUTO_DETECTED",
    INCIDENT_EXPIRED = "INCIDENT_EXPIRED"
}
export interface CreateIncidentDTO {
    guildId: string;
    guildName?: string;
    targetDiscordId: string;
    targetUsername?: string;
    moderatorDiscordId?: string;
    moderatorUsername?: string;
    incidentType: IncidentType;
    reason?: string;
    durationMinutes?: number;
    isShared?: boolean;
    isAutoDetected?: boolean;
    discordAuditLogId?: string;
    metadata?: Record<string, unknown>;
}
export interface UpdateIncidentDTO {
    reason?: string;
    isShared?: boolean;
    metadata?: Record<string, unknown>;
    status?: IncidentStatus;
}
export interface IncidentSearchFilters {
    targetDiscordId?: string;
    guildId?: string;
    incidentType?: IncidentType;
    severity?: IncidentSeverity;
    status?: IncidentStatus;
    minSeverity?: IncidentSeverity;
    isShared?: boolean;
    isAutoDetected?: boolean;
    moderatorId?: string;
    searchTerm?: string;
    createdAfter?: Date;
    createdBefore?: Date;
    includeExpired?: boolean;
    sortBy?: 'createdAt' | 'severity' | 'incidentType';
    sortOrder?: 'asc' | 'desc';
}
export interface UserIncidentSummary {
    targetDiscordId: string;
    targetUsername?: string;
    totalIncidents: number;
    activeIncidents: number;
    highestSeverity: IncidentSeverity;
    incidentsByType: Record<IncidentType, number>;
    incidentsBySeverity: Record<IncidentSeverity, number>;
    sharedIncidents: number;
    firstIncident?: Date;
    lastIncident?: Date;
    incidents: ModerationIncident[];
}
export interface IncidentStatistics {
    totalIncidents: number;
    activeIncidents: number;
    revokedIncidents: number;
    expiredIncidents: number;
    sharedIncidents: number;
    autoDetectedIncidents: number;
    byType: Record<IncidentType, number>;
    bySeverity: Record<IncidentSeverity, number>;
    uniqueTargets: number;
    averageSeverity: number;
}
export declare class ModerationIncidentService extends TenantService<ModerationIncident> {
    private static instance;
    constructor();
    static getInstance(): ModerationIncidentService;
    private logIncidentAudit;
    createIncident(organizationId: string, moderatorId: string, moderatorName: string, dto: CreateIncidentDTO): Promise<ModerationIncident>;
    createFromDiscordEvent(organizationId: string, systemUserId: string, guildId: string, guildName: string, targetDiscordId: string, targetUsername: string | undefined, moderatorDiscordId: string, moderatorUsername: string, incidentType: IncidentType, reason?: string, durationMinutes?: number, discordAuditLogId?: string): Promise<ModerationIncident>;
    findByAuditLogId(organizationId: string, auditLogId: string): Promise<ModerationIncident | null>;
    getIncidentById(organizationId: string, incidentId: string): Promise<ModerationIncident | null>;
    updateIncident(organizationId: string, incidentId: string, userId: string, userName: string, dto: UpdateIncidentDTO): Promise<ModerationIncident | null>;
    revokeIncident(organizationId: string, incidentId: string, userId: string, userName: string, reason?: string): Promise<ModerationIncident | null>;
    shareIncident(organizationId: string, incidentId: string, userId: string, userName: string): Promise<ModerationIncident | null>;
    unshareIncident(organizationId: string, incidentId: string, userId: string, userName: string): Promise<ModerationIncident | null>;
    lookupUser(organizationId: string, targetDiscordId: string, includeShared?: boolean): Promise<UserIncidentSummary>;
    getSharedIncidentsForUser(targetDiscordId: string): Promise<ModerationIncident[]>;
    searchIncidents(organizationId: string, filters: IncidentSearchFilters, page?: number, limit?: number): Promise<{
        incidents: ModerationIncident[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getGuildIncidents(organizationId: string, guildId: string, page?: number, limit?: number): Promise<{
        incidents: ModerationIncident[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getActiveIncidents(organizationId: string, page?: number, limit?: number): Promise<{
        incidents: ModerationIncident[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getStatistics(organizationId: string): Promise<IncidentStatistics>;
    expireIncidents(): Promise<number>;
    private initializeByType;
    private initializeBySeverity;
}
//# sourceMappingURL=ModerationIncidentService.d.ts.map