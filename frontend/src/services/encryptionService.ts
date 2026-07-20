/**
 * Encryption Service
 * Handles organization-level end-to-end encryption API calls
 *
 * Backend routes: /api/v2/organizations/:organizationId/encryption/*
 *                 /api/v2/organizations/:organizationId/encrypted-data/*
 *
 * Created in Sprint 0.5 — Wire Unwired Features
 */

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

import { withGatewayRetry } from '@/utils/retryRequest';

// ============================================================================
// Types
// ============================================================================

export interface EncryptionStatus {
  enabled: boolean;
  algorithm?: string;
  keyCreatedAt?: string;
  keyVersion?: number;
  totalEncryptedItems?: number;
  authorizedUsers?: number;
}

export interface EncryptionKeyWrapper {
  keyId: string;
  encryptedKey: string;
  algorithm: string;
  version: number;
  createdAt: string;
}

export interface ShareKeyRequest {
  targetUserId: string;
  encryptedKeyWrapper: string;
}

export interface ShareKeyResponse {
  message: string;
  sharedWith: string;
}

export interface EncryptedDataItem {
  id: string;
  organizationId: string;
  dataType: string;
  encryptedContent: string;
  iv: string;
  tag?: string;
  keyVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreEncryptedDataRequest {
  dataType: string;
  encryptedContent: string;
  iv: string;
  tag?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  userId: string;
  targetUserId?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface ReEncryptionProgress {
  totalItems: number;
  reEncryptedItems: number;
  pendingItems: number;
  percentComplete: number;
}

export interface PendingReEncryptionItem {
  id: string;
  dataType: string;
  keyVersion: number;
  createdAt: string;
}

export interface ReEncryptDataRequest {
  encryptedContent: string;
  iv: string;
  tag?: string;
  newKeyVersion: number;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Encryption Service
 *
 * Provides API methods for managing organization-level end-to-end encryption,
 * including key management, data encryption/decryption, and key rotation.
 */
export class EncryptionService extends BaseService {
  protected basePath = '/api/v2/organizations';

  // ==================== Encryption Management ====================

  /**
   * Initialize encryption for an organization
   */
  async initializeEncryption(organizationId: string): Promise<EncryptionStatus> {
    try {
      this.log('initializeEncryption', { organizationId });
      const response = await apiClient.post<EncryptionStatus>(
        `${this.basePath}/${organizationId}/encryption/initialize`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'initializeEncryption');
    }
  }

  /**
   * Get encryption status for an organization
   */
  async getEncryptionStatus(organizationId: string): Promise<EncryptionStatus> {
    try {
      this.log('getEncryptionStatus', { organizationId });
      const response = await apiClient.get<EncryptionStatus>(
        `${this.basePath}/${organizationId}/encryption/status`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getEncryptionStatus');
    }
  }

  /**
   * Get encrypted key wrapper for current user
   */
  async getKeyWrapper(organizationId: string): Promise<EncryptionKeyWrapper> {
    try {
      this.log('getKeyWrapper', { organizationId });
      const response = await apiClient.get<EncryptionKeyWrapper>(
        `${this.basePath}/${organizationId}/encryption/key`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getKeyWrapper');
    }
  }

  /**
   * Get an inactive key's wrapper for re-encryption
   */
  async getInactiveKeyWrapper(
    organizationId: string,
    keyId: string
  ): Promise<EncryptionKeyWrapper> {
    try {
      this.log('getInactiveKeyWrapper', { organizationId, keyId });
      const response = await apiClient.get<EncryptionKeyWrapper>(
        `${this.basePath}/${organizationId}/encryption/key/${keyId}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getInactiveKeyWrapper');
    }
  }

  /**
   * Share encryption key with another user
   */
  async shareKey(organizationId: string, data: ShareKeyRequest): Promise<ShareKeyResponse> {
    try {
      this.log('shareKey', { organizationId, targetUserId: data.targetUserId });
      const response = await apiClient.post<ShareKeyResponse>(
        `${this.basePath}/${organizationId}/encryption/share-key`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'shareKey');
    }
  }

  /**
   * Revoke encryption key access from a user
   */
  async revokeKeyAccess(organizationId: string, userId: string): Promise<void> {
    try {
      this.log('revokeKeyAccess', { organizationId, userId });
      await apiClient.delete(`${this.basePath}/${organizationId}/encryption/revoke-key/${userId}`);
    } catch (error) {
      this.handleError(error, 'revokeKeyAccess');
    }
  }

  /**
   * Disable encryption for an organization.
   * Retries on gateway errors (502/503/504) since this operation is idempotent.
   */
  async disableEncryption(organizationId: string): Promise<void> {
    try {
      this.log('disableEncryption', { organizationId });
      await withGatewayRetry(() =>
        apiClient.delete(`${this.basePath}/${organizationId}/encryption`)
      );
    } catch (error) {
      this.handleError(error, 'disableEncryption');
    }
  }

  // ==================== Encrypted Data ====================

  /**
   * Store encrypted data
   */
  async storeEncryptedData(
    organizationId: string,
    data: StoreEncryptedDataRequest
  ): Promise<EncryptedDataItem> {
    try {
      this.log('storeEncryptedData', { organizationId, dataType: data.dataType });
      const response = await apiClient.post<EncryptedDataItem>(
        `${this.basePath}/${organizationId}/encrypted-data`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'storeEncryptedData');
    }
  }

  /**
   * Retrieve encrypted data
   */
  async getEncryptedData(organizationId: string, dataId: string): Promise<EncryptedDataItem> {
    try {
      this.log('getEncryptedData', { organizationId, dataId });
      const response = await apiClient.get<EncryptedDataItem>(
        `${this.basePath}/${organizationId}/encrypted-data/${dataId}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getEncryptedData');
    }
  }

  /**
   * Delete encrypted data
   */
  async deleteEncryptedData(organizationId: string, dataId: string): Promise<void> {
    try {
      this.log('deleteEncryptedData', { organizationId, dataId });
      await apiClient.delete(`${this.basePath}/${organizationId}/encrypted-data/${dataId}`);
    } catch (error) {
      this.handleError(error, 'deleteEncryptedData');
    }
  }

  // ==================== Key Rotation ====================

  /**
   * Rotate encryption key
   */
  async rotateKey(organizationId: string): Promise<EncryptionKeyWrapper> {
    try {
      this.log('rotateKey', { organizationId });
      const response = await apiClient.post<EncryptionKeyWrapper>(
        `${this.basePath}/${organizationId}/encryption/rotate-key`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'rotateKey');
    }
  }

  /**
   * Get data items that need re-encryption after key rotation
   */
  async getPendingReEncryption(organizationId: string): Promise<PendingReEncryptionItem[]> {
    try {
      this.log('getPendingReEncryption', { organizationId });
      const response = await apiClient.get<PendingReEncryptionItem[]>(
        `${this.basePath}/${organizationId}/encryption/pending-reencryption`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getPendingReEncryption');
    }
  }

  /**
   * Get re-encryption progress after key rotation
   */
  async getReEncryptionProgress(organizationId: string): Promise<ReEncryptionProgress> {
    try {
      this.log('getReEncryptionProgress', { organizationId });
      const response = await apiClient.get<ReEncryptionProgress>(
        `${this.basePath}/${organizationId}/encryption/reencryption-progress`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getReEncryptionProgress');
    }
  }

  /**
   * Submit re-encrypted data item
   */
  async submitReEncryptedData(
    organizationId: string,
    dataId: string,
    data: ReEncryptDataRequest
  ): Promise<EncryptedDataItem> {
    try {
      this.log('submitReEncryptedData', { organizationId, dataId });
      const response = await apiClient.put<EncryptedDataItem>(
        `${this.basePath}/${organizationId}/encrypted-data/${dataId}/reencrypt`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'submitReEncryptedData');
    }
  }

  // ==================== Audit ====================

  /**
   * Get encryption audit log
   */
  async getAuditLog(organizationId: string): Promise<AuditLogEntry[]> {
    try {
      this.log('getAuditLog', { organizationId });
      const response = await apiClient.get<AuditLogEntry[]>(
        `${this.basePath}/${organizationId}/encryption/audit-log`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAuditLog');
    }
  }
}

// Create singleton instance
export const encryptionService = new EncryptionService();
