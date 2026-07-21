import Joi from 'joi';

const encryptionMetadataSchema = Joi.object({
  iv: Joi.string().required().description('Initialization vector'),
  authTag: Joi.string().optional().description('Canonical authentication tag'),
  tag: Joi.string().optional().description('Legacy authentication tag alias'),
  algorithm: Joi.string().optional().description('Algorithm used'),
  keyVersion: Joi.number().integer().optional(),
  version: Joi.number().integer().optional(),
})
  .or('authTag', 'tag')
  .required()
  .description('Encryption parameters needed for decryption');

const paginationQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(200).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

/**
 * Encryption validation schemas
 *
 * Used by EncryptionControllerV2 endpoints for request validation.
 * Covers organization E2E encryption lifecycle: initialize, share, rotate,
 * store/retrieve/delete encrypted data, re-encryption after key rotation,
 * and key claim token distribution.
 */

export const encryptionSchemas = {
  metadata: encryptionMetadataSchema,

  paginationQuery: paginationQuerySchema,

  // Common path param schemas
  userIdParam: Joi.object({ userId: Joi.string().uuid().required() }),
  dataIdParam: Joi.object({ dataId: Joi.string().uuid().required() }),
  keyIdParam: Joi.object({ keyId: Joi.string().trim().min(1).max(200).required() }),
  claimIdParam: Joi.object({ claimId: Joi.string().uuid().required() }),
  dekIdParam: Joi.object({ dekId: Joi.string().trim().min(1).max(200).required() }),
  dekUserPathParams: Joi.object({
    dekId: Joi.string().trim().min(1).max(200).required(),
    userId: Joi.string().uuid().required(),
  }),

  // POST /api/v2/organizations/:organizationId/encryption/initialize
  initializeEncryption: Joi.object({
    keyId: Joi.string()
      .trim()
      .min(1)
      .max(200)
      .required()
      .description('Client-generated key identifier'),
    algorithm: Joi.string()
      .trim()
      .valid('AES-256-GCM', 'AES-128-GCM', 'ChaCha20-Poly1305')
      .required()
      .description('Encryption algorithm used'),
    wrappedKeys: Joi.object()
      .pattern(Joi.string().uuid(), Joi.string().min(1).max(10000))
      .min(1)
      .required()
      .description('Map of userId → encrypted key wrapper'),
    recoveryHint: Joi.string()
      .trim()
      .max(500)
      .optional()
      .description('Optional hint for key recovery'),
  }),

  // POST /api/v2/organizations/:organizationId/encryption/share-key
  shareKey: Joi.object({
    targetUserId: Joi.string().uuid().required().description('User ID to share the key with'),
    wrappedKey: Joi.string()
      .min(1)
      .max(10000)
      .required()
      .description("Key encrypted with target user's password"),
  }),

  // POST /api/v2/organizations/:organizationId/encrypted-data
  storeEncryptedData: Joi.object({
    keyId: Joi.string()
      .trim()
      .min(1)
      .max(200)
      .required()
      .description('ID of the encryption key used'),
    dataType: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .required()
      .description('Type of data being encrypted (e.g., "message", "document")'),
    resourceId: Joi.string().trim().max(200).optional().description('Optional resource reference'),
    encryptedData: Joi.string().min(1).required().description('Base64-encoded encrypted data blob'),
    encryptionMetadata: encryptionMetadataSchema,
    minSecurityLevel: Joi.number()
      .integer()
      .min(1)
      .max(10)
      .optional()
      .description('Minimum security level required to access'),
    allowedRoles: Joi.array()
      .items(Joi.string().trim().max(50))
      .optional()
      .description('Roles allowed to access this data'),
  }),

  // POST /api/v2/organizations/:organizationId/encryption/rotate-key
  rotateKey: Joi.object({
    newKeyId: Joi.string()
      .trim()
      .min(1)
      .max(200)
      .required()
      .description('New client-generated key identifier'),
    newWrappedKeys: Joi.object()
      .pattern(Joi.string().uuid(), Joi.string().min(1).max(10000))
      .min(1)
      .required()
      .description('Map of userId → encrypted wrapper for new key'),
  }),

  // PUT /api/v2/organizations/:organizationId/encrypted-data/:dataId/reencrypt
  submitReEncryptedData: Joi.object({
    newKeyId: Joi.string()
      .trim()
      .min(1)
      .max(200)
      .required()
      .description('ID of the new encryption key'),
    encryptedData: Joi.string().min(1).required().description('Re-encrypted data blob'),
    encryptionMetadata: encryptionMetadataSchema.description('Updated encryption metadata'),
  }),

  // GET /api/v2/organizations/:organizationId/encryption/audit-log (query params)
  auditLogQuery: Joi.object({
    eventType: Joi.string().trim().max(50).optional().description('Filter by event type'),
    limit: Joi.number().integer().min(1).max(200).default(50),
    offset: Joi.number().integer().min(0).default(0),
  }),

  // GET /api/v2/organizations/:organizationId/encryption/pending-reencryption (query params)
  pendingReEncryptionQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(200).default(50),
    offset: Joi.number().integer().min(0).default(0),
  }),

  // POST /api/v2/organizations/:organizationId/encryption/migration/initiate
  initiateMigration: Joi.object({}),

  // ===========================================================================
  // Key Claim Token Schemas
  // ===========================================================================

  // POST /api/v2/organizations/:organizationId/encryption/claims
  createClaim: Joi.object({
    encryptedClaim: Joi.string()
      .min(1)
      .required()
      .description('Base64-encoded encrypted org key blob'),
    claimMetadata: Joi.object({
      iv: Joi.string().required().description('Initialization vector'),
      salt: Joi.string().required().description('PBKDF2 salt'),
      iterations: Joi.number()
        .integer()
        .min(10000)
        .required()
        .description('PBKDF2 iteration count'),
      algorithm: Joi.string()
        .valid('AES-256-GCM', 'AES-128-GCM')
        .required()
        .description('Encryption algorithm'),
    })
      .required()
      .description('Encryption parameters for the claim blob'),
    label: Joi.string()
      .trim()
      .max(100)
      .optional()
      .description('Human-readable label (e.g., "For CommanderJohn")'),
    expiresInHours: Joi.number()
      .integer()
      .min(1)
      .max(168)
      .optional()
      .description('Expiry in hours (default 24, max 168)'),
  }),

  // POST /api/v2/organizations/:organizationId/encryption/claims/:claimId/complete
  completeClaim: Joi.object({
    wrappedKey: Joi.string()
      .min(1)
      .max(10000)
      .required()
      .description("Org key re-wrapped with claimant's own password"),
  }),

  // GET /api/v2/organizations/:organizationId/encryption/claims (query params)
  listClaimsQuery: Joi.object({
    status: Joi.string()
      .valid('pending', 'claimed', 'expired', 'revoked')
      .optional()
      .description('Filter by claim status'),
    limit: Joi.number().integer().min(1).max(200).default(50),
    offset: Joi.number().integer().min(0).default(0),
  }),

  // ===========================================================================
  // Hybrid Encryption: Public Keys + Data Encryption Keys (DEK)
  // ===========================================================================

  // POST /api/v2/organizations/:organizationId/encryption/public-keys
  registerPublicKey: Joi.object({
    publicKey: Joi.string()
      .min(1)
      .max(20000)
      .required()
      .description('RSA-OAEP public key in SPKI format, base64-encoded'),
    keyFingerprint: Joi.string()
      .hex()
      .length(64)
      .required()
      .description('SHA-256 hex hash of the SPKI-encoded public key'),
    keySize: Joi.number()
      .integer()
      .valid(2048, 4096)
      .default(4096)
      .description('RSA key size in bits'),
  }),

  // POST /api/v2/organizations/:organizationId/encryption/deks
  createDEK: Joi.object({
    dekId: Joi.string()
      .trim()
      .min(1)
      .max(200)
      .required()
      .description('Client-generated DEK identifier'),
    dataType: Joi.string()
      .trim()
      .min(1)
      .max(64)
      .required()
      .description('Type of data this DEK encrypts'),
    resourceId: Joi.string()
      .trim()
      .max(255)
      .optional()
      .description('Specific resource this DEK is bound to'),
    wrappedKeys: Joi.object()
      .pattern(Joi.string().uuid(), Joi.string().min(1).max(10000))
      .min(1)
      .required()
      .description('Map of userId → RSA-OAEP wrapped DEK (base64)'),
  }),

  // POST /api/v2/organizations/:organizationId/encryption/deks/:dekId/grant
  grantDEKAccess: Joi.object({
    targetUserId: Joi.string().uuid().required().description('User ID to grant access to'),
    wrappedKey: Joi.string()
      .min(1)
      .max(10000)
      .required()
      .description("DEK wrapped with target user's RSA public key"),
  }),

  // GET /api/v2/organizations/:organizationId/encryption/deks (query params)
  listDEKsQuery: Joi.object({
    dataType: Joi.string().trim().max(64).optional().description('Filter by data type'),
    resourceId: Joi.string().trim().max(255).optional().description('Filter by resource ID'),
    limit: Joi.number().integer().min(1).max(200).default(50),
    offset: Joi.number().integer().min(0).default(0),
  }),

  // ===========================================================================
  // Phase 3: Hybrid-Mode Encrypted Data Schemas
  // ===========================================================================

  // POST /api/v2/organizations/:organizationId/encryption/hybrid-data
  storeHybridEncryptedData: Joi.object({
    dekId: Joi.string()
      .trim()
      .min(1)
      .max(200)
      .required()
      .description('ID of the Data Encryption Key used'),
    dataType: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .required()
      .description('Type of data being encrypted'),
    resourceId: Joi.string().trim().max(200).optional().description('Optional resource reference'),
    encryptedData: Joi.string()
      .min(1)
      .max(50_000_000)
      .required()
      .description('Base64-encoded encrypted data blob'),
    encryptionMetadata: encryptionMetadataSchema.description(
      'Encryption parameters for decryption'
    ),
    minSecurityLevel: Joi.number()
      .integer()
      .min(1)
      .max(10)
      .optional()
      .description('Minimum security level required'),
    allowedRoles: Joi.array()
      .items(Joi.string().trim().max(50))
      .optional()
      .description('Roles allowed to access this data'),
  }),

  // GET /api/v2/organizations/:organizationId/encryption/hybrid-data (query params)
  listHybridEncryptedDataQuery: Joi.object({
    dataType: Joi.string().trim().max(100).optional().description('Filter by data type'),
    resourceId: Joi.string().trim().max(200).optional().description('Filter by resource ID'),
    limit: Joi.number().integer().min(1).max(200).default(50),
    offset: Joi.number().integer().min(0).default(0),
  }),

  // ===========================================================================
  // Phase 4: Flat → Hybrid Migration Schemas
  // ===========================================================================

  // POST /api/v2/organizations/:organizationId/encryption/migration/:dataId/complete
  completeMigrationItem: Joi.object({
    dekId: Joi.string()
      .trim()
      .min(1)
      .max(200)
      .required()
      .description('Target DEK ID for the migrated data'),
    encryptedData: Joi.string()
      .min(1)
      .max(50_000_000)
      .required()
      .description('Re-encrypted data blob (encrypted with DEK)'),
    encryptionMetadata: encryptionMetadataSchema.description('Updated encryption metadata'),
  }),

  // GET /api/v2/organizations/:organizationId/encryption/migration/candidates (query params)
  migrationCandidatesQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(200).default(20),
    offset: Joi.number().integer().min(0).default(0),
  }),
};
