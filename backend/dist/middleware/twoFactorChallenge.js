"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securitySettings2faChallenge = exports.gdprDeletion2faChallenge = exports.crossTenantAdmin2faChallenge = exports.twoFactorChallengeMiddleware = void 0;
const TwoFactorService_1 = require("../services/authentication/TwoFactorService");
const user_1 = require("../services/user");
const logger_1 = require("../utils/logger");
const redis_1 = require("../utils/redis");
const defaultConfig = {
    codeHeader: 'X-2FA-Code',
    requireEnabled: false,
    sensitiveActions: [
        'cross-tenant-admin',
        'user-delete',
        'organization-delete',
        'permission-grant-admin',
        'security-settings-change',
        'gdpr-data-deletion',
    ],
    skipForRoles: [],
    codeReuseWindow: 30,
};
const validatedCodes = new Map();
const cacheKeyForValidatedCode = (userId, action) => `2fa:validated:${userId}:${action}`;
async function getValidatedCodeFromCache(key) {
    try {
        const cached = await redis_1.cache.get(key);
        if (cached) {
            return cached;
        }
    }
    catch (error) {
        logger_1.logger.debug('2FA Redis cache get failed; using in-memory fallback', {
            key,
            error: error instanceof Error ? error.message : String(error),
        });
    }
    const localCached = validatedCodes.get(key);
    return localCached ?? null;
}
async function setValidatedCodeInCache(key, value, ttlSeconds) {
    try {
        const stored = await redis_1.cache.set(key, value, ttlSeconds);
        if (stored) {
            return;
        }
    }
    catch (error) {
        logger_1.logger.debug('2FA Redis cache set failed; using in-memory fallback', {
            key,
            error: error instanceof Error ? error.message : String(error),
        });
    }
    validatedCodes.set(key, value);
}
setInterval(() => {
    const now = Date.now();
    const window = defaultConfig.codeReuseWindow * 1000;
    for (const [key, value] of validatedCodes.entries()) {
        if (now - value.timestamp > window) {
            validatedCodes.delete(key);
        }
    }
}, 60 * 1000).unref();
const twoFactorChallengeMiddleware = (action, config = {}) => {
    const finalConfig = { ...defaultConfig, ...config };
    return async (req, res, next) => {
        try {
            if (!req.user) {
                res.status(401).json({
                    error: 'Authentication required',
                    message: 'You must be logged in to perform this action',
                });
                return;
            }
            if (finalConfig.skipForRoles?.includes(req.user.role)) {
                return next();
            }
            if (!finalConfig.sensitiveActions.includes(action)) {
                return next();
            }
            const userService = new user_1.UserService();
            const user = await userService.getUserById(req.user.id);
            if (!user) {
                res.status(401).json({
                    error: 'User not found',
                    message: 'Unable to verify user identity',
                });
                return;
            }
            if (!user.twoFactorEnabled && !finalConfig.requireEnabled) {
                logger_1.logger.info(`2FA challenge skipped for ${action} - user has no 2FA`, {
                    userId: req.user.id,
                    action,
                });
                return next();
            }
            const twoFactorCode = req.headers[finalConfig.codeHeader.toLowerCase()];
            if (!twoFactorCode) {
                logger_1.logger.warn(`2FA challenge required for ${action}`, {
                    userId: req.user.id,
                    action,
                    path: req.path,
                });
                res.status(403).json({
                    error: '2FA verification required',
                    message: `This action requires 2FA verification. Please provide your 2FA code in the ${finalConfig.codeHeader} header.`,
                    code: '2FA_REQUIRED',
                    action,
                });
                return;
            }
            const cacheKey = cacheKeyForValidatedCode(req.user.id, action);
            const cached = await getValidatedCodeFromCache(cacheKey);
            const now = Date.now();
            if (cached?.code === twoFactorCode &&
                now - cached.timestamp < finalConfig.codeReuseWindow * 1000) {
                logger_1.logger.debug(`2FA code reused within window for ${action}`, {
                    userId: req.user.id,
                });
                return next();
            }
            const twoFactorService = new TwoFactorService_1.TwoFactorService();
            if (!user.twoFactorSecret) {
                res.status(403).json({
                    error: '2FA not configured',
                    message: 'You must set up 2FA before performing this action',
                    code: '2FA_NOT_CONFIGURED',
                });
                return;
            }
            const isValid = await Promise.resolve(twoFactorService.verifyToken(user.twoFactorSecret, twoFactorCode, req.user.id));
            if (!isValid) {
                logger_1.logger.warn(`Invalid 2FA code for ${action}`, {
                    userId: req.user.id,
                    action,
                    path: req.path,
                });
                res.status(403).json({
                    error: 'Invalid 2FA code',
                    message: 'The 2FA code provided is invalid or expired',
                    code: '2FA_INVALID',
                });
                return;
            }
            await setValidatedCodeInCache(cacheKey, { code: twoFactorCode, timestamp: now }, finalConfig.codeReuseWindow);
            logger_1.logger.info(`2FA challenge passed for ${action}`, {
                userId: req.user.id,
                action,
                path: req.path,
            });
            next();
        }
        catch (error) {
            logger_1.logger.error('2FA challenge middleware error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to validate 2FA',
            });
        }
    };
};
exports.twoFactorChallengeMiddleware = twoFactorChallengeMiddleware;
exports.crossTenantAdmin2faChallenge = (0, exports.twoFactorChallengeMiddleware)('cross-tenant-admin');
exports.gdprDeletion2faChallenge = (0, exports.twoFactorChallengeMiddleware)('gdpr-data-deletion');
exports.securitySettings2faChallenge = (0, exports.twoFactorChallengeMiddleware)('security-settings-change');
//# sourceMappingURL=twoFactorChallenge.js.map