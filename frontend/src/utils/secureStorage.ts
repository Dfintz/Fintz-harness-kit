/**
 * Secure Storage Utility
 *
 * Implements IndexedDB + Web Crypto API for secure client-side storage.
 * Provides stronger security than localStorage by:
 * 1. Using IndexedDB which is more resistant to XSS attacks
 * 2. Encrypting data using AES-GCM with a derived key from PBKDF2
 * 3. Generating unique IVs for each encryption operation
 *
 * Usage:
 *   const storage = new SecureStorage('auth-storage');
 *   await storage.setItem('token', 'my-secret-token');
 *   const token = await storage.getItem('token');
 *   await storage.removeItem('token');
 *   await storage.clear();
 */

import { logger } from './logger';

// Get encryption key seed from environment or use fallback
const getEncryptionKeySeed = (): string => {
  if (import.meta.env?.VITE_ENCRYPTION_KEY_SEED) {
    return import.meta.env.VITE_ENCRYPTION_KEY_SEED;
  }
  return 'sc-fleet-manager-v1';
};

const DB_NAME = 'sc-fleet-manager-secure';
const DB_VERSION = 1;
const STORE_NAME = 'secure-data';

interface StoredData {
  iv: string; // Base64-encoded IV
  data: string; // Base64-encoded encrypted data
  timestamp: number;
}

/**
 * SecureStorage class providing encrypted storage using IndexedDB + Web Crypto
 */
export class SecureStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private keyPromise: Promise<CryptoKey> | null = null;
  private readonly namespace: string;

  constructor(namespace: string = 'default') {
    this.namespace = namespace;
  }

  /**
   * Check if IndexedDB and Web Crypto are available
   */
  public static isSupported(): boolean {
    return globalThis.indexedDB !== undefined && globalThis.crypto?.subtle !== undefined;
  }

  /**
   * Initialize and get the IndexedDB database
   */
  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Derive a cryptographic key from the seed using PBKDF2
   */
  private async deriveKey(): Promise<CryptoKey> {
    if (this.keyPromise) {
      return this.keyPromise;
    }

    this.keyPromise = (async () => {
      const encoder = new TextEncoder();
      const seed = getEncryptionKeySeed();

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(seed),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      return crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode(`${this.namespace}-salt`),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    })();

    return this.keyPromise;
  }

  /**
   * Encrypt a value using AES-GCM
   */
  private async encrypt(value: string): Promise<StoredData> {
    const key = await this.deriveKey();
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(value)
    );

    return {
      iv: this.arrayBufferToBase64(iv),
      data: this.arrayBufferToBase64(encrypted),
      timestamp: Date.now(),
    };
  }

  /**
   * Decrypt a stored value using AES-GCM
   */
  private async decrypt(stored: StoredData): Promise<string> {
    const key = await this.deriveKey();
    const iv = this.base64ToArrayBuffer(stored.iv);
    const data = this.base64ToArrayBuffer(stored.data);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      data as BufferSource
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Convert ArrayBuffer to Base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCodePoint(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.codePointAt(i) ?? 0;
    }
    return bytes;
  }

  /**
   * Get the namespaced key
   */
  private getKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /**
   * Store an encrypted value in IndexedDB
   */
  public async setItem(key: string, value: string): Promise<void> {
    const db = await this.getDB();
    const encrypted = await this.encrypt(value);
    const storeKey = this.getKey(key);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ key: storeKey, ...encrypted });

      request.onerror = () => reject(new Error('Failed to store item'));
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Retrieve and decrypt a value from IndexedDB
   */
  public async getItem(key: string): Promise<string | null> {
    const db = await this.getDB();
    const storeKey = this.getKey(key);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(storeKey);

      request.onerror = () => reject(new Error('Failed to retrieve item'));
      request.onsuccess = async () => {
        if (!request.result) {
          resolve(null);
          return;
        }

        try {
          const decrypted = await this.decrypt(request.result);
          resolve(decrypted);
        } catch {
          // Clear invalid stored data - use generic message to avoid information leakage
          logger.warn('Clearing invalid stored data');
          await this.removeItem(key);
          resolve(null);
        }
      };
    });
  }

  /**
   * Remove an item from IndexedDB
   */
  public async removeItem(key: string): Promise<void> {
    const db = await this.getDB();
    const storeKey = this.getKey(key);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(storeKey);

      request.onerror = () => reject(new Error('Failed to remove item'));
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Clear all items in this namespace from IndexedDB
   */
  public async clear(): Promise<void> {
    const db = await this.getDB();
    const prefix = `${this.namespace}:`;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onerror = () => reject(new Error('Failed to clear storage'));
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          if (cursor.key.toString().startsWith(prefix)) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  /**
   * Get all keys in this namespace
   */
  public async keys(): Promise<string[]> {
    const db = await this.getDB();
    const prefix = `${this.namespace}:`;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onerror = () => reject(new Error('Failed to get keys'));
      request.onsuccess = () => {
        const keys = request.result
          .filter((k: IDBValidKey) => k.toString().startsWith(prefix))
          .map((k: IDBValidKey) => k.toString().replace(prefix, ''));
        resolve(keys);
      };
    });
  }

  /**
   * Close the database connection
   */
  public async close(): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      db.close();
      this.dbPromise = null;
      this.keyPromise = null;
    }
  }
}

/**
 * Create a Zustand storage adapter using SecureStorage
 * This allows using SecureStorage with Zustand's persist middleware
 */
export const createSecureStorageAdapter = (namespace: string = 'default') => {
  const storage = new SecureStorage(namespace);
  const cache: Map<string, string> = new Map();

  return {
    getItem: async (name: string): Promise<string | null> => {
      if (cache.has(name)) {
        return cache.get(name) || null;
      }
      try {
        const value = await storage.getItem(name);
        if (value) {
          cache.set(name, value);
        }
        return value;
      } catch (error) {
        // Log only that an error occurred, not the details
        logger.error(
          'SecureStorage: getItem operation failed',
          error instanceof Error ? error : new Error('Unknown error')
        );
        return null;
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        cache.set(name, value);
        await storage.setItem(name, value);
      } catch (error) {
        // Log only that an error occurred, not the details
        logger.error(
          'SecureStorage: setItem operation failed',
          error instanceof Error ? error : new Error('Unknown error')
        );
      }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        cache.delete(name);
        await storage.removeItem(name);
      } catch (error) {
        // Log only that an error occurred, not the details
        logger.error(
          'SecureStorage: removeItem operation failed',
          error instanceof Error ? error : new Error('Unknown error')
        );
      }
    },
  };
};

// Export a default instance for convenience
export const secureStorage = new SecureStorage();
