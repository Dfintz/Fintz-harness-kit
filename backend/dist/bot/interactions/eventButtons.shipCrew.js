"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRemoveShip = handleRemoveShip;
exports.handleRemoveShipSelectMenu = handleRemoveShipSelectMenu;
exports.handleJoinCrew = handleJoinCrew;
exports.handleCrewSelectMenu = handleCrewSelectMenu;
const discord_js_1 = require("discord.js");
const Activity_1 = require("../../models/Activity");
const auditLogger_1 = require("../../utils/auditLogger");
const errorHandler_1 = require("../../utils/errorHandler");
const eventButtons_crewSelect_1 = require("./eventButtons.crewSelect");
const eventButtons_identity_1 = require("./eventButtons.identity");
const eventButtons_messages_1 = require("./eventButtons.messages");
const eventButtons_refresh_1 = require("./eventButtons.refresh");
const eventButtons_security_1 = require("./eventButtons.security");
const eventButtons_services_1 = require("./eventButtons.services");
const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';
async function handleRemoveShip(interaction, activityId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const userId = await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id);
        if (!userId) {
            await interaction.editReply({
                content: '❌ Please link your Discord account on the web app first, then try again.',
            });
            return;
        }
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
            return;
        }
        const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
        const ownedShips = allShips.filter(ship => ship.ownerId === userId || ship.contributedByUserId === userId);
        if (ownedShips.length === 0) {
            await interaction.editReply({
                content: '⚠️ You have not brought any ships to this event yet.',
            });
            return;
        }
        const options = ownedShips.slice(0, 25).map((ship, index) => {
            const shipIdentifier = (0, eventButtons_crewSelect_1.getCrewShipIdentifier)(ship) ?? `${ship.shipType}::${ship.shipName ?? ''}`;
            const crewMembers = ship.crewMembers ?? ship.crew ?? [];
            const crewAssigned = ship.crewAssigned ?? ship.currentCrew ?? crewMembers.length;
            const crewCapacity = ship.crewCapacity ?? ship.maxCrew ?? crewAssigned;
            const shipLabel = ship.shipName?.trim()
                ? `${ship.shipName} (${ship.shipType})`
                : ship.shipType;
            const loanerTag = ship.isLoaner ? ' • loaner' : '';
            return {
                label: (0, eventButtons_security_1.truncate)(shipLabel || 'Unknown Ship', 100),
                description: (0, eventButtons_security_1.truncate)(`Crew ${crewAssigned}/${crewCapacity}${loanerTag}`, 100),
                value: (0, eventButtons_crewSelect_1.buildCrewSelectValue)(shipIdentifier, index),
                emoji: ship.isLoaner ? '🏷️' : '🚀',
            };
        });
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`event_removeshipselect_${activityId}`)
            .setPlaceholder('Select a ship to remove…')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options);
        const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        const overflowNote = ownedShips.length > 25 ? `\nShowing the first 25 of ${ownedShips.length} ships.` : '';
        await interaction.editReply({
            content: `🗑️ **Select a ship to remove from this event:**${overflowNote}`,
            components: [row],
        });
    }
    catch (error) {
        await interaction.editReply({
            content: (0, eventButtons_messages_1.getUserFriendlyError)((0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))),
        });
    }
}
async function handleRemoveShipSelectMenu(interaction, activityId) {
    await interaction.deferUpdate();
    const selection = (0, eventButtons_crewSelect_1.parseCrewSelectValue)(interaction.values[0]);
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
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            await interaction.followUp({
                content: MSG_ACTIVITY_NOT_FOUND,
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
        const ownedShips = allShips.filter(ship => ship.ownerId === userId || ship.contributedByUserId === userId);
        const selectedShip = ownedShips.find((ship, index) => {
            const shipIdentifier = (0, eventButtons_crewSelect_1.getCrewShipIdentifier)(ship) ?? `${ship.shipType}::${ship.shipName ?? ''}`;
            if (selection.shipIndex !== undefined && selection.shipIndex === index) {
                return shipIdentifier === selection.shipIdentifier;
            }
            return shipIdentifier === selection.shipIdentifier;
        }) ??
            (selection.shipIndex !== undefined && selection.shipIndex >= 0
                ? ownedShips[selection.shipIndex]
                : undefined);
        if (!selectedShip) {
            await interaction.followUp({
                content: '⚠️ Selected ship is no longer available. Click **Remove Ship** and try again.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const shipLabel = (0, eventButtons_security_1.sanitizeDiscordInput)(selectedShip.shipName ?? selectedShip.shipType);
        const hadCrew = (selectedShip.crewMembers ?? selectedShip.crew ?? []).length > 0;
        await (0, eventButtons_services_1.getActivityService)().removeOwnedShip(activityId, userId, selection.shipIdentifier, selection.shipIndex);
        await interaction.followUp({
            content: hadCrew
                ? `🗑️ Removed **${shipLabel}** from this event. Crew assignments on that ship were cleared.`
                : `🗑️ Removed **${shipLabel}** from this event.`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        await (0, eventButtons_refresh_1.refreshEventEmbedFromChannel)(interaction, activityId);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId,
            username: userName,
            resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
            action: 'EVENT_SHIP_REMOVED',
            message: `Removed ship ${shipLabel} from event ${activityId}`,
            metadata: { activityId, shipIdentifier: selection.shipIdentifier },
        });
    }
    catch (error) {
        await interaction.followUp({
            content: (0, eventButtons_messages_1.getUserFriendlyError)((0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))),
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
async function handleJoinCrew(interaction, activityId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
            return;
        }
        const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
        const openShips = allShips.filter(s => (s.currentCrew ?? s.crewAssigned ?? 0) < (s.maxCrew ?? s.crewCapacity ?? 0));
        const selectableShips = openShips.filter(ship => (0, eventButtons_crewSelect_1.getCrewShipIdentifier)(ship) !== null);
        if (selectableShips.length === 0) {
            await interaction.editReply({
                content: '⚠️ No ships with open crew positions. Ask someone to **Bring Ship** first!',
            });
            return;
        }
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`event_crewselect_${activityId}`)
            .setPlaceholder('Select a ship to join as crew…')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(selectableShips.slice(0, 25).map((ship, index) => {
            const current = ship.currentCrew ?? ship.crewAssigned ?? 0;
            const max = ship.maxCrew ?? ship.crewCapacity ?? 0;
            const name = ship.shipName?.trim();
            const type = ship.shipType ?? 'Unknown';
            const label = name ? `${name} (${type})` : type;
            const identifier = (0, eventButtons_crewSelect_1.getCrewShipIdentifier)(ship) ?? `unknown-${index}`;
            return {
                label: (label ?? 'Unknown Ship').slice(0, 100),
                description: `Owner: ${ship.ownerName ?? ship.captainName ?? 'Unknown'} — ${current}/${max} crew`,
                value: (0, eventButtons_crewSelect_1.buildCrewSelectValue)(identifier, index),
            };
        }));
        const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        await interaction.editReply({
            content: '🚀 **Select a ship to join as crew:**',
            components: [row],
        });
    }
    catch (error) {
        await interaction.editReply({
            content: `❌ Error: ${(0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))}`,
        });
    }
}
async function handleCrewSelectMenu(interaction, activityId) {
    await interaction.deferUpdate();
    const selection = (0, eventButtons_crewSelect_1.parseCrewSelectValue)(interaction.values[0]);
    const selectedIdentifier = selection.shipIdentifier;
    const selectedIndex = selection.shipIndex;
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
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            await interaction.followUp({
                content: MSG_ACTIVITY_NOT_FOUND,
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const isParticipant = await (0, eventButtons_services_1.getParticipantService)().isParticipant(activityId, userId);
        if (!isParticipant) {
            await (0, eventButtons_services_1.getActivityService)().joinActivity(activityId, {
                userId,
                userName,
                role: Activity_1.ParticipantRole.MEMBER,
            });
        }
        const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
        const openShips = allShips.filter(ship => (ship.currentCrew ?? ship.crewAssigned ?? 0) < (ship.maxCrew ?? ship.crewCapacity ?? 0));
        const selectableShips = openShips.filter(ship => (0, eventButtons_crewSelect_1.getCrewShipIdentifier)(ship) !== null);
        const ship = selectableShips.find(candidate => (0, eventButtons_crewSelect_1.getCrewShipIdentifier)(candidate) === selectedIdentifier ||
            candidate.id === selectedIdentifier ||
            candidate.shipId === selectedIdentifier ||
            candidate.ownerId === selectedIdentifier) ??
            (selectedIndex !== undefined && selectedIndex >= 0
                ? selectableShips.slice(0, 25)[selectedIndex]
                : undefined);
        const shipIdentifier = ship ? (0, eventButtons_crewSelect_1.getCrewShipIdentifier)(ship) : null;
        if (!ship || !shipIdentifier) {
            await interaction.followUp({
                content: '⚠️ Selected ship is no longer available. Click **Join Crew** and try again.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const existingPositions = (ship?.crew ?? ship?.crewMembers ?? []).map(c => c.position);
        const commonPositions = [
            'Pilot',
            'Co-pilot',
            'Gunner',
            'Engineer',
            'Navigator',
            'Cargo',
            'Medical',
        ];
        const suggestedCommonPosition = commonPositions.find(pos => !existingPositions.includes(pos));
        const suggestedPosition = suggestedCommonPosition ?? `Crew Member ${existingPositions.length + 1}`;
        await (0, eventButtons_services_1.getActivityService)().joinShipAsCrew(activityId, userId, userName, shipIdentifier, suggestedPosition);
        await interaction.followUp({
            content: `⚙️ Joined **${ship?.shipName ?? ship?.shipType ?? 'ship'}** as **${suggestedPosition}**!`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        await (0, eventButtons_refresh_1.refreshEventEmbedFromChannel)(interaction, activityId);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId,
            username: userName,
            resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
            action: 'EVENT_CREW_JOINED',
            message: `Joined ship ${shipIdentifier} crew in event ${activityId} as ${suggestedPosition}`,
            metadata: { activityId, shipOwnerId: shipIdentifier, position: suggestedPosition },
        });
    }
    catch (error) {
        const errorMsg = (0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error));
        if (errorMsg.includes('already crew')) {
            await interaction.followUp({
                content: '⚠️ You are already crew on this ship.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        if (errorMsg.includes('crew is full')) {
            await interaction.followUp({
                content: '❌ Ship crew is full. Try another ship!',
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
//# sourceMappingURL=eventButtons.shipCrew.js.map