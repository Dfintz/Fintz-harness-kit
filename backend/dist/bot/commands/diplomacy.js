"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diplomacy = void 0;
exports.parseDiplomacyProposeModalType = parseDiplomacyProposeModalType;
const discord_js_1 = require("discord.js");
const errorHandler_1 = require("../../utils/errorHandler");
const botApiClient_1 = require("../utils/botApiClient");
const customId_1 = require("../utils/customId");
const ALLIANCE_TYPE_EMOJIS = {
    alliance: '🤝',
    trade: '💰',
    defense: '🛡️',
    neutral: '⚖️',
    hostile: '⚔️',
};
const DIPLOMACY_PREFIX = 'diplomacy';
function buildDiplomacyProposeModalCustomId(allianceType) {
    return (0, customId_1.buildCustomId)(DIPLOMACY_PREFIX, 'propose', 'modal', allianceType);
}
function parseDiplomacyProposeModalType(customId) {
    const parsed = (0, customId_1.parseCustomId)(customId);
    if (parsed.prefix !== DIPLOMACY_PREFIX || parsed.action !== 'propose') {
        return null;
    }
    const [kind = '', allianceType = ''] = parsed.params;
    if (kind !== 'modal' || allianceType.length === 0) {
        return null;
    }
    return allianceType;
}
exports.diplomacy = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('diplomacy')
        .setDescription('Organization diplomacy and alliance management'),
    cooldown: 5,
    category: 'organization',
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({
                content: '\u274c This command can only be used in a server.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        await handleCreatePanel(interaction);
    },
    async handleButton(interaction) {
        const customId = interaction.customId;
        if (customId === 'diplomacy_panel_status') {
            try {
                await handleStatus(interaction);
            }
            catch (error) {
                const msg = (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch diplomatic status');
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: `\u274c ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
                }
                else {
                    await interaction.reply({ content: `\u274c ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
                }
            }
        }
        else if (customId === 'diplomacy_panel_propose') {
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                .setCustomId('diplomacy_propose_type')
                .setPlaceholder('Select alliance type...')
                .addOptions({
                label: 'Alliance',
                value: 'alliance',
                emoji: '\ud83e\udd1d',
                description: 'Full cooperation and mutual support',
            }, {
                label: 'Trade Agreement',
                value: 'trade',
                emoji: '\ud83d\udcb0',
                description: 'Economic partnerships and trade routes',
            }, {
                label: 'Defense Pact',
                value: 'defense',
                emoji: '\ud83d\udee1\ufe0f',
                description: 'Mutual defense agreements',
            }, {
                label: 'Neutral',
                value: 'neutral',
                emoji: '\u2696\ufe0f',
                description: 'Non-aggression understanding',
            }));
            await interaction.reply({
                content: '**Step 1/2:** Select the type of diplomatic relation to propose:',
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        else if (customId === 'diplomacy_panel_incident') {
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId('diplomacy_panel_incident_modal')
                .setTitle('Report Diplomatic Incident');
            const relationIdInput = new discord_js_1.TextInputBuilder()
                .setCustomId('relation_id')
                .setPlaceholder('Enter the diplomacy relation ID')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100);
            const descriptionInput = new discord_js_1.TextInputBuilder()
                .setCustomId('description')
                .setPlaceholder('Describe what happened in detail...')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setRequired(true)
                .setMinLength(20)
                .setMaxLength(2000);
            const severityInput = new discord_js_1.TextInputBuilder()
                .setCustomId('severity')
                .setPlaceholder('e.g., medium')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(20);
            modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Relation ID').setTextInputComponent(relationIdInput), new discord_js_1.LabelBuilder().setLabel('Description').setTextInputComponent(descriptionInput), new discord_js_1.LabelBuilder()
                .setLabel('Severity (low / medium / high / critical)')
                .setTextInputComponent(severityInput));
            await interaction.showModal(modal);
        }
        else if (customId === 'diplomacy_panel_ticket') {
            await handleTicket(interaction);
        }
        else {
            await interaction.reply({
                content: '\u274c Unknown diplomacy action.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    },
    async handleSelectMenu(interaction) {
        const customId = interaction.customId;
        if (customId === 'diplomacy_propose_type') {
            const allianceType = interaction.values[0];
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(buildDiplomacyProposeModalCustomId(allianceType))
                .setTitle(`Propose ${allianceType.charAt(0).toUpperCase() + allianceType.slice(1)}`);
            const targetOrgInput = new discord_js_1.TextInputBuilder()
                .setCustomId('target_org')
                .setPlaceholder('Enter the target organization ID')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100);
            const termsInput = new discord_js_1.TextInputBuilder()
                .setCustomId('terms')
                .setPlaceholder('List the terms of this diplomatic agreement...')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setRequired(true)
                .setMinLength(20)
                .setMaxLength(2000);
            const notesInput = new discord_js_1.TextInputBuilder()
                .setCustomId('notes')
                .setPlaceholder('Any additional context or notes...')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(1000);
            modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Target Organization ID').setTextInputComponent(targetOrgInput), new discord_js_1.LabelBuilder().setLabel('Terms and Conditions').setTextInputComponent(termsInput), new discord_js_1.LabelBuilder().setLabel('Additional Notes').setTextInputComponent(notesInput));
            await interaction.showModal(modal);
        }
    },
    async handleModal(interaction) {
        const { customId } = interaction;
        const panelAllianceType = parseDiplomacyProposeModalType(customId);
        if (panelAllianceType) {
            const allianceType = panelAllianceType;
            const targetOrg = interaction.fields.getTextInputValue('target_org').trim();
            const terms = interaction.fields.getTextInputValue('terms').trim();
            const notes = interaction.fields.getTextInputValue('notes')?.trim() || undefined;
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const response = await botApiClient_1.botApiClient.post('/v2/alliance-diplomacy', {
                    targetOrganizationId: targetOrg,
                    allianceType,
                    terms: terms.split('\n').filter(t => t.trim()),
                    notes,
                }, { headers: (0, botApiClient_1.discordHeaders)(interaction) });
                const typeEmoji = ALLIANCE_TYPE_EMOJIS[allianceType] || '\ud83d\udccb';
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(0xffaa00)
                    .setTitle(`${typeEmoji} Diplomatic Proposal Sent`)
                    .setDescription(`A **${allianceType}** proposal has been sent to organization **${targetOrg}**.`)
                    .addFields({ name: 'Type', value: allianceType, inline: true }, { name: 'Status', value: 'Pending', inline: true })
                    .setTimestamp();
                if (response.data?.id) {
                    embed.setFooter({ text: `Relation ID: ${response.data.id}` });
                }
                await interaction.editReply({ embeds: [embed] });
            }
            catch (error) {
                await interaction.editReply({
                    content: `\u274c Failed to send proposal: ${(0, errorHandler_1.getErrorMessage)(error)}`,
                });
            }
        }
        else if (customId === 'diplomacy_panel_incident_modal') {
            const relationId = interaction.fields.getTextInputValue('relation_id').trim();
            const description = interaction.fields.getTextInputValue('description').trim();
            const severity = interaction.fields.getTextInputValue('severity').toLowerCase().trim();
            const validSeverities = ['low', 'medium', 'high', 'critical'];
            if (!validSeverities.includes(severity)) {
                await interaction.reply({
                    content: `\u274c Invalid severity. Must be one of: ${validSeverities.join(', ')}`,
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                await botApiClient_1.botApiClient.post(`/v2/alliance-diplomacy/${relationId}/incidents`, { description, severity }, { headers: (0, botApiClient_1.discordHeaders)(interaction) });
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(0xff4444)
                    .setTitle('\u26a0\ufe0f Diplomatic Incident Reported')
                    .setDescription(description.substring(0, 200))
                    .addFields({ name: 'Relation', value: relationId, inline: true }, { name: 'Severity', value: severity, inline: true })
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
            }
            catch (error) {
                await interaction.editReply({
                    content: `\u274c Failed to report incident: ${(0, errorHandler_1.getErrorMessage)(error)}`,
                });
            }
        }
        else if (customId.startsWith('diplomacy_propose_')) {
            const parts = customId.replace('diplomacy_propose_', '').split('_');
            const targetOrg = parts.slice(0, -1).join('_');
            const allianceType = parts[parts.length - 1];
            const terms = interaction.fields.getTextInputValue('terms').trim();
            const notes = interaction.fields.getTextInputValue('notes')?.trim() || undefined;
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const response = await botApiClient_1.botApiClient.post('/v2/alliance-diplomacy', {
                    targetOrganizationId: targetOrg,
                    allianceType,
                    terms: terms.split('\n').filter(t => t.trim()),
                    notes,
                }, { headers: (0, botApiClient_1.discordHeaders)(interaction) });
                const typeEmoji = ALLIANCE_TYPE_EMOJIS[allianceType] || '\ud83d\udccb';
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(0xffaa00)
                    .setTitle(`${typeEmoji} Diplomatic Proposal Sent`)
                    .setDescription(`A **${allianceType}** proposal has been sent to organization **${targetOrg}**.`)
                    .addFields({ name: 'Type', value: allianceType, inline: true }, { name: 'Status', value: 'Pending', inline: true })
                    .setTimestamp();
                if (response.data?.id) {
                    embed.setFooter({ text: `Relation ID: ${response.data.id}` });
                }
                await interaction.editReply({ embeds: [embed] });
            }
            catch (error) {
                await interaction.editReply({
                    content: `\u274c Failed to send proposal: ${(0, errorHandler_1.getErrorMessage)(error)}`,
                });
            }
        }
        else if (customId.startsWith('diplomacy_incident_modal_')) {
            const relationId = customId.replace('diplomacy_incident_modal_', '');
            const description = interaction.fields.getTextInputValue('description').trim();
            const severity = interaction.fields.getTextInputValue('severity').toLowerCase().trim();
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                await botApiClient_1.botApiClient.post(`/v2/alliance-diplomacy/${relationId}/incidents`, { description, severity }, { headers: (0, botApiClient_1.discordHeaders)(interaction) });
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(0xff4444)
                    .setTitle('\u26a0\ufe0f Diplomatic Incident Reported')
                    .setDescription(description.substring(0, 200))
                    .addFields({ name: 'Relation', value: relationId, inline: true }, { name: 'Severity', value: severity, inline: true })
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
            }
            catch (error) {
                await interaction.editReply({
                    content: `\u274c Failed to report incident: ${(0, errorHandler_1.getErrorMessage)(error)}`,
                });
            }
        }
        else if (customId === 'diplomacy_ticket_modal') {
            const subject = interaction.fields.getTextInputValue('subject').trim();
            const description = interaction.fields.getTextInputValue('description').trim();
            const involvedOrg = interaction.fields.getTextInputValue('involved_org')?.trim() || undefined;
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                await botApiClient_1.botApiClient.post('/v2/tickets', {
                    subject,
                    description,
                    category: 'diplomacy',
                    recipientType: 'diplomacy',
                    metadata: involvedOrg ? { involvedOrganization: involvedOrg } : undefined,
                }, { headers: (0, botApiClient_1.discordHeaders)(interaction) });
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(0x00d9ff)
                    .setTitle('\ud83c\udfab Diplomacy Ticket Created')
                    .setDescription(`**${subject}**\n\n${description.substring(0, 200)}...`)
                    .setTimestamp();
                if (involvedOrg) {
                    embed.addFields({ name: 'Involved Org(s)', value: involvedOrg, inline: true });
                }
                await interaction.editReply({ embeds: [embed] });
            }
            catch (error) {
                await interaction.editReply({
                    content: `\u274c Failed to create ticket: ${(0, errorHandler_1.getErrorMessage)(error)}`,
                });
            }
        }
        else {
            await interaction.reply({
                content: '\u274c Unknown diplomacy form.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    },
};
async function handleStatus(interaction) {
    await interaction.deferReply();
    try {
        const response = await botApiClient_1.botApiClient.get('/v2/alliance-diplomacy', {
            headers: (0, botApiClient_1.discordHeaders)(interaction),
        });
        const relations = response.data.data || response.data || [];
        if (relations.length === 0) {
            await interaction.editReply({
                content: '📭 No diplomatic relations established. Use `/diplomacy propose` to initiate one!',
            });
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x00d9ff)
            .setTitle('🌍 Diplomatic Relations Overview')
            .setDescription(`Your organization has ${relations.length} diplomatic relation(s)`)
            .setTimestamp();
        const active = relations.filter((r) => r.status === 'active');
        const proposed = relations.filter((r) => r.status === 'proposed');
        const suspended = relations.filter((r) => r.status === 'suspended');
        if (active.length > 0) {
            const activeList = active
                .slice(0, 5)
                .map((r) => {
                const typeEmoji = ALLIANCE_TYPE_EMOJIS[r.allianceType || ''] || '📋';
                return `${typeEmoji} **${r.orgId2}** - ${r.allianceType}`;
            })
                .join('\n');
            embed.addFields({
                name: `✅ Active Relations (${active.length})`,
                value: activeList,
                inline: false,
            });
        }
        if (proposed.length > 0) {
            const proposedList = proposed
                .slice(0, 5)
                .map((r) => {
                const typeEmoji = ALLIANCE_TYPE_EMOJIS[r.allianceType || ''] || '📋';
                return `${typeEmoji} **${r.orgId2}** - ${r.allianceType} (pending)`;
            })
                .join('\n');
            embed.addFields({
                name: `⏳ Pending Proposals (${proposed.length})`,
                value: proposedList,
                inline: false,
            });
        }
        if (suspended.length > 0) {
            const suspendedList = suspended
                .slice(0, 3)
                .map((r) => `⚠️ **${r.orgId2}** - ${r.allianceType}`)
                .join('\n');
            embed.addFields({
                name: `🔴 Suspended (${suspended.length})`,
                value: suspendedList,
                inline: false,
            });
        }
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId('diplomacy_propose')
            .setLabel('New Proposal')
            .setStyle(discord_js_1.ButtonStyle.Primary)
            .setEmoji('📝'), new discord_js_1.ButtonBuilder()
            .setCustomId('diplomacy_incident')
            .setLabel('Report Incident')
            .setStyle(discord_js_1.ButtonStyle.Danger)
            .setEmoji('⚠️'), new discord_js_1.ButtonBuilder()
            .setCustomId('diplomacy_ticket')
            .setLabel('Create Ticket')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('🎫'));
        await interaction.editReply({ embeds: [embed], components: [row] });
    }
    catch (error) {
        (0, errorHandler_1.logError)(error, 'DiplomacyCommand.handleStatus');
        await interaction.editReply({
            content: `❌ Failed to fetch diplomatic relations: ${(0, errorHandler_1.getErrorMessage)(error)}`,
        });
    }
}
async function handleTicket(interaction) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId('diplomacy_ticket_modal')
        .setTitle('🤝 Diplomacy Support Ticket');
    const subjectInput = new discord_js_1.TextInputBuilder()
        .setCustomId('subject')
        .setPlaceholder('Brief summary of the diplomatic issue')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(200);
    const descriptionInput = new discord_js_1.TextInputBuilder()
        .setCustomId('description')
        .setPlaceholder('Provide details about the diplomatic situation...')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(20)
        .setMaxLength(2000);
    const involvedOrgInput = new discord_js_1.TextInputBuilder()
        .setCustomId('involved_org')
        .setPlaceholder('Names or IDs of organizations involved')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(200);
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Subject').setTextInputComponent(subjectInput), new discord_js_1.LabelBuilder().setLabel('Description').setTextInputComponent(descriptionInput), new discord_js_1.LabelBuilder().setLabel('Involved Organization(s)').setTextInputComponent(involvedOrgInput));
    await interaction.showModal(modal);
}
async function handleCreatePanel(interaction) {
    if (!interaction.memberPermissions?.has('Administrator')) {
        await interaction.reply({
            content: '❌ You need Administrator permissions to create a diplomacy panel.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x00d9ff)
        .setTitle('🌍 Diplomatic Relations Center')
        .setDescription([
        "Manage your organization's diplomatic relations with other groups.",
        '',
        '**Available Actions:**',
        '• View current alliances and agreements',
        '• Propose new diplomatic relations',
        '• Report incidents that affect relations',
        '• Create support tickets for complex situations',
        '',
        '**Relation Types:**',
        '🤝 **Alliance** - Full cooperation and mutual support',
        '💰 **Trade** - Economic partnerships and trade routes',
        '🛡️ **Defense Pact** - Mutual defense agreements',
        '⚖️ **Neutral** - Non-aggression understanding',
    ].join('\n'))
        .setFooter({ text: 'Use the buttons below to get started' })
        .setTimestamp();
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('diplomacy_panel_status')
        .setLabel('View Relations')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('🌍'), new discord_js_1.ButtonBuilder()
        .setCustomId('diplomacy_panel_propose')
        .setLabel('New Proposal')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji('📝'), new discord_js_1.ButtonBuilder()
        .setCustomId('diplomacy_panel_incident')
        .setLabel('Report Incident')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('⚠️'), new discord_js_1.ButtonBuilder()
        .setCustomId('diplomacy_panel_ticket')
        .setLabel('Support Ticket')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🎫'));
    await interaction.reply({ content: 'Diplomacy panel created!', flags: discord_js_1.MessageFlags.Ephemeral });
    await interaction.channel?.send({ embeds: [embed], components: [row] });
}
//# sourceMappingURL=diplomacy.js.map