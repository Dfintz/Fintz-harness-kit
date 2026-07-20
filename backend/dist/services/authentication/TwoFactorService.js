"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwoFactorService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const otpauth_1 = require("otpauth");
const qrcode_1 = __importDefault(require("qrcode"));
const auditLogger_1 = require("../../utils/auditLogger");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const UserService_1 = require("../user/UserService");
class TwoFactorService {
    userService;
    bcryptCost;
    static usedTotpTokens = new Map();
    static tokenReuseCleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, expiresAt] of TwoFactorService.usedTotpTokens.entries()) {
            if (expiresAt <= now) {
                TwoFactorService.usedTotpTokens.delete(key);
            }
        }
    }, 60 * 1000).unref();
    static tokenValidityWindow = 1;
    constructor() {
        this.userService = new UserService_1.UserService();
        this.bcryptCost = this.getBcryptCost();
    }
    getBcryptCost() {
        const envCost = process.env.BACKUP_CODE_BCRYPT_COST;
        if (!envCost) {
            logger_1.logger.debug('BACKUP_CODE_BCRYPT_COST not set, using default 12');
            return 12;
        }
        const cost = Number.parseInt(envCost, 10);
        if (Number.isNaN(cost) || cost < 10 || cost > 14) {
            logger_1.logger.warn('Invalid BACKUP_CODE_BCRYPT_COST, using default 12', {
                value: envCost,
                parsed: cost,
            });
            return 12;
        }
        logger_1.logger.debug('Using BACKUP_CODE_BCRYPT_COST', { cost });
        return cost;
    }
    isBcryptHash(hash) {
        return hash.startsWith('$2b$') && hash.length >= 58;
    }
    getReplayTtlSeconds() {
        const periodSeconds = 30;
        return periodSeconds * (TwoFactorService.tokenValidityWindow * 2 + 1);
    }
    getTokenReplayKey(userId, token) {
        const tokenHash = node_crypto_1.default.createHash('sha256').update(token.trim().toUpperCase()).digest('hex');
        return `2fa:totp:used:${userId}:${tokenHash}`;
    }
    async isTokenReplayed(key) {
        try {
            const seenInSharedCache = await redis_1.cache.exists(key);
            if (seenInSharedCache) {
                return true;
            }
        }
        catch (error) {
            logger_1.logger.debug('2FA replay cache exists check failed; using local fallback', {
                key,
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
        }
        const localExpiry = TwoFactorService.usedTotpTokens.get(key);
        return typeof localExpiry === 'number' && localExpiry > Date.now();
    }
    async markTokenAsUsed(key) {
        const ttlSeconds = this.getReplayTtlSeconds();
        try {
            const stored = await redis_1.cache.set(key, { usedAt: Date.now() }, ttlSeconds);
            if (stored) {
                return;
            }
        }
        catch (error) {
            logger_1.logger.debug('2FA replay cache set failed; using local fallback', {
                key,
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
        }
        TwoFactorService.usedTotpTokens.set(key, Date.now() + ttlSeconds * 1000);
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
    async verifyToken(secret, token, userId) {
        const totp = new otpauth_1.TOTP({
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: otpauth_1.Secret.fromBase32(secret),
        });
        const normalizedToken = token.trim().toUpperCase();
        const delta = totp.validate({
            token: normalizedToken,
            window: TwoFactorService.tokenValidityWindow,
        });
        if (delta === null) {
            return false;
        }
        if (!userId) {
            return true;
        }
        const replayKey = this.getTokenReplayKey(userId, normalizedToken);
        const replayed = await this.isTokenReplayed(replayKey);
        if (replayed) {
            logger_1.logger.warn('Rejected replayed 2FA token', { userId });
            return false;
        }
        await this.markTokenAsUsed(replayKey);
        return true;
    }
    generateBackupCodes(count = 10) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            const code = node_crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
            codes.push(code);
        }
        return codes;
    }
    async hashBackupCodes(codes) {
        try {
            return await Promise.all(codes.map(code => bcrypt_1.default.hash(code.toUpperCase(), this.bcryptCost)));
        }
        catch (error) {
            logger_1.logger.error('Failed to hash backup codes', {
                error: (0, errorHandler_1.getErrorMessage)(error),
                codeCount: codes.length,
            });
            throw new Error('Failed to hash backup codes');
        }
    }
    async verifyBackupCode(code, hashedCodes) {
        try {
            const normalizedCode = code.toUpperCase().trim();
            for (const hashedCode of hashedCodes) {
                if (this.isBcryptHash(hashedCode)) {
                    const matches = await bcrypt_1.default.compare(normalizedCode, hashedCode);
                    if (matches) {
                        return true;
                    }
                }
                else {
                    const hashedInput = node_crypto_1.default.createHash('sha256').update(normalizedCode).digest('hex');
                    if (hashedInput === hashedCode) {
                        return true;
                    }
                }
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error('Failed to verify backup code', {
                error: (0, errorHandler_1.getErrorMessage)(error),
                hashCount: hashedCodes.length,
            });
            return false;
        }
    }
    async removeBackupCode(code, hashedCodes) {
        try {
            const normalizedCode = code.toUpperCase().trim();
            const result = [];
            for (const hashedCode of hashedCodes) {
                let shouldRemove = false;
                if (this.isBcryptHash(hashedCode)) {
                    shouldRemove = await bcrypt_1.default.compare(normalizedCode, hashedCode);
                }
                else {
                    const hashedInput = node_crypto_1.default.createHash('sha256').update(normalizedCode).digest('hex');
                    shouldRemove = hashedInput === hashedCode;
                }
                if (!shouldRemove) {
                    result.push(hashedCode);
                }
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to remove backup code', {
                error: (0, errorHandler_1.getErrorMessage)(error),
                hashCount: hashedCodes.length,
            });
            return hashedCodes;
        }
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
            const lockoutMessageSuffix = lockoutUntil
                ? ` - locked until ${lockoutUntil.toISOString()}`
                : '';
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.AUTH_FAILURE,
                userId,
                resource: 'auth.totp',
                action: 'verify_failed',
                message: `Failed 2FA attempt for user ${userId}: attempt ${attempts}${lockoutMessageSuffix}`,
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