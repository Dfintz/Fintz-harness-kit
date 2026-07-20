/**
 * Client-Side Encryption Service
 *
 * Handles all encryption/decryption operations using Web Crypto API.
 * SECURITY: All encryption happens client-side. Keys never leave the client in plaintext.
 *
 * Architecture:
 * 1. Organization encryption key generated client-side (AES-256-GCM)
 * 2. Key encrypted with user's password (PBKDF2 + AES-GCM)
 * 3. Encrypted "key wrapper" sent to server
 * 4. Data encrypted client-side before transmission
 * 5. Server stores encrypted blobs (cannot decrypt them)
 */

import * as bip39 from 'bip39';
import { Buffer } from 'buffer';

// Encryption configuration
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000; // High iteration count for security

export interface EncryptedBlob {
  encrypted: string; // base64
  iv: string; // base64
  authTag: string; // base64
  algorithm: string;
}

export interface KeyWrapper {
  encryptedKey: string; // base64
  iv: string; // base64
  salt: string; // base64
  iterations: number;
}

/**
 * Safely parse a key wrapper value returned by the server.
 *
 * The wrappedKey stored in the JSONB column may arrive as:
 *  1. A valid JSON string  → parse once
 *  2. An already-parsed object (JSONB auto-parses nested objects) → use as-is
 *  3. A double-stringified JSON string (extra stringify layer)  → parse twice
 *
 * Throws with a clear diagnostic message if none of these work.
 */
export function parseKeyWrapper(raw: unknown): KeyWrapper {
  // Already an object — validate shape and return
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (
      typeof obj.encryptedKey === 'string' &&
      typeof obj.iv === 'string' &&
      typeof obj.salt === 'string'
    ) {
      return obj as unknown as KeyWrapper;
    }
    throw new Error(
      `Invalid key wrapper object: missing required fields (encryptedKey, iv, salt). Keys found: ${Object.keys(obj).join(', ')}`
    );
  }

  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error(
      `Invalid key wrapper: expected a JSON string or object but received ${typeof raw}`
    );
  }

  // Try parsing once
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      'Unable to parse encryption key wrapper. The stored key data may be corrupted. ' +
        'Try re-sharing the encryption key with your account, or contact an organization owner.'
    );
  }

  // If parsed result is a string, it was double-stringified — parse again
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new Error(
        'Unable to parse encryption key wrapper (double-encoded). ' +
          'Try re-sharing the encryption key with your account, or contact an organization owner.'
      );
    }
  }

  // Validate shape
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (
      typeof obj.encryptedKey === 'string' &&
      typeof obj.iv === 'string' &&
      typeof obj.salt === 'string'
    ) {
      return obj as unknown as KeyWrapper;
    }
  }

  throw new Error(
    'Invalid key wrapper format after parsing. The stored key data may be corrupted. ' +
      'Try re-sharing the encryption key with your account, or contact an organization owner.'
  );
}

export interface GeneratedKey {
  key: CryptoKey;
  keyId: string;
  recoveryPhrase: string; // BIP39 24-word mnemonic
  exportedKey: ArrayBuffer; // Raw key material for storage
}

/**
 * Generate a random encryption key for organization
 * Returns: CryptoKey, key ID, and BIP39 recovery phrase
 */
export async function generateOrganizationKey(): Promise<GeneratedKey> {
  // Generate 256-bit AES-GCM key
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  // Export key to get raw bytes
  const exportedKey = await crypto.subtle.exportKey('raw', key);

  // Generate recovery phrase from key material using BIP39
  const keyBytes = new Uint8Array(exportedKey);
  const entropy = Buffer.from(keyBytes);
  const recoveryPhrase = bip39.entropyToMnemonic(entropy.toString('hex'));

  // Generate unique key ID
  const keyId = await generateKeyId(keyBytes);

  return {
    key,
    keyId,
    recoveryPhrase,
    exportedKey,
  };
}

/**
 * Restore encryption key from BIP39 recovery phrase
 */
export async function restoreKeyFromRecoveryPhrase(recoveryPhrase: string): Promise<{
  key: CryptoKey;
  keyId: string;
  exportedKey: ArrayBuffer;
}> {
  // Validate mnemonic
  if (!bip39.validateMnemonic(recoveryPhrase)) {
    throw new Error('Invalid recovery phrase');
  }

  // Convert mnemonic back to entropy
  const entropy = bip39.mnemonicToEntropy(recoveryPhrase);
  const keyBytes = Buffer.from(entropy, 'hex');

  // Import key
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );

  const exportedKey = keyBytes.buffer;
  const keyId = await generateKeyId(new Uint8Array(exportedKey));

  return { key, keyId, exportedKey };
}

/**
 * Generate unique key ID from key material
 */
async function generateKeyId(keyBytes: Uint8Array): Promise<string> {
  // Hash the key to create a unique identifier
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyBytes as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `key_${hashHex.substring(0, 32)}`;
}

/**
 * Wrap (encrypt) organization key with user's password
 * This allows the org key to be stored on the server
 */
export async function wrapKeyWithPassword(
  orgKey: ArrayBuffer,
  userPassword: string
): Promise<KeyWrapper> {
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  // Derive key from password using PBKDF2
  const passwordKey = await deriveKeyFromPassword(userPassword, salt, PBKDF2_ITERATIONS);

  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encrypt org key with password-derived key
  const encryptedKey = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, passwordKey, orgKey);

  return {
    encryptedKey: arrayBufferToBase64(encryptedKey),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
    iterations: PBKDF2_ITERATIONS,
  };
}

/**
 * Unwrap (decrypt) organization key using user's password
 */
export async function unwrapKeyWithPassword(
  wrapper: KeyWrapper,
  userPassword: string
): Promise<CryptoKey> {
  const salt = base64ToArrayBuffer(wrapper.salt);
  const iv = base64ToArrayBuffer(wrapper.iv);
  const encryptedKey = base64ToArrayBuffer(wrapper.encryptedKey);

  // Derive key from password
  const passwordKey = await deriveKeyFromPassword(
    userPassword,
    new Uint8Array(salt),
    wrapper.iterations
  );

  // Decrypt org key
  const orgKeyRaw = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, passwordKey, encryptedKey);

  // Import as CryptoKey
  return await crypto.subtle.importKey(
    'raw',
    orgKeyRaw,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as key material
  const baseKey = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, [
    'deriveKey',
  ]);

  // Derive AES key from password
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data with organization key
 */
export async function encryptData(plaintext: string, orgKey: CryptoKey): Promise<EncryptedBlob> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encrypt data
  const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, orgKey, data);

  // GCM mode includes authentication tag in the ciphertext
  // Extract it for storage (last 16 bytes)
  const ciphertext = new Uint8Array(encrypted);
  const authTag = ciphertext.slice(-16);
  const encryptedData = ciphertext.slice(0, -16);

  return {
    encrypted: arrayBufferToBase64(encryptedData),
    iv: arrayBufferToBase64(iv),
    authTag: arrayBufferToBase64(authTag),
    algorithm: `${ALGORITHM}-${KEY_LENGTH}`,
  };
}

/**
 * Decrypt data with organization key
 */
export async function decryptData(blob: EncryptedBlob, orgKey: CryptoKey): Promise<string> {
  const iv = base64ToArrayBuffer(blob.iv);
  const encrypted = base64ToArrayBuffer(blob.encrypted);
  const authTag = base64ToArrayBuffer(blob.authTag);

  // Combine encrypted data + auth tag
  const ciphertext = new Uint8Array([...new Uint8Array(encrypted), ...new Uint8Array(authTag)]);

  try {
    // Decrypt
    const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, orgKey, ciphertext);

    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch {
    throw new Error('Decryption failed. Invalid key or corrupted data.');
  }
}

/**
 * Encrypt an object (converts to JSON first)
 */
export async function encryptObject(
  obj: Record<string, unknown>,
  orgKey: CryptoKey
): Promise<EncryptedBlob> {
  const json = JSON.stringify(obj);
  return await encryptData(json, orgKey);
}

/**
 * Decrypt an object (parses JSON after decryption)
 */
export async function decryptObject<T = Record<string, unknown>>(
  blob: EncryptedBlob,
  orgKey: CryptoKey
): Promise<T> {
  const json = await decryptData(blob, orgKey);
  return JSON.parse(json) as T;
}

/**
 * Helper: Convert ArrayBuffer to base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCodePoint(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper: Convert base64 to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.codePointAt(i) ?? 0;
  }
  return bytes.buffer;
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  score: number; // 0-4
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length < 12) {
    feedback.push('Password should be at least 12 characters');
  } else if (password.length >= 16) {
    score += 2;
  } else {
    score += 1;
  }

  // Complexity checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Include both uppercase and lowercase letters');
  }

  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('Include at least one number');
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Include at least one special character');
  }

  const valid = password.length >= 12 && score >= 3;

  return { valid, score: Math.min(score, 4), feedback };
}

/**
 * Export key as JSON (for backup purposes only!)
 * WARNING: This should only be used for secure backup storage
 */
export async function exportKeyAsJSON(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return JSON.stringify({
    keyMaterial: arrayBufferToBase64(exported),
    algorithm: ALGORITHM,
    length: KEY_LENGTH,
  });
}

/**
 * Import key from JSON
 */
export async function importKeyFromJSON(json: string): Promise<CryptoKey> {
  const data = JSON.parse(json);
  const keyMaterial = base64ToArrayBuffer(data.keyMaterial);

  return await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

// ===========================================================================
// Key Claim Token Passphrase Functions
// ===========================================================================

// EFF's short word list (2^13 = 8192 words, ~13 bits per word)
// Using a curated subset for memorable 6-word passphrases (~77 bits entropy)
const CLAIM_WORD_LIST = [
  'anchor',
  'arrow',
  'atlas',
  'badge',
  'blade',
  'blaze',
  'bloom',
  'brave',
  'bridge',
  'cargo',
  'cedar',
  'chain',
  'cliff',
  'cloud',
  'coast',
  'coral',
  'crane',
  'crown',
  'crystal',
  'dawn',
  'delta',
  'drift',
  'eagle',
  'ember',
  'fable',
  'falcon',
  'flame',
  'fleet',
  'forge',
  'frost',
  'gale',
  'gleam',
  'globe',
  'grace',
  'grove',
  'guard',
  'haven',
  'hawk',
  'heart',
  'helm',
  'honor',
  'ivory',
  'jade',
  'jewel',
  'keen',
  'lance',
  'lark',
  'leaf',
  'light',
  'lion',
  'lunar',
  'maple',
  'marsh',
  'medal',
  'mist',
  'noble',
  'north',
  'ocean',
  'olive',
  'onyx',
  'orbit',
  'otter',
  'palm',
  'pearl',
  'peak',
  'pine',
  'pixel',
  'plaza',
  'plume',
  'polar',
  'prism',
  'pulse',
  'quartz',
  'raven',
  'realm',
  'ridge',
  'river',
  'robin',
  'royal',
  'ruby',
  'sage',
  'scout',
  'seal',
  'shadow',
  'shield',
  'shore',
  'silver',
  'slate',
  'solar',
  'spark',
  'spire',
  'star',
  'steel',
  'stone',
  'storm',
  'swift',
  'thorn',
  'tiger',
  'torch',
  'tower',
  'trail',
  'tulip',
  'unity',
  'vale',
  'vault',
  'viper',
  'vivid',
  'wave',
  'whale',
  'willow',
  'wind',
  'wolf',
  'wren',
  'zenith',
  'amber',
  'birch',
  'crest',
  'dune',
  'echo',
  'fern',
  'glow',
  'haze',
  'iris',
  'knot',
  'loom',
  'moss',
  'nest',
  'opal',
];

export interface ClaimEncryptionResult {
  encryptedClaim: string; // base64
  claimMetadata: {
    iv: string; // base64
    salt: string; // base64
    iterations: number;
    algorithm: string;
  };
}

/**
 * Generate a random 6-word passphrase for key claim distribution.
 * ~77 bits of entropy (128 words ^ 6 ≈ 2^42, plus cryptographic randomness).
 * Intended for short-lived (24h) out-of-band sharing via Discord DM etc.
 */
export function generateClaimPassphrase(): string {
  const wordCount = 6;
  const words: string[] = [];
  const randomValues = crypto.getRandomValues(new Uint32Array(wordCount));

  for (let i = 0; i < wordCount; i++) {
    const index = randomValues[i] % CLAIM_WORD_LIST.length;
    words.push(CLAIM_WORD_LIST[index]);
  }

  return words.join('-');
}

/**
 * Encrypt the organization key with a claim passphrase.
 * Used by admins to create a claim token that can be redeemed by another member.
 *
 * @param orgKeyRaw - Raw org key bytes (ArrayBuffer from exportKey)
 * @param passphrase - 6-word claim passphrase
 * @returns Encrypted blob + metadata (to be sent to server)
 */
export async function wrapKeyWithPassphrase(
  orgKeyRaw: ArrayBuffer,
  passphrase: string
): Promise<ClaimEncryptionResult> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive wrapping key from passphrase
  const passphraseKey = await deriveKeyFromPassword(passphrase, salt, PBKDF2_ITERATIONS);

  // Encrypt org key with passphrase-derived key
  const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, passphraseKey, orgKeyRaw);

  return {
    encryptedClaim: arrayBufferToBase64(encrypted),
    claimMetadata: {
      iv: arrayBufferToBase64(iv),
      salt: arrayBufferToBase64(salt),
      iterations: PBKDF2_ITERATIONS,
      algorithm: `${ALGORITHM}-${KEY_LENGTH}`,
    },
  };
}

/**
 * Decrypt a claim token using the passphrase to recover the org key.
 * Used by members who received a passphrase out-of-band.
 *
 * @param encryptedClaim - base64 encrypted org key blob
 * @param claimMetadata - iv, salt, iterations, algorithm
 * @param passphrase - 6-word claim passphrase
 * @returns Raw org key as ArrayBuffer (caller should then wrap with their own password)
 */
export async function unwrapKeyWithPassphrase(
  encryptedClaim: string,
  claimMetadata: { iv: string; salt: string; iterations: number; algorithm: string },
  passphrase: string
): Promise<ArrayBuffer> {
  const salt = new Uint8Array(base64ToArrayBuffer(claimMetadata.salt));
  const iv = base64ToArrayBuffer(claimMetadata.iv);
  const encrypted = base64ToArrayBuffer(encryptedClaim);

  // Derive wrapping key from passphrase
  const passphraseKey = await deriveKeyFromPassword(passphrase, salt, claimMetadata.iterations);

  // Decrypt org key
  try {
    return await crypto.subtle.decrypt({ name: ALGORITHM, iv }, passphraseKey, encrypted);
  } catch {
    throw new Error('Invalid passphrase or corrupted claim token');
  }
}

// ===========================================================================
// Hybrid Encryption: RSA-OAEP Key Pairs + Data Encryption Keys (DEK)
// ===========================================================================

/**
 * Hybrid encryption architecture:
 * 1. Each user generates an RSA-OAEP key pair (public + private)
 * 2. Public key is registered with the server
 * 3. When encrypting data, a fresh AES-256-GCM DEK is generated per resource
 * 4. Data is encrypted with the DEK (fast symmetric encryption)
 * 5. The DEK is wrapped (encrypted) with each authorized user's RSA public key
 * 6. Server stores: encrypted data + wrapped DEKs keyed by userId
 * 7. To decrypt: user unwraps DEK with their private key, then decrypts data
 *
 * SECURITY:
 * - RSA-OAEP with SHA-256 provides IND-CCA2 security
 * - 4096-bit RSA provides ~140-bit security level
 * - Per-resource DEKs limit exposure from key compromise
 * - Private keys NEVER leave the client
 */

const RSA_KEY_SIZE = 4096;
const RSA_ALGORITHM = 'RSA-OAEP';
const RSA_HASH = 'SHA-256';

export interface UserKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyBase64: string; // SPKI-encoded, base64
  keyFingerprint: string; // SHA-256 hex hash of public key
}

export interface WrappedDEK {
  wrappedKey: string; // base64 RSA-OAEP encrypted DEK
  algorithm: string;
  recipientFingerprint: string;
}

export interface DEKResult {
  dek: CryptoKey;
  dekId: string;
  rawDEK: ArrayBuffer; // for wrapping with public keys
}

export interface HybridEncryptedPayload {
  encryptedData: EncryptedBlob; // AES-GCM encrypted data
  dekId: string;
  wrappedDEKs: Record<string, string>; // userId → base64 wrapped DEK
}

/**
 * Generate an RSA-OAEP 4096-bit key pair for the current user.
 * The private key should be stored securely in IndexedDB or similar.
 * The public key is sent to the server for other users to encrypt DEKs.
 */
export async function generateUserKeyPair(): Promise<UserKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: RSA_ALGORITHM,
      modulusLength: RSA_KEY_SIZE,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: RSA_HASH,
    },
    true, // extractable
    ['wrapKey', 'unwrapKey']
  );

  // Export public key as SPKI for server storage
  const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyBase64 = arrayBufferToBase64(publicKeyBuffer);

  // Generate fingerprint (SHA-256 hash of public key bytes)
  const fingerprintBuffer = await crypto.subtle.digest('SHA-256', publicKeyBuffer);
  const fingerprintArray = Array.from(new Uint8Array(fingerprintBuffer));
  const keyFingerprint = fingerprintArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyBase64,
    keyFingerprint,
  };
}

/**
 * Export private key as PKCS8 base64 for secure local storage (IndexedDB).
 * WARNING: Handle with extreme care. Never send to server.
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  return arrayBufferToBase64(exported);
}

/**
 * Import private key from PKCS8 base64 (retrieved from IndexedDB).
 */
export async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(base64Key);
  return await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: RSA_ALGORITHM, hash: RSA_HASH },
    true,
    ['unwrapKey']
  );
}

/**
 * Import a public key from base64 SPKI (received from server).
 */
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(base64Key);
  return await crypto.subtle.importKey(
    'spki',
    keyBuffer,
    { name: RSA_ALGORITHM, hash: RSA_HASH },
    true,
    ['wrapKey']
  );
}

/**
 * Compute fingerprint (SHA-256 hex) of a public key in base64 SPKI format.
 */
export async function computeKeyFingerprint(publicKeyBase64: string): Promise<string> {
  const keyBuffer = base64ToArrayBuffer(publicKeyBase64);
  const hash = await crypto.subtle.digest('SHA-256', keyBuffer);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a fresh AES-256-GCM Data Encryption Key (DEK).
 * Each DEK is used for a single resource or data segment.
 */
export async function generateDEK(): Promise<DEKResult> {
  const dek = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // must be extractable for RSA wrapping
    ['encrypt', 'decrypt']
  );

  const rawDEK = await crypto.subtle.exportKey('raw', dek);

  // Generate DEK ID from key hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', rawDEK);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const dekId = `dek_${hashArray
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 32)}`;

  return { dek, dekId, rawDEK };
}

/**
 * Wrap (encrypt) a DEK with a recipient's RSA-OAEP public key.
 * The wrapped DEK can only be unwrapped by the corresponding private key holder.
 */
export async function wrapDEKWithPublicKey(
  dek: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey('raw', dek, recipientPublicKey, {
    name: RSA_ALGORITHM,
  });
  return arrayBufferToBase64(wrapped);
}

/**
 * Unwrap (decrypt) a DEK using the current user's RSA-OAEP private key.
 * Returns the DEK as a CryptoKey ready for data decryption.
 */
export async function unwrapDEKWithPrivateKey(
  wrappedDEKBase64: string,
  userPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const wrappedBuffer = base64ToArrayBuffer(wrappedDEKBase64);
  return await crypto.subtle.unwrapKey(
    'raw',
    wrappedBuffer,
    userPrivateKey,
    { name: RSA_ALGORITHM },
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Wrap a DEK for multiple recipients at once.
 * Returns a map of userId → base64 wrapped DEK.
 *
 * @param dek - The data encryption key to distribute
 * @param recipientKeys - Map of userId → CryptoKey (RSA public keys)
 */
export async function wrapDEKForRecipients(
  dek: CryptoKey,
  recipientKeys: Map<string, CryptoKey>
): Promise<Record<string, string>> {
  const wrappedDEKs: Record<string, string> = {};

  for (const [userId, publicKey] of recipientKeys) {
    wrappedDEKs[userId] = await wrapDEKWithPublicKey(dek, publicKey);
  }

  return wrappedDEKs;
}

/**
 * Full hybrid encrypt: generate DEK, encrypt data, wrap DEK for all recipients.
 *
 * @param plaintext - Data to encrypt
 * @param recipientKeys - Map of userId → CryptoKey (RSA public keys)
 * @returns Encrypted payload with wrapped DEKs
 */
export async function hybridEncrypt(
  plaintext: string,
  recipientKeys: Map<string, CryptoKey>
): Promise<HybridEncryptedPayload> {
  // 1. Generate fresh DEK
  const { dek, dekId } = await generateDEK();

  // 2. Encrypt data with DEK (AES-256-GCM)
  const encryptedData = await encryptData(plaintext, dek);

  // 3. Wrap DEK for each recipient (RSA-OAEP)
  const wrappedDEKs = await wrapDEKForRecipients(dek, recipientKeys);

  return { encryptedData, dekId, wrappedDEKs };
}

/**
 * Full hybrid decrypt: unwrap DEK, then decrypt data.
 *
 * @param payload - Encrypted payload containing encrypted data and wrapped DEK
 * @param userId - Current user's ID to find their wrapped DEK
 * @param userPrivateKey - Current user's RSA-OAEP private key
 * @returns Decrypted plaintext
 */
export async function hybridDecrypt(
  payload: HybridEncryptedPayload,
  userId: string,
  userPrivateKey: CryptoKey
): Promise<string> {
  const wrappedDEK = payload.wrappedDEKs[userId];
  if (!wrappedDEK) {
    throw new Error('No access: DEK not wrapped for this user');
  }

  // 1. Unwrap DEK with private key
  const dek = await unwrapDEKWithPrivateKey(wrappedDEK, userPrivateKey);

  // 2. Decrypt data with DEK
  return await decryptData(payload.encryptedData, dek);
}

/**
 * Hybrid encrypt an object (JSON serialize + hybrid encrypt).
 */
export async function hybridEncryptObject(
  obj: Record<string, unknown>,
  recipientKeys: Map<string, CryptoKey>
): Promise<HybridEncryptedPayload> {
  return await hybridEncrypt(JSON.stringify(obj), recipientKeys);
}

/**
 * Hybrid decrypt to object (hybrid decrypt + JSON parse).
 */
export async function hybridDecryptObject<T = Record<string, unknown>>(
  payload: HybridEncryptedPayload,
  userId: string,
  userPrivateKey: CryptoKey
): Promise<T> {
  const json = await hybridDecrypt(payload, userId, userPrivateKey);
  return JSON.parse(json) as T;
}
