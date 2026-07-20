"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelSharingService = void 0;
const uuid_1 = require("uuid");
const data_source_1 = require("../../data-source");
const IntelAuditLog_1 = require("../../models/IntelAuditLog");
const IntelEntry_1 = require("../../models/IntelEntry");
const IntelOfficer_1 = require("../../models/IntelOfficer");
const IntelShare_1 = require("../../models/IntelShare");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const OrganizationRelationship_1 = require("../../models/OrganizationRelationship");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const IntelEncryptionService_1 = require("./IntelEncryptionService");
class IntelSharingService {
    shareRepo;
    intelEntryRepo;
    intelOfficerRepo;
    auditLogRepo;
    userOrgRepo;
    relationshipRepo;
    constructor() {
        this.shareRepo = data_source_1.AppDataSource.getRepository(IntelShare_1.IntelShare);
        this.intelEntryRepo = data_source_1.AppDataSource.getRepository(IntelEntry_1.IntelEntry);
        this.intelOfficerRepo = data_source_1.AppDataSource.getRepository(IntelOfficer_1.IntelOfficer);
        this.auditLogRepo = data_source_1.AppDataSource.getRepository(IntelAuditLog_1.IntelAuditLog);
        this.userOrgRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.relationshipRepo = data_source_1.AppDataSource.getRepository(OrganizationRelationship_1.OrganizationRelationship);
    }
    async canShareIntel(userId, organizationId) {
        try {
            const userOrg = await this.userOrgRepo.findOne({
                where: { userId, organizationId, isActive: true },
            });
            if ((0, roleUtils_1.getRoleName)(userOrg?.role) === 'owner' || (0, roleUtils_1.getRoleName)(userOrg?.role) === 'founder') {
                return true;
            }
            const officer = await this.intelOfficerRepo.findOne({
                where: { userId, organizationId, isActive: true },
            });
            if (!officer) {
                return false;
            }
            return [IntelOfficer_1.IntelOfficerRank.CHIEF, IntelOfficer_1.IntelOfficerRank.LEAD].includes(officer.rank);
        }
        catch (error) {
            logger_1.logger.error('Error checking share permission:', error);
            return false;
        }
    }
    async areOrganizationsAllied(sourceOrgId, targetOrgId) {
        try {
            const relationship = await this.relationshipRepo.findOne({
                where: {
                    organizationId: sourceOrgId,
                    targetOrganizationId: targetOrgId,
                    status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
                },
            });
            if (!relationship) {
                return false;
            }
            const allowedTypes = [
                OrganizationRelationship_1.RelationshipType.ALLIED,
                OrganizationRelationship_1.RelationshipType.PARTNERSHIP,
                OrganizationRelationship_1.RelationshipType.COOPERATIVE,
            ];
            return allowedTypes.includes(relationship.type);
        }
        catch (error) {
            logger_1.logger.error('Error checking organization relationship:', error);
            return false;
        }
    }
    async createShare(input, sharedBy, ipAddress, userAgent) {
        try {
            const canShare = await this.canShareIntel(sharedBy, input.sourceOrganizationId);
            if (!canShare) {
                throw new apiErrors_1.ForbiddenError('User does not have permission to share Intel');
            }
            const areAllied = await this.areOrganizationsAllied(input.sourceOrganizationId, input.targetOrganizationId);
            if (!areAllied) {
                throw new apiErrors_1.ForbiddenError('Intel can only be shared with allied organizations');
            }
            const entry = await this.intelEntryRepo.findOne({
                where: { id: input.intelEntryId, organizationId: input.sourceOrganizationId },
            });
            if (!entry) {
                throw new apiErrors_1.NotFoundError('Intel entry');
            }
            const classificationOrder = {
                [IntelEntry_1.IntelClassification.PUBLIC]: 0,
                [IntelEntry_1.IntelClassification.RESTRICTED]: 1,
                [IntelEntry_1.IntelClassification.CONFIDENTIAL]: 2,
                [IntelEntry_1.IntelClassification.SECRET]: 3,
                [IntelEntry_1.IntelClassification.TOP_SECRET]: 4,
            };
            if (classificationOrder[entry.classification] > classificationOrder[input.maxClassification]) {
                throw new apiErrors_1.ValidationError(`Cannot share ${entry.classification} intel with max classification ${input.maxClassification}`);
            }
            const existingShare = await this.shareRepo.findOne({
                where: {
                    intelEntryId: input.intelEntryId,
                    targetOrganizationId: input.targetOrganizationId,
                    status: IntelShare_1.IntelShareStatus.ACTIVE,
                },
            });
            if (existingShare) {
                throw new apiErrors_1.ConflictError('Intel is already shared with this organization');
            }
            const share = this.shareRepo.create({
                id: (0, uuid_1.v4)(),
                ...input,
                sharedBy,
                status: IntelShare_1.IntelShareStatus.PENDING,
                viewCount: 0,
            });
            const saved = await this.shareRepo.save(share);
            await this.intelEntryRepo.update(input.intelEntryId, {
                isShared: true,
                shareCount: () => 'shareCount + 1',
            });
            await this.logAudit({
                organizationId: input.sourceOrganizationId,
                userId: sharedBy,
                intelEntryId: input.intelEntryId,
                action: IntelAuditLog_1.IntelAuditAction.SHARE_CREATED,
                description: `Shared intel with organization ${input.targetOrganizationId}`,
                ipAddress,
                userAgent,
                severity: 'info',
                metadata: {
                    shareId: saved.id,
                    targetOrgId: input.targetOrganizationId,
                    permission: input.permission,
                    maxClassification: input.maxClassification,
                },
            });
            logger_1.logger.info('Intel share created', {
                shareId: saved.id,
                intelEntryId: input.intelEntryId,
                sourceOrgId: input.sourceOrganizationId,
                targetOrgId: input.targetOrganizationId,
            });
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error creating intel share:', error);
            throw error;
        }
    }
    async acceptShare(shareId, userId, organizationId, ipAddress, userAgent) {
        try {
            const share = await this.shareRepo.findOne({
                where: { id: shareId, targetOrganizationId: organizationId },
            });
            if (!share) {
                throw new apiErrors_1.NotFoundError('Share');
            }
            if (share.status !== IntelShare_1.IntelShareStatus.PENDING) {
                throw new apiErrors_1.ConflictError(`Cannot accept share with status: ${share.status}`);
            }
            const canAccept = await this.canShareIntel(userId, organizationId);
            if (!canAccept) {
                throw new apiErrors_1.ForbiddenError('User does not have permission to accept Intel shares');
            }
            share.status = IntelShare_1.IntelShareStatus.ACTIVE;
            share.acceptedBy = userId;
            share.acceptedAt = new Date();
            const saved = await this.shareRepo.save(share);
            await this.logAudit({
                organizationId: share.targetOrganizationId,
                userId,
                intelEntryId: share.intelEntryId,
                action: IntelAuditLog_1.IntelAuditAction.SHARE_ACCEPTED,
                description: 'Accepted intel share from allied organization',
                ipAddress,
                userAgent,
                severity: 'info',
                metadata: { shareId: saved.id, sourceOrgId: share.sourceOrganizationId },
            });
            await this.logAudit({
                organizationId: share.sourceOrganizationId,
                userId: share.sharedBy,
                intelEntryId: share.intelEntryId,
                action: IntelAuditLog_1.IntelAuditAction.SHARE_ACCEPTED,
                description: `Intel share accepted by organization ${organizationId}`,
                severity: 'info',
                metadata: { shareId: saved.id, targetOrgId: organizationId, acceptedBy: userId },
            });
            logger_1.logger.info('Intel share accepted', {
                shareId: saved.id,
                acceptedBy: userId,
                organizationId,
            });
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error accepting intel share:', error);
            throw error;
        }
    }
    async declineShare(shareId, userId, organizationId, reason, ipAddress, userAgent) {
        try {
            const share = await this.shareRepo.findOne({
                where: { id: shareId, targetOrganizationId: organizationId },
            });
            if (!share) {
                throw new apiErrors_1.NotFoundError('Share');
            }
            if (share.status !== IntelShare_1.IntelShareStatus.PENDING) {
                throw new apiErrors_1.ConflictError(`Cannot decline share with status: ${share.status}`);
            }
            share.status = IntelShare_1.IntelShareStatus.DECLINED;
            share.revokedBy = userId;
            share.revokedAt = new Date();
            share.revokeReason = reason;
            const saved = await this.shareRepo.save(share);
            await this.updateShareCount(share.intelEntryId);
            await this.logAudit({
                organizationId: share.targetOrganizationId,
                userId,
                intelEntryId: share.intelEntryId,
                action: IntelAuditLog_1.IntelAuditAction.SHARE_DECLINED,
                description: 'Declined intel share from allied organization',
                ipAddress,
                userAgent,
                severity: 'info',
                metadata: { shareId: saved.id, reason },
            });
            logger_1.logger.info('Intel share declined', {
                shareId: saved.id,
                declinedBy: userId,
                reason,
            });
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error declining intel share:', error);
            throw error;
        }
    }
    async revokeShare(shareId, userId, organizationId, reason, ipAddress, userAgent) {
        try {
            const share = await this.shareRepo.findOne({
                where: { id: shareId, sourceOrganizationId: organizationId },
            });
            if (!share) {
                throw new apiErrors_1.NotFoundError('Share');
            }
            if (share.status === IntelShare_1.IntelShareStatus.REVOKED) {
                throw new apiErrors_1.ConflictError('Share is already revoked');
            }
            const canRevoke = await this.canShareIntel(userId, organizationId);
            if (!canRevoke) {
                throw new apiErrors_1.ForbiddenError('User does not have permission to revoke Intel shares');
            }
            share.status = IntelShare_1.IntelShareStatus.REVOKED;
            share.revokedBy = userId;
            share.revokedAt = new Date();
            share.revokeReason = reason;
            const saved = await this.shareRepo.save(share);
            await this.updateShareCount(share.intelEntryId);
            await this.logAudit({
                organizationId: share.sourceOrganizationId,
                userId,
                intelEntryId: share.intelEntryId,
                action: IntelAuditLog_1.IntelAuditAction.SHARE_REVOKED,
                description: `Revoked intel share with organization ${share.targetOrganizationId}`,
                ipAddress,
                userAgent,
                severity: 'warning',
                metadata: { shareId: saved.id, targetOrgId: share.targetOrganizationId, reason },
            });
            await this.logAudit({
                organizationId: share.targetOrganizationId,
                userId: share.sharedBy,
                intelEntryId: share.intelEntryId,
                action: IntelAuditLog_1.IntelAuditAction.SHARE_REVOKED,
                description: 'Intel share was revoked by source organization',
                severity: 'warning',
                metadata: { shareId: saved.id, sourceOrgId: share.sourceOrganizationId, revokedBy: userId },
            });
            logger_1.logger.info('Intel share revoked', {
                shareId: saved.id,
                revokedBy: userId,
                reason,
            });
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error revoking intel share:', error);
            throw error;
        }
    }
    async getSharedEntry(intelEntryId, userId, recipientOrgId, ipAddress, userAgent) {
        try {
            const share = await this.shareRepo.findOne({
                where: {
                    intelEntryId,
                    targetOrganizationId: recipientOrgId,
                    status: IntelShare_1.IntelShareStatus.ACTIVE,
                },
            });
            if (!share) {
                throw new apiErrors_1.NotFoundError('Active share');
            }
            if (share.expiresAt && share.expiresAt < new Date()) {
                share.status = IntelShare_1.IntelShareStatus.EXPIRED;
                await this.shareRepo.save(share);
                throw new Error('Share has expired');
            }
            const userOrg = await this.userOrgRepo.findOne({
                where: { userId, organizationId: recipientOrgId },
            });
            if (!userOrg) {
                throw new apiErrors_1.ForbiddenError('User is not a member of this organization');
            }
            const entry = await this.intelEntryRepo.findOne({
                where: { id: intelEntryId },
            });
            if (!entry) {
                throw new apiErrors_1.NotFoundError('Intel entry');
            }
            const classificationOrder = {
                [IntelEntry_1.IntelClassification.PUBLIC]: 0,
                [IntelEntry_1.IntelClassification.RESTRICTED]: 1,
                [IntelEntry_1.IntelClassification.CONFIDENTIAL]: 2,
                [IntelEntry_1.IntelClassification.SECRET]: 3,
                [IntelEntry_1.IntelClassification.TOP_SECRET]: 4,
            };
            const displayEntry = { ...entry };
            if (classificationOrder[entry.classification] > classificationOrder[share.maxClassification]) {
                displayEntry.content = '[REDACTED - Classification level exceeds share permission]';
                displayEntry.metadata = undefined;
            }
            else {
                displayEntry.content = IntelEncryptionService_1.IntelEncryptionService.decryptContent(entry.content);
                displayEntry.metadata = IntelEncryptionService_1.IntelEncryptionService.decryptMetadata(entry.metadata);
            }
            share.viewCount++;
            share.lastViewedAt = new Date();
            await this.shareRepo.save(share);
            await this.logAudit({
                organizationId: recipientOrgId,
                userId,
                intelEntryId,
                action: IntelAuditLog_1.IntelAuditAction.SHARE_VIEWED,
                description: 'Viewed shared intel entry',
                ipAddress,
                userAgent,
                severity: 'info',
                metadata: { shareId: share.id, viewCount: share.viewCount },
            });
            return { entry: displayEntry, share };
        }
        catch (error) {
            logger_1.logger.error('Error getting shared intel entry:', error);
            throw error;
        }
    }
    async getSharesForEntry(intelEntryId, organizationId, userId) {
        try {
            const canShare = await this.canShareIntel(userId, organizationId);
            if (!canShare) {
                throw new apiErrors_1.ForbiddenError('User does not have permission to view shares');
            }
            return await this.shareRepo.find({
                where: { intelEntryId, sourceOrganizationId: organizationId },
                order: { createdAt: 'DESC' },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting shares for entry:', error);
            throw error;
        }
    }
    async getIntelSharedWithOrg(organizationId, userId, options = {}) {
        try {
            const queryBuilder = this.shareRepo
                .createQueryBuilder('share')
                .where('share.targetOrganizationId = :organizationId', { organizationId });
            if (options.status) {
                queryBuilder.andWhere('share.status = :status', { status: options.status });
            }
            const total = await queryBuilder.getCount();
            queryBuilder
                .orderBy('share.createdAt', 'DESC')
                .skip(options.offset || 0)
                .take(options.limit || 50);
            const shares = await queryBuilder.getMany();
            return { shares, total };
        }
        catch (error) {
            logger_1.logger.error('Error getting shared intel:', error);
            throw error;
        }
    }
    async getIntelSharedByOrg(organizationId, userId, options = {}) {
        try {
            const canShare = await this.canShareIntel(userId, organizationId);
            if (!canShare) {
                throw new apiErrors_1.ForbiddenError('User does not have permission to view outgoing shares');
            }
            const queryBuilder = this.shareRepo
                .createQueryBuilder('share')
                .where('share.sourceOrganizationId = :organizationId', { organizationId });
            if (options.status) {
                queryBuilder.andWhere('share.status = :status', { status: options.status });
            }
            const total = await queryBuilder.getCount();
            queryBuilder
                .orderBy('share.createdAt', 'DESC')
                .skip(options.offset || 0)
                .take(options.limit || 50);
            const shares = await queryBuilder.getMany();
            return { shares, total };
        }
        catch (error) {
            logger_1.logger.error('Error getting outgoing shares:', error);
            throw error;
        }
    }
    async expireOldShares() {
        const now = new Date();
        const result = await this.shareRepo
            .createQueryBuilder()
            .update()
            .set({ status: IntelShare_1.IntelShareStatus.EXPIRED })
            .where('status = :status', { status: IntelShare_1.IntelShareStatus.ACTIVE })
            .andWhere('expiresAt < :now', { now })
            .execute();
        const expired = result.affected || 0;
        if (expired > 0) {
            logger_1.logger.info(`Expired ${expired} intel shares`);
        }
        return expired;
    }
    async updateShareCount(intelEntryId) {
        const activeShares = await this.shareRepo.count({
            where: { intelEntryId, status: IntelShare_1.IntelShareStatus.ACTIVE },
        });
        await this.intelEntryRepo.update(intelEntryId, {
            shareCount: activeShares,
            isShared: activeShares > 0,
        });
    }
    async logAudit(data) {
        try {
            const auditLog = this.auditLogRepo.create({
                id: (0, uuid_1.v4)(),
                ...data,
                severity: data.severity || 'info',
            });
            await this.auditLogRepo.save(auditLog);
        }
        catch (error) {
            logger_1.logger.error('Error logging Intel audit:', error);
        }
    }
}
exports.IntelSharingService = IntelSharingService;
//# sourceMappingURL=IntelSharingService.js.map