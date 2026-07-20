import { Organization } from './Organization';
import { User } from './User';
export declare enum ApprovalRequestStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected",
    DELEGATED = "delegated",
    WITHDRAWN = "withdrawn",
    EXPIRED = "expired"
}
export declare enum ApprovalRequestType {
    MEMBERSHIP = "membership",
    RESOURCE_ACCESS = "resource_access",
    FLEET_MODIFICATION = "fleet_modification",
    ROLE_CHANGE = "role_change",
    CONTENT_PUBLISH = "content_publish",
    GENERAL = "general"
}
export interface ApprovalHistoryEntry {
    action: string;
    userId: string;
    timestamp: string;
    comment?: string;
}
export declare class ApprovalRequest {
    id: string;
    organizationId: string;
    organization?: Organization;
    type: string;
    title?: string;
    description?: string;
    resourceId?: string;
    resourceType?: string;
    requestedBy: string;
    requester?: User;
    status: string;
    reason?: string;
    assignedTo?: string;
    assignee?: User;
    delegatedTo?: string;
    delegatedBy?: string;
    history?: ApprovalHistoryEntry[];
    metadata?: Record<string, unknown>;
    expiresAt?: Date;
    completedAt?: Date;
    completedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=ApprovalRequest.d.ts.map