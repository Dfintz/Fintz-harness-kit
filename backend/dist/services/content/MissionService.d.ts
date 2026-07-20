import { Mission, MissionDifficulty, MissionParticipantData, MissionPriority, MissionStatus, MissionType } from '../../models/Mission';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export interface MissionFilters {
    status?: MissionStatus;
    missionType?: MissionType;
    difficulty?: MissionDifficulty;
    priority?: MissionPriority;
    createdBy?: string;
    assignedTo?: string;
    fleetId?: string;
    tags?: string[];
    search?: string;
    startDateFrom?: Date;
    startDateTo?: Date;
}
export interface ScmdbMissionCardFilters {
    search?: string;
    category?: string;
    limit?: number;
}
export interface ScmdbMissionCard {
    externalId: string;
    title: string;
    category: string;
    description?: string;
    location?: string;
    difficultyHint?: string;
    rewardHint?: string;
    tags: string[];
    payload: Record<string, unknown>;
}
export interface ImportScmdbMissionInput {
    externalId: string;
    priority?: MissionPriority;
    startDate?: Date;
    endDate?: Date;
    notes?: string;
}
export interface ImportScmdbMissionsResult {
    imported: Mission[];
    skipped: Array<{
        externalId: string;
        reason: string;
    }>;
}
export type MissionWorkflowPhase = 'dispatch' | 'quartermaster' | 'execution' | 'after_action';
export interface MissionWorkflowPhaseState {
    phase: MissionWorkflowPhase;
    title: string;
    description: string;
    completed: boolean;
    blockers: string[];
    suggestedStatus?: MissionStatus;
    nextActions: string[];
}
export interface MissionWorkflowState {
    missionId: string;
    missionStatus: MissionStatus;
    completedPhases: number;
    totalPhases: number;
    completionPercent: number;
    phases: MissionWorkflowPhaseState[];
}
export declare class MissionService {
    private _missionRepository?;
    private _externalCatalogRepository?;
    private get missionRepository();
    private get externalCatalogRepository();
    searchScmdbMissionCards(filters?: ScmdbMissionCardFilters): Promise<ScmdbMissionCard[]>;
    getScmdbAvailableFilters(): Promise<{
        categories: Array<{
            name: string;
            count: number;
        }>;
    }>;
    importScmdbMissionByUrl(organizationId: string, createdBy: string, url: string, input?: Omit<ImportScmdbMissionInput, 'externalId'>): Promise<Mission | null>;
    importScmdbMissions(organizationId: string, createdBy: string, inputs: ImportScmdbMissionInput[]): Promise<ImportScmdbMissionsResult>;
    private mapScmdbRecordToMissionCard;
    private mapScmdbRecordToMissionCreatePayload;
    private mapCategoryToMissionType;
    private mapDifficulty;
    private readPayloadString;
    private collectMissionTags;
    createMission(organizationId: string, missionData: Partial<Mission>): Promise<Mission>;
    getMissionById(id: string, organizationId: string): Promise<Mission | null>;
    getAllMissions(organizationId: string, paginationOptions: PaginationOptions, filters?: MissionFilters): Promise<PaginatedResponse<Mission>>;
    updateMission(id: string, organizationId: string, updates: Partial<Mission>): Promise<Mission | null>;
    deleteMission(id: string, organizationId: string, deletedBy: string): Promise<boolean>;
    getWorkflow(id: string, organizationId: string): Promise<MissionWorkflowState | null>;
    advanceWorkflowPhase(id: string, organizationId: string, phase: MissionWorkflowPhase, notes?: string): Promise<Mission | null>;
    transitionStatus(id: string, organizationId: string, newStatus: MissionStatus): Promise<Mission | null>;
    completeMission(id: string, organizationId: string, outcome: {
        status: MissionStatus.COMPLETED | MissionStatus.FAILED;
        notes?: string;
    }): Promise<Mission | null>;
    assignMission(id: string, organizationId: string, userId: string, role?: MissionParticipantData['role']): Promise<Mission | null>;
    addParticipant(id: string, organizationId: string, userId: string, role?: MissionParticipantData['role']): Promise<Mission | null>;
    removeParticipant(id: string, organizationId: string, userId: string): Promise<Mission | null>;
    getParticipants(id: string, organizationId: string): Promise<MissionParticipantData[] | null>;
    addObjective(id: string, organizationId: string, objective: {
        title: string;
        description?: string;
        optional?: boolean;
    }): Promise<Mission | null>;
    updateObjective(missionId: string, organizationId: string, objectiveId: string, updates: {
        title?: string;
        description?: string;
        completed?: boolean;
        optional?: boolean;
    }): Promise<Mission | null>;
    removeObjective(missionId: string, organizationId: string, objectiveId: string): Promise<Mission | null>;
    getMissionsByFleet(fleetId: string, organizationId: string): Promise<Mission[]>;
    getActiveMissions(organizationId: string): Promise<Mission[]>;
    getTemplates(organizationId: string): Promise<Mission[]>;
    private hasWorkflowTag;
    private markWorkflowPhaseComplete;
    private applyWorkflowStatusTransition;
    private appendWorkflowNotes;
    private isTerminalMissionStatus;
    private getDispatchBlockers;
    private getQuartermasterBlockers;
    private getExecutionBlockers;
    private getAfterActionBlockers;
    private isDispatchCompleted;
    private isQuartermasterCompleted;
    private isExecutionCompleted;
    private buildWorkflowPhases;
}
//# sourceMappingURL=MissionService.d.ts.map