import type { ApplicationModeResponse, ApplicationSource } from '@sc-fleet-manager/shared-types';
import { OrgApplication, OrgApplicationStatus } from '../../models/OrgApplication';
export declare const TERMINAL_STATUSES: OrgApplicationStatus[];
export declare class OrgApplicationService {
    private readonly applicationRepository;
    private readonly organizationRepository;
    private readonly profileRepository;
    private readonly membershipRepository;
    private readonly watchlistRepository;
    private readonly userRepository;
    private readonly memberService;
    constructor();
    getApplicationMode(orgId: string): Promise<ApplicationModeResponse>;
    checkWatchlist(orgId: string, userId: string): Promise<void>;
    private validateFormResponses;
    apply(orgId: string, userId: string, message?: string, formResponses?: Record<string, string>, source?: ApplicationSource): Promise<OrgApplication>;
    reviewApplication(appId: string, orgId: string, reviewerId: string, decision: 'approved' | 'rejected', note?: string): Promise<OrgApplication>;
    withdrawApplication(appId: string, userId: string): Promise<OrgApplication>;
    getApplicationsForOrg(orgId: string, options?: {
        status?: OrgApplicationStatus;
        page?: number;
        limit?: number;
    }): Promise<{
        data: OrgApplication[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    private static toUserView;
    getMyApplications(userId: string): Promise<Array<Omit<OrgApplication, 'organization'> & {
        organization?: {
            id: string;
            name: string;
        };
    }>>;
    hasActiveApplication(orgId: string, userId: string): Promise<boolean>;
    isMember(orgId: string, userId: string): Promise<boolean>;
}
//# sourceMappingURL=OrgApplicationService.d.ts.map