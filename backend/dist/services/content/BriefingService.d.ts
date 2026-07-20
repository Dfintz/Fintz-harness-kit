import { Briefing, BriefingClassification, BriefingStatus } from '../../models/Briefing';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export declare class BriefingService {
    private _briefingRepository?;
    private readonly starCommsContextSyncService;
    private get briefingRepository();
    createBriefing(organizationId: string, briefingData: Partial<Briefing>): Promise<Briefing>;
    getBriefingById(id: string, organizationId: string): Promise<Briefing | null>;
    getAllBriefings(organizationId: string, paginationOptions: PaginationOptions, filters?: {
        creatorId?: string;
        missionId?: string;
        status?: BriefingStatus;
        classification?: BriefingClassification;
        operationId?: string;
        tags?: string[];
    }): Promise<PaginatedResponse<Briefing>>;
    updateBriefing(id: string, organizationId: string, updates: Partial<Briefing>): Promise<Briefing | null>;
    deleteBriefing(id: string, organizationId: string): Promise<boolean>;
    addElement(briefingId: string, organizationId: string, element: {
        type: 'text' | 'shape' | 'line' | 'arrow' | 'marker';
        position: {
            x: number;
            y: number;
        };
        data: unknown;
    }): Promise<Briefing | null>;
    updateElement(briefingId: string, organizationId: string, elementId: string, updates: {
        type?: 'text' | 'shape' | 'line' | 'arrow' | 'marker';
        position?: {
            x: number;
            y: number;
        };
        data?: unknown;
    }): Promise<Briefing | null>;
    deleteElement(briefingId: string, organizationId: string, elementId: string): Promise<Briefing | null>;
    addParticipant(briefingId: string, organizationId: string, userId: string): Promise<Briefing | null>;
    removeParticipant(briefingId: string, organizationId: string, userId: string): Promise<Briefing | null>;
    updateStatus(briefingId: string, organizationId: string, status: BriefingStatus): Promise<Briefing | null>;
    createVersion(briefingId: string, organizationId: string): Promise<Briefing | null>;
    getBriefingsByMission(missionId: string, organizationId: string): Promise<Briefing[]>;
}
//# sourceMappingURL=BriefingService.d.ts.map