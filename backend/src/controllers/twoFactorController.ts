import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { TwoFactorService } from '../services/authentication/TwoFactorService';
import { UserService } from '../services/user/UserService';
import { UnauthorizedError, NotFoundError, ValidationError } from '../utils/apiErrors';

import { BaseController } from './BaseController';

export class TwoFactorController extends BaseController {
    private twoFactorService: TwoFactorService;
    private userService: UserService;

    constructor() {
        super();
        this.twoFactorService = new TwoFactorService();
        this.userService = new UserService();
    }

    /**
     * Initialize 2FA setup - generates secret and QR code
     */
    public setupTwoFactor = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            const username = req.user?.username;

            if (!userId || !username) {
                throw new UnauthorizedError('Unauthorized');
            }

            // Get user to check if 2FA is already enabled
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new NotFoundError('User');
            }
            
            if (user.twoFactorEnabled) {
                throw new ValidationError('2FA is already enabled. Please disable it first.');
            }

            // Generate secret, QR code, and backup codes
            const setup = await this.twoFactorService.generateSecret(username);

            // Temporarily store the secret (not yet enabled)
            await this.userService.updateUser(userId, {
                twoFactorSecret: setup.secret
            });

            // Return setup information (don't save backup codes yet)
            res.status(200).json({
                secret: setup.secret,
                qrCodeUrl: setup.qrCodeUrl,
                backupCodes: setup.backupCodes
            });
        });
    };

    /**
     * Verify and enable 2FA
     */
    public verifyAndEnableTwoFactor = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            const { token, backupCodes } = req.body;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            this.validateRequired(req.body, 'token', 'backupCodes');

            if (!Array.isArray(backupCodes)) {
                throw new ValidationError('Backup codes must be an array');
            }

            // Get user and check if secret exists
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new NotFoundError('User');
            }
            
            if (!user.twoFactorSecret) {
                throw new ValidationError('Please initiate 2FA setup first');
            }

            // Verify the token
            const isValid = this.twoFactorService.verifyToken(user.twoFactorSecret, token);
            if (!isValid) {
                throw new ValidationError('Invalid verification code');
            }

            // Hash backup codes before storing
            const hashedBackupCodes = this.twoFactorService.hashBackupCodes(backupCodes);

            // Enable 2FA
            await this.userService.updateUser(userId, {
                twoFactorEnabled: true,
                backupCodes: hashedBackupCodes
            });

            res.status(200).json({
                message: '2FA has been enabled successfully',
                twoFactorEnabled: true
            });
        });
    };

    /**
     * Disable 2FA
     */
    public disableTwoFactor = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            const { token, backupCode } = req.body;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            // Get user
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new NotFoundError('User');
            }
            
            if (!user.twoFactorEnabled) {
                throw new ValidationError('2FA is not enabled');
            }

            // Verify either token or backup code
            let isValid = false;
            if (token && user.twoFactorSecret) {
                isValid = this.twoFactorService.verifyToken(user.twoFactorSecret, token);
            } else if (backupCode && user.backupCodes) {
                isValid = this.twoFactorService.verifyBackupCode(backupCode, user.backupCodes);
            } else {
                throw new ValidationError('Token or backup code is required');
            }

            if (!isValid) {
                throw new ValidationError('Invalid verification code');
            }

            // Disable 2FA
            await this.userService.updateUser(userId, {
                twoFactorEnabled: false,
                twoFactorSecret: undefined,
                backupCodes: undefined
            });

            res.status(200).json({
                message: '2FA has been disabled successfully',
                twoFactorEnabled: false
            });
        });
    };

    /**
     * Verify 2FA code during login (WITH RATE LIMITING AND LOCKOUT CHECK)
     */
    public verifyTwoFactorLogin = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { userId, token, backupCode } = req.body;

            this.validateRequired(req.body, 'userId');

            // Check lockout status FIRST
            const lockoutStatus = await this.twoFactorService.checkLockout(userId);
            if (lockoutStatus.isLocked) {
                res.status(429).json({
                    message: 'Account temporarily locked due to too many failed attempts',
                    lockedUntil: lockoutStatus.lockedUntil,
                    retryAfter: lockoutStatus.lockedUntil 
                        ? Math.ceil((lockoutStatus.lockedUntil.getTime() - Date.now()) / 1000)
                        : undefined,
                });
                return;
            }

            // Get user
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new NotFoundError('User');
            }
            
            if (!user.twoFactorEnabled) {
                throw new ValidationError('2FA is not enabled for this user');
            }

            // Verify either token or backup code
            let isValid = false;
            let usedBackupCode = false;

            if (token && user.twoFactorSecret) {
                isValid = this.twoFactorService.verifyToken(user.twoFactorSecret, token);
            } else if (backupCode && user.backupCodes) {
                isValid = this.twoFactorService.verifyBackupCode(backupCode, user.backupCodes);
                if (isValid) {
                    usedBackupCode = true;
                    // Remove used backup code
                    const updatedCodes = this.twoFactorService.removeBackupCode(backupCode, user.backupCodes);
                    await this.userService.updateUser(userId, {
                        backupCodes: updatedCodes
                    });
                }
            } else {
                throw new ValidationError('Token or backup code is required');
            }

            if (!isValid) {
                // Track failed attempt
                await this.twoFactorService.trackFailedAttempt(userId);

                // Get updated lockout status
                const updatedStatus = await this.twoFactorService.checkLockout(userId);

                res.status(400).json({
                    message: 'Invalid verification code',
                    remainingAttempts: updatedStatus.remainingAttempts,
                    warning: updatedStatus.remainingAttempts <= 3 
                        ? 'Account will be locked after too many failed attempts'
                        : undefined,
                });
                return;
            }

            // SUCCESS - Reset failed attempts
            await this.twoFactorService.resetFailedAttempts(userId);

            res.status(200).json({
                message: '2FA verification successful',
                verified: true,
                usedBackupCode,
                remainingBackupCodes: usedBackupCode && user.backupCodes ? user.backupCodes.length - 1 : undefined
            });
        });
    };

    /**
     * Generate new backup codes
     */
    public generateNewBackupCodes = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            const { token } = req.body;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            this.validateRequired(req.body, 'token');

            // Get user
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new NotFoundError('User');
            }
            
            if (!user.twoFactorEnabled || !user.twoFactorSecret) {
                throw new ValidationError('2FA is not enabled');
            }

            // Verify token
            const isValid = this.twoFactorService.verifyToken(user.twoFactorSecret, token);
            if (!isValid) {
                throw new ValidationError('Invalid verification code');
            }

            // Generate new backup codes
            const backupCodes = this.twoFactorService.generateBackupCodes(10);
            const hashedBackupCodes = this.twoFactorService.hashBackupCodes(backupCodes);

            // Update user
            await this.userService.updateUser(userId, {
                backupCodes: hashedBackupCodes
            });

            res.status(200).json({
                message: 'New backup codes generated successfully',
                backupCodes
            });
        });
    };

    /**
     * Get 2FA status for current user
     */
    public getTwoFactorStatus = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;

            if (!userId) {
                throw new UnauthorizedError('Unauthorized');
            }

            // Get user
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new NotFoundError('User');
            }

            res.status(200).json({
                twoFactorEnabled: user.twoFactorEnabled,
                hasBackupCodes: user.backupCodes && user.backupCodes.length > 0,
                backupCodesCount: user.backupCodes?.length || 0
            });
        });
    };
}
