/**
 * EncryptionKeyProvider
 *
 * React context that manages unlocked encryption keys for the hybrid DEK model.
 * Provides the org master CryptoKey (AES-256-GCM) and the current user's RSA
 * private key to all child components, eliminating ad-hoc password prompts.
 *
 * Key lifecycle:
 * 1. User enters password → org master key unwrapped via PBKDF2
 * 2. User's RSA private key loaded from IndexedDB (or generated + registered)
 * 3. Both keys held in memory (never persisted to disk/localStorage)
 * 4. Keys cleared on lock, logout, or tab close
 *
 * Security:
 * - CryptoKey objects are non-extractable by default (Web Crypto API)
 * - Private keys stored in IndexedDB are PKCS8 base64 (browser-sandboxed)
 * - No key material ever serialized to localStorage or sent to server
 * - Auto-lock after configurable idle timeout
 */

import { encryptionKeys } from '@/hooks/queries/queryKeys';
import { usePublicKeys } from '@/hooks/queries/useHybridEncryptionQueries';
import { encryptionApiService } from '@/services/crypto/encryptionApiService';
import {
  exportPrivateKey,
  importPrivateKey,
  importPublicKey,
  parseKeyWrapper,
  unwrapKeyWithPassword,
} from '@/services/crypto/encryptionService';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import { useQuery } from '@tanstack/react-query';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// ---------------------------------------------------------------------------
// IndexedDB helpers for RSA private key persistence
// ---------------------------------------------------------------------------

const IDB_NAME = 'sc-fleet-encryption';
const IDB_STORE = 'private-keys';
const IDB_VERSION = 1;

function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadPrivateKeyFromIDB(userId: string): Promise<string | null> {
  const db = await openKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(userId);
    req.onsuccess = () => resolve((req.result as string) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function savePrivateKeyToIDB(userId: string, pkcs8Base64: string): Promise<void> {
  const db = await openKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(pkcs8Base64, userId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function removePrivateKeyFromIDB(userId: string): Promise<void> {
  const db = await openKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.delete(userId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

/** Auto-lock timeout in ms (default 30 minutes) */
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export interface EncryptionKeyContextValue {
  /** Whether the org master key is currently unlocked in memory */
  isUnlocked: boolean;

  /** Whether the user has an RSA key pair registered for hybrid mode */
  hasKeyPair: boolean;

  /** The unlocked org master key (AES-256-GCM). null when locked. */
  orgKey: CryptoKey | null;

  /** The user's RSA-OAEP private key. null when not loaded. */
  privateKey: CryptoKey | null;

  /** Public keys of all org members: Map<userId, CryptoKey>. Empty until unlocked. */
  recipientKeys: Map<string, CryptoKey>;

  /** Unlock vault: unwrap org key with password + load RSA private key from IDB */
  unlock: (password: string) => Promise<void>;

  /** Lock vault: clear all keys from memory */
  lock: () => void;

  /** Store the user's RSA private key in IndexedDB after key pair generation */
  storePrivateKey: (privateKey: CryptoKey) => Promise<void>;

  /** Remove the user's RSA private key from IndexedDB */
  clearPrivateKey: () => Promise<void>;

  /** Error from the last unlock attempt (null on success) */
  unlockError: string | null;

  /** Whether an unlock operation is currently in progress */
  isUnlocking: boolean;
}

const EncryptionKeyContext = createContext<EncryptionKeyContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider props
// ---------------------------------------------------------------------------

interface EncryptionKeyProviderProps {
  organizationId: string;
  children: React.ReactNode;
  /** Idle timeout in ms before auto-lock. 0 to disable. Default: 30 min */
  idleTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Provider component
// ---------------------------------------------------------------------------

export const EncryptionKeyProvider: React.FC<Readonly<EncryptionKeyProviderProps>> = ({
  organizationId,
  children,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
}) => {
  const user = useAuthStore(state => state.user);
  const userId = user?.id;

  // Fetch the key wrapper from the crypto API service (returns KeyWrapperResponse)
  const { data: keyWrapperData } = useQuery({
    queryKey: encryptionKeys.key(organizationId),
    queryFn: () => encryptionApiService.getKeyWrapper(organizationId),
    enabled: !!organizationId,
    staleTime: 30 * 60 * 1000, // 30 min — key wrapper changes only on rotation
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // All org members' public keys (for hybrid wrapping)
  const { data: publicKeysData } = usePublicKeys(organizationId);

  // --- Key state (in-memory only, never serialized) ---
  const [orgKey, setOrgKey] = useState<CryptoKey | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [recipientKeys, setRecipientKeys] = useState<Map<string, CryptoKey>>(new Map());
  const [hasKeyPair, setHasKeyPair] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Idle timer ref
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Check if private key exists in IDB on mount ---
  useEffect(() => {
    if (!userId) return;
    loadPrivateKeyFromIDB(userId)
      .then(stored => setHasKeyPair(stored !== null))
      .catch(() => setHasKeyPair(false));
  }, [userId]);

  // --- Import org member public keys when data arrives ---
  useEffect(() => {
    if (!publicKeysData || publicKeysData.length === 0) return;

    let cancelled = false;

    const importAll = async () => {
      const map = new Map<string, CryptoKey>();
      for (const pk of publicKeysData) {
        if (!pk.isActive || !pk.publicKey) continue;
        try {
          const cryptoKey = await importPublicKey(pk.publicKey);
          map.set(pk.userId, cryptoKey);
        } catch {
          logger.warn(`Failed to import public key for user ${pk.userId}`);
        }
      }
      if (!cancelled) {
        setRecipientKeys(map);
      }
    };

    importAll();
    return () => {
      cancelled = true;
    };
  }, [publicKeysData]);

  // --- Lock function: clear all keys from memory ---
  const lock = useCallback(() => {
    setOrgKey(null);
    setPrivateKey(null);
    setUnlockError(null);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  // --- Idle timeout reset ---
  const resetIdleTimer = useCallback(() => {
    if (idleTimeoutMs <= 0) return;
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      lock();
      logger.info('Encryption vault auto-locked due to inactivity');
    }, idleTimeoutMs);
  }, [idleTimeoutMs, lock]);

  // Track user activity to reset idle timer when unlocked
  useEffect(() => {
    if (!orgKey || idleTimeoutMs <= 0) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    const handler = () => resetIdleTimer();
    for (const event of events) {
      document.addEventListener(event, handler, { passive: true });
    }
    resetIdleTimer();

    return () => {
      for (const event of events) {
        document.removeEventListener(event, handler);
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [orgKey, idleTimeoutMs, resetIdleTimer]);

  // Lock when user logs out
  useEffect(() => {
    if (!userId) {
      lock();
    }
  }, [userId, lock]);

  // --- Unlock function ---
  const unlock = useCallback(
    async (password: string) => {
      if (!userId) {
        setUnlockError('Not authenticated');
        return;
      }
      if (!keyWrapperData) {
        setUnlockError('Encryption key not available for this organization');
        return;
      }

      setIsUnlocking(true);
      setUnlockError(null);

      try {
        // 1. Unwrap the org master key with the user's password
        // The server may return wrappedKey as a string (JSON) or already-parsed object (JSONB)
        const wrapper = parseKeyWrapper(keyWrapperData.wrappedKey);
        const unwrappedKey = await unwrapKeyWithPassword(wrapper, password);
        setOrgKey(unwrappedKey);

        // 2. Load RSA private key from IndexedDB (if exists)
        const storedPK = await loadPrivateKeyFromIDB(userId);
        if (storedPK) {
          const rsaPrivateKey = await importPrivateKey(storedPK);
          setPrivateKey(rsaPrivateKey);
          setHasKeyPair(true);
        }

        resetIdleTimer();
      } catch (err) {
        lock();
        const message = err instanceof Error ? err.message : 'Failed to unlock encryption vault';
        setUnlockError(message);
        logger.error(
          'Encryption unlock failed',
          err instanceof Error ? err : new Error(String(err))
        );
      } finally {
        setIsUnlocking(false);
      }
    },
    [userId, keyWrapperData, lock, resetIdleTimer]
  );

  // --- Store private key in IDB ---
  const storePrivateKey = useCallback(
    async (key: CryptoKey) => {
      if (!userId) return;
      const exported = await exportPrivateKey(key);
      await savePrivateKeyToIDB(userId, exported);
      setPrivateKey(key);
      setHasKeyPair(true);
    },
    [userId]
  );

  // --- Remove private key from IDB ---
  const clearPrivateKey = useCallback(async () => {
    if (!userId) return;
    await removePrivateKeyFromIDB(userId);
    setPrivateKey(null);
    setHasKeyPair(false);
  }, [userId]);

  // --- Context value (memoized) ---
  const value = useMemo<EncryptionKeyContextValue>(
    () => ({
      isUnlocked: orgKey !== null,
      hasKeyPair,
      orgKey,
      privateKey,
      recipientKeys,
      unlock,
      lock,
      storePrivateKey,
      clearPrivateKey,
      unlockError,
      isUnlocking,
    }),
    [
      orgKey,
      hasKeyPair,
      privateKey,
      recipientKeys,
      unlock,
      lock,
      storePrivateKey,
      clearPrivateKey,
      unlockError,
      isUnlocking,
    ]
  );

  return <EncryptionKeyContext.Provider value={value}>{children}</EncryptionKeyContext.Provider>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the encryption key context.
 * Must be used within an EncryptionKeyProvider.
 */
export function useEncryptionKeys(): EncryptionKeyContextValue {
  const ctx = useContext(EncryptionKeyContext);
  if (!ctx) {
    throw new Error('useEncryptionKeys must be used within an EncryptionKeyProvider');
  }
  return ctx;
}
