"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.mission = void 0;
const discord_js_1 = require("discord.js");
const Mission_1 = require("../../models/Mission");
const missionSchemas_1 = require("../../schemas/missionSchemas");
const MissionService_1 = require("../../services/content/MissionService");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const errorHandler_1 = require("../../utils/errorHandler");
const missionEmbeds_1 = require("../embeds/missionEmbeds");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const dmAwareReply_1 = require("../utils/dmAwareReply");
const errorReply_1 = require("../utils/errorReply");
const realtimeEmit_1 = require("../utils/realtimeEmit");
const sharedChoices_1 = require("../utils/sharedChoices");
const missionService = new MissionService_1.MissionService();
const guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
const pendingMissionCreates = new Map();
const PENDING_MISSION_TTL_MS = 10 * 60 * 1000;
function cleanPendingMissionCreates() {
    const now = Date.now();
    for (const [key, val] of pendingMissionCreates) {
        if (now - val.timestamp > PENDING_MISSION_TTL_MS) {
            pendingMissionCreates.delete(key);
        }
    }
}
async function handleList(interaction, organizationId) {
    const statusFilter = interaction.isChatInputCommand()
        ? interaction.options.getString('status')
        : null;
    const typeFilter = interaction.isChatInputCommand()
        ? interaction.options.getString('type')
        : null;
    const result = await missionService.getAllMissions(organizationId, { page: 1, limit: 10, sortBy: 'updatedAt', sortOrder: 'DESC' }, {
        status: statusFilter ?? undefined,
        missionType: typeFilter ?? undefined,
    });
    const filterParts = [];
    if (statusFilter) {
        filterParts.push(`Status: ${(0, missionEmbeds_1.capitalise)(statusFilter)}`);
    }
    if (typeFilter) {
        filterParts.push(`Type: ${(0, missionEmbeds_1.capitalise)(typeFilter)}`);
    }
    const filterText = filterParts.length > 0 ? ` (${filterParts.join(', ')})` : '';
    const embed = (0, missionEmbeds_1.buildMissionListEmbed)(result.data, `🎯 Organization Missions${filterText}`);
    if (result.pagination.total > 10) {
        embed.setFooter({
            text: `Showing 10 of ${result.pagination.total} missions · Page ${result.pagination.page}/${result.pagination.totalPages}`,
        });
    }
    await interaction.editReply({ embeds: [embed] });
}
async function handleActive(interaction, organizationId) {
    const missions = await missionService.getActiveMissions(organizationId);
    const embed = (0, missionEmbeds_1.buildMissionListEmbed)(missions, '🚀 Active Missions');
    await interaction.editReply({ embeds: [embed] });
}
exports.mission = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('mission')
        .setDescription('Create, list, and manage organization missions'),
    cooldown: 5,
    category: 'events',
    guildOnly: true,
    examples: [
        '/mission create title:Mining Op type:Mining difficulty:Medium',
        '/mission list status:In Progress',
        '/mission view id:<mission-uuid>',
        '/mission active',
        '/mission status id:<mission-uuid> new_status:In Progress',
    ],
    handleButton: async (interaction) => {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'mission');
        if (!sub) {
            return;
        }
        if (sub === 'list' || sub === 'active') {
            if (!interaction.guildId) {
                await interaction.reply({
                    content: '\u274c This command can only be used in a server.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const organizationId = await guildOrgService.resolveOrganization(interaction.guildId);
                if (!organizationId) {
                    await interaction.editReply({
                        content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
                    });
                    return;
                }
                if (sub === 'list') {
                    await handleList(interaction, organizationId);
                }
                else {
                    await handleActive(interaction, organizationId);
                }
            }
            catch (error) {
                const msg = (0, errorHandler_1.getErrorMessage)(error);
                await interaction.editReply({ content: `\u274c Error: ${msg}` });
            }
        }
        else if (sub === 'briefing') {
            const { buildCommandPanel } = await Promise.resolve().then(() => __importStar(require('../utils/commandPanelBuilder')));
            const { embed, components } = buildCommandPanel({
                prefix: 'briefing',
                title: '\ud83d\udcdd Mission Briefings',
                description: 'Generate briefings for your missions.',
                buttons: [
                    {
                        subcommand: 'usage',
                        label: 'View Usage Stats',
                        emoji: '\ud83d\udcca',
                        style: discord_js_1.ButtonStyle.Primary,
                    },
                    { subcommand: 'generate', label: 'Generate Briefing', emoji: '\ud83c\udfaf' },
                    { subcommand: 'quick', label: 'Quick Briefing', emoji: '\u26a1' },
                ],
            });
            await interaction.reply({ embeds: [embed], components, flags: discord_js_1.MessageFlags.Ephemeral });
        }
        else if (sub === 'create') {
            const row = (0, sharedChoices_1.buildMissionTypeSelect)('mission_select_create_type');
            await interaction.reply({
                content: '🎯 **Create Mission** — What type of mission is this?',
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        else if (sub === 'view' || sub === 'status') {
            if (!interaction.guildId) {
                await interaction.reply({
                    content: '\u274c Must be used in a server.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            try {
                await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
                const organizationId = await guildOrgService.resolveOrganization(interaction.guildId);
                if (!organizationId) {
                    await interaction.editReply({
                        content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
                    });
                    return;
                }
                const missions = await missionService.getActiveMissions(organizationId);
                if (missions.length > 0) {
                    const options = missions.slice(0, 25).map(m => ({
                        label: (m.title || 'Untitled').substring(0, 100),
                        value: m.id,
                        description: `${(0, missionEmbeds_1.capitalise)(m.status)} \u2022 ${(0, missionEmbeds_1.capitalise)(m.missionType)}`.substring(0, 100),
                        emoji: (0, missionEmbeds_1.getStatusEmoji)(m.status),
                    }));
                    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                        .setCustomId(sub === 'view' ? 'mission_view_select' : 'mission_status_pick')
                        .setPlaceholder('Select a mission...')
                        .addOptions(options));
                    await interaction.editReply({
                        content: sub === 'view' ? 'Select a mission to view:' : 'Select a mission to update status:',
                        components: [row],
                    });
                    return;
                }
                await interaction.editReply('No active missions found. Create one first with the Create Mission button.');
            }
            catch (error) {
                const msg = (0, errorHandler_1.getErrorMessage)(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ content: `\u274c Error: ${msg}` });
                }
                else {
                    await interaction.reply({
                        content: `\u274c Error: ${msg}`,
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                }
            }
        }
    },
    handleSelectMenu: async (interaction) => {
        const { customId } = interaction;
        if (customId === 'mission_select_create_type') {
            cleanPendingMissionCreates();
            const selectedType = interaction.values[0];
            if (!Object.values(Mission_1.MissionType).includes(selectedType)) {
                await interaction.reply({
                    content: '❌ Invalid mission type selected.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            pendingMissionCreates.set(interaction.user.id, {
                missionType: selectedType,
                timestamp: Date.now(),
            });
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId('mission_create_modal')
                .setTitle(`Create ${(0, missionEmbeds_1.capitalise)(selectedType)} Mission`);
            const titleInput = new discord_js_1.TextInputBuilder()
                .setCustomId('title')
                .setPlaceholder('Enter mission title')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100);
            const descInput = new discord_js_1.TextInputBuilder()
                .setCustomId('description')
                .setPlaceholder('Describe the mission objectives...')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(1000);
            const locationInput = new discord_js_1.TextInputBuilder()
                .setCustomId('location')
                .setPlaceholder('e.g. Stanton, Pyro, Crusader')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(100);
            const rewardInput = new discord_js_1.TextInputBuilder()
                .setCustomId('reward')
                .setPlaceholder('e.g. 50,000 aUEC')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(100);
            modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Mission Title').setTextInputComponent(titleInput), new discord_js_1.LabelBuilder().setLabel('Description (optional)').setTextInputComponent(descInput), new discord_js_1.LabelBuilder().setLabel('Location (optional)').setTextInputComponent(locationInput), new discord_js_1.LabelBuilder().setLabel('Reward (optional)').setTextInputComponent(rewardInput));
            await interaction.showModal(modal);
            return;
        }
        if (customId === 'mission_view_select') {
            const missionId = interaction.values[0];
            if (!interaction.guildId) {
                await interaction.reply({
                    content: '\u274c Must be used in a server.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const organizationId = await guildOrgService.resolveOrganization(interaction.guildId);
                if (!organizationId) {
                    await interaction.editReply({
                        content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
                    });
                    return;
                }
                const mission = await missionService.getMissionById(missionId, organizationId);
                if (!mission) {
                    await interaction.editReply({ content: '\u274c Mission not found.' });
                    return;
                }
                const embed = (0, missionEmbeds_1.buildMissionDetailEmbed)(mission);
                await interaction.editReply({ embeds: [embed] });
            }
            catch (error) {
                await interaction.editReply({ content: `\u274c Error: ${(0, errorHandler_1.getErrorMessage)(error)}` });
            }
        }
        else if (customId === 'mission_status_pick') {
            const missionId = interaction.values[0];
            const row = (0, sharedChoices_1.buildMissionStatusSelect)(`mission_status_select_${missionId}`);
            await interaction.reply({
                content: `Select the new status for this mission:`,
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        else if (customId.startsWith('mission_status_select_')) {
            const missionId = customId.replace('mission_status_select_', '');
            const newStatus = interaction.values[0];
            if (!interaction.guildId) {
                await interaction.reply({
                    content: '\u274c Must be used in a server.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const organizationId = await guildOrgService.resolveOrganization(interaction.guildId);
                if (!organizationId) {
                    await interaction.editReply({
                        content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
                    });
                    return;
                }
                const mission = await missionService.transitionStatus(missionId, organizationId, newStatus);
                if (!mission) {
                    await interaction.editReply({
                        content: '\u274c Mission not found or status transition not allowed.',
                    });
                    return;
                }
                (0, realtimeEmit_1.emitRealtimeToOrg)(organizationId, 'mission:status_changed', {
                    missionId: mission.id,
                    title: mission.title,
                    status: mission.status,
                });
                const embed = (0, missionEmbeds_1.buildMissionStatusUpdatedEmbed)({
                    missionId: mission.id,
                    missionTitle: mission.title,
                    status: mission.status,
                });
                await interaction.editReply({ embeds: [embed] });
            }
            catch (error) {
                await interaction.editReply({ content: `\u274c Error: ${(0, errorHandler_1.getErrorMessage)(error)}` });
            }
        }
    },
    handleModal: async (interaction) => {
        const { customId } = interaction;
        if (customId === 'mission_create_modal') {
            if (!interaction.guildId) {
                await interaction.reply({
                    content: '\u274c Must be used in a server.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const organizationId = await guildOrgService.resolveOrganization(interaction.guildId);
                if (!organizationId) {
                    await interaction.editReply({
                        content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
                    });
                    return;
                }
                const title = interaction.fields.getTextInputValue('title').trim();
                const description = interaction.fields.getTextInputValue('description').trim() || undefined;
                const location = interaction.fields.getTextInputValue('location').trim() || undefined;
                const reward = interaction.fields.getTextInputValue('reward').trim() || undefined;
                const pending = pendingMissionCreates.get(interaction.user.id);
                const missionType = pending?.missionType ?? Mission_1.MissionType.CUSTOM;
                pendingMissionCreates.delete(interaction.user.id);
                const { error: validationError, value: validated } = missionSchemas_1.missionSchemas.create.validate({
                    title,
                    description,
                    missionType,
                    difficulty: Mission_1.MissionDifficulty.MEDIUM,
                    priority: Mission_1.MissionPriority.NORMAL,
                    location,
                    reward,
                }, { abortEarly: false, stripUnknown: true });
                if (validationError) {
                    await (0, errorReply_1.replyWithError)(interaction, validationError, { context: 'mission.create.modal' });
                    return;
                }
                const mission = await missionService.createMission(organizationId, {
                    ...validated,
                    createdBy: interaction.user.id,
                });
                (0, realtimeEmit_1.emitRealtimeToOrg)(organizationId, 'mission:created', {
                    missionId: mission.id,
                    title: mission.title,
                    missionType: mission.missionType,
                    createdBy: interaction.user.id,
                });
                const embed = (0, missionEmbeds_1.buildMissionCreatedEmbed)({
                    missionId: mission.id,
                    missionTitle: mission.title,
                    missionType: mission.missionType,
                    difficulty: mission.difficulty,
                    priority: mission.priority,
                    location: mission.location,
                    reward: mission.reward,
                });
                await (0, dmAwareReply_1.dmAwareEditReply)(interaction, { embeds: [embed] });
            }
            catch (error) {
                await (0, errorReply_1.replyWithError)(interaction, error, { context: 'mission.create.modal' });
            }
        }
        else if (customId === 'mission_view_modal') {
            if (!interaction.guildId) {
                await interaction.reply({
                    content: '\u274c Must be used in a server.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const organizationId = await guildOrgService.resolveOrganization(interaction.guildId);
                if (!organizationId) {
                    await interaction.editReply({
                        content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
                    });
                    return;
                }
                const missionId = interaction.fields.getTextInputValue('mission_id').trim();
                const mission = await missionService.getMissionById(missionId, organizationId);
                if (!mission) {
                    await interaction.editReply({ content: '\u274c Mission not found.' });
                    return;
                }
                const embed = (0, missionEmbeds_1.buildMissionDetailEmbed)(mission);
                await interaction.editReply({ embeds: [embed] });
            }
            catch (error) {
                await interaction.editReply({ content: `\u274c Error: ${(0, errorHandler_1.getErrorMessage)(error)}` });
            }
        }
        else if (customId === 'mission_status_modal') {
            const missionId = interaction.fields.getTextInputValue('mission_id').trim();
            const row = (0, sharedChoices_1.buildMissionStatusSelect)(`mission_status_select_${missionId}`);
            await interaction.reply({
                content: `Select the new status for mission \`${missionId}\`:`,
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    },
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({
                content: '\u274c This command can only be used in a server.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const panelConfig = {
            prefix: 'mission',
            title: '\ud83c\udfaf Mission Command',
            description: 'Create and manage organization missions.',
            buttons: [
                {
                    subcommand: 'list',
                    label: 'List Missions',
                    emoji: '\ud83d\udccb',
                    style: discord_js_1.ButtonStyle.Primary,
                },
                { subcommand: 'active', label: 'Active Missions', emoji: '\ud83d\udfe2' },
                {
                    subcommand: 'create',
                    label: 'Create Mission',
                    emoji: '\u2795',
                    style: discord_js_1.ButtonStyle.Success,
                },
                { subcommand: 'view', label: 'View Mission', emoji: '\ud83d\udd0d' },
                { subcommand: 'status', label: 'Update Status', emoji: '\ud83d\udd04' },
                { subcommand: 'briefing', label: 'Briefing', emoji: '\ud83d\udcdd' },
            ],
        };
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig);
    },
};
//# sourceMappingURL=mission.js.map