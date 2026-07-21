"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwoFactorController = void 0;
const TwoFactorService_1 = require("../services/authentication/TwoFactorService");
const UserService_1 = require("../services/user/UserService");
const apiErrors_1 = require("../utils/apiErrors");
const BaseController_1 = require("./BaseController");
class TwoFactorController extends BaseController_1.BaseController {
    twoFactorService;
    userService;
    constructor() {
        super();
        this.twoFactorService = new TwoFactorService_1.TwoFactorService();
        this.userService = new UserService_1.UserService();
    }
    setupTwoFactor = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            const username = req.user?.username;
            if (!userId || !username) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new apiErrors_1.NotFoundError('User');
            }
            if (user.twoFactorEnabled) {
                throw new apiErrors_1.ValidationError('2FA is already enabled. Please disable it first.');
            }
            const setup = await this.twoFactorService.generateSecret(username);
            await this.userService.updateUser(userId, {
                twoFactorSecret: setup.secret
            });
            res.status(200).json({
                secret: setup.secret,
                qrCodeUrl: setup.qrCodeUrl,
                backupCodes: setup.backupCodes
            });
        });
    };
    verifyAndEnableTwoFactor = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            const { token, backupCodes } = req.body;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            this.validateRequired(req.body, 'token', 'backupCodes');
            if (!Array.isArray(backupCodes)) {
                throw new apiErrors_1.ValidationError('Backup codes must be an array');
            }
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new apiErrors_1.NotFoundError('User');
            }
            if (!user.twoFactorSecret) {
                throw new apiErrors_1.ValidationError('Please initiate 2FA setup first');
            }
            const isValid = this.twoFactorService.verifyToken(user.twoFactorSecret, token);
            if (!isValid) {
                throw new apiErrors_1.ValidationError('Invalid verification code');
            }
            const hashedBackupCodes = this.twoFactorService.hashBackupCodes(backupCodes);
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
    disableTwoFactor = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            const { token, backupCode } = req.body;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new apiErrors_1.NotFoundError('User');
            }
            if (!user.twoFactorEnabled) {
                throw new apiErrors_1.ValidationError('2FA is not enabled');
            }
            let isValid = false;
            if (token && user.twoFactorSecret) {
                isValid = this.twoFactorService.verifyToken(user.twoFactorSecret, token);
            }
            else if (backupCode && user.backupCodes) {
                isValid = this.twoFactorService.verifyBackupCode(backupCode, user.backupCodes);
            }
            else {
                throw new apiErrors_1.ValidationError('Token or backup code is required');
            }
            if (!isValid) {
                throw new apiErrors_1.ValidationError('Invalid verification code');
            }
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
    verifyTwoFactorLogin = async (req, res) => {
        await this.execute(req, res, async () => {
            const { userId, token, backupCode } = req.body;
            this.validateRequired(req.body, 'userId');
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
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new apiErrors_1.NotFoundError('User');
            }
            if (!user.twoFactorEnabled) {
                throw new apiErrors_1.ValidationError('2FA is not enabled for this user');
            }
            let isValid = false;
            let usedBackupCode = false;
            if (token && user.twoFactorSecret) {
                isValid = this.twoFactorService.verifyToken(user.twoFactorSecret, token);
            }
            else if (backupCode && user.backupCodes) {
                isValid = this.twoFactorService.verifyBackupCode(backupCode, user.backupCodes);
                if (isValid) {
                    usedBackupCode = true;
                    const updatedCodes = this.twoFactorService.removeBackupCode(backupCode, user.backupCodes);
                    await this.userService.updateUser(userId, {
                        backupCodes: updatedCodes
                    });
                }
            }
            else {
                throw new apiErrors_1.ValidationError('Token or backup code is required');
            }
            if (!isValid) {
                await this.twoFactorService.trackFailedAttempt(userId);
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
            await this.twoFactorService.resetFailedAttempts(userId);
            res.status(200).json({
                message: '2FA verification successful',
                verified: true,
                usedBackupCode,
                remainingBackupCodes: usedBackupCode && user.backupCodes ? user.backupCodes.length - 1 : undefined
            });
        });
    };
    generateNewBackupCodes = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            const { token } = req.body;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            this.validateRequired(req.body, 'token');
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new apiErrors_1.NotFoundError('User');
            }
            if (!user.twoFactorEnabled || !user.twoFactorSecret) {
                throw new apiErrors_1.ValidationError('2FA is not enabled');
            }
            const isValid = this.twoFactorService.verifyToken(user.twoFactorSecret, token);
            if (!isValid) {
                throw new apiErrors_1.ValidationError('Invalid verification code');
            }
            const backupCodes = this.twoFactorService.generateBackupCodes(10);
            const hashedBackupCodes = this.twoFactorService.hashBackupCodes(backupCodes);
            await this.userService.updateUser(userId, {
                backupCodes: hashedBackupCodes
            });
            res.status(200).json({
                message: 'New backup codes generated successfully',
                backupCodes
            });
        });
    };
    getTwoFactorStatus = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new apiErrors_1.NotFoundError('User');
            }
            res.status(200).json({
                twoFactorEnabled: user.twoFactorEnabled,
                hasBackupCodes: user.backupCodes && user.backupCodes.length > 0,
                backupCodesCount: user.backupCodes?.length || 0
            });
        });
    };
}
exports.TwoFactorController = TwoFactorController;
//# sourceMappingURL=twoFactorController.js.map