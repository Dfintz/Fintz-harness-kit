"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISCORD_GUEST_NAMESPACE = void 0;
exports.resolveGuestContext = resolveGuestContext;
exports.checkGuestVisibility = checkGuestVisibility;
const uuid_1 = require("uuid");
const Activity_1 = require("../../models/Activity");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const logger_1 = require("../../utils/logger");
exports.DISCORD_GUEST_NAMESPACE = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const GUEST_ALLOWED_VISIBILITIES = new Set([
    Activity_1.ActivityVisibility.PUBLIC,
    Activity_1.ActivityVisibility.LISTED,
]);
const ROLE_GRANTABLE_VISIBILITIES = new Set([
    Activity_1.ActivityVisibility.ORGANIZATION,
    Activity_1.ActivityVisibility.CROSS_ORG,
    Activity_1.ActivityVisibility.ALLIANCE,
]);
async function resolveGuestContext(interaction) {
    try {
        if (!interaction.guildId) {
            return null;
        }
        const guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
        const orgId = await guildOrgService.resolveOrganization(interaction.guildId);
        if (!orgId) {
            return null;
        }
        const settings = await DiscordSettingsService_1.discordSettingsService.getSettings(orgId, interaction.guildId);
        const advanced = settings?.advancedEventSettings;
        if (!advanced?.allowDiscordGuests) {
            return null;
        }
        return {
            guestId: (0, uuid_1.v5)(interaction.user.id, exports.DISCORD_GUEST_NAMESPACE),
            guestMemberRoleIds: advanced.guestMemberRoleIds ?? [],
            advancedEventSettings: advanced,
        };
    }
    catch (err) {
        logger_1.logger.warn('Failed to resolve guest context', {
            discordId: interaction.user.id,
            guildId: interaction.guildId,
            error: err instanceof Error ? err.message : String(err),
        });
        return null;
    }
}
function checkGuestVisibility(interaction, activity, guestMemberRoleIds) {
    if (GUEST_ALLOWED_VISIBILITIES.has(activity.visibility)) {
        return { allowed: true };
    }
    if (activity.visibility === Activity_1.ActivityVisibility.PRIVATE) {
        return {
            allowed: false,
            reason: '❌ This is an invitation-only event. Please link your account to receive an invitation.',
        };
    }
    if (!ROLE_GRANTABLE_VISIBILITIES.has(activity.visibility)) {
        return { allowed: false, reason: '❌ This event is restricted. Please link your account.' };
    }
    if (!guestMemberRoleIds.length || !interaction.member) {
        return {
            allowed: false,
            reason: '❌ This event is restricted to organization members. Please link your account or ask an admin to assign you the member role.',
        };
    }
    const memberRoles = new Set(Array.isArray(interaction.member.roles)
        ? interaction.member.roles
        : [...interaction.member.roles.cache.keys()]);
    if (guestMemberRoleIds.some(roleId => memberRoles.has(roleId))) {
        return { allowed: true };
    }
    return {
        allowed: false,
        reason: '❌ This event is restricted to organization members. Please link your account or ask an admin to assign you the member role.',
    };
}
//# sourceMappingURL=eventButtons.guestContext.js.map