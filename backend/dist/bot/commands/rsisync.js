"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsisync = void 0;
const discord_js_1 = require("discord.js");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const rsiSyncAdminActions_1 = require("./shared/rsiSyncAdminActions");
exports.rsisync = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('rsisync')
        .setDescription('Manage RSI role sync configuration and audit (admin)')
        .addBooleanOption(option => option
        .setName('public')
        .setDescription('Post the RSI sync panel publicly in this channel')
        .setRequired(false))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles),
    category: 'organization',
    examples: ['/rsisync'],
    permissions: ['ManageRoles'],
    guildOnly: true,
    cooldown: 10,
    handleButton: async (interaction) => {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'rsisync');
        if (!sub) {
            return;
        }
        if (!(0, rsiSyncAdminActions_1.isRsiSyncAdminAction)(sub)) {
            return;
        }
        await (0, rsiSyncAdminActions_1.handleRsiSyncAdminAction)(sub, interaction);
    },
    async execute(interaction) {
        const isPublicPanel = interaction.options.getBoolean('public') ?? false;
        const panelConfig = {
            prefix: 'rsisync',
            title: '🔄 RSI Role Sync Management',
            description: 'Configure and manage RSI role synchronisation for your organization.\n\n' +
                '• **Sync Status** — View current role mappings and sync health\n' +
                '• **Setup Wizard** — Configure RSI rank → Discord role mappings\n' +
                '• **Run Sync** — Manually trigger role synchronisation\n' +
                '• **Audit** — Review sync history and error logs\n\n' +
                '*Members: Use `/verify` to link your RSI account.*',
            buttons: [
                {
                    subcommand: 'status',
                    label: 'Sync Status',
                    emoji: '\ud83d\udcca',
                    style: discord_js_1.ButtonStyle.Primary,
                },
                {
                    subcommand: 'setup',
                    label: 'Setup Wizard',
                    emoji: '\ud83d\udd27',
                    style: discord_js_1.ButtonStyle.Success,
                },
                { subcommand: 'run', label: 'Run Sync', emoji: '\ud83d\udd04' },
                { subcommand: 'audit', label: 'Audit', emoji: '\ud83d\udcdd' },
            ],
        };
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig, isPublicPanel ? {} : { flags: discord_js_1.MessageFlags.Ephemeral });
    },
};
//# sourceMappingURL=rsisync.js.map