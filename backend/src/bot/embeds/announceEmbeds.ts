import { EmbedBuilder } from 'discord.js';

import { type Announcement, AnnouncementStatus } from '../../models/Announcement';
import { type AnnouncementTemplate } from '../../models/AnnouncementTemplate';
import {
  type AllianceDeliveryResult,
  type AnnouncementStatusResult,
} from '../../services/communication/announcement';
import { EmbedColors } from '../utils/embedBuilder';

/**
 * Build the announcement preview embed from user-supplied content/config.
 */
export function buildPreviewEmbed(
  title: string,
  content: string,
  config: { color?: string; imageUrl?: string; thumbnailUrl?: string; timestamp?: boolean }
): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle(title).setDescription(content);

  if (config.color) {
    const colorInt = Number.parseInt(config.color.replace('#', ''), 16);
    embed.setColor(colorInt);
  }

  if (config.imageUrl) {
    embed.setImage(config.imageUrl);
  }

  if (config.thumbnailUrl) {
    embed.setThumbnail(config.thumbnailUrl);
  }

  if (config.timestamp) {
    embed.setTimestamp();
  }

  return embed;
}

/**
 * Get emoji for announcement status.
 */
export function getStatusEmoji(status: AnnouncementStatus): string {
  switch (status) {
    case AnnouncementStatus.DRAFT:
      return '\u{1F4DD}';
    case AnnouncementStatus.SCHEDULED:
      return '\u{1F4C5}';
    case AnnouncementStatus.SENDING:
      return '\u23f3';
    case AnnouncementStatus.SENT:
      return '\u2705';
    case AnnouncementStatus.FAILED:
      return '\u274c';
    case AnnouncementStatus.CANCELLED:
      return '\u{1F6AB}';
    default:
      return '\u{1F4C4}';
  }
}

/**
 * Build the "Announcement Created" success embed (brand: SUCCESS).
 */
export function buildAnnouncementCreatedEmbed(
  announcementId: string,
  createdByUsername: string
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SUCCESS)
    .setTitle('\u2705 Announcement Created')
    .setDescription('Your announcement has been created as a draft.')
    .addFields(
      { name: 'Announcement ID', value: `\`${announcementId}\``, inline: true },
      { name: 'Status', value: '\u{1F4DD} Draft', inline: true },
      { name: 'Created By', value: createdByUsername, inline: true }
    )
    .setFooter({ text: `Use /announce send id:${announcementId} or the panel to send` });
}

/**
 * Build the "Announcement Created from Template" success embed (brand: SUCCESS).
 */
export function buildAnnouncementCreatedFromTemplateEmbed(
  announcementId: string,
  title: string
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SUCCESS)
    .setTitle('\u2705 Announcement Created from Template')
    .setDescription('Your announcement has been created as a draft.')
    .addFields(
      { name: 'Announcement ID', value: `\`${announcementId}\``, inline: true },
      { name: 'Title', value: title, inline: true },
      { name: 'Status', value: '\u{1F4DD} Draft', inline: true }
    );
}

/**
 * Build the alliance announcement delivery-result embed
 * (brand: conditional SUCCESS / WARNING / ERROR).
 */
export function buildAllianceDeliveryResultEmbed(result: AllianceDeliveryResult): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(
      result.success
        ? EmbedColors.SUCCESS
        : result.successfulDeliveries > 0
          ? EmbedColors.WARNING
          : EmbedColors.ERROR
    )
    .setTitle(
      result.success
        ? '\u2705 Alliance Announcement Sent'
        : result.successfulDeliveries > 0
          ? '\u26a0\uFE0F Partial Alliance Delivery'
          : '\u274c Alliance Delivery Failed'
    )
    .addFields(
      { name: 'Announcement ID', value: `\`${result.announcementId}\``, inline: true },
      { name: 'Alliance Orgs', value: `${result.allianceOrgs.length}`, inline: true },
      { name: 'Successful', value: `${result.successfulDeliveries}`, inline: true },
      { name: 'Failed', value: `${result.failedDeliveries}`, inline: true }
    );
}

/**
 * Build the announcement status embed (brand: SC_BLUE).
 */
export function buildAnnouncementStatusEmbed(status: AnnouncementStatusResult): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle(`\u{1F4CA} Announcement Status: ${status.announcement.title}`)
    .addFields(
      { name: 'ID', value: `\`${status.announcement.id}\``, inline: true },
      {
        name: 'Status',
        value: `${getStatusEmoji(status.announcement.status)} ${status.announcement.status}`,
        inline: true,
      },
      {
        name: 'Created By',
        value: status.announcement.createdByName || status.announcement.createdBy,
        inline: true,
      }
    );

  if (status.deliveries.length > 0) {
    embed.addFields(
      { name: '\n\u{1F4EC} Delivery Summary', value: '\u200B', inline: false },
      { name: 'Total', value: `${status.summary.total}`, inline: true },
      { name: 'Delivered', value: `\u2705 ${status.summary.delivered}`, inline: true },
      { name: 'Failed', value: `\u274c ${status.summary.failed}`, inline: true }
    );
  }

  return embed;
}

/**
 * Build the announcements list embed (brand: SC_BLUE).
 */
export function buildAnnouncementListEmbed(
  announcements: Announcement[],
  total: number
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('\u{1F4E2} Announcements')
    .setDescription(`Showing ${announcements.length} of ${total} announcements`)
    .setTimestamp();

  announcements.forEach(announcement => {
    const emoji = getStatusEmoji(announcement.status);
    const truncated =
      announcement.content.length > 50
        ? `${announcement.content.substring(0, 50)}...`
        : announcement.content;

    embed.addFields({
      name: `${emoji} ${announcement.title}`,
      value: `ID: \`${announcement.id}\`\n${truncated}`,
      inline: false,
    });
  });

  return embed;
}

/**
 * Build the templates sub-panel embed (brand: INFO).
 */
export function buildTemplatesPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.INFO)
    .setTitle('\u{1F4CB} Announcement Templates')
    .setDescription('Manage your announcement templates.')
    .setFooter({ text: 'Templates let you quickly create announcements from predefined formats' });
}

/**
 * Build the announcement templates list embed (brand: SC_BLUE).
 */
export function buildTemplatesListEmbed(
  templates: AnnouncementTemplate[],
  total: number
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('\u{1F4CB} Announcement Templates')
    .setDescription(`Showing ${templates.length} of ${total} templates`)
    .setTimestamp();

  templates.forEach(template => {
    const globalBadge = template.isGlobal ? '\u{1F310} ' : '';
    const truncated =
      template.content.length > 50 ? `${template.content.substring(0, 50)}...` : template.content;

    embed.addFields({
      name: `${globalBadge}${template.name}`,
      value: `ID: \`${template.id}\`\nTitle: ${template.title || 'N/A'}\n${truncated}`,
      inline: false,
    });
  });

  return embed;
}

/**
 * Build the "Announcement Scheduled" confirmation embed (brand: SC_BLUE).
 */
export function buildAnnouncementScheduledEmbed(
  announcementId: string,
  scheduledAt: Date,
  channelId: string
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('\u{1F4C5} Announcement Scheduled')
    .addFields(
      { name: 'Announcement ID', value: `\`${announcementId}\``, inline: true },
      { name: 'Scheduled For', value: scheduledAt.toLocaleString(), inline: true },
      { name: 'Channel', value: `<#${channelId}>`, inline: true }
    )
    .setFooter({ text: 'Use /announce cancel to cancel this scheduled announcement' });
}

/**
 * Build the "Template Created" confirmation embed (brand: SUCCESS).
 */
export function buildTemplateCreatedEmbed(
  templateId: string,
  templateName: string,
  createdByUsername: string
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SUCCESS)
    .setTitle('\u2705 Template Created')
    .setDescription(`Template "${templateName}" has been created.`)
    .addFields(
      { name: 'Template ID', value: `\`${templateId}\``, inline: true },
      { name: 'Type', value: '\u{1F3E2} Organization', inline: true },
      { name: 'Created By', value: createdByUsername, inline: true }
    );
}
