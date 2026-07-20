"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BountyClaimService = exports.ClaimAuditAction = void 0;
const data_source_1 = require("../../data-source");
const Bounty_1 = require("../../models/Bounty");
const BountyClaim_1 = require("../../models/BountyClaim");
const BountyEvidence_1 = require("../../models/BountyEvidence");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const BountyNotificationService_1 = require("./BountyNotificationService");
const HunterProfileService_1 = require("./HunterProfileService");
var ClaimAuditAction;
(function (ClaimAuditAction) {
    ClaimAuditAction["CLAIM_CREATED"] = "CLAIM_CREATED";
    ClaimAuditAction["CLAIM_SUBMITTED"] = "CLAIM_SUBMITTED";
    ClaimAuditAction["CLAIM_COMPLETED"] = "CLAIM_COMPLETED";
    ClaimAuditAction["CLAIM_ABANDONED"] = "CLAIM_ABANDONED";
    ClaimAuditAction["CLAIM_REJECTED"] = "CLAIM_REJECTED";
    ClaimAuditAction["CLAIM_APPROVED"] = "CLAIM_APPROVED";
    ClaimAuditAction["CLAIM_PAID"] = "CLAIM_PAID";
    ClaimAuditAction["EVIDENCE_ADDED"] = "EVIDENCE_ADDED";
    ClaimAuditAction["EVIDENCE_DELETED"] = "EVIDENCE_DELETED";
})(ClaimAuditAction || (exports.ClaimAuditAction = ClaimAuditAction = {}));
const DEFAULT_CLAIM_LIMITS = {
    maxActiveClaimsPerHunter: 5,
    maxClaimsPerBounty: 1,
};
class BountyClaimService {
    claimRepository;
    evidenceRepository;
    bountyRepository;
    claimLimits;
    notificationService;
    hunterProfileService = null;
    constructor(claimLimits) {
        this.claimRepository = data_source_1.AppDataSource.getRepository(BountyClaim_1.BountyClaim);
        this.evidenceRepository = data_source_1.AppDataSource.getRepository(BountyEvidence_1.BountyEvidence);
        this.bountyRepository = data_source_1.AppDataSource.getRepository(Bounty_1.Bounty);
        this.claimLimits = { ...DEFAULT_CLAIM_LIMITS, ...claimLimits };
        this.notificationService = new BountyNotificationService_1.BountyNotificationService();
    }
    getHunterProfileService() {
        this.hunterProfileService ??= new HunterProfileService_1.HunterProfileService();
        return this.hunterProfileService;
    }
    async recalculateHunterStats(claim) {
        try {
            await this.getHunterProfileService().updateHunterStats(claim.organizationId, claim.hunterId, claim.hunterName);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to recalculate hunter stats for ${claim.hunterId} after claim ${claim.id}`, error);
        }
    }
    logClaimAudit(action, claim, performedById, performedByName, details) {
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
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
        logger_1.logger.debug('Claim audit logged', {
            action,
            claimId: claim.id,
            performedBy: performedByName,
        });
    }
    async getActiveClaimsCount(hunterId) {
        return this.claimRepository.count({
            where: {
                hunterId,
                status: BountyClaim_1.BountyClaimStatus.ACTIVE,
            },
        });
    }
    async canHunterClaim(hunterId) {
        const activeCount = await this.getActiveClaimsCount(hunterId);
        return activeCount < this.claimLimits.maxActiveClaimsPerHunter;
    }
    async getBountyClaimsCount(bountyId) {
        return this.claimRepository.count({
            where: {
                bountyId,
                status: BountyClaim_1.BountyClaimStatus.ACTIVE,
            },
        });
    }
    async canBountyAcceptClaim(bountyId) {
        const claimCount = await this.getBountyClaimsCount(bountyId);
        return claimCount < this.claimLimits.maxClaimsPerBounty;
    }
    async createClaim(organizationId, dto) {
        const bounty = await this.bountyRepository.findOne({
            where: { id: dto.bountyId, organizationId },
        });
        if (!bounty) {
            throw new apiErrors_1.NotFoundError('Bounty');
        }
        if (bounty.status !== Bounty_1.BountyStatus.ACTIVE) {
            throw new apiErrors_1.ValidationError('Bounty is not available for claiming');
        }
        const existingClaim = await this.claimRepository.findOne({
            where: {
                bountyId: dto.bountyId,
                hunterId: dto.hunterId,
                status: BountyClaim_1.BountyClaimStatus.ACTIVE,
            },
        });
        if (existingClaim) {
            throw new apiErrors_1.ValidationError('You already have an active claim on this bounty');
        }
        const canClaim = await this.canHunterClaim(dto.hunterId);
        if (!canClaim) {
            throw new apiErrors_1.ValidationError(`You have reached the maximum of ${this.claimLimits.maxActiveClaimsPerHunter} active claims`);
        }
        const bountyCanAccept = await this.canBountyAcceptClaim(dto.bountyId);
        if (!bountyCanAccept) {
            throw new apiErrors_1.ValidationError('This bounty already has the maximum number of claims');
        }
        if (bounty.createdBy === dto.hunterId) {
            throw new apiErrors_1.ForbiddenError('Cannot claim your own bounty');
        }
        const claim = this.claimRepository.create({
            bountyId: dto.bountyId,
            hunterId: dto.hunterId,
            hunterName: dto.hunterName,
            organizationId,
            status: BountyClaim_1.BountyClaimStatus.ACTIVE,
            notes: dto.notes,
            claimedAt: new Date(),
        });
        const savedClaim = await this.claimRepository.save(claim);
        await this.bountyRepository.update(dto.bountyId, {
            status: Bounty_1.BountyStatus.CLAIMED,
            claimedBy: dto.hunterId,
            claimedByName: dto.hunterName,
            claimedAt: new Date(),
        });
        this.logClaimAudit(ClaimAuditAction.CLAIM_CREATED, savedClaim, dto.hunterId, dto.hunterName);
        logger_1.logger.info(`Claim created: ${savedClaim.id} for bounty ${dto.bountyId} by ${dto.hunterName}`);
        return savedClaim;
    }
    async getClaimById(claimId, organizationId) {
        const where = { id: claimId };
        if (organizationId) {
            where.organizationId = organizationId;
        }
        return this.claimRepository.findOne({
            where,
            relations: ['evidence', 'bounty'],
        });
    }
    async getClaimsForBounty(bountyId, organizationId) {
        const where = { bountyId };
        if (organizationId) {
            where.organizationId = organizationId;
        }
        return this.claimRepository.find({
            where,
            relations: ['evidence'],
            order: { claimedAt: 'DESC' },
        });
    }
    async getClaimsByHunter(hunterId, status, organizationId) {
        const where = { hunterId };
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
    async getActiveClaimsByHunter(hunterId) {
        return this.getClaimsByHunter(hunterId, BountyClaim_1.BountyClaimStatus.ACTIVE);
    }
    async abandonClaim(claimId, userId, userName) {
        const claim = await this.getClaimById(claimId);
        if (!claim) {
            throw new apiErrors_1.NotFoundError('Claim');
        }
        if (claim.hunterId !== userId) {
            throw new apiErrors_1.ForbiddenError('You can only abandon your own claims');
        }
        if (!claim.canBeAbandoned) {
            throw new apiErrors_1.ValidationError('Claim cannot be abandoned in its current state');
        }
        claim.status = BountyClaim_1.BountyClaimStatus.ABANDONED;
        const updated = await this.claimRepository.save(claim);
        const activeClaimsCount = await this.getBountyClaimsCount(claim.bountyId);
        if (activeClaimsCount === 0) {
            await this.bountyRepository.update(claim.bountyId, {
                status: Bounty_1.BountyStatus.ACTIVE,
                claimedBy: undefined,
                claimedByName: undefined,
                claimedAt: undefined,
            });
        }
        this.logClaimAudit(ClaimAuditAction.CLAIM_ABANDONED, updated, userId, userName);
        await this.recalculateHunterStats(updated);
        logger_1.logger.info(`Claim abandoned: ${claimId} by ${userName}`);
        return updated;
    }
    async submitEvidence(claimId, userId, dto) {
        const claim = await this.getClaimById(claimId);
        if (!claim) {
            throw new apiErrors_1.NotFoundError('Claim');
        }
        if (claim.hunterId !== userId) {
            throw new apiErrors_1.ForbiddenError('You can only submit evidence for your own claims');
        }
        if (!claim.canSubmitEvidence) {
            throw new apiErrors_1.ValidationError('Cannot submit evidence for this claim');
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
        logger_1.logger.info(`Evidence submitted: ${saved.id} for claim ${claimId}`);
        return saved;
    }
    async getEvidenceForClaim(claimId) {
        return this.evidenceRepository.find({
            where: { claimId },
            order: { submittedAt: 'DESC' },
        });
    }
    async deleteEvidence(evidenceId, userId) {
        const evidence = await this.evidenceRepository.findOne({
            where: { id: evidenceId },
            relations: ['claim'],
        });
        if (!evidence) {
            throw new apiErrors_1.NotFoundError('Evidence');
        }
        if (evidence.submittedBy !== userId) {
            throw new apiErrors_1.ForbiddenError('You can only delete your own evidence');
        }
        await this.evidenceRepository.delete(evidenceId);
        logger_1.logger.info(`Evidence deleted: ${evidenceId} by ${userId}`);
    }
    async submitClaimForReview(claimId, userId, userName, completionNotes) {
        const claim = await this.getClaimById(claimId);
        if (!claim) {
            throw new apiErrors_1.NotFoundError('Claim');
        }
        if (claim.hunterId !== userId) {
            throw new apiErrors_1.ForbiddenError('You can only submit your own claims');
        }
        if (claim.status !== BountyClaim_1.BountyClaimStatus.ACTIVE) {
            throw new apiErrors_1.ValidationError('Only active claims can be submitted');
        }
        const evidenceCount = await this.evidenceRepository.count({
            where: { claimId },
        });
        if (evidenceCount === 0) {
            throw new apiErrors_1.ValidationError('You must submit at least one piece of evidence before submitting the claim');
        }
        claim.status = BountyClaim_1.BountyClaimStatus.SUBMITTED;
        claim.submittedAt = new Date();
        if (completionNotes) {
            claim.notes = completionNotes;
        }
        const updated = await this.claimRepository.save(claim);
        await this.bountyRepository.update(claim.bountyId, {
            status: Bounty_1.BountyStatus.COMPLETED,
            completedAt: new Date(),
        });
        this.logClaimAudit(ClaimAuditAction.CLAIM_SUBMITTED, updated, userId, userName);
        logger_1.logger.info(`Claim submitted for review: ${claimId} by ${userName}`);
        return updated;
    }
    async approveClaim(claimId, verifierId, verifierName, verificationNotes) {
        const claim = await this.getClaimById(claimId);
        if (!claim) {
            throw new apiErrors_1.NotFoundError('Claim');
        }
        if (claim.status !== BountyClaim_1.BountyClaimStatus.SUBMITTED) {
            throw new apiErrors_1.ValidationError('Only submitted claims can be approved');
        }
        const bounty = await this.bountyRepository.findOne({
            where: { id: claim.bountyId, organizationId: claim.organizationId },
        });
        if (!bounty) {
            throw new apiErrors_1.NotFoundError('Bounty');
        }
        if (bounty.createdBy !== verifierId) {
            throw new apiErrors_1.ForbiddenError('Only the bounty creator can approve claims');
        }
        claim.status = BountyClaim_1.BountyClaimStatus.COMPLETED;
        claim.completedAt = new Date();
        if (verificationNotes) {
            claim.notes = `${claim.notes ? `${claim.notes}\n` : ''}Verification: ${verificationNotes}`;
        }
        const updated = await this.claimRepository.save(claim);
        await this.bountyRepository.update(claim.bountyId, {
            status: Bounty_1.BountyStatus.VERIFIED,
            verifiedBy: verifierId,
            verifiedAt: new Date(),
        });
        this.notificationService.notifyBountyApproved(bounty, updated, verifierName);
        this.logClaimAudit(ClaimAuditAction.CLAIM_APPROVED, updated, verifierId, verifierName, {
            verificationNotes,
        });
        await this.recalculateHunterStats(updated);
        logger_1.logger.info(`Claim approved: ${claimId} by ${verifierName}`);
        return updated;
    }
    async completeClaim(claimId, verifierId, verifierName) {
        return this.approveClaim(claimId, verifierId, verifierName);
    }
    async rejectClaim(claimId, verifierId, verifierName, reason) {
        const claim = await this.getClaimById(claimId);
        if (!claim) {
            throw new apiErrors_1.NotFoundError('Claim');
        }
        if (claim.status !== BountyClaim_1.BountyClaimStatus.SUBMITTED) {
            throw new apiErrors_1.ValidationError('Only submitted claims can be rejected');
        }
        const bounty = await this.bountyRepository.findOne({
            where: { id: claim.bountyId, organizationId: claim.organizationId },
        });
        if (!bounty) {
            throw new apiErrors_1.NotFoundError('Bounty');
        }
        if (bounty.createdBy !== verifierId) {
            throw new apiErrors_1.ForbiddenError('Only the bounty creator can reject claims');
        }
        claim.status = BountyClaim_1.BountyClaimStatus.REJECTED;
        if (reason) {
            claim.notes = `Rejected: ${reason}`;
        }
        const updated = await this.claimRepository.save(claim);
        await this.bountyRepository.update(claim.bountyId, {
            status: Bounty_1.BountyStatus.ACTIVE,
            claimedBy: undefined,
            claimedByName: undefined,
            claimedAt: undefined,
            completedAt: undefined,
        });
        this.notificationService.notifyBountyRejected(bounty, updated, verifierName, reason);
        this.logClaimAudit(ClaimAuditAction.CLAIM_REJECTED, updated, verifierId, verifierName, {
            reason,
        });
        await this.recalculateHunterStats(updated);
        logger_1.logger.info(`Claim rejected: ${claimId} by ${verifierName}${reason ? ` - ${reason}` : ''}`);
        return updated;
    }
    async getHunterStats(hunterId) {
        const statusCounts = await this.claimRepository
            .createQueryBuilder('c')
            .select('c.status', 'status')
            .addSelect('COUNT(*)::int', 'count')
            .where('c."hunterId" = :hunterId', { hunterId })
            .groupBy('c.status')
            .getRawMany();
        const statusMap = new Map(statusCounts.map(r => [r.status, r.count]));
        const totalClaims = statusCounts.reduce((sum, r) => sum + r.count, 0);
        return {
            totalClaims,
            activeClaims: statusMap.get(BountyClaim_1.BountyClaimStatus.ACTIVE) ?? 0,
            completedClaims: statusMap.get(BountyClaim_1.BountyClaimStatus.COMPLETED) ?? 0,
            abandonedClaims: statusMap.get(BountyClaim_1.BountyClaimStatus.ABANDONED) ?? 0,
            rejectedClaims: statusMap.get(BountyClaim_1.BountyClaimStatus.REJECTED) ?? 0,
        };
    }
    async getPendingApprovalsForCreator(organizationId, creatorId) {
        const bounties = await this.bountyRepository.find({
            where: {
                organizationId,
                createdBy: creatorId,
                status: Bounty_1.BountyStatus.COMPLETED,
            },
        });
        if (bounties.length === 0) {
            return [];
        }
        const bountyIds = bounties.map(b => b.id);
        const claims = await this.claimRepository.find({
            where: bountyIds.map(id => ({
                bountyId: id,
                status: BountyClaim_1.BountyClaimStatus.SUBMITTED,
            })),
            relations: ['evidence', 'bounty'],
            order: { submittedAt: 'ASC' },
        });
        return claims;
    }
    async getUnpaidCompletedClaims(organizationId) {
        const bounties = await this.bountyRepository.find({
            where: {
                organizationId,
                status: Bounty_1.BountyStatus.VERIFIED,
            },
        });
        if (bounties.length === 0) {
            return [];
        }
        const bountyIds = bounties.map(b => b.id);
        const claims = await this.claimRepository.find({
            where: bountyIds.map(id => ({
                bountyId: id,
                status: BountyClaim_1.BountyClaimStatus.COMPLETED,
            })),
            relations: ['bounty'],
            order: { completedAt: 'DESC' },
        });
        return claims;
    }
    async markClaimPaid(claimId, payerId, payerName, paymentReference, paymentNotes) {
        const claim = await this.getClaimById(claimId);
        if (!claim) {
            throw new apiErrors_1.NotFoundError('Claim');
        }
        if (claim.status !== BountyClaim_1.BountyClaimStatus.COMPLETED) {
            throw new apiErrors_1.ValidationError('Only completed claims can be marked as paid');
        }
        const bounty = await this.bountyRepository.findOne({
            where: { id: claim.bountyId },
        });
        if (!bounty) {
            throw new apiErrors_1.NotFoundError('Bounty');
        }
        if (bounty.createdBy !== payerId) {
            throw new apiErrors_1.ForbiddenError('Only the bounty creator can mark claims as paid');
        }
        await this.bountyRepository.update(claim.bountyId, {
            status: Bounty_1.BountyStatus.PAID,
            paidAt: new Date(),
            metadata: {
                ...bounty.metadata,
                paymentReference,
                paymentNotes,
            },
        });
        this.notificationService.notifyBountyPaid(bounty, claim, paymentReference);
        this.logClaimAudit(ClaimAuditAction.CLAIM_PAID, claim, payerId, payerName, {
            paymentReference,
            paymentNotes,
            rewardAmount: bounty.rewardAmount,
        });
        logger_1.logger.info(`Claim marked as paid: ${claimId} by ${payerName}`);
        return claim;
    }
    async getRewardTrackingStats(organizationId) {
        const bounties = await this.bountyRepository.find({
            where: { organizationId },
        });
        let totalPendingRewards = 0;
        let totalPaidRewards = 0;
        let pendingClaimsCount = 0;
        let paidClaimsCount = 0;
        for (const bounty of bounties) {
            if (bounty.status === Bounty_1.BountyStatus.VERIFIED) {
                totalPendingRewards += bounty.rewardAmount || 0;
                pendingClaimsCount++;
            }
            else if (bounty.status === Bounty_1.BountyStatus.PAID) {
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
exports.BountyClaimService = BountyClaimService;
//# sourceMappingURL=BountyClaimService.js.map