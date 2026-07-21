"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwoFactorService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const otpauth_1 = require("otpauth");
const qrcode_1 = __importDefault(require("qrcode"));
const auditLogger_1 = require("../../utils/auditLogger");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const UserService_1 = require("../user/UserService");
class TwoFactorService {
    userService;
    constructor() {
        this.userService = new UserService_1.UserService();
    }
    async generateSecret(username, issuer = process.env.TOTP_ISSUER || 'Fringe Core') {
        const secretBytes = new otpauth_1.Secret({ size: 32 });
        const totp = new otpauth_1.TOTP({
            issuer,
            label: username,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: secretBytes,
        });
        const qrCodeUrl = await qrcode_1.default.toDataURL(totp.toString());
        const backupCodes = this.generateBackupCodes(10);
        return {
            secret: secretBytes.base32,
            qrCodeUrl,
            backupCodes,
        };
    }
    verifyToken(secret, token) {
        const totp = new otpauth_1.TOTP({
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: otpauth_1.Secret.fromBase32(secret),
        });
        const delta = totp.validate({ token, window: 2 });
        return delta !== null;
    }
    generateBackupCodes(count = 10) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            const code = crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
            codes.push(code);
        }
        return codes;
    }
    hashBackupCodes(codes) {
        return codes.map(code => crypto_1.default.createHash('sha256').update(code).digest('hex'));
    }
    verifyBackupCode(code, hashedCodes) {
        const hashedCode = crypto_1.default.createHash('sha256').update(code.toUpperCase()).digest('hex');
        return hashedCodes.includes(hashedCode);
    }
    removeBackupCode(code, hashedCodes) {
        const hashedCode = crypto_1.default.createHash('sha256').update(code.toUpperCase()).digest('hex');
        return hashedCodes.filter(c => c !== hashedCode);
    }
    async trackFailedAttempt(userId) {
        try {
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            const attempts = (user.failedTwoFactorAttempts || 0) + 1;
            let lockoutUntil;
            if (attempts >= 15) {
                lockoutUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
                logger_1.logger.warn('User locked out for 24 hours', { userId, attempts });
            }
            else if (attempts >= 10) {
                lockoutUntil = new Date(Date.now() + 60 * 60 * 1000);
                logger_1.logger.warn('User locked out for 1 hour', { userId, attempts });
            }
            else if (attempts >= 5) {
                lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
                logger_1.logger.warn('User locked out for 15 minutes', { userId, attempts });
            }
            await this.userService.updateUser(userId, {
                failedTwoFactorAttempts: attempts,
                twoFactorLockedUntil: lockoutUntil,
            });
            logger_1.logger.info('Failed 2FA attempt tracked', {
                userId,
                attemptCount: attempts,
                lockedUntil: lockoutUntil,
            });
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.AUTH_FAILURE,
                userId,
                resource: 'auth.totp',
                action: 'verify_failed',
                message: `Failed 2FA attempt for user ${userId}: attempt ${attempts}${lockoutUntil ? ` — locked until ${lockoutUntil.toISOString()}` : ''}`,
                metadata: { attemptCount: attempts, lockedUntil: lockoutUntil?.toISOString() },
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to track 2FA attempt', {
                userId,
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
            throw error;
        }
    }
    async checkLockout(userId) {
        try {
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            const now = new Date();
            if (user.twoFactorLockedUntil && user.twoFactorLockedUntil > now) {
                return {
                    isLocked: true,
                    lockedUntil: user.twoFactorLockedUntil,
                    remainingAttempts: 0,
                    attemptCount: user.failedTwoFactorAttempts || 0,
                };
            }
            if (user.twoFactorLockedUntil && user.twoFactorLockedUntil <= now) {
                await this.userService.updateUser(userId, {
                    failedTwoFactorAttempts: 0,
                    twoFactorLockedUntil: undefined,
                });
                return {
                    isLocked: false,
                    remainingAttempts: 15,
                    attemptCount: 0,
                };
            }
            const maxAttempts = 15;
            const attempts = user.failedTwoFactorAttempts || 0;
            const remaining = Math.max(0, maxAttempts - attempts);
            return {
                isLocked: false,
                remainingAttempts: remaining,
                attemptCount: attempts,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to check lockout status', {
                userId,
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
            return {
                isLocked: true,
                remainingAttempts: 0,
                attemptCount: 0,
            };
        }
    }
    async resetFailedAttempts(userId) {
        try {
            await this.userService.updateUser(userId, {
                failedTwoFactorAttempts: 0,
                twoFactorLockedUntil: undefined,
            });
            logger_1.logger.info('Failed 2FA attempts reset', { userId });
        }
        catch (error) {
            logger_1.logger.error('Failed to reset 2FA attempts', {
                userId,
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
            throw error;
        }
    }
    calculateLockoutDuration(attempts) {
        if (attempts >= 15) {
            return 24 * 60 * 60 * 1000;
        }
        else if (attempts >= 10) {
            return 60 * 60 * 1000;
        }
        else if (attempts >= 5) {
            return 15 * 60 * 1000;
        }
        return 0;
    }
}
exports.TwoFactorService = TwoFactorService;
//# sourceMappingURL=TwoFactorService.js.map