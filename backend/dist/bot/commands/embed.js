"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.embed = void 0;
const discord_js_1 = require("discord.js");
const EmbedBuilderService_1 = require("../../services/discord/EmbedBuilderService");
const errorHandler_1 = require("../../utils/errorHandler");
const panelEmbed_1 = require("../embeds/panelEmbed");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const errorSanitizer_1 = require("../utils/errorSanitizer");
const PANEL_CONFIG = {
    prefix: 'embed',
    title: 'Custom Embeds',
    description: 'Create and send custom embed messages.',
    buttons: [
        { subcommand: 'create', label: 'Create Embed', emoji: '\u2795', style: discord_js_1.ButtonStyle.Success },
        { subcommand: 'send', label: 'Send Embed', emoji: '\ud83d\udce4' },
    ],
};
exports.embed = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create and send custom embed messages')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageMessages),
    cooldown: 5,
    category: 'admin',
    async execute(interaction) {
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, PANEL_CONFIG);
    },
    async handleButton(interaction) {
        const subcommand = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'embed');
        if (!subcommand) {
            return;
        }
        try {
            switch (subcommand) {
                case 'create': {
                    const modal = (0, panelEmbed_1.buildPanelModal)('embed_create_panel', 'Create Embed Template', [
                        {
                            customId: 'template_name',
                            label: 'Template Name',
                            style: 'short',
                            placeholder: 'e.g. welcome-message',
                            required: true,
                            maxLength: 100,
                        },
                        {
                            customId: 'embed_title',
                            label: 'Title',
                            style: 'short',
                            placeholder: 'Embed title',
                            required: true,
                            maxLength: 256,
                        },
                        {
                            customId: 'embed_description',
                            label: 'Description',
                            style: 'paragraph',
                            placeholder: 'Embed description',
                            required: true,
                            maxLength: 2000,
                        },
                        {
                            customId: 'embed_color',
                            label: 'Color (hex, e.g., #00FF88)',
                            style: 'short',
                            placeholder: '#00FF88',
                            required: false,
                            maxLength: 7,
                        },
                    ]);
                    await interaction.showModal(modal);
                    break;
                }
                case 'send': {
                    const modal = (0, panelEmbed_1.buildPanelModal)('embed_send_modal', 'Send Embed', [
                        {
                            customId: 'template_name',
                            label: 'Template Name',
                            style: 'short',
                            placeholder: 'e.g. welcome-message',
                            required: true,
                            maxLength: 100,
                        },
                    ]);
                    await interaction.showModal(modal);
                    break;
                }
                default:
                    await interaction.reply({ content: '❌ Unknown action.', flags: discord_js_1.MessageFlags.Ephemeral });
            }
        }
        catch (error) {
            const errorMessage = (0, errorSanitizer_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error) || 'An error occurred');
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: `❌ ${errorMessage}`,
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
            }
            else {
                await interaction.reply({ content: `❌ ${errorMessage}`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
        }
    },
    async handleModal(interaction) {
        if (interaction.customId === 'embed_create_panel') {
            const name = interaction.fields.getTextInputValue('template_name').trim();
            const title = interaction.fields.getTextInputValue('embed_title').trim();
            const description = interaction.fields.getTextInputValue('embed_description').trim();
            const colorStr = interaction.fields.getTextInputValue('embed_color')?.trim() || undefined;
            const colorNum = colorStr ? parseInt(colorStr.replace('#', ''), 16) : undefined;
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const service = EmbedBuilderService_1.EmbedBuilderService.getInstance();
                service.createEmbed(interaction.guildId ?? '', name, {
                    title,
                    description,
                    color: !isNaN(colorNum ?? NaN) ? colorNum : undefined,
                }, interaction.user.id);
                await interaction.editReply(`\u2705 Embed template **${name}** created.`);
            }
            catch (error) {
                const msg = (0, errorSanitizer_1.sanitizeErrorForUser)((0, errorHandler_1.getErrorMessage)(error) || 'Failed to create embed');
                await interaction.editReply(`\u274c ${msg}`);
            }
            return;
        }
        if (interaction.customId === 'embed_send_modal') {
            const name = interaction.fields.getTextInputValue('template_name').trim();
            const service = EmbedBuilderService_1.EmbedBuilderService.getInstance();
            const template = service.findByName(interaction.guildId ?? '', name);
            if (!template) {
                await interaction.reply({
                    content: `❌ Template "${name}" not found.`,
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            const context = {
                user: interaction.user,
                member: interaction.member && 'displayName' in interaction.member
                    ? interaction.member
                    : undefined,
                guild: interaction.guild ?? undefined,
            };
            const discordEmbed = service.buildDiscordEmbed(template, context);
            await interaction.reply({ content: '✅ Embed sent!', flags: discord_js_1.MessageFlags.Ephemeral });
            if (interaction.channel && 'send' in interaction.channel) {
                await interaction.channel.send({ embeds: [discordEmbed] });
            }
            return;
        }
        const createMatch = /^embed_create_(.+)$/.exec(interaction.customId);
        if (createMatch) {
            await handleCreateSubmit(interaction, createMatch[1]);
        }
    },
};
async function _handleCreate(interaction) {
    const name = interaction.options.getString('name', true);
    const modal = (0, panelEmbed_1.buildPanelModal)(`embed_create_${name}`, `Create Embed: ${name.substring(0, 30)}`, [
        {
            customId: 'embed_title',
            label: 'Title',
            style: 'short',
            placeholder: 'Embed title',
            required: true,
            maxLength: 256,
        },
        {
            customId: 'embed_description',
            label: 'Description',
            style: 'paragraph',
            placeholder: 'Embed description',
            required: true,
            maxLength: 2000,
        },
        {
            customId: 'embed_color',
            label: 'Color (hex, e.g., #00FF88)',
            style: 'short',
            placeholder: '#00FF88',
            required: false,
            maxLength: 7,
        },
        {
            customId: 'embed_footer',
            label: 'Footer text',
            style: 'short',
            placeholder: 'Optional footer text',
            required: false,
            maxLength: 200,
        },
    ]);
    await interaction.showModal(modal);
}
async function handleCreateSubmit(interaction, name) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const title = interaction.fields.getTextInputValue('embed_title');
    const description = interaction.fields.getTextInputValue('embed_description');
    let colorStr = '';
    let footer = '';
    try {
        colorStr = interaction.fields.getTextInputValue('embed_color');
    }
    catch {
    }
    try {
        footer = interaction.fields.getTextInputValue('embed_footer');
    }
    catch {
    }
    const color = colorStr ? Number.parseInt(colorStr.replace('#', ''), 16) || 0x00ff88 : 0x00ff88;
    const service = EmbedBuilderService_1.EmbedBuilderService.getInstance();
    const result = service.createEmbed(interaction.guildId ?? '', name, { title, description, color, footerText: footer || undefined }, interaction.user.id);
    if (typeof result === 'string') {
        await interaction.editReply({ content: `❌ ${result}` });
        return;
    }
    await interaction.editReply({
        content: `✅ Embed template **${name}** created! Use \`/embed send name:${name}\` to send it.`,
    });
}
async function _handleSend(interaction) {
    const name = interaction.options.getString('name', true);
    const service = EmbedBuilderService_1.EmbedBuilderService.getInstance();
    const template = service.findByName(interaction.guildId ?? '', name);
    if (!template) {
        await interaction.reply({
            content: `❌ Template "${name}" not found.`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const context = {
        user: interaction.user,
        member: interaction.member && 'displayName' in interaction.member ? interaction.member : undefined,
        guild: interaction.guild ?? undefined,
    };
    const discordEmbed = service.buildDiscordEmbed(template, context);
    await interaction.reply({ content: '✅ Embed sent!', flags: discord_js_1.MessageFlags.Ephemeral });
    if (interaction.channel && 'send' in interaction.channel) {
        await interaction.channel.send({ embeds: [discordEmbed] });
    }
}
//# sourceMappingURL=embed.js.map