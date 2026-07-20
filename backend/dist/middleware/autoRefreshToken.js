"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshUserDiscordToken = exports.shouldRefreshDiscordToken = exports.autoRefreshDiscordToken = void 0;
const database_1 = require("../config/database");
const UserSession_1 = require("../models/UserSession");
const DiscordService_1 = require("../services/discord/DiscordService");
const security_1 = require("../services/security");
const errorHandler_1 = require("../utils/errorHandler");
const logger_1 = require("../utils/logger");
const TOKEN_REFRESH_THRESHOLD = 60 * 60 * 1000;
const autoRefreshDiscordToken = async (req, res, next) => {
    if (!req.user) {
        next();
        return;
    }
    try {
        const sessionRepository = database_1.AppDataSource.getRepository(UserSession_1.UserSession);
        const session = await sessionRepository.findOne({
            where: {
                userId: req.user.id,
                isActive: true,
            },
            order: {
                lastActivity: 'DESC',
            },
        });
        if (!session) {
            next();
            return;
        }
        if (!session.discordAccessToken ||
            !session.discordRefreshToken ||
            !session.discordTokenExpiry) {
            next();
            return;
        }
        const now = new Date();
        const tokenExpiry = new Date(session.discordTokenExpiry);
        const timeUntilExpiry = tokenExpiry.getTime() - now.getTime();
        if (timeUntilExpiry > TOKEN_REFRESH_THRESHOLD) {
            next();
            return;
        }
        if (!(0, DiscordService_1.isDiscordServiceInitialized)()) {
            logger_1.logger.warn('Discord service not initialized, skipping token refresh');
            next();
            return;
        }
        logger_1.logger.info(`Auto-refreshing Discord token for user ${req.user.id} (expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes)`);
        const tokenEncryptionService = (0, security_1.getTokenEncryptionService)();
        const refreshTokenData = JSON.parse(session.discordRefreshToken);
        const decryptedRefreshToken = tokenEncryptionService.decrypt(refreshTokenData.encrypted, refreshTokenData.iv, refreshTokenData.authTag);
        const discordService = (0, DiscordService_1.getDiscordService)();
        const newTokens = await discordService.refreshAccessToken(decryptedRefreshToken);
        const encryptedAccessToken = tokenEncryptionService.encrypt(newTokens.access_token);
        const encryptedRefreshToken = tokenEncryptionService.encrypt(newTokens.refresh_token);
        const newExpiry = new Date(now.getTime() + newTokens.expires_in * 1000);
        session.discordAccessToken = JSON.stringify(encryptedAccessToken);
        session.discordRefreshToken = JSON.stringify(encryptedRefreshToken);
        session.discordTokenExpiry = newExpiry;
        session.lastActivity = now;
        await sessionRepository.save(session);
        logger_1.logger.info(`Successfully refreshed Discord token for user ${req.user.id}, new expiry: ${newExpiry.toISOString()}`);
        next();
    }
    catch (error) {
        logger_1.logger.error('Failed to auto-refresh Discord token', {
            error: (0, errorHandler_1.getErrorMessage)(error),
        });
        next();
    }
};
exports.autoRefreshDiscordToken = autoRefreshDiscordToken;
const shouldRefreshDiscordToken = (session) => {
    if (!session.discordTokenExpiry) {
        return false;
    }
    const now = new Date();
    const tokenExpiry = new Date(session.discordTokenExpiry);
    const timeUntilExpiry = tokenExpiry.getTime() - now.getTime();
    return timeUntilExpiry <= TOKEN_REFRESH_THRESHOLD;
};
exports.shouldRefreshDiscordToken = shouldRefreshDiscordToken;
const refreshUserDiscordToken = async (userId) => {
    try {
        const sessionRepository = database_1.AppDataSource.getRepository(UserSession_1.UserSession);
        const session = await sessionRepository.findOne({
            where: {
                userId,
                isActive: true,
            },
            order: {
                lastActivity: 'DESC',
            },
        });
        if (!session?.discordRefreshToken) {
            return false;
        }
        if (!(0, exports.shouldRefreshDiscordToken)(session)) {
            return true;
        }
        if (!(0, DiscordService_1.isDiscordServiceInitialized)()) {
            logger_1.logger.warn('Discord service not initialized, cannot refresh token');
            return false;
        }
        const tokenEncryptionService = (0, security_1.getTokenEncryptionService)();
        const refreshTokenData = JSON.parse(session.discordRefreshToken);
        const decryptedRefreshToken = tokenEncryptionService.decrypt(refreshTokenData.encrypted, refreshTokenData.iv, refreshTokenData.authTag);
        const discordService = (0, DiscordService_1.getDiscordService)();
        const newTokens = await discordService.refreshAccessToken(decryptedRefreshToken);
        const now = new Date();
        const encryptedAccessToken = tokenEncryptionService.encrypt(newTokens.access_token);
        const encryptedRefreshToken = tokenEncryptionService.encrypt(newTokens.refresh_token);
        const newExpiry = new Date(now.getTime() + newTokens.expires_in * 1000);
        session.discordAccessToken = JSON.stringify(encryptedAccessToken);
        session.discordRefreshToken = JSON.stringify(encryptedRefreshToken);
        session.discordTokenExpiry = newExpiry;
        session.lastActivity = now;
        await sessionRepository.save(session);
        logger_1.logger.info(`Background refresh successful for user ${userId}`);
        return true;
    }
    catch (error) {
        logger_1.logger.error(`Failed to refresh Discord token for user ${userId}`, {
            error: (0, errorHandler_1.getErrorMessage)(error),
        });
        return false;
    }
};
exports.refreshUserDiscordToken = refreshUserDiscordToken;
//# sourceMappingURL=autoRefreshToken.js.map