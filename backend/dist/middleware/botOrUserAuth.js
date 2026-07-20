"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.botOrUserAuth = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const database_1 = require("../config/database");
const User_1 = require("../models/User");
const GuildOrganizationService_1 = require("../services/discord/GuildOrganizationService");
const logger_1 = require("../utils/logger");
const auth_1 = require("./auth");
const tenantContext_1 = require("./tenantContext");
const isNonProductionEnv = () => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const SYSTEM_BOT_USER_ID = '00000000-0000-0000-0000-000000000000';
async function handleBotRequest(req, res, next) {
    const secret = process.env.BOT_INTERNAL_SECRET;
    const provided = req.headers['x-bot-internal-token'];
    if (secret) {
        const providedStr = typeof provided === 'string' ? provided : '';
        const providedBuf = Buffer.from(providedStr);
        const secretBuf = Buffer.from(secret);
        const isValid = providedBuf.length === secretBuf.length && node_crypto_1.default.timingSafeEqual(providedBuf, secretBuf);
        if (!isValid) {
            logger_1.logger.error('Bot auth rejected: token mismatch', {
                path: req.path,
                method: req.method,
                providedLength: providedStr.length,
                expectedLength: secret.length,
                providedPrefix: providedStr.substring(0, 4) || 'none',
                expectedPrefix: secret.substring(0, 4),
            });
            res.status(401).json({ error: 'Unauthorized: invalid bot token' });
            return;
        }
    }
    else if (!isNonProductionEnv()) {
        logger_1.logger.error('Bot auth rejected: BOT_INTERNAL_SECRET is not configured on API side', {
            path: req.path,
            method: req.method,
        });
        res.status(401).json({ error: 'Unauthorized: BOT_INTERNAL_SECRET is not configured' });
        return;
    }
    const guildId = req.headers['x-discord-guild-id'];
    if (!guildId) {
        res.status(400).json({ error: 'X-Discord-Guild-Id header is required for bot requests' });
        return;
    }
    try {
        const guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
        const orgId = await guildOrgService.resolveOrganization(guildId);
        if (!orgId) {
            logger_1.logger.warn('Bot request: guild not linked to any organization', { guildId });
            res
                .status(403)
                .json({ error: 'Forbidden: this Discord guild is not linked to an organization' });
            return;
        }
        const discordUserId = req.headers['x-discord-user-id'];
        let userId = SYSTEM_BOT_USER_ID;
        let username = 'discord-bot';
        if (discordUserId && database_1.AppDataSource.isInitialized) {
            const userRepo = database_1.AppDataSource.getRepository(User_1.User);
            const linkedUser = await userRepo.findOne({ where: { discordId: discordUserId } });
            if (linkedUser) {
                userId = linkedUser.id;
                username = linkedUser.username ?? username;
            }
        }
        req.user = {
            id: userId,
            username,
            role: 'bot',
            discordId: discordUserId,
            currentOrganizationId: orgId,
        };
        req.tenantContext = {
            organizationId: orgId,
            userId,
            userRole: 'bot',
        };
        next();
    }
    catch (err) {
        logger_1.logger.error('Failed to resolve bot org context', { err, guildId });
        res.status(500).json({ error: 'Internal server error during bot auth' });
    }
}
const botOrUserAuth = (req, res, next) => {
    const botToken = req.headers['x-bot-internal-token'];
    if (botToken) {
        logger_1.logger.info('botOrUserAuth: bot token detected, routing to handleBotRequest', {
            path: req.path,
            method: req.method,
            hasGuildId: !!req.headers['x-discord-guild-id'],
        });
        return handleBotRequest(req, res, next);
    }
    void (0, auth_1.authenticateToken)(req, res, (authErr) => {
        if (authErr) {
            return next(authErr);
        }
        if (res.headersSent) {
            return;
        }
        void (0, tenantContext_1.tenantContextMiddleware)(req, res, (tcErr) => {
            if (tcErr) {
                return next(tcErr);
            }
            if (res.headersSent) {
                return;
            }
            (0, tenantContext_1.requireTenantContext)(req, res, next);
        });
    });
};
exports.botOrUserAuth = botOrUserAuth;
//# sourceMappingURL=botOrUserAuth.js.map