"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.briefing = void 0;
const discord_js_1 = require("discord.js");
const Mission_1 = require("../../models/Mission");
const AIBriefingGenerationService_1 = require("../../services/content/AIBriefingGenerationService");
const MissionService_1 = require("../../services/content/MissionService");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const errorHandler_1 = require("../../utils/errorHandler");
const briefingEmbeds_1 = require("../embeds/briefingEmbeds");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const guildFeatureFlags_1 = require("../utils/guildFeatureFlags");
const sharedChoices_1 = require("../utils/sharedChoices");
let _services = null;
function getServices() {
    _services ??= {
        missionService: new MissionService_1.MissionService(),
        aiBriefingService: new AIBriefingGenerationService_1.AIBriefingGenerationService(),
        guildOrgService: GuildOrganizationService_1.GuildOrganizationService.getInstance(),
    };
    return _services;
}
const MAX_DESCRIPTION_LENGTH = 3900;
function capitalise(s) {
    return s.charAt(0).toUpperCase() + s.slice(1).replaceAll('_', ' ');
}
function getElementIcon(type) {
    switch (type) {
        case 'header':
            return '📌';
        case 'text':
            return '';
        case 'objective':
            return '🎯';
        case 'warning':
            return '⚠️';
        case 'timeline':
            return '⏱️';
        case 'role-assignment':
            return '👤';
        default:
            return '';
    }
}
function renderBriefingElements(elements) {
    const lines = [];
    for (const el of elements) {
        const icon = getElementIcon(el.type);
        switch (el.type) {
            case 'header':
                lines.push(`\n**${icon} ${el.content}**`);
                break;
            case 'warning':
                lines.push(`${icon} **Warning:** ${el.content}`);
                break;
            case 'objective':
                lines.push(`${icon} ${el.content}`);
                break;
            case 'timeline':
                lines.push(`${icon} ${el.content}`);
                break;
            case 'role-assignment':
                lines.push(`${icon} ${el.content}`);
                break;
            case 'text':
            default:
                lines.push(el.content);
                break;
        }
    }
    const text = lines.join('\n').trim();
    if (text.length > MAX_DESCRIPTION_LENGTH) {
        return `${text.slice(0, MAX_DESCRIPTION_LENGTH)}\n\n*...briefing truncated for Discord. View full briefing on the web app.*`;
    }
    return text;
}
async function handleUsage(interaction, organizationId) {
    const stats = await getServices().aiBriefingService.getUsageStats(organizationId);
    const embed = (0, briefingEmbeds_1.buildBriefingUsageEmbed)(stats);
    await interaction.editReply({ embeds: [embed] });
}
exports.briefing = {
    data: new discord_js_1.SlashCommandBuilder().setName('briefing').setDescription('Generate mission briefings'),
    cooldown: 10,
    category: 'organization',
    guildOnly: true,
    examples: [
        '/briefing generate mission_id:<uuid>',
        '/briefing quick type:Combat difficulty:Hard location:Stanton',
        '/briefing usage',
    ],
    handleButton: async (interaction) => {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'briefing');
        if (!sub) {
            return;
        }
        if (sub === 'usage') {
            if (!interaction.guildId) {
                await interaction.reply({
                    content: '\u274c This command can only be used in a server.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const organizationId = await getServices().guildOrgService.resolveOrganization(interaction.guildId);
                if (!organizationId) {
                    await interaction.editReply({
                        content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
                    });
                    return;
                }
                await handleUsage(interaction, organizationId);
            }
            catch (error) {
                const msg = (0, errorHandler_1.getErrorMessage)(error);
                await interaction.editReply({ content: `\u274c Error: ${msg}` });
            }
        }
        else if (sub === 'generate') {
            if (!interaction.guildId) {
                await interaction.reply({
                    content: '\u274c Must be used in a server.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            try {
                await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
                const organizationId = await getServices().guildOrgService.resolveOrganization(interaction.guildId);
                if (!organizationId) {
                    await interaction.editReply({
                        content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
                    });
                    return;
                }
                const missions = await getServices().missionService.getActiveMissions(organizationId);
                if (missions.length > 0) {
                    const options = missions.slice(0, 25).map(m => ({
                        label: (m.title || 'Untitled').substring(0, 100),
                        value: m.id,
                        description: `${m.missionType} \u2022 ${m.difficulty}`.substring(0, 100),
                    }));
                    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                        .setCustomId('briefing_generate_select')
                        .setPlaceholder('Select a mission to generate briefing for...')
                        .addOptions(options));
                    await interaction.editReply({
                        content: 'Select a mission to generate a briefing for:',
                        components: [row],
                    });
                    return;
                }
                await interaction.editReply('No active missions found. Create a mission first.');
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
        else if (sub === 'quick') {
            const row = (0, sharedChoices_1.buildMissionTypeSelect)('briefing_quick_type');
            await interaction.reply({
                content: 'Select the mission type for the quick briefing:',
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    },
    handleSelectMenu: async (interaction) => {
        if (interaction.customId === 'briefing_generate_select') {
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
                const organizationId = await getServices().guildOrgService.resolveOrganization(interaction.guildId);
                if (!organizationId) {
                    await interaction.editReply({
                        content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
                    });
                    return;
                }
                await handleGenerate_fromPanel(interaction, organizationId, missionId);
            }
            catch (error) {
                const msg = (0, errorHandler_1.getErrorMessage)(error);
                await interaction.editReply({ content: `\u274c Error: ${msg}` });
            }
        }
        else if (interaction.customId === 'briefing_quick_type') {
            const missionType = interaction.values[0];
            if (!interaction.guildId) {
                await interaction.reply({
                    content: '\u274c Must be used in a server.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const organizationId = await getServices().guildOrgService.resolveOrganization(interaction.guildId);
                if (!organizationId) {
                    await interaction.editReply({
                        content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
                    });
                    return;
                }
                await handleQuick_fromPanel(interaction, organizationId, missionType);
            }
            catch (error) {
                const msg = (0, errorHandler_1.getErrorMessage)(error);
                await interaction.editReply({ content: `\u274c Error: ${msg}` });
            }
        }
    },
    handleModal: async (interaction) => {
        if (interaction.customId === 'briefing_generate_modal') {
            if (!interaction.guildId) {
                await interaction.reply({
                    content: '\u274c Must be used in a server.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const organizationId = await getServices().guildOrgService.resolveOrganization(interaction.guildId);
                if (!organizationId) {
                    await interaction.editReply({
                        content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
                    });
                    return;
                }
                const missionId = interaction.fields.getTextInputValue('mission_id').trim();
                await handleGenerate_fromPanel(interaction, organizationId, missionId);
            }
            catch (error) {
                const msg = (0, errorHandler_1.getErrorMessage)(error);
                await interaction.editReply({ content: `\u274c Error: ${msg}` });
            }
        }
    },
    async execute(interaction) {
        const panelConfig = {
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
        };
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig);
    },
};
async function aiBriefingsDisabled(interaction, organizationId) {
    const { guildId } = interaction;
    const overrides = guildId
        ? await DiscordSettingsService_1.discordSettingsService.getGuildFeatureFlagOverrides(organizationId, guildId)
        : undefined;
    if ((0, guildFeatureFlags_1.resolveGuildFeatureFlag)(guildFeatureFlags_1.BotFeatureFlag.AI_BRIEFINGS, overrides)) {
        return false;
    }
    await interaction.editReply({
        content: 'ℹ️ AI briefing generation is currently disabled for this server.',
    });
    return true;
}
async function handleGenerate_fromPanel(interaction, organizationId, missionId) {
    if (await aiBriefingsDisabled(interaction, organizationId)) {
        return;
    }
    const mission = await getServices().missionService.getMissionById(missionId, organizationId);
    if (!mission) {
        await interaction.editReply({
            content: '\u274c Mission not found. Ensure the mission ID is correct and belongs to your organization.',
        });
        return;
    }
    await interaction.editReply({
        content: `Generating briefing for **${mission.title}**... This may take a moment.`,
    });
    try {
        const result = await getServices().aiBriefingService.generateBriefing(organizationId, interaction.user.id, {
            missionType: mission.missionType,
            objectives: mission.objectives ?? [],
            difficulty: mission.difficulty,
            location: mission.location ?? undefined,
            participantCount: mission.participants?.length ?? 0,
            additionalContext: mission.description ?? undefined,
        });
        const briefingText = renderBriefingElements(result.briefingElements);
        const embed = (0, briefingEmbeds_1.buildGeneratedMissionBriefingEmbed)({
            missionTitle: mission.title,
            briefingText,
            modelUsed: result.modelUsed,
            tokensUsed: result.tokensUsed,
            missionId: mission.id,
        });
        await interaction.editReply({ content: null, embeds: [embed] });
    }
    catch (genError) {
        const msg = (0, errorHandler_1.getErrorMessage)(genError);
        if (msg.includes('rate limit') || msg.includes('429')) {
            await interaction.editReply({
                content: '\u26a0\ufe0f Daily briefing generation limit reached. Try again tomorrow.',
            });
            return;
        }
        if (msg.includes('not configured') || msg.includes('503')) {
            await interaction.editReply({
                content: '\u26a0\ufe0f Briefing generation is not configured. Contact an administrator.',
            });
            return;
        }
        throw genError;
    }
}
async function handleQuick_fromPanel(interaction, organizationId, missionType) {
    if (await aiBriefingsDisabled(interaction, organizationId)) {
        return;
    }
    await interaction.editReply({
        content: `Generating quick briefing for a **${capitalise(missionType)}** mission...`,
    });
    try {
        const result = await getServices().aiBriefingService.generateBriefing(organizationId, interaction.user.id, {
            missionType,
            objectives: [],
            difficulty: Mission_1.MissionDifficulty.MEDIUM,
        });
        const briefingText = renderBriefingElements(result.briefingElements);
        const embed = (0, briefingEmbeds_1.buildQuickMissionBriefingEmbed)({
            missionTypeLabel: capitalise(missionType),
            briefingText,
            modelUsed: result.modelUsed,
            tokensUsed: result.tokensUsed,
        });
        await interaction.editReply({ content: null, embeds: [embed] });
    }
    catch (genError) {
        const msg = (0, errorHandler_1.getErrorMessage)(genError);
        if (msg.includes('rate limit') || msg.includes('429')) {
            await interaction.editReply({
                content: '\u26a0\ufe0f Daily briefing generation limit reached. Try again tomorrow.',
            });
            return;
        }
        if (msg.includes('not configured') || msg.includes('503')) {
            await interaction.editReply({
                content: '\u26a0\ufe0f Briefing generation is not configured. Contact an administrator.',
            });
            return;
        }
        throw genError;
    }
}
//# sourceMappingURL=briefing.js.map