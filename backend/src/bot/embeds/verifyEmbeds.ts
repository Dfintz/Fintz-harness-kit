import { EmbedBuilder } from 'discord.js';

import { EmbedColors, SCFleetEmbed } from '../utils/embedBuilder';

/**
 * Pure builders for the `/verify` "check verification" result embeds (verified / pending / no-link).
 *
 * Extracted from `commands/verify.ts` so the check-result embeds render through the shared
 * `SCFleetEmbed` factory and drop their raw hex colors. The retry button on the pending reply stays
 * in the handler (it is interaction flow, not embed content).
 */

/** Embed shown when the caller's RSI handle has been verified. */
export function buildVerificationCompleteEmbed(rsiHandle: string): EmbedBuilder {
  return SCFleetEmbed.success(
    'RSI Verification Complete',
    `Your RSI handle **${rsiHandle}** has been verified!\n\n` +
      'You can now remove the verification link from your RSI bio.'
  )
    .setTimestamp()
    .build();
}

/** Embed shown when the verification link has not yet been found in the caller's RSI bio. */
export function buildVerificationPendingEmbed(error?: string): EmbedBuilder {
  return SCFleetEmbed.create()
    .setColor(EmbedColors.WARNING)
    .setTitle('\u23f3 Verification Not Yet Complete')
    .setDescription(
      error ??
        'Verification link not found in your RSI bio. Make sure you saved your bio and try again.'
    )
    .setTimestamp()
    .build();
}

/** Embed shown when the caller has not linked an RSI handle yet. */
export function buildNoRsiLinkEmbed(): EmbedBuilder {
  return SCFleetEmbed.create()
    .setColor(EmbedColors.CLOSED)
    .setTitle('\u23f3 No RSI Link Found')
    .setDescription(
      'You have not linked an RSI handle yet.\nClick **Link RSI** on the verification panel to get started.'
    )
    .setTimestamp()
    .build();
}

/**
 * Render shape consumed by the `/verify` "My Verification" status embed. This is the narrow subset
 * of the GET rsi-link payload that the status display reads; dates arrive as JSON strings.
 */
export interface RsiLinkStatusInput {
  rsiHandle: string;
  verifiedAt?: string | null;
  syncStatus?: string | null;
  lastKnownRank?: string | null;
  isAffiliate?: boolean | null;
  lastSyncedAt?: string | null;
  verificationUrl?: string | null;
  verificationCode?: string | null;
}

/** Maps an RSI link sync status to its indicator emoji. */
function getSyncStatusIcon(syncStatus: string): string {
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

/** Embed showing the caller's current RSI link verification + sync status. */
export function buildRsiLinkStatusEmbed(link: RsiLinkStatusInput): EmbedBuilder {
  const verified = link.verifiedAt !== null && link.verifiedAt !== undefined;
  const syncStatus = link.syncStatus ?? 'pending';
  const statusIcon = verified ? '\u2705' : '\u23f3';
  const syncIcon = getSyncStatusIcon(syncStatus);

  const embed = SCFleetEmbed.create()
    .setColor(verified ? EmbedColors.SUCCESS : EmbedColors.WARNING)
    .setTitle('\u{1F464} RSI Link Status')
    .setDescription('Your RSI verification status')
    .addFields(
      { name: 'RSI Handle', value: link.rsiHandle, inline: true },
      {
        name: 'Verified',
        value: `${statusIcon} ${verified ? 'Yes' : 'No'}`,
        inline: true,
      },
      { name: 'Sync Status', value: `${syncIcon} ${syncStatus}`, inline: true }
    )
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
  } else if (!verified && link.verificationCode) {
    embed.addFields({
      name: '\u{1F4DD} Verification Code',
      value: `Add this to your RSI bio: \`${link.verificationCode}\``,
      inline: false,
    });
  }

  return embed.build();
}

/** Embed shown by the "My Verification" button when the caller has no RSI link. */
export function buildRsiLinkStatusNotLinkedEmbed(): EmbedBuilder {
  return SCFleetEmbed.create()
    .setColor(EmbedColors.CLOSED)
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

/** Embed shown after the caller unlinks their RSI handle. */
export function buildRsiUnlinkedEmbed(): EmbedBuilder {
  return SCFleetEmbed.create()
    .setColor(EmbedColors.WARNING)
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

/** Embed shown when the caller's Discord account is not linked to a web-app account. */
export function buildDiscordAccountNotLinkedEmbed(message: string): EmbedBuilder {
  return SCFleetEmbed.create()
    .setColor(EmbedColors.WARNING)
    .setTitle('\u{1F517} Discord Account Not Linked')
    .setDescription(
      `${message}\n\n` +
        '**Next steps:**\n' +
        '1\uFE0F\u20E3 Click **Sign In with Discord** below\n' +
        '2\uFE0F\u20E3 Complete login on the web app\n' +
        '3\uFE0F\u20E3 Return here and run **/verify** again'
    )
    .setTimestamp()
    .build();
}

/**
 * Builds the multi-step verification instructions for the RSI link-initiated embed. Returns a
 * link-based, code-based, or fallback description depending on what the rsi-link response provides.
 */
function buildVerificationDescription(
  handle: string,
  profileUrl: string,
  verificationLink: string | undefined,
  verificationCode: string | undefined
): string {
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

/** Embed shown after the caller initiates an RSI link, carrying the verification instructions. */
export function buildRsiLinkInitiatedEmbed(
  handle: string,
  profileUrl: string,
  verificationLink?: string,
  verificationCode?: string
): EmbedBuilder {
  return SCFleetEmbed.create()
    .setColor(EmbedColors.SUCCESS)
    .setTitle('\u{1F517} RSI Link Initiated')
    .setDescription(
      buildVerificationDescription(handle, profileUrl, verificationLink, verificationCode)
    )
    .setTimestamp()
    .build();
}
