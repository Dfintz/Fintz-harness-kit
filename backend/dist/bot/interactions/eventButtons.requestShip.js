"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRequestShip = handleRequestShip;
exports.handleReqShipRoleSelect = handleReqShipRoleSelect;
exports.handleReqShipTypeSelect = handleReqShipTypeSelect;
exports.handleReqShipModal = handleReqShipModal;
const discord_js_1 = require("discord.js");
const auditLogger_1 = require("../../utils/auditLogger");
const errorHandler_1 = require("../../utils/errorHandler");
const shipTaxonomy_1 = require("../constants/shipTaxonomy");
const modalLabelInput_1 = require("../utils/modalLabelInput");
const eventButtons_identity_1 = require("./eventButtons.identity");
const eventButtons_refresh_1 = require("./eventButtons.refresh");
const eventButtons_requirements_1 = require("./eventButtons.requirements");
const eventButtons_security_1 = require("./eventButtons.security");
const eventButtons_services_1 = require("./eventButtons.services");
const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';
async function handleRequestShip(interaction, activityId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
            return;
        }
        const internalUserId = await (0, eventButtons_identity_1.resolveInternalUserId)(interaction.user.id);
        if (activity.creatorId !== internalUserId && activity.creatorId !== interaction.user.id) {
            await interaction.editReply({
                content: '⚠️ Only the event organiser can request ships.',
            });
            return;
        }
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`event_reqshiprole_${activityId}`)
            .setPlaceholder('Select ship role to request…')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(shipTaxonomy_1.SHIP_ROLES.map(role => ({
            label: role,
            description: `${shipTaxonomy_1.SHIP_ROLE_TYPES[role].length} types`,
            value: role,
            emoji: (0, shipTaxonomy_1.getShipRoleEmoji)(role),
        })));
        const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        await interaction.editReply({
            content: '📋 **What role of ship do you need?**',
            components: [row],
        });
    }
    catch (error) {
        await interaction.editReply({
            content: `❌ Error: ${(0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))}`,
        });
    }
}
async function handleReqShipRoleSelect(interaction, activityId) {
    await interaction.deferUpdate();
    try {
        const selectedRole = interaction.values[0];
        const types = shipTaxonomy_1.SHIP_ROLE_TYPES[selectedRole];
        const emoji = (0, shipTaxonomy_1.getShipRoleEmoji)(selectedRole);
        const options = [
            {
                label: `Any ${selectedRole}`,
                description: 'No specific type required',
                value: `__any__`,
                emoji,
            },
            ...types.map(t => ({
                label: t,
                value: t,
                emoji,
            })),
        ];
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`event_reqshiptype_${activityId}_${selectedRole}`)
            .setPlaceholder(`Select type (or any ${selectedRole})…`)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options);
        const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        await interaction.editReply({
            content: `${emoji} **Select the specific type you need (or any ${selectedRole}):**`,
            components: [row],
        });
    }
    catch (error) {
        await interaction.editReply({
            content: `❌ Error: ${(0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))}`,
        });
    }
}
async function handleReqShipTypeSelect(interaction, activityId, shipRole) {
    if (!shipTaxonomy_1.SHIP_ROLES.includes(shipRole)) {
        await interaction.reply({ content: '⚠️ Unknown ship role.', flags: discord_js_1.MessageFlags.Ephemeral });
        return;
    }
    const selectedType = interaction.values[0];
    const isAny = selectedType === '__any__';
    try {
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId(`event_reqship_modal_${activityId}`)
            .setTitle('Ship Request Details');
        modal.addLabelComponents((0, modalLabelInput_1.createModalLabelInput)({
            customId: 'req_role',
            label: 'Role',
            value: shipRole,
            style: discord_js_1.TextInputStyle.Short,
            required: true,
            maxLength: 30,
        }), (0, modalLabelInput_1.createModalLabelInput)({
            customId: 'req_type',
            label: 'Type (or "any")',
            value: isAny ? 'any' : selectedType,
            style: discord_js_1.TextInputStyle.Short,
            required: true,
            maxLength: 40,
        }), (0, modalLabelInput_1.createModalLabelInput)({
            customId: 'req_count',
            label: 'How many ships needed?',
            placeholder: 'e.g. 2',
            value: '1',
            style: discord_js_1.TextInputStyle.Short,
            required: true,
            maxLength: 2,
        }), (0, modalLabelInput_1.createModalLabelInput)({
            customId: 'req_strict',
            label: 'Strictness: required / preferred / flexible',
            placeholder: 'required, preferred, or flexible',
            value: 'preferred',
            style: discord_js_1.TextInputStyle.Short,
            required: true,
            maxLength: 10,
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
async function handleReqShipModal(interaction, activityId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const role = interaction.fields.getTextInputValue('req_role');
    const rawType = interaction.fields.getTextInputValue('req_type');
    const countRaw = interaction.fields.getTextInputValue('req_count');
    const strictRaw = interaction.fields.getTextInputValue('req_strict').toLowerCase().trim();
    const count = Number.parseInt(countRaw, 10);
    if (Number.isNaN(count) || count < 1 || count > 25) {
        await interaction.editReply({ content: '❌ Count must be between 1 and 25.' });
        return;
    }
    const validStrict = ['required', 'preferred', 'flexible'];
    const strictness = validStrict.includes(strictRaw)
        ? strictRaw
        : 'preferred';
    const type = rawType === 'any' ? undefined : rawType;
    try {
        const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
        if (!activity) {
            await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
            return;
        }
        const existing = (0, eventButtons_requirements_1.parseRequiredShipTypes)(activity.requiredShipTypes);
        const newReq = {
            role: role,
            type,
            count,
            filled: 0,
            strictness,
        };
        existing.push(newReq);
        await (0, eventButtons_services_1.getActivityService)().updateActivity(activityId, {
            requiredShipTypes: JSON.stringify(existing),
        });
        const emoji = (0, shipTaxonomy_1.getShipRoleEmoji)(role);
        const label = type ? `**${type}** (${role})` : `**Any ${role}**`;
        await interaction.editReply({
            content: `${emoji} Ship request added: ${count}× ${label} [${strictness}]`,
        });
        await (0, eventButtons_refresh_1.refreshEventEmbedFromChannel)(interaction, activityId);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId: interaction.user.id,
            username: interaction.user.username,
            resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
            action: 'EVENT_SHIP_REQUESTED',
            message: `Requested ${count}x ${type ?? 'any'} (${role}) for event ${activityId}`,
            metadata: { activityId, ...newReq },
        });
    }
    catch (error) {
        await interaction.editReply({
            content: `❌ Error: ${(0, eventButtons_security_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error))}`,
        });
    }
}
//# sourceMappingURL=eventButtons.requestShip.js.map