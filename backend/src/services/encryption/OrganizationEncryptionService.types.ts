/**
 * OrganizationEncryptionService input DTOs.
 *
 * Extracted from `OrganizationEncryptionService.ts` (E5 large-file decomposition) to
 * establish a types/logic ownership boundary on the encryption domain's largest
 * service. The service module re-exports every interface below, so all existing
 * `./OrganizationEncryptionService` and `services/encryption` import paths are
 * preserved.
 */
import type { EncryptionMetadata } from '../../models/EncryptedData';

export interface InitializeEncryptionInput {
  organizationId: string;
  keyId: string;
  algorithm: string;
  wrappedKeys: Record<string, string>; // userId -> encrypted key wrapper
  recoveryHint?: string;
  createdBy: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface StoreEncryptedDataInput {
  organizationId: string;
  keyId: string;
  dataType: string;
  resourceId?: string;
  encryptedData: string; // base64
  encryptionMetadata: EncryptionMetadata;
  createdBy: string;
  minSecurityLevel?: number;
  allowedRoles?: string[];
}

export interface ShareKeyInput {
  organizationId: string;
  keyId: string;
  userId: string; // User to share with
  wrappedKey: string; // Key encrypted with target user's password
  sharedBy: string;
  ipAddress?: string;
  userAgent?: string;
}

