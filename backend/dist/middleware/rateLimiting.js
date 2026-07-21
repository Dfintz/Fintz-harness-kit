"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelDeleteRateLimiter = exports.intelWriteRateLimiter = exports.intelOperationsRateLimiter = exports.exportOperationsRateLimiter = exports.fileUploadRateLimiter = exports.imageProcessingRateLimiter = exports.integrationOperationsRateLimiter = exports.discordWebhookRateLimiter = exports.rsiApiRateLimiter = exports.webhookCreationRateLimiter = exports.integrationSyncRateLimiter = exports.reactionRateLimiter = exports.channelCreationRateLimiter = exports.bulkMessageRateLimiter = exports.messageCreationRateLimiter = exports.chatRateLimiter = exports.shipMassActionRateLimiter = exports.shipImageUploadRateLimiter = exports.shipWriteRateLimiter = exports.shipReadRateLimiter = exports.fleetAnalyticsRateLimiter = exports.fleetQueryRateLimiter = exports.fleetMemberOperationsRateLimiter = exports.fleetBulkOperationsRateLimiter = exports.shipCreationRateLimiter = exports.fleetExportRateLimiter = exports.fleetSharingRateLimiter = exports.fleetWriteRateLimiter = exports.fleetReadRateLimiter = exports.organizationBulkMemberOperationsRateLimiter = exports.organizationBulkOperationsRateLimiter = exports.permissionOperationsRateLimiter = exports.hierarchyOperationsRateLimiter = exports.organizationInvitationRateLimiter = exports.organizationUpdateRateLimiter = exports.organizationCreationRateLimiter = exports.userSearchRateLimiter = exports.emailVerificationRateLimiter = exports.accountDeletionRateLimiter = exports.avatarUploadRateLimiter = exports.profileUpdateRateLimiter = exports.twoFactorRateLimiter = exports.registrationRateLimiter = exports.publicEndpointRateLimiter = exports.generalRateLimiter = exports.userCreationRateLimiter = exports.refreshTokenRateLimiter = exports.passwordResetRateLimiter = exports.authenticationRateLimiter = exports.loginRateLimiter = void 0;
exports.createCustomCombinedRateLimiter = exports.createCustomUserRateLimiter = exports.createCustomRateLimiter = exports.sensitiveDataAccessRateLimiter = exports.criticalOperationsRateLimiter = exports.adminWriteRateLimiter = exports.adminReadRateLimiter = exports.userSensitiveOperationsRateLimiter = exports.userWriteOperationsRateLimiter = exports.userApiRateLimiter = exports.recruitmentOperationsRateLimiter = exports.applicationSubmissionRateLimiter = exports.dashboardQueriesRateLimiter = exports.alertOperationsRateLimiter = exports.inventoryOperationsRateLimiter = exports.leaderboardQueriesRateLimiter = exports.tournamentOperationsRateLimiter = exports.resourceHarvestingRateLimiter = exports.tradingOperationsRateLimiter = exports.intelOfficerManagementRateLimiter = void 0;
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const rateLimitConfig_1 = require("../config/rateLimitConfig");
const RateLimitMonitorService_1 = require("../services/security/RateLimitMonitorService");
const ipWhitelist_1 = require("../utils/ipWhitelist");
const logger_1 = require("../utils/logger");
const rateLimitStore_1 = require("../utils/rateLimitStore");
function extractClientIp(req) {
    const cached = req._clientIp;
    if (cached) {
        return cached;
    }
    const raw = req.ip ?? 'unknown';
    const ip = (0, ipWhitelist_1.normalizeIP)((0, express_rate_limit_1.ipKeyGenerator)(raw)) || 'unknown';
    req._clientIp = ip;
    return ip;
}
function extractUserKey(req) {
    const user = req.user;
    if (user?.id) {
        return `user:${user.id}`;
    }
    return `ip:${extractClientIp(req)}`;
}
function extractCombinedKey(req) {
    const ip = extractClientIp(req);
    const user = req.user;
    if (user?.id) {
        return `${ip}:${user.id}`;
    }
    return ip;
}
function shouldSkipRateLimit(req) {
    const ip = extractClientIp(req);
    if ((0, rateLimitConfig_1.isIpWhitelisted)(ip)) {
        logger_1.logger.debug(`Rate limit bypassed for whitelisted IP: ${ip}`);
        return true;
    }
    const user = req.user;
    if (user?.id && (0, rateLimitConfig_1.isUserWhitelisted)(user.id)) {
        logger_1.logger.debug(`Rate limit bypassed for whitelisted user: ${user.id}`);
        return true;
    }
    return false;
}
function onRateLimitExceeded(req, res) {
    const ip = extractClientIp(req);
    const user = req.user;
    let identifierType = 'ip';
    let identifier = ip;
    if (user?.id) {
        identifierType = 'user';
        identifier = user.id;
    }
    const limitHeader = res.getHeader('RateLimit-Limit');
    const remainingHeader = res.getHeader('RateLimit-Remaining');
    const limit = typeof limitHeader === 'string' ? Number(limitHeader) : 0;
    const current = typeof remainingHeader === 'string' ? Number(remainingHeader) : 0;
    void RateLimitMonitorService_1.rateLimitMonitor.logViolation({
        identifier,
        identifierType,
        endpoint: req.path,
        timestamp: Date.now(),
        userAgent: req.headers['user-agent'],
        limit,
        current,
    }, req);
}
function createLimiter(opts = {}) {
    const { windowMs = rateLimitConfig_1.RATE_LIMIT_WINDOW_MS, max = rateLimitConfig_1.RATE_LIMIT_MAX_REQUESTS, message = 'Too many requests, please try again later.', standardHeaders = true, legacyHeaders = false, keyGenerator = 'ip', skipRoleMultiplier = false, } = opts;
    let keyGen;
    switch (keyGenerator) {
        case 'user':
            keyGen = extractUserKey;
            break;
        case 'combined':
            keyGen = extractCombinedKey;
            break;
        case 'ip':
        default:
            keyGen = extractClientIp;
    }
    const store = (0, rateLimitStore_1.createRateLimitStore)();
    return (0, express_rate_limit_1.default)({
        windowMs,
        max: (req) => {
            if (skipRoleMultiplier) {
                return max;
            }
            const user = req.user;
            const multiplier = (0, rateLimitConfig_1.getRoleLimitMultiplier)(user?.role);
            return Math.floor(max * multiplier);
        },
        message,
        standardHeaders,
        legacyHeaders,
        keyGenerator: keyGen,
        skipFailedRequests: false,
        skipSuccessfulRequests: false,
        skip: shouldSkipRateLimit,
        handler: (req, res, _next) => {
            onRateLimitExceeded(req, res);
            const resetTime = res.getHeader('RateLimit-Reset');
            const retryAfter = resetTime
                ? Math.ceil((Number(resetTime) * 1000 - Date.now()) / 1000)
                : Math.ceil(windowMs / 1000);
            res.setHeader('Retry-After', retryAfter);
            res.status(429).json({
                error: 'Too Many Requests',
                message,
                retryAfter,
            });
        },
        store,
        validate: false,
    });
}
function createUserRateLimiter(opts = {}) {
    return createLimiter({ ...opts, keyGenerator: 'user' });
}
function createCombinedRateLimiter(opts = {}) {
    return createLimiter({ ...opts, keyGenerator: 'combined' });
}
exports.loginRateLimiter = createLimiter({
    max: 50,
    windowMs: 15 * 60 * 1000,
    message: 'Too many login attempts.',
});
exports.authenticationRateLimiter = createLimiter({ max: 1200 });
exports.passwordResetRateLimiter = createLimiter({
    max: 5,
    windowMs: 30 * 60 * 1000,
    message: 'Password reset rate limit exceeded.',
});
exports.refreshTokenRateLimiter = createLimiter({ max: 240 });
exports.userCreationRateLimiter = createLimiter({
    max: 20,
    windowMs: 60 * 60 * 1000,
    message: 'User creation rate limit exceeded.',
});
exports.generalRateLimiter = createLimiter({ max: 2000, windowMs: 60 * 60 * 1000 });
exports.publicEndpointRateLimiter = createLimiter({
    max: 60,
    windowMs: 15 * 60 * 1000,
    message: 'Too many requests to public endpoints. Please try again later.',
});
exports.registrationRateLimiter = createLimiter({
    max: 5,
    windowMs: 60 * 60 * 1000,
    message: 'Too many registration attempts. Try again later.',
});
exports.twoFactorRateLimiter = createLimiter({
    max: 20,
    windowMs: 15 * 60 * 1000,
    message: '2FA rate limit exceeded. Please wait a few minutes before trying again.',
    keyGenerator: 'user',
});
exports.profileUpdateRateLimiter = createLimiter({
    max: 60,
    windowMs: 15 * 60 * 1000,
    message: 'Profile update rate limit exceeded.',
});
exports.avatarUploadRateLimiter = createLimiter({
    max: 5,
    windowMs: 15 * 60 * 1000,
    message: 'Avatar upload rate limit exceeded.',
});
exports.accountDeletionRateLimiter = createLimiter({
    max: 3,
    windowMs: 60 * 60 * 1000,
    message: 'Account deletion rate limit exceeded.',
});
exports.emailVerificationRateLimiter = createLimiter({
    max: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Email verification rate limit exceeded.',
});
exports.userSearchRateLimiter = createLimiter({
    max: 120,
    windowMs: 15 * 60 * 1000,
    message: 'User search rate limit exceeded.',
});
exports.organizationCreationRateLimiter = createLimiter({
    max: 10,
    windowMs: 60 * 60 * 1000,
    message: 'Organization creation rate limit exceeded.',
});
exports.organizationUpdateRateLimiter = createLimiter({
    max: 60,
    windowMs: 15 * 60 * 1000,
    message: 'Organization update rate limit exceeded.',
});
exports.organizationInvitationRateLimiter = createLimiter({
    max: 20,
    windowMs: 15 * 60 * 1000,
    message: 'Invitation rate limit exceeded.',
});
exports.hierarchyOperationsRateLimiter = createLimiter({
    max: 20,
    windowMs: 15 * 60 * 1000,
    message: 'Hierarchy operations rate limit exceeded.',
});
exports.permissionOperationsRateLimiter = createLimiter({
    max: 30,
    windowMs: 15 * 60 * 1000,
    message: 'Permission operations rate limit exceeded.',
});
exports.organizationBulkOperationsRateLimiter = createUserRateLimiter({
    max: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Organization bulk operations rate limit exceeded.',
});
exports.organizationBulkMemberOperationsRateLimiter = createUserRateLimiter({
    max: 15,
    windowMs: 15 * 60 * 1000,
    message: 'Organization bulk member operations rate limit exceeded.',
});
exports.fleetReadRateLimiter = createLimiter({
    max: 400,
    windowMs: 15 * 60 * 1000,
    message: 'Fleet read rate limit exceeded.',
});
exports.fleetWriteRateLimiter = createLimiter({
    max: 100,
    windowMs: 15 * 60 * 1000,
    message: 'Fleet write rate limit exceeded.',
});
exports.fleetSharingRateLimiter = createLimiter({
    max: 20,
    windowMs: 15 * 60 * 1000,
    message: 'Fleet sharing rate limit exceeded.',
});
exports.fleetExportRateLimiter = createLimiter({
    max: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Fleet export rate limit exceeded.',
});
exports.shipCreationRateLimiter = createLimiter({
    max: 60,
    windowMs: 15 * 60 * 1000,
    message: 'Ship creation rate limit exceeded.',
});
exports.fleetBulkOperationsRateLimiter = createLimiter({
    max: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Bulk operations rate limit exceeded.',
});
exports.fleetMemberOperationsRateLimiter = createLimiter({
    max: 30,
    windowMs: 15 * 60 * 1000,
    message: 'Fleet member operations rate limit exceeded.',
});
exports.fleetQueryRateLimiter = createLimiter({
    max: 100,
    windowMs: 15 * 60 * 1000,
    message: 'Fleet query rate limit exceeded.',
});
exports.fleetAnalyticsRateLimiter = createLimiter({
    max: 30,
    windowMs: 15 * 60 * 1000,
    message: 'Fleet analytics rate limit exceeded.',
});
exports.shipReadRateLimiter = createLimiter({
    max: 400,
    windowMs: 15 * 60 * 1000,
    message: 'Ship read rate limit exceeded.',
});
exports.shipWriteRateLimiter = createLimiter({
    max: 300,
    windowMs: 15 * 60 * 1000,
    message: 'Ship write rate limit exceeded.',
});
exports.shipImageUploadRateLimiter = createLimiter({
    max: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Ship image upload rate limit exceeded.',
});
exports.shipMassActionRateLimiter = createLimiter({
    max: 5,
    windowMs: 15 * 60 * 1000,
    message: 'Ship mass action rate limit exceeded.',
});
exports.chatRateLimiter = createLimiter({
    max: 100,
    windowMs: 5 * 60 * 1000,
    message: 'Chat rate limit exceeded.',
});
exports.messageCreationRateLimiter = createLimiter({
    max: 60,
    windowMs: 5 * 60 * 1000,
    message: 'Message creation rate limit exceeded.',
});
exports.bulkMessageRateLimiter = createLimiter({
    max: 5,
    windowMs: 15 * 60 * 1000,
    message: 'Bulk message rate limit exceeded.',
});
exports.channelCreationRateLimiter = createLimiter({
    max: 10,
    windowMs: 60 * 60 * 1000,
    message: 'Channel creation rate limit exceeded.',
});
exports.reactionRateLimiter = createLimiter({
    max: 100,
    windowMs: 5 * 60 * 1000,
    message: 'Reaction rate limit exceeded.',
});
exports.integrationSyncRateLimiter = createLimiter({
    max: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Integration sync rate limit exceeded.',
});
exports.webhookCreationRateLimiter = createLimiter({
    max: 10,
    windowMs: 60 * 60 * 1000,
    message: 'Webhook creation rate limit exceeded.',
});
exports.rsiApiRateLimiter = createLimiter({
    max: 30,
    windowMs: 5 * 60 * 1000,
    message: 'RSI API rate limit exceeded.',
});
exports.discordWebhookRateLimiter = createLimiter({
    max: 30,
    windowMs: 5 * 60 * 1000,
    message: 'Discord webhook rate limit exceeded.',
});
exports.integrationOperationsRateLimiter = createLimiter({
    max: 50,
    windowMs: 15 * 60 * 1000,
    message: 'Integration operations rate limit exceeded.',
});
exports.imageProcessingRateLimiter = createLimiter({
    max: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Image processing rate limit exceeded.',
});
exports.fileUploadRateLimiter = createLimiter({
    max: 20,
    windowMs: 15 * 60 * 1000,
    message: 'File upload rate limit exceeded.',
});
exports.exportOperationsRateLimiter = createLimiter({
    max: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Export operations rate limit exceeded.',
});
exports.intelOperationsRateLimiter = createLimiter({
    max: 200,
    windowMs: 15 * 60 * 1000,
    message: 'Intel operations rate limit exceeded.',
});
exports.intelWriteRateLimiter = createLimiter({
    max: 30,
    windowMs: 15 * 60 * 1000,
    message: 'Intel write rate limit exceeded.',
});
exports.intelDeleteRateLimiter = createLimiter({
    max: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Intel delete rate limit exceeded.',
});
exports.intelOfficerManagementRateLimiter = createLimiter({
    max: 30,
    windowMs: 15 * 60 * 1000,
    message: 'Intel officer management rate limit exceeded.',
});
exports.tradingOperationsRateLimiter = createLimiter({
    max: 50,
    windowMs: 15 * 60 * 1000,
    message: 'Trading operations rate limit exceeded.',
});
exports.resourceHarvestingRateLimiter = createLimiter({
    max: 30,
    windowMs: 15 * 60 * 1000,
    message: 'Resource harvesting rate limit exceeded.',
});
exports.tournamentOperationsRateLimiter = createLimiter({
    max: 20,
    windowMs: 15 * 60 * 1000,
    message: 'Tournament operations rate limit exceeded.',
});
exports.leaderboardQueriesRateLimiter = createLimiter({
    max: 60,
    windowMs: 15 * 60 * 1000,
    message: 'Leaderboard query rate limit exceeded.',
});
exports.inventoryOperationsRateLimiter = createLimiter({
    max: 50,
    windowMs: 15 * 60 * 1000,
    message: 'Inventory operations rate limit exceeded.',
});
exports.alertOperationsRateLimiter = createLimiter({
    max: 30,
    windowMs: 15 * 60 * 1000,
    message: 'Alert operations rate limit exceeded.',
});
exports.dashboardQueriesRateLimiter = createLimiter({
    max: 100,
    windowMs: 15 * 60 * 1000,
    message: 'Dashboard query rate limit exceeded.',
});
exports.applicationSubmissionRateLimiter = createLimiter({
    max: 10,
    windowMs: 60 * 60 * 1000,
    message: 'Application submission rate limit exceeded.',
});
exports.recruitmentOperationsRateLimiter = createLimiter({
    max: 30,
    windowMs: 15 * 60 * 1000,
    message: 'Recruitment operations rate limit exceeded.',
});
exports.userApiRateLimiter = createUserRateLimiter({
    max: 1000,
    windowMs: 15 * 60 * 1000,
    message: 'User API rate limit exceeded.',
});
exports.userWriteOperationsRateLimiter = createUserRateLimiter({
    max: 200,
    windowMs: 15 * 60 * 1000,
    message: 'User write operations rate limit exceeded.',
});
exports.userSensitiveOperationsRateLimiter = createUserRateLimiter({
    max: 40,
    windowMs: 15 * 60 * 1000,
    message: 'User sensitive operations rate limit exceeded.',
});
exports.adminReadRateLimiter = createUserRateLimiter({
    max: 100,
    windowMs: 15 * 60 * 1000,
    message: 'Admin read rate limit exceeded.',
});
exports.adminWriteRateLimiter = createUserRateLimiter({
    max: 30,
    windowMs: 15 * 60 * 1000,
    message: 'Admin write rate limit exceeded.',
});
exports.criticalOperationsRateLimiter = createCombinedRateLimiter({
    max: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Critical operation rate limit exceeded.',
});
exports.sensitiveDataAccessRateLimiter = createCombinedRateLimiter({
    max: 30,
    windowMs: 15 * 60 * 1000,
    message: 'Sensitive data access rate limit exceeded.',
});
exports.createCustomRateLimiter = createLimiter;
exports.createCustomUserRateLimiter = createUserRateLimiter;
exports.createCustomCombinedRateLimiter = createCombinedRateLimiter;
//# sourceMappingURL=rateLimiting.js.map