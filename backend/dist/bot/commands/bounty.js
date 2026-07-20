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
exports.bounty = void 0;
const discord_js_1 = require("discord.js");
const Bounty_1 = require("../../models/Bounty");
const BountyClaim_1 = require("../../models/BountyClaim");
const bountySchemas_1 = require("../../schemas/bountySchemas");
const bounty_1 = require("../../services/bounty");
const appUrls_1 = require("../utils/appUrls");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const customId_1 = require("../utils/customId");
const errorReply_1 = require("../utils/errorReply");
const guildContext_1 = require("../utils/guildContext");
const paginationControls_1 = require("../utils/paginationControls");
const sharedChoices_1 = require("../utils/sharedChoices");
let _services = null;
function getServices() {
    _services ??= {
        bountyService: new bounty_1.BountyService(),
        claimService: new bounty_1.BountyClaimService(),
        hunterProfileService: new bounty_1.HunterProfileService(),
    };
    return _services;
}
const pendingBountyCreates = new Map();
const PENDING_CREATE_TTL_MS = 10 * 60 * 1000;
function cleanPendingBountyCreates() {
    const now = Date.now();
    for (const [key, val] of pendingBountyCreates) {
        if (now - val.timestamp > PENDING_CREATE_TTL_MS) {
            pendingBountyCreates.delete(key);
        }
    }
}
function getBountyTypeEmoji(type) {
    switch (type) {
        case Bounty_1.BountyType.KILL:
            return '💀';
        case Bounty_1.BountyType.CAPTURE:
            return '🔗';
        case Bounty_1.BountyType.INTEL:
            return '🔍';
        case Bounty_1.BountyType.TRANSPORT:
            return '📦';
        case Bounty_1.BountyType.RESCUE:
            return '🆘';
        case Bounty_1.BountyType.CUSTOM:
            return '⭐';
        default:
            return '🎯';
    }
}
function getStatusEmoji(status) {
    switch (status) {
        case Bounty_1.BountyStatus.ACTIVE:
            return '🟢';
        case Bounty_1.BountyStatus.CLAIMED:
            return '🟡';
        case Bounty_1.BountyStatus.IN_PROGRESS:
            return '🔵';
        case Bounty_1.BountyStatus.COMPLETED:
            return '✅';
        case Bounty_1.BountyStatus.VERIFIED:
            return '✔️';
        case Bounty_1.BountyStatus.PAID:
            return '💰';
        case Bounty_1.BountyStatus.CANCELLED:
            return '❌';
        case Bounty_1.BountyStatus.EXPIRED:
            return '⏰';
        default:
            return '❓';
    }
}
function getStatusColor(status) {
    switch (status) {
        case Bounty_1.BountyStatus.ACTIVE:
            return 0x00ff00;
        case Bounty_1.BountyStatus.CLAIMED:
        case Bounty_1.BountyStatus.IN_PROGRESS:
            return 0xffff00;
        case Bounty_1.BountyStatus.COMPLETED:
        case Bounty_1.BountyStatus.VERIFIED:
            return 0x0099ff;
        case Bounty_1.BountyStatus.PAID:
            return 0x00ffff;
        case Bounty_1.BountyStatus.CANCELLED:
        case Bounty_1.BountyStatus.EXPIRED:
            return 0xff0000;
        default:
            return 0x808080;
    }
}
function _getDifficultyEmoji(difficulty) {
    switch (difficulty) {
        case Bounty_1.BountyDifficulty.EASY:
            return '🟢';
        case Bounty_1.BountyDifficulty.MEDIUM:
            return '🟡';
        case Bounty_1.BountyDifficulty.HARD:
            return '🟠';
        case Bounty_1.BountyDifficulty.EXPERT:
            return '🔴';
        default:
            return '⚪';
    }
}
function getClaimStatusEmoji(status) {
    switch (status) {
        case BountyClaim_1.BountyClaimStatus.COMPLETED:
            return '✅';
        case BountyClaim_1.BountyClaimStatus.SUBMITTED:
            return '📤';
        case BountyClaim_1.BountyClaimStatus.ACTIVE:
            return '🟡';
        case BountyClaim_1.BountyClaimStatus.ABANDONED:
            return '🚫';
        case BountyClaim_1.BountyClaimStatus.REJECTED:
            return '❌';
        default:
            return '❓';
    }
}
async function handleBountyStats(ctx) {
    const { interaction, guildId, bountyService } = ctx;
    const stats = await bountyService.getStatistics(guildId);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📊 Bounty Statistics')
        .addFields({ name: 'Total Bounties', value: stats.totalBounties.toString(), inline: true }, { name: 'Active Bounties', value: stats.activeBounties.toString(), inline: true }, { name: 'Completed', value: stats.completedBounties.toString(), inline: true }, { name: 'Currently Claimed', value: stats.claimedBounties.toString(), inline: true }, {
        name: 'Total Rewards Posted',
        value: `${stats.totalRewardsPosted.toLocaleString()} aUEC`,
        inline: true,
    }, {
        name: 'Total Rewards Paid',
        value: `${stats.totalRewardsPaid.toLocaleString()} aUEC`,
        inline: true,
    })
        .setTimestamp();
    const typeBreakdown = Object.entries(stats.byType)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => `${getBountyTypeEmoji(type)} ${type}: ${count}`)
        .join('\n');
    if (typeBreakdown) {
        embed.addFields({ name: 'By Type', value: typeBreakdown, inline: false });
    }
    await interaction.editReply({ embeds: [embed] });
}
async function handleBountyMyClaims(ctx) {
    const { interaction, userId, claimService } = ctx;
    const claims = await claimService.getActiveClaimsByHunter(userId);
    if (claims.length === 0) {
        await interaction.editReply({
            content: '📋 You have no active bounty claims. Use `/bounty claim id:<bounty_id>` to claim a bounty!',
        });
        return;
    }
    await interaction.editReply(_buildClaimsView(claims, 0));
}
const BOUNTY_PANEL_PREFIX = 'bounty';
const BOUNTY_CLAIMS_PAGE_ACTION = 'claimspage';
const BOUNTY_LIST_PAGE_ACTION = 'listpage';
const BOUNTY_CLAIMS_PAGE_SCOPE = (0, customId_1.buildCustomId)(BOUNTY_PANEL_PREFIX, BOUNTY_CLAIMS_PAGE_ACTION);
const BOUNTY_LIST_PAGE_SCOPE = (0, customId_1.buildCustomId)(BOUNTY_PANEL_PREFIX, BOUNTY_LIST_PAGE_ACTION);
function parseBountyPageCustomId(customId, action) {
    const parsed = (0, customId_1.parseCustomId)(customId);
    if (parsed.prefix !== BOUNTY_PANEL_PREFIX || parsed.action !== action) {
        return null;
    }
    const [pageParam = ''] = parsed.params;
    const page = Number.parseInt(pageParam, 10);
    return Number.isNaN(page) || page < 0 ? null : page;
}
async function handleBountyClaimsPageButton(interaction) {
    const page = parseBountyPageCustomId(interaction.customId, BOUNTY_CLAIMS_PAGE_ACTION);
    if (page === null) {
        return;
    }
    const { claimService } = getServices();
    const claims = await claimService.getActiveClaimsByHunter(interaction.user.id);
    if (claims.length === 0) {
        await interaction.update({
            content: '📋 You have no active bounty claims. Use `/bounty claim id:<bounty_id>` to claim a bounty!',
            embeds: [],
            components: [],
        });
        return;
    }
    await interaction.update(_buildClaimsView(claims, page));
}
function _buildClaimsView(claims, page) {
    const { pageItems, page: currentPage, totalPages, total, } = (0, paginationControls_1.paginate)(claims, page, BOUNTY_CLAIMS_PAGE_SIZE);
    const pluralSuffix = total === 1 ? '' : 's';
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🎯 Your Active Bounty Claims')
        .setDescription(`You have ${total} active claim${pluralSuffix}`)
        .setTimestamp();
    for (const claim of pageItems) {
        const bounty = claim.bounty;
        const evidenceCount = claim.evidence?.length || 0;
        const evidenceSuffix = evidenceCount === 1 ? '' : 's';
        const statusEmoji = getClaimStatusEmoji(claim.status);
        embed.addFields({
            name: `${statusEmoji} ${bounty?.title || 'Unknown Bounty'}`,
            value: `ID: \`${claim.bountyId.substring(0, 8)}...\`\nStatus: ${claim.status}\nEvidence: ${evidenceCount} item${evidenceSuffix}\nClaimed: ${new Date(claim.claimedAt).toLocaleDateString()}`,
            inline: false,
        });
    }
    if (totalPages > 1) {
        embed.setFooter({ text: `Page ${currentPage + 1} of ${totalPages} • ${total} claims` });
    }
    const navRow = (0, paginationControls_1.buildPaginationRow)({
        page: currentPage,
        totalPages,
        makeCustomId: targetPage => (0, customId_1.buildCustomId)(BOUNTY_PANEL_PREFIX, BOUNTY_CLAIMS_PAGE_ACTION, String(targetPage)),
    });
    return { embeds: [embed], components: navRow ? [navRow] : [] };
}
async function _fetchActiveBountiesPage(bountyService, orgId, uiPage) {
    const requested = await bountyService.searchBounties(orgId, { status: Bounty_1.BountyStatus.ACTIVE }, uiPage + 1, BOUNTY_LIST_PAGE_SIZE);
    const totalPages = Math.max(1, requested.totalPages);
    if (requested.bounties.length === 0 && requested.total > 0 && uiPage > totalPages - 1) {
        const lastPage = totalPages - 1;
        const clamped = await bountyService.searchBounties(orgId, { status: Bounty_1.BountyStatus.ACTIVE }, lastPage + 1, BOUNTY_LIST_PAGE_SIZE);
        return {
            bounties: clamped.bounties,
            page: lastPage,
            totalPages: Math.max(1, clamped.totalPages),
            total: clamped.total,
        };
    }
    return { bounties: requested.bounties, page: uiPage, totalPages, total: requested.total };
}
async function _buildActiveBountiesView(bountyService, orgId, uiPage) {
    const { bounties, page, totalPages, total } = await _fetchActiveBountiesPage(bountyService, orgId, uiPage);
    if (total === 0) {
        return { content: '📋 No active bounties found.', embeds: [], components: [] };
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🎯 Active Bounties')
        .setDescription(`${total} active ${total === 1 ? 'bounty' : 'bounties'}`)
        .setTimestamp();
    for (const b of bounties) {
        const rewardText = b.rewardAmount
            ? `💰 ${b.rewardAmount.toLocaleString()} aUEC`
            : b.rewardDescription || 'Negotiable';
        embed.addFields({
            name: `${getBountyTypeEmoji(b.bountyType)} ${b.title}`,
            value: `ID: \`${b.id}\` | ${rewardText}`,
        });
    }
    if (totalPages > 1) {
        embed.setFooter({ text: `Page ${page + 1} of ${totalPages} • ${total} bounties` });
    }
    const navRow = (0, paginationControls_1.buildPaginationRow)({
        page,
        totalPages,
        makeCustomId: targetPage => (0, customId_1.buildCustomId)(BOUNTY_PANEL_PREFIX, BOUNTY_LIST_PAGE_ACTION, String(targetPage)),
    });
    return { embeds: [embed], components: navRow ? [navRow] : [] };
}
async function handleBountyListPageButton(interaction) {
    const page = parseBountyPageCustomId(interaction.customId, BOUNTY_LIST_PAGE_ACTION);
    if (page === null) {
        return;
    }
    const ctx = await (0, guildContext_1.resolveGuildContext)(interaction);
    if (!ctx) {
        return;
    }
    const { bountyService } = getServices();
    await interaction.update(await _buildActiveBountiesView(bountyService, ctx.organizationId, page));
}
async function handleBountyPending(ctx) {
    const { interaction, guildId, userId, claimService } = ctx;
    const pendingClaims = await claimService.getPendingApprovalsForCreator(guildId, userId);
    if (pendingClaims.length === 0) {
        await interaction.editReply({
            content: '📋 You have no bounty claims pending approval.',
        });
        return;
    }
    const pluralSuffix = pendingClaims.length === 1 ? '' : 's';
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0xffa500)
        .setTitle('📋 Pending Bounty Approvals')
        .setDescription(`You have ${pendingClaims.length} claim${pluralSuffix} awaiting your review.`)
        .setTimestamp();
    for (const claim of pendingClaims.slice(0, 10)) {
        const bounty = claim.bounty;
        const evidenceCount = claim.evidence?.length || 0;
        const evidenceSuffix = evidenceCount === 1 ? '' : 's';
        embed.addFields({
            name: `📤 ${bounty?.title || 'Unknown Bounty'}`,
            value: `ID: \`${claim.bountyId.substring(0, 8)}...\`\nHunter: ${claim.hunterName || 'Unknown'}\nEvidence: ${evidenceCount} item${evidenceSuffix}\nSubmitted: ${claim.submittedAt ? new Date(claim.submittedAt).toLocaleDateString() : 'N/A'}`,
            inline: false,
        });
    }
    const footer = pendingClaims.length > 10
        ? `Showing 10 of ${pendingClaims.length} pending claims`
        : 'Use /bounty approve id:<bounty_id> or /bounty reject id:<bounty_id> reason:<reason>';
    embed.setFooter({ text: footer });
    await interaction.editReply({ embeds: [embed] });
}
async function handleBountyHistory(ctx) {
    const { interaction, guildId, userId, hunterProfileService } = ctx;
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const targetUserId = targetUser.id;
    const targetUserName = targetUser.username;
    const page = interaction.options.getInteger('page') || 1;
    const result = await hunterProfileService.getHunterHistory(guildId, targetUserId, page, 10);
    if (result.history.length === 0) {
        const noHistoryMsg = targetUserId === userId
            ? "📋 You haven't completed any bounties yet. Use `/bounty claim id:<bounty_id>` to claim a bounty!"
            : `📋 ${targetUserName} hasn't completed any bounties yet.`;
        await interaction.editReply({ content: noHistoryMsg });
        return;
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`📜 Bounty History: ${targetUserName}`)
        .setDescription(`Page ${result.page} of ${result.totalPages} (${result.total} total bounties)`)
        .setTimestamp();
    for (const entry of result.history) {
        const statusEmoji = getClaimStatusEmoji(entry.status);
        const typeEmoji = getBountyTypeEmoji(entry.bountyType);
        const rewardText = entry.rewardAmount
            ? `💰 ${entry.rewardAmount.toLocaleString()} aUEC`
            : 'Negotiable';
        const completedText = entry.completedAt
            ? `\nCompleted: ${new Date(entry.completedAt).toLocaleDateString()}`
            : '';
        embed.addFields({
            name: `${typeEmoji} ${entry.bountyTitle}`,
            value: `Status: ${statusEmoji} ${entry.status}\nReward: ${rewardText}\nClaimed: ${new Date(entry.claimedAt).toLocaleDateString()}${completedText}`,
            inline: false,
        });
    }
    if (result.totalPages > 1) {
        embed.setFooter({ text: `Use /bounty history page:${page + 1} to see more` });
    }
    await interaction.editReply({ embeds: [embed] });
}
exports.bounty = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('bounty')
        .setDescription('Bounty board — create, claim, and track bounties'),
    category: 'social',
    cooldown: 3,
    guildOnly: true,
    async handleButton(interaction) {
        await handleBountyButton(interaction);
    },
    async handleSelectMenu(interaction) {
        await handleBountySelectMenu(interaction);
    },
    async handleModal(interaction) {
        await handleBountyModal(interaction);
    },
    async execute(interaction) {
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, BOUNTY_PANEL_CONFIG);
    },
};
const BOUNTY_CLAIMS_PAGE_SIZE = 10;
const BOUNTY_LIST_PAGE_SIZE = 10;
const BOUNTY_PANEL_CONFIG = {
    prefix: BOUNTY_PANEL_PREFIX,
    title: '\ud83c\udfaf Bounty Board',
    description: 'Manage bounties, claims, and your hunter profile.',
    buttons: [
        {
            subcommand: 'list',
            label: 'Browse Bounties',
            emoji: '\ud83d\udccb',
            style: discord_js_1.ButtonStyle.Primary,
        },
        { subcommand: 'myclaims', label: 'My Claims', emoji: '\ud83d\udccc' },
        { subcommand: 'pending', label: 'Pending Review', emoji: '\u23f3' },
        { subcommand: 'stats', label: 'Stats', emoji: '\ud83d\udcca' },
        { subcommand: 'history', label: 'History', emoji: '\ud83d\udcdc' },
        { subcommand: 'view', label: 'View Bounty', emoji: '\ud83d\udd0d' },
        { subcommand: 'claim', label: 'Claim Bounty', emoji: '\ud83c\udfaf' },
        {
            subcommand: 'create',
            label: 'Create Bounty',
            emoji: '\u270f\ufe0f',
            style: discord_js_1.ButtonStyle.Success,
        },
        { subcommand: 'hunter', label: 'Hunter Profile', emoji: '\ud83e\uddd1\u200d\ud83d\ude80' },
    ],
};
async function handleBountyButton(interaction) {
    const scope = (0, customId_1.customIdScope)(interaction.customId);
    if (scope === BOUNTY_CLAIMS_PAGE_SCOPE) {
        await handleBountyClaimsPageButton(interaction);
        return;
    }
    if (scope === BOUNTY_LIST_PAGE_SCOPE) {
        await handleBountyListPageButton(interaction);
        return;
    }
    const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, BOUNTY_PANEL_PREFIX);
    if (!sub) {
        return;
    }
    const services = getServices();
    const ctx0 = await (0, guildContext_1.resolveGuildContext)(interaction);
    if (!ctx0) {
        return;
    }
    const guildId = ctx0.organizationId;
    const userId = interaction.user.id;
    const userName = interaction.user.username;
    if (sub === 'hunter') {
        const { buildCommandPanel } = await Promise.resolve().then(() => __importStar(require('../utils/commandPanelBuilder')));
        const { embed, components } = buildCommandPanel({
            prefix: 'hunter',
            title: '\ud83c\udfaf Hunter Profile',
            description: 'View your bounty hunter profile, claims, and stats.',
            buttons: [
                {
                    subcommand: 'profile',
                    label: 'My Profile',
                    emoji: '\ud83d\udc64',
                    style: discord_js_1.ButtonStyle.Primary,
                },
                { subcommand: 'myclaims', label: 'My Claims', emoji: '\ud83d\udccc' },
                { subcommand: 'stats', label: 'Statistics', emoji: '\ud83d\udcca' },
                { subcommand: 'board', label: 'Leaderboard', emoji: '\ud83c\udfc6' },
            ],
        });
        await interaction.reply({ embeds: [embed], components, flags: discord_js_1.MessageFlags.Ephemeral });
        return;
    }
    switch (sub) {
        case 'list':
        case 'myclaims':
        case 'pending':
        case 'stats':
        case 'history': {
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            const ctx = {
                interaction: interaction,
                guildId,
                userId,
                userName,
                ...services,
            };
            try {
                switch (sub) {
                    case 'list': {
                        await interaction.editReply(await _buildActiveBountiesView(services.bountyService, guildId, 0));
                        break;
                    }
                    case 'myclaims':
                        await handleBountyMyClaims(ctx);
                        break;
                    case 'pending':
                        await handleBountyPending(ctx);
                        break;
                    case 'stats':
                        await handleBountyStats(ctx);
                        break;
                    case 'history':
                        await handleBountyHistory(ctx);
                        break;
                }
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
                await interaction.editReply({ content: `❌ Error: ${msg}` });
            }
            break;
        }
        case 'view':
        case 'claim': {
            try {
                await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
                const result = await services.bountyService.searchBounties(guildId, { status: Bounty_1.BountyStatus.ACTIVE }, 1, 25);
                if (result.bounties.length > 0) {
                    const options = result.bounties.map(b => ({
                        label: (b.title || 'Untitled Bounty').substring(0, 100),
                        value: b.id,
                        description: b.rewardAmount
                            ? `${b.bountyType} \u2022 ${b.rewardAmount.toLocaleString()} aUEC`.substring(0, 100)
                            : `${b.bountyType}`.substring(0, 100),
                        emoji: getBountyTypeEmoji(b.bountyType),
                    }));
                    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                        .setCustomId(`${BOUNTY_PANEL_PREFIX}_select_${sub}`)
                        .setPlaceholder(`Select a bounty to ${sub}...`)
                        .addOptions(options));
                    await interaction.editReply({
                        content: `Select a bounty to ${sub}:`,
                        components: [row],
                    });
                    return;
                }
                await interaction.editReply('No active bounties found.');
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ content: `\u274c Error: ${msg}` });
                }
                else {
                    await showBountyIdModal(interaction, sub, sub === 'view' ? 'View Bounty' : 'Claim Bounty');
                }
            }
            break;
        }
        case 'create': {
            const row = (0, sharedChoices_1.buildBountyTypeSelect)(`${BOUNTY_PANEL_PREFIX}_select_create_type`);
            await interaction.reply({
                content: '🎯 **Create Bounty** — What type of bounty is this?',
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            break;
        }
    }
}
async function handleBountySelectMenu(interaction) {
    const { customId } = interaction;
    const services = getServices();
    const ctx0 = await (0, guildContext_1.resolveGuildContext)(interaction);
    if (!ctx0) {
        return;
    }
    const guildId = ctx0.organizationId;
    const userId = interaction.user.id;
    const userName = interaction.user.username;
    if (customId === `${BOUNTY_PANEL_PREFIX}_select_create_type`) {
        cleanPendingBountyCreates();
        const selectedType = interaction.values[0];
        if (!Object.values(Bounty_1.BountyType).includes(selectedType)) {
            await interaction.reply({
                content: '❌ Invalid bounty type selected.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        pendingBountyCreates.set(interaction.user.id, {
            bountyType: selectedType,
            timestamp: Date.now(),
        });
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId(`${BOUNTY_PANEL_PREFIX}_modal_create`)
            .setTitle(`Create ${getBountyTypeEmoji(selectedType)} ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Bounty`);
        const titleInput = new discord_js_1.TextInputBuilder()
            .setCustomId('title')
            .setPlaceholder('Enter a title for the bounty')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);
        const descInput = new discord_js_1.TextInputBuilder()
            .setCustomId('description')
            .setPlaceholder('Describe the bounty objective...')
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);
        const rewardInput = new discord_js_1.TextInputBuilder()
            .setCustomId('reward')
            .setPlaceholder('e.g. 50000')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(20);
        modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Bounty Title').setTextInputComponent(titleInput), new discord_js_1.LabelBuilder().setLabel('Description').setTextInputComponent(descInput), new discord_js_1.LabelBuilder().setLabel('Reward Amount (aUEC)').setTextInputComponent(rewardInput));
        await interaction.showModal(modal);
        return;
    }
    if (customId === `${BOUNTY_PANEL_PREFIX}_select_view`) {
        const bountyId = interaction.values[0];
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const bounty = await services.bountyService.getBountyById(bountyId, guildId);
            if (!bounty) {
                await interaction.editReply({ content: `\u274c Bounty not found.` });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(getStatusColor(bounty.status))
                .setTitle(`${getBountyTypeEmoji(bounty.bountyType)} ${bounty.title}`)
                .setURL((0, appUrls_1.buildAppUrl)('/bounties'))
                .setDescription(bounty.description || 'No description')
                .addFields({ name: 'ID', value: `\`${bounty.id}\``, inline: true }, {
                name: 'Status',
                value: `${getStatusEmoji(bounty.status)} ${bounty.status}`,
                inline: true,
            }, { name: 'Type', value: bounty.bountyType, inline: true })
                .setTimestamp();
            if (bounty.rewardAmount) {
                embed.addFields({
                    name: 'Reward',
                    value: `\ud83d\udcb0 ${bounty.rewardAmount.toLocaleString()} aUEC`,
                    inline: true,
                });
            }
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
            await interaction.editReply({ content: `\u274c Error: ${msg}` });
        }
    }
    else if (customId === `${BOUNTY_PANEL_PREFIX}_select_claim`) {
        const bountyId = interaction.values[0];
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            await services.bountyService.claimBounty(guildId, bountyId, userId, userName);
            await interaction.editReply({
                content: `\u2705 You have claimed this bounty. Good hunting!`,
            });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
            await interaction.editReply({ content: `\u274c Error: ${msg}` });
        }
    }
}
async function showBountyIdModal(interaction, action, title) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`${BOUNTY_PANEL_PREFIX}_modal_${action}`)
        .setTitle(title);
    const idInput = new discord_js_1.TextInputBuilder()
        .setCustomId('bounty_id')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('Enter the bounty ID')
        .setRequired(true)
        .setMaxLength(100);
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Bounty ID').setTextInputComponent(idInput));
    await interaction.showModal(modal);
}
async function handleBountyModal(interaction) {
    const { customId } = interaction;
    const services = getServices();
    const ctx0 = await (0, guildContext_1.resolveGuildContext)(interaction);
    if (!ctx0) {
        return;
    }
    const guildId = ctx0.organizationId;
    const userId = interaction.user.id;
    const userName = interaction.user.username;
    if (customId === `${BOUNTY_PANEL_PREFIX}_modal_view`) {
        const bountyId = interaction.fields.getTextInputValue('bounty_id').trim();
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const bounty = await services.bountyService.getBountyById(bountyId, guildId);
            if (!bounty) {
                await interaction.editReply({ content: `❌ Bounty \`${bountyId}\` not found.` });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(getStatusColor(bounty.status))
                .setTitle(`${getBountyTypeEmoji(bounty.bountyType)} ${bounty.title}`)
                .setURL((0, appUrls_1.buildAppUrl)('/bounties'))
                .setDescription(bounty.description || 'No description')
                .addFields({ name: 'ID', value: `\`${bounty.id}\``, inline: true }, {
                name: 'Status',
                value: `${getStatusEmoji(bounty.status)} ${bounty.status}`,
                inline: true,
            }, { name: 'Type', value: bounty.bountyType, inline: true })
                .setTimestamp();
            if (bounty.rewardAmount) {
                embed.addFields({
                    name: 'Reward',
                    value: `💰 ${bounty.rewardAmount.toLocaleString()} aUEC`,
                    inline: true,
                });
            }
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
            await interaction.editReply({ content: `❌ Error: ${msg}` });
        }
    }
    else if (customId === `${BOUNTY_PANEL_PREFIX}_modal_claim`) {
        const bountyId = interaction.fields.getTextInputValue('bounty_id').trim();
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            await services.bountyService.claimBounty(guildId, bountyId, userId, userName);
            await interaction.editReply({
                content: `✅ You have claimed bounty \`${bountyId}\`. Good hunting!`,
            });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
            await interaction.editReply({ content: `❌ Error: ${msg}` });
        }
    }
    else if (customId === `${BOUNTY_PANEL_PREFIX}_modal_create`) {
        const title = interaction.fields.getTextInputValue('title').trim();
        const description = interaction.fields.getTextInputValue('description').trim();
        const rewardStr = interaction.fields.getTextInputValue('reward')?.trim();
        const rewardAmount = rewardStr ? parseInt(rewardStr, 10) : undefined;
        const pending = pendingBountyCreates.get(interaction.user.id);
        const bountyType = pending?.bountyType ?? Bounty_1.BountyType.CUSTOM;
        pendingBountyCreates.delete(interaction.user.id);
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const { error: validationError, value: validated } = bountySchemas_1.bountySchemas.create.validate({
                title,
                description: description || undefined,
                bountyType,
                targetType: Bounty_1.BountyTargetType.OTHER,
                rewardType: rewardAmount ? Bounty_1.BountyRewardType.CREDITS : Bounty_1.BountyRewardType.OTHER,
                rewardAmount: rewardAmount && !isNaN(rewardAmount) ? rewardAmount : undefined,
            }, { abortEarly: false, stripUnknown: true });
            if (validationError) {
                await (0, errorReply_1.replyWithError)(interaction, validationError, { context: 'bounty.create.modal' });
                return;
            }
            const bounty = await services.bountyService.createBounty(guildId, userId, userName, validated);
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0x57f287)
                .setTitle(`${getBountyTypeEmoji(bounty.bountyType)} Bounty Created`)
                .setDescription(`**${bounty.title}**`)
                .addFields({ name: 'ID', value: `\`${bounty.id}\``, inline: true }, {
                name: 'Status',
                value: `${getStatusEmoji(bounty.status)} ${bounty.status}`,
                inline: true,
            })
                .setTimestamp();
            if (bounty.rewardAmount) {
                embed.addFields({
                    name: 'Reward',
                    value: `💰 ${bounty.rewardAmount.toLocaleString()} aUEC`,
                    inline: true,
                });
            }
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            await (0, errorReply_1.replyWithError)(interaction, error, { context: 'bounty.create.modal' });
        }
    }
}
//# sourceMappingURL=bounty.js.map