"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelAgingService = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
const data_source_1 = require("../../data-source");
const IntelAuditLog_1 = require("../../models/IntelAuditLog");
const IntelEntry_1 = require("../../models/IntelEntry");
const IntelOfficer_1 = require("../../models/IntelOfficer");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const IntelEncryptionService_1 = require("./IntelEncryptionService");
class IntelAgingService {
    intelEntryRepo;
    intelOfficerRepo;
    auditLogRepo;
    userOrgRepo;
    classificationOrder = {
        [IntelEntry_1.IntelClassification.PUBLIC]: 0,
        [IntelEntry_1.IntelClassification.RESTRICTED]: 1,
        [IntelEntry_1.IntelClassification.CONFIDENTIAL]: 2,
        [IntelEntry_1.IntelClassification.SECRET]: 3,
        [IntelEntry_1.IntelClassification.TOP_SECRET]: 4,
    };
    defaultReviewIntervals = {
        [IntelEntry_1.IntelClassification.PUBLIC]: 365,
        [IntelEntry_1.IntelClassification.RESTRICTED]: 180,
        [IntelEntry_1.IntelClassification.CONFIDENTIAL]: 90,
        [IntelEntry_1.IntelClassification.SECRET]: 60,
        [IntelEntry_1.IntelClassification.TOP_SECRET]: 30,
    };
    static TACTICAL_STALENESS_DAYS = 30;
    static HIGH_CLASSIFICATION_DECLASSIFY_DAYS = 365;
    static OLD_INTEL_ARCHIVE_DAYS = 730;
    constructor() {
        this.intelEntryRepo = data_source_1.AppDataSource.getRepository(IntelEntry_1.IntelEntry);
        this.intelOfficerRepo = data_source_1.AppDataSource.getRepository(IntelOfficer_1.IntelOfficer);
        this.auditLogRepo = data_source_1.AppDataSource.getRepository(IntelAuditLog_1.IntelAuditLog);
        this.userOrgRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    }
    async canManageAging(userId, organizationId) {
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
            return [IntelOfficer_1.IntelOfficerRank.CHIEF, IntelOfficer_1.IntelOfficerRank.LEAD, IntelOfficer_1.IntelOfficerRank.SENIOR].includes(officer.rank);
        }
        catch (error) {
            logger_1.logger.error('Error checking aging management permission:', error);
            return false;
        }
    }
    async scheduleDeclassification(input, userId, ipAddress, userAgent) {
        try {
            const canManage = await this.canManageAging(userId, input.organizationId);
            if (!canManage) {
                throw new Error('User does not have permission to schedule declassification');
            }
            const entry = await this.intelEntryRepo.findOne({
                where: { id: input.intelEntryId, organizationId: input.organizationId },
            });
            if (!entry) {
                throw new Error('Intel entry not found');
            }
            if (this.classificationOrder[input.targetClassification] >=
                this.classificationOrder[entry.classification]) {
                throw new Error('Target classification must be lower than current classification');
            }
            if (input.declassificationDate <= new Date()) {
                throw new Error('Declassification date must be in the future');
            }
            entry.declassificationDate = input.declassificationDate;
            entry.targetClassification = input.targetClassification;
            entry.autoDeclassify = input.autoDeclassify;
            const agingHistory = entry.metadata?.agingHistory || [];
            agingHistory.push({
                date: new Date(),
                action: 'declassification_scheduled',
                fromClassification: entry.classification,
                toClassification: input.targetClassification,
                performedBy: userId,
                reason: input.reason,
            });
            entry.metadata = {
                ...entry.metadata,
                agingHistory,
            };
            const saved = await this.intelEntryRepo.save(entry);
            await this.logAudit({
                organizationId: input.organizationId,
                userId,
                intelEntryId: input.intelEntryId,
                action: IntelAuditLog_1.IntelAuditAction.DECLASSIFICATION_SCHEDULED,
                description: `Scheduled declassification to ${input.targetClassification} on ${input.declassificationDate.toISOString()}`,
                ipAddress,
                userAgent,
                severity: 'info',
                metadata: {
                    currentClassification: entry.classification,
                    targetClassification: input.targetClassification,
                    declassificationDate: input.declassificationDate,
                    autoDeclassify: input.autoDeclassify,
                    reason: input.reason,
                },
            });
            logger_1.logger.info('Declassification scheduled', {
                entryId: input.intelEntryId,
                currentClassification: entry.classification,
                targetClassification: input.targetClassification,
                declassificationDate: input.declassificationDate,
            });
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error scheduling declassification:', error);
            throw error;
        }
    }
    async cancelDeclassification(intelEntryId, organizationId, userId, reason, ipAddress, userAgent) {
        try {
            const canManage = await this.canManageAging(userId, organizationId);
            if (!canManage) {
                throw new Error('User does not have permission to cancel declassification');
            }
            const entry = await this.intelEntryRepo.findOne({
                where: { id: intelEntryId, organizationId },
            });
            if (!entry) {
                throw new Error('Intel entry not found');
            }
            if (!entry.declassificationDate) {
                throw new Error('No declassification scheduled for this entry');
            }
            const previousDate = entry.declassificationDate;
            const previousTarget = entry.targetClassification;
            entry.declassificationDate = undefined;
            entry.targetClassification = undefined;
            entry.autoDeclassify = false;
            const agingHistory = entry.metadata?.agingHistory || [];
            agingHistory.push({
                date: new Date(),
                action: 'declassification_cancelled',
                toClassification: previousTarget,
                performedBy: userId,
                reason,
            });
            entry.metadata = {
                ...entry.metadata,
                agingHistory,
            };
            const saved = await this.intelEntryRepo.save(entry);
            await this.logAudit({
                organizationId,
                userId,
                intelEntryId,
                action: IntelAuditLog_1.IntelAuditAction.DECLASSIFICATION_CANCELLED,
                description: `Cancelled scheduled declassification to ${previousTarget}`,
                ipAddress,
                userAgent,
                severity: 'info',
                metadata: {
                    previousDate,
                    previousTarget,
                    reason,
                },
            });
            logger_1.logger.info('Declassification cancelled', {
                entryId: intelEntryId,
                previousDate,
                previousTarget,
            });
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error cancelling declassification:', error);
            throw error;
        }
    }
    async executeDeclassification(intelEntryId, organizationId, targetClassification, userId, reason, ipAddress, userAgent) {
        try {
            const canManage = await this.canManageAging(userId, organizationId);
            if (!canManage) {
                throw new Error('User does not have permission to declassify intel');
            }
            const entry = await this.intelEntryRepo.findOne({
                where: { id: intelEntryId, organizationId },
            });
            if (!entry) {
                throw new Error('Intel entry not found');
            }
            if (this.classificationOrder[targetClassification] >=
                this.classificationOrder[entry.classification]) {
                throw new Error('Target classification must be lower than current classification');
            }
            const previousClassification = entry.classification;
            const decryptedContent = IntelEncryptionService_1.IntelEncryptionService.decryptContent(entry.content);
            const newContent = IntelEncryptionService_1.IntelEncryptionService.encryptContent(decryptedContent, targetClassification);
            const decryptedMetadata = IntelEncryptionService_1.IntelEncryptionService.decryptMetadata(entry.metadata);
            const newMetadata = IntelEncryptionService_1.IntelEncryptionService.encryptMetadata(decryptedMetadata, targetClassification);
            entry.classification = targetClassification;
            entry.content = newContent;
            entry.declassificationDate = undefined;
            entry.targetClassification = undefined;
            entry.autoDeclassify = false;
            const agingHistory = decryptedMetadata?.agingHistory || [];
            agingHistory.push({
                date: new Date(),
                action: 'declassification_executed',
                fromClassification: previousClassification,
                toClassification: targetClassification,
                performedBy: userId,
                reason,
            });
            entry.metadata = {
                ...newMetadata,
                agingHistory,
            };
            const saved = await this.intelEntryRepo.save(entry);
            await this.logAudit({
                organizationId,
                userId,
                intelEntryId,
                action: IntelAuditLog_1.IntelAuditAction.DECLASSIFICATION_EXECUTED,
                description: `Declassified intel from ${previousClassification} to ${targetClassification}`,
                ipAddress,
                userAgent,
                severity: 'warning',
                metadata: {
                    previousClassification,
                    newClassification: targetClassification,
                    reason,
                },
            });
            logger_1.logger.info('Declassification executed', {
                entryId: intelEntryId,
                previousClassification,
                newClassification: targetClassification,
            });
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error executing declassification:', error);
            throw error;
        }
    }
    async scheduleReview(input, userId, ipAddress, userAgent) {
        try {
            const canManage = await this.canManageAging(userId, input.organizationId);
            if (!canManage) {
                throw new Error('User does not have permission to schedule reviews');
            }
            const entry = await this.intelEntryRepo.findOne({
                where: { id: input.intelEntryId, organizationId: input.organizationId },
            });
            if (!entry) {
                throw new Error('Intel entry not found');
            }
            entry.reviewDate = input.reviewDate;
            entry.reviewIntervalDays =
                input.reviewIntervalDays || this.defaultReviewIntervals[entry.classification];
            const saved = await this.intelEntryRepo.save(entry);
            await this.logAudit({
                organizationId: input.organizationId,
                userId,
                intelEntryId: input.intelEntryId,
                action: IntelAuditLog_1.IntelAuditAction.AGING_REVIEW_DUE,
                description: `Scheduled review for ${input.reviewDate.toISOString()}`,
                ipAddress,
                userAgent,
                severity: 'info',
                metadata: {
                    reviewDate: input.reviewDate,
                    reviewIntervalDays: entry.reviewIntervalDays,
                },
            });
            logger_1.logger.info('Review scheduled', {
                entryId: input.intelEntryId,
                reviewDate: input.reviewDate,
            });
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error scheduling review:', error);
            throw error;
        }
    }
    async completeReview(intelEntryId, organizationId, userId, notes, scheduleNextReview, ipAddress, userAgent) {
        try {
            const canManage = await this.canManageAging(userId, organizationId);
            if (!canManage) {
                throw new Error('User does not have permission to complete reviews');
            }
            const entry = await this.intelEntryRepo.findOne({
                where: { id: intelEntryId, organizationId },
            });
            if (!entry) {
                throw new Error('Intel entry not found');
            }
            entry.lastReviewedAt = new Date();
            entry.lastReviewedBy = userId;
            if (scheduleNextReview !== false && entry.reviewIntervalDays) {
                const nextReview = new Date();
                nextReview.setDate(nextReview.getDate() + entry.reviewIntervalDays);
                entry.reviewDate = nextReview;
            }
            else {
                entry.reviewDate = undefined;
            }
            const saved = await this.intelEntryRepo.save(entry);
            await this.logAudit({
                organizationId,
                userId,
                intelEntryId,
                action: IntelAuditLog_1.IntelAuditAction.AGING_REVIEW_COMPLETED,
                description: 'Completed intel review',
                ipAddress,
                userAgent,
                severity: 'info',
                metadata: {
                    notes,
                    nextReviewDate: entry.reviewDate,
                    reviewIntervalDays: entry.reviewIntervalDays,
                },
            });
            logger_1.logger.info('Review completed', {
                entryId: intelEntryId,
                reviewedBy: userId,
                nextReviewDate: entry.reviewDate,
            });
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error completing review:', error);
            throw error;
        }
    }
    async setExpiration(intelEntryId, organizationId, expirationDate, userId, ipAddress, userAgent) {
        try {
            const canManage = await this.canManageAging(userId, organizationId);
            if (!canManage) {
                throw new Error('User does not have permission to set expiration');
            }
            const entry = await this.intelEntryRepo.findOne({
                where: { id: intelEntryId, organizationId },
            });
            if (!entry) {
                throw new Error('Intel entry not found');
            }
            if (expirationDate <= new Date()) {
                throw new Error('Expiration date must be in the future');
            }
            entry.expirationDate = expirationDate;
            const saved = await this.intelEntryRepo.save(entry);
            await this.logAudit({
                organizationId,
                userId,
                intelEntryId,
                action: IntelAuditLog_1.IntelAuditAction.EXPIRATION_WARNING,
                description: `Set expiration date to ${expirationDate.toISOString()}`,
                ipAddress,
                userAgent,
                severity: 'info',
                metadata: { expirationDate },
            });
            logger_1.logger.info('Expiration set', {
                entryId: intelEntryId,
                expirationDate,
            });
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error setting expiration:', error);
            throw error;
        }
    }
    async getEntriesDueForReview(organizationId, userId, options = {}) {
        try {
            const canManage = await this.canManageAging(userId, organizationId);
            if (!canManage) {
                throw new Error('User does not have permission to view reviews');
            }
            const now = new Date();
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + (options.daysAhead || 7));
            const queryBuilder = this.intelEntryRepo
                .createQueryBuilder('entry')
                .where('entry.organizationId = :organizationId', { organizationId })
                .andWhere('entry.isArchived = :isArchived', { isArchived: false })
                .andWhere('entry.reviewDate IS NOT NULL')
                .andWhere('entry.reviewDate <= :futureDate', { futureDate });
            if (!options.includeOverdue) {
                queryBuilder.andWhere('entry.reviewDate >= :now', { now });
            }
            const total = await queryBuilder.getCount();
            queryBuilder
                .orderBy('entry.reviewDate', 'ASC')
                .skip(options.offset || 0)
                .take(options.limit || 50);
            const entries = await queryBuilder.getMany();
            const results = entries.map(entry => {
                const reviewDate = entry.reviewDate || new Date();
                return {
                    entryId: entry.id,
                    title: entry.title,
                    currentClassification: entry.classification,
                    reviewDate,
                    daysPastDue: reviewDate < now
                        ? Math.ceil((now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24))
                        : 0,
                    lastReviewedAt: entry.lastReviewedAt,
                    recommendation: this.getReviewRecommendation(entry),
                };
            });
            return { entries: results, total };
        }
        catch (error) {
            logger_1.logger.error('Error getting entries due for review:', error);
            throw error;
        }
    }
    async getEntriesPendingDeclassification(organizationId, userId, options = {}) {
        try {
            const canManage = await this.canManageAging(userId, organizationId);
            if (!canManage) {
                throw new Error('User does not have permission to view declassifications');
            }
            const now = new Date();
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + (options.daysAhead || 30));
            const queryBuilder = this.intelEntryRepo
                .createQueryBuilder('entry')
                .where('entry.organizationId = :organizationId', { organizationId })
                .andWhere('entry.isArchived = :isArchived', { isArchived: false })
                .andWhere('entry.declassificationDate IS NOT NULL')
                .andWhere('entry.declassificationDate <= :futureDate', { futureDate });
            if (!options.includeOverdue) {
                queryBuilder.andWhere('entry.declassificationDate >= :now', { now });
            }
            const total = await queryBuilder.getCount();
            queryBuilder
                .orderBy('entry.declassificationDate', 'ASC')
                .skip(options.offset || 0)
                .take(options.limit || 50);
            const entries = await queryBuilder.getMany();
            return { entries, total };
        }
        catch (error) {
            logger_1.logger.error('Error getting pending declassifications:', error);
            throw error;
        }
    }
    async processAutoDeclassifications() {
        const results = [];
        const now = new Date();
        const BATCH_SIZE = 100;
        try {
            let hasMore = true;
            while (hasMore) {
                const entries = await this.intelEntryRepo.find({
                    where: {
                        autoDeclassify: true,
                        declassificationDate: (0, typeorm_1.LessThanOrEqual)(now),
                        isArchived: false,
                        targetClassification: (0, typeorm_1.Not)((0, typeorm_1.IsNull)()),
                    },
                    take: BATCH_SIZE,
                });
                hasMore = entries.length === BATCH_SIZE;
                for (const entry of entries) {
                    try {
                        if (!entry.targetClassification) {
                            continue;
                        }
                        const previousClassification = entry.classification;
                        const decryptedContent = IntelEncryptionService_1.IntelEncryptionService.decryptContent(entry.content);
                        const newContent = IntelEncryptionService_1.IntelEncryptionService.encryptContent(decryptedContent, entry.targetClassification);
                        const decryptedMetadata = IntelEncryptionService_1.IntelEncryptionService.decryptMetadata(entry.metadata);
                        const newMetadata = IntelEncryptionService_1.IntelEncryptionService.encryptMetadata(decryptedMetadata, entry.targetClassification);
                        const agingHistory = decryptedMetadata?.agingHistory || [];
                        agingHistory.push({
                            date: new Date(),
                            action: 'auto_declassification',
                            fromClassification: previousClassification,
                            toClassification: entry.targetClassification,
                            reason: 'Automatic declassification per schedule',
                        });
                        entry.classification = entry.targetClassification;
                        entry.content = newContent;
                        entry.declassificationDate = undefined;
                        entry.targetClassification = undefined;
                        entry.autoDeclassify = false;
                        entry.metadata = {
                            ...newMetadata,
                            agingHistory,
                        };
                        await this.intelEntryRepo.save(entry);
                        await this.logAudit({
                            organizationId: entry.organizationId,
                            userId: 'system',
                            intelEntryId: entry.id,
                            action: IntelAuditLog_1.IntelAuditAction.DECLASSIFICATION_EXECUTED,
                            description: `Auto-declassified from ${previousClassification} to ${entry.classification}`,
                            severity: 'warning',
                            metadata: {
                                previousClassification,
                                newClassification: entry.classification,
                                automatic: true,
                            },
                        });
                        results.push({
                            entryId: entry.id,
                            title: entry.title,
                            previousClassification,
                            newClassification: entry.classification,
                            declassifiedAt: new Date(),
                            success: true,
                        });
                        logger_1.logger.info('Auto-declassification executed', {
                            entryId: entry.id,
                            previousClassification,
                            newClassification: entry.classification,
                        });
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        results.push({
                            entryId: entry.id,
                            title: entry.title,
                            previousClassification: entry.classification,
                            newClassification: entry.targetClassification || entry.classification,
                            declassifiedAt: new Date(),
                            success: false,
                            error: errorMessage,
                        });
                        logger_1.logger.error('Error auto-declassifying entry:', {
                            entryId: entry.id,
                            error: errorMessage,
                        });
                    }
                }
            }
            if (results.length > 0) {
                logger_1.logger.info(`Processed ${results.length} auto-declassifications`, {
                    successful: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length,
                });
            }
            return results;
        }
        catch (error) {
            logger_1.logger.error('Error processing auto-declassifications:', error);
            throw error;
        }
    }
    async processExpiredEntries() {
        const now = new Date();
        try {
            const expiredEntries = await this.intelEntryRepo.find({
                where: {
                    expirationDate: (0, typeorm_1.LessThan)(now),
                    isExpired: false,
                    isArchived: false,
                },
            });
            for (const entry of expiredEntries) {
                entry.isExpired = true;
                entry.isArchived = true;
                await this.intelEntryRepo.save(entry);
                await this.logAudit({
                    organizationId: entry.organizationId,
                    userId: 'system',
                    intelEntryId: entry.id,
                    action: IntelAuditLog_1.IntelAuditAction.ENTRY_EXPIRED,
                    description: 'Intel entry expired and archived',
                    severity: 'info',
                    metadata: {
                        expirationDate: entry.expirationDate,
                        classification: entry.classification,
                    },
                });
            }
            if (expiredEntries.length > 0) {
                logger_1.logger.info(`Processed ${expiredEntries.length} expired intel entries`);
            }
            return expiredEntries.length;
        }
        catch (error) {
            logger_1.logger.error('Error processing expired entries:', error);
            throw error;
        }
    }
    async getAgingStatistics(organizationId, userId) {
        try {
            const canManage = await this.canManageAging(userId, organizationId);
            if (!canManage) {
                throw new Error('User does not have permission to view aging statistics');
            }
            const now = new Date();
            const soonDate = new Date();
            soonDate.setDate(soonDate.getDate() + 30);
            const [totalEntries, pendingReviews, overdueReviews, pendingDeclassifications, expiringSoon, classificationCounts,] = await Promise.all([
                this.intelEntryRepo.count({
                    where: { organizationId, isArchived: false },
                }),
                this.intelEntryRepo.count({
                    where: {
                        organizationId,
                        isArchived: false,
                        reviewDate: (0, typeorm_1.Not)((0, typeorm_1.IsNull)()),
                    },
                }),
                this.intelEntryRepo.count({
                    where: {
                        organizationId,
                        isArchived: false,
                        reviewDate: (0, typeorm_1.LessThan)(now),
                    },
                }),
                this.intelEntryRepo.count({
                    where: {
                        organizationId,
                        isArchived: false,
                        declassificationDate: (0, typeorm_1.Not)((0, typeorm_1.IsNull)()),
                    },
                }),
                this.intelEntryRepo.count({
                    where: {
                        organizationId,
                        isArchived: false,
                        expirationDate: (0, typeorm_1.LessThanOrEqual)(soonDate),
                    },
                }),
                this.intelEntryRepo
                    .createQueryBuilder('entry')
                    .select('entry.classification', 'classification')
                    .addSelect('COUNT(*)', 'count')
                    .where('entry.organizationId = :organizationId', { organizationId })
                    .andWhere('entry.isArchived = :isArchived', { isArchived: false })
                    .groupBy('entry.classification')
                    .getRawMany(),
            ]);
            const byClassification = {
                [IntelEntry_1.IntelClassification.PUBLIC]: 0,
                [IntelEntry_1.IntelClassification.RESTRICTED]: 0,
                [IntelEntry_1.IntelClassification.CONFIDENTIAL]: 0,
                [IntelEntry_1.IntelClassification.SECRET]: 0,
                [IntelEntry_1.IntelClassification.TOP_SECRET]: 0,
            };
            for (const row of classificationCounts) {
                const classification = row.classification;
                const count = Number.parseInt(row.count, 10);
                byClassification[classification] = count;
            }
            return {
                totalEntries,
                pendingReviews,
                overdueReviews,
                pendingDeclassifications,
                expiringSoon,
                byClassification,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting aging statistics:', error);
            throw error;
        }
    }
    getReviewRecommendation(entry) {
        const now = new Date();
        const ageInDays = Math.ceil((now.getTime() - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        if (entry.category === IntelEntry_1.IntelCategory.TACTICAL &&
            ageInDays > IntelAgingService.TACTICAL_STALENESS_DAYS) {
            return 'archive';
        }
        if (this.classificationOrder[entry.classification] >=
            this.classificationOrder[IntelEntry_1.IntelClassification.SECRET] &&
            ageInDays > IntelAgingService.HIGH_CLASSIFICATION_DECLASSIFY_DAYS) {
            return 'declassify';
        }
        if (ageInDays > IntelAgingService.OLD_INTEL_ARCHIVE_DAYS) {
            return 'archive';
        }
        return 'maintain';
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
exports.IntelAgingService = IntelAgingService;
//# sourceMappingURL=IntelAgingService.js.map