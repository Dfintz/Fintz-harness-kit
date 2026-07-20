import { IntelClassification, IntelEntry } from './IntelEntry';
import { Organization } from './Organization';
import { User } from './User';
export declare enum IntelSharePermission {
    VIEW = "view",
    COMMENT = "comment",
    CONTRIBUTE = "contribute",
    FULL = "full"
}
export declare enum IntelShareStatus {
    PENDING = "pending",
    ACTIVE = "active",
    REVOKED = "revoked",
    DECLINED = "declined",
    EXPIRED = "expired"
}
export declare class IntelShare {
    id: string;
    intelEntryId: string;
    intelEntry?: IntelEntry;
    sourceOrganizationId: string;
    sourceOrganization?: Organization;
    targetOrganizationId: string;
    targetOrganization?: Organization;
    permission: IntelSharePermission;
    status: IntelShareStatus;
    maxClassification: IntelClassification;
    sharedBy: string;
    sharer?: User;
    acceptedBy?: string;
    accepter?: User;
    revokedBy?: string;
    revoker?: User;
    shareReason?: string;
    revokeReason?: string;
    expiresAt?: Date;
    acceptedAt?: Date;
    revokedAt?: Date;
    viewCount: number;
    lastViewedAt?: Date;
    metadata?: {
        allianceId?: string;
        treatyId?: string;
        conditions?: string[];
        restrictedSections?: string[];
        notes?: string;
    };
    createdAt: Date;
    updatedAt: Date;
    isActive(): boolean;
    isExpired(): boolean;
}
//# sourceMappingURL=IntelShare.d.ts.map