import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Bounty, BountyStatus } from '../../models/Bounty';
import { BountyClaim, BountyClaimStatus } from '../../models/BountyClaim';
import { BountyEvidence, EvidenceType } from '../../models/BountyEvidence';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';

import { BountyNotificationService } from './BountyNotificationService';
import { HunterProfileService } from './HunterProfileService';

/**
 * Claim audit event types
 */
export enum ClaimAuditAction {
  CLAIM_CREATED = 'CLAIM_CREATED',
  CLAIM_SUBMITTED = 'CLAIM_SUBMITTED',
  CLAIM_COMPLETED = 'CLAIM_COMPLETED',
  CLAIM_ABANDONED = 'CLAIM_ABANDONED',
  CLAIM_REJECTED = 'CLAIM_REJECTED',
  CLAIM_APPROVED = 'CLAIM_APPROVED',
  CLAIM_PAID = 'CLAIM_PAID',
  EVIDENCE_ADDED = 'EVIDENCE_ADDED',
  EVIDENCE_DELETED = 'EVIDENCE_DELETED',
}

/**
 * DTO for creating a claim
 */
export interface CreateClaimDTO {
  bountyId: string;
  hunterId: string;
  hunterName: string;
  notes?: string;
}

/**
 * DTO for submitting evidence
 */
export interface SubmitEvidenceDTO {
  evidenceType: EvidenceType;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

/**
 * Configuration for claim limits
 */
export interface ClaimLimitConfig {
  maxActiveClaimsPerHunter: number;
  maxClaimsPerBounty: number;
}

const DEFAULT_CLAIM_LIMITS: ClaimLimitConfig = {
  maxActiveClaimsPerHunter: 5,
  maxClaimsPerBounty: 1,
};

/**
 * BountyClaimService
 *
 * Manages bounty claim lifecycle including:
 * - Claim creation with limit enforcement
 * - Evidence submission
 * - Claim completion workflow
 * - Phase 3: Approval/rejection workflow with notifications
 */
export class BountyClaimService {
  private readonly claimRepository: Repository<BountyClaim>;
  private readonly evidenceRepository: Repository<BountyEvidence>;
  private readonly bountyRepository: Repository<Bounty>;
  private readonly claimLimits: ClaimLimitConfig;
  private readonly notificationService: BountyNotificationService;
  private hunterProfileService: HunterProfileService | null = null;

  constructor(claimLimits?: Partial<ClaimLimitConfig>) {
    this.claimRepository = AppDataSource.getRepository(BountyClaim);
    this.evidenceRepository = AppDataSource.getRepository(BountyEvidence);
    this.bountyRepository = AppDataSource.getRepository(Bounty);
    this.claimLimits = { ...DEFAULT_CLAIM_LIMITS, ...claimLimits };
    this.notificationService = new BountyNotificationService();
  }

  /**
   * Lazily resolve the hunter-profile service. Built on first use (only when a
   * claim transition recalculates stats) so importing this service never eagerly
   * constructs the profile stack.
   */
  private getHunterProfileService(): HunterProfileService {
    this.hunterProfileService ??= new HunterProfileService();
    return this.hunterProfileService;
  }

  /**
   * Recalculate the hunter's denormalized profile stats (totals, success rate,
   * rank, reputation) after a claim transition that affects them
   * (approve/abandon/reject). Best-effort: the transition has already committed,
   * so a stats failure must not fail it. The recalculation re-aggregates from the
   * claim table, so it is idempotent and self-heals on the next transition if a
   * run is missed (e.g. a non-UUID hunter id is rejected by the profile service).
   */
  private async recalculateHunterStats(claim: BountyClaim): Promise<void> {
    try {
      await this.getHunterProfileService().updateHunterStats(
        claim.organizationId,
        claim.hunterId,
        claim.hunterName
      );
    } catch (error: unknown) {
      logger.warn(
        `Failed to recalculate hunter stats for ${claim.hunterId} after claim ${claim.id}`,
        error
      );
    }
  }

  /**
   * Log a claim audit event
   */
  private logClaimAudit(
    action: ClaimAuditAction,
    claim: BountyClaim,
    performedById: string,
    performedByName: string,
    details?: Record<string, unknown>
  ): void {
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: performedById,
      username: performedByName,
      resource: `bounty-claim/${claim.id}`,
      action,
      message: `Claim ${action}: bounty ${claim.bountyId}`,
      metadata: {
        claimId: claim.id,
        bountyId: claim.bountyId,
        status: claim.status,
        ...details,
      },
    });

    logger.debug('Claim audit logged', {
      action,
      claimId: claim.id,
      performedBy: performedByName,
    });
  }

  // ==================== CLAIM LIMITS ====================

  /**
   * Get count of active claims for a hunter
   */
  async getActiveClaimsCount(hunterId: string): Promise<number> {
    return this.claimRepository.count({
      where: {
        hunterId,
        status: BountyClaimStatus.ACTIVE,
      },
    });
  }

  /**
   * Check if hunter can claim more bounties
   */
  async canHunterClaim(hunterId: string): Promise<boolean> {
    const activeCount = await this.getActiveClaimsCount(hunterId);
    return activeCount < this.claimLimits.maxActiveClaimsPerHunter;
  }

  /**
   * Get count of active claims for a bounty
   */
  async getBountyClaimsCount(bountyId: string): Promise<number> {
    return this.claimRepository.count({
      where: {
        bountyId,
        status: BountyClaimStatus.ACTIVE,
      },
    });
  }

  /**
   * Check if bounty can accept more claims
   */
  async canBountyAcceptClaim(bountyId: string): Promise<boolean> {
    const claimCount = await this.getBountyClaimsCount(bountyId);
    return claimCount < this.claimLimits.maxClaimsPerBounty;
  }

  // ==================== CLAIM MANAGEMENT ====================

  /**
   * Create a new claim on a bounty
   */
  async createClaim(organizationId: string, dto: CreateClaimDTO): Promise<BountyClaim> {
    // Check if bounty exists and is claimable — scoped by organization
    const bounty = await this.bountyRepository.findOne({
      where: { id: dto.bountyId, organizationId },
    });

    if (!bounty) {
      throw new NotFoundError('Bounty');
    }

    if (bounty.status !== BountyStatus.ACTIVE) {
      throw new ValidationError('Bounty is not available for claiming');
    }

    // Check if hunter already has a claim on this bounty
    const existingClaim = await this.claimRepository.findOne({
      where: {
        bountyId: dto.bountyId,
        hunterId: dto.hunterId,
        status: BountyClaimStatus.ACTIVE,
      },
    });

    if (existingClaim) {
      throw new ValidationError('You already have an active claim on this bounty');
    }

    // Check hunter claim limits
    const canClaim = await this.canHunterClaim(dto.hunterId);
    if (!canClaim) {
      throw new ValidationError(
        `You have reached the maximum of ${this.claimLimits.maxActiveClaimsPerHunter} active claims`
      );
    }

    // Check bounty claim limits
    const bountyCanAccept = await this.canBountyAcceptClaim(dto.bountyId);
    if (!bountyCanAccept) {
      throw new ValidationError('This bounty already has the maximum number of claims');
    }

    // Check if hunter is not the creator
    if (bounty.createdBy === dto.hunterId) {
      throw new ForbiddenError('Cannot claim your own bounty');
    }

    // Create the claim
    const claim = this.claimRepository.create({
      bountyId: dto.bountyId,
      hunterId: dto.hunterId,
      hunterName: dto.hunterName,
      organizationId,
      status: BountyClaimStatus.ACTIVE,
      notes: dto.notes,
      claimedAt: new Date(),
    });

    const savedClaim = await this.claimRepository.save(claim);

    // Update bounty status to claimed
    await this.bountyRepository.update(dto.bountyId, {
      status: BountyStatus.CLAIMED,
      claimedBy: dto.hunterId,
      claimedByName: dto.hunterName,
      claimedAt: new Date(),
    });

    this.logClaimAudit(ClaimAuditAction.CLAIM_CREATED, savedClaim, dto.hunterId, dto.hunterName);

    logger.info(`Claim created: ${savedClaim.id} for bounty ${dto.bountyId} by ${dto.hunterName}`);
    return savedClaim;
  }

  /**
   * Get a claim by ID, scoped to an organization
   */
  async getClaimById(claimId: string, organizationId?: string): Promise<BountyClaim | null> {
    const where: Record<string, unknown> = { id: claimId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.claimRepository.findOne({
      where,
      relations: ['evidence', 'bounty'],
    });
  }

  /**
   * Get claims for a bounty, scoped to an organization
   */
  async getClaimsForBounty(bountyId: string, organizationId?: string): Promise<BountyClaim[]> {
    const where: Record<string, unknown> = { bountyId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.claimRepository.find({
      where,
      relations: ['evidence'],
      order: { claimedAt: 'DESC' },
    });
  }

  /**
   * Get claims by hunter, optionally scoped to an organization
   */
  async getClaimsByHunter(
    hunterId: string,
    status?: BountyClaimStatus,
    organizationId?: string
  ): Promise<BountyClaim[]> {
    const where: Record<string, unknown> = { hunterId };
    if (status) {
      where.status = status;
    }
    if (organizationId) {
      where.organizationId = organizationId;
    }

    return this.claimRepository.find({
      where,
      relations: ['evidence', 'bounty'],
      order: { claimedAt: 'DESC' },
    });
  }

  /**
   * Get active claims by hunter
   */
  async getActiveClaimsByHunter(hunterId: string): Promise<BountyClaim[]> {
    return this.getClaimsByHunter(hunterId, BountyClaimStatus.ACTIVE);
  }

  /**
   * Abandon a claim
   */
  async abandonClaim(claimId: string, userId: string, userName: string): Promise<BountyClaim> {
    const claim = await this.getClaimById(claimId);

    if (!claim) {
      throw new NotFoundError('Claim');
    }

    if (claim.hunterId !== userId) {
      throw new ForbiddenError('You can only abandon your own claims');
    }

    if (!claim.canBeAbandoned) {
      throw new ValidationError('Claim cannot be abandoned in its current state');
    }

    claim.status = BountyClaimStatus.ABANDONED;
    const updated = await this.claimRepository.save(claim);

    // Reset bounty status if this was the only active claim
    const activeClaimsCount = await this.getBountyClaimsCount(claim.bountyId);
    if (activeClaimsCount === 0) {
      await this.bountyRepository.update(claim.bountyId, {
        status: BountyStatus.ACTIVE,
        claimedBy: undefined,
        claimedByName: undefined,
        claimedAt: undefined,
      });
    }

    this.logClaimAudit(ClaimAuditAction.CLAIM_ABANDONED, updated, userId, userName);

    // Abandonment lowers the hunter's success rate (and can lower rank).
    await this.recalculateHunterStats(updated);

    logger.info(`Claim abandoned: ${claimId} by ${userName}`);
    return updated;
  }

  // ==================== EVIDENCE MANAGEMENT ====================

  /**
   * Submit evidence for a claim
   */
  async submitEvidence(
    claimId: string,
    userId: string,
    dto: SubmitEvidenceDTO
  ): Promise<BountyEvidence> {
    const claim = await this.getClaimById(claimId);

    if (!claim) {
      throw new NotFoundError('Claim');
    }

    if (claim.hunterId !== userId) {
      throw new ForbiddenError('You can only submit evidence for your own claims');
    }

    if (!claim.canSubmitEvidence) {
      throw new ValidationError('Cannot submit evidence for this claim');
    }

    const evidence = this.evidenceRepository.create({
      claimId,
      evidenceType: dto.evidenceType,
      content: dto.content,
      fileUrl: dto.fileUrl,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType,
      submittedBy: userId,
      submittedAt: new Date(),
    });

    const saved = await this.evidenceRepository.save(evidence);

    logger.info(`Evidence submitted: ${saved.id} for claim ${claimId}`);
    return saved;
  }

  /**
   * Get evidence for a claim
   */
  async getEvidenceForClaim(claimId: string): Promise<BountyEvidence[]> {
    return this.evidenceRepository.find({
      where: { claimId },
      order: { submittedAt: 'DESC' },
    });
  }

  /**
   * Delete evidence
   */
  async deleteEvidence(evidenceId: string, userId: string): Promise<void> {
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId },
      relations: ['claim'],
    });

    if (!evidence) {
      throw new NotFoundError('Evidence');
    }

    if (evidence.submittedBy !== userId) {
      throw new ForbiddenError('You can only delete your own evidence');
    }

    await this.evidenceRepository.delete(evidenceId);

    logger.info(`Evidence deleted: ${evidenceId} by ${userId}`);
  }

  // ==================== SUBMISSION WORKFLOW ====================

  /**
   * Submit a claim for review (mark as submitted with evidence)
   */
  async submitClaimForReview(
    claimId: string,
    userId: string,
    userName: string,
    completionNotes?: string
  ): Promise<BountyClaim> {
    const claim = await this.getClaimById(claimId);

    if (!claim) {
      throw new NotFoundError('Claim');
    }

    if (claim.hunterId !== userId) {
      throw new ForbiddenError('You can only submit your own claims');
    }

    if (claim.status !== BountyClaimStatus.ACTIVE) {
      throw new ValidationError('Only active claims can be submitted');
    }

    // Check if there's at least one piece of evidence
    const evidenceCount = await this.evidenceRepository.count({
      where: { claimId },
    });

    if (evidenceCount === 0) {
      throw new ValidationError(
        'You must submit at least one piece of evidence before submitting the claim'
      );
    }

    claim.status = BountyClaimStatus.SUBMITTED;
    claim.submittedAt = new Date();
    if (completionNotes) {
      claim.notes = completionNotes;
    }

    const updated = await this.claimRepository.save(claim);

    // Update bounty status to completed (pending verification)
    await this.bountyRepository.update(claim.bountyId, {
      status: BountyStatus.COMPLETED,
      completedAt: new Date(),
    });

    this.logClaimAudit(ClaimAuditAction.CLAIM_SUBMITTED, updated, userId, userName);

    logger.info(`Claim submitted for review: ${claimId} by ${userName}`);
    return updated;
  }

  /**
   * Phase 3: Approve a claim (verify completion and send notifications)
   * This is the main approval workflow method for bounty creators
   */
  async approveClaim(
    claimId: string,
    verifierId: string,
    verifierName: string,
    verificationNotes?: string
  ): Promise<BountyClaim> {
    const claim = await this.getClaimById(claimId);

    if (!claim) {
      throw new NotFoundError('Claim');
    }

    if (claim.status !== BountyClaimStatus.SUBMITTED) {
      throw new ValidationError('Only submitted claims can be approved');
    }

    // Get the bounty to validate the verifier is the creator
    const bounty = await this.bountyRepository.findOne({
      where: { id: claim.bountyId, organizationId: claim.organizationId },
    });

    if (!bounty) {
      throw new NotFoundError('Bounty');
    }

    if (bounty.createdBy !== verifierId) {
      throw new ForbiddenError('Only the bounty creator can approve claims');
    }

    // Update claim status
    claim.status = BountyClaimStatus.COMPLETED;
    claim.completedAt = new Date();
    if (verificationNotes) {
      claim.notes = `${claim.notes ? `${claim.notes}\n` : ''}Verification: ${verificationNotes}`;
    }

    const updated = await this.claimRepository.save(claim);

    // Update bounty status to verified
    await this.bountyRepository.update(claim.bountyId, {
      status: BountyStatus.VERIFIED,
      verifiedBy: verifierId,
      verifiedAt: new Date(),
    });

    // Send approval notification to hunter
    this.notificationService.notifyBountyApproved(bounty, updated, verifierName);

    this.logClaimAudit(ClaimAuditAction.CLAIM_APPROVED, updated, verifierId, verifierName, {
      verificationNotes,
    });

    // A completed claim is the primary driver of the hunter's totals and rank.
    await this.recalculateHunterStats(updated);

    logger.info(`Claim approved: ${claimId} by ${verifierName}`);
    return updated;
  }

  /**
   * Complete a claim (after verification) - legacy method
   * @deprecated Use approveClaim for Phase 3 approval workflow with notifications
   */
  async completeClaim(
    claimId: string,
    verifierId: string,
    verifierName: string
  ): Promise<BountyClaim> {
    return this.approveClaim(claimId, verifierId, verifierName);
  }

  /**
   * Phase 3: Reject a claim with reason and notifications
   */
  async rejectClaim(
    claimId: string,
    verifierId: string,
    verifierName: string,
    reason?: string
  ): Promise<BountyClaim> {
    const claim = await this.getClaimById(claimId);

    if (!claim) {
      throw new NotFoundError('Claim');
    }

    if (claim.status !== BountyClaimStatus.SUBMITTED) {
      throw new ValidationError('Only submitted claims can be rejected');
    }

    // Get the bounty to validate the verifier is the creator
    const bounty = await this.bountyRepository.findOne({
      where: { id: claim.bountyId, organizationId: claim.organizationId },
    });

    if (!bounty) {
      throw new NotFoundError('Bounty');
    }

    if (bounty.createdBy !== verifierId) {
      throw new ForbiddenError('Only the bounty creator can reject claims');
    }

    claim.status = BountyClaimStatus.REJECTED;
    if (reason) {
      claim.notes = `Rejected: ${reason}`;
    }

    const updated = await this.claimRepository.save(claim);

    // Reset bounty status back to active so it can be claimed again
    await this.bountyRepository.update(claim.bountyId, {
      status: BountyStatus.ACTIVE,
      claimedBy: undefined,
      claimedByName: undefined,
      claimedAt: undefined,
      completedAt: undefined,
    });

    // Send rejection notification to hunter
    this.notificationService.notifyBountyRejected(bounty, updated, verifierName, reason);

    this.logClaimAudit(ClaimAuditAction.CLAIM_REJECTED, updated, verifierId, verifierName, {
      reason,
    });

    // Rejection lowers the hunter's success rate (and can lower rank).
    await this.recalculateHunterStats(updated);

    logger.info(`Claim rejected: ${claimId} by ${verifierName}${reason ? ` - ${reason}` : ''}`);
    return updated;
  }

  // ==================== STATISTICS ====================

  /**
   * Get claim statistics for a hunter
   */
  async getHunterStats(hunterId: string): Promise<{
    totalClaims: number;
    activeClaims: number;
    completedClaims: number;
    abandonedClaims: number;
    rejectedClaims: number;
  }> {
    // SQL aggregation instead of loading all claims and filtering in JS
    const statusCounts = await this.claimRepository
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('c."hunterId" = :hunterId', { hunterId })
      .groupBy('c.status')
      .getRawMany<{ status: string; count: number }>();

    const statusMap = new Map(statusCounts.map(r => [r.status, r.count]));
    const totalClaims = statusCounts.reduce((sum, r) => sum + r.count, 0);

    return {
      totalClaims,
      activeClaims: statusMap.get(BountyClaimStatus.ACTIVE) ?? 0,
      completedClaims: statusMap.get(BountyClaimStatus.COMPLETED) ?? 0,
      abandonedClaims: statusMap.get(BountyClaimStatus.ABANDONED) ?? 0,
      rejectedClaims: statusMap.get(BountyClaimStatus.REJECTED) ?? 0,
    };
  }

  // ==================== PHASE 3: APPROVAL WORKFLOW ====================

  /**
   * Get pending claims awaiting approval for a bounty creator
   * This shows all claims that are submitted and ready for review
   */
  async getPendingApprovalsForCreator(
    organizationId: string,
    creatorId: string
  ): Promise<BountyClaim[]> {
    // Get all bounties created by this user that have submitted claims
    // Note: When a claim is submitted for review, bounty status changes to COMPLETED
    const bounties = await this.bountyRepository.find({
      where: {
        organizationId,
        createdBy: creatorId,
        status: BountyStatus.COMPLETED,
      },
    });

    if (bounties.length === 0) {
      return [];
    }

    const bountyIds = bounties.map(b => b.id);

    // Get all submitted claims for these bounties
    const claims = await this.claimRepository.find({
      where: bountyIds.map(id => ({
        bountyId: id,
        status: BountyClaimStatus.SUBMITTED,
      })),
      relations: ['evidence', 'bounty'],
      order: { submittedAt: 'ASC' },
    });

    return claims;
  }

  /**
   * Get completed claims for reward tracking
   * Returns claims that have been approved but not yet paid
   */
  async getUnpaidCompletedClaims(organizationId: string): Promise<BountyClaim[]> {
    // Get all bounties that are verified but not paid
    const bounties = await this.bountyRepository.find({
      where: {
        organizationId,
        status: BountyStatus.VERIFIED,
      },
    });

    if (bounties.length === 0) {
      return [];
    }

    const bountyIds = bounties.map(b => b.id);

    // Get completed claims for these bounties
    const claims = await this.claimRepository.find({
      where: bountyIds.map(id => ({
        bountyId: id,
        status: BountyClaimStatus.COMPLETED,
      })),
      relations: ['bounty'],
      order: { completedAt: 'DESC' },
    });

    return claims;
  }

  /**
   * Mark a bounty as paid and notify the hunter
   */
  async markClaimPaid(
    claimId: string,
    payerId: string,
    payerName: string,
    paymentReference?: string,
    paymentNotes?: string
  ): Promise<BountyClaim> {
    const claim = await this.getClaimById(claimId);

    if (!claim) {
      throw new NotFoundError('Claim');
    }

    if (claim.status !== BountyClaimStatus.COMPLETED) {
      throw new ValidationError('Only completed claims can be marked as paid');
    }

    // Get the bounty
    const bounty = await this.bountyRepository.findOne({
      where: { id: claim.bountyId },
    });

    if (!bounty) {
      throw new NotFoundError('Bounty');
    }

    if (bounty.createdBy !== payerId) {
      throw new ForbiddenError('Only the bounty creator can mark claims as paid');
    }

    // Update bounty to paid status
    await this.bountyRepository.update(claim.bountyId, {
      status: BountyStatus.PAID,
      paidAt: new Date(),
      metadata: {
        ...bounty.metadata,
        paymentReference,
        paymentNotes,
      },
    });

    // Send payment notification to hunter
    this.notificationService.notifyBountyPaid(bounty, claim, paymentReference);

    this.logClaimAudit(ClaimAuditAction.CLAIM_PAID, claim, payerId, payerName, {
      paymentReference,
      paymentNotes,
      rewardAmount: bounty.rewardAmount,
    });

    logger.info(`Claim marked as paid: ${claimId} by ${payerName}`);
    return claim;
  }

  /**
   * Get reward tracking statistics for an organization
   */
  async getRewardTrackingStats(organizationId: string): Promise<{
    totalPendingRewards: number;
    totalPaidRewards: number;
    pendingClaimsCount: number;
    paidClaimsCount: number;
  }> {
    // Get all bounties for this organization
    const bounties = await this.bountyRepository.find({
      where: { organizationId },
    });

    let totalPendingRewards = 0;
    let totalPaidRewards = 0;
    let pendingClaimsCount = 0;
    let paidClaimsCount = 0;

    for (const bounty of bounties) {
      if (bounty.status === BountyStatus.VERIFIED) {
        totalPendingRewards += bounty.rewardAmount || 0;
        pendingClaimsCount++;
      } else if (bounty.status === BountyStatus.PAID) {
        totalPaidRewards += bounty.rewardAmount || 0;
        paidClaimsCount++;
      }
    }

    return {
      totalPendingRewards,
      totalPaidRewards,
      pendingClaimsCount,
      paidClaimsCount,
    };
  }
}

