// Bounty Services Index
// Phase 1 - Core Bounty Management
// Phase 2 - Claiming & Submission Workflow
// Phase 3 - Approval Workflow & Rewards
// Phase 4 - Hunter Profiles & Analytics

export { BountyService } from './BountyService';
export type {
    CreateBountyDTO,
    UpdateBountyDTO,
    BountySearchFilters,
    BountyStatistics
} from './BountyService';

export { BountyAuditAction } from './BountyService';

// Phase 2 exports
export { BountyClaimService } from './BountyClaimService';
export type {
    CreateClaimDTO,
    SubmitEvidenceDTO,
    ClaimLimitConfig
} from './BountyClaimService';

export { ClaimAuditAction } from './BountyClaimService';

// Phase 3 exports
export { BountyNotificationService, BountyNotificationType } from './BountyNotificationService';

// Phase 4 exports
export { HunterProfileService, HunterProfileAuditAction } from './HunterProfileService';
export type {
    HunterLeaderboardEntry,
    HunterBountyHistoryEntry,
    HunterAnalyticsSummary
} from './HunterProfileService';

/**
 * Bounty Service Domain Architecture
 * 
 * This module provides bounty hunting functionality for the fleet management system.
 * 
 * Features:
 * - 6 bounty types: kill, capture, intel, transport, rescue, custom
 * - Full lifecycle management: create, claim, complete, verify, pay
 * - Multi-tenant organization support
 * - Comprehensive search and filtering
 * - Statistics and analytics
 * - Audit logging
 * - Claim limits and tracking (Phase 2)
 * - Evidence submission workflow (Phase 2)
 * - Approval workflow with notifications (Phase 3)
 * - Reward distribution tracking (Phase 3)
 * - Hunter profiles with stats and leaderboards (Phase 4)
 * - Bounty history tracking (Phase 4)
 * - Analytics dashboard (Phase 4)
 * 
 * @since Phase 1 - Core Bounty Management
 * @since Phase 2 - Claiming & Submission Workflow
 * @since Phase 3 - Approval Workflow & Rewards
 * @since Phase 4 - Hunter Profiles & Analytics
 */

