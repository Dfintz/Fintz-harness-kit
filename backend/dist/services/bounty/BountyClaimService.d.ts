import { BountyClaim, BountyClaimStatus } from '../../models/BountyClaim';
import { BountyEvidence, EvidenceType } from '../../models/BountyEvidence';
export declare enum ClaimAuditAction {
    CLAIM_CREATED = "CLAIM_CREATED",
    CLAIM_SUBMITTED = "CLAIM_SUBMITTED",
    CLAIM_COMPLETED = "CLAIM_COMPLETED",
    CLAIM_ABANDONED = "CLAIM_ABANDONED",
    CLAIM_REJECTED = "CLAIM_REJECTED",
    CLAIM_APPROVED = "CLAIM_APPROVED",
    CLAIM_PAID = "CLAIM_PAID",
    EVIDENCE_ADDED = "EVIDENCE_ADDED",
    EVIDENCE_DELETED = "EVIDENCE_DELETED"
}
export interface CreateClaimDTO {
    bountyId: string;
    hunterId: string;
    hunterName: string;
    notes?: string;
}
export interface SubmitEvidenceDTO {
    evidenceType: EvidenceType;
    content?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
}
export interface ClaimLimitConfig {
    maxActiveClaimsPerHunter: number;
    maxClaimsPerBounty: number;
}
export declare class BountyClaimService {
    private readonly claimRepository;
    private readonly evidenceRepository;
    private readonly bountyRepository;
    private readonly claimLimits;
    private readonly notificationService;
    private hunterProfileService;
    constructor(claimLimits?: Partial<ClaimLimitConfig>);
    private getHunterProfileService;
    private recalculateHunterStats;
    private logClaimAudit;
    getActiveClaimsCount(hunterId: string): Promise<number>;
    canHunterClaim(hunterId: string): Promise<boolean>;
    getBountyClaimsCount(bountyId: string): Promise<number>;
    canBountyAcceptClaim(bountyId: string): Promise<boolean>;
    createClaim(organizationId: string, dto: CreateClaimDTO): Promise<BountyClaim>;
    getClaimById(claimId: string, organizationId?: string): Promise<BountyClaim | null>;
    getClaimsForBounty(bountyId: string, organizationId?: string): Promise<BountyClaim[]>;
    getClaimsByHunter(hunterId: string, status?: BountyClaimStatus, organizationId?: string): Promise<BountyClaim[]>;
    getActiveClaimsByHunter(hunterId: string): Promise<BountyClaim[]>;
    abandonClaim(claimId: string, userId: string, userName: string): Promise<BountyClaim>;
    submitEvidence(claimId: string, userId: string, dto: SubmitEvidenceDTO): Promise<BountyEvidence>;
    getEvidenceForClaim(claimId: string): Promise<BountyEvidence[]>;
    deleteEvidence(evidenceId: string, userId: string): Promise<void>;
    submitClaimForReview(claimId: string, userId: string, userName: string, completionNotes?: string): Promise<BountyClaim>;
    approveClaim(claimId: string, verifierId: string, verifierName: string, verificationNotes?: string): Promise<BountyClaim>;
    completeClaim(claimId: string, verifierId: string, verifierName: string): Promise<BountyClaim>;
    rejectClaim(claimId: string, verifierId: string, verifierName: string, reason?: string): Promise<BountyClaim>;
    getHunterStats(hunterId: string): Promise<{
        totalClaims: number;
        activeClaims: number;
        completedClaims: number;
        abandonedClaims: number;
        rejectedClaims: number;
    }>;
    getPendingApprovalsForCreator(organizationId: string, creatorId: string): Promise<BountyClaim[]>;
    getUnpaidCompletedClaims(organizationId: string): Promise<BountyClaim[]>;
    markClaimPaid(claimId: string, payerId: string, payerName: string, paymentReference?: string, paymentNotes?: string): Promise<BountyClaim>;
    getRewardTrackingStats(organizationId: string): Promise<{
        totalPendingRewards: number;
        totalPaidRewards: number;
        pendingClaimsCount: number;
        paidClaimsCount: number;
    }>;
}
//# sourceMappingURL=BountyClaimService.d.ts.map