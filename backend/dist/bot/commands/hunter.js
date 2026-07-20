"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hunter = void 0;
const discord_js_1 = require("discord.js");
const BountyClaim_1 = require("../../models/BountyClaim");
const HunterProfile_1 = require("../../models/HunterProfile");
const bounty_1 = require("../../services/bounty");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const guildContext_1 = require("../utils/guildContext");
let _services = null;
function getServices() {
    _services ??= {
        claimService: new bounty_1.BountyClaimService(),
        hunterProfileService: new bounty_1.HunterProfileService(),
    };
    return _services;
}
function getRankEmoji(rank) {
    switch (rank) {
        case HunterProfile_1.HunterRank.LEGENDARY:
            return '👑';
        case HunterProfile_1.HunterRank.ELITE:
            return '💎';
        case HunterProfile_1.HunterRank.VETERAN:
            return '⭐';
        case HunterProfile_1.HunterRank.HUNTER:
            return '🎯';
        case HunterProfile_1.HunterRank.APPRENTICE:
            return '🔰';
        case HunterProfile_1.HunterRank.ROOKIE:
        default:
            return '🆕';
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
exports.hunter = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('hunter')
        .setDescription('Manage hunter profile and view stats'),
    category: 'social',
    handleButton: async (interaction) => {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'hunter');
        if (!sub) {
            return;
        }
        const { claimService, hunterProfileService } = getServices();
        const ctx0 = await (0, guildContext_1.resolveGuildContext)(interaction);
        if (!ctx0) {
            return;
        }
        const guildId = ctx0.organizationId;
        const userId = interaction.user.id;
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            switch (sub) {
                case 'profile': {
                    const profile = await hunterProfileService.getOrCreateProfile(guildId, userId, interaction.user.username);
                    const rankEmoji = getRankEmoji(profile.rank);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setColor(0x5865f2)
                        .setTitle(`${rankEmoji} Hunter Profile`)
                        .addFields({ name: 'Rank', value: `${rankEmoji} ${profile.rank}`, inline: true }, { name: 'Reputation', value: `${profile.reputationScore}`, inline: true }, { name: 'Completed', value: `${profile.totalBountiesCompleted}`, inline: true })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'myclaims': {
                    const claims = await claimService.getClaimsByHunter(userId);
                    if (claims.length === 0) {
                        await interaction.editReply('\ud83d\udced No bounty claims found.');
                        return;
                    }
                    const lines = claims
                        .slice(0, 10)
                        .map(c => `${getClaimStatusEmoji(c.status)} **${c.bounty?.title || c.bountyId}** \u2014 ${c.status}`);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setColor(0x5865f2)
                        .setTitle('\ud83d\udccc My Bounty Claims')
                        .setDescription(lines.join('\n'))
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'stats': {
                    const profile = await hunterProfileService.getOrCreateProfile(guildId, userId, interaction.user.username);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setColor(0x5865f2)
                        .setTitle('\ud83d\udcca Hunter Statistics')
                        .addFields({
                        name: 'Bounties Completed',
                        value: `${profile.totalBountiesCompleted}`,
                        inline: true,
                    }, { name: 'Success Rate', value: `${profile.successRate ?? 0}%`, inline: true }, { name: 'Reputation', value: `${profile.reputationScore}`, inline: true })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'board': {
                    const lb = await hunterProfileService.getLeaderboard(guildId, 'reputation', 10);
                    if (lb.length === 0) {
                        await interaction.editReply('\ud83d\udced No hunter data yet.');
                        return;
                    }
                    const lines = lb.map((h, i) => `**${i + 1}.** ${getRankEmoji(h.rank)} ${h.userName ?? 'Unknown'} \u2014 Rep: ${h.reputationScore}`);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setColor(0x5865f2)
                        .setTitle('\ud83c\udfc6 Hunter Leaderboard')
                        .setDescription(lines.join('\n'))
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                default:
                    break;
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'An error occurred';
            await interaction.editReply({ content: `\u274c ${msg}` });
        }
    },
    async execute(interaction) {
        const panelConfig = {
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
        };
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig);
    },
};
//# sourceMappingURL=hunter.js.map