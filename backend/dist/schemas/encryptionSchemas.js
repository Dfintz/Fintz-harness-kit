"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptionSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const encryptionMetadataSchema = joi_1.default.object({
    iv: joi_1.default.string().required().description('Initialization vector'),
    authTag: joi_1.default.string().optional().description('Canonical authentication tag'),
    tag: joi_1.default.string().optional().description('Legacy authentication tag alias'),
    algorithm: joi_1.default.string().optional().description('Algorithm used'),
    keyVersion: joi_1.default.number().integer().optional(),
    version: joi_1.default.number().integer().optional(),
})
    .or('authTag', 'tag')
    .required()
    .description('Encryption parameters needed for decryption');
const paginationQuerySchema = joi_1.default.object({
    limit: joi_1.default.number().integer().min(1).max(200).default(50),
    offset: joi_1.default.number().integer().min(0).default(0),
});
exports.encryptionSchemas = {
    metadata: encryptionMetadataSchema,
    paginationQuery: paginationQuerySchema,
    userIdParam: joi_1.default.object({ userId: joi_1.default.string().uuid().required() }),
    dataIdParam: joi_1.default.object({ dataId: joi_1.default.string().uuid().required() }),
    keyIdParam: joi_1.default.object({ keyId: joi_1.default.string().trim().min(1).max(200).required() }),
    claimIdParam: joi_1.default.object({ claimId: joi_1.default.string().uuid().required() }),
    dekIdParam: joi_1.default.object({ dekId: joi_1.default.string().trim().min(1).max(200).required() }),
    dekUserPathParams: joi_1.default.object({
        dekId: joi_1.default.string().trim().min(1).max(200).required(),
        userId: joi_1.default.string().uuid().required(),
    }),
    initializeEncryption: joi_1.default.object({
        keyId: joi_1.default.string()
            .trim()
            .min(1)
            .max(200)
            .required()
            .description('Client-generated key identifier'),
        algorithm: joi_1.default.string()
            .trim()
            .valid('AES-256-GCM', 'AES-128-GCM', 'ChaCha20-Poly1305')
            .required()
            .description('Encryption algorithm used'),
        wrappedKeys: joi_1.default.object()
            .pattern(joi_1.default.string().uuid(), joi_1.default.string().min(1).max(10000))
            .min(1)
            .required()
            .description('Map of userId → encrypted key wrapper'),
        recoveryHint: joi_1.default.string()
            .trim()
            .max(500)
            .optional()
            .description('Optional hint for key recovery'),
    }),
    shareKey: joi_1.default.object({
        targetUserId: joi_1.default.string().uuid().required().description('User ID to share the key with'),
        wrappedKey: joi_1.default.string()
            .min(1)
            .max(10000)
            .required()
            .description("Key encrypted with target user's password"),
    }),
    storeEncryptedData: joi_1.default.object({
        keyId: joi_1.default.string()
            .trim()
            .min(1)
            .max(200)
            .required()
            .description('ID of the encryption key used'),
        dataType: joi_1.default.string()
            .trim()
            .min(1)
            .max(100)
            .required()
            .description('Type of data being encrypted (e.g., "message", "document")'),
        resourceId: joi_1.default.string().trim().max(200).optional().description('Optional resource reference'),
        encryptedData: joi_1.default.string().min(1).required().description('Base64-encoded encrypted data blob'),
        encryptionMetadata: encryptionMetadataSchema,
        minSecurityLevel: joi_1.default.number()
            .integer()
            .min(1)
            .max(10)
            .optional()
            .description('Minimum security level required to access'),
        allowedRoles: joi_1.default.array()
            .items(joi_1.default.string().trim().max(50))
            .optional()
            .description('Roles allowed to access this data'),
    }),
    rotateKey: joi_1.default.object({
        newKeyId: joi_1.default.string()
            .trim()
            .min(1)
            .max(200)
            .required()
            .description('New client-generated key identifier'),
        newWrappedKeys: joi_1.default.object()
            .pattern(joi_1.default.string().uuid(), joi_1.default.string().min(1).max(10000))
            .min(1)
            .required()
            .description('Map of userId → encrypted wrapper for new key'),
    }),
    submitReEncryptedData: joi_1.default.object({
        newKeyId: joi_1.default.string()
            .trim()
            .min(1)
            .max(200)
            .required()
            .description('ID of the new encryption key'),
        encryptedData: joi_1.default.string().min(1).required().description('Re-encrypted data blob'),
        encryptionMetadata: encryptionMetadataSchema.description('Updated encryption metadata'),
    }),
    auditLogQuery: joi_1.default.object({
        eventType: joi_1.default.string().trim().max(50).optional().description('Filter by event type'),
        limit: joi_1.default.number().integer().min(1).max(200).default(50),
        offset: joi_1.default.number().integer().min(0).default(0),
    }),
    pendingReEncryptionQuery: joi_1.default.object({
        limit: joi_1.default.number().integer().min(1).max(200).default(50),
        offset: joi_1.default.number().integer().min(0).default(0),
    }),
    initiateMigration: joi_1.default.object({}),
    createClaim: joi_1.default.object({
        encryptedClaim: joi_1.default.string()
            .min(1)
            .required()
            .description('Base64-encoded encrypted org key blob'),
        claimMetadata: joi_1.default.object({
            iv: joi_1.default.string().required().description('Initialization vector'),
            salt: joi_1.default.string().required().description('PBKDF2 salt'),
            iterations: joi_1.default.number()
                .integer()
                .min(10000)
                .required()
                .description('PBKDF2 iteration count'),
            algorithm: joi_1.default.string()
                .valid('AES-256-GCM', 'AES-128-GCM')
                .required()
                .description('Encryption algorithm'),
        })
            .required()
            .description('Encryption parameters for the claim blob'),
        label: joi_1.default.string()
            .trim()
            .max(100)
            .optional()
            .description('Human-readable label (e.g., "For CommanderJohn")'),
        expiresInHours: joi_1.default.number()
            .integer()
            .min(1)
            .max(168)
            .optional()
            .description('Expiry in hours (default 24, max 168)'),
    }),
    completeClaim: joi_1.default.object({
        wrappedKey: joi_1.default.string()
            .min(1)
            .max(10000)
            .required()
            .description("Org key re-wrapped with claimant's own password"),
    }),
    listClaimsQuery: joi_1.default.object({
        status: joi_1.default.string()
            .valid('pending', 'claimed', 'expired', 'revoked')
            .optional()
            .description('Filter by claim status'),
        limit: joi_1.default.number().integer().min(1).max(200).default(50),
        offset: joi_1.default.number().integer().min(0).default(0),
    }),
    registerPublicKey: joi_1.default.object({
        publicKey: joi_1.default.string()
            .min(1)
            .max(20000)
            .required()
            .description('RSA-OAEP public key in SPKI format, base64-encoded'),
        keyFingerprint: joi_1.default.string()
            .hex()
            .length(64)
            .required()
            .description('SHA-256 hex hash of the SPKI-encoded public key'),
        keySize: joi_1.default.number()
            .integer()
            .valid(2048, 4096)
            .default(4096)
            .description('RSA key size in bits'),
    }),
    createDEK: joi_1.default.object({
        dekId: joi_1.default.string()
            .trim()
            .min(1)
            .max(200)
            .required()
            .description('Client-generated DEK identifier'),
        dataType: joi_1.default.string()
            .trim()
            .min(1)
            .max(64)
            .required()
            .description('Type of data this DEK encrypts'),
        resourceId: joi_1.default.string()
            .trim()
            .max(255)
            .optional()
            .description('Specific resource this DEK is bound to'),
        wrappedKeys: joi_1.default.object()
            .pattern(joi_1.default.string().uuid(), joi_1.default.string().min(1).max(10000))
            .min(1)
            .required()
            .description('Map of userId → RSA-OAEP wrapped DEK (base64)'),
    }),
    grantDEKAccess: joi_1.default.object({
        targetUserId: joi_1.default.string().uuid().required().description('User ID to grant access to'),
        wrappedKey: joi_1.default.string()
            .min(1)
            .max(10000)
            .required()
            .description("DEK wrapped with target user's RSA public key"),
    }),
    listDEKsQuery: joi_1.default.object({
        dataType: joi_1.default.string().trim().max(64).optional().description('Filter by data type'),
        resourceId: joi_1.default.string().trim().max(255).optional().description('Filter by resource ID'),
        limit: joi_1.default.number().integer().min(1).max(200).default(50),
        offset: joi_1.default.number().integer().min(0).default(0),
    }),
    storeHybridEncryptedData: joi_1.default.object({
        dekId: joi_1.default.string()
            .trim()
            .min(1)
            .max(200)
            .required()
            .description('ID of the Data Encryption Key used'),
        dataType: joi_1.default.string()
            .trim()
            .min(1)
            .max(100)
            .required()
            .description('Type of data being encrypted'),
        resourceId: joi_1.default.string().trim().max(200).optional().description('Optional resource reference'),
        encryptedData: joi_1.default.string()
            .min(1)
            .max(50_000_000)
            .required()
            .description('Base64-encoded encrypted data blob'),
        encryptionMetadata: encryptionMetadataSchema.description('Encryption parameters for decryption'),
        minSecurityLevel: joi_1.default.number()
            .integer()
            .min(1)
            .max(10)
            .optional()
            .description('Minimum security level required'),
        allowedRoles: joi_1.default.array()
            .items(joi_1.default.string().trim().max(50))
            .optional()
            .description('Roles allowed to access this data'),
    }),
    listHybridEncryptedDataQuery: joi_1.default.object({
        dataType: joi_1.default.string().trim().max(100).optional().description('Filter by data type'),
        resourceId: joi_1.default.string().trim().max(200).optional().description('Filter by resource ID'),
        limit: joi_1.default.number().integer().min(1).max(200).default(50),
        offset: joi_1.default.number().integer().min(0).default(0),
    }),
    completeMigrationItem: joi_1.default.object({
        dekId: joi_1.default.string()
            .trim()
            .min(1)
            .max(200)
            .required()
            .description('Target DEK ID for the migrated data'),
        encryptedData: joi_1.default.string()
            .min(1)
            .max(50_000_000)
            .required()
            .description('Re-encrypted data blob (encrypted with DEK)'),
        encryptionMetadata: encryptionMetadataSchema.description('Updated encryption metadata'),
    }),
    migrationCandidatesQuery: joi_1.default.object({
        limit: joi_1.default.number().integer().min(1).max(200).default(20),
        offset: joi_1.default.number().integer().min(0).default(0),
    }),
};
//# sourceMappingURL=encryptionSchemas.js.map