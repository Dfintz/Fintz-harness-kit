import type { ApplicationQuestion, FederationApplicationMode } from '@sc-fleet-manager/shared-types';
export interface FederationApplicationModeResponse {
    mode: FederationApplicationMode;
    questions?: ApplicationQuestion[];
}
export interface FederationApplicationData {
    id: string;
    federationId: string;
    applicantOrgId: string;
    applicantOrgName: string;
    applicantUserId: string;
    message: string | null;
    formResponses: Record<string, string> | null;
    source: string | null;
    status: string;
    reviewedBy: string | null;
    reviewNote: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
}
export declare class FederationApplicationService {
    private static instance;
    private readonly applicationRepository;
    private readonly federationRepository;
    private readonly memberRepository;
    private readonly ambassadorService;
    constructor();
    static getInstance(): FederationApplicationService;
    private toData;
    getApplicationMode(federationId: string): Promise<FederationApplicationModeResponse>;
    applyToFederation(federationId: string, applicantUserId: string, applicantOrgId: string, applicantOrgName: string, data: {
        message?: string;
        formResponses?: Record<string, string>;
        source?: string;
    }): Promise<FederationApplicationData>;
    listApplications(federationId: string, userId: string, filters?: {
        status?: string;
    }): Promise<FederationApplicationData[]>;
    reviewApplication(federationId: string, applicationId: string, reviewerUserId: string, decision: 'approved' | 'rejected', note?: string): Promise<FederationApplicationData>;
    withdrawApplication(federationId: string, applicationId: string, userId: string): Promise<void>;
    private validateFormResponses;
}
//# sourceMappingURL=FederationApplicationService.d.ts.map