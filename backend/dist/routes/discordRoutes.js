"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const discordSettingsController_1 = require("../controllers/discord/discordSettingsController");
const auth_1 = require("../middleware/auth");
const autoRefreshToken_1 = require("../middleware/autoRefreshToken");
const DiscordService_1 = require("../services/discord/DiscordService");
const DiscordSettingsService_1 = require("../services/discord/DiscordSettingsService");
const apiErrors_1 = require("../utils/apiErrors");
const joiValidators_1 = require("../utils/joiValidators");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
exports.router = router;
const discordTenantAuth = [auth_1.authenticateWithTenant, autoRefreshToken_1.autoRefreshDiscordToken];
router.use('/orgs', auth_1.authenticateToken, autoRefreshToken_1.autoRefreshDiscordToken, discordSettingsController_1.router);
async function ensureGuildAccess(req, res, guildId) {
    try {
        await DiscordSettingsService_1.discordSettingsService.requireGuildAccess(req.user?.currentOrganizationId, guildId);
        return true;
    }
    catch (error) {
        if (error instanceof apiErrors_1.ForbiddenError) {
            res.status(error.statusCode).json({
                error: error.message,
                code: error.code,
            });
            return false;
        }
        logger_1.logger.error('Unexpected error during guild access check', {
            guildId,
            orgId: req.user?.currentOrganizationId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Authorization check failed' });
        return false;
    }
}
router.get('/discord/roles/:guildId/:userId', ...discordTenantAuth, async (req, res) => {
    const { guildId, userId } = req.params;
    const guildIdValidation = joiValidators_1.discordIdSchema.validate(guildId);
    const userIdValidation = joiValidators_1.discordIdSchema.validate(userId);
    if (guildIdValidation.error || userIdValidation.error) {
        res.status(400).json({ error: 'Invalid Discord ID format' });
        return;
    }
    if (!(await ensureGuildAccess(req, res, guildId))) {
        return;
    }
    try {
        const discordService = (0, DiscordService_1.getDiscordService)();
        const roles = await discordService.getUserRoles(guildId, userId);
        res.status(200).json(roles);
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch user roles', {
            guildId,
            userId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
});
router.post('/discord/roles/:guildId/:userId', ...discordTenantAuth, async (req, res) => {
    const { guildId, userId } = req.params;
    const { roleId = '' } = (req.body ?? {});
    const guildIdValidation = joiValidators_1.discordIdSchema.validate(guildId);
    const userIdValidation = joiValidators_1.discordIdSchema.validate(userId);
    const roleIdValidation = joiValidators_1.discordIdSchema.validate(roleId);
    if (guildIdValidation.error || userIdValidation.error || roleIdValidation.error) {
        res.status(400).json({ error: 'Invalid Discord ID format' });
        return;
    }
    if (!(await ensureGuildAccess(req, res, guildId))) {
        return;
    }
    try {
        const discordService = (0, DiscordService_1.getDiscordService)();
        const message = await discordService.assignRole(guildId, userId, roleId);
        res.status(200).json({ message });
    }
    catch (error) {
        logger_1.logger.error('Failed to assign Discord role', {
            guildId,
            userId,
            roleId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to assign role' });
    }
});
router.delete('/discord/roles/:guildId/:userId', ...discordTenantAuth, async (req, res) => {
    const { guildId, userId } = req.params;
    const { roleId = '' } = (req.body ?? {});
    const guildIdValidation = joiValidators_1.discordIdSchema.validate(guildId);
    const userIdValidation = joiValidators_1.discordIdSchema.validate(userId);
    const roleIdValidation = joiValidators_1.discordIdSchema.validate(roleId);
    if (guildIdValidation.error || userIdValidation.error || roleIdValidation.error) {
        res.status(400).json({ error: 'Invalid Discord ID format' });
        return;
    }
    if (!(await ensureGuildAccess(req, res, guildId))) {
        return;
    }
    try {
        const discordService = (0, DiscordService_1.getDiscordService)();
        const message = await discordService.removeRole(guildId, userId, roleId);
        res.status(200).json({ message });
    }
    catch (error) {
        logger_1.logger.error('Failed to remove Discord role', {
            guildId,
            userId,
            roleId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to remove role' });
    }
});
router.get('/discord/guild/:guildId/roles', ...discordTenantAuth, async (req, res) => {
    const { guildId } = req.params;
    const guildIdValidation = joiValidators_1.discordIdSchema.validate(guildId);
    if (guildIdValidation.error) {
        res.status(400).json({ error: 'Invalid guild ID format' });
        return;
    }
    if (!(await ensureGuildAccess(req, res, guildId))) {
        return;
    }
    try {
        const discordService = (0, DiscordService_1.getDiscordService)();
        const roles = await discordService.getGuildRoles(guildId);
        res.json({ success: true, data: roles });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('Failed to fetch guild roles', { guildId, error: message });
        res.status(500).json({ error: 'Failed to fetch guild roles' });
    }
});
router.get('/discord/guild/:guildId/channels', ...discordTenantAuth, async (req, res) => {
    const { guildId } = req.params;
    const guildIdValidation = joiValidators_1.discordIdSchema.validate(guildId);
    if (guildIdValidation.error) {
        res.status(400).json({ error: 'Invalid guild ID format' });
        return;
    }
    if (!(await ensureGuildAccess(req, res, guildId))) {
        return;
    }
    try {
        const discordService = (0, DiscordService_1.getDiscordService)();
        const channels = await discordService.getGuildChannels(guildId);
        res.json({ success: true, data: channels });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('Failed to fetch guild channels', { guildId, error: message });
        res.status(500).json({ error: 'Failed to fetch guild channels' });
    }
});
//# sourceMappingURL=discordRoutes.js.map