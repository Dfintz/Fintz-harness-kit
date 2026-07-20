"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVerificationCompleteEmbed = buildVerificationCompleteEmbed;
exports.buildVerificationPendingEmbed = buildVerificationPendingEmbed;
exports.buildNoRsiLinkEmbed = buildNoRsiLinkEmbed;
exports.buildRsiLinkStatusEmbed = buildRsiLinkStatusEmbed;
exports.buildRsiLinkStatusNotLinkedEmbed = buildRsiLinkStatusNotLinkedEmbed;
exports.buildRsiUnlinkedEmbed = buildRsiUnlinkedEmbed;
exports.buildDiscordAccountNotLinkedEmbed = buildDiscordAccountNotLinkedEmbed;
exports.buildRsiLinkInitiatedEmbed = buildRsiLinkInitiatedEmbed;
const embedBuilder_1 = require("../utils/embedBuilder");
function buildVerificationCompleteEmbed(rsiHandle) {
    return embedBuilder_1.SCFleetEmbed.success('RSI Verification Complete', `Your RSI handle **${rsiHandle}** has been verified!\n\n` +
        'You can now remove the verification link from your RSI bio.')
        .setTimestamp()
        .build();
}
function buildVerificationPendingEmbed(error) {
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.WARNING)
        .setTitle('\u23f3 Verification Not Yet Complete')
        .setDescription(error ??
        'Verification link not found in your RSI bio. Make sure you saved your bio and try again.')
        .setTimestamp()
        .build();
}
function buildNoRsiLinkEmbed() {
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.CLOSED)
        .setTitle('\u23f3 No RSI Link Found')
        .setDescription('You have not linked an RSI handle yet.\nClick **Link RSI** on the verification panel to get started.')
        .setTimestamp()
        .build();
}
function getSyncStatusIcon(syncStatus) {
    switch (syncStatus) {
        case 'synced':
            return '\u{1F7E2}';
        case 'failed':
            return '\u{1F534}';
        case 'removed':
            return '\u{1F6AA}';
        default:
            return '\u{1F7E1}';
    }
}
function buildRsiLinkStatusEmbed(link) {
    const verified = link.verifiedAt !== null && link.verifiedAt !== undefined;
    const syncStatus = link.syncStatus ?? 'pending';
    const statusIcon = verified ? '\u2705' : '\u23f3';
    const syncIcon = getSyncStatusIcon(syncStatus);
    const embed = embedBuilder_1.SCFleetEmbed.create()
        .setColor(verified ? embedBuilder_1.EmbedColors.SUCCESS : embedBuilder_1.EmbedColors.WARNING)
        .setTitle('\u{1F464} RSI Link Status')
        .setDescription('Your RSI verification status')
        .addFields({ name: 'RSI Handle', value: link.rsiHandle, inline: true }, {
        name: 'Verified',
        value: `${statusIcon} ${verified ? 'Yes' : 'No'}`,
        inline: true,
    }, { name: 'Sync Status', value: `${syncIcon} ${syncStatus}`, inline: true })
        .setTimestamp();
    if (link.lastKnownRank) {
        embed.addFields({ name: 'RSI Rank', value: link.lastKnownRank, inline: true });
    }
    if (link.isAffiliate) {
        embed.addFields({ name: 'Affiliate', value: '\u{1F3F7}\uFE0F Yes', inline: true });
    }
    if (link.lastSyncedAt) {
        const lastSynced = new Date(link.lastSyncedAt);
        embed.addFields({
            name: 'Last Synced',
            value: `<t:${Math.floor(lastSynced.getTime() / 1000)}:R>`,
            inline: true,
        });
    }
    if (!verified && link.verificationUrl) {
        embed.addFields({
            name: '\u{1F4DD} Verification Link',
            value: `Add this link to your RSI bio: ${link.verificationUrl}`,
            inline: false,
        });
    }
    else if (!verified && link.verificationCode) {
        embed.addFields({
            name: '\u{1F4DD} Verification Code',
            value: `Add this to your RSI bio: \`${link.verificationCode}\``,
            inline: false,
        });
    }
    return embed.build();
}
function buildRsiLinkStatusNotLinkedEmbed() {
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.CLOSED)
        .setTitle('\u{1F464} RSI Link Status')
        .setDescription('You have not linked an RSI handle yet.')
        .addFields({
        name: 'How to Link',
        value: 'Click the **Link RSI** button on the verification panel to get started.',
        inline: false,
    })
        .setTimestamp()
        .build();
}
function buildRsiUnlinkedEmbed() {
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.WARNING)
        .setTitle('\u{1F513} RSI Handle Unlinked')
        .setDescription('Your RSI handle has been unlinked from your account.')
        .addFields({
        name: 'Note',
        value: 'Any roles assigned through RSI sync may be removed on the next sync.',
        inline: false,
    })
        .setTimestamp()
        .build();
}
function buildDiscordAccountNotLinkedEmbed(message) {
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.WARNING)
        .setTitle('\u{1F517} Discord Account Not Linked')
        .setDescription(`${message}\n\n` +
        '**Next steps:**\n' +
        '1\uFE0F\u20E3 Click **Sign In with Discord** below\n' +
        '2\uFE0F\u20E3 Complete login on the web app\n' +
        '3\uFE0F\u20E3 Return here and run **/verify** again')
        .setTimestamp()
        .build();
}
function buildVerificationDescription(handle, profileUrl, verificationLink, verificationCode) {
    const intro = `Linking RSI handle **${handle}** to your Discord account.\n\n`;
    if (verificationLink) {
        return `${intro}**Complete these steps to verify:**
1\uFE0F\u20E3 Copy the verification link below
2\uFE0F\u20E3 Go to your [RSI Profile](${profileUrl}) \u2192 Edit \u2192 Bio
3\uFE0F\u20E3 Paste the link anywhere in your bio and save
4\uFE0F\u20E3 Click **Check Verification** below

**Your verification link:**
${verificationLink}
`;
    }
    if (verificationCode) {
        return `${intro}**Complete these steps to verify:**
1\uFE0F\u20E3 Copy the code below
2\uFE0F\u20E3 Go to your [RSI Profile](${profileUrl}) \u2192 Edit \u2192 Bio
3\uFE0F\u20E3 Paste the code anywhere in your bio and save
4\uFE0F\u20E3 Click **Check Verification** below

**Your verification code:**
\`\`\`${verificationCode}\`\`\``;
    }
    return `${intro}Check your verification status with the **My Verification** button.`;
}
function buildRsiLinkInitiatedEmbed(handle, profileUrl, verificationLink, verificationCode) {
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.SUCCESS)
        .setTitle('\u{1F517} RSI Link Initiated')
        .setDescription(buildVerificationDescription(handle, profileUrl, verificationLink, verificationCode))
        .setTimestamp()
        .build();
}
//# sourceMappingURL=verifyEmbeds.js.map