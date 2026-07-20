"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BountyService = exports.BountyAuditAction = void 0;
const data_source_1 = require("../../data-source");
const Bounty_1 = require("../../models/Bounty");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const cacheInvalidation_1 = require("../../utils/cacheInvalidation");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const TenantService_1 = require("../base/TenantService");
var BountyAuditAction;
(function (BountyAuditAction) {
    BountyAuditAction["BOUNTY_CREATED"] = "BOUNTY_CREATED";
    BountyAuditAction["BOUNTY_UPDATED"] = "BOUNTY_UPDATED";
    BountyAuditAction["BOUNTY_DELETED"] = "BOUNTY_DELETED";
    BountyAuditAction["BOUNTY_CLAIMED"] = "BOUNTY_CLAIMED";
    BountyAuditAction["BOUNTY_UNCLAIMED"] = "BOUNTY_UNCLAIMED";
    BountyAuditAction["BOUNTY_COMPLETED"] = "BOUNTY_COMPLETED";
    BountyAuditAction["BOUNTY_VERIFIED"] = "BOUNTY_VERIFIED";
    BountyAuditAction["BOUNTY_PAID"] = "BOUNTY_PAID";
    BountyAuditAction["BOUNTY_CANCELLED"] = "BOUNTY_CANCELLED";
    BountyAuditAction["BOUNTY_EXPIRED"] = "BOUNTY_EXPIRED";
})(BountyAuditAction || (exports.BountyAuditAction = BountyAuditAction = {}));
class BountyService extends TenantService_1.TenantService {
    constructor() {
        super(data_source_1.AppDataSource.getRepository(Bounty_1.Bounty), {
            enableCache: true,
            cacheTTL: 600,
            cacheCheckPeriod: 120,
        });
    }
    isClaimable(bounty) {
        return bounty.status === Bounty_1.BountyStatus.ACTIVE;
    }
    isClaimed(bounty) {
        return bounty.status === Bounty_1.BountyStatus.CLAIMED || bounty.status === Bounty_1.BountyStatus.IN_PROGRESS;
    }
    isCompleted(bounty) {
        return (bounty.status === Bounty_1.BountyStatus.COMPLETED ||
            bounty.status === Bounty_1.BountyStatus.VERIFIED ||
            bounty.status === Bounty_1.BountyStatus.PAID);
    }
    isTerminal(bounty) {
        return (bounty.status === Bounty_1.BountyStatus.PAID ||
            bounty.status === Bounty_1.BountyStatus.CANCELLED ||
            bounty.status === Bounty_1.BountyStatus.EXPIRED);
    }
    logBountyAudit(action, bounty, performedById, performedByName, details) {
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: performedById,
            username: performedByName,
            resource: `bounty/${bounty.id}`,
            action,
            message: `Bounty ${action}: ${bounty.title} (${bounty.bountyType})`,
            metadata: {
                bountyId: bounty.id,
                bountyType: bounty.bountyType,
                status: bounty.status,
                ...details,
            },
        });
        logger_1.logger.debug('Bounty audit logged', {
            action,
            bountyId: bounty.id,
            performedBy: performedByName,
        });
    }
    async createBounty(organizationId, creatorId, creatorName, dto) {
        const bounty = await this.create(organizationId, {
            createdBy: creatorId,
            createdByName: creatorName,
            title: dto.title,
            description: dto.description,
            bountyType: dto.bountyType,
            targetType: dto.targetType,
            targetIdentifier: dto.targetIdentifier,
            targetName: dto.targetName,
            targetDetails: dto.targetDetails,
            rewardType: dto.rewardType,
            rewardAmount: dto.rewardAmount,
            rewardDescription: dto.rewardDescription,
            difficulty: dto.difficulty,
            location: dto.location,
            systemLocation: dto.systemLocation,
            expiresAt: dto.expiresAt,
            visibility: dto.visibility || Bounty_1.BountyVisibility.ORGANIZATION,
            tags: dto.tags || [],
            metadata: dto.metadata,
            status: Bounty_1.BountyStatus.ACTIVE,
        });
        this.logBountyAudit(BountyAuditAction.BOUNTY_CREATED, bounty, creatorId, creatorName, {
            rewardAmount: dto.rewardAmount,
            bountyType: dto.bountyType,
        });
        logger_1.logger.info(`Bounty created: ${bounty.id} (${dto.bountyType}) by ${creatorName}`);
        (0, cacheInvalidation_1.invalidateBountyStatsCache)(organizationId);
        return bounty;
    }
    async getBountyById(organizationId, bountyId) {
        return this.findById(organizationId, bountyId);
    }
    async getBountyByIdSimple(bountyId) {
        return this.findByIdSimple(bountyId);
    }
    async updateBounty(organizationId, bountyId, userId, userName, dto, options) {
        const bounty = await this.findById(organizationId, bountyId);
        if (!bounty) {
            return null;
        }
        if (bounty.createdBy !== userId && !options?.isAdmin) {
            throw new apiErrors_1.ForbiddenError('Only the bounty creator can update it');
        }
        if (bounty.status !== Bounty_1.BountyStatus.ACTIVE) {
            throw new apiErrors_1.ValidationError('Cannot update a bounty that is not active');
        }
        const updated = await this.update(organizationId, bountyId, dto);
        if (updated) {
            this.logBountyAudit(BountyAuditAction.BOUNTY_UPDATED, updated, userId, userName, {
                updates: Object.keys(dto),
            });
            (0, cacheInvalidation_1.invalidateBountyStatsCache)(organizationId);
        }
        return updated;
    }
    async claimBounty(organizationId, bountyId, userId, userName) {
        const bounty = await this.findById(organizationId, bountyId);
        if (!bounty) {
            throw new apiErrors_1.NotFoundError('Bounty');
        }
        if (!bounty.canBeClaimed) {
            throw new apiErrors_1.ValidationError('Bounty cannot be claimed');
        }
        if (bounty.createdBy === userId) {
            throw new apiErrors_1.ForbiddenError('Cannot claim your own bounty');
        }
        const updated = await this.update(organizationId, bountyId, {
            status: Bounty_1.BountyStatus.CLAIMED,
            claimedBy: userId,
            claimedByName: userName,
            claimedAt: new Date(),
        });
        if (!updated) {
            throw new apiErrors_1.ValidationError('Failed to claim bounty');
        }
        this.logBountyAudit(BountyAuditAction.BOUNTY_CLAIMED, updated, userId, userName);
        (0, cacheInvalidation_1.invalidateBountyStatsCache)(organizationId);
        logger_1.logger.info(`Bounty claimed: ${bountyId} by ${userName}`);
        return updated;
    }
    async unclaimBounty(organizationId, bountyId, userId, userName) {
        const bounty = await this.findById(organizationId, bountyId);
        if (!bounty) {
            throw new apiErrors_1.NotFoundError('Bounty');
        }
        if (!this.isClaimed(bounty)) {
            throw new apiErrors_1.ValidationError('Bounty is not claimed');
        }
        if (bounty.claimedBy !== userId) {
            throw new apiErrors_1.ForbiddenError('You can only unclaim your own claimed bounty');
        }
        const updated = await this.update(organizationId, bountyId, {
            status: Bounty_1.BountyStatus.ACTIVE,
            claimedBy: undefined,
            claimedByName: undefined,
            claimedAt: undefined,
        });
        if (!updated) {
            throw new apiErrors_1.ValidationError('Failed to unclaim bounty');
        }
        this.logBountyAudit(BountyAuditAction.BOUNTY_UNCLAIMED, updated, userId, userName);
        (0, cacheInvalidation_1.invalidateBountyStatsCache)(organizationId);
        logger_1.logger.info(`Bounty unclaimed: ${bountyId} by ${userName}`);
        return updated;
    }
    async completeBounty(organizationId, bountyId, userId, userName, evidence, completionNotes) {
        const bounty = await this.findById(organizationId, bountyId);
        if (!bounty) {
            throw new apiErrors_1.NotFoundError('Bounty');
        }
        if (!this.isClaimed(bounty)) {
            throw new apiErrors_1.ValidationError('Bounty must be claimed before completing');
        }
        if (bounty.claimedBy !== userId) {
            throw new apiErrors_1.ForbiddenError('Only the bounty hunter can mark it as completed');
        }
        const metadata = {
            ...bounty.metadata,
            evidence,
            completionNotes,
        };
        const updated = await this.update(organizationId, bountyId, {
            status: Bounty_1.BountyStatus.COMPLETED,
            completedAt: new Date(),
            metadata,
        });
        if (!updated) {
            throw new apiErrors_1.ValidationError('Failed to complete bounty');
        }
        this.logBountyAudit(BountyAuditAction.BOUNTY_COMPLETED, updated, userId, userName, {
            hasEvidence: !!evidence,
            hasNotes: !!completionNotes,
        });
        (0, cacheInvalidation_1.invalidateBountyStatsCache)(organizationId);
        logger_1.logger.info(`Bounty completed: ${bountyId} by ${userName}`);
        return updated;
    }
    async verifyBounty(organizationId, bountyId, verifierId, verifierName, approved, verificationNotes) {
        const bounty = await this.findById(organizationId, bountyId);
        if (!bounty) {
            throw new apiErrors_1.NotFoundError('Bounty');
        }
        if (bounty.status !== Bounty_1.BountyStatus.COMPLETED) {
            throw new apiErrors_1.ValidationError('Bounty must be completed before verification');
        }
        if (bounty.createdBy !== verifierId) {
            throw new apiErrors_1.ForbiddenError('Only the bounty creator can verify completion');
        }
        const metadata = {
            ...bounty.metadata,
            verificationNotes,
        };
        const newStatus = approved ? Bounty_1.BountyStatus.VERIFIED : Bounty_1.BountyStatus.CLAIMED;
        const updated = await this.update(organizationId, bountyId, {
            status: newStatus,
            verifiedBy: approved ? verifierId : undefined,
            verifiedAt: approved ? new Date() : undefined,
            metadata,
        });
        if (!updated) {
            throw new apiErrors_1.ValidationError('Failed to verify bounty');
        }
        this.logBountyAudit(BountyAuditAction.BOUNTY_VERIFIED, updated, verifierId, verifierName, {
            approved,
            hasNotes: !!verificationNotes,
        });
        (0, cacheInvalidation_1.invalidateBountyStatsCache)(organizationId);
        logger_1.logger.info(`Bounty ${approved ? 'verified' : 'rejected'}: ${bountyId} by ${verifierName}`);
        return updated;
    }
    async payBounty(organizationId, bountyId, payerId, payerName, paymentReference, paymentNotes) {
        const bounty = await this.findById(organizationId, bountyId);
        if (!bounty) {
            throw new apiErrors_1.NotFoundError('Bounty');
        }
        if (bounty.status !== Bounty_1.BountyStatus.VERIFIED) {
            throw new apiErrors_1.ValidationError('Bounty must be verified before payment');
        }
        if (bounty.createdBy !== payerId) {
            throw new apiErrors_1.ForbiddenError('Only the bounty creator can mark it as paid');
        }
        const metadata = {
            ...bounty.metadata,
            paymentReference,
            paymentNotes,
        };
        const updated = await this.update(organizationId, bountyId, {
            status: Bounty_1.BountyStatus.PAID,
            paidAt: new Date(),
            metadata,
        });
        if (!updated) {
            throw new apiErrors_1.ValidationError('Failed to mark bounty as paid');
        }
        this.logBountyAudit(BountyAuditAction.BOUNTY_PAID, updated, payerId, payerName, {
            rewardAmount: bounty.rewardAmount,
            hasReference: !!paymentReference,
        });
        (0, cacheInvalidation_1.invalidateBountyStatsCache)(organizationId);
        logger_1.logger.info(`Bounty paid: ${bountyId} by ${payerName}`);
        return updated;
    }
    async cancelBounty(organizationId, bountyId, userId, userName, reason) {
        const bounty = await this.findById(organizationId, bountyId);
        if (!bounty) {
            throw new apiErrors_1.NotFoundError('Bounty');
        }
        if (bounty.createdBy !== userId) {
            throw new apiErrors_1.ForbiddenError('Only the bounty creator can cancel it');
        }
        if (bounty.status === Bounty_1.BountyStatus.PAID) {
            throw new apiErrors_1.ValidationError('Cannot cancel a paid bounty');
        }
        const metadata = {
            ...bounty.metadata,
            cancellationReason: reason,
        };
        const updated = await this.update(organizationId, bountyId, {
            status: Bounty_1.BountyStatus.CANCELLED,
            metadata,
        });
        if (!updated) {
            throw new apiErrors_1.ValidationError('Failed to cancel bounty');
        }
        this.logBountyAudit(BountyAuditAction.BOUNTY_CANCELLED, updated, userId, userName, { reason });
        (0, cacheInvalidation_1.invalidateBountyStatsCache)(organizationId);
        logger_1.logger.info(`Bounty cancelled: ${bountyId} by ${userName}`);
        return updated;
    }
    async deleteBounty(organizationId, bountyId, userId, userName, options) {
        const bounty = await this.findById(organizationId, bountyId);
        if (!bounty) {
            throw new apiErrors_1.NotFoundError('Bounty');
        }
        if (bounty.createdBy !== userId && !options?.isAdmin) {
            throw new apiErrors_1.ForbiddenError('Only the bounty creator can delete it');
        }
        if (this.isClaimed(bounty) ||
            bounty.status === Bounty_1.BountyStatus.COMPLETED ||
            bounty.status === Bounty_1.BountyStatus.VERIFIED) {
            throw new apiErrors_1.ValidationError('Cannot delete a bounty that is in progress');
        }
        await this.softDelete(organizationId, bountyId, userId);
        this.logBountyAudit(BountyAuditAction.BOUNTY_DELETED, bounty, userId, userName);
        (0, cacheInvalidation_1.invalidateBountyStatsCache)(organizationId);
        logger_1.logger.info(`Bounty deleted: ${bountyId} by ${userName}`);
    }
    async searchBounties(organizationId, filters, page = 1, limit = 20) {
        const queryBuilder = this.repository.createQueryBuilder('bounty');
        queryBuilder.where('bounty.organizationId = :organizationId', { organizationId });
        queryBuilder.andWhere('bounty.deletedAt IS NULL');
        if (filters.bountyType) {
            queryBuilder.andWhere('bounty.bountyType = :bountyType', { bountyType: filters.bountyType });
        }
        if (filters.status) {
            queryBuilder.andWhere('bounty.status = :status', { status: filters.status });
        }
        if (filters.difficulty) {
            queryBuilder.andWhere('bounty.difficulty = :difficulty', { difficulty: filters.difficulty });
        }
        if (filters.visibility) {
            queryBuilder.andWhere('bounty.visibility = :visibility', { visibility: filters.visibility });
        }
        if (filters.targetType) {
            queryBuilder.andWhere('bounty.targetType = :targetType', { targetType: filters.targetType });
        }
        if (filters.createdBy) {
            queryBuilder.andWhere('bounty.createdBy = :createdBy', { createdBy: filters.createdBy });
        }
        if (filters.claimedBy) {
            queryBuilder.andWhere('bounty.claimedBy = :claimedBy', { claimedBy: filters.claimedBy });
        }
        if (filters.searchTerm) {
            queryBuilder.andWhere('(bounty.title ILIKE :search OR bounty.description ILIKE :search OR bounty.targetName ILIKE :search)', { search: `%${filters.searchTerm}%` });
        }
        if (filters.minReward !== undefined) {
            queryBuilder.andWhere('bounty.rewardAmount >= :minReward', { minReward: filters.minReward });
        }
        if (filters.maxReward !== undefined) {
            queryBuilder.andWhere('bounty.rewardAmount <= :maxReward', { maxReward: filters.maxReward });
        }
        if (!filters.includeExpired) {
            queryBuilder.andWhere('(bounty.expiresAt IS NULL OR bounty.expiresAt > :now)', {
                now: new Date(),
            });
        }
        const sortBy = filters.sortBy || 'createdAt';
        const sortOrder = filters.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        queryBuilder.orderBy(`bounty.${sortBy}`, sortOrder);
        const skip = (page - 1) * limit;
        queryBuilder.skip(skip).take(limit);
        const [bounties, total] = await queryBuilder.getManyAndCount();
        return {
            bounties,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async listActiveBounties(organizationId, page = 1, limit = 20) {
        return this.searchBounties(organizationId, { status: Bounty_1.BountyStatus.ACTIVE }, page, limit);
    }
    async getMyCreatedBounties(organizationId, userId, page = 1, limit = 20) {
        return this.searchBounties(organizationId, { createdBy: userId }, page, limit);
    }
    async getMyClaimedBounties(organizationId, userId, page = 1, limit = 20) {
        return this.searchBounties(organizationId, { claimedBy: userId }, page, limit);
    }
    async getStatistics(organizationId) {
        const cacheKey = `org:${organizationId}:bounty:stats`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const statusRows = await this.repository
            .createQueryBuilder('b')
            .select('b.status', 'status')
            .addSelect('COUNT(*)::int', 'count')
            .addSelect('COALESCE(SUM(b."rewardAmount"), 0)', 'rewardSum')
            .where('b."organizationId" = :orgId', { orgId: organizationId })
            .andWhere('b."deletedAt" IS NULL')
            .groupBy('b.status')
            .getRawMany();
        const typeRows = await this.repository
            .createQueryBuilder('b')
            .select('b."bountyType"', 'bountyType')
            .addSelect('COUNT(*)::int', 'count')
            .where('b."organizationId" = :orgId', { orgId: organizationId })
            .andWhere('b."deletedAt" IS NULL')
            .groupBy('b."bountyType"')
            .getRawMany();
        const avgResult = await this.repository
            .createQueryBuilder('b')
            .select(`AVG(EXTRACT(EPOCH FROM (b."completedAt" - b."claimedAt")) / 60)::int`, 'avgMinutes')
            .where('b."organizationId" = :orgId', { orgId: organizationId })
            .andWhere('b."deletedAt" IS NULL')
            .andWhere('b."claimedAt" IS NOT NULL')
            .andWhere('b."completedAt" IS NOT NULL')
            .andWhere('b.status IN (:...completedStatuses)', {
            completedStatuses: [Bounty_1.BountyStatus.COMPLETED, Bounty_1.BountyStatus.VERIFIED, Bounty_1.BountyStatus.PAID],
        })
            .getRawOne();
        const byStatus = {
            [Bounty_1.BountyStatus.ACTIVE]: 0,
            [Bounty_1.BountyStatus.CLAIMED]: 0,
            [Bounty_1.BountyStatus.IN_PROGRESS]: 0,
            [Bounty_1.BountyStatus.COMPLETED]: 0,
            [Bounty_1.BountyStatus.VERIFIED]: 0,
            [Bounty_1.BountyStatus.PAID]: 0,
            [Bounty_1.BountyStatus.CANCELLED]: 0,
            [Bounty_1.BountyStatus.EXPIRED]: 0,
        };
        const byType = {
            [Bounty_1.BountyType.KILL]: 0,
            [Bounty_1.BountyType.CAPTURE]: 0,
            [Bounty_1.BountyType.INTEL]: 0,
            [Bounty_1.BountyType.TRANSPORT]: 0,
            [Bounty_1.BountyType.RESCUE]: 0,
            [Bounty_1.BountyType.CUSTOM]: 0,
        };
        let totalBounties = 0;
        let totalRewardsPosted = 0;
        let totalRewardsPaid = 0;
        for (const row of statusRows) {
            byStatus[row.status] = row.count;
            totalBounties += row.count;
            totalRewardsPosted += Number(row.rewardSum);
            if (row.status === Bounty_1.BountyStatus.PAID) {
                totalRewardsPaid = Number(row.rewardSum);
            }
        }
        for (const row of typeRows) {
            byType[row.bountyType] = row.count;
        }
        const completedStatuses = [Bounty_1.BountyStatus.COMPLETED, Bounty_1.BountyStatus.VERIFIED, Bounty_1.BountyStatus.PAID];
        const completedBounties = completedStatuses.reduce((sum, s) => sum + (byStatus[s] || 0), 0);
        const claimedBounties = (byStatus[Bounty_1.BountyStatus.CLAIMED] || 0) + (byStatus[Bounty_1.BountyStatus.IN_PROGRESS] || 0);
        const result = {
            totalBounties,
            activeBounties: byStatus[Bounty_1.BountyStatus.ACTIVE] || 0,
            completedBounties,
            claimedBounties,
            totalRewardsPosted,
            totalRewardsPaid,
            byType,
            byStatus,
            averageCompletionTime: avgResult?.avgMinutes ?? 0,
        };
        await redis_1.cache.set(cacheKey, result, 300);
        return result;
    }
    async expireBounties() {
        const now = new Date();
        const result = await this.repository
            .createQueryBuilder()
            .update(Bounty_1.Bounty)
            .set({ status: Bounty_1.BountyStatus.EXPIRED })
            .where('status = :status', { status: Bounty_1.BountyStatus.ACTIVE })
            .andWhere('expiresAt IS NOT NULL')
            .andWhere('expiresAt < :now', { now })
            .andWhere('deletedAt IS NULL')
            .execute();
        const count = result.affected || 0;
        if (count > 0) {
            logger_1.logger.info(`Expired ${count} bounties`);
        }
        return count;
    }
}
exports.BountyService = BountyService;
//# sourceMappingURL=BountyService.js.map