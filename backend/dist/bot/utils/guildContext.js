"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveGuildContext = resolveGuildContext;
exports.resolveOrgIdForGuild = resolveOrgIdForGuild;
const discord_js_1 = require("discord.js");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const FederationRoleSyncService_1 = require("../../services/federation/FederationRoleSyncService");
const logger_1 = require("../../utils/logger");
const commandErrorHandler_1 = require("./commandErrorHandler");
async function resolveGuildContext(interaction, explicitOrgId) {
    if (!interaction.guildId) {
        await (0, commandErrorHandler_1.safeReply)(interaction, {
            content: '❌ This command can only be used in a server, not in DMs.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return null;
    }
    if (explicitOrgId) {
        return { guildId: interaction.guildId, organizationId: explicitOrgId };
    }
    const guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
    const orgId = await guildOrgService.resolveOrganization(interaction.guildId);
    if (orgId) {
        return { guildId: interaction.guildId, organizationId: orgId };
    }
    const federation = await FederationRoleSyncService_1.FederationRoleSyncService.getInstance().findFederationByGuildId(interaction.guildId);
    if (federation?.founderOrgId) {
        logger_1.logger.debug(`Guild ${interaction.guildId} resolved via federation fallback: federation=${federation.id}, founderOrg=${federation.founderOrgId}`);
        return {
            guildId: interaction.guildId,
            organizationId: federation.founderOrgId,
            federationId: federation.id,
        };
    }
    await (0, commandErrorHandler_1.safeReply)(interaction, {
        content: '❌ This server is not linked to an organization or federation.\n' +
            '💡 Use `/guild setup` or `/federation setup` to link this server first.',
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
    return null;
}
async function resolveOrgIdForGuild(guildId) {
    const guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
    const orgId = await guildOrgService.resolveOrganization(guildId);
    if (orgId) {
        return orgId;
    }
    const federation = await FederationRoleSyncService_1.FederationRoleSyncService.getInstance().findFederationByGuildId(guildId);
    if (federation?.founderOrgId) {
        logger_1.logger.debug(`Guild ${guildId} resolved via federation fallback (non-interactive): federation=${federation.id}, founderOrg=${federation.founderOrgId}`);
        return federation.founderOrgId;
    }
    return null;
}
//# sourceMappingURL=guildContext.js.map