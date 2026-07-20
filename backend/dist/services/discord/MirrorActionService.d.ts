import { MirrorAction, MirrorActionType, MirrorActionStatus } from '../../models/MirrorAction';
import { IncidentSeverity } from '../../models/ModerationIncident';
import { TenantService } from '../base/TenantService';
export declare enum MirrorAuditAction {
    MIRROR_INITIATED = "MIRROR_ACTION_INITIATED",
    MIRROR_CONFIRMED = "MIRROR_ACTION_CONFIRMED",
    MIRROR_CANCELLED = "MIRROR_ACTION_CANCELLED",
    MIRROR_EXECUTED = "MIRROR_ACTION_EXECUTED",
    MIRROR_FAILED = "MIRROR_ACTION_FAILED",
    BULK_MIRROR_INITIATED = "BULK_MIRROR_INITIATED",
    BULK_MIRROR_COMPLETED = "BULK_MIRROR_COMPLETED"
}
export interface CreateMirrorActionDTO {
    sourceIncidentId: string;
    sourceOrganizationId: string;
    sourceGuildId?: string;
    sourceGuildName?: string;
    targetDiscordId: string;
    targetUsername?: string;
    targetGuildId: string;
    targetGuildName?: string;
    actionType: MirrorActionType;
    severity: IncidentSeverity;
    reason?: string;
    originalReason?: string;
    durationMinutes?: number;
    moderatorId: string;
    moderatorDiscordId?: string;
    moderatorUsername?: string;
    isBulkMirror?: boolean;
    bulkMirrorId?: string;
}
export interface MirrorResult {
    success: boolean;
    action: MirrorAction;
    message: string;
    requiresConfirmation: boolean;
}
export interface BulkMirrorSummary {
    bulkMirrorId: string;
    targetDiscordId: string;
    targetUsername?: string;
    totalIncidents: number;
    mirroredCount: number;
    pendingConfirmation: number;
    failedCount: number;
    actions: MirrorAction[];
}
export declare class MirrorActionService extends TenantService<MirrorAction> {
    private static instance;
    private incidentRepository;
    private sharingService;
    constructor();
    static getInstance(): MirrorActionService;
    createMirrorAction(organizationId: string, dto: CreateMirrorActionDTO): Promise<MirrorResult>;
    createBulkMirror(organizationId: string, targetDiscordId: string, targetGuildId: string, targetGuildName: string | undefined, moderatorId: string, moderatorDiscordId: string | undefined, moderatorUsername: string | undefined): Promise<BulkMirrorSummary>;
    confirmMirrorAction(organizationId: string, mirrorActionId: string, userId: string, userName: string): Promise<MirrorAction | null>;
    cancelMirrorAction(organizationId: string, mirrorActionId: string, userId: string, userName: string): Promise<MirrorAction | null>;
    markAsExecuted(organizationId: string, mirrorActionId: string): Promise<MirrorAction | null>;
    markAsFailed(organizationId: string, mirrorActionId: string, errorMessage: string): Promise<MirrorAction | null>;
    private findExistingMirror;
    getMirrorAction(organizationId: string, mirrorActionId: string): Promise<MirrorAction | null>;
    getPendingMirrorActions(organizationId: string, page?: number, limit?: number): Promise<{
        actions: MirrorAction[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getMirrorActionHistory(organizationId: string, options?: {
        targetDiscordId?: string;
        status?: MirrorActionStatus;
        actionType?: MirrorActionType;
        page?: number;
        limit?: number;
    }): Promise<{
        actions: MirrorAction[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getMirrorStatistics(organizationId: string): Promise<{
        totalMirrors: number;
        confirmedMirrors: number;
        pendingMirrors: number;
        cancelledMirrors: number;
        failedMirrors: number;
        byActionType: Record<MirrorActionType, number>;
    }>;
}
//# sourceMappingURL=MirrorActionService.d.ts.map