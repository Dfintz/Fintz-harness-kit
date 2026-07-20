"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBotRequest = exports.validateBotToken = void 0;
const GuildOrganizationService_1 = require("../services/discord/GuildOrganizationService");
const logger_1 = require("../utils/logger");
const isNonProductionEnv = () => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const validateBotToken = (req, res, next) => {
    const secret = process.env.BOT_INTERNAL_SECRET;
    const provided = req.headers['x-bot-internal-token'];
    if (!secret) {
        if (!isNonProductionEnv()) {
            res.status(401).json({ error: 'Unauthorized: BOT_INTERNAL_SECRET is not configured' });
            return;
        }
        next();
        return;
    }
    if (provided !== secret) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    next();
};
exports.validateBotToken = validateBotToken;
const validateBotRequest = async (req, res, next) => {
    const secret = process.env.BOT_INTERNAL_SECRET;
    if (!secret) {
        if (!isNonProductionEnv()) {
            res.status(401).json({ error: 'Unauthorized: BOT_INTERNAL_SECRET is not configured' });
            return;
        }
    }
    else {
        const provided = req.headers['x-bot-internal-token'];
        if (provided !== secret) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
    }
    const guildId = req.headers['x-discord-guild-id'];
    const { orgId } = req.params;
    if (!orgId) {
        next();
        return;
    }
    if (!guildId) {
        res.status(400).json({ error: 'X-Discord-Guild-Id header is required' });
        return;
    }
    try {
        const guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
        const resolvedOrgId = await guildOrgService.resolveOrganization(guildId);
        if (resolvedOrgId !== orgId) {
            logger_1.logger.warn('Bot request guild/org mismatch', { guildId, orgId, resolvedOrgId });
            res.status(403).json({ error: 'Forbidden: guild does not belong to organization' });
            return;
        }
        next();
    }
    catch (err) {
        logger_1.logger.error('Failed to validate bot request', { err });
        res.status(500).json({ error: 'Internal server error during auth' });
    }
};
exports.validateBotRequest = validateBotRequest;
//# sourceMappingURL=botRequestAuth.js.map