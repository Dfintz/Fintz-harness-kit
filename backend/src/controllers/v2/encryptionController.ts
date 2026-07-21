/**
 * Encryption Controller V2
 * Handles organization-level end-to-end encryption endpoints
 */

import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import type { KeyClaimStatus } from '../../models/EncryptionKeyClaim';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { OrganizationEncryptionService } from '../../services/encryption/OrganizationEncryptionService';
import { ApiErrorCode } from '../../types/api';
import { isOperationalError } from '../../utils/apiErrors';
import { getAuthenticatedUserId } from '../../utils/authHelpers';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { getRoleName, isOwnerOrAdminRole, isOwnerRole } from '../../utils/roleUtils';

export class EncryptionControllerV2 {
  private readonly encryptionService = new OrganizationEncryptionService();
  private readonly membershipRepository = AppDataSource.getRepository(OrganizationMembership);
  private readonly userRepository = AppDataSource.getRepository(User);

  /**
   * POST /api/v2/organizations/:organizationId/encryption/initialize
   * Initialize encryption for an organization
   */
  async initializeEncryption(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;
      const { keyId, algorithm, wrappedKeys, recoveryHint } = req.body;

      if (!organizationId || !keyId || !algorithm || !wrappedKeys) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Organization ID, Key ID, Algorithm, and Wrapped Keys are required',
          400
        );
      }

      // Verify user is org owner or admin
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      // Check if user has permission to enable encryption (owner/admin)
      const isOwnerOrAdmin = isOwnerOrAdminRole(membership.role);

      if (!isOwnerOrAdmin) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only organization owners and admins can enable encryption',
          403
        );
      }

      // Initialize encryption
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

      logger.info(`Encryption initialized for org ${organizationId} by user ${userId}`);

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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to initialize encryption: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/status
   * Get encryption status for an organization
   */
  async getEncryptionStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;

      // Verify user is a member
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const status = await this.encryptionService.getEncryptionStatus(organizationId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get encryption status: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/key
   * Get encrypted key wrapper for current user
   */
  async getKeyWrapper(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;

      // Verify user is a member
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const keyWrapper = await this.encryptionService.getKeyWrapperForUser(organizationId, userId);

      // Return null data when no key wrapper exists (encryption not initialized
      // or user not granted access). This is a normal state, not an error —
      // returning 200 avoids noisy XHR 404 errors in the browser console.
      res.json({
        success: true,
        data: keyWrapper,
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get key wrapper: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:organizationId/encryption/share-key
   * Share encryption key with another user
   */
  async shareKey(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;
      const { targetUserId, wrappedKey } = req.body;

      if (!targetUserId || !wrappedKey) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Target User ID and Wrapped Key are required',
          400
        );
      }

      // Verify current user is org owner or admin
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const isOwnerOrAdmin = isOwnerOrAdminRole(membership.role);

      if (!isOwnerOrAdmin) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only organization owners and admins can share encryption keys',
          403
        );
      }

      // Get current key ID
      const status = await this.encryptionService.getEncryptionStatus(organizationId);
      if (!status.enabled || !status.keyId) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Encryption not enabled for this organization',
          400
        );
      }

      // Share key
      await this.encryptionService.shareKey({
        organizationId,
        keyId: status.keyId,
        userId: targetUserId,
        wrappedKey,
        sharedBy: userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      logger.info(`Encryption key shared with user ${targetUserId} by ${userId}`);

      res.json({
        success: true,
        message: 'Encryption key shared successfully',
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to share encryption key: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * DELETE /api/v2/organizations/:organizationId/encryption/revoke-key/:userId
   * Revoke encryption key access from a user
   */
  async revokeKeyAccess(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId, userId: targetUserId } = req.params;

      // Verify current user is org owner or admin
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const isOwnerOrAdmin = isOwnerOrAdminRole(membership.role);

      if (!isOwnerOrAdmin) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only organization owners and admins can revoke encryption key access',
          403
        );
      }

      // Get current key ID
      const status = await this.encryptionService.getEncryptionStatus(organizationId);
      if (!status.enabled || !status.keyId) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Encryption not enabled for this organization',
          400
        );
      }

      // Revoke access
      await this.encryptionService.revokeKeyAccess(
        organizationId,
        status.keyId,
        targetUserId,
        userId
      );

      logger.info(`Encryption key access revoked from user ${targetUserId} by ${userId}`);

      res.json({
        success: true,
        message: 'Encryption key access revoked successfully',
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to revoke key access: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:organizationId/encrypted-data
   * Store encrypted data
   */
  async storeEncryptedData(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;
      const {
        keyId,
        dataType,
        resourceId,
        encryptedData,
        encryptionMetadata,
        minSecurityLevel,
        allowedRoles,
      } = req.body;

      if (!keyId || !dataType || !encryptedData || !encryptionMetadata) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Key ID, Data Type, Encrypted Data, and Encryption Metadata are required',
          400
        );
      }

      // Verify user is a member
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      // Store encrypted data
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

      logger.info(`Encrypted data stored: ${result.id} (type: ${dataType})`);

      res.status(201).json({
        success: true,
        data: {
          id: result.id,
          dataType: result.dataType,
          createdAt: result.createdAt,
        },
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to store encrypted data: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encrypted-data/:dataId
   * Retrieve encrypted data
   */
  async getEncryptedData(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId, dataId } = req.params;

      // Get user's membership with security level and role
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      // Retrieve encrypted data (service enforces access control)
      const data = await this.encryptionService.getEncryptedData(
        organizationId,
        dataId,
        userId,
        membership.securityLevel || 1,
        getRoleName(membership.role) || 'member'
      );

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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to retrieve encrypted data: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * DELETE /api/v2/organizations/:organizationId/encrypted-data/:dataId
   * Delete encrypted data
   */
  async deleteEncryptedData(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId, dataId } = req.params;

      // Verify user is a member
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      // Delete encrypted data
      await this.encryptionService.deleteEncryptedData(organizationId, dataId, userId);

      logger.info(`Encrypted data deleted: ${dataId} by user ${userId}`);

      res.json({
        success: true,
        message: 'Encrypted data deleted successfully',
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to delete encrypted data: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/audit-log
   * Get encryption audit log
   */
  async getAuditLog(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;
      const { eventType, limit = 50, offset = 0 } = req.query;

      // Verify user is org owner or admin
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const isOwnerOrAdmin = isOwnerOrAdminRole(membership.role);

      if (!isOwnerOrAdmin) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only organization owners and admins can view encryption audit logs',
          403
        );
      }

      // Get audit log
      const result = await this.encryptionService.getAuditLog(organizationId, {
        eventType: eventType as string,
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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get audit log: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:organizationId/encryption/rotate-key
   * Rotate encryption key
   */
  async rotateKey(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;
      const { newKeyId, newWrappedKeys } = req.body;

      if (!newKeyId || !newWrappedKeys) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'New Key ID and New Wrapped Keys are required',
          400
        );
      }

      // Verify user is org owner
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      if (!isOwnerRole(membership.role)) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only organization owners can rotate encryption keys',
          403
        );
      }

      // Rotate key
      const result = await this.encryptionService.rotateKey(
        organizationId,
        newKeyId,
        newWrappedKeys,
        userId
      );

      logger.info(`Encryption key rotated for org ${organizationId} by user ${userId}`);

      res.json({
        success: true,
        data: {
          keyId: result.keyId,
          version: result.version,
          createdAt: result.createdAt,
        },
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to rotate encryption key: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/pending-reencryption
   * Get data items that need re-encryption after key rotation
   */
  async getPendingReEncryption(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // Verify user is org owner or admin
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const isOwnerOrAdmin = isOwnerOrAdminRole(membership.role);
      if (!isOwnerOrAdmin) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only owners and admins can view re-encryption status',
          403
        );
      }

      // Get active key
      const status = await this.encryptionService.getEncryptionStatus(organizationId);
      if (!status.enabled || !status.keyId) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Encryption not enabled', 400);
      }

      const result = await this.encryptionService.getDataPendingReEncryption(
        organizationId,
        status.keyId,
        Number(limit),
        Number(offset)
      );

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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get pending re-encryption: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * PUT /api/v2/organizations/:organizationId/encrypted-data/:dataId/reencrypt
   * Submit re-encrypted data (client decrypted with old key, re-encrypted with new key)
   */
  async submitReEncryptedData(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId, dataId } = req.params;
      const { newKeyId, encryptedData, encryptionMetadata } = req.body;

      if (!newKeyId || !encryptedData || !encryptionMetadata) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'newKeyId, encryptedData, and encryptionMetadata are required',
          400
        );
      }

      // Verify user is org owner or admin
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const isOwnerOrAdmin = isOwnerOrAdminRole(membership.role);
      if (!isOwnerOrAdmin) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only owners and admins can re-encrypt data',
          403
        );
      }

      const result = await this.encryptionService.updateReEncryptedData(
        organizationId,
        dataId,
        newKeyId,
        encryptedData,
        encryptionMetadata,
        userId
      );

      res.json({
        success: true,
        data: {
          id: result.id,
          keyId: result.keyId,
          dataType: result.dataType,
          updatedAt: result.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to re-encrypt data: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/reencryption-progress
   * Get re-encryption progress after key rotation
   */
  async getReEncryptionProgress(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;

      // Verify user is a member
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const progress = await this.encryptionService.getReEncryptionProgress(organizationId);

      res.json({
        success: true,
        data: progress,
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get re-encryption progress: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/key/:keyId
   * Get an inactive key's wrapper (for re-encryption with old key)
   */
  async getInactiveKeyWrapper(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId, keyId } = req.params;

      // Verify user is org owner or admin
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const isOwnerOrAdmin = isOwnerOrAdminRole(membership.role);
      if (!isOwnerOrAdmin) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only owners and admins can access inactive keys',
          403
        );
      }

      const keyWrapper = await this.encryptionService.getInactiveKeyWrapper(
        organizationId,
        keyId,
        userId
      );

      if (!keyWrapper) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Key wrapper not found', 404);
      }

      res.json({
        success: true,
        data: keyWrapper,
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get inactive key wrapper: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * DELETE /api/v2/organizations/:organizationId/encryption
   * Disable encryption for an organization
   */
  async disableEncryption(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;

      // Verify user is org owner
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      if (!isOwnerRole(membership.role)) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only organization owners can disable encryption',
          403
        );
      }

      // Disable encryption
      await this.encryptionService.disableEncryption(organizationId, userId);

      logger.warn(`Encryption disabled for org ${organizationId} by user ${userId}`);

      res.json({
        success: true,
        message: 'Encryption disabled successfully',
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to disable encryption: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  // ===========================================================================
  // Key Claim Token Endpoints
  // ===========================================================================

  /**
   * POST /api/v2/organizations/:organizationId/encryption/claims
   * Create a key claim token for secure key distribution
   */
  async createClaim(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;
      const { encryptedClaim, claimMetadata, label, expiresInHours } = req.body;

      // Verify user is org owner or admin
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });
      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }
      const isOwnerOrAdmin = isOwnerOrAdminRole(membership.role);
      if (!isOwnerOrAdmin) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only organization owners and admins can create key claims',
          403
        );
      }

      // Get the active key to pass keyId
      const status = await this.encryptionService.getEncryptionStatus(organizationId);
      if (!status.enabled || !status.keyId) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Encryption is not enabled for this organization',
          400
        );
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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to create key claim: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/claims
   * List all key claims for an organization (admin view)
   */
  async listClaims(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;
      const { status: claimStatus, limit, offset } = req.query;

      // Verify user is org owner or admin
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });
      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }
      const isOwnerOrAdmin = isOwnerOrAdminRole(membership.role);
      if (!isOwnerOrAdmin) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only organization owners and admins can list key claims',
          403
        );
      }

      const result = await this.encryptionService.listClaims(organizationId, {
        status: claimStatus as KeyClaimStatus | undefined,
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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to list key claims: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/claims/:claimId
   * Get an encrypted claim blob (any org member can fetch to claim it)
   */
  async getClaimToken(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId, claimId } = req.params;

      const result = await this.encryptionService.getClaimToken(organizationId, claimId, userId);

      if (!result) {
        throw new ApiError(
          ApiErrorCode.NOT_FOUND,
          'Claim token not found, expired, or already used',
          404
        );
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get claim token: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:organizationId/encryption/claims/:claimId/complete
   * Complete a claim — save the member's new key wrapper
   */
  async completeClaim(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId, claimId } = req.params;
      const { wrappedKey } = req.body;

      if (!wrappedKey) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'wrappedKey is required', 400);
      }

      await this.encryptionService.completeClaim(
        organizationId,
        claimId,
        userId,
        wrappedKey,
        req.ip,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        message: 'Encryption key claimed successfully. You now have access to encrypted data.',
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to complete claim: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * DELETE /api/v2/organizations/:organizationId/encryption/claims/:claimId
   * Revoke a pending claim token
   */
  async revokeClaim(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId, claimId } = req.params;

      // Verify user is org owner or admin
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });
      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }
      const isOwnerOrAdmin = isOwnerOrAdminRole(membership.role);
      if (!isOwnerOrAdmin) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only organization owners and admins can revoke claims',
          403
        );
      }

      await this.encryptionService.revokeClaim(organizationId, claimId, userId);

      res.json({
        success: true,
        message: 'Key claim revoked successfully',
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to revoke claim: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  // ===========================================================================
  // Hybrid Encryption: Public Keys + Data Encryption Keys (DEK) Methods
  // ===========================================================================

  /**
   * POST /api/v2/organizations/:organizationId/encryption/public-keys
   * Register the current user's RSA-OAEP public key
   */
  async registerPublicKey(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;

      // Verify membership (defense-in-depth alongside service-layer checks)
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });
      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
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

      logger.info(`Public key registered for user ${userId} in org ${organizationId}`);

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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to register public key: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/public-keys
   * Get all active public keys for the organization
   */
  async getOrganizationPublicKeys(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;

      // Verify membership
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });
      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get organization public keys: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/public-keys/:userId
   * Get a specific member's public key
   */
  async getPublicKey(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = getAuthenticatedUserId(req);
      const { organizationId, userId } = req.params;

      // Verify requester is a member
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId: currentUserId, isActive: true },
      });
      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const publicKey = await this.encryptionService.getPublicKey(organizationId, userId);

      if (!publicKey) {
        throw new ApiError(
          ApiErrorCode.RESOURCE_NOT_FOUND,
          'Public key not found for this user',
          404
        );
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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get public key: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * DELETE /api/v2/organizations/:organizationId/encryption/public-keys/:userId
   * Revoke a member's public key (owner/admin only, or self)
   */
  async revokePublicKey(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = getAuthenticatedUserId(req);
      const { organizationId, userId } = req.params;

      // Check membership and authorization
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId: currentUserId, isActive: true },
      });
      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      // Allow self-revocation or owner/admin
      const isSelf = currentUserId === userId;
      const isOwnerOrAdmin = isOwnerOrAdminRole(membership.role);

      if (!isSelf && !isOwnerOrAdmin) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only organization owners, admins, or the key owner can revoke a public key',
          403
        );
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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to revoke public key: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:organizationId/encryption/deks
   * Create a new Data Encryption Key
   */
  async createDEK(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
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

      logger.info(`DEK created for org ${organizationId}: ${dataType}/${resourceId || '*'}`);

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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to create DEK: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/deks/:dekId
   * Get the wrapped DEK for the current user
   */
  async getDEKForUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId, dekId } = req.params;

      const result = await this.encryptionService.getDEKForUser(organizationId, dekId, userId);

      if (!result) {
        throw new ApiError(
          ApiErrorCode.RESOURCE_NOT_FOUND,
          'DEK not found or you do not have access',
          404
        );
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get DEK: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/deks
   * List DEKs (optionally filtered)
   */
  async listDEKs(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;

      // Verify membership (consistent with other DEK methods)
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });
      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const { dataType, resourceId, limit, offset } = req.query;

      const result = await this.encryptionService.listDEKs(
        organizationId,
        dataType as string | undefined,
        resourceId as string | undefined,
        limit ? Math.min(Number.parseInt(limit as string, 10), 200) : undefined,
        offset ? Number.parseInt(offset as string, 10) : undefined
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to list DEKs: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:organizationId/encryption/deks/:dekId/grant
   * Grant DEK access to another user
   */
  async grantDEKAccess(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
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

      logger.info(`DEK access granted: ${dekId} → user ${targetUserId} in org ${organizationId}`);

      res.json({
        success: true,
        message: 'DEK access granted successfully',
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to grant DEK access: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * DELETE /api/v2/organizations/:organizationId/encryption/deks/:dekId/revoke/:userId
   * Revoke a user's DEK access
   */
  async revokeDEKAccess(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = getAuthenticatedUserId(req);
      const { organizationId, dekId, userId } = req.params;

      // Check membership and authorization
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId: currentUserId, isActive: true },
      });
      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const isOwnerOrAdmin = isOwnerOrAdminRole(membership.role);
      if (!isOwnerOrAdmin) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only organization owners and admins can revoke DEK access',
          403
        );
      }

      await this.encryptionService.revokeDEKAccess({
        organizationId,
        dekId,
        targetUserId: userId,
        revokedBy: currentUserId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      logger.info(`DEK access revoked: ${dekId} ← user ${userId} in org ${organizationId}`);

      res.json({
        success: true,
        message: 'DEK access revoked successfully',
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to revoke DEK access: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  // ===========================================================================
  // Phase 3: Hybrid-Mode Encrypted Data Endpoints
  // ===========================================================================

  /**
   * POST /api/v2/organizations/:organizationId/encryption/hybrid-data
   * Store data encrypted with a per-resource DEK (hybrid mode)
   */
  async storeHybridEncryptedData(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;

      // Verify membership (defense-in-depth alongside service-layer checks)
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });
      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const {
        dekId,
        dataType,
        resourceId,
        encryptedData,
        encryptionMetadata,
        minSecurityLevel,
        allowedRoles,
      } = req.body;

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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to store hybrid encrypted data: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/hybrid-data/:dataId
   * Retrieve hybrid-encrypted data + wrapped DEK for the current user
   */
  async getHybridEncryptedData(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId, dataId } = req.params;

      // Get user details for security level + role
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });
      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const userSecurityLevel = membership.securityLevel || 1;
      const userRole = getRoleName(membership.role);

      const result = await this.encryptionService.getHybridEncryptedData(
        organizationId,
        dataId,
        userId,
        userSecurityLevel,
        userRole
      );

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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to retrieve hybrid encrypted data: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/hybrid-data
   * List hybrid-encrypted data items
   */
  async listHybridEncryptedData(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;
      const { dataType, resourceId, limit, offset } = req.query;

      const result = await this.encryptionService.listHybridEncryptedData(organizationId, userId, {
        dataType: dataType as string | undefined,
        resourceId: resourceId as string | undefined,
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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to list hybrid encrypted data: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  // ===========================================================================
  // Phase 4: Flat → Hybrid Migration Endpoints
  // ===========================================================================

  /**
   * POST /api/v2/organizations/:organizationId/encryption/migration/initiate
   * Mark all flat-mode data as pending migration
   */
  async initiateMigration(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;

      // Only owners/admins can initiate migration
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });
      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const roleName = getRoleName(membership.role);
      if (!isOwnerOrAdminRole(roleName)) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only organization owners and admins can initiate migration',
          403
        );
      }

      const result = await this.encryptionService.initiateMigration(organizationId, userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to initiate migration: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/migration/candidates
   * Get flat-mode items pending migration for client-side re-encryption
   */
  async getMigrationCandidates(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;
      const { limit, offset } = req.query;

      const result = await this.encryptionService.getMigrationCandidates(
        organizationId,
        userId,
        limit ? Number(limit) : undefined,
        offset ? Number(offset) : undefined
      );

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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get migration candidates: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:organizationId/encryption/migration/:dataId/complete
   * Submit a single re-encrypted migration item
   */
  async completeMigrationItem(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
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
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to complete migration item: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:organizationId/encryption/migration/progress
   * Get migration progress stats
   */
  async getMigrationProgress(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { organizationId } = req.params;

      // Verify membership
      const membership = await this.membershipRepository.findOne({
        where: { organizationId, userId, isActive: true },
      });
      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const progress = await this.encryptionService.getMigrationProgress(organizationId);

      res.json({
        success: true,
        data: progress,
      });
    } catch (error) {
      if (error instanceof ApiError || isOperationalError(error)) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get migration progress: ${getErrorMessage(error)}`,
        500
      );
    }
  }
}
