"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBringShip = handleBringShip;
exports.handleHangarShipSelect = handleHangarShipSelect;
exports.handleHangarPageSelect = handleHangarPageSelect;
exports.handleNestShipSelect = handleNestShipSelect;
exports.handleBringShipModal = handleBringShipModal;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const database_1 = require("../../config/database");
const Activity_1 = require("../../models/Activity");
const Ship_1 = require("../../models/Ship");
const UserShip_1 = require("../../models/UserShip");
const auditLogger_1 = require("../../utils/auditLogger");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const shipTaxonomy_1 = require("../constants/shipTaxonomy");
const eventButtons_hangarGroups_1 = require("./eventButtons.hangarGroups");
const eventButtons_hangarSuggestions_1 = require("./eventButtons.hangarSuggestions");
const eventButtons_identity_1 = require("./eventButtons.identity");
const eventButtons_refresh_1 = require("./eventButtons.refresh");
const eventButtons_requirements_1 = require("./eventButtons.requirements");
const eventButtons_security_1 = require("./eventButtons.security");
const eventButtons_services_1 = require("./eventButtons.services");
const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';
const ROLE_MAP = {
    Combat: 'combat',
    'Combat Support': 'combat',
    Logistics: 'cargo',
    Support: 'support',
    Industrial: 'mining',
    Bespoke: 'other',
};
const HANGAR_MANUAL_ENTRY = '__manual__';
async function handleBringShip(interaction, activityId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        const requirements = activity ? (0, eventButtons_requirements_1.parseRequiredShipTypes)(activity.requiredShipTypes) : [];
        if (requirements.length > 0 && activity) {
            const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
            if (allShips.length > 0) {
                (0, eventButtons_requirements_1.computeFilledCounts)(requirements, allShips);
            }
        }
        const internalUserId = await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id);
        if (!internalUserId) {
            await interaction.editReply({
                content: '🔗 **Link your account to use your hangar.**\nSign in to the web app with Discord to connect your hangar, then come back and click **Bring Ship** again.',
            });
            return;
        }
        const suggestions = await (0, eventButtons_hangarSuggestions_1.getHangarSuggestions)(internalUserId, requirements);
        if (suggestions.length > 0) {
            if (suggestions.length <= eventButtons_hangarGroups_1.MAX_HANGAR_OPTIONS) {
                const options = (0, eventButtons_hangarSuggestions_1.buildShipOptions)(suggestions);
                options.push({
                    label: 'Enter ship manually…',
                    description: 'Type in ship details directly',
                    value: HANGAR_MANUAL_ENTRY,
                    emoji: '✏️',
                });
                const selectMenu = new discord_js_1.StringSelectMenuBuilder()
                    .setCustomId(`event_hangarship_${activityId}`)
                    .setPlaceholder('Select a ship from your hangar…')
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(options);
                const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
                const matchCount = suggestions.filter(s => s.matchesRequirement).length;
                const hasMatches = requirements.length > 0 && matchCount > 0;
                const pluralShips = matchCount === 1 ? '' : 's';
                const header = hasMatches
                    ? `🚀 **${matchCount} ship${pluralShips} in your hangar match this event's requirements!**\nSelect one, or choose manual entry at the bottom.`
                    : '🚀 **Select a ship from your hangar, or enter one manually:**';
                await interaction.editReply({ content: header, components: [row] });
            }
            else {
                const groups = (0, eventButtons_hangarGroups_1.buildHangarGroups)(suggestions);
                const options = groups.slice(0, eventButtons_hangarGroups_1.MAX_HANGAR_OPTIONS).map(g => ({
                    label: g.label.slice(0, 100),
                    description: `${g.ships.length} ship${g.ships.length === 1 ? '' : 's'}`,
                    value: g.key,
                    emoji: g.emoji,
                }));
                options.push({
                    label: 'Enter ship manually…',
                    description: 'Type in ship details directly',
                    value: HANGAR_MANUAL_ENTRY,
                    emoji: '✏️',
                });
                const selectMenu = new discord_js_1.StringSelectMenuBuilder()
                    .setCustomId(`event_hangarpage_${activityId}`)
                    .setPlaceholder('Pick a group to browse your ships…')
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(options);
                const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
                await interaction.editReply({
                    content: `🚀 **You have ${suggestions.length} ships!** Pick a group to narrow down:`,
                    components: [row],
                });
            }
            return;
        }
    }
    catch (error) {
        logger_1.logger.warn('Failed to load hangar suggestions', {
            userId: interaction.user.id,
            activityId,
            error: (0, errorHandler_1.getErrorMessage)(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        try {
            const fallbackMenu = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(`event_hangarship_${activityId}`)
                .setPlaceholder('Select an option…')
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions({
                label: 'Enter ship manually…',
                description: 'Type in ship details directly',
                value: HANGAR_MANUAL_ENTRY,
                emoji: '✏️',
            });
            const row = new discord_js_1.ActionRowBuilder().addComponents(fallbackMenu);
            await interaction.editReply({
                content: '❌ **Could not load your hangar.** You can still enter your ship manually:',
                components: [row],
            });
            return;
        }
        catch {
        }
    }
    await interaction.editReply({
        content: '⚠️ **No ships found in your hangar.**\nAdd ships to your hangar on the web app first, then come back and click **Bring Ship** again.',
    });
}
async function handleHangarShipSelect(interaction, activityId) {
    const selected = interaction.values[0];
    if (selected === HANGAR_MANUAL_ENTRY) {
        try {
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`event_bringship_modal_${activityId}`)
                .setTitle('Register Your Ship');
            const shipNameInput = new discord_js_1.TextInputBuilder({
                custom_id: 'ship_name',
                placeholder: 'e.g. "The Stargazer"',
                style: discord_js_1.TextInputStyle.Short,
                required: true,
                max_length: 50,
            });
            const shipTypeInput = new discord_js_1.TextInputBuilder({
                custom_id: 'ship_type',
                placeholder: 'e.g. "Cutlass Black"',
                style: discord_js_1.TextInputStyle.Short,
                required: true,
                max_length: 60,
            });
            const shipRoleInput = new discord_js_1.TextInputBuilder({
                custom_id: 'ship_role',
                placeholder: 'e.g. "Combat"',
                style: discord_js_1.TextInputStyle.Short,
                required: true,
                max_length: 30,
            });
            const maxCrewInput = new discord_js_1.TextInputBuilder({
                custom_id: 'max_crew',
                placeholder: 'e.g. 6',
                style: discord_js_1.TextInputStyle.Short,
                required: true,
                max_length: 3,
            });
            modal.addLabelComponents(new discord_js_1.LabelBuilder()
                .setLabel('Ship Name (your custom name)')
                .setTextInputComponent(shipNameInput), new discord_js_1.LabelBuilder()
                .setLabel('Ship Type (e.g. Cutlass Black)')
                .setTextInputComponent(shipTypeInput), new discord_js_1.LabelBuilder().setLabel('Ship Role (Combat)').setTextInputComponent(shipRoleInput), new discord_js_1.LabelBuilder()
                .setLabel('Max Crew Capacity (including you)')
                .setTextInputComponent(maxCrewInput));
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
        return;
    }
    try {
        if (!database_1.AppDataSource.isInitialized) {
            await interaction.reply({
                content: '⚠️ Database not ready. Try again shortly.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const internalUserId = await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id);
        if (!internalUserId) {
            await interaction.reply({
                content: '🔗 Link your account on the web app first to use ships from your hangar.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const userShip = await database_1.AppDataSource.getRepository(UserShip_1.UserShip).findOne({
            where: { id: selected, userId: internalUserId, isActive: true },
        });
        if (!userShip) {
            await interaction.reply({
                content: '⚠️ Ship not found in your hangar.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        if ((0, eventButtons_hangarSuggestions_1.isBundledShipName)(userShip.shipName)) {
            await interaction.reply({
                content: '⚠️ This bundled ship variant is not selectable. Choose a different ship or enter one manually.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const catalogue = userShip.shipId
            ? ((await database_1.AppDataSource.getRepository(Ship_1.Ship).findOne({ where: { id: userShip.shipId } })) ??
                undefined)
            : undefined;
        const { roleCategory, shipType } = (0, eventButtons_hangarSuggestions_1.resolveShipTaxonomy)(catalogue);
        const maxCrew = catalogue?.maxCrew ?? catalogue?.crew ?? 1;
        const displayName = userShip.customName?.trim() || userShip.shipName?.trim() || 'Unknown Ship';
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId(`event_bringship_modal_${activityId}`)
            .setTitle('Register Your Ship');
        const shipNameInput = new discord_js_1.TextInputBuilder({
            custom_id: 'ship_name',
            value: displayName,
            style: discord_js_1.TextInputStyle.Short,
            required: true,
            max_length: 50,
        });
        const shipTypeInput = new discord_js_1.TextInputBuilder({
            custom_id: 'ship_type',
            value: shipType ?? userShip.shipName,
            style: discord_js_1.TextInputStyle.Short,
            required: true,
            max_length: 60,
        });
        const shipRoleInput = new discord_js_1.TextInputBuilder({
            custom_id: 'ship_role',
            value: roleCategory ?? 'Bespoke',
            style: discord_js_1.TextInputStyle.Short,
            required: true,
            max_length: 30,
        });
        const maxCrewInput = new discord_js_1.TextInputBuilder({
            custom_id: 'max_crew',
            value: String(maxCrew),
            style: discord_js_1.TextInputStyle.Short,
            required: true,
            max_length: 3,
        });
        modal.addLabelComponents(new discord_js_1.LabelBuilder()
            .setLabel('Ship Name (your custom name)')
            .setTextInputComponent(shipNameInput), new discord_js_1.LabelBuilder()
            .setLabel('Ship Type (e.g. Cutlass Black)')
            .setTextInputComponent(shipTypeInput), new discord_js_1.LabelBuilder().setLabel('Ship Role (Combat)').setTextInputComponent(shipRoleInput), new discord_js_1.LabelBuilder()
            .setLabel('Max Crew Capacity (including you)')
            .setTextInputComponent(maxCrewInput));
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
async function handleHangarPageSelect(interaction, activityId) {
    const selected = interaction.values[0];
    if (selected === HANGAR_MANUAL_ENTRY) {
        return handleHangarShipSelect(interaction, activityId);
    }
    await interaction.deferUpdate();
    try {
        const internalUserId = await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id);
        if (!internalUserId) {
            await interaction.editReply({
                content: '🔗 Link your account on the web app first.',
                components: [],
            });
            return;
        }
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        const requirements = activity ? (0, eventButtons_requirements_1.parseRequiredShipTypes)(activity.requiredShipTypes) : [];
        if (requirements.length > 0 && activity) {
            const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
            if (allShips.length > 0) {
                (0, eventButtons_requirements_1.computeFilledCounts)(requirements, allShips);
            }
        }
        const allSuggestions = await (0, eventButtons_hangarSuggestions_1.getHangarSuggestions)(internalUserId, requirements);
        const group = (0, eventButtons_hangarGroups_1.buildHangarGroups)(allSuggestions).find(g => g.key === selected);
        if (!group) {
            await interaction.editReply({
                content: '⚠️ That group is no longer available. Click **Bring Ship** again to refresh.',
                components: [],
            });
            return;
        }
        const options = (0, eventButtons_hangarSuggestions_1.buildShipOptions)(group.ships);
        options.push({
            label: 'Enter ship manually…',
            description: 'Type in ship details directly',
            value: HANGAR_MANUAL_ENTRY,
            emoji: '✏️',
        });
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`event_hangarship_${activityId}`)
            .setPlaceholder('Select a ship…')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options);
        const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        await interaction.editReply({
            content: `🚀 **${group.ships.length} ship${group.ships.length === 1 ? '' : 's'} — ${group.label}:**`,
            components: [row],
        });
    }
    catch (error) {
        logger_1.logger.warn('Failed to load hangar page', {
            userId: interaction.user.id,
            activityId,
            rangeKey: selected,
            error: (0, errorHandler_1.getErrorMessage)(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        try {
            const fallbackMenu = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(`event_hangarship_${activityId}`)
                .setPlaceholder('Select an option…')
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions({
                label: 'Enter ship manually…',
                description: 'Type in ship details directly',
                value: HANGAR_MANUAL_ENTRY,
                emoji: '✏️',
            });
            const row = new discord_js_1.ActionRowBuilder().addComponents(fallbackMenu);
            await interaction.editReply({
                content: '❌ **Failed to load ships from your hangar.** You can still enter your ship manually:',
                components: [row],
            });
        }
        catch {
            await interaction.editReply({
                content: '❌ Failed to load ships. Click **Bring Ship** on the event to try again.',
                components: [],
            });
        }
    }
}
async function handleNestShipSelect(interaction, activityId, childShipKey) {
    const selected = interaction.values[0];
    if (selected === '__none__') {
        await interaction.update({
            content: '✈️ Ship kept as independent — no docking.',
            components: [],
        });
        return;
    }
    await interaction.deferUpdate();
    try {
        const separatorIdx = selected.lastIndexOf('__');
        if (separatorIdx === -1) {
            await interaction.editReply({ content: '❌ Invalid selection.', components: [] });
            return;
        }
        const carrierKey = selected.slice(0, separatorIdx);
        const transportType = selected.slice(separatorIdx + 2);
        const decodedChildKey = decodeURIComponent(childShipKey);
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND, components: [] });
            return;
        }
        const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
        const childShip = allShips.find(s => s.id === decodedChildKey || `${s.shipType}::${s.shipName}` === decodedChildKey);
        if (!childShip) {
            await interaction.editReply({ content: '⚠️ Ship no longer found in event.', components: [] });
            return;
        }
        const carrier = allShips.find(s => s.id === carrierKey || s.shipType === carrierKey);
        if (!carrier) {
            await interaction.editReply({
                content: '⚠️ Carrier ship no longer found in event.',
                components: [],
            });
            return;
        }
        childShip.parentShipId = carrier.id ?? carrier.shipType;
        childShip.isTransported = true;
        childShip.transportType = transportType;
        await (0, eventButtons_services_1.getActivityService)().updateActivity(activityId, {
            shipAssignments: activity.shipAssignments,
            ships: activity.ships,
        });
        await (0, eventButtons_refresh_1.refreshEventEmbedFromChannel)(interaction, activityId);
        const carrierName = carrier.shipName ?? carrier.shipType;
        const childName = childShip.shipName ?? childShip.shipType;
        const typeLabel = transportType === 'hangar' ? 'hangar bay' : 'cargo bay';
        await interaction.editReply({
            content: `🚢 **${childName}** docked in **${carrierName}**'s ${typeLabel}!`,
            components: [],
        });
    }
    catch (error) {
        logger_1.logger.warn('Failed to nest ship', {
            activityId,
            childShipKey,
            error: (0, errorHandler_1.getErrorMessage)(error),
        });
        await interaction.editReply({
            content: '❌ Failed to dock ship. Try again.',
            components: [],
        });
    }
}
async function handleBringShipModal(interaction, activityId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const shipName = interaction.fields.getTextInputValue('ship_name');
    const shipType = interaction.fields.getTextInputValue('ship_type');
    const shipRole = interaction.fields.getTextInputValue('ship_role');
    const maxCrewRaw = interaction.fields.getTextInputValue('max_crew');
    const maxCrew = Number.parseInt(maxCrewRaw, 10);
    if (Number.isNaN(maxCrew) || maxCrew < 1 || maxCrew > 100) {
        await interaction.editReply({
            content: '❌ Max crew must be a number between 1 and 100.',
        });
        return;
    }
    const backendRole = ROLE_MAP[shipRole] ?? 'other';
    try {
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
            return;
        }
        const userId = await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id);
        if (!userId) {
            await interaction.editReply({
                content: '❌ Please link your Discord account on the web app first, then try again.',
            });
            return;
        }
        const userName = interaction.user.username;
        const isParticipant = await (0, eventButtons_services_1.getParticipantService)().isParticipant(activityId, userId);
        if (!isParticipant) {
            await (0, eventButtons_services_1.getActivityService)().joinActivity(activityId, {
                userId,
                userName,
                role: Activity_1.ParticipantRole.PILOT,
                shipType: `${shipType} (${shipRole})`,
                shipName,
            });
        }
        const existingShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
        const hasCrewedShip = existingShips.some(s => s.ownerId === userId && !s.isLoaner && (s.crewAssigned ?? 0) > 0);
        const roleEmoji = (0, shipTaxonomy_1.getShipRoleEmoji)(shipRole);
        const safeName = (0, eventButtons_security_1.sanitizeDiscordInput)(shipName);
        const safeType = (0, eventButtons_security_1.sanitizeDiscordInput)(shipType);
        const safeRole = (0, eventButtons_security_1.sanitizeDiscordInput)(shipRole);
        if (hasCrewedShip) {
            await (0, eventButtons_services_1.getActivityService)().loanShips(activityId, userId, userName, [
                {
                    shipType: `${shipType} (${shipRole})`,
                    shipName,
                    crewCapacity: maxCrew,
                },
            ]);
            await interaction.editReply({
                content: `${roleEmoji} **${safeName}** added as a **loaned ship** (${safeType} / ${safeRole}) with ${maxCrew} crew slots!\n` +
                    `You're already piloting another ship, so this one is available for other members to crew.`,
            });
        }
        else {
            await (0, eventButtons_services_1.getActivityService)().addShip(activityId, userId, {
                shipType: `${shipType} (${shipRole})`,
                shipName,
                role: backendRole,
                crewCapacity: maxCrew,
                capabilities: [],
            });
            await interaction.editReply({
                content: `${roleEmoji} **${safeName}** registered as **${safeType}** (${safeRole}) with ${maxCrew} crew slots!\nOther members can click **Join Crew** to sign up.`,
            });
        }
        await (0, eventButtons_refresh_1.refreshEventEmbedFromChannel)(interaction, activityId);
        const updatedActivity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        const allAssignments = [
            ...(updatedActivity?.ships ?? []),
            ...(updatedActivity?.shipAssignments ?? []),
        ];
        const carriers = allAssignments
            .filter(s => !s.isTransported)
            .map(s => ({ ship: s, cap: (0, shared_types_1.getCarrierCapability)(s.shipType) }))
            .filter((entry) => !!entry.cap);
        if (carriers.length > 0) {
            const justAdded = [...allAssignments]
                .reverse()
                .find(s => s.ownerId === userId && s.shipName === shipName && !s.isTransported);
            if (justAdded) {
                const shipKey = justAdded.id ?? `${justAdded.shipType}::${justAdded.shipName}`;
                const options = carriers.slice(0, 24).map(({ ship: carrier, cap }) => {
                    const types = [];
                    if (cap.hangar) {
                        types.push(`hangar: ${cap.hangar}`);
                    }
                    if (cap.vehicleBay) {
                        types.push('vehicle bay');
                    }
                    const carrierKey = carrier.id ?? carrier.shipType;
                    const transportType = cap.hangar ? 'hangar' : 'cargo';
                    return {
                        label: (carrier.shipName ?? carrier.shipType).slice(0, 100),
                        description: `${carrier.ownerName} • ${types.join(', ')}`.slice(0, 100),
                        value: `${carrierKey}__${transportType}`,
                        emoji: '🚢',
                    };
                });
                options.push({
                    label: 'No — keep it independent',
                    description: 'This ship flies on its own',
                    value: '__none__',
                    emoji: '✈️',
                });
                const selectMenu = new discord_js_1.StringSelectMenuBuilder()
                    .setCustomId(`event_nestship_${activityId}_${encodeURIComponent(shipKey)}`)
                    .setPlaceholder('Dock this ship inside a carrier?')
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(options);
                const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
                await interaction.followUp({
                    content: `🚢 **${safeName}** can be transported inside a carrier ship. Want to dock it?`,
                    components: [row],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
        }
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId,
            username: userName,
            resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
            action: 'EVENT_SHIP_ADDED',
            message: `Ship ${shipName} (${shipType}/${shipRole}) added to event ${activityId}${hasCrewedShip ? ' (loaned)' : ''}`,
            metadata: { activityId, shipName, shipType, shipRole, maxCrew, isLoaner: hasCrewedShip },
        });
    }
    catch (error) {
        await interaction.editReply({
            content: `❌ Error: ${(0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))}`,
        });
    }
}
//# sourceMappingURL=eventButtons.bringShip.js.map