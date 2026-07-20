"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationEncryptionService = void 0;
const database_1 = require("../../config/database");
const DataEncryptionKey_1 = require("../../models/DataEncryptionKey");
const EncryptedData_1 = require("../../models/EncryptedData");
const EncryptionAuditLog_1 = require("../../models/EncryptionAuditLog");
const EncryptionKeyClaim_1 = require("../../models/EncryptionKeyClaim");
const MemberPublicKey_1 = require("../../models/MemberPublicKey");
const OrganizationEncryptionKey_1 = require("../../models/OrganizationEncryptionKey");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
class OrganizationEncryptionService {
    keyRepository = database_1.AppDataSource.getRepository(OrganizationEncryptionKey_1.OrganizationEncryptionKey);
    dataRepository = database_1.AppDataSource.getRepository(EncryptedData_1.EncryptedData);
    auditRepository = database_1.AppDataSource.getRepository(EncryptionAuditLog_1.EncryptionAuditLog);
    membershipRepository = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    claimRepository = database_1.AppDataSource.getRepository(EncryptionKeyClaim_1.EncryptionKeyClaim);
    publicKeyRepository = database_1.AppDataSource.getRepository(MemberPublicKey_1.MemberPublicKey);
    dekRepository = database_1.AppDataSource.getRepository(DataEncryptionKey_1.DataEncryptionKey);
    normalizeEncryptionMetadata(metadata) {
        const authTag = metadata.authTag || ('tag' in metadata ? (metadata.tag ?? undefined) : undefined);
        if (!authTag) {
            throw new apiErrors_1.ValidationError('Encryption metadata must include authTag');
        }
        return {
            iv: metadata.iv,
            authTag,
            algorithm: metadata.algorithm,
            version: metadata.version,
        };
    }
    async initializeEncryption(input) {
        const existing = await this.keyRepository.findOne({
            where: { organizationId: input.organizationId, isActive: true },
        });
        if (existing) {
            throw new apiErrors_1.ValidationError('Encryption already enabled for this organization');
        }
        const key = this.keyRepository.create({
            organizationId: input.organizationId,
            keyId: input.keyId,
            algorithm: input.algorithm,
            keyWrappers: input.wrappedKeys,
            recoveryHint: input.recoveryHint,
            requiresRecoveryPhrase: true,
            createdBy: input.createdBy,
            version: 1,
            isActive: true,
            usageCount: 0,
        });
        const saved = await this.keyRepository.save(key);
        await this.logEvent({
            organizationId: input.organizationId,
            eventType: EncryptionAuditLog_1.EncryptionEventType.ENCRYPTION_ENABLED,
            userId: input.createdBy,
            message: `Encryption enabled for organization`,
            details: {
                keyId: input.keyId,
                algorithm: input.algorithm,
                numKeyHolders: Object.keys(input.wrappedKeys).length,
            },
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        });
        logger_1.logger.info(`Encryption initialized for org ${input.organizationId} by ${input.createdBy}`);
        return saved;
    }
    async getEncryptionStatus(organizationId) {
        const key = await this.keyRepository.findOne({
            where: { organizationId, isActive: true },
        });
        if (!key) {
            return { enabled: false };
        }
        return {
            enabled: true,
            keyId: key.keyId,
            algorithm: key.algorithm,
            version: key.version,
            createdAt: key.createdAt,
            numKeyHolders: Object.keys(key.keyWrappers).length,
        };
    }
    async getKeyWrapperForUser(organizationId, userId) {
        const key = await this.keyRepository.findOne({
            where: { organizationId, isActive: true },
        });
        if (!key) {
            return null;
        }
        const wrappedKey = key.getKeyWrapperForUser(userId);
        if (!wrappedKey) {
            return null;
        }
        return {
            keyId: key.keyId,
            wrappedKey,
            algorithm: key.algorithm,
        };
    }
    async shareKey(input) {
        const key = await this.keyRepository.findOne({
            where: { organizationId: input.organizationId, keyId: input.keyId },
        });
        if (!key) {
            throw new apiErrors_1.NotFoundError('Encryption key');
        }
        const membership = await this.membershipRepository.findOne({
            where: { organizationId: input.organizationId, userId: input.userId, isActive: true },
        });
        if (!membership) {
            throw new apiErrors_1.ForbiddenError('User is not a member of this organization');
        }
        key.addKeyWrapperForUser(input.userId, input.wrappedKey);
        await this.keyRepository.save(key);
        await this.logEvent({
            organizationId: input.organizationId,
            eventType: EncryptionAuditLog_1.EncryptionEventType.KEY_SHARED,
            userId: input.sharedBy,
            message: `Encryption key shared with user ${input.userId}`,
            details: {
                keyId: input.keyId,
                targetUserId: input.userId,
            },
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        });
        logger_1.logger.info(`Encryption key ${input.keyId} shared with user ${input.userId}`);
    }
    async revokeKeyAccess(organizationId, keyId, userId, revokedBy) {
        const key = await this.keyRepository.findOne({
            where: { organizationId, keyId },
        });
        if (!key) {
            throw new apiErrors_1.NotFoundError('Encryption key');
        }
        key.removeKeyWrapperForUser(userId);
        await this.keyRepository.save(key);
        await this.logEvent({
            organizationId,
            eventType: EncryptionAuditLog_1.EncryptionEventType.KEY_REVOKED,
            userId: revokedBy,
            message: `Encryption key access revoked from user ${userId}`,
            details: {
                keyId,
                targetUserId: userId,
            },
        });
        logger_1.logger.info(`Encryption key access revoked from user ${userId}`);
    }
    async storeEncryptedData(input) {
        const key = await this.keyRepository.findOne({
            where: { organizationId: input.organizationId, keyId: input.keyId, isActive: true },
        });
        if (!key) {
            throw new apiErrors_1.NotFoundError('Active encryption key');
        }
        const normalizedMetadata = this.normalizeEncryptionMetadata(input.encryptionMetadata);
        const data = this.dataRepository.create({
            organizationId: input.organizationId,
            keyId: input.keyId,
            dataType: input.dataType,
            resourceId: input.resourceId,
            encryptedData: input.encryptedData,
            encryptionMetadata: normalizedMetadata,
            createdBy: input.createdBy,
            minSecurityLevel: input.minSecurityLevel || 1,
            allowedRoles: input.allowedRoles,
            accessedCount: 0,
        });
        const saved = await this.dataRepository.save(data);
        key.usageCount += 1;
        key.lastUsedAt = new Date();
        await this.keyRepository.save(key);
        await this.logEvent({
            organizationId: input.organizationId,
            eventType: EncryptionAuditLog_1.EncryptionEventType.DATA_ENCRYPTED,
            userId: input.createdBy,
            message: `Encrypted ${input.dataType} data stored`,
            details: {
                dataId: saved.id,
                dataType: input.dataType,
                keyId: input.keyId,
            },
        });
        logger_1.logger.info(`Encrypted data stored: ${saved.id} (type: ${input.dataType})`);
        return saved;
    }
    async getEncryptedData(organizationId, dataId, userId, userSecurityLevel, userRole) {
        const data = await this.dataRepository.findOne({
            where: { organizationId, id: dataId, isDeleted: false },
        });
        if (!data) {
            throw new apiErrors_1.NotFoundError('Encrypted data');
        }
        if (!data.meetsSecurityLevel(userSecurityLevel)) {
            await this.logEvent({
                organizationId: data.organizationId,
                eventType: EncryptionAuditLog_1.EncryptionEventType.ACCESS_DENIED,
                userId,
                message: `Access denied: insufficient security level`,
                details: {
                    dataId,
                    requiredLevel: data.minSecurityLevel,
                    userLevel: userSecurityLevel,
                },
            });
            throw new apiErrors_1.ForbiddenError('Insufficient security level to access this data');
        }
        if (!data.isRoleAllowed(userRole)) {
            await this.logEvent({
                organizationId: data.organizationId,
                eventType: EncryptionAuditLog_1.EncryptionEventType.ACCESS_DENIED,
                userId,
                message: `Access denied: role not allowed`,
                details: {
                    dataId,
                    allowedRoles: data.allowedRoles,
                    userRole,
                },
            });
            throw new apiErrors_1.ForbiddenError('Your role is not allowed to access this data');
        }
        data.incrementAccessCount();
        await this.dataRepository.save(data);
        await this.logEvent({
            organizationId: data.organizationId,
            eventType: EncryptionAuditLog_1.EncryptionEventType.DATA_DECRYPTED,
            userId,
            message: `Encrypted ${data.dataType} data accessed`,
            details: {
                dataId,
                dataType: data.dataType,
            },
        });
        return data;
    }
    async deleteEncryptedData(organizationId, dataId, deletedBy) {
        const data = await this.dataRepository.findOne({
            where: { organizationId, id: dataId, isDeleted: false },
        });
        if (!data) {
            throw new apiErrors_1.NotFoundError('Encrypted data');
        }
        data.softDelete(deletedBy);
        await this.dataRepository.save(data);
        await this.logEvent({
            organizationId: data.organizationId,
            eventType: EncryptionAuditLog_1.EncryptionEventType.DATA_DELETED,
            userId: deletedBy,
            message: `Encrypted ${data.dataType} data deleted`,
            details: {
                dataId,
                dataType: data.dataType,
            },
        });
        logger_1.logger.info(`Encrypted data deleted: ${dataId}`);
    }
    async getAuditLog(organizationId, options) {
        const query = this.auditRepository
            .createQueryBuilder('log')
            .where('log.organizationId = :organizationId', { organizationId });
        if (options?.eventType) {
            query.andWhere('log.eventType = :eventType', { eventType: options.eventType });
        }
        if (options?.userId) {
            query.andWhere('log.userId = :userId', { userId: options.userId });
        }
        query.orderBy('log.createdAt', 'DESC');
        if (options?.limit) {
            query.take(options.limit);
        }
        if (options?.offset) {
            query.skip(options.offset);
        }
        const [logs, total] = await query.getManyAndCount();
        return { logs, total };
    }
    async rotateKey(organizationId, newKeyId, newWrappedKeys, rotatedBy) {
        const currentKey = await this.keyRepository.findOne({
            where: { organizationId, isActive: true },
        });
        if (!currentKey) {
            throw new apiErrors_1.NotFoundError('Active encryption key');
        }
        currentKey.isActive = false;
        await this.keyRepository.save(currentKey);
        const newKey = this.keyRepository.create({
            organizationId,
            keyId: newKeyId,
            algorithm: currentKey.algorithm,
            keyWrappers: newWrappedKeys,
            recoveryHint: currentKey.recoveryHint,
            requiresRecoveryPhrase: true,
            createdBy: rotatedBy,
            version: currentKey.version + 1,
            isActive: true,
            usageCount: 0,
        });
        const saved = await this.keyRepository.save(newKey);
        await this.logEvent({
            organizationId,
            eventType: EncryptionAuditLog_1.EncryptionEventType.KEY_ROTATED,
            userId: rotatedBy,
            message: `Encryption key rotated from v${currentKey.version} to v${saved.version}`,
            details: {
                oldKeyId: currentKey.keyId,
                newKeyId: saved.keyId,
                version: saved.version,
            },
        });
        logger_1.logger.info(`Encryption key rotated for org ${organizationId}: ${currentKey.keyId} -> ${saved.keyId}`);
        return saved;
    }
    async getDataPendingReEncryption(organizationId, activeKeyId, limit = 50, offset = 0) {
        const [items, _total] = await this.dataRepository.findAndCount({
            where: {
                organizationId,
                isDeleted: false,
            },
            order: { createdAt: 'ASC' },
            take: limit,
            skip: offset,
        });
        const pending = items.filter(item => item.keyId !== activeKeyId);
        const totalPending = await this.dataRepository
            .createQueryBuilder('data')
            .where('data.organizationId = :organizationId', { organizationId })
            .andWhere('data.keyId != :activeKeyId', { activeKeyId })
            .andWhere('data.isDeleted = false')
            .getCount();
        return { items: pending, total: totalPending };
    }
    async updateReEncryptedData(organizationId, dataId, newKeyId, newEncryptedData, newEncryptionMetadata, updatedBy) {
        const data = await this.dataRepository.findOne({
            where: { organizationId, id: dataId, isDeleted: false },
        });
        if (!data) {
            throw new apiErrors_1.NotFoundError('Encrypted data');
        }
        const newKey = await this.keyRepository.findOne({
            where: { organizationId: data.organizationId, keyId: newKeyId, isActive: true },
        });
        if (!newKey) {
            throw new apiErrors_1.NotFoundError('New encryption key');
        }
        const normalizedMetadata = this.normalizeEncryptionMetadata(newEncryptionMetadata);
        const oldKeyId = data.keyId;
        data.keyId = newKeyId;
        data.encryptedData = newEncryptedData;
        data.encryptionMetadata = normalizedMetadata;
        const saved = await this.dataRepository.save(data);
        newKey.usageCount += 1;
        newKey.lastUsedAt = new Date();
        await this.keyRepository.save(newKey);
        await this.logEvent({
            organizationId: data.organizationId,
            eventType: EncryptionAuditLog_1.EncryptionEventType.DATA_REENCRYPTED,
            userId: updatedBy,
            message: `Re-encrypted ${data.dataType} data with new key`,
            details: {
                dataId,
                dataType: data.dataType,
                oldKeyId,
                newKeyId,
            },
        });
        return saved;
    }
    async getReEncryptionProgress(organizationId) {
        const activeKey = await this.keyRepository.findOne({
            where: { organizationId, isActive: true },
        });
        if (!activeKey) {
            return { totalItems: 0, reEncryptedItems: 0, pendingItems: 0, percentComplete: 100 };
        }
        const totalItems = await this.dataRepository.count({
            where: { organizationId, isDeleted: false },
        });
        const reEncryptedItems = await this.dataRepository.count({
            where: { organizationId, keyId: activeKey.keyId, isDeleted: false },
        });
        const pendingItems = totalItems - reEncryptedItems;
        const percentComplete = totalItems === 0 ? 100 : Math.round((reEncryptedItems / totalItems) * 100);
        return { totalItems, reEncryptedItems, pendingItems, percentComplete };
    }
    async getInactiveKeyWrapper(organizationId, keyId, userId) {
        const key = await this.keyRepository.findOne({
            where: { organizationId, keyId },
        });
        if (!key) {
            return null;
        }
        const wrappedKey = key.getKeyWrapperForUser(userId);
        if (!wrappedKey) {
            return null;
        }
        return { wrappedKey, algorithm: key.algorithm };
    }
    async disableEncryption(organizationId, disabledBy) {
        const key = await this.keyRepository.findOne({
            where: { organizationId, isActive: true },
        });
        if (!key) {
            throw new apiErrors_1.ValidationError('Encryption not enabled for this organization');
        }
        key.isActive = false;
        await this.keyRepository.save(key);
        await this.logEvent({
            organizationId,
            eventType: EncryptionAuditLog_1.EncryptionEventType.ENCRYPTION_DISABLED,
            userId: disabledBy,
            message: `Encryption disabled for organization`,
            details: {
                keyId: key.keyId,
            },
        });
        logger_1.logger.warn(`Encryption disabled for org ${organizationId} by ${disabledBy}`);
    }
    async createKeyClaim(input) {
        const key = await this.keyRepository.findOne({
            where: { organizationId: input.organizationId, keyId: input.keyId, isActive: true },
        });
        if (!key) {
            throw new apiErrors_1.NotFoundError('Active encryption key');
        }
        if (!key.hasUserAccess(input.createdBy)) {
            throw new apiErrors_1.ForbiddenError('You do not hold the encryption key');
        }
        const expiresInHours = input.expiresInHours ?? 24;
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
        const claim = this.claimRepository.create({
            organizationId: input.organizationId,
            keyId: input.keyId,
            encryptedClaim: input.encryptedClaim,
            claimMetadata: input.claimMetadata,
            createdBy: input.createdBy,
            label: input.label,
            status: 'pending',
            expiresAt,
        });
        const saved = await this.claimRepository.save(claim);
        const labelSuffix = input.label ? ` (${input.label})` : '';
        await this.logEvent({
            organizationId: input.organizationId,
            eventType: 'KEY_CLAIM_CREATED',
            userId: input.createdBy,
            message: `Key claim token created${labelSuffix}`,
            details: {
                claimId: saved.id,
                keyId: input.keyId,
                label: input.label,
                expiresAt: expiresAt.toISOString(),
            },
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        });
        logger_1.logger.info(`Key claim created for org ${input.organizationId} by ${input.createdBy}`);
        return saved;
    }
    async getClaimToken(organizationId, claimId, userId) {
        const membership = await this.membershipRepository.findOne({
            where: { organizationId, userId, isActive: true },
        });
        if (!membership) {
            throw new apiErrors_1.ForbiddenError('You are not a member of this organization');
        }
        await this.expireOldClaims(organizationId);
        const claim = await this.claimRepository.findOne({
            where: { id: claimId, organizationId, status: 'pending' },
        });
        if (!claim?.isClaimable) {
            return null;
        }
        return {
            encryptedClaim: claim.encryptedClaim,
            claimMetadata: claim.claimMetadata,
        };
    }
    async completeClaim(organizationId, claimId, claimedBy, wrappedKey, ipAddress, userAgent) {
        const claim = await this.claimRepository.findOne({
            where: { id: claimId, organizationId, status: 'pending' },
        });
        if (!claim?.isClaimable) {
            throw new apiErrors_1.NotFoundError('Claim token (not found, expired, or already used)');
        }
        const membership = await this.membershipRepository.findOne({
            where: { organizationId, userId: claimedBy, isActive: true },
        });
        if (!membership) {
            throw new apiErrors_1.ForbiddenError('You are not a member of this organization');
        }
        const key = await this.keyRepository.findOne({
            where: { organizationId, keyId: claim.keyId, isActive: true },
        });
        if (!key) {
            throw new apiErrors_1.ValidationError('Encryption key no longer active');
        }
        key.addKeyWrapperForUser(claimedBy, wrappedKey);
        await this.keyRepository.save(key);
        claim.markClaimed(claimedBy);
        await this.claimRepository.save(claim);
        const labelSuffix = claim.label ? ` (${claim.label})` : '';
        await this.logEvent({
            organizationId,
            eventType: 'KEY_CLAIM_COMPLETED',
            userId: claimedBy,
            message: `Encryption key claimed${labelSuffix}`,
            details: { claimId, keyId: claim.keyId, createdBy: claim.createdBy },
            ipAddress,
            userAgent,
        });
        logger_1.logger.info(`Key claim ${claimId} completed by user ${claimedBy}`);
    }
    async listClaims(organizationId, options) {
        await this.expireOldClaims(organizationId);
        const query = this.claimRepository
            .createQueryBuilder('claim')
            .where('claim.organizationId = :organizationId', { organizationId });
        if (options?.status) {
            query.andWhere('claim.status = :status', { status: options.status });
        }
        query.orderBy('claim.createdAt', 'DESC');
        if (options?.limit) {
            query.take(options.limit);
        }
        if (options?.offset) {
            query.skip(options.offset);
        }
        const [claims, total] = await query.getManyAndCount();
        return { claims, total };
    }
    async revokeClaim(organizationId, claimId, revokedBy) {
        const claim = await this.claimRepository.findOne({
            where: { id: claimId, organizationId, status: 'pending' },
        });
        if (!claim) {
            throw new apiErrors_1.NotFoundError('Pending claim');
        }
        claim.markRevoked();
        await this.claimRepository.save(claim);
        const labelSuffix = claim.label ? ` (${claim.label})` : '';
        await this.logEvent({
            organizationId,
            eventType: 'KEY_CLAIM_REVOKED',
            userId: revokedBy,
            message: `Key claim token revoked${labelSuffix}`,
            details: { claimId, keyId: claim.keyId },
        });
        logger_1.logger.info(`Key claim ${claimId} revoked by ${revokedBy}`);
    }
    async expireOldClaims(organizationId) {
        const query = this.claimRepository
            .createQueryBuilder('claim')
            .update(EncryptionKeyClaim_1.EncryptionKeyClaim)
            .set({ status: 'expired' })
            .where('status = :status', { status: 'pending' })
            .andWhere('"expiresAt" < NOW()');
        if (organizationId) {
            query.andWhere('"organizationId" = :organizationId', { organizationId });
        }
        const result = await query.execute();
        return result.affected ?? 0;
    }
    async registerPublicKey(input) {
        await this.verifyMembership(input.organizationId, input.userId);
        const dupFingerprint = await this.publicKeyRepository.findOne({
            where: { keyFingerprint: input.keyFingerprint },
        });
        if (dupFingerprint &&
            (dupFingerprint.userId !== input.userId ||
                dupFingerprint.organizationId !== input.organizationId)) {
            throw new apiErrors_1.ValidationError('Key fingerprint already registered by another user');
        }
        const existing = await this.publicKeyRepository.findOne({
            where: { organizationId: input.organizationId, userId: input.userId },
        });
        if (existing) {
            existing.publicKey = input.publicKey;
            existing.keyFingerprint = input.keyFingerprint;
            existing.keySize = input.keySize ?? 4096;
            existing.isActive = true;
            const saved = await this.publicKeyRepository.save(existing);
            await this.logEvent({
                organizationId: input.organizationId,
                eventType: 'PUBLIC_KEY_UPDATED',
                userId: input.userId,
                message: 'Member public key updated',
                details: { keyFingerprint: input.keyFingerprint },
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
            });
            return saved;
        }
        const publicKey = this.publicKeyRepository.create({
            organizationId: input.organizationId,
            userId: input.userId,
            publicKey: input.publicKey,
            keyFingerprint: input.keyFingerprint,
            keySize: input.keySize ?? 4096,
            algorithm: 'RSA-OAEP-SHA256',
            isActive: true,
        });
        const saved = await this.publicKeyRepository.save(publicKey);
        await this.logEvent({
            organizationId: input.organizationId,
            eventType: 'PUBLIC_KEY_REGISTERED',
            userId: input.userId,
            message: 'Member public key registered',
            details: { keyFingerprint: input.keyFingerprint, keySize: input.keySize ?? 4096 },
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        });
        logger_1.logger.info(`Public key registered for user ${input.userId} in org ${input.organizationId}`);
        return saved;
    }
    async getPublicKey(organizationId, userId) {
        return this.publicKeyRepository.findOne({
            where: { organizationId, userId, isActive: true },
        });
    }
    async getOrganizationPublicKeys(organizationId) {
        return this.publicKeyRepository.find({
            where: { organizationId, isActive: true },
        });
    }
    async revokePublicKey(input) {
        const key = await this.publicKeyRepository.findOne({
            where: { organizationId: input.organizationId, userId: input.userId, isActive: true },
        });
        if (!key) {
            throw new apiErrors_1.NotFoundError('Active public key for this user');
        }
        key.isActive = false;
        await this.publicKeyRepository.save(key);
        await this.logEvent({
            organizationId: input.organizationId,
            eventType: 'PUBLIC_KEY_REVOKED',
            userId: input.revokedBy,
            message: `Public key revoked for user ${input.userId}`,
            details: { targetUserId: input.userId, keyFingerprint: key.keyFingerprint },
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        });
        logger_1.logger.info(`Public key revoked for user ${input.userId} in org ${input.organizationId}`);
    }
    async createDEK(input) {
        await this.verifyMembership(input.organizationId, input.createdBy);
        const dek = this.dekRepository.create({
            organizationId: input.organizationId,
            dekId: input.dekId,
            dataType: input.dataType,
            resourceId: input.resourceId,
            wrappedKeys: input.wrappedKeys,
            createdBy: input.createdBy,
            version: 1,
            isActive: true,
        });
        const saved = await this.dekRepository.save(dek);
        await this.logEvent({
            organizationId: input.organizationId,
            eventType: 'DEK_CREATED',
            userId: input.createdBy,
            message: `Data encryption key created for ${input.dataType}`,
            details: {
                dekId: input.dekId,
                dataType: input.dataType,
                resourceId: input.resourceId,
                numRecipients: Object.keys(input.wrappedKeys).length,
            },
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        });
        return saved;
    }
    async getDEKForUser(organizationId, dekId, userId) {
        await this.verifyMembership(organizationId, userId);
        const dek = await this.dekRepository.findOne({
            where: { organizationId, dekId, isActive: true },
        });
        if (!dek) {
            return null;
        }
        const wrappedKey = dek.getWrappedKeyForUser(userId);
        if (!wrappedKey) {
            return null;
        }
        return {
            wrappedKey,
            dataType: dek.dataType,
            resourceId: dek.resourceId,
        };
    }
    async getDEKByResource(organizationId, dataType, resourceId, userId) {
        await this.verifyMembership(organizationId, userId);
        const dek = await this.dekRepository.findOne({
            where: { organizationId, dataType, resourceId, isActive: true },
        });
        if (!dek) {
            return null;
        }
        const wrappedKey = dek.getWrappedKeyForUser(userId);
        if (!wrappedKey) {
            return null;
        }
        return { dekId: dek.dekId, wrappedKey };
    }
    async grantDEKAccess(input) {
        await this.verifyMembership(input.organizationId, input.targetUserId);
        const dek = await this.dekRepository.findOne({
            where: { organizationId: input.organizationId, dekId: input.dekId, isActive: true },
        });
        if (!dek) {
            throw new apiErrors_1.NotFoundError('Data encryption key');
        }
        if (!dek.hasUserAccess(input.grantedBy)) {
            throw new apiErrors_1.ForbiddenError('You do not have access to this encryption key');
        }
        dek.addWrappedKeyForUser(input.targetUserId, input.wrappedKey);
        await this.dekRepository.save(dek);
        await this.logEvent({
            organizationId: input.organizationId,
            eventType: 'DEK_ACCESS_GRANTED',
            userId: input.grantedBy,
            message: `DEK access granted to user ${input.targetUserId}`,
            details: { dekId: input.dekId, targetUserId: input.targetUserId },
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        });
    }
    async revokeDEKAccess(input) {
        const dek = await this.dekRepository.findOne({
            where: { organizationId: input.organizationId, dekId: input.dekId, isActive: true },
        });
        if (!dek) {
            throw new apiErrors_1.NotFoundError('Data encryption key');
        }
        if (!dek.hasUserAccess(input.targetUserId)) {
            throw new apiErrors_1.ForbiddenError('User does not have access to this encryption key');
        }
        dek.removeWrappedKeyForUser(input.targetUserId);
        await this.dekRepository.save(dek);
        await this.logEvent({
            organizationId: input.organizationId,
            eventType: 'DEK_ACCESS_REVOKED',
            userId: input.revokedBy,
            message: `DEK access revoked for user ${input.targetUserId}`,
            details: { dekId: input.dekId, targetUserId: input.targetUserId },
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        });
    }
    async listDEKs(organizationId, dataType, resourceId, limit = 50, offset = 0) {
        const query = this.dekRepository
            .createQueryBuilder('dek')
            .where('dek.organizationId = :organizationId', { organizationId })
            .andWhere('dek.isActive = true');
        if (dataType) {
            query.andWhere('dek.dataType = :dataType', { dataType });
        }
        if (resourceId) {
            query.andWhere('dek.resourceId = :resourceId', { resourceId });
        }
        query.orderBy('dek.createdAt', 'DESC').skip(offset).take(limit);
        const [deks, total] = await query.getManyAndCount();
        return { deks, total };
    }
    async storeHybridEncryptedData(input) {
        const dek = await this.dekRepository.findOne({
            where: { organizationId: input.organizationId, dekId: input.dekId, isActive: true },
        });
        if (!dek) {
            throw new apiErrors_1.NotFoundError('Active data encryption key');
        }
        if (!dek.hasUserAccess(input.createdBy)) {
            throw new apiErrors_1.ForbiddenError('You do not have access to this data encryption key');
        }
        const normalizedMetadata = this.normalizeEncryptionMetadata(input.encryptionMetadata);
        const data = this.dataRepository.create({
            organizationId: input.organizationId,
            keyId: input.dekId,
            encryptionMode: 'hybrid',
            dekId: input.dekId,
            dataType: input.dataType,
            resourceId: input.resourceId,
            encryptedData: input.encryptedData,
            encryptionMetadata: normalizedMetadata,
            createdBy: input.createdBy,
            minSecurityLevel: input.minSecurityLevel || 1,
            allowedRoles: input.allowedRoles,
            accessedCount: 0,
        });
        const saved = await this.dataRepository.save(data);
        await this.logEvent({
            organizationId: input.organizationId,
            eventType: EncryptionAuditLog_1.EncryptionEventType.DATA_ENCRYPTED,
            userId: input.createdBy,
            message: `Hybrid-encrypted ${input.dataType} data stored`,
            details: {
                dataId: saved.id,
                dataType: input.dataType,
                dekId: input.dekId,
                encryptionMode: 'hybrid',
            },
        });
        logger_1.logger.info(`Hybrid encrypted data stored: ${saved.id} (type: ${input.dataType}, dek: ${input.dekId})`);
        return saved;
    }
    async getHybridEncryptedData(organizationId, dataId, userId, userSecurityLevel, userRole) {
        const data = await this.dataRepository.findOne({
            where: { organizationId, id: dataId, isDeleted: false, encryptionMode: 'hybrid' },
        });
        if (!data) {
            throw new apiErrors_1.NotFoundError('Hybrid encrypted data');
        }
        if (!data.dekId) {
            throw new apiErrors_1.ValidationError('Data is missing encryption key reference');
        }
        if (!data.meetsSecurityLevel(userSecurityLevel)) {
            await this.logEvent({
                organizationId: data.organizationId,
                eventType: EncryptionAuditLog_1.EncryptionEventType.ACCESS_DENIED,
                userId,
                message: 'Access denied: insufficient security level (hybrid)',
                details: {
                    dataId,
                    requiredLevel: data.minSecurityLevel,
                    userLevel: userSecurityLevel,
                },
            });
            throw new apiErrors_1.ForbiddenError('Insufficient security level to access this data');
        }
        if (!data.isRoleAllowed(userRole)) {
            await this.logEvent({
                organizationId: data.organizationId,
                eventType: EncryptionAuditLog_1.EncryptionEventType.ACCESS_DENIED,
                userId,
                message: 'Access denied: role not allowed (hybrid)',
                details: { dataId, allowedRoles: data.allowedRoles, userRole },
            });
            throw new apiErrors_1.ForbiddenError('Your role is not allowed to access this data');
        }
        const dek = await this.dekRepository.findOne({
            where: { organizationId: data.organizationId, dekId: data.dekId, isActive: true },
        });
        if (!dek) {
            throw new apiErrors_1.NotFoundError('Data encryption key (no longer available)');
        }
        const wrappedKey = dek.getWrappedKeyForUser(userId);
        if (!wrappedKey) {
            await this.logEvent({
                organizationId: data.organizationId,
                eventType: EncryptionAuditLog_1.EncryptionEventType.ACCESS_DENIED,
                userId,
                message: 'Access denied: no DEK access (hybrid)',
                details: { dataId, dekId: data.dekId },
            });
            throw new apiErrors_1.ForbiddenError('You do not have access to the encryption key for this data');
        }
        data.incrementAccessCount();
        await this.dataRepository.save(data);
        await this.logEvent({
            organizationId: data.organizationId,
            eventType: EncryptionAuditLog_1.EncryptionEventType.DATA_DECRYPTED,
            userId,
            message: `Hybrid-encrypted ${data.dataType} data accessed`,
            details: { dataId, dataType: data.dataType, dekId: data.dekId },
        });
        return {
            data,
            wrappedKey,
            dekId: data.dekId,
        };
    }
    async listHybridEncryptedData(organizationId, userId, options) {
        await this.verifyMembership(organizationId, userId);
        const query = this.dataRepository
            .createQueryBuilder('d')
            .where('d.organizationId = :organizationId', { organizationId })
            .andWhere('d.encryptionMode = :mode', { mode: 'hybrid' })
            .andWhere('d.isDeleted = false');
        if (options?.dataType) {
            query.andWhere('d.dataType = :dataType', { dataType: options.dataType });
        }
        if (options?.resourceId) {
            query.andWhere('d.resourceId = :resourceId', { resourceId: options.resourceId });
        }
        query
            .orderBy('d.createdAt', 'DESC')
            .skip(options?.offset ?? 0)
            .take(options?.limit ?? 50);
        const [items, total] = await query.getManyAndCount();
        return { items, total };
    }
    async initiateMigration(organizationId, initiatedBy) {
        await this.verifyMembership(organizationId, initiatedBy);
        const result = await this.dataRepository
            .createQueryBuilder()
            .update(EncryptedData_1.EncryptedData)
            .set({ migrationStatus: 'pending' })
            .where('organizationId = :organizationId', { organizationId })
            .andWhere('encryptionMode = :mode', { mode: 'flat' })
            .andWhere('migrationStatus = :status', { status: 'none' })
            .andWhere('isDeleted = false')
            .execute();
        const totalPending = result.affected ?? 0;
        await this.logEvent({
            organizationId,
            eventType: 'MIGRATION_INITIATED',
            userId: initiatedBy,
            message: `Flat→hybrid migration initiated for ${totalPending} items`,
            details: { totalPending },
        });
        logger_1.logger.info(`Migration initiated for org ${organizationId}: ${totalPending} items pending`);
        return { totalPending };
    }
    async getMigrationCandidates(organizationId, userId, limit = 20, offset = 0) {
        await this.verifyMembership(organizationId, userId);
        const query = this.dataRepository
            .createQueryBuilder('d')
            .where('d.organizationId = :organizationId', { organizationId })
            .andWhere('d.migrationStatus = :status', { status: 'pending' })
            .andWhere('d.isDeleted = false')
            .orderBy('d.createdAt', 'ASC')
            .skip(offset)
            .take(limit);
        const [items, total] = await query.getManyAndCount();
        return { items, total };
    }
    async completeMigrationItem(input) {
        await this.verifyMembership(input.organizationId, input.migratedBy);
        const data = await this.dataRepository.findOne({
            where: {
                id: input.dataId,
                organizationId: input.organizationId,
                migrationStatus: 'pending',
                isDeleted: false,
            },
        });
        if (!data) {
            throw new apiErrors_1.NotFoundError('Migration item (not found or not pending)');
        }
        const dek = await this.dekRepository.findOne({
            where: { organizationId: input.organizationId, dekId: input.dekId, isActive: true },
        });
        if (!dek) {
            throw new apiErrors_1.NotFoundError('Target data encryption key');
        }
        if (!dek.hasUserAccess(input.migratedBy)) {
            throw new apiErrors_1.ForbiddenError('You do not have access to the target encryption key');
        }
        const normalizedMetadata = this.normalizeEncryptionMetadata(input.encryptionMetadata);
        data.encryptedData = input.encryptedData;
        data.encryptionMetadata = normalizedMetadata;
        data.encryptionMode = 'hybrid';
        data.dekId = input.dekId;
        data.keyId = input.dekId;
        data.migrationStatus = 'migrated';
        const saved = await this.dataRepository.save(data);
        await this.logEvent({
            organizationId: input.organizationId,
            eventType: 'MIGRATION_ITEM_COMPLETED',
            userId: input.migratedBy,
            message: `Data item migrated to hybrid mode`,
            details: {
                dataId: input.dataId,
                dekId: input.dekId,
                dataType: data.dataType,
            },
        });
        return saved;
    }
    async getMigrationProgress(organizationId) {
        const totalItems = await this.dataRepository.count({
            where: { organizationId, isDeleted: false },
        });
        const flatItems = await this.dataRepository.count({
            where: { organizationId, encryptionMode: 'flat', migrationStatus: 'none', isDeleted: false },
        });
        const pendingItems = await this.dataRepository.count({
            where: { organizationId, migrationStatus: 'pending', isDeleted: false },
        });
        const migratedItems = await this.dataRepository.count({
            where: { organizationId, migrationStatus: 'migrated', isDeleted: false },
        });
        const migratableTotal = pendingItems + migratedItems;
        const percentComplete = migratableTotal > 0 ? Math.round((migratedItems / migratableTotal) * 100) : 100;
        return {
            totalItems,
            pendingItems,
            migratedItems,
            flatItems,
            percentComplete,
        };
    }
    async verifyMembership(organizationId, userId) {
        const membership = await this.membershipRepository.findOne({
            where: { organizationId, userId, isActive: true },
        });
        if (!membership) {
            throw new apiErrors_1.ForbiddenError('User is not a member of this organization');
        }
    }
    async logEvent(event) {
        const log = this.auditRepository.create(EncryptionAuditLog_1.EncryptionAuditLog.createEntry(event.organizationId, event.eventType, event.userId, event.message, event.details, event.ipAddress, event.userAgent));
        await this.auditRepository.save(log);
    }
}
exports.OrganizationEncryptionService = OrganizationEncryptionService;
//# sourceMappingURL=OrganizationEncryptionService.js.map