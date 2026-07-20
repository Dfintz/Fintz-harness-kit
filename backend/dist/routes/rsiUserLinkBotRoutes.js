"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRsiUserLinkBotRoutes = setRsiUserLinkBotRoutes;
const express_1 = require("express");
const urls_1 = require("../config/urls");
const rsiSyncScheduler_1 = require("../jobs/rsiSyncScheduler");
const botRequestAuth_1 = require("../middleware/botRequestAuth");
const rsiUserLinkBotSchemas_1 = require("../schemas/rsiUserLinkBotSchemas");
const DiscordSettingsService_1 = require("../services/discord/DiscordSettingsService");
const rsi_1 = require("../services/rsi");
const discordAccountLink_1 = require("../utils/discordAccountLink");
const logger_1 = require("../utils/logger");
const rsiVerificationToken_1 = require("../utils/rsiVerificationToken");
const router = (0, express_1.Router)();
const validateSchema = (schema, source = 'body') => (req, res, next) => {
    let data;
    if (source === 'body') {
        data = req.body;
    }
    else if (source === 'params') {
        data = req.params;
    }
    else {
        data = req.query;
    }
    const { error, value } = schema.validate(data, { abortEarly: false });
    if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
    }
    if (source === 'body') {
        req.body = value;
    }
    else if (source === 'params') {
        req.params = value;
    }
    else {
        req.query = value;
    }
    next();
};
function toBotLinkResponse(link) {
    const verificationCode = link.verificationCode;
    return {
        id: link.id,
        userId: link.userId,
        organizationId: link.organizationId,
        rsiHandle: link.rsiHandle,
        verificationMethod: link.verificationMethod,
        verificationCode,
        verifiedAt: link.verifiedAt,
        lastSyncedAt: link.lastSyncedAt,
        syncStatus: link.syncStatus,
        discordUserId: link.discordUserId,
        lastKnownRank: link.lastKnownRank,
        isAffiliate: link.isAffiliate,
        metadata: link.metadata,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
        verificationUrl: verificationCode ? (0, rsiVerificationToken_1.buildRsiVerificationUrl)(verificationCode) : undefined,
    };
}
function buildDiscordSsoLoginUrl() {
    const backendUrl = (0, urls_1.getBackendUrl)().replace(/\/$/, '');
    return `${backendUrl}/api/v2/auth/discord`;
}
router.get('/guild-organizations/:guildId', botRequestAuth_1.validateBotToken, async (req, res) => {
    try {
        const { guildId } = req.params;
        if (!/^\d{17,20}$/.test(guildId)) {
            res.status(400).json({ error: 'Invalid guildId format' });
            return;
        }
        const settings = await DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(guildId);
        if (!settings || settings.length === 0) {
            res.status(404).json({ error: 'Guild not found or not linked to any organization' });
            return;
        }
        res.json({
            success: true,
            data: { organizationId: settings[0].organizationId, guildId },
        });
    }
    catch (err) {
        logger_1.logger.error('Failed to resolve guild organization', { err });
        res.status(500).json({ error: 'Failed to resolve guild organization' });
    }
});
router.post('/organizations/:orgId/users/:discordUserId/rsi-link', botRequestAuth_1.validateBotRequest, validateSchema(rsiUserLinkBotSchemas_1.rsiUserLinkBotSchemas.createLinkParams, 'params'), validateSchema(rsiUserLinkBotSchemas_1.rsiUserLinkBotSchemas.createLinkBody, 'body'), async (req, res) => {
    try {
        const { orgId, discordUserId } = req.params;
        const safeDiscordUserId = discordUserId.trim();
        const { rsiHandle, verificationMethod } = req.body;
        if (!/^\d{17,20}$/.test(safeDiscordUserId)) {
            res.status(400).json({ error: 'Invalid discordUserId format' });
            return;
        }
        const existing = await rsi_1.rsiUserLinkService.getLinkByDiscordAndOrg(safeDiscordUserId, orgId);
        if (existing) {
            const updated = await rsi_1.rsiUserLinkService.updateLink(existing.id, { rsiHandle });
            if (!updated) {
                res.status(404).json({ error: 'No RSI link found for this user in this organization' });
                return;
            }
            res.json({ success: true, data: toBotLinkResponse(updated), created: false });
            return;
        }
        if (!rsi_1.rsiBotUserLookupService.isAvailable()) {
            res.status(503).json({ error: 'User lookup is temporarily unavailable' });
            return;
        }
        const platformUserId = await rsi_1.rsiBotUserLookupService.getPlatformUserIdByDiscordId(safeDiscordUserId);
        if (!platformUserId) {
            res.status(404).json({
                error: 'No platform user linked to this Discord account',
                errorCode: discordAccountLink_1.DISCORD_ACCOUNT_NOT_LINKED_CODE,
                message: 'Sign in with Discord SSO on the web app, then retry this command.',
                loginUrl: buildDiscordSsoLoginUrl(),
            });
            return;
        }
        const link = await rsi_1.rsiUserLinkService.createLink({
            userId: platformUserId,
            discordUserId: safeDiscordUserId,
            organizationId: orgId,
            rsiHandle,
            verificationMethod: verificationMethod,
        });
        res.status(201).json({ success: true, data: toBotLinkResponse(link), created: true });
    }
    catch (err) {
        logger_1.logger.error('Failed to create RSI user link', { err });
        res.status(500).json({ error: 'Failed to create RSI user link' });
    }
});
router.get('/organizations/:orgId/users/:discordUserId/rsi-link', botRequestAuth_1.validateBotRequest, validateSchema(rsiUserLinkBotSchemas_1.rsiUserLinkBotSchemas.statusParams, 'params'), validateSchema(rsiUserLinkBotSchemas_1.rsiUserLinkBotSchemas.statusQuery, 'query'), async (req, res) => {
    try {
        const { orgId, discordUserId } = req.params;
        const link = await rsi_1.rsiUserLinkService.getLinkByDiscordAndOrg(discordUserId, orgId);
        if (!link) {
            res.status(404).json({ error: 'No RSI link found for this user in this organization' });
            return;
        }
        res.json({ success: true, data: toBotLinkResponse(link) });
    }
    catch (err) {
        logger_1.logger.error('Failed to get RSI user link status', { err });
        res.status(500).json({ error: 'Failed to get RSI user link status' });
    }
});
router.delete('/organizations/:orgId/users/:discordUserId/rsi-link', botRequestAuth_1.validateBotRequest, validateSchema(rsiUserLinkBotSchemas_1.rsiUserLinkBotSchemas.deleteLinkParams, 'params'), async (req, res) => {
    try {
        const { orgId, discordUserId } = req.params;
        const link = await rsi_1.rsiUserLinkService.getLinkByDiscordAndOrg(discordUserId, orgId);
        if (!link) {
            res.status(404).json({ error: 'No RSI link found for this user in this organization' });
            return;
        }
        await rsi_1.rsiUserLinkService.deleteLink(link.id);
        res.json({ success: true, message: 'RSI link removed successfully' });
    }
    catch (err) {
        logger_1.logger.error('Failed to delete RSI user link', { err });
        res.status(500).json({ error: 'Failed to delete RSI user link' });
    }
});
router.post('/organizations/:orgId/sync', botRequestAuth_1.validateBotRequest, validateSchema(rsiUserLinkBotSchemas_1.rsiUserLinkBotSchemas.syncParams, 'params'), validateSchema(rsiUserLinkBotSchemas_1.rsiUserLinkBotSchemas.syncBody, 'body'), async (req, res) => {
    try {
        const { orgId } = req.params;
        const { force } = req.body;
        const status = await rsi_1.rsiSyncScheduleService.getScheduleStatus(orgId);
        if (!status) {
            res.status(404).json({ error: 'No sync schedule found for this organization' });
            return;
        }
        await (0, rsiSyncScheduler_1.triggerManualSync)(orgId, `bot-sync${force ? '-forced' : ''}`);
        res.json({ success: true, data: { triggered: true, organizationId: orgId } });
    }
    catch (err) {
        logger_1.logger.error('Failed to run RSI organization sync', { err });
        res.status(500).json({ error: 'Failed to run RSI organization sync' });
    }
});
router.get('/organizations/:orgId/audit', botRequestAuth_1.validateBotRequest, validateSchema(rsiUserLinkBotSchemas_1.rsiUserLinkBotSchemas.auditParams, 'params'), validateSchema(rsiUserLinkBotSchemas_1.rsiUserLinkBotSchemas.auditQuery, 'query'), async (req, res) => {
    try {
        const { orgId } = req.params;
        const { limit, offset, since } = req.query;
        const { logs, total } = await rsi_1.rsiSyncAuditService.getLogs({
            organizationId: orgId,
            limit: limit ? Number.parseInt(limit, 10) : 20,
            offset: offset ? Number.parseInt(offset, 10) : 0,
            fromDate: since ? new Date(since) : undefined,
        });
        res.json({ success: true, data: { logs, total } });
    }
    catch (err) {
        logger_1.logger.error('Failed to get RSI audit logs', { err });
        res.status(500).json({ error: 'Failed to get RSI audit logs' });
    }
});
router.post('/organizations/:orgId/users/:discordUserId/verify-check', botRequestAuth_1.validateBotRequest, validateSchema(rsiUserLinkBotSchemas_1.rsiUserLinkBotSchemas.verifyCheckParams, 'params'), async (req, res) => {
    try {
        const { orgId, discordUserId } = req.params;
        const link = await rsi_1.rsiUserLinkService.getLinkByDiscordAndOrg(discordUserId, orgId);
        if (!link) {
            res.status(404).json({ error: 'No RSI link found for this user in this organization' });
            return;
        }
        if (link.isVerified()) {
            res.json({
                success: true,
                data: {
                    verified: true,
                    rsiHandle: link.rsiHandle,
                    verificationUrl: link.verificationCode
                        ? (0, rsiVerificationToken_1.buildRsiVerificationUrl)(link.verificationCode)
                        : undefined,
                    message: 'Already verified',
                },
            });
            return;
        }
        const result = await rsi_1.rsiUserLinkService.verifyBioCodeOnly(link);
        res.json({
            success: true,
            data: {
                verified: result.verified,
                rsiHandle: link.rsiHandle,
                verificationUrl: link.verificationCode
                    ? (0, rsiVerificationToken_1.buildRsiVerificationUrl)(link.verificationCode)
                    : undefined,
                error: result.error,
            },
        });
    }
    catch (err) {
        logger_1.logger.error('Failed to verify RSI user link', { err });
        res.status(500).json({ error: 'Failed to verify RSI user link' });
    }
});
function setRsiUserLinkBotRoutes(app) {
    app.use('/api/bot/rsi', router);
}
//# sourceMappingURL=rsiUserLinkBotRoutes.js.map