"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelVaultService = void 0;
const uuid_1 = require("uuid");
const data_source_1 = require("../../data-source");
const IntelAuditLog_1 = require("../../models/IntelAuditLog");
const IntelEntry_1 = require("../../models/IntelEntry");
const IntelOfficer_1 = require("../../models/IntelOfficer");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const IntelEncryptionService_1 = require("./IntelEncryptionService");
class IntelVaultService {
    intelEntryRepo;
    intelOfficerRepo;
    auditLogRepo;
    userOrgRepo;
    accessCache = new Map();
    static ACCESS_CACHE_TTL_MS = 30_000;
    constructor() {
        this.intelEntryRepo = data_source_1.AppDataSource.getRepository(IntelEntry_1.IntelEntry);
        this.intelOfficerRepo = data_source_1.AppDataSource.getRepository(IntelOfficer_1.IntelOfficer);
        this.auditLogRepo = data_source_1.AppDataSource.getRepository(IntelAuditLog_1.IntelAuditLog);
        this.userOrgRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    }
    clearAccessCache(userId, organizationId) {
        if (userId && organizationId) {
            this.accessCache.delete(`${userId}:${organizationId}`);
        }
        else {
            this.accessCache.clear();
        }
    }
    async resolveAccessFromMembership(userOrg, userId, organizationId) {
        const roleName = (0, roleUtils_1.getRoleName)(userOrg.role);
        if (['owner', 'admin', 'founder'].includes(roleName)) {
            if (roleName === 'admin') {
                this.logAudit({
                    organizationId,
                    userId,
                    action: IntelAuditLog_1.IntelAuditAction.VAULT_ACCESSED,
                    description: 'Admin (non-owner) accessed intel vault',
                    severity: 'info',
                }).catch(err => logger_1.logger.error('Failed to audit admin intel access', err));
            }
            return {
                hasAccess: true,
                accessLevel: 'admin',
                isOwner: roleName === 'owner' || roleName === 'founder',
                isIntelOfficer: false,
            };
        }
        const intelOfficer = await this.intelOfficerRepo.findOne({
            where: { userId, organizationId, isActive: true },
        });
        if (intelOfficer) {
            return {
                hasAccess: true,
                accessLevel: intelOfficer.accessLevel,
                isOwner: false,
                isIntelOfficer: true,
                officerRank: intelOfficer.rank,
            };
        }
        return {
            hasAccess: false,
            reason: 'User is not an Intel officer and not the org owner',
        };
    }
    async checkAccess(userId, organizationId) {
        const cacheKey = `${userId}:${organizationId}`;
        const now = Date.now();
        const cached = this.accessCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return cached.result;
        }
        if (this.accessCache.size > 100) {
            for (const [key, entry] of this.accessCache) {
                if (entry.expiresAt <= now) {
                    this.accessCache.delete(key);
                }
            }
        }
        try {
            const userOrg = await this.userOrgRepo.findOne({
                where: { userId, organizationId, isActive: true },
            });
            const result = userOrg
                ? await this.resolveAccessFromMembership(userOrg, userId, organizationId)
                : { hasAccess: false, reason: 'User is not a member of this organization' };
            this.accessCache.set(cacheKey, {
                result,
                expiresAt: now + IntelVaultService.ACCESS_CACHE_TTL_MS,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error checking Intel access:', error);
            throw error;
        }
    }
    async canAccessClassification(userId, organizationId, classification) {
        const access = await this.checkAccess(userId, organizationId);
        if (!access.hasAccess) {
            return false;
        }
        if (access.isOwner) {
            return true;
        }
        if (classification === IntelEntry_1.IntelClassification.TOP_SECRET) {
            return access.isOwner || access.officerRank === IntelOfficer_1.IntelOfficerRank.CHIEF;
        }
        if (classification === IntelEntry_1.IntelClassification.SECRET) {
            return (!!access.officerRank &&
                [IntelOfficer_1.IntelOfficerRank.CHIEF, IntelOfficer_1.IntelOfficerRank.LEAD, IntelOfficer_1.IntelOfficerRank.SENIOR].includes(access.officerRank));
        }
        if (classification === IntelEntry_1.IntelClassification.CONFIDENTIAL) {
            return !!access.officerRank && access.officerRank !== IntelOfficer_1.IntelOfficerRank.JUNIOR;
        }
        return !!access.isIntelOfficer || !!access.isOwner;
    }
    canAccessClassificationWithAccess(access, classification) {
        if (!access.hasAccess) {
            return false;
        }
        if (access.isOwner) {
            return true;
        }
        if (classification === IntelEntry_1.IntelClassification.TOP_SECRET) {
            return access.officerRank === IntelOfficer_1.IntelOfficerRank.CHIEF;
        }
        if (classification === IntelEntry_1.IntelClassification.SECRET) {
            return !!(access.officerRank &&
                [IntelOfficer_1.IntelOfficerRank.CHIEF, IntelOfficer_1.IntelOfficerRank.LEAD, IntelOfficer_1.IntelOfficerRank.SENIOR].includes(access.officerRank));
        }
        if (classification === IntelEntry_1.IntelClassification.CONFIDENTIAL) {
            return !!(access.officerRank && access.officerRank !== IntelOfficer_1.IntelOfficerRank.JUNIOR);
        }
        return !!(access.isIntelOfficer || access.isOwner);
    }
    async getHighestRankingOfficer(organizationId) {
        const rankOrder = [
            IntelOfficer_1.IntelOfficerRank.CHIEF,
            IntelOfficer_1.IntelOfficerRank.LEAD,
            IntelOfficer_1.IntelOfficerRank.SENIOR,
            IntelOfficer_1.IntelOfficerRank.OFFICER,
            IntelOfficer_1.IntelOfficerRank.JUNIOR,
        ];
        for (const rank of rankOrder) {
            const officer = await this.intelOfficerRepo.findOne({
                where: {
                    organizationId,
                    rank,
                    isActive: true,
                },
                order: { appointedAt: 'ASC' },
            });
            if (officer) {
                return officer;
            }
        }
        return null;
    }
    async createEntry(input, createdBy, ipAddress, userAgent) {
        try {
            const access = await this.checkAccess(createdBy, input.organizationId);
            if (!access.hasAccess) {
                throw new apiErrors_1.ForbiddenError('User does not have access to Intel vault');
            }
            const canAccess = this.canAccessClassificationWithAccess(access, input.classification);
            if (!canAccess) {
                throw new apiErrors_1.ForbiddenError(`User does not have clearance for ${input.classification} level`);
            }
            if (!access.isOwner &&
                !['write', 'edit', 'delete', 'admin'].includes(access.accessLevel || '')) {
                throw new apiErrors_1.ForbiddenError('User does not have write permission');
            }
            const encryptedContent = IntelEncryptionService_1.IntelEncryptionService.encryptContent(input.content, input.classification);
            const encryptedMetadata = IntelEncryptionService_1.IntelEncryptionService.encryptMetadata(input.metadata, input.classification);
            const entry = this.intelEntryRepo.create({
                id: (0, uuid_1.v4)(),
                ...input,
                content: encryptedContent,
                metadata: encryptedMetadata,
                createdBy,
                isArchived: false,
            });
            const saved = await this.intelEntryRepo.save(entry);
            await this.logAudit({
                organizationId: input.organizationId,
                userId: createdBy,
                intelEntryId: saved.id,
                action: IntelAuditLog_1.IntelAuditAction.ENTRY_CREATED,
                description: `Created Intel entry: ${input.title}`,
                ipAddress,
                userAgent,
                severity: 'info',
                metadata: {
                    classification: input.classification,
                    category: input.category,
                    encrypted: IntelEncryptionService_1.IntelEncryptionService.requiresEncryption(input.classification),
                },
            });
            logger_1.logger.info('Intel entry created', {
                entryId: saved.id,
                organizationId: input.organizationId,
                userId: createdBy,
                encrypted: IntelEncryptionService_1.IntelEncryptionService.requiresEncryption(input.classification),
            });
            saved.content = IntelEncryptionService_1.IntelEncryptionService.decryptContent(saved.content);
            saved.metadata = IntelEncryptionService_1.IntelEncryptionService.decryptMetadata(saved.metadata);
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error creating Intel entry:', error);
            throw error;
        }
    }
    async getEntries(organizationId, userId, options = {}) {
        try {
            const access = await this.checkAccess(userId, organizationId);
            if (!access.hasAccess) {
                throw new apiErrors_1.ForbiddenError('User does not have access to Intel vault');
            }
            const queryBuilder = this.intelEntryRepo
                .createQueryBuilder('entry')
                .where('entry.organizationId = :organizationId', { organizationId });
            if (!options.includeArchived) {
                queryBuilder.andWhere('entry.isArchived = :isArchived', { isArchived: false });
            }
            const accessibleClassifications = [];
            for (const classification of Object.values(IntelEntry_1.IntelClassification)) {
                if (this.canAccessClassificationWithAccess(access, classification)) {
                    accessibleClassifications.push(classification);
                }
            }
            if (accessibleClassifications.length === 0) {
                return { entries: [], total: 0 };
            }
            queryBuilder.andWhere('entry.classification IN (:...classifications)', {
                classifications: accessibleClassifications,
            });
            if (options.classification) {
                queryBuilder.andWhere('entry.classification = :classification', {
                    classification: options.classification,
                });
            }
            if (options.category) {
                queryBuilder.andWhere('entry.category = :category', {
                    category: options.category,
                });
            }
            if (options.search) {
                queryBuilder.andWhere('(entry.title LIKE :search OR entry.content LIKE :search OR entry.tags LIKE :search)', { search: `%${options.search}%` });
            }
            const total = await queryBuilder.getCount();
            queryBuilder
                .orderBy('entry.createdAt', 'DESC')
                .skip(options.offset || 0)
                .take(options.limit || 50);
            const entries = await queryBuilder.getMany();
            const decryptedEntries = entries.map(entry => ({
                ...entry,
                content: IntelEncryptionService_1.IntelEncryptionService.decryptContent(entry.content),
                metadata: IntelEncryptionService_1.IntelEncryptionService.decryptMetadata(entry.metadata),
            }));
            return { entries: decryptedEntries, total };
        }
        catch (error) {
            logger_1.logger.error('Error getting Intel entries:', error);
            throw error;
        }
    }
    async getEntry(entryId, userId, organizationId, ipAddress, userAgent) {
        try {
            const entry = await this.intelEntryRepo.findOne({
                where: { id: entryId, organizationId },
            });
            if (!entry) {
                throw new apiErrors_1.NotFoundError('Intel entry');
            }
            const access = await this.checkAccess(userId, organizationId);
            if (!access.hasAccess) {
                throw new apiErrors_1.ForbiddenError('User does not have access to Intel vault');
            }
            const canAccess = this.canAccessClassificationWithAccess(access, entry.classification);
            if (!canAccess) {
                await this.logAudit({
                    organizationId,
                    userId,
                    intelEntryId: entryId,
                    action: IntelAuditLog_1.IntelAuditAction.UNAUTHORIZED_ATTEMPT,
                    description: `Attempted to access ${entry.classification} entry without clearance`,
                    ipAddress,
                    userAgent,
                    severity: 'warning',
                });
                throw new apiErrors_1.ForbiddenError('Insufficient clearance for this entry');
            }
            await this.logAudit({
                organizationId,
                userId,
                intelEntryId: entryId,
                action: IntelAuditLog_1.IntelAuditAction.ENTRY_VIEWED,
                description: `Viewed Intel entry: ${entry.title}`,
                ipAddress,
                userAgent,
                severity: 'info',
            });
            entry.content = IntelEncryptionService_1.IntelEncryptionService.decryptContent(entry.content);
            entry.metadata = IntelEncryptionService_1.IntelEncryptionService.decryptMetadata(entry.metadata);
            return entry;
        }
        catch (error) {
            logger_1.logger.error('Error getting Intel entry:', error);
            throw error;
        }
    }
    validateEditAccess(access, entry, newClassification) {
        if (!access.hasAccess) {
            throw new apiErrors_1.ForbiddenError('User does not have access to Intel vault');
        }
        if (!access.isOwner && !['edit', 'delete', 'admin'].includes(access.accessLevel || '')) {
            throw new apiErrors_1.ForbiddenError('User does not have edit permission');
        }
        if (!this.canAccessClassificationWithAccess(access, entry.classification)) {
            throw new apiErrors_1.ForbiddenError('Insufficient clearance to edit this entry');
        }
        if (newClassification && !this.canAccessClassificationWithAccess(access, newClassification)) {
            throw new apiErrors_1.ForbiddenError(`Insufficient clearance for ${newClassification} level`);
        }
    }
    trackChanges(entry, input, decryptedOldContent) {
        const oldValues = {};
        const newValues = {};
        for (const [key, value] of Object.entries(input)) {
            if (value !== undefined) {
                const oldValue = key === 'content'
                    ? decryptedOldContent
                    : entry[key];
                if (oldValue !== value) {
                    oldValues[key] = oldValue;
                    newValues[key] = value;
                }
            }
        }
        return { oldValues, newValues };
    }
    async updateEntry(entryId, userId, organizationId, input, ipAddress, userAgent) {
        try {
            const entry = await this.intelEntryRepo.findOne({
                where: { id: entryId, organizationId },
            });
            if (!entry) {
                throw new apiErrors_1.NotFoundError('Intel entry');
            }
            const access = await this.checkAccess(userId, organizationId);
            this.validateEditAccess(access, entry, input.classification);
            const newClassification = input.classification || entry.classification;
            const decryptedOldContent = IntelEncryptionService_1.IntelEncryptionService.decryptContent(entry.content);
            const { oldValues, newValues } = this.trackChanges(entry, input, decryptedOldContent);
            let contentToSave = entry.content;
            if (input.content !== undefined || input.classification !== undefined) {
                const contentToEncrypt = input.content ?? decryptedOldContent;
                contentToSave = IntelEncryptionService_1.IntelEncryptionService.encryptContent(contentToEncrypt, newClassification);
            }
            let metadataToSave = entry.metadata;
            if (input.metadata !== undefined || input.classification !== undefined) {
                const metadataToEncrypt = input.metadata ?? IntelEncryptionService_1.IntelEncryptionService.decryptMetadata(entry.metadata);
                metadataToSave = IntelEncryptionService_1.IntelEncryptionService.encryptMetadata(metadataToEncrypt, newClassification);
            }
            Object.assign(entry, input, {
                content: contentToSave,
                metadata: metadataToSave,
            });
            entry.updatedBy = userId;
            const updated = await this.intelEntryRepo.save(entry);
            await this.logAudit({
                organizationId,
                userId,
                intelEntryId: entryId,
                action: IntelAuditLog_1.IntelAuditAction.ENTRY_UPDATED,
                description: `Updated Intel entry: ${entry.title}`,
                ipAddress,
                userAgent,
                severity: 'info',
                metadata: {
                    changes: Object.keys(newValues),
                    oldValues,
                    newValues,
                    encrypted: IntelEncryptionService_1.IntelEncryptionService.requiresEncryption(newClassification),
                },
            });
            logger_1.logger.info('Intel entry updated', {
                entryId,
                organizationId,
                userId,
                changes: Object.keys(newValues),
                encrypted: IntelEncryptionService_1.IntelEncryptionService.requiresEncryption(newClassification),
            });
            updated.content = IntelEncryptionService_1.IntelEncryptionService.decryptContent(updated.content);
            updated.metadata = IntelEncryptionService_1.IntelEncryptionService.decryptMetadata(updated.metadata);
            return updated;
        }
        catch (error) {
            logger_1.logger.error('Error updating Intel entry:', error);
            throw error;
        }
    }
    async deleteEntry(entryId, userId, organizationId, ipAddress, userAgent) {
        try {
            const entry = await this.intelEntryRepo.findOne({
                where: { id: entryId, organizationId },
            });
            if (!entry) {
                throw new apiErrors_1.NotFoundError('Intel entry');
            }
            const access = await this.checkAccess(userId, organizationId);
            if (!access.hasAccess) {
                throw new apiErrors_1.ForbiddenError('User does not have access to Intel vault');
            }
            if (!access.isOwner && !['delete', 'admin'].includes(access.accessLevel || '')) {
                throw new apiErrors_1.ForbiddenError('User does not have delete permission');
            }
            const canAccess = this.canAccessClassificationWithAccess(access, entry.classification);
            if (!canAccess) {
                throw new apiErrors_1.ForbiddenError('Insufficient clearance to delete this entry');
            }
            await this.intelEntryRepo.remove(entry);
            await this.logAudit({
                organizationId,
                userId,
                intelEntryId: entryId,
                action: IntelAuditLog_1.IntelAuditAction.ENTRY_DELETED,
                description: `Deleted Intel entry: ${entry.title}`,
                ipAddress,
                userAgent,
                severity: 'warning',
                metadata: {
                    deletedEntry: {
                        title: entry.title,
                        classification: entry.classification,
                        category: entry.category,
                    },
                },
            });
            logger_1.logger.info('Intel entry deleted', {
                entryId,
                organizationId,
                userId,
            });
        }
        catch (error) {
            logger_1.logger.error('Error deleting Intel entry:', error);
            throw error;
        }
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
    async getAuditLogs(organizationId, userId, options = {}) {
        try {
            const userOrg = await this.userOrgRepo.findOne({
                where: { userId, organizationId },
            });
            const isOwner = (0, roleUtils_1.isOwnerRole)(userOrg?.role);
            const highestOfficer = await this.getHighestRankingOfficer(organizationId);
            const isHighestOfficer = highestOfficer?.userId === userId;
            if (!isOwner && !isHighestOfficer) {
                throw new apiErrors_1.ForbiddenError('Only org owner and highest ranking Intel officer can view audit logs');
            }
            const queryBuilder = this.auditLogRepo
                .createQueryBuilder('log')
                .leftJoin('log.user', 'user')
                .addSelect(['user.id', 'user.username'])
                .where('log.organizationId = :organizationId', { organizationId });
            if (options.intelEntryId) {
                queryBuilder.andWhere('log.intelEntryId = :intelEntryId', {
                    intelEntryId: options.intelEntryId,
                });
            }
            if (options.action) {
                queryBuilder.andWhere('log.action = :action', { action: options.action });
            }
            if (options.userId) {
                queryBuilder.andWhere('log.userId = :userId', { userId: options.userId });
            }
            if (options.startDate) {
                queryBuilder.andWhere('log.createdAt >= :startDate', {
                    startDate: options.startDate,
                });
            }
            if (options.endDate) {
                queryBuilder.andWhere('log.createdAt <= :endDate', {
                    endDate: options.endDate,
                });
            }
            const total = await queryBuilder.getCount();
            queryBuilder
                .orderBy('log.createdAt', 'DESC')
                .skip(options.offset || 0)
                .take(options.limit || 100);
            const logs = await queryBuilder.getMany();
            const logsWithUsername = logs.map(log => ({
                ...log,
                username: log.user?.username ?? log.userId,
                user: undefined,
            }));
            return { logs: logsWithUsername, total };
        }
        catch (error) {
            logger_1.logger.error('Error getting Intel audit logs:', error);
            throw error;
        }
    }
}
exports.IntelVaultService = IntelVaultService;
//# sourceMappingURL=IntelVaultService.js.map