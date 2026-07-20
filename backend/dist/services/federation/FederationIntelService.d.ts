import { FederationIntelClassification, FederationIntelStatus } from '../../models/FederationIntelEntry';
export interface FederationIntelData {
    id: string;
    federationId: string;
    title: string;
    content: string;
    classification: FederationIntelClassification;
    status: FederationIntelStatus;
    submittedBy: string;
    submittedByName: string | null;
    submittedByOrgId: string | null;
    approvedBy: string | null;
    tags: string[];
    visibleToTreaties: string[];
    createdAt: Date;
    updatedAt: Date;
}
export declare class FederationIntelService {
    private static instance;
    private readonly intelRepository;
    private readonly ambassadorService;
    constructor();
    static getInstance(): FederationIntelService;
    private toData;
    submitIntel(federationId: string, userId: string, data: {
        title: string;
        content: string;
        classification?: FederationIntelClassification;
        tags?: string[];
        visibleToTreaties?: string[];
        submittedByName?: string;
        submittedByOrgId?: string;
    }): Promise<FederationIntelData>;
    listIntel(federationId: string, userId: string, filters?: {
        classification?: string;
        status?: string;
    }): Promise<FederationIntelData[]>;
    getIntel(federationId: string, userId: string, intelId: string): Promise<FederationIntelData>;
    approveIntel(federationId: string, userId: string, intelId: string): Promise<FederationIntelData>;
    archiveIntel(federationId: string, userId: string, intelId: string): Promise<FederationIntelData>;
    updateIntel(federationId: string, userId: string, intelId: string, data: {
        title?: string;
        content?: string;
        classification?: FederationIntelClassification;
        tags?: string[];
        visibleToTreaties?: string[];
    }): Promise<FederationIntelData>;
    deleteIntel(federationId: string, userId: string, intelId: string): Promise<void>;
}
//# sourceMappingURL=FederationIntelService.d.ts.map