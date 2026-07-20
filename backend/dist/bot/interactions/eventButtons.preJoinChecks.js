"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preJoinChecks = preJoinChecks;
const uuid_1 = require("uuid");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const eventButtons_guestContext_1 = require("./eventButtons.guestContext");
const eventButtons_services_1 = require("./eventButtons.services");
async function preJoinChecks(interaction, activityId, userId, isDiscordGuest, guestContext) {
    if (isDiscordGuest) {
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (activity) {
            const visCheck = (0, eventButtons_guestContext_1.checkGuestVisibility)(interaction, activity, guestContext?.guestMemberRoleIds ?? []);
            if (!visCheck.allowed) {
                return visCheck;
            }
        }
    }
    if (!isDiscordGuest) {
        const guestUuid = (0, uuid_1.v5)(interaction.user.id, eventButtons_guestContext_1.DISCORD_GUEST_NAMESPACE);
        if (guestUuid !== userId) {
            await (0, eventButtons_services_1.getParticipantService)().removeParticipantFromTable(activityId, guestUuid);
        }
    }
    return checkAdvancedEventSettings(interaction, activityId, userId, guestContext?.advancedEventSettings);
}
async function checkAdvancedEventSettings(interaction, activityId, userId, preloadedSettings) {
    try {
        let advanced = preloadedSettings;
        if (!advanced) {
            if (!interaction.guildId) {
                return { allowed: true };
            }
            const guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
            const orgId = await guildOrgService.resolveOrganization(interaction.guildId);
            if (!orgId) {
                return { allowed: true };
            }
            const settings = await DiscordSettingsService_1.discordSettingsService.getSettings(orgId, interaction.guildId);
            advanced = settings?.advancedEventSettings ?? undefined;
        }
        if (!advanced) {
            return { allowed: true };
        }
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            return { allowed: true };
        }
        if (advanced.signupDeadlineHours && activity.scheduledStartDate) {
            const deadline = new Date(activity.scheduledStartDate);
            deadline.setHours(deadline.getHours() - advanced.signupDeadlineHours);
            if (new Date() > deadline) {
                return {
                    allowed: false,
                    reason: `⏰ Signups for this event closed ${advanced.signupDeadlineHours} hour(s) before the start time.`,
                };
            }
        }
        if (advanced.lockWhenFull && activity.maxParticipants) {
            const participants = await (0, eventButtons_services_1.getParticipantService)().getParticipants(activityId);
            const accepted = participants.filter(p => p.status === 'accepted').length;
            if (accepted >= activity.maxParticipants) {
                const alreadyIn = participants.some(p => p.userId === userId && p.status === 'accepted');
                if (!alreadyIn) {
                    return {
                        allowed: false,
                        reason: '🔒 This event is full and locked. Try joining the waitlist with `/events waitlist`.',
                    };
                }
            }
        }
        if (advanced.preventDuplicateRsvp) {
        }
        return { allowed: true };
    }
    catch (err) {
        logger_1.logger.warn('Failed to check advanced event settings', { error: (0, errorHandler_1.getErrorMessage)(err) });
        return { allowed: true };
    }
}
//# sourceMappingURL=eventButtons.preJoinChecks.js.map