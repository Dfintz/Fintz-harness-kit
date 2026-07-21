import { Router, Application } from 'express';

import { TwoFactorController } from '../controllers/twoFactorController';
import { authenticateToken } from '../middleware/auth';
import { twoFactorRateLimiter } from '../middleware/rateLimiting';
import { validateSchema } from '../middleware/schemaValidation';
import { twoFactorSchemas } from '../schemas';

const router = Router();
// Lazy initialization to avoid EntityMetadataNotFoundError
let twoFactorController: TwoFactorController;
const getController = () => {
    if (!twoFactorController) {
        twoFactorController = new TwoFactorController();
    }
    return twoFactorController;
};

export const setTwoFactorRoutes = (app: Application) => {
    // Get 2FA status
    router.get('/auth/2fa/status', 
        authenticateToken, 
        (req, res) => getController().getTwoFactorStatus(req, res)
    );

    // Setup 2FA (generates QR code and backup codes)
    router.post('/auth/2fa/setup', 
        authenticateToken, 
        (req, res) => getController().setupTwoFactor(req, res)
    );

    // Verify and enable 2FA
    router.post('/auth/2fa/verify', 
        authenticateToken,
        twoFactorRateLimiter,
        validateSchema(twoFactorSchemas.verify, 'body'),
        (req, res) => getController().verifyAndEnableTwoFactor(req, res)
    );

    // Disable 2FA
    router.post('/auth/2fa/disable', 
        authenticateToken,
        twoFactorRateLimiter,
        validateSchema(twoFactorSchemas.disable, 'body'),
        (req, res) => getController().disableTwoFactor(req, res)
    );

    // Verify 2FA during login (no auth required) - RATE LIMITED
    router.post('/auth/2fa/verify-login',
        twoFactorRateLimiter,
        validateSchema(twoFactorSchemas.verifyLogin, 'body'),
        (req, res) => getController().verifyTwoFactorLogin(req, res)
    );

    // Generate new backup codes
    router.post('/auth/2fa/backup-codes', 
        authenticateToken, 
        (req, res) => getController().generateNewBackupCodes(req, res)
    );

    app.use('/api', router);
};
