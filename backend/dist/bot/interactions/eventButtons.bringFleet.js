"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBringFleet = handleBringFleet;
exports.handleBringFleetSelect = handleBringFleetSelect;
exports.handleFleetInviteResponse = handleFleetInviteResponse;
const discord_js_1 = require("discord.js");
const database_1 = require("../../config/database");
const Activity_1 = require("../../models/Activity");
const FleetShip_1 = require("../../models/FleetShip");
const auditLogger_1 = require("../../utils/auditLogger");
const errorHandler_1 = require("../../utils/errorHandler");
const customId_1 = require("../utils/customId");
const eventButtons_embedData_1 = require("./eventButtons.embedData");
const eventButtons_identity_1 = require("./eventButtons.identity");
const eventButtons_refresh_1 = require("./eventButtons.refresh");
const eventButtons_security_1 = require("./eventButtons.security");
const eventButtons_services_1 = require("./eventButtons.services");
async function getFleetShipCounts(fleetIds) {
    if (fleetIds.length === 0 || !database_1.AppDataSource.isInitialized) {
        return new Map();
    }
    const rows = await database_1.AppDataSource.getRepository(FleetShip_1.FleetShip)
        .createQueryBuilder('fs')
        .select('fs.fleetId', 'fleetId')
        .addSelect('COUNT(*)', 'count')
        .where('fs.fleetId IN (:...fleetIds)', { fleetIds })
        .groupBy('fs.fleetId')
        .getRawMany();
    return new Map(rows.map(r => [r.fleetId, Number(r.count)]));
}
function buildFleetInviteEmbed(activityTitle, fleetName, bringerName, ships) {
    const lines = [
        `**${bringerName}** brought the fleet **${fleetName}** to this event and invited you.`,
    ];
    if (ships.length > 0) {
        const shipList = ships.map(ship => ship.shipName).join(', ');
        lines.push('', `Your ship${ships.length > 1 ? 's' : ''} in this fleet: **${shipList}**`, 'Join and loan your ship, join without it, or decline.');
    }
    else {
        lines.push('', 'Will you join?');
    }
    return new discord_js_1.EmbedBuilder()
        .setColor(0x2b6cb0)
        .setTitle(`🛰️ Fleet event: ${activityTitle}`)
        .setDescription(lines.join('\n'));
}
function buildFleetInviteButtons(activityId, fleetId, hasShips) {
    const row = new discord_js_1.ActionRowBuilder();
    if (hasShips) {
        row.addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId((0, customId_1.buildCustomId)('event', 'fleetjoinship', activityId, fleetId))
            .setLabel('Join with ship')
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setEmoji('🚀'), new discord_js_1.ButtonBuilder()
            .setCustomId((0, customId_1.buildCustomId)('event', 'fleetjoinonly', activityId, fleetId))
            .setLabel('Join without ship')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('✅'));
    }
    else {
        row.addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId((0, customId_1.buildCustomId)('event', 'fleetjoinonly', activityId, fleetId))
            .setLabel('Join')
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setEmoji('✅'));
    }
    row.addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId((0, customId_1.buildCustomId)('event', 'fleetdecline', activityId, fleetId))
        .setLabel('Decline')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('❌'));
    return row;
}
async function handleBringFleet(interaction, activityId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const internalUserId = await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id);
        if (!internalUserId) {
            await interaction.editReply({
                content: '❌ Please link your Discord account on the web app first, then try again.',
            });
            return;
        }
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            await interaction.editReply({ content: '⚠️ Activity no longer exists.' });
            return;
        }
        if (!activity.organizationId) {
            await interaction.editReply({
                content: '⚠️ This event is not tied to an organization, so fleets cannot be brought.',
            });
            return;
        }
        const isCreator = activity.creatorId === internalUserId || activity.creatorId === interaction.user.id;
        const fleets = await (0, eventButtons_services_1.getFleetService)().getAllFleets(activity.organizationId);
        const ledFleets = fleets.filter(f => f.leaderId === internalUserId || f.secondInCommandId === internalUserId);
        const selectableFleets = isCreator ? fleets : ledFleets;
        if (selectableFleets.length === 0) {
            await interaction.editReply({
                content: isCreator
                    ? '⚠️ No fleets are available in this organization.'
                    : '⚠️ You don’t lead any fleets in this org. Only a fleet leader or the event organiser can bring a fleet.',
            });
            return;
        }
        const visibleFleets = selectableFleets.slice(0, 25);
        const shipCounts = await getFleetShipCounts(visibleFleets.map(f => f.id));
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`event_bringfleetselect_${activityId}`)
            .setPlaceholder('Select a fleet to bring…')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(visibleFleets.map(fleet => {
            const shipCount = shipCounts.get(fleet.id) ?? fleet.shipIds?.length ?? 0;
            return {
                label: (fleet.name || 'Unnamed fleet').slice(0, 100),
                description: `${shipCount} ship(s) · ${fleet.members?.length ?? 0} member(s)`.slice(0, 100),
                value: fleet.id,
            };
        }));
        const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        await interaction.editReply({
            content: isCreator
                ? '🛰️ **Select a fleet to bring.** As organiser, you can bring any org fleet.'
                : '🛰️ **Select a fleet to bring.** All its ships will be added and its members invited.',
            components: [row],
        });
    }
    catch (error) {
        await interaction.editReply({
            content: `❌ Error: ${(0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))}`,
        });
    }
}
async function handleBringFleetSelect(interaction, activityId) {
    await interaction.deferUpdate();
    const fleetId = interaction.values[0];
    const userId = await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id);
    if (!userId) {
        await interaction.followUp({
            content: '❌ Please link your Discord account on the web app first, then try again.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    try {
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            await interaction.followUp({
                content: '⚠️ Activity no longer exists.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const plan = await (0, eventButtons_services_1.getActivityService)().getFleetBringPlan(fleetId);
        const actorShipIds = (plan.memberShips.get(userId) ?? []).map(ship => ship.shipId);
        const upfrontShipIds = Array.from(new Set([...plan.orphanShipIds, ...actorShipIds]));
        if (upfrontShipIds.length > 0) {
            await (0, eventButtons_services_1.getActivityService)().bringFleetToActivity(activityId, userId, fleetId, upfrontShipIds);
        }
        const inviteResult = await (0, eventButtons_services_1.getActivityService)().inviteFleetMembers(activityId, userId, fleetId);
        const discordIdMap = await (0, eventButtons_embedData_1.resolveDiscordIdMap)(inviteResult.invited);
        let dmCount = 0;
        for (const memberId of inviteResult.invited) {
            const discordId = discordIdMap.get(memberId);
            if (!discordId) {
                continue;
            }
            try {
                const user = await interaction.client.users.fetch(discordId);
                const memberShips = plan.memberShips.get(memberId) ?? [];
                await user.send({
                    embeds: [
                        buildFleetInviteEmbed(activity.title, plan.fleetName, interaction.user.username, memberShips),
                    ],
                    components: [buildFleetInviteButtons(activityId, fleetId, memberShips.length > 0)],
                });
                dmCount++;
            }
            catch {
            }
        }
        const skippedNote = inviteResult.skipped.length > 0 ? ` (${inviteResult.skipped.length} already in)` : '';
        await interaction.followUp({
            content: `🛰️ Fleet **${plan.fleetName}** brought in. Added **${upfrontShipIds.length}** ship(s), ` +
                `invited **${inviteResult.invited.length}** member(s)${skippedNote}, and DM’d **${dmCount}** ` +
                `to bring their own ship.`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        await (0, eventButtons_refresh_1.refreshEventEmbedFromChannel)(interaction, activityId);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId,
            username: interaction.user.username,
            resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
            action: 'EVENT_FLEET_BROUGHT',
            message: `Brought fleet ${fleetId} to event ${activityId}; ships=${upfrontShipIds.length}; invited=${inviteResult.invited.length}; dmed=${dmCount}`,
            metadata: {
                activityId,
                fleetId,
                upfrontShips: upfrontShipIds.length,
                invited: inviteResult.invited.length,
                skipped: inviteResult.skipped.length,
                dmed: dmCount,
            },
        });
    }
    catch (error) {
        await interaction.followUp({
            content: `❌ Error: ${(0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))}`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
async function handleFleetInviteResponse(interaction, action, activityId, fleetId) {
    await interaction.deferUpdate();
    const memberId = await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id);
    if (!memberId) {
        await interaction.editReply({
            content: '❌ Please link your Discord account on the web app first, then try again.',
            embeds: [],
            components: [],
        });
        return;
    }
    try {
        if (action === 'decline') {
            await (0, eventButtons_services_1.getActivityService)().updateRSVPStatus(activityId, memberId, 'declined', Activity_1.ParticipantRole.ANY);
            await interaction.editReply({
                content: '❌ You declined the fleet event. No worries — maybe next time!',
                embeds: [],
                components: [],
            });
            return;
        }
        await (0, eventButtons_services_1.getActivityService)().updateRSVPStatus(activityId, memberId, 'accepted', Activity_1.ParticipantRole.MEMBER);
        let shipNote = '';
        if (action === 'joinship') {
            const { memberShips } = await (0, eventButtons_services_1.getActivityService)().getFleetBringPlan(fleetId);
            const ships = memberShips.get(memberId) ?? [];
            for (const ship of ships) {
                await (0, eventButtons_services_1.getParticipantService)().addShip(activityId, memberId, {
                    shipType: ship.shipName,
                    shipName: ship.shipName,
                    captainId: memberId,
                    captainName: interaction.user.username,
                    maxCrew: ship.maxCrew,
                });
            }
            if (ships.length > 0) {
                shipNote = `\n🚀 Loaned **${ships.map(ship => ship.shipName).join(', ')}** to the event.`;
            }
        }
        await interaction.editReply({
            content: `✅ You’re in!${shipNote}`,
            embeds: [],
            components: [],
        });
    }
    catch (error) {
        await interaction.editReply({
            content: `❌ ${(0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))}`,
            embeds: [],
            components: [],
        });
    }
}
//# sourceMappingURL=eventButtons.bringFleet.js.map