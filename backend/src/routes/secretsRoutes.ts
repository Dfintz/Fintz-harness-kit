import express from 'express';

import { SecretsController } from '../controllers/secretsController';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/authorization';

const router = express.Router();
// Lazy initialization to avoid EntityMetadataNotFoundError
let secretsController: SecretsController;
const getController = () => {
    if (!secretsController) {
        secretsController = new SecretsController();
    }
    return secretsController;
};

/**
 * @swagger
 * /api/secrets/status:
 *   get:
 *     summary: Get secrets manager status
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Secrets manager status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/status', authenticateToken, requireAdmin, (req, res) => getController().getSecretsStatus(req, res));

/**
 * @swagger
 * /api/secrets/rotation-check:
 *   get:
 *     summary: Check which secrets need rotation
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: maxAge
 *         schema:
 *           type: integer
 *           default: 90
 *         description: Maximum age in days before rotation is recommended
 *     responses:
 *       200:
 *         description: Secrets rotation status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/rotation-check', authenticateToken, requireAdmin, (req, res) => getController().checkSecretsRotation(req, res));

/**
 * @swagger
 * /api/secrets/rotate-jwt:
 *   post:
 *     summary: Rotate JWT secret
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - confirm
 *             properties:
 *               confirm:
 *                 type: boolean
 *                 description: Must be true to confirm rotation
 *     responses:
 *       200:
 *         description: JWT secret rotated successfully
 *       400:
 *         description: Confirmation required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.post('/rotate-jwt', authenticateToken, requireAdmin, (req, res) => getController().rotateJwtSecret(req, res));

/**
 * @swagger
 * /api/secrets/rotate-encryption-key:
 *   post:
 *     summary: Rotate encryption key
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - confirm
 *             properties:
 *               confirm:
 *                 type: boolean
 *                 description: Must be true to confirm rotation
 *     responses:
 *       200:
 *         description: Encryption key rotated successfully
 *       400:
 *         description: Confirmation required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.post('/rotate-encryption-key', authenticateToken, requireAdmin, (req, res) => getController().rotateEncryptionKey(req, res));

/**
 * @swagger
 * /api/secrets/rotate-db-password:
 *   post:
 *     summary: Rotate database password secret
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *               - confirm
 *             properties:
 *               newPassword:
 *                 type: string
 *                 description: New database password
 *               confirm:
 *                 type: boolean
 *                 description: Must be true to confirm rotation
 *     responses:
 *       200:
 *         description: Database password secret rotated successfully
 *       400:
 *         description: Missing fields or confirmation required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.post('/rotate-db-password', authenticateToken, requireAdmin, (req, res) => getController().rotateDbPassword(req, res));

/**
 * @swagger
 * /api/secrets/reload:
 *   post:
 *     summary: Reload secrets from Key Vault
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Secrets reloaded successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.post('/reload', authenticateToken, requireAdmin, (req, res) => getController().reloadSecrets(req, res));

export { router };
