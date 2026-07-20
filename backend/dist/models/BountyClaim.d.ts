import { Bounty } from './Bounty';
import { BountyEvidence } from './BountyEvidence';
export declare enum BountyClaimStatus {
    ACTIVE = "active",
    SUBMITTED = "submitted",
    COMPLETED = "completed",
    ABANDONED = "abandoned",
    REJECTED = "rejected"
}
export declare class BountyClaim {
    id: string;
    bountyId: string;
    bounty?: Bounty;
    hunterId: string;
    hunterName?: string;
    organizationId: string;
    status: BountyClaimStatus;
    notes?: string;
    claimedAt: Date;
    submittedAt?: Date;
    completedAt?: Date;
    evidence?: BountyEvidence[];
    createdAt: Date;
    updatedAt: Date;
    get isActive(): boolean;
    get isSubmitted(): boolean;
    get isCompleted(): boolean;
    get canSubmitEvidence(): boolean;
    get canBeAbandoned(): boolean;
}
//# sourceMappingURL=BountyClaim.d.ts.map