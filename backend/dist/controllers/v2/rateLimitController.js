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
exports.RateLimitController = void 0;
const rateLimitConfig = __importStar(require("../../config/rateLimitConfig"));
const RateLimitConfigService_1 = require("../../services/security/RateLimitConfigService");
const BaseController_1 = require("../BaseController");
class RateLimitController extends BaseController_1.BaseController {
    getConfig = async (req, res) => {
        await this.execute(req, res, async () => {
            const overrides = await RateLimitConfigService_1.rateLimitConfigService.getOverrides();
            res.json({
                success: true,
                data: {
                    windowMs: rateLimitConfig.RATE_LIMIT_WINDOW_MS,
                    maxRequests: rateLimitConfig.RATE_LIMIT_MAX_REQUESTS,
                    redisEnabled: rateLimitConfig.RATE_LIMIT_REDIS_ENABLED,
                    redisPrefix: rateLimitConfig.RATE_LIMIT_REDIS_PREFIX,
                    loggingEnabled: rateLimitConfig.RATE_LIMIT_LOGGING_ENABLED,
                    alertThreshold: rateLimitConfig.RATE_LIMIT_ALERT_THRESHOLD,
                    roleMultipliers: rateLimitConfig.ROLE_RATE_LIMIT_MULTIPLIERS,
                    whitelistedUsers: rateLimitConfig.RATE_LIMIT_WHITELIST_USERS.length,
                    whitelistedIps: rateLimitConfig.RATE_LIMIT_WHITELIST_IPS.length,
                    endpointOverrides: overrides,
                },
            });
        });
    };
    updateConfig = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { endpoints } = req.body;
            const overrides = await RateLimitConfigService_1.rateLimitConfigService.updateOverrides(endpoints, user.id);
            res.json({
                success: true,
                data: {
                    message: 'Rate limit configuration updated',
                    endpointOverrides: overrides,
                },
            });
        });
    };
    getUsage = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const isWhitelisted = rateLimitConfig.isUserWhitelisted(user.id);
            const roleMultiplier = rateLimitConfig.getRoleLimitMultiplier(req.user?.role);
            res.json({
                success: true,
                data: {
                    userId: user.id,
                    isWhitelisted,
                    roleMultiplier,
                    effectiveLimit: Math.ceil(rateLimitConfig.RATE_LIMIT_MAX_REQUESTS * roleMultiplier),
                    windowMs: rateLimitConfig.RATE_LIMIT_WINDOW_MS,
                },
            });
        });
    };
    reset = async (req, res) => {
        await this.execute(req, res, async () => {
            const { userId } = req.body;
            const result = await RateLimitConfigService_1.rateLimitConfigService.resetUserRateLimits(userId);
            res.json({
                success: true,
                data: {
                    userId,
                    cleared: result.cleared,
                    message: result.cleared > 0
                        ? `Rate limits reset for user ${userId} (${result.cleared} keys cleared)`
                        : `No active rate limit counters found for user ${userId}`,
                },
            });
        });
    };
}
exports.RateLimitController = RateLimitController;
//# sourceMappingURL=rateLimitController.js.map