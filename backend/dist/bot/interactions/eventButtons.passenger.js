"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleJoinPassenger = handleJoinPassenger;
exports.handlePassengerSelectMenu = handlePassengerSelectMenu;
const discord_js_1 = require("discord.js");
const Activity_1 = require("../../models/Activity");
const auditLogger_1 = require("../../utils/auditLogger");
const errorHandler_1 = require("../../utils/errorHandler");
const eventButtons_identity_1 = require("./eventButtons.identity");
const eventButtons_refresh_1 = require("./eventButtons.refresh");
const eventButtons_security_1 = require("./eventButtons.security");
const eventButtons_services_1 = require("./eventButtons.services");
const PASSENGER_SELECT_PREFIX = 'psg:';
function buildPassengerSelectValue(shipIdentifier, role) {
    return `${PASSENGER_SELECT_PREFIX}${encodeURIComponent(shipIdentifier)}::${encodeURIComponent(role)}`;
}
function parsePassengerSelectValue(value) {
    if (!value.startsWith(PASSENGER_SELECT_PREFIX)) {
        return null;
    }
    const body = value.slice(PASSENGER_SELECT_PREFIX.length);
    const sep = body.indexOf('::');
    if (sep === -1) {
        return null;
    }
    try {
        return {
            shipIdentifier: decodeURIComponent(body.slice(0, sep)),
            role: decodeURIComponent(body.slice(sep + 2)),
        };
    }
    catch {
        return null;
    }
}
async function handleJoinPassenger(interaction, activityId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const slots = await (0, eventButtons_services_1.getActivityService)().getAvailablePassengerSlots(activityId);
        if (slots.length === 0) {
            await interaction.editReply({
                content: '⚠️ No open passenger seats. A ship owner or organizer can add passenger slots first.',
            });
            return;
        }
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`event_passengerselect_${activityId}`)
            .setPlaceholder('Select a passenger seat…')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(slots.slice(0, 25).map(slot => {
            const identifier = slot.shipId ?? `${slot.shipType}::${slot.shipName ?? ''}`;
            const shipLabel = slot.shipName?.trim() ?? slot.shipType;
            const roleLabel = slot.role.charAt(0).toUpperCase() + slot.role.slice(1);
            return {
                label: `${roleLabel} — ${shipLabel}`.slice(0, 100),
                description: `${slot.availableSlots} open · ${slot.ownerName}`.slice(0, 100),
                value: buildPassengerSelectValue(identifier, slot.role),
            };
        }));
        const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        await interaction.editReply({
            content: '🎖️ **Select a passenger seat to join:**',
            components: [row],
        });
    }
    catch (error) {
        await interaction.editReply({
            content: `❌ Error: ${(0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))}`,
        });
    }
}
async function handlePassengerSelectMenu(interaction, activityId) {
    await interaction.deferUpdate();
    const choice = parsePassengerSelectValue(interaction.values[0]);
    if (!choice) {
        await interaction.followUp({
            content: '⚠️ Selection is no longer valid. Click **Join as Passenger** and try again.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const userId = await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id);
    if (!userId) {
        await interaction.followUp({
            content: '❌ Please link your Discord account on the web app first, then try again.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const userName = interaction.user.username;
    try {
        const isParticipant = await (0, eventButtons_services_1.getParticipantService)().isParticipant(activityId, userId);
        if (!isParticipant) {
            await (0, eventButtons_services_1.getActivityService)().joinActivity(activityId, {
                userId,
                userName,
                role: Activity_1.ParticipantRole.MEMBER,
            });
        }
        await (0, eventButtons_services_1.getActivityService)().joinShipAsPassenger(activityId, userId, userName, choice.shipIdentifier, choice.role);
        const roleLabel = choice.role.charAt(0).toUpperCase() + choice.role.slice(1);
        await interaction.followUp({
            content: `🎖️ Joined as **${roleLabel}**!`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        await (0, eventButtons_refresh_1.refreshEventEmbedFromChannel)(interaction, activityId);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId,
            username: userName,
            resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
            action: 'EVENT_PASSENGER_JOINED',
            message: `Joined as ${choice.role} passenger in event ${activityId}`,
            metadata: { activityId, shipIdentifier: choice.shipIdentifier, role: choice.role },
        });
    }
    catch (error) {
        const errorMsg = (0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error));
        if (/already.*passenger/i.test(errorMsg)) {
            await interaction.followUp({
                content: '⚠️ You already hold a passenger seat in this event.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        if (/full/i.test(errorMsg)) {
            await interaction.followUp({
                content: '❌ That seat just filled up. Try another!',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.followUp({
            content: `❌ Error: ${errorMsg}`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
//# sourceMappingURL=eventButtons.passenger.js.map