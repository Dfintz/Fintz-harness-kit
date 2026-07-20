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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const express_1 = require("express");
const urls_1 = require("../../config/urls");
const authController_1 = require("../../controllers/v2/authController");
const userController_1 = require("../../controllers/v2/userController");
const auth_1 = require("../../middleware/auth");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const logger_1 = require("../../utils/logger");
const oauthState_1 = require("../../utils/oauthState");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new authController_1.AuthControllerV2();
const userController = new userController_1.UserControllerV2();
router.post('/auth/login', rateLimiting_1.loginRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.authSchemas.login, 'body'), controller.login.bind(controller));
router.post('/auth/demo', rateLimiting_1.loginRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.authSchemas.demoLogin, 'body'), controller.demoLogin.bind(controller));
router.post('/auth/sandbox', rateLimiting_1.loginRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.authSchemas.sandboxLogin, 'body'), controller.sandboxLogin.bind(controller));
router.get('/auth/discord', controller.discordInitiate.bind(controller));
router.get('/auth/discord/callback', rateLimiting_1.authenticationRateLimiter, controller.discordCallback.bind(controller));
router.post('/auth/discord/callback', rateLimiting_1.authenticationRateLimiter, controller.discordCallback.bind(controller));
router.post('/auth/azuread/callback', rateLimiting_1.authenticationRateLimiter, controller.azureADCallback.bind(controller));
router.get('/auth/google', controller.googleInitiate.bind(controller));
router.get('/auth/google/callback', rateLimiting_1.authenticationRateLimiter, controller.googleCallback.bind(controller));
router.post('/auth/google/callback', rateLimiting_1.authenticationRateLimiter, controller.googleCallback.bind(controller));
router.post('/auth/google/link', auth_1.authenticate, rateLimiting_1.authenticationRateLimiter, controller.googleLink.bind(controller));
router.get('/auth/twitch', controller.twitchInitiate.bind(controller));
router.get('/auth/twitch/callback', rateLimiting_1.authenticationRateLimiter, controller.twitchCallback.bind(controller));
router.post('/auth/twitch/callback', rateLimiting_1.authenticationRateLimiter, controller.twitchCallback.bind(controller));
router.post('/auth/twitch/link', auth_1.authenticate, rateLimiting_1.authenticationRateLimiter, controller.twitchLink.bind(controller));
router.post('/auth/refresh', rateLimiting_1.refreshTokenRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.authSchemas.refresh, 'body'), controller.refresh.bind(controller));
router.post('/auth/logout', (0, schemaValidation_1.validateSchema)(schemas_1.authSchemas.logout, 'body'), controller.logout.bind(controller));
router.post('/auth/logout-all', auth_1.authenticate, controller.logoutAll.bind(controller));
router.get('/auth/sessions', auth_1.authenticate, controller.getActiveSessions.bind(controller));
router.post('/auth/sessions/:sessionId/revoke', auth_1.authenticate, controller.revokeSession.bind(controller));
router.get('/auth/tokens/verify', auth_1.authenticate, controller.verifyToken.bind(controller));
router.get('/auth/me', auth_1.authenticate, userController.getCurrentUser.bind(userController));
router.post('/auth/2fa/enable', auth_1.authenticate, rateLimiting_1.twoFactorRateLimiter, controller.enable2FA.bind(controller));
router.post('/auth/2fa/verify', auth_1.authenticate, rateLimiting_1.twoFactorRateLimiter, controller.verify2FA.bind(controller));
router.post('/auth/2fa/disable', auth_1.authenticate, rateLimiting_1.twoFactorRateLimiter, controller.disable2FA.bind(controller));
router.get('/auth/bot-invite', (req, res) => {
    const clientId = process.env.DISCORD_BOT_CLIENT_ID || process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
        res.status(503).json({ error: 'Bot invite not configured' });
        return;
    }
    const permissions = '1419813317751';
    const orgId = typeof req.query.orgId === 'string' ? req.query.orgId.trim() : '';
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    if (orgId && userId) {
        const backendUrl = (0, urls_1.getBackendUrl)();
        const redirectUri = `${backendUrl}/api/v2/auth/bot-invite/callback`;
        const nonce = node_crypto_1.default.randomBytes(16).toString('hex');
        const timestamp = Date.now().toString(36);
        const payload = `${nonce}.${timestamp}.${orgId}.${userId}`;
        const secret = (0, oauthState_1.getOAuthSecret)();
        const signature = node_crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
        const state = `${payload}.${signature}`;
        const url = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}` +
            `&scope=bot+applications.commands` +
            `&permissions=${permissions}` +
            `&response_type=code` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&state=${encodeURIComponent(state)}`;
        res.redirect(url);
        return;
    }
    const url = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&scope=bot+applications.commands&permissions=${permissions}`;
    res.redirect(url);
});
router.get('/auth/bot-invite/callback', rateLimiting_1.authenticationRateLimiter, async (req, res) => {
    const frontendUrl = (0, urls_1.getFrontendUrl)();
    const settingsUrl = `${frontendUrl}/discord`;
    try {
        const { guild_id: guildId, state, error: oauthError } = req.query;
        if (oauthError) {
            logger_1.logger.warn('Bot invite OAuth error from Discord', { error: oauthError });
            res.redirect(`${settingsUrl}?bot_error=oauth_denied`);
            return;
        }
        if (typeof state !== 'string' || typeof guildId !== 'string') {
            logger_1.logger.warn('Bot invite callback missing state or guild_id');
            res.redirect(`${settingsUrl}?bot_error=missing_params`);
            return;
        }
        const parts = state.split('.');
        if (parts.length !== 5) {
            logger_1.logger.warn('Bot invite callback invalid state format');
            res.redirect(`${settingsUrl}?bot_error=invalid_state`);
            return;
        }
        const [nonce, timestamp, orgId, userId, signature] = parts;
        const payload = `${nonce}.${timestamp}.${orgId}.${userId}`;
        const secret = (0, oauthState_1.getOAuthSecret)();
        const expectedSignature = node_crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
        if (!signature ||
            !expectedSignature ||
            !node_crypto_1.default.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
            logger_1.logger.warn('Bot invite callback state signature mismatch');
            res.redirect(`${settingsUrl}?bot_error=invalid_state`);
            return;
        }
        const stateTimestamp = Number.parseInt(timestamp, 36);
        const MAX_STATE_AGE_MS = 15 * 60 * 1000;
        if (Date.now() - stateTimestamp > MAX_STATE_AGE_MS) {
            logger_1.logger.warn('Bot invite callback state expired');
            res.redirect(`${settingsUrl}?bot_error=state_expired`);
            return;
        }
        const { GuildOrganizationService } = await Promise.resolve().then(() => __importStar(require('../../services/discord/GuildOrganizationService')));
        const guildOrgService = GuildOrganizationService.getInstance();
        const guildName = await guildOrgService.fetchGuildName(guildId, `Guild ${guildId}`);
        await guildOrgService.syncOnDiscordConnection(guildId, orgId, guildName, userId);
        logger_1.logger.info(`Auto-connected guild ${guildId} to org ${orgId} via bot invite callback`);
        res.redirect(`${settingsUrl}?bot_connected=true&guild_id=${encodeURIComponent(guildId)}`);
    }
    catch (error) {
        logger_1.logger.error('Bot invite callback error:', error);
        res.redirect(`${settingsUrl}?bot_error=connection_failed`);
    }
});
//# sourceMappingURL=auth.js.map