import { BlacklistSharingConfig } from '../../models/BlacklistSharingConfig';
import { IncidentSeverity, IncidentStatus, ModerationIncident } from '../../models/ModerationIncident';
import { RelationshipType } from '../../models/OrganizationRelationship';
import { TenantService } from '../base/TenantService';
export declare enum BlacklistSharingAuditAction {
    CONFIG_CREATED = "BLACKLIST_CONFIG_CREATED",
    CONFIG_UPDATED = "BLACKLIST_CONFIG_UPDATED",
    INCIDENT_SHARED_WITH_ALLIES = "INCIDENT_SHARED_WITH_ALLIES",
    ALERT_SENT = "BLACKLIST_ALERT_SENT"
}
export interface UpdateSharingConfigDTO {
    shareWarnings?: boolean;
    shareTimeouts?: boolean;
    shareKicks?: boolean;
    shareBans?: boolean;
    receiveAlerts?: boolean;
    minAlertSeverity?: number;
    alertChannelId?: string | null;
    autoShareWithAllies?: boolean;
    autoShareMinSeverity?: number;
    autoEnforceEnabled?: boolean;
    autoEnforceTimeouts?: boolean;
    autoEnforceKicks?: boolean;
}
export interface AlliedOrgInfo {
    organizationId: string;
    organizationName?: string;
    relationshipType: RelationshipType;
}
export interface SharedIncident {
    incident: ModerationIncident;
    sourceOrganizationId: string;
    sourceOrganizationName?: string;
    isFromAlly: boolean;
}
export interface CrossAllianceCheckResult {
    ownIncidents: ModerationIncident[];
    alliedIncidents: SharedIncident[];
    totalIncidents: number;
    highestSeverity: IncidentSeverity;
    hasActiveIncident: boolean;
}
export declare class BlacklistSharingService extends TenantService<BlacklistSharingConfig> {
    private static instance;
    private readonly relationshipRepository;
    private readonly incidentRepository;
    constructor();
    static getInstance(): BlacklistSharingService;
    getConfig(organizationId: string): Promise<BlacklistSharingConfig>;
    private createDefaultConfig;
    updateConfig(organizationId: string, userId: string, userName: string, dto: UpdateSharingConfigDTO): Promise<BlacklistSharingConfig>;
    getAlliedOrganizations(organizationId: string): Promise<AlliedOrgInfo[]>;
    shareIncidentWithAllies(incident: ModerationIncident, organizationId: string, userId: string, userName: string): Promise<string[]>;
    private sendIncidentAlert;
    private tryAutoEnforce;
    getIncidentFeed(organizationId: string, options?: {
        page?: number;
        limit?: number;
        minSeverity?: IncidentSeverity;
        includeOwn?: boolean;
        includeShared?: boolean;
        status?: IncidentStatus;
    }): Promise<{
        incidents: SharedIncident[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    checkUserAcrossAllies(organizationId: string, targetDiscordId: string): Promise<CrossAllianceCheckResult>;
}
//# sourceMappingURL=BlacklistSharingService.d.ts.map