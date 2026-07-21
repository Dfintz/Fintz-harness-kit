/**
 * Encryption Routes V2
 * Routes for organization-level end-to-end encryption
 */

import { Router } from 'express';

import { EncryptionControllerV2 } from '../../controllers/v2/encryptionController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { encryptionSchemas } from '../../schemas/encryptionSchemas';

const router = Router();
const controller = new EncryptionControllerV2();

/**
 * @route POST /api/v2/organizations/:organizationId/encryption/initialize
 * @desc Initialize encryption for an organization
 * @access Organization Owner/Admin
 */
router.post(
  '/organizations/:organizationId/encryption/initialize',
  authenticate,
  validateSchema(encryptionSchemas.initializeEncryption, 'body'),
  controller.initializeEncryption.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/status
 * @desc Get encryption status for an organization
 * @access Organization Members
 */
router.get(
  '/organizations/:organizationId/encryption/status',
  authenticate,
  controller.getEncryptionStatus.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/key
 * @desc Get encrypted key wrapper for current user
 * @access Organization Members (with key access)
 */
router.get(
  '/organizations/:organizationId/encryption/key',
  authenticate,
  controller.getKeyWrapper.bind(controller)
);

/**
 * @route POST /api/v2/organizations/:organizationId/encryption/share-key
 * @desc Share encryption key with another user
 * @access Organization Owner/Admin
 */
router.post(
  '/organizations/:organizationId/encryption/share-key',
  authenticate,
  validateSchema(encryptionSchemas.shareKey, 'body'),
  controller.shareKey.bind(controller)
);

/**
 * @route DELETE /api/v2/organizations/:organizationId/encryption/revoke-key/:userId
 * @desc Revoke encryption key access from a user
 * @access Organization Owner/Admin
 */
router.delete(
  '/organizations/:organizationId/encryption/revoke-key/:userId',
  authenticate,
  validateSchema(encryptionSchemas.userIdParam, 'params'),
  controller.revokeKeyAccess.bind(controller)
);

/**
 * @route POST /api/v2/organizations/:organizationId/encrypted-data
 * @desc Store encrypted data
 * @access Organization Members
 */
router.post(
  '/organizations/:organizationId/encrypted-data',
  authenticate,
  validateSchema(encryptionSchemas.storeEncryptedData, 'body'),
  controller.storeEncryptedData.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encrypted-data/:dataId
 * @desc Retrieve encrypted data
 * @access Organization Members (with sufficient security level)
 */
router.get(
  '/organizations/:organizationId/encrypted-data/:dataId',
  authenticate,
  validateSchema(encryptionSchemas.dataIdParam, 'params'),
  controller.getEncryptedData.bind(controller)
);

/**
 * @route DELETE /api/v2/organizations/:organizationId/encrypted-data/:dataId
 * @desc Delete encrypted data
 * @access Organization Members
 */
router.delete(
  '/organizations/:organizationId/encrypted-data/:dataId',
  authenticate,
  validateSchema(encryptionSchemas.dataIdParam, 'params'),
  controller.deleteEncryptedData.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/audit-log
 * @desc Get encryption audit log
 * @access Organization Owner/Admin
 */
router.get(
  '/organizations/:organizationId/encryption/audit-log',
  authenticate,
  validateSchema(encryptionSchemas.auditLogQuery, 'query'),
  controller.getAuditLog.bind(controller)
);

/**
 * @route POST /api/v2/organizations/:organizationId/encryption/rotate-key
 * @desc Rotate encryption key
 * @access Organization Owner
 */
router.post(
  '/organizations/:organizationId/encryption/rotate-key',
  authenticate,
  validateSchema(encryptionSchemas.rotateKey, 'body'),
  controller.rotateKey.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/pending-reencryption
 * @desc Get data items that need re-encryption after key rotation
 * @access Organization Owner/Admin
 */
router.get(
  '/organizations/:organizationId/encryption/pending-reencryption',
  authenticate,
  validateSchema(encryptionSchemas.pendingReEncryptionQuery, 'query'),
  controller.getPendingReEncryption.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/reencryption-progress
 * @desc Get re-encryption progress after key rotation
 * @access Organization Members
 */
router.get(
  '/organizations/:organizationId/encryption/reencryption-progress',
  authenticate,
  controller.getReEncryptionProgress.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/key/:keyId
 * @desc Get an inactive key's wrapper for re-encryption
 * @access Organization Owner/Admin
 */
router.get(
  '/organizations/:organizationId/encryption/key/:keyId',
  authenticate,
  validateSchema(encryptionSchemas.keyIdParam, 'params'),
  controller.getInactiveKeyWrapper.bind(controller)
);

/**
 * @route PUT /api/v2/organizations/:organizationId/encrypted-data/:dataId/reencrypt
 * @desc Submit re-encrypted data item
 * @access Organization Owner/Admin
 */
router.put(
  '/organizations/:organizationId/encrypted-data/:dataId/reencrypt',
  authenticate,
  validateSchema(encryptionSchemas.dataIdParam, 'params'),
  validateSchema(encryptionSchemas.submitReEncryptedData, 'body'),
  controller.submitReEncryptedData.bind(controller)
);

/**
 * @route DELETE /api/v2/organizations/:organizationId/encryption
 * @desc Disable encryption for an organization
 * @access Organization Owner
 */
router.delete(
  '/organizations/:organizationId/encryption',
  authenticate,
  controller.disableEncryption.bind(controller)
);

// ===========================================================================
// Key Claim Token Routes
// ===========================================================================

/**
 * @route POST /api/v2/organizations/:organizationId/encryption/claims
 * @desc Create a key claim token for secure key distribution
 * @access Organization Owner/Admin
 */
router.post(
  '/organizations/:organizationId/encryption/claims',
  authenticate,
  validateSchema(encryptionSchemas.createClaim, 'body'),
  controller.createClaim.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/claims
 * @desc List all key claims for an organization (admin view)
 * @access Organization Owner/Admin
 */
router.get(
  '/organizations/:organizationId/encryption/claims',
  authenticate,
  validateSchema(encryptionSchemas.listClaimsQuery, 'query'),
  controller.listClaims.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/claims/:claimId
 * @desc Get an encrypted claim blob (any org member can fetch to claim it)
 * @access Organization Members
 */
router.get(
  '/organizations/:organizationId/encryption/claims/:claimId',
  authenticate,
  validateSchema(encryptionSchemas.claimIdParam, 'params'),
  controller.getClaimToken.bind(controller)
);

/**
 * @route POST /api/v2/organizations/:organizationId/encryption/claims/:claimId/complete
 * @desc Complete a claim - save the member's new key wrapper
 * @access Organization Members
 */
router.post(
  '/organizations/:organizationId/encryption/claims/:claimId/complete',
  authenticate,
  validateSchema(encryptionSchemas.completeClaim, 'body'),
  controller.completeClaim.bind(controller)
);

/**
 * @route DELETE /api/v2/organizations/:organizationId/encryption/claims/:claimId
 * @desc Revoke a pending claim token
 * @access Organization Owner/Admin
 */
router.delete(
  '/organizations/:organizationId/encryption/claims/:claimId',
  authenticate,
  validateSchema(encryptionSchemas.claimIdParam, 'params'),
  controller.revokeClaim.bind(controller)
);

// ===========================================================================
// Hybrid Encryption: Public Keys + Data Encryption Keys (DEK) Routes
// ===========================================================================
//
// These routes use `authenticate` only (not the orgAuth middleware chain used
// by tags/comments/skills/certifications). Membership is verified explicitly
// in the controller/service layer via membershipRepository checks, which
// supports the granular owner/admin vs member authorization these operations
// require (e.g. key revocation, DEK access management).
//

/**
 * @route POST /api/v2/organizations/:organizationId/encryption/public-keys
 * @desc Register the current user's RSA-OAEP public key
 * @access Organization Members
 */
router.post(
  '/organizations/:organizationId/encryption/public-keys',
  authenticate,
  validateSchema(encryptionSchemas.registerPublicKey, 'body'),
  controller.registerPublicKey.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/public-keys
 * @desc Get all active public keys for the organization
 * @access Organization Members
 */
router.get(
  '/organizations/:organizationId/encryption/public-keys',
  authenticate,
  controller.getOrganizationPublicKeys.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/public-keys/:userId
 * @desc Get a specific member's public key
 * @access Organization Members
 */
router.get(
  '/organizations/:organizationId/encryption/public-keys/:userId',
  authenticate,
  validateSchema(encryptionSchemas.userIdParam, 'params'),
  controller.getPublicKey.bind(controller)
);

/**
 * @route DELETE /api/v2/organizations/:organizationId/encryption/public-keys/:userId
 * @desc Revoke a member's public key
 * @access Organization Owner/Admin
 */
router.delete(
  '/organizations/:organizationId/encryption/public-keys/:userId',
  authenticate,
  validateSchema(encryptionSchemas.userIdParam, 'params'),
  controller.revokePublicKey.bind(controller)
);

/**
 * @route POST /api/v2/organizations/:organizationId/encryption/deks
 * @desc Create a new Data Encryption Key with wrapped copies for recipients
 * @access Organization Members
 */
router.post(
  '/organizations/:organizationId/encryption/deks',
  authenticate,
  validateSchema(encryptionSchemas.createDEK, 'body'),
  controller.createDEK.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/deks/:dekId
 * @desc Get the wrapped DEK for the current user
 * @access Organization Members
 */
router.get(
  '/organizations/:organizationId/encryption/deks/:dekId',
  authenticate,
  validateSchema(encryptionSchemas.dekIdParam, 'params'),
  controller.getDEKForUser.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/deks
 * @desc List DEKs (optionally filtered by dataType/resourceId)
 * @access Organization Members
 */
router.get(
  '/organizations/:organizationId/encryption/deks',
  authenticate,
  validateSchema(encryptionSchemas.listDEKsQuery, 'query'),
  controller.listDEKs.bind(controller)
);

/**
 * @route POST /api/v2/organizations/:organizationId/encryption/deks/:dekId/grant
 * @desc Grant DEK access to another user
 * @access Organization Members (with DEK access)
 */
router.post(
  '/organizations/:organizationId/encryption/deks/:dekId/grant',
  authenticate,
  validateSchema(encryptionSchemas.dekIdParam, 'params'),
  validateSchema(encryptionSchemas.grantDEKAccess, 'body'),
  controller.grantDEKAccess.bind(controller)
);

/**
 * @route DELETE /api/v2/organizations/:organizationId/encryption/deks/:dekId/revoke/:userId
 * @desc Revoke a user's DEK access
 * @access Organization Owner/Admin
 */
router.delete(
  '/organizations/:organizationId/encryption/deks/:dekId/revoke/:userId',
  authenticate,
  validateSchema(encryptionSchemas.dekUserPathParams, 'params'),
  controller.revokeDEKAccess.bind(controller)
);

// ===========================================================================
// Phase 3: Hybrid-Mode Encrypted Data Routes
// ===========================================================================

/**
 * @route POST /api/v2/organizations/:organizationId/encryption/hybrid-data
 * @desc Store data encrypted with a per-resource DEK (hybrid mode)
 * @access Organization Members (with DEK access)
 */
router.post(
  '/organizations/:organizationId/encryption/hybrid-data',
  authenticate,
  validateSchema(encryptionSchemas.storeHybridEncryptedData, 'body'),
  controller.storeHybridEncryptedData.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/hybrid-data/:dataId
 * @desc Retrieve hybrid-encrypted data + wrapped DEK for the current user
 * @access Organization Members (with DEK access + security level)
 */
router.get(
  '/organizations/:organizationId/encryption/hybrid-data/:dataId',
  authenticate,
  validateSchema(encryptionSchemas.dataIdParam, 'params'),
  controller.getHybridEncryptedData.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/hybrid-data
 * @desc List hybrid-encrypted data items
 * @access Organization Members
 */
router.get(
  '/organizations/:organizationId/encryption/hybrid-data',
  authenticate,
  validateSchema(encryptionSchemas.listHybridEncryptedDataQuery, 'query'),
  controller.listHybridEncryptedData.bind(controller)
);

// ===========================================================================
// Phase 4: Flat → Hybrid Migration Routes
// ===========================================================================

/**
 * @route POST /api/v2/organizations/:organizationId/encryption/migration/initiate
 * @desc Mark all flat-mode data as pending migration
 * @access Organization Owner/Admin
 */
router.post(
  '/organizations/:organizationId/encryption/migration/initiate',
  authenticate,
  validateSchema(encryptionSchemas.initiateMigration, 'body'),
  controller.initiateMigration.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/migration/candidates
 * @desc Get flat-mode items pending migration for client-side re-encryption
 * @access Organization Members
 */
router.get(
  '/organizations/:organizationId/encryption/migration/candidates',
  authenticate,
  validateSchema(encryptionSchemas.migrationCandidatesQuery, 'query'),
  controller.getMigrationCandidates.bind(controller)
);

/**
 * @route POST /api/v2/organizations/:organizationId/encryption/migration/:dataId/complete
 * @desc Submit a single re-encrypted migration item
 * @access Organization Members (with DEK access)
 */
router.post(
  '/organizations/:organizationId/encryption/migration/:dataId/complete',
  authenticate,
  validateSchema(encryptionSchemas.dataIdParam, 'params'),
  validateSchema(encryptionSchemas.completeMigrationItem, 'body'),
  controller.completeMigrationItem.bind(controller)
);

/**
 * @route GET /api/v2/organizations/:organizationId/encryption/migration/progress
 * @desc Get migration progress stats
 * @access Organization Members
 */
router.get(
  '/organizations/:organizationId/encryption/migration/progress',
  authenticate,
  controller.getMigrationProgress.bind(controller)
);

export { router };
