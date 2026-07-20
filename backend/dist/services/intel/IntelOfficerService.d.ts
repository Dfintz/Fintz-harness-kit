import { IntelAccessLevel } from '../../models/IntelEntry';
import { IntelOfficer, IntelOfficerRank } from '../../models/IntelOfficer';
export interface AppointOfficerInput {
    organizationId: string;
    userId: string;
    rank: IntelOfficerRank;
    accessLevel: IntelAccessLevel;
    specializations?: string[];
    notes?: string;
}
export interface UpdateOfficerInput {
    rank?: IntelOfficerRank;
    accessLevel?: IntelAccessLevel;
    specializations?: string[];
    notes?: string;
    isActive?: boolean;
}
export declare class IntelOfficerService {
    private readonly intelOfficerRepo;
    private readonly auditLogRepo;
    private readonly userOrgRepo;
    constructor();
    canManageOfficers(userId: string, organizationId: string): Promise<boolean>;
    appointOfficer(input: AppointOfficerInput, appointedBy: string, ipAddress?: string, userAgent?: string): Promise<IntelOfficer>;
    private validateRankLimitations;
    updateOfficer(officerId: string, userId: string, organizationId: string, input: UpdateOfficerInput, ipAddress?: string, userAgent?: string): Promise<IntelOfficer>;
    removeOfficer(officerId: string, userId: string, organizationId: string, reason?: string, ipAddress?: string, userAgent?: string): Promise<void>;
    getOfficers(organizationId: string, userId: string, options?: {
        includeInactive?: boolean;
        rank?: IntelOfficerRank;
    }): Promise<IntelOfficer[]>;
    getOfficer(officerId: string, userId: string, organizationId: string): Promise<IntelOfficer>;
    private logAudit;
}
//# sourceMappingURL=IntelOfficerService.d.ts.map