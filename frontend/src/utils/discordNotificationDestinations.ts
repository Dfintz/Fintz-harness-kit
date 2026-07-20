export type NotificationDestinationType = 'announcement' | 'pinned_announcement';

export interface NotificationChannelDestination {
  channelId: string;
  channelType: NotificationDestinationType;
}

/**
 * Emoji mappings for notification channel statuses
 * Used to format channel names with visual status indicators
 */
export const NOTIFICATION_STATUS_EMOJI = {
  announcement: '📢', // Announcement/broadcast emoji
  pinned_announcement: '📌', // Pinned/important emoji
  active: '🟢', // Green circle for active status
  paused: '🟡', // Yellow circle for paused status
  inactive: '⚪', // White circle for inactive status
} as const;

/**
 * Format a channel name with emoji status indicator
 * @param channelName - The base channel name
 * @param channelType - The notification destination type
 * @returns Formatted channel name with emoji prefix
 */
export function formatChannelNameWithStatus(
  channelName: string,
  channelType: NotificationDestinationType
): string {
  const emoji = NOTIFICATION_STATUS_EMOJI[channelType];
  return `${emoji} ${channelName}`;
}

/**
 * Get channel status emoji
 * @param channelType - The notification destination type
 * @returns The emoji character for the channel type
 */
export function getChannelStatusEmoji(channelType: NotificationDestinationType): string {
  return NOTIFICATION_STATUS_EMOJI[channelType];
}

export function getNotificationChannelDestinations(
  notificationPreferences: Record<string, unknown> | undefined
): NotificationChannelDestination[] {
  if (!notificationPreferences) {
    return [];
  }

  const destinations: NotificationChannelDestination[] = [];
  const announcementChannelId =
    typeof notificationPreferences.announcementChannelId === 'string'
      ? notificationPreferences.announcementChannelId
      : '';
  const pinnedAnnouncementChannelId =
    typeof notificationPreferences.pinnedAnnouncementChannelId === 'string'
      ? notificationPreferences.pinnedAnnouncementChannelId
      : '';

  if (announcementChannelId) {
    destinations.push({
      channelId: announcementChannelId,
      channelType: 'announcement',
    });
  }

  if (pinnedAnnouncementChannelId) {
    destinations.push({
      channelId: pinnedAnnouncementChannelId,
      channelType: 'pinned_announcement',
    });
  }

  return destinations;
}
