import { Bounty } from '../../models/Bounty';
import { BountyClaim } from '../../models/BountyClaim';
import { HunterProfile, HunterRank } from '../../models/HunterProfile';
export declare enum BountyNotificationType {
    BOUNTY_CREATED = "bounty_created",
    BOUNTY_CLAIMED = "bounty_claimed",
    BOUNTY_SUBMITTED = "bounty_submitted",
    BOUNTY_APPROVED = "bounty_approved",
    BOUNTY_REJECTED = "bounty_rejected",
    BOUNTY_PAID = "bounty_paid",
    BOUNTY_CANCELLED = "bounty_cancelled",
    BOUNTY_EXPIRED = "bounty_expired",
    HUNTER_RANK_CHANGED = "hunter_rank_changed"
}
export declare class BountyNotificationService {
    notifyBountyCreated(bounty: Bounty): void;
    notifyBountyClaimed(bounty: Bounty, claim: BountyClaim): void;
    notifyBountySubmitted(bounty: Bounty, claim: BountyClaim): void;
    notifyBountyApproved(bounty: Bounty, claim: BountyClaim, verifierName: string): void;
    notifyHunterRankPromotion(profile: HunterProfile, previousRank: HunterRank, newRank: HunterRank): void;
    notifyBountyRejected(bounty: Bounty, claim: BountyClaim, verifierName: string, reason?: string): void;
    notifyBountyPaid(bounty: Bounty, claim: BountyClaim, paymentReference?: string): void;
    notifyBountyCancelled(bounty: Bounty, claim?: BountyClaim, reason?: string): void;
    notifyBountyExpired(bounty: Bounty, claim?: BountyClaim): void;
}
//# sourceMappingURL=BountyNotificationService.d.ts.map