/**
 * Two-Factor Authentication Routes (API v2)
 *
 * Comprehensive 2FA management endpoints supporting:
 * - 2FA setup and verification
 * - Enabling/disabling 2FA for user accounts
 * - 2FA verification during login
 * - Backup codes generation and management
 *
 * Authentication requirements vary by endpoint:
 * - Setup/enable/disable: Requires authenticated user
 * - Verify during login: Public endpoint (no auth required)
 */

import { Request, Response, Router } from 'express';

import { TwoFactorController } from '../../controllers/twoFactorController';
import { authenticate } from '../../middleware/auth';
import { twoFactorRateLimiter } from '../../middleware/rateLimiting';
import { validateSchema } from '../../middleware/schemaValidation';
import { twoFactorSchemas } from '../../schemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let twoFactorController: TwoFactorController;
const getController = () => {
  if (!twoFactorController) {
    twoFactorController = new TwoFactorController();
  }
  return twoFactorController;
};

// ==================== 2FA STATUS AND SETUP ====================

/**
 * GET /api/v2/2fa/status
 * Get current 2FA status for authenticated user
 * Returns: enabled, setup method, backup codes available count
 */
router.get('/status', authenticate, (req: Request, res: Response) =>
  getController().getTwoFactorStatus(req, res)
);

/**
 * POST /api/v2/2fa/setup
 * Initialize 2FA setup process
 * Returns: QR code URL, secret, and temporary backup codes
 */
router.post('/setup', authenticate, (req: Request, res: Response) =>
  getController().setupTwoFactor(req, res)
);

/**
 * POST /api/v2/2fa/verify
 * Verify TOTP code and enable 2FA
 * Request body: { code: string, method?: 'totp' | 'backup' }
 * Requires schema validation
 */
router.post(
  '/verify',
  authenticate,
  twoFactorRateLimiter,
  validateSchema(twoFactorSchemas.verify, 'body'),
  (req: Request, res: Response) => getController().verifyAndEnableTwoFactor(req, res)
);

/**
 * POST /api/v2/2fa/disable
 * Disable 2FA for current user
 * Request body: { code: string, password?: string }
 * Requires schema validation and rate limiting
 */
router.post(
  '/disable',
  authenticate,
  twoFactorRateLimiter,
  validateSchema(twoFactorSchemas.disable, 'body'),
  (req: Request, res: Response) => getController().disableTwoFactor(req, res)
);

// ==================== LOGIN VERIFICATION ====================

/**
 * POST /api/v2/2fa/verify-login
 * Verify 2FA code during login process
 * Public endpoint - no auth required (uses session or token from login request)
 * Request body: { code: string, sessionToken?: string }
 * Rate limited to prevent brute force attacks
 * Requires schema validation
 */
router.post(
  '/verify-login',
  twoFactorRateLimiter,
  validateSchema(twoFactorSchemas.verifyLogin, 'body'),
  (req: Request, res: Response) => getController().verifyTwoFactorLogin(req, res)
);

// ==================== BACKUP CODES ====================

/**
 * POST /api/v2/2fa/backup-codes
 * Generate new set of backup codes
 * Invalidates previous backup codes
 * Returns: new set of backup codes (one-time display)
 */
router.post('/backup-codes', authenticate, (req: Request, res: Response) =>
  getController().generateNewBackupCodes(req, res)
);

export { router };
