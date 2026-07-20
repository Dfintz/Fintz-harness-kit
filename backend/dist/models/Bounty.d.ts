import { TenantEntity } from './base/TenantEntity';
export declare enum BountyType {
    KILL = "kill",
    CAPTURE = "capture",
    INTEL = "intel",
    TRANSPORT = "transport",
    RESCUE = "rescue",
    CUSTOM = "custom"
}
export declare enum BountyTargetType {
    PLAYER = "player",
    NPC = "npc",
    SHIP = "ship",
    LOCATION = "location",
    ITEM = "item",
    OTHER = "other"
}
export declare enum BountyRewardType {
    CREDITS = "credits",
    ITEM = "item",
    REPUTATION = "reputation",
    MIXED = "mixed",
    OTHER = "other"
}
export declare enum BountyStatus {
    ACTIVE = "active",
    CLAIMED = "claimed",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    VERIFIED = "verified",
    PAID = "paid",
    CANCELLED = "cancelled",
    EXPIRED = "expired"
}
export declare enum BountyVisibility {
    PUBLIC = "public",
    ORGANIZATION = "organization",
    ALLIANCE = "alliance",
    PRIVATE = "private"
}
export declare enum BountyDifficulty {
    EASY = "easy",
    MEDIUM = "medium",
    HARD = "hard",
    EXPERT = "expert"
}
export interface BountyTargetDetails {
    lastKnownLocation?: string;
    shipType?: string;
    affiliations?: string[];
    threat_level?: string;
    notes?: string;
    imageUrl?: string;
    [key: string]: unknown;
}
export interface BountyMetadata {
    evidence?: string[];
    completionNotes?: string;
    verificationNotes?: string;
    paymentReference?: string;
    [key: string]: unknown;
}
export declare class Bounty extends TenantEntity {
    id: string;
    createdBy: string;
    createdByName?: string;
    title: string;
    description?: string;
    bountyType: BountyType;
    targetType: BountyTargetType;
    targetIdentifier?: string;
    targetName?: string;
    targetDetails?: BountyTargetDetails;
    rewardType: BountyRewardType;
    rewardAmount?: number;
    rewardDescription?: string;
    status: BountyStatus;
    difficulty?: BountyDifficulty;
    location?: string;
    systemLocation?: string;
    claimedBy?: string;
    claimedByName?: string;
    claimedAt?: Date;
    completedAt?: Date;
    verifiedBy?: string;
    verifiedAt?: Date;
    paidAt?: Date;
    expiresAt?: Date;
    visibility: BountyVisibility;
    tags: string[];
    metadata?: BountyMetadata;
    linkedActivityId?: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    get isActive(): boolean;
    get isClaimed(): boolean;
    get isCompleted(): boolean;
    get isExpired(): boolean;
    get canBeClaimed(): boolean;
    get hasReward(): boolean;
}
//# sourceMappingURL=Bounty.d.ts.map