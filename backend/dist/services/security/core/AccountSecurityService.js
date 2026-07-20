"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountSecurityService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../../data-source");
const PasswordHistory_1 = require("../../../models/PasswordHistory");
const RecoveryToken_1 = require("../../../models/RecoveryToken");
const User_1 = require("../../../models/User");
const apiErrors_1 = require("../../../utils/apiErrors");
const auditLogger_1 = require("../../../utils/auditLogger");
const logger_1 = require("../../../utils/logger");
const TokenEncryptionService_1 = require("./TokenEncryptionService");
class AccountSecurityService {
    static instance;
    userRepository;
    recoveryTokenRepository;
    passwordHistoryRepository;
    encryptionService;
    static MAX_FAILED_ATTEMPTS = 5;
    static LOCKOUT_DURATION_MS = 15 * 60 * 1000;
    static RECOVERY_TOKEN_EXPIRY_HOURS = 24;
    static PASSWORD_HISTORY_COUNT = 12;
    static CLEANUP_FETCH_MULTIPLIER = 2;
    static PASSWORD_REUSE_ERROR = 'Password has been used recently. Please choose a different password.';
    static DEFAULT_PASSWORD_POLICY = {
        minLength: 12,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        disallowCommonPasswords: true,
        disallowUserInfo: true,
    };
    static COMMON_PASSWORDS = new Set([
        'password',
        'password123',
        '123456',
        '12345678',
        'qwerty',
        'abc123',
        'letmein',
        'welcome',
        'admin',
        'iloveyou',
        'monkey',
        'dragon',
        'master',
        'login',
        'passw0rd',
        '123456789',
        '1234567890',
        'password1',
        'sunshine',
        'princess',
        'football',
        'baseball',
        'starwars',
        'trustno1',
        'michael',
        'shadow',
        'ashley',
        'jessica',
        'charlie',
        'superman',
        'qwerty123',
        'hello',
        '12345',
        '1234567',
        'nothing',
        'secret',
        'passwort',
        'password!',
        'password1!',
        'changeme',
        'default',
        'starcitizen',
        'fleetmanager',
        'fleet123',
        'citizen',
        'aegis',
    ]);
    constructor() {
        this.userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
        this.recoveryTokenRepository = data_source_1.AppDataSource.getRepository(RecoveryToken_1.RecoveryToken);
        this.passwordHistoryRepository = data_source_1.AppDataSource.getRepository(PasswordHistory_1.PasswordHistory);
        this.encryptionService = (0, TokenEncryptionService_1.getTokenEncryptionService)();
        logger_1.logger.info('AccountSecurityService initialized - unified security management');
    }
    static getInstance() {
        if (!AccountSecurityService.instance) {
            AccountSecurityService.instance = new AccountSecurityService();
        }
        return AccountSecurityService.instance;
    }
    isAccountLocked(user) {
        if (!user.lockedUntil) {
            return false;
        }
        const now = new Date();
        const isLocked = user.lockedUntil > now;
        if (!isLocked && user.failedLoginAttempts > 0) {
            logger_1.logger.info(`Account lockout expired for user ${user.id}`);
        }
        return isLocked;
    }
    async recordFailedAttempt(userId) {
        try {
            await this.userRepository
                .createQueryBuilder()
                .update(User_1.User)
                .set({ failedLoginAttempts: () => '"failedLoginAttempts" + 1' })
                .where('id = :id', { id: userId })
                .execute();
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (!user) {
                throw new apiErrors_1.NotFoundError('User', userId);
            }
            const attemptsRemaining = AccountSecurityService.MAX_FAILED_ATTEMPTS - user.failedLoginAttempts;
            if (user.failedLoginAttempts >= AccountSecurityService.MAX_FAILED_ATTEMPTS) {
                const lockedUntil = new Date(Date.now() + AccountSecurityService.LOCKOUT_DURATION_MS);
                await this.userRepository
                    .createQueryBuilder()
                    .update(User_1.User)
                    .set({ lockedUntil })
                    .where('id = :id', { id: userId })
                    .execute();
                logger_1.logger.warn(`Account locked for user ${userId} after ${user.failedLoginAttempts} failed attempts`);
                (0, auditLogger_1.logAuditEvent)({
                    eventType: auditLogger_1.AuditEventType.SECURITY_LEVEL_CHANGED,
                    userId,
                    action: 'account_locked',
                    message: 'Account locked due to max failed attempts exceeded',
                    metadata: {
                        reason: 'max_failed_attempts_exceeded',
                        failedAttempts: user.failedLoginAttempts,
                        lockedUntil,
                    },
                });
                return {
                    isLocked: true,
                    attemptsRemaining: 0,
                    lockedUntil,
                };
            }
            logger_1.logger.info(`Failed login attempt ${user.failedLoginAttempts}/${AccountSecurityService.MAX_FAILED_ATTEMPTS} for user ${userId}`);
            return {
                isLocked: false,
                attemptsRemaining: Math.max(0, attemptsRemaining),
            };
        }
        catch (error) {
            if (error instanceof apiErrors_1.NotFoundError) {
                throw error;
            }
            logger_1.logger.error('Error recording failed login attempt:', error);
            throw new apiErrors_1.DatabaseError('Failed to record login attempt');
        }
    }
    async resetFailedAttempts(userId) {
        try {
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (!user) {
                return;
            }
            const previousAttempts = user.failedLoginAttempts || 0;
            const hadFailedAttempts = previousAttempts > 0;
            const wasLocked = user.lockedUntil && user.lockedUntil > new Date();
            user.failedLoginAttempts = 0;
            user.lockedUntil = undefined;
            await this.userRepository.save(user);
            if (hadFailedAttempts || wasLocked) {
                logger_1.logger.info(`Reset failed login attempts for user ${userId}`);
                (0, auditLogger_1.logAuditEvent)({
                    eventType: auditLogger_1.AuditEventType.SECURITY_LEVEL_CHANGED,
                    userId,
                    action: 'lockout_reset',
                    message: 'Account lockout reset after successful login',
                    metadata: {
                        reason: 'successful_login',
                        previousAttempts,
                    },
                });
            }
        }
        catch (error) {
            logger_1.logger.error(`Error resetting failed attempts for user ${userId}:`, error);
            throw new apiErrors_1.DatabaseError('Failed to reset login attempts');
        }
    }
    async getLockoutStatus(userId) {
        try {
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (!user) {
                throw new apiErrors_1.NotFoundError('User', userId);
            }
            const failedAttempts = user.failedLoginAttempts || 0;
            const attemptsRemaining = Math.max(0, AccountSecurityService.MAX_FAILED_ATTEMPTS - failedAttempts);
            const isLocked = this.isAccountLocked(user);
            const result = {
                isLocked,
                failedAttempts,
                attemptsRemaining,
            };
            if (user.lockedUntil && isLocked) {
                result.lockedUntil = user.lockedUntil;
                result.lockoutExpiresIn = user.lockedUntil.getTime() - Date.now();
            }
            return result;
        }
        catch (error) {
            if (error instanceof apiErrors_1.NotFoundError) {
                throw error;
            }
            logger_1.logger.error(`Error getting lockout status for user ${userId}:`, error);
            throw new apiErrors_1.DatabaseError('Failed to get lockout status');
        }
    }
    async unlockAccount(userId) {
        try {
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (!user) {
                throw new apiErrors_1.NotFoundError('User', userId);
            }
            const wasLocked = this.isAccountLocked(user);
            user.failedLoginAttempts = 0;
            user.lockedUntil = undefined;
            await this.userRepository.save(user);
            if (wasLocked) {
                logger_1.logger.info(`Account manually unlocked for user ${userId}`);
                (0, auditLogger_1.logAuditEvent)({
                    eventType: auditLogger_1.AuditEventType.SECURITY_LEVEL_CHANGED,
                    userId,
                    action: 'account_unlocked',
                    message: 'Account manually unlocked by admin',
                    metadata: {
                        reason: 'admin_override',
                    },
                });
            }
        }
        catch (error) {
            if (error instanceof apiErrors_1.NotFoundError) {
                throw error;
            }
            logger_1.logger.error(`Error unlocking account for user ${userId}:`, error);
            throw new apiErrors_1.DatabaseError('Failed to unlock account');
        }
    }
    generateRecoveryCodes(count = 8) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            const part1 = crypto_1.default.randomBytes(2).toString('hex').toUpperCase();
            const part2 = crypto_1.default.randomBytes(2).toString('hex').toUpperCase();
            const part3 = crypto_1.default.randomBytes(2).toString('hex').toUpperCase();
            const code = `${part1}-${part2}-${part3}`;
            codes.push(code);
        }
        return codes;
    }
    hashRecoveryCodes(codes) {
        return codes.map(code => crypto_1.default.createHash('sha256').update(code.replace(/-/g, '')).digest('hex'));
    }
    async initiateEmailRecovery(email, recoveryType = 'email') {
        try {
            const user = await this.userRepository.findOne({ where: { email } });
            const token = crypto_1.default.randomBytes(32).toString('hex');
            const encryptedTokenData = this.encryptionService.encrypt(token);
            const encryptedToken = JSON.stringify(encryptedTokenData);
            const expiresAt = new Date(Date.now() + AccountSecurityService.RECOVERY_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
            const tokenHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
            if (!user) {
                logger_1.logger.warn('Recovery attempt for non-existent email');
                return { token, expiresAt };
            }
            const recoveryToken = this.recoveryTokenRepository.create({
                userId: user.id,
                token: encryptedToken,
                tokenHash,
                type: recoveryType,
                expiresAt,
                isUsed: false,
            });
            await this.recoveryTokenRepository.save(recoveryToken);
            logger_1.logger.info(`Recovery token generated for user ${user.id}, type: ${recoveryType}`);
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SECURITY_LEVEL_CHANGED,
                userId: user.id,
                action: 'recovery_initiated',
                message: 'Account recovery initiated',
                metadata: {
                    recoveryType,
                    email,
                },
            });
            return { token, expiresAt };
        }
        catch (error) {
            logger_1.logger.error('Error initiating email recovery:', error);
            throw new apiErrors_1.DatabaseError('Failed to initiate recovery');
        }
    }
    async verifyRecoveryToken(token) {
        try {
            const tokenHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
            const now = new Date();
            const recoveryToken = await this.recoveryTokenRepository.findOne({
                where: {
                    tokenHash,
                    isUsed: false,
                    expiresAt: (0, typeorm_1.MoreThan)(now),
                },
            });
            if (!recoveryToken?.token) {
                logger_1.logger.warn('Invalid recovery token provided');
                return null;
            }
            try {
                const tokenData = JSON.parse(recoveryToken.token);
                const decryptedToken = this.encryptionService.decrypt(tokenData.encrypted, tokenData.iv, tokenData.authTag);
                const a = Buffer.from(decryptedToken);
                const b = Buffer.from(token);
                if (a.length !== b.length || !crypto_1.default.timingSafeEqual(a, b)) {
                    logger_1.logger.warn('Recovery token hash matched but decrypted value did not');
                    return null;
                }
            }
            catch (_decryptError) {
                logger_1.logger.warn('Recovery token decryption failed during verification');
                return null;
            }
            logger_1.logger.info(`Valid recovery token verified for user ${recoveryToken.userId}`);
            return recoveryToken;
        }
        catch (error) {
            logger_1.logger.error('Error verifying recovery token:', error);
            throw new apiErrors_1.DatabaseError('Failed to verify recovery token');
        }
    }
    async markTokenUsed(tokenId) {
        try {
            await this.recoveryTokenRepository.update(tokenId, {
                isUsed: true,
                used: true,
                usedAt: new Date(),
            });
            logger_1.logger.info(`Recovery token ${tokenId} marked as used`);
        }
        catch (error) {
            logger_1.logger.error(`Error marking recovery token ${tokenId} as used:`, error);
            throw new apiErrors_1.DatabaseError('Failed to mark token as used');
        }
    }
    async disable2FAWithRecovery(userId, recoveryMethod, recoveryTokenId) {
        try {
            const recoveryToken = await this.recoveryTokenRepository.findOne({
                where: { id: recoveryTokenId, userId, isUsed: true },
            });
            if (!recoveryToken) {
                throw new apiErrors_1.ValidationError('Invalid or unconsumed recovery token');
            }
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (!user) {
                throw new apiErrors_1.NotFoundError('User', userId);
            }
            if (!user.twoFactorEnabled) {
                logger_1.logger.warn(`Attempt to disable 2FA for user ${userId} who doesn't have 2FA enabled`);
                return;
            }
            user.twoFactorEnabled = false;
            user.twoFactorSecret = undefined;
            user.failedTwoFactorAttempts = 0;
            await this.userRepository.save(user);
            logger_1.logger.info(`2FA disabled for user ${userId} via ${recoveryMethod} recovery`);
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SECURITY_LEVEL_CHANGED,
                userId,
                action: '2fa_disabled',
                message: '2FA disabled via recovery method',
                metadata: {
                    method: 'recovery',
                    recoveryMethod,
                    recoveryTokenId,
                    timestamp: new Date(),
                },
            });
        }
        catch (error) {
            if (error instanceof apiErrors_1.NotFoundError || error instanceof apiErrors_1.ValidationError) {
                throw error;
            }
            logger_1.logger.error(`Error disabling 2FA for user ${userId}:`, error);
            throw new apiErrors_1.DatabaseError('Failed to disable 2FA');
        }
    }
    async cleanupExpiredTokens() {
        try {
            const result = await this.recoveryTokenRepository
                .createQueryBuilder()
                .delete()
                .from(RecoveryToken_1.RecoveryToken)
                .where('expiresAt < :now', { now: new Date() })
                .execute();
            const deletedCount = result.affected || 0;
            if (deletedCount > 0) {
                logger_1.logger.info(`Cleaned up ${deletedCount} expired recovery tokens`);
            }
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error('Error cleaning up expired recovery tokens:', error);
            return 0;
        }
    }
    async logSecurityEvent(eventType, data, userId, ipAddress) {
        try {
            (0, auditLogger_1.logAuditEvent)({
                eventType,
                userId,
                ipAddress,
                message: data.message || 'Security event',
                metadata: {
                    ...data,
                    timestamp: new Date(),
                    service: 'AccountSecurityService',
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error logging security event:', error);
        }
    }
    async getSecurityStats() {
        try {
            const now = new Date();
            const lockedAccounts = await this.userRepository.count({
                where: {
                    lockedUntil: (0, typeorm_1.MoreThan)(now),
                },
            });
            const recentFailedAttempts = await this.userRepository.count({
                where: {
                    failedLoginAttempts: (0, typeorm_1.MoreThan)(0),
                },
            });
            const activeRecoveryTokens = await this.recoveryTokenRepository.count({
                where: {
                    isUsed: false,
                    expiresAt: (0, typeorm_1.MoreThan)(now),
                },
            });
            return {
                lockedAccounts: lockedAccounts || 0,
                recentFailedAttempts: recentFailedAttempts || 0,
                activeRecoveryTokens: activeRecoveryTokens || 0,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting security stats:', error);
            return {
                lockedAccounts: 0,
                recentFailedAttempts: 0,
                activeRecoveryTokens: 0,
            };
        }
    }
    getPasswordPolicy() {
        return { ...AccountSecurityService.DEFAULT_PASSWORD_POLICY };
    }
    validatePassword(password, userInfo) {
        const policy = AccountSecurityService.DEFAULT_PASSWORD_POLICY;
        const errors = [];
        let score = 0;
        if (password.length < policy.minLength) {
            errors.push(`Password must be at least ${policy.minLength} characters long`);
        }
        else {
            score += 20;
            if (password.length >= 16) {
                score += 10;
            }
            if (password.length >= 20) {
                score += 10;
            }
        }
        if (password.length > policy.maxLength) {
            errors.push(`Password must not exceed ${policy.maxLength} characters`);
        }
        if (policy.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        else if (/[A-Z]/.test(password)) {
            score += 15;
        }
        if (policy.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        else if (/[a-z]/.test(password)) {
            score += 15;
        }
        if (policy.requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        else if (/\d/.test(password)) {
            score += 15;
        }
        if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
            errors.push('Password must contain at least one special character (!@#$%^&*...)');
        }
        else if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
            score += 15;
        }
        if (policy.disallowCommonPasswords) {
            const lowerPassword = password.toLowerCase();
            if (AccountSecurityService.COMMON_PASSWORDS.has(lowerPassword)) {
                errors.push('Password is too common. Please choose a more unique password');
                score = Math.max(0, score - 30);
            }
        }
        if (policy.disallowUserInfo && userInfo) {
            const lowerPassword = password.toLowerCase();
            if (userInfo.username && lowerPassword.includes(userInfo.username.toLowerCase())) {
                errors.push('Password cannot contain your username');
                score = Math.max(0, score - 20);
            }
            if (userInfo.email) {
                const emailLocal = userInfo.email.split('@')[0].toLowerCase();
                if (lowerPassword.includes(emailLocal)) {
                    errors.push('Password cannot contain your email address');
                    score = Math.max(0, score - 20);
                }
            }
        }
        if (this.hasSequentialChars(password)) {
            errors.push('Password should not contain sequential characters (e.g., "abc", "123")');
            score = Math.max(0, score - 10);
        }
        if (this.hasRepeatedChars(password)) {
            errors.push('Password should not contain repeated characters (e.g., "aaa", "111")');
            score = Math.max(0, score - 10);
        }
        score = Math.min(100, score);
        let strength;
        if (score < 40) {
            strength = 'weak';
        }
        else if (score < 60) {
            strength = 'fair';
        }
        else if (score < 80) {
            strength = 'good';
        }
        else {
            strength = 'strong';
        }
        return {
            isValid: errors.length === 0,
            errors,
            strength,
            score,
        };
    }
    hasSequentialChars(password) {
        const sequences = [
            'abcdefghijklmnopqrstuvwxyz',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            '0123456789',
            'qwertyuiop',
            'asdfghjkl',
            'zxcvbnm',
        ];
        for (const seq of sequences) {
            for (let i = 0; i <= seq.length - 3; i++) {
                if (password.includes(seq.substring(i, i + 3))) {
                    return true;
                }
            }
        }
        return false;
    }
    hasRepeatedChars(password) {
        for (let i = 0; i < password.length - 2; i++) {
            if (password[i] === password[i + 1] && password[i] === password[i + 2]) {
                return true;
            }
        }
        return false;
    }
    async checkPasswordHistory(userId, newPassword, historyCount = AccountSecurityService.PASSWORD_HISTORY_COUNT) {
        try {
            const previousPasswords = await this.passwordHistoryRepository.find({
                where: { userId },
                order: { createdAt: 'DESC' },
                take: historyCount,
            });
            const comparisonPromises = previousPasswords.map(async (historyEntry) => {
                try {
                    const isMatch = await bcrypt_1.default.compare(newPassword, historyEntry.passwordHash);
                    return { isMatch, entry: historyEntry };
                }
                catch (bcryptError) {
                    logger_1.logger.error('Error comparing password hash:', bcryptError);
                    return { isMatch: false, entry: historyEntry };
                }
            });
            const results = await Promise.all(comparisonPromises);
            const matchedEntry = results.find(result => result.isMatch);
            if (matchedEntry) {
                logger_1.logger.warn(`Password reuse attempt detected for user ${userId}`);
                (0, auditLogger_1.logAuditEvent)({
                    eventType: auditLogger_1.AuditEventType.AUTH_FAILURE,
                    userId,
                    action: 'password_reuse_attempt',
                    message: 'Password reuse attempt detected',
                    metadata: { historyCount },
                });
                return false;
            }
            logger_1.logger.debug(`Password history check passed for user ${userId}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error checking password history:', error);
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.AUTH_FAILURE,
                userId,
                action: 'password_history_check_failed',
                message: 'Password history check failed — allowing change (fail-open)',
                metadata: { error: error instanceof Error ? error.message : String(error) },
            });
            return true;
        }
    }
    async addPasswordToHistory(userId, passwordHash) {
        try {
            const historyEntry = this.passwordHistoryRepository.create({
                userId,
                passwordHash,
            });
            await this.passwordHistoryRepository.save(historyEntry);
            logger_1.logger.debug(`Password added to history for user ${userId}`);
            await this.cleanupOldPasswordHistory(userId);
        }
        catch (error) {
            logger_1.logger.error('Error adding password to history:', error);
        }
    }
    async cleanupOldPasswordHistory(userId) {
        try {
            const allPasswords = await this.passwordHistoryRepository.find({
                where: { userId },
                order: { createdAt: 'DESC' },
                take: AccountSecurityService.PASSWORD_HISTORY_COUNT *
                    AccountSecurityService.CLEANUP_FETCH_MULTIPLIER,
            });
            if (allPasswords.length > AccountSecurityService.PASSWORD_HISTORY_COUNT) {
                const entriesToDelete = allPasswords.slice(AccountSecurityService.PASSWORD_HISTORY_COUNT);
                const idsToDelete = entriesToDelete.map(entry => entry.id);
                await this.passwordHistoryRepository.delete(idsToDelete);
                logger_1.logger.debug(`Cleaned up ${entriesToDelete.length} old password history entries for user ${userId}`);
            }
        }
        catch (error) {
            logger_1.logger.error('Error cleaning up old password history:', error);
        }
    }
}
exports.AccountSecurityService = AccountSecurityService;
//# sourceMappingURL=AccountSecurityService.js.map