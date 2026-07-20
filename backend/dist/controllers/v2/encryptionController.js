"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionControllerV2 = void 0;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const OrganizationEncryptionService_1 = require("../../services/encryption/OrganizationEncryptionService");
const api_1 = require("../../types/api");
const apiErrors_1 = require("../../utils/apiErrors");
const authHelpers_1 = require("../../utils/authHelpers");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
class EncryptionControllerV2 {
    encryptionService = new OrganizationEncryptionService_1.OrganizationEncryptionService();
    membershipRepository = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    userRepository = database_1.AppDataSource.getRepository(User_1.User);
    async initializeEncryption(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const { keyId, algorithm, wrappedKeys, recoveryHint } = req.body;
            if (!organizationId || !keyId || !algorithm || !wrappedKeys) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Organization ID, Key ID, Algorithm, and Wrapped Keys are required', 400);
            }
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const isOwnerOrAdmin = (0, roleUtils_1.isOwnerOrAdminRole)(membership.role);
            if (!isOwnerOrAdmin) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization owners and admins can enable encryption', 403);
            }
            const result = await this.encryptionService.initializeEncryption({
                organizationId,
                keyId,
                algorithm,
                wrappedKeys,
                recoveryHint,
                createdBy: userId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            logger_1.logger.info(`Encryption initialized for org ${organizationId} by user ${userId}`);
            res.status(201).json({
                success: true,
                data: {
                    keyId: result.keyId,
                    algorithm: result.algorithm,
                    version: result.version,
                    createdAt: result.createdAt,
                    numKeyHolders: Object.keys(result.keyWrappers).length,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to initialize encryption: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getEncryptionStatus(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const status = await this.encryptionService.getEncryptionStatus(organizationId);
            res.json({
                success: true,
                data: status,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get encryption status: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getKeyWrapper(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const keyWrapper = await this.encryptionService.getKeyWrapperForUser(organizationId, userId);
            res.json({
                success: true,
                data: keyWrapper,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get key wrapper: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async shareKey(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const { targetUserId, wrappedKey } = req.body;
            if (!targetUserId || !wrappedKey) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Target User ID and Wrapped Key are required', 400);
            }
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const isOwnerOrAdmin = (0, roleUtils_1.isOwnerOrAdminRole)(membership.role);
            if (!isOwnerOrAdmin) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization owners and admins can share encryption keys', 403);
            }
            const status = await this.encryptionService.getEncryptionStatus(organizationId);
            if (!status.enabled || !status.keyId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Encryption not enabled for this organization', 400);
            }
            await this.encryptionService.shareKey({
                organizationId,
                keyId: status.keyId,
                userId: targetUserId,
                wrappedKey,
                sharedBy: userId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            logger_1.logger.info(`Encryption key shared with user ${targetUserId} by ${userId}`);
            res.json({
                success: true,
                message: 'Encryption key shared successfully',
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to share encryption key: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async revokeKeyAccess(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, userId: targetUserId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const isOwnerOrAdmin = (0, roleUtils_1.isOwnerOrAdminRole)(membership.role);
            if (!isOwnerOrAdmin) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization owners and admins can revoke encryption key access', 403);
            }
            const status = await this.encryptionService.getEncryptionStatus(organizationId);
            if (!status.enabled || !status.keyId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Encryption not enabled for this organization', 400);
            }
            await this.encryptionService.revokeKeyAccess(organizationId, status.keyId, targetUserId, userId);
            logger_1.logger.info(`Encryption key access revoked from user ${targetUserId} by ${userId}`);
            res.json({
                success: true,
                message: 'Encryption key access revoked successfully',
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to revoke key access: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async storeEncryptedData(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const { keyId, dataType, resourceId, encryptedData, encryptionMetadata, minSecurityLevel, allowedRoles, } = req.body;
            if (!keyId || !dataType || !encryptedData || !encryptionMetadata) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Key ID, Data Type, Encrypted Data, and Encryption Metadata are required', 400);
            }
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const result = await this.encryptionService.storeEncryptedData({
                organizationId,
                keyId,
                dataType,
                resourceId,
                encryptedData,
                encryptionMetadata,
                createdBy: userId,
                minSecurityLevel,
                allowedRoles,
            });
            logger_1.logger.info(`Encrypted data stored: ${result.id} (type: ${dataType})`);
            res.status(201).json({
                success: true,
                data: {
                    id: result.id,
                    dataType: result.dataType,
                    createdAt: result.createdAt,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to store encrypted data: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getEncryptedData(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, dataId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const data = await this.encryptionService.getEncryptedData(organizationId, dataId, userId, membership.securityLevel || 1, (0, roleUtils_1.getRoleName)(membership.role) || 'member');
            res.json({
                success: true,
                data: {
                    id: data.id,
                    keyId: data.keyId,
                    dataType: data.dataType,
                    resourceId: data.resourceId,
                    encryptedData: data.encryptedData,
                    encryptionMetadata: data.encryptionMetadata,
                    createdAt: data.createdAt,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to retrieve encrypted data: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async deleteEncryptedData(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, dataId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            await this.encryptionService.deleteEncryptedData(organizationId, dataId, userId);
            logger_1.logger.info(`Encrypted data deleted: ${dataId} by user ${userId}`);
            res.json({
                success: true,
                message: 'Encrypted data deleted successfully',
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to delete encrypted data: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getAuditLog(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const { eventType, limit = 50, offset = 0 } = req.query;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const isOwnerOrAdmin = (0, roleUtils_1.isOwnerOrAdminRole)(membership.role);
            if (!isOwnerOrAdmin) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization owners and admins can view encryption audit logs', 403);
            }
            const result = await this.encryptionService.getAuditLog(organizationId, {
                eventType: eventType,
                limit: Number(limit),
                offset: Number(offset),
            });
            res.json({
                success: true,
                data: {
                    logs: result.logs,
                    total: result.total,
                    limit: Number(limit),
                    offset: Number(offset),
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get audit log: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async rotateKey(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const { newKeyId, newWrappedKeys } = req.body;
            if (!newKeyId || !newWrappedKeys) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'New Key ID and New Wrapped Keys are required', 400);
            }
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            if (!(0, roleUtils_1.isOwnerRole)(membership.role)) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization owners can rotate encryption keys', 403);
            }
            const result = await this.encryptionService.rotateKey(organizationId, newKeyId, newWrappedKeys, userId);
            logger_1.logger.info(`Encryption key rotated for org ${organizationId} by user ${userId}`);
            res.json({
                success: true,
                data: {
                    keyId: result.keyId,
                    version: result.version,
                    createdAt: result.createdAt,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to rotate encryption key: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getPendingReEncryption(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const { limit = 50, offset = 0 } = req.query;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const isOwnerOrAdmin = (0, roleUtils_1.isOwnerOrAdminRole)(membership.role);
            if (!isOwnerOrAdmin) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only owners and admins can view re-encryption status', 403);
            }
            const status = await this.encryptionService.getEncryptionStatus(organizationId);
            if (!status.enabled || !status.keyId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Encryption not enabled', 400);
            }
            const result = await this.encryptionService.getDataPendingReEncryption(organizationId, status.keyId, Number(limit), Number(offset));
            res.json({
                success: true,
                data: {
                    items: result.items.map(item => ({
                        id: item.id,
                        keyId: item.keyId,
                        dataType: item.dataType,
                        resourceId: item.resourceId,
                        encryptedData: item.encryptedData,
                        encryptionMetadata: item.encryptionMetadata,
                        createdAt: item.createdAt,
                    })),
                    total: result.total,
                    activeKeyId: status.keyId,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get pending re-encryption: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async submitReEncryptedData(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, dataId } = req.params;
            const { newKeyId, encryptedData, encryptionMetadata } = req.body;
            if (!newKeyId || !encryptedData || !encryptionMetadata) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'newKeyId, encryptedData, and encryptionMetadata are required', 400);
            }
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const isOwnerOrAdmin = (0, roleUtils_1.isOwnerOrAdminRole)(membership.role);
            if (!isOwnerOrAdmin) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only owners and admins can re-encrypt data', 403);
            }
            const result = await this.encryptionService.updateReEncryptedData(organizationId, dataId, newKeyId, encryptedData, encryptionMetadata, userId);
            res.json({
                success: true,
                data: {
                    id: result.id,
                    keyId: result.keyId,
                    dataType: result.dataType,
                    updatedAt: result.updatedAt,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to re-encrypt data: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getReEncryptionProgress(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const progress = await this.encryptionService.getReEncryptionProgress(organizationId);
            res.json({
                success: true,
                data: progress,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get re-encryption progress: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getInactiveKeyWrapper(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, keyId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const isOwnerOrAdmin = (0, roleUtils_1.isOwnerOrAdminRole)(membership.role);
            if (!isOwnerOrAdmin) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only owners and admins can access inactive keys', 403);
            }
            const keyWrapper = await this.encryptionService.getInactiveKeyWrapper(organizationId, keyId, userId);
            if (!keyWrapper) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Key wrapper not found', 404);
            }
            res.json({
                success: true,
                data: keyWrapper,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get inactive key wrapper: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async disableEncryption(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            if (!(0, roleUtils_1.isOwnerRole)(membership.role)) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization owners can disable encryption', 403);
            }
            await this.encryptionService.disableEncryption(organizationId, userId);
            logger_1.logger.warn(`Encryption disabled for org ${organizationId} by user ${userId}`);
            res.json({
                success: true,
                message: 'Encryption disabled successfully',
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to disable encryption: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async createClaim(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const { encryptedClaim, claimMetadata, label, expiresInHours } = req.body;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const isOwnerOrAdmin = (0, roleUtils_1.isOwnerOrAdminRole)(membership.role);
            if (!isOwnerOrAdmin) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization owners and admins can create key claims', 403);
            }
            const status = await this.encryptionService.getEncryptionStatus(organizationId);
            if (!status.enabled || !status.keyId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Encryption is not enabled for this organization', 400);
            }
            const claim = await this.encryptionService.createKeyClaim({
                organizationId,
                keyId: status.keyId,
                encryptedClaim,
                claimMetadata,
                createdBy: userId,
                label,
                expiresInHours,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            res.status(201).json({
                success: true,
                data: {
                    id: claim.id,
                    label: claim.label,
                    status: claim.status,
                    expiresAt: claim.expiresAt,
                    createdAt: claim.createdAt,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to create key claim: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async listClaims(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const { status: claimStatus, limit, offset } = req.query;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const isOwnerOrAdmin = (0, roleUtils_1.isOwnerOrAdminRole)(membership.role);
            if (!isOwnerOrAdmin) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization owners and admins can list key claims', 403);
            }
            const result = await this.encryptionService.listClaims(organizationId, {
                status: claimStatus,
                limit: limit ? Number(limit) : 50,
                offset: offset ? Number(offset) : 0,
            });
            res.json({
                success: true,
                data: result.claims.map(c => ({
                    id: c.id,
                    label: c.label,
                    status: c.status,
                    createdBy: c.createdBy,
                    claimedBy: c.claimedBy,
                    expiresAt: c.expiresAt,
                    claimedAt: c.claimedAt,
                    createdAt: c.createdAt,
                })),
                total: result.total,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to list key claims: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getClaimToken(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, claimId } = req.params;
            const result = await this.encryptionService.getClaimToken(organizationId, claimId, userId);
            if (!result) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.NOT_FOUND, 'Claim token not found, expired, or already used', 404);
            }
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get claim token: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async completeClaim(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, claimId } = req.params;
            const { wrappedKey } = req.body;
            if (!wrappedKey) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'wrappedKey is required', 400);
            }
            await this.encryptionService.completeClaim(organizationId, claimId, userId, wrappedKey, req.ip, req.headers['user-agent']);
            res.json({
                success: true,
                message: 'Encryption key claimed successfully. You now have access to encrypted data.',
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to complete claim: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async revokeClaim(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, claimId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const isOwnerOrAdmin = (0, roleUtils_1.isOwnerOrAdminRole)(membership.role);
            if (!isOwnerOrAdmin) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization owners and admins can revoke claims', 403);
            }
            await this.encryptionService.revokeClaim(organizationId, claimId, userId);
            res.json({
                success: true,
                message: 'Key claim revoked successfully',
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to revoke claim: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async registerPublicKey(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const { publicKey, keyFingerprint, keySize } = req.body;
            const result = await this.encryptionService.registerPublicKey({
                organizationId,
                userId,
                publicKey,
                keyFingerprint,
                keySize,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            logger_1.logger.info(`Public key registered for user ${userId} in org ${organizationId}`);
            res.status(201).json({
                success: true,
                data: {
                    id: result.id,
                    userId: result.userId,
                    keyFingerprint: result.keyFingerprint,
                    keySize: result.keySize,
                    algorithm: result.algorithm,
                    createdAt: result.createdAt,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to register public key: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getOrganizationPublicKeys(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const publicKeys = await this.encryptionService.getOrganizationPublicKeys(organizationId);
            res.json({
                success: true,
                data: publicKeys.map(pk => ({
                    id: pk.id,
                    userId: pk.userId,
                    keyFingerprint: pk.keyFingerprint,
                    keySize: pk.keySize,
                    algorithm: pk.algorithm,
                    isActive: pk.isActive,
                    createdAt: pk.createdAt,
                    lastUsedAt: pk.lastUsedAt,
                })),
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get organization public keys: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getPublicKey(req, res) {
        try {
            const currentUserId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, userId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId: currentUserId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const publicKey = await this.encryptionService.getPublicKey(organizationId, userId);
            if (!publicKey) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Public key not found for this user', 404);
            }
            res.json({
                success: true,
                data: {
                    id: publicKey.id,
                    userId: publicKey.userId,
                    publicKey: publicKey.publicKey,
                    keyFingerprint: publicKey.keyFingerprint,
                    keySize: publicKey.keySize,
                    algorithm: publicKey.algorithm,
                    createdAt: publicKey.createdAt,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get public key: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async revokePublicKey(req, res) {
        try {
            const currentUserId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, userId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId: currentUserId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const isSelf = currentUserId === userId;
            const isOwnerOrAdmin = (0, roleUtils_1.isOwnerOrAdminRole)(membership.role);
            if (!isSelf && !isOwnerOrAdmin) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization owners, admins, or the key owner can revoke a public key', 403);
            }
            await this.encryptionService.revokePublicKey({
                organizationId,
                userId,
                revokedBy: currentUserId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            res.json({
                success: true,
                message: 'Public key revoked successfully',
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to revoke public key: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async createDEK(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const { dekId, dataType, resourceId, wrappedKeys } = req.body;
            const result = await this.encryptionService.createDEK({
                organizationId,
                dekId,
                dataType,
                resourceId,
                wrappedKeys,
                createdBy: userId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            logger_1.logger.info(`DEK created for org ${organizationId}: ${dataType}/${resourceId || '*'}`);
            res.status(201).json({
                success: true,
                data: {
                    id: result.id,
                    dekId: result.dekId,
                    dataType: result.dataType,
                    resourceId: result.resourceId,
                    algorithm: result.algorithm,
                    version: result.version,
                    createdAt: result.createdAt,
                    numRecipients: Object.keys(result.wrappedKeys).length,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to create DEK: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getDEKForUser(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, dekId } = req.params;
            const result = await this.encryptionService.getDEKForUser(organizationId, dekId, userId);
            if (!result) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'DEK not found or you do not have access', 404);
            }
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get DEK: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async listDEKs(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const { dataType, resourceId, limit, offset } = req.query;
            const result = await this.encryptionService.listDEKs(organizationId, dataType, resourceId, limit ? Math.min(Number.parseInt(limit, 10), 200) : undefined, offset ? Number.parseInt(offset, 10) : undefined);
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to list DEKs: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async grantDEKAccess(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, dekId } = req.params;
            const { targetUserId, wrappedKey } = req.body;
            await this.encryptionService.grantDEKAccess({
                organizationId,
                dekId,
                targetUserId,
                wrappedKey,
                grantedBy: userId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            logger_1.logger.info(`DEK access granted: ${dekId} → user ${targetUserId} in org ${organizationId}`);
            res.json({
                success: true,
                message: 'DEK access granted successfully',
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to grant DEK access: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async revokeDEKAccess(req, res) {
        try {
            const currentUserId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, dekId, userId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId: currentUserId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const isOwnerOrAdmin = (0, roleUtils_1.isOwnerOrAdminRole)(membership.role);
            if (!isOwnerOrAdmin) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization owners and admins can revoke DEK access', 403);
            }
            await this.encryptionService.revokeDEKAccess({
                organizationId,
                dekId,
                targetUserId: userId,
                revokedBy: currentUserId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            logger_1.logger.info(`DEK access revoked: ${dekId} ← user ${userId} in org ${organizationId}`);
            res.json({
                success: true,
                message: 'DEK access revoked successfully',
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to revoke DEK access: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async storeHybridEncryptedData(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const { dekId, dataType, resourceId, encryptedData, encryptionMetadata, minSecurityLevel, allowedRoles, } = req.body;
            const saved = await this.encryptionService.storeHybridEncryptedData({
                organizationId,
                dekId,
                dataType,
                resourceId,
                encryptedData,
                encryptionMetadata,
                createdBy: userId,
                minSecurityLevel,
                allowedRoles,
            });
            res.status(201).json({
                success: true,
                data: {
                    id: saved.id,
                    dekId: saved.dekId,
                    dataType: saved.dataType,
                    encryptionMode: saved.encryptionMode,
                    createdAt: saved.createdAt,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to store hybrid encrypted data: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getHybridEncryptedData(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, dataId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const userSecurityLevel = membership.securityLevel || 1;
            const userRole = (0, roleUtils_1.getRoleName)(membership.role);
            const result = await this.encryptionService.getHybridEncryptedData(organizationId, dataId, userId, userSecurityLevel, userRole);
            res.json({
                success: true,
                data: {
                    id: result.data.id,
                    dekId: result.dekId,
                    wrappedKey: result.wrappedKey,
                    dataType: result.data.dataType,
                    resourceId: result.data.resourceId,
                    encryptedData: result.data.encryptedData,
                    encryptionMetadata: result.data.encryptionMetadata,
                    encryptionMode: result.data.encryptionMode,
                    createdAt: result.data.createdAt,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to retrieve hybrid encrypted data: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async listHybridEncryptedData(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const { dataType, resourceId, limit, offset } = req.query;
            const result = await this.encryptionService.listHybridEncryptedData(organizationId, userId, {
                dataType: dataType,
                resourceId: resourceId,
                limit: limit ? Number(limit) : undefined,
                offset: offset ? Number(offset) : undefined,
            });
            res.json({
                success: true,
                data: result.items.map(item => ({
                    id: item.id,
                    dekId: item.dekId,
                    dataType: item.dataType,
                    resourceId: item.resourceId,
                    encryptionMode: item.encryptionMode,
                    createdAt: item.createdAt,
                    createdBy: item.createdBy,
                })),
                total: result.total,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to list hybrid encrypted data: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async initiateMigration(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const roleName = (0, roleUtils_1.getRoleName)(membership.role);
            if (!(0, roleUtils_1.isOwnerOrAdminRole)(roleName)) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization owners and admins can initiate migration', 403);
            }
            const result = await this.encryptionService.initiateMigration(organizationId, userId);
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to initiate migration: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getMigrationCandidates(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const { limit, offset } = req.query;
            const result = await this.encryptionService.getMigrationCandidates(organizationId, userId, limit ? Number(limit) : undefined, offset ? Number(offset) : undefined);
            res.json({
                success: true,
                data: result.items.map(item => ({
                    id: item.id,
                    keyId: item.keyId,
                    dataType: item.dataType,
                    resourceId: item.resourceId,
                    encryptedData: item.encryptedData,
                    encryptionMetadata: item.encryptionMetadata,
                    encryptionMode: item.encryptionMode,
                    migrationStatus: item.migrationStatus,
                })),
                total: result.total,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get migration candidates: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async completeMigrationItem(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId, dataId } = req.params;
            const { dekId, encryptedData, encryptionMetadata } = req.body;
            const saved = await this.encryptionService.completeMigrationItem({
                organizationId,
                dataId,
                dekId,
                encryptedData,
                encryptionMetadata,
                migratedBy: userId,
            });
            res.json({
                success: true,
                data: {
                    id: saved.id,
                    dekId: saved.dekId,
                    dataType: saved.dataType,
                    encryptionMode: saved.encryptionMode,
                    migrationStatus: saved.migrationStatus,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to complete migration item: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
    async getMigrationProgress(req, res) {
        try {
            const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
            const { organizationId } = req.params;
            const membership = await this.membershipRepository.findOne({
                where: { organizationId, userId, isActive: true },
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const progress = await this.encryptionService.getMigrationProgress(organizationId);
            res.json({
                success: true,
                data: progress,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError || (0, apiErrors_1.isOperationalError)(error)) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get migration progress: ${(0, errorHandler_1.getErrorMessage)(error)}`, 500);
        }
    }
}
exports.EncryptionControllerV2 = EncryptionControllerV2;
//# sourceMappingURL=encryptionController.js.map