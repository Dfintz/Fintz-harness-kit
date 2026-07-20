/**
 * useHybridCrypto
 *
 * Reusable hook that encapsulates the full hybrid encryption round-trip:
 *   encrypt → create DEK → store encrypted data   (write path)
 *   fetch encrypted data → unwrap DEK → decrypt    (read path)
 *
 * Plug any domain into hybrid encryption by calling:
 *   const { encryptAndStore, fetchAndDecrypt, isReady } = useHybridCrypto(orgId);
 */

import { useEncryptionKeys } from '@/components/encryption/EncryptionKeyProvider';
import {
  useCreateDEK,
  useStoreHybridEncryptedData,
} from '@/hooks/queries/useHybridEncryptionQueries';
import type { HybridEncryptedDataResponse } from '@/services/crypto/encryptionApiService';
import { encryptionApiService } from '@/services/crypto/encryptionApiService';
import type { EncryptedBlob } from '@/services/crypto/encryptionService';
import {
  decryptData,
  hybridEncrypt,
  unwrapDEKWithPrivateKey,
} from '@/services/crypto/encryptionService';
import { useAuthStore } from '@/store/authStore';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseHybridCryptoResult {
  /**
   * Encrypt plaintext and store it via the hybrid-data API.
   * Generates a fresh DEK, wraps it for all recipients, registers it,
   * then stores the encrypted payload on the server.
   */
  encryptAndStore: (
    plaintext: string,
    dataType: string,
    resourceId?: string
  ) => Promise<{ id: string; dekId: string }>;

  /**
   * Fetch a hybrid-encrypted data item by ID and decrypt it.
   * Unwraps the caller's copy of the DEK, then decrypts the ciphertext.
   */
  fetchAndDecrypt: (dataId: string) => Promise<string>;

  /**
   * Decrypt an already-fetched HybridEncryptedDataResponse in memory
   * (useful when you already have the response from a list query).
   */
  decryptResponse: (response: HybridEncryptedDataResponse) => Promise<string>;

  /** true when vault is unlocked, private key loaded, and recipient keys available */
  isReady: boolean;

  /** true while a store mutation is in-flight */
  isEncrypting: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHybridCrypto(organizationId: string): UseHybridCryptoResult {
  const { isUnlocked, privateKey, recipientKeys } = useEncryptionKeys();
  const user = useAuthStore(state => state.user);
  const createDEK = useCreateDEK();
  const storeData = useStoreHybridEncryptedData();

  const isReady = isUnlocked && !!privateKey && recipientKeys.size > 0;

  // -----------------------------------------------------------------------
  // Write path
  // -----------------------------------------------------------------------

  const encryptAndStore = async (
    plaintext: string,
    dataType: string,
    resourceId?: string
  ): Promise<{ id: string; dekId: string }> => {
    if (!isReady) {
      throw new Error('Encryption vault must be unlocked with registered keys');
    }

    // 1. Hybrid encrypt (generates DEK + AES-GCM encrypt + RSA-OAEP wrap)
    const payload = await hybridEncrypt(plaintext, recipientKeys);

    // 2. Register the DEK on the server with wrapped copies for each member
    await createDEK.mutateAsync({
      organizationId,
      dekId: payload.dekId,
      dataType,
      resourceId,
      wrappedKeys: payload.wrappedDEKs,
    });

    // 3. Store the encrypted ciphertext
    const result = await storeData.mutateAsync({
      organizationId,
      data: {
        dekId: payload.dekId,
        dataType,
        resourceId,
        encryptedData: payload.encryptedData.encrypted,
        encryptionMetadata: {
          iv: payload.encryptedData.iv,
          authTag: payload.encryptedData.authTag,
          algorithm: payload.encryptedData.algorithm,
        },
      },
    });

    return { id: result.id, dekId: result.dekId };
  };

  // -----------------------------------------------------------------------
  // Read helpers
  // -----------------------------------------------------------------------

  const decryptResponse = async (response: HybridEncryptedDataResponse): Promise<string> => {
    if (!privateKey) {
      throw new Error('Encryption vault must be unlocked');
    }

    // 1. Unwrap this user's copy of the DEK
    const dek = await unwrapDEKWithPrivateKey(response.wrappedKey, privateKey);

    // 2. Reconstruct the EncryptedBlob and decrypt
    const blob: EncryptedBlob = {
      encrypted: response.encryptedData,
      iv: response.encryptionMetadata.iv,
      authTag: response.encryptionMetadata.authTag,
      algorithm: response.encryptionMetadata.algorithm,
    };
    return await decryptData(blob, dek);
  };

  const fetchAndDecrypt = async (dataId: string): Promise<string> => {
    if (!user?.id) {
      throw new Error('User must be authenticated');
    }

    // Fetch from server (includes this user's wrapped DEK)
    const response = await encryptionApiService.getHybridEncryptedData(organizationId, dataId);
    return decryptResponse(response);
  };

  return {
    encryptAndStore,
    fetchAndDecrypt,
    decryptResponse,
    isReady,
    isEncrypting: storeData.isPending || createDEK.isPending,
  };
}
