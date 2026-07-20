"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleManageSlots = handleManageSlots;
exports.handleManageSlotsShipSelect = handleManageSlotsShipSelect;
exports.handleManageSlotsModal = handleManageSlotsModal;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const auditLogger_1 = require("../../utils/auditLogger");
const errorHandler_1 = require("../../utils/errorHandler");
const modalLabelInput_1 = require("../utils/modalLabelInput");
const eventButtons_crewSelect_1 = require("./eventButtons.crewSelect");
const eventButtons_identity_1 = require("./eventButtons.identity");
const eventButtons_refresh_1 = require("./eventButtons.refresh");
const eventButtons_security_1 = require("./eventButtons.security");
const eventButtons_services_1 = require("./eventButtons.services");
const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';
function parseSlotSpec(raw, allowedRoles) {
    const trimmed = raw.trim();
    if (!trimmed) {
        return { slots: [] };
    }
    const slots = [];
    const seen = new Set();
    for (const part of trimmed.split(',')) {
        const piece = part.trim();
        if (!piece) {
            continue;
        }
        const match = /^([a-zA-Z]+)\s*[:=]\s*(\d+)$/.exec(piece);
        if (!match) {
            return { slots: [], error: `Couldn't parse "${piece}". Use \`role:count\` (e.g. gunner:2).` };
        }
        const role = match[1].toLowerCase();
        const capacity = Number.parseInt(match[2], 10);
        if (!allowedRoles.includes(role)) {
            return {
                slots: [],
                error: `Unknown role "${role}". Allowed: ${allowedRoles.join(', ')}.`,
            };
        }
        if (seen.has(role)) {
            return { slots: [], error: `Duplicate role "${role}".` };
        }
        seen.add(role);
        slots.push({ role, capacity });
    }
    return { slots };
}
async function handleManageSlots(interaction, activityId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
            return;
        }
        const actorUserId = (await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id)) ?? interaction.user.id;
        const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
        const shipsWithIdentifier = allShips.filter(ship => (0, eventButtons_crewSelect_1.getCrewShipIdentifier)(ship) !== null);
        if (shipsWithIdentifier.length === 0) {
            await interaction.editReply({
                content: '⚠️ No ships in this event yet. Add a ship first with **Bring Ship** or **Bring Fleet**.',
            });
            return;
        }
        const capabilities = await (0, eventButtons_services_1.getActivityService)().getShipManagementCapabilities(activityId, actorUserId);
        const manageableIds = new Set(capabilities.manageableShipIdentifiers);
        const selectableShips = shipsWithIdentifier.filter(ship => {
            const identifier = (0, eventButtons_crewSelect_1.getCrewShipIdentifier)(ship);
            return identifier ? manageableIds.has(identifier) : false;
        });
        if (selectableShips.length === 0) {
            await interaction.editReply({
                content: '⚠️ You can view ships in this event, but cannot manage their slots. Only the ship owner, contributor, event organiser, or a leader can manage slots.',
            });
            return;
        }
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`event_manageslotsselect_${activityId}`)
            .setPlaceholder('Select a ship to edit slots…')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(selectableShips.slice(0, 25).map((ship, index) => {
            const name = ship.shipName?.trim();
            const type = ship.shipType ?? 'Unknown';
            const label = name ? `${name} (${type})` : type;
            const identifier = (0, eventButtons_crewSelect_1.getCrewShipIdentifier)(ship) ?? `unknown-${index}`;
            return {
                label: (label || 'Unknown Ship').slice(0, 100),
                description: `Crew ${ship.crewAssigned ?? 0}/${ship.crewCapacity ?? 0}`.slice(0, 100),
                value: (0, eventButtons_crewSelect_1.buildCrewSelectValue)(identifier, index),
            };
        }));
        const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        await interaction.editReply({
            content: '🪑 **Select a ship to edit its crew & passenger slots:**',
            components: [row],
        });
    }
    catch (error) {
        await interaction.editReply({
            content: `❌ Error: ${(0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))}`,
        });
    }
}
async function handleManageSlotsShipSelect(interaction, activityId) {
    const selection = (0, eventButtons_crewSelect_1.parseCrewSelectValue)(interaction.values[0]);
    const shipIdentifier = selection.shipIdentifier;
    try {
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            await interaction.reply({ content: MSG_ACTIVITY_NOT_FOUND, flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
        const ship = allShips.find(s => (0, eventButtons_crewSelect_1.getCrewShipIdentifier)(s) === shipIdentifier ||
            s.id === shipIdentifier ||
            s.shipId === shipIdentifier ||
            s.ownerId === shipIdentifier);
        if (!ship) {
            await interaction.reply({
                content: '⚠️ Ship no longer available. Click **Manage Slots** and try again.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const actorUserId = (await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id)) ?? interaction.user.id;
        const capabilities = await (0, eventButtons_services_1.getActivityService)().getShipManagementCapabilities(activityId, actorUserId);
        if (!capabilities.manageableShipIdentifiers.includes(shipIdentifier)) {
            await interaction.reply({
                content: '⚠️ You cannot manage this ship. Only the ship owner, contributor, event organiser, or a leader can edit its slots.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const crewSpec = (ship.crewSlots ?? []).map(slot => `${slot.role}:${slot.capacity}`).join(', ');
        const passengerSpec = (ship.passengers ?? [])
            .map(slot => `${slot.role}:${slot.capacity}`)
            .join(', ');
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId(`event_manageslots_modal_${activityId}__${encodeURIComponent(shipIdentifier)}`)
            .setTitle('Edit Ship Slots');
        modal.addLabelComponents((0, modalLabelInput_1.createModalLabelInput)({
            customId: 'slots_crew',
            label: 'Crew slots (role:count)',
            placeholder: 'pilot:1, gunner:2, engineer:1',
            value: crewSpec,
            style: discord_js_1.TextInputStyle.Paragraph,
            required: false,
            maxLength: 200,
        }), (0, modalLabelInput_1.createModalLabelInput)({
            customId: 'slots_passenger',
            label: 'Passenger slots (role:count)',
            placeholder: 'marine:4, medic:1',
            value: passengerSpec,
            style: discord_js_1.TextInputStyle.Paragraph,
            required: false,
            maxLength: 200,
        }));
        await interaction.showModal(modal);
    }
    catch (error) {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `❌ Error: ${(0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))}`,
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    }
}
async function handleManageSlotsModal(interaction, activityId, shipIdentifier) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const userId = await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id);
    if (!userId) {
        await interaction.editReply({
            content: '❌ Please link your Discord account on the web app first, then try again.',
        });
        return;
    }
    const crewRaw = interaction.fields.getTextInputValue('slots_crew');
    const passengerRaw = interaction.fields.getTextInputValue('slots_passenger');
    const crewParsed = parseSlotSpec(crewRaw, shared_types_1.ACTIVITY_CREW_POSITIONS);
    if (crewParsed.error) {
        await interaction.editReply({ content: `❌ Crew slots: ${crewParsed.error}` });
        return;
    }
    const passengerParsed = parseSlotSpec(passengerRaw, shared_types_1.ACTIVITY_PASSENGER_ROLES);
    if (passengerParsed.error) {
        await interaction.editReply({ content: `❌ Passenger slots: ${passengerParsed.error}` });
        return;
    }
    try {
        if (crewParsed.slots.length > 0) {
            await (0, eventButtons_services_1.getActivityService)().setCrewSlots(activityId, userId, shipIdentifier, crewParsed.slots);
        }
        await (0, eventButtons_services_1.getActivityService)().setPassengerSlots(activityId, userId, shipIdentifier, passengerParsed.slots);
        await interaction.editReply({ content: '🪑 Slots updated.' });
        await (0, eventButtons_refresh_1.refreshEventEmbedFromChannel)(interaction, activityId);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId,
            username: interaction.user.username,
            resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
            action: 'EVENT_SLOTS_UPDATED',
            message: `Updated crew/passenger slots for ship ${shipIdentifier} in event ${activityId}`,
            metadata: {
                activityId,
                shipIdentifier,
                crewSlots: crewParsed.slots.length,
                passengerSlots: passengerParsed.slots.length,
            },
        });
    }
    catch (error) {
        await interaction.editReply({
            content: `❌ ${(0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))}`,
        });
    }
}
//# sourceMappingURL=eventButtons.manageSlots.js.map