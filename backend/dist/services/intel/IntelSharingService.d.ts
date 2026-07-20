import { IntelClassification, IntelEntry } from '../../models/IntelEntry';
import { IntelShare, IntelSharePermission, IntelShareStatus } from '../../models/IntelShare';
export interface CreateShareInput {
    intelEntryId: string;
    sourceOrganizationId: string;
    targetOrganizationId: string;
    permission: IntelSharePermission;
    maxClassification: IntelClassification;
    shareReason?: string;
    expiresAt?: Date;
    metadata?: {
        allianceId?: string;
        treatyId?: string;
        conditions?: string[];
        restrictedSections?: string[];
        notes?: string;
    };
}
export interface ShareAccessResult {
    hasAccess: boolean;
    share?: IntelShare;
    reason?: string;
}
export declare class IntelSharingService {
    private readonly shareRepo;
    private readonly intelEntryRepo;
    private readonly intelOfficerRepo;
    private readonly auditLogRepo;
    private readonly userOrgRepo;
    private readonly relationshipRepo;
    constructor();
    canShareIntel(userId: string, organizationId: string): Promise<boolean>;
    areOrganizationsAllied(sourceOrgId: string, targetOrgId: string): Promise<boolean>;
    createShare(input: CreateShareInput, sharedBy: string, ipAddress?: string, userAgent?: string): Promise<IntelShare>;
    acceptShare(shareId: string, userId: string, organizationId: string, ipAddress?: string, userAgent?: string): Promise<IntelShare>;
    declineShare(shareId: string, userId: string, organizationId: string, reason?: string, ipAddress?: string, userAgent?: string): Promise<IntelShare>;
    revokeShare(shareId: string, userId: string, organizationId: string, reason?: string, ipAddress?: string, userAgent?: string): Promise<IntelShare>;
    getSharedEntry(intelEntryId: string, userId: string, recipientOrgId: string, ipAddress?: string, userAgent?: string): Promise<{
        entry: IntelEntry;
        share: IntelShare;
    }>;
    getSharesForEntry(intelEntryId: string, organizationId: string, userId: string): Promise<IntelShare[]>;
    getIntelSharedWithOrg(organizationId: string, userId: string, options?: {
        status?: IntelShareStatus;
        limit?: number;
        offset?: number;
    }): Promise<{
        shares: IntelShare[];
        total: number;
    }>;
    getIntelSharedByOrg(organizationId: string, userId: string, options?: {
        status?: IntelShareStatus;
        limit?: number;
        offset?: number;
    }): Promise<{
        shares: IntelShare[];
        total: number;
    }>;
    expireOldShares(): Promise<number>;
    private updateShareCount;
    private logAudit;
}
//# sourceMappingURL=IntelSharingService.d.ts.map