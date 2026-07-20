/**
 * Encryption API Service
 * Handles API calls for encryption management
 */

import { apiClient, isApiClientError } from '@/services/apiClient';
import { withGatewayRetry } from '@/utils/retryRequest';

const API_BASE_URL = '/api/v2';

// Use the configured axios instance from apiClient for retry, CSRF, and auth
const axiosClient = apiClient.getAxiosInstance();

export interface EncryptionStatus {
  enabled: boolean;
  keyId?: string;
  algorithm?: string;
  version?: number;
  createdAt?: Date;
  numKeyHolders?: number;
}

export interface KeyWrapperResponse {
  keyId: string;
  wrappedKey: string; // base64 encrypted key
  algorithm: string;
}

export interface EncryptedDataMetadata {
  iv: string;
  authTag: string;
  algorithm: string;
}

export interface StoreEncryptedDataInput {
  keyId: string;
  dataType: string;
  resourceId?: string;
  encryptedData: string; // base64
  encryptionMetadata: EncryptedDataMetadata;
  minSecurityLevel?: number;
  allowedRoles?: string[];
}

export interface EncryptedDataResponse {
  id: string;
  keyId: string;
  dataType: string;
  resourceId?: string;
  encryptedData: string;
  encryptionMetadata: EncryptedDataMetadata;
  createdAt: Date;
}

export interface AuditLogEntry {
  id: string;
  eventType: string;
  userId: string;
  message: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
}

export interface KeyClaimResponse {
  id: string;
  label?: string;
  status: 'pending' | 'claimed' | 'expired' | 'revoked';
  createdBy: string;
  claimedBy?: string;
  expiresAt: string;
  claimedAt?: string;
  createdAt: string;
}

export interface ClaimTokenResponse {
  encryptedClaim: string;
  claimMetadata: {
    iv: string;
    salt: string;
    iterations: number;
    algorithm: string;
  };
}

// ===========================================================================
// Hybrid Encryption Types
// ===========================================================================

export interface PublicKeyResponse {
  id: string;
  userId: string;
  publicKey: string;
  keyFingerprint: string;
  keySize: number;
  algorithm: string;
  isActive: boolean;
  createdAt: Date;
}

export interface DEKResponse {
  id: string;
  dekId: string;
  dataType: string;
  resourceId?: string;
  algorithm: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
}

export interface StoreHybridEncryptedDataInput {
  dekId: string;
  dataType: string;
  resourceId?: string;
  encryptedData: string;
  encryptionMetadata: EncryptedDataMetadata;
  minSecurityLevel?: number;
  allowedRoles?: string[];
}

export interface HybridEncryptedDataResponse {
  id: string;
  dekId: string;
  wrappedKey: string;
  dataType: string;
  resourceId?: string;
  encryptedData: string;
  encryptionMetadata: EncryptedDataMetadata;
  encryptionMode: string;
  createdAt: Date;
}

export interface HybridEncryptedDataListItem {
  id: string;
  dekId: string;
  dataType: string;
  resourceId?: string;
  encryptionMode: string;
  createdAt: Date;
  createdBy: string;
}

export interface MigrationCandidateItem {
  id: string;
  keyId: string;
  dataType: string;
  resourceId?: string;
  encryptedData: string;
  encryptionMetadata: EncryptedDataMetadata;
  encryptionMode: string;
  migrationStatus: string;
}

export interface MigrationProgressResponse {
  totalItems: number;
  pendingItems: number;
  migratedItems: number;
  flatItems: number;
  percentComplete: number;
}

export const encryptionApiService = {
  /**
   * Initialize encryption for an organization
   */
  async initializeEncryption(
    organizationId: string,
    keyId: string,
    algorithm: string,
    wrappedKeys: Record<string, string>,
    recoveryHint?: string
  ): Promise<{ keyId: string; algorithm: string; version: number; createdAt: Date }> {
    const response = await axiosClient.post(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/initialize`,
      {
        keyId,
        algorithm,
        wrappedKeys,
        recoveryHint,
      }
    );
    return response.data.data;
  },

  /**
   * Get encryption status for an organization
   */
  async getEncryptionStatus(organizationId: string): Promise<EncryptionStatus> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/status`
    );
    return response.data.data;
  },

  /**
   * Get encrypted key wrapper for current user
   */
  async getKeyWrapper(organizationId: string): Promise<KeyWrapperResponse | null> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/key`
    );
    return response.data.data ?? null;
  },

  /**
   * Share encryption key with another user
   */
  async shareKey(organizationId: string, targetUserId: string, wrappedKey: string): Promise<void> {
    await axiosClient.post(`${API_BASE_URL}/organizations/${organizationId}/encryption/share-key`, {
      targetUserId,
      wrappedKey,
    });
  },

  /**
   * Revoke encryption key access from a user.
   * Uses gateway retry since this DELETE is idempotent.
   */
  async revokeKeyAccess(organizationId: string, userId: string): Promise<void> {
    await withGatewayRetry(() =>
      axiosClient.delete(
        `${API_BASE_URL}/organizations/${organizationId}/encryption/revoke-key/${userId}`
      )
    );
  },

  /**
   * Store encrypted data
   */
  async storeEncryptedData(
    organizationId: string,
    input: StoreEncryptedDataInput
  ): Promise<{ id: string; dataType: string; createdAt: Date }> {
    const response = await axiosClient.post(
      `${API_BASE_URL}/organizations/${organizationId}/encrypted-data`,
      input
    );
    return response.data.data;
  },

  /**
   * Retrieve encrypted data
   */
  async getEncryptedData(organizationId: string, dataId: string): Promise<EncryptedDataResponse> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encrypted-data/${dataId}`
    );
    return response.data.data;
  },

  /**
   * Delete encrypted data.
   * Uses gateway retry since this DELETE is idempotent.
   */
  async deleteEncryptedData(organizationId: string, dataId: string): Promise<void> {
    await withGatewayRetry(() =>
      axiosClient.delete(`${API_BASE_URL}/organizations/${organizationId}/encrypted-data/${dataId}`)
    );
  },

  /**
   * Get encryption audit log
   */
  async getAuditLog(
    organizationId: string,
    options?: {
      eventType?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/audit-log`,
      { params: options }
    );
    return response.data.data;
  },

  /**
   * Rotate encryption key
   */
  async rotateKey(
    organizationId: string,
    newKeyId: string,
    newWrappedKeys: Record<string, string>
  ): Promise<{ keyId: string; version: number; createdAt: Date }> {
    const response = await axiosClient.post(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/rotate-key`,
      {
        newKeyId,
        newWrappedKeys,
      }
    );
    return response.data.data;
  },

  /**
   * Get data items pending re-encryption after key rotation
   */
  async getPendingReEncryption(
    organizationId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{
    items: EncryptedDataResponse[];
    total: number;
    activeKeyId: string;
  }> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/pending-reencryption`,
      { params: options }
    );
    return response.data.data;
  },

  /**
   * Submit re-encrypted data (after client-side re-encryption)
   */
  async submitReEncryptedData(
    organizationId: string,
    dataId: string,
    newKeyId: string,
    encryptedData: string,
    encryptionMetadata: EncryptedDataMetadata
  ): Promise<{ id: string; keyId: string; dataType: string }> {
    const response = await axiosClient.put(
      `${API_BASE_URL}/organizations/${organizationId}/encrypted-data/${dataId}/reencrypt`,
      { newKeyId, encryptedData, encryptionMetadata }
    );
    return response.data.data;
  },

  /**
   * Get re-encryption progress after key rotation
   */
  async getReEncryptionProgress(organizationId: string): Promise<{
    totalItems: number;
    reEncryptedItems: number;
    pendingItems: number;
    percentComplete: number;
  }> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/reencryption-progress`
    );
    return response.data.data;
  },

  /**
   * Get an inactive key's wrapper (for decrypting old data during re-encryption)
   */
  async getInactiveKeyWrapper(
    organizationId: string,
    keyId: string
  ): Promise<{ wrappedKey: string; algorithm: string }> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/key/${keyId}`
    );
    return response.data.data;
  },

  /**
   * Disable encryption for an organization.
   * Uses gateway retry since this DELETE is idempotent.
   */
  async disableEncryption(organizationId: string): Promise<void> {
    await withGatewayRetry(() =>
      axiosClient.delete(`${API_BASE_URL}/organizations/${organizationId}/encryption`)
    );
  },

  // ===========================================================================
  // Key Claim Token API Methods
  // ===========================================================================

  /**
   * Create a key claim token for secure key distribution
   */
  async createClaim(
    organizationId: string,
    payload: {
      encryptedClaim: string;
      claimMetadata: { iv: string; salt: string; iterations: number; algorithm: string };
      label?: string;
      expiresInHours?: number;
    }
  ): Promise<KeyClaimResponse> {
    const response = await axiosClient.post(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/claims`,
      payload
    );
    return response.data.data;
  },

  /**
   * List all key claims for an organization (admin view)
   */
  async listClaims(
    organizationId: string,
    options?: { status?: string; limit?: number; offset?: number }
  ): Promise<{ claims: KeyClaimResponse[]; total: number }> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/claims`,
      { params: options }
    );
    return { claims: response.data.data, total: response.data.total };
  },

  /**
   * Get encrypted claim blob for a specific claim (any org member)
   */
  async getClaimToken(organizationId: string, claimId: string): Promise<ClaimTokenResponse> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/claims/${claimId}`
    );
    return response.data.data;
  },

  /**
   * Complete a claim - save the member's new key wrapper
   */
  async completeClaim(organizationId: string, claimId: string, wrappedKey: string): Promise<void> {
    await axiosClient.post(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/claims/${claimId}/complete`,
      { wrappedKey }
    );
  },

  /**
   * Revoke a pending claim token
   */
  async revokeClaim(organizationId: string, claimId: string): Promise<void> {
    await axiosClient.delete(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/claims/${claimId}`
    );
  },

  // ===========================================================================
  // Hybrid Encryption: Public Keys + Data Encryption Keys (DEK)
  // ===========================================================================

  /**
   * Register the current user's RSA-OAEP public key
   */
  async registerPublicKey(
    organizationId: string,
    publicKey: string,
    keyFingerprint: string,
    keySize?: number
  ): Promise<PublicKeyResponse> {
    const response = await axiosClient.post(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/public-keys`,
      { publicKey, keyFingerprint, keySize }
    );
    return response.data.data;
  },

  /**
   * Get all active public keys for the organization
   */
  async getPublicKeys(organizationId: string): Promise<PublicKeyResponse[]> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/public-keys`
    );
    return response.data.data;
  },

  /**
   * Get a specific member's public key
   * Returns null if the user has no registered key (404)
   */
  async getPublicKey(organizationId: string, userId: string): Promise<PublicKeyResponse | null> {
    try {
      const response = await axiosClient.get(
        `${API_BASE_URL}/organizations/${organizationId}/encryption/public-keys/${userId}`
      );
      return response.data.data;
    } catch (error: unknown) {
      if (isApiClientError(error) && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Revoke a member's public key
   */
  async revokePublicKey(organizationId: string, userId: string): Promise<void> {
    await axiosClient.delete(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/public-keys/${userId}`
    );
  },

  /**
   * Create a new Data Encryption Key with wrapped copies for recipients
   */
  async createDEK(
    organizationId: string,
    dekId: string,
    dataType: string,
    wrappedKeys: Record<string, string>,
    resourceId?: string
  ): Promise<DEKResponse> {
    const response = await axiosClient.post(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/deks`,
      { dekId, dataType, resourceId, wrappedKeys }
    );
    return response.data.data;
  },

  /**
   * Get the wrapped DEK for the current user
   */
  async getDEKForUser(
    organizationId: string,
    dekId: string
  ): Promise<{ wrappedKey: string; dataType: string; resourceId?: string } | null> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/deks/${dekId}`
    );
    return response.data.data;
  },

  /**
   * List DEKs (optionally filtered by dataType/resourceId)
   */
  async listDEKs(
    organizationId: string,
    options?: { dataType?: string; resourceId?: string; limit?: number; offset?: number }
  ): Promise<{ deks: DEKResponse[]; total: number }> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/deks`,
      { params: options }
    );
    return { deks: response.data.data, total: response.data.total };
  },

  /**
   * Grant DEK access to another user
   */
  async grantDEKAccess(
    organizationId: string,
    dekId: string,
    targetUserId: string,
    wrappedKey: string
  ): Promise<void> {
    await axiosClient.post(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/deks/${dekId}/grant`,
      { targetUserId, wrappedKey }
    );
  },

  /**
   * Revoke a user's DEK access
   */
  async revokeDEKAccess(organizationId: string, dekId: string, userId: string): Promise<void> {
    await axiosClient.delete(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/deks/${dekId}/revoke/${userId}`
    );
  },

  // ===========================================================================
  // Phase 3: Hybrid-Mode Encrypted Data
  // ===========================================================================

  /**
   * Store data encrypted with a per-resource DEK (hybrid mode)
   */
  async storeHybridEncryptedData(
    organizationId: string,
    input: StoreHybridEncryptedDataInput
  ): Promise<{
    id: string;
    dekId: string;
    dataType: string;
    encryptionMode: string;
    createdAt: Date;
  }> {
    const response = await axiosClient.post(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/hybrid-data`,
      input
    );
    return response.data.data;
  },

  /**
   * Retrieve hybrid-encrypted data + wrapped DEK for the current user
   */
  async getHybridEncryptedData(
    organizationId: string,
    dataId: string
  ): Promise<HybridEncryptedDataResponse> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/hybrid-data/${dataId}`
    );
    return response.data.data;
  },

  /**
   * List hybrid-encrypted data items
   */
  async listHybridEncryptedData(
    organizationId: string,
    options?: { dataType?: string; resourceId?: string; limit?: number; offset?: number }
  ): Promise<{ data: HybridEncryptedDataListItem[]; total: number }> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/hybrid-data`,
      { params: options }
    );
    return { data: response.data.data, total: response.data.total };
  },

  // ===========================================================================
  // Phase 4: Flat → Hybrid Migration
  // ===========================================================================

  /**
   * Initiate migration: mark all flat-mode data as pending
   */
  async initiateMigration(organizationId: string): Promise<{ totalPending: number }> {
    const response = await axiosClient.post(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/migration/initiate`
    );
    return response.data.data;
  },

  /**
   * Get flat-mode items pending migration for client-side re-encryption
   */
  async getMigrationCandidates(
    organizationId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ data: MigrationCandidateItem[]; total: number }> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/migration/candidates`,
      { params: options }
    );
    return { data: response.data.data, total: response.data.total };
  },

  /**
   * Submit a single re-encrypted migration item
   */
  async completeMigrationItem(
    organizationId: string,
    dataId: string,
    input: {
      dekId: string;
      encryptedData: string;
      encryptionMetadata: EncryptedDataMetadata;
    }
  ): Promise<{
    id: string;
    dekId: string;
    dataType: string;
    encryptionMode: string;
    migrationStatus: string;
  }> {
    const response = await axiosClient.post(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/migration/${dataId}/complete`,
      input
    );
    return response.data.data;
  },

  /**
   * Get migration progress stats
   */
  async getMigrationProgress(organizationId: string): Promise<MigrationProgressResponse> {
    const response = await axiosClient.get(
      `${API_BASE_URL}/organizations/${organizationId}/encryption/migration/progress`
    );
    return response.data.data;
  },
};
