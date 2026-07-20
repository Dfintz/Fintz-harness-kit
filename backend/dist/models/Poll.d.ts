import { TenantEntity } from './base/TenantEntity';
import { PollVote } from './PollVote';
export declare enum PollType {
    SINGLE_CHOICE = "single_choice",
    MULTIPLE_CHOICE = "multiple_choice",
    RANKED = "ranked",
    APPROVAL = "approval"
}
export declare enum PollVisibility {
    PUBLIC = "public",
    MEMBERS_ONLY = "members_only",
    ROLE_RESTRICTED = "role_restricted"
}
export declare enum PollStatus {
    DRAFT = "draft",
    ACTIVE = "active",
    CLOSED = "closed",
    CANCELLED = "cancelled"
}
export interface PollOption {
    id: string;
    label: string;
    description?: string;
    sortOrder: number;
}
export declare class Poll extends TenantEntity {
    id: string;
    title: string;
    description?: string;
    pollType: PollType;
    visibility: PollVisibility;
    options: PollOption[];
    isAnonymous: boolean;
    maxSelections: number;
    status: PollStatus;
    createdBy: string;
    createdByName?: string;
    endsAt?: Date;
    closedBy?: string;
    closedAt?: Date;
    allowedRoles?: string[];
    federationId?: string;
    votingMode?: string;
    votes?: PollVote[];
    createdAt: Date;
    updatedAt: Date;
    version: number;
    get isActive(): boolean;
    get isClosed(): boolean;
    get isExpired(): boolean;
}
//# sourceMappingURL=Poll.d.ts.map