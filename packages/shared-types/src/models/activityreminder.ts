/**
 * Activity reminder domain types.
 */

export type ReminderType = '1_day_before' | '1_hour_before' | '30_min_before' | 'custom';

export type ReminderChannel = 'discord' | 'email' | 'both';

export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export interface ActivityReminderMessageVariables {
  eventTitle?: string;
  eventDate?: string;
  eventLocation?: string;
  timeUntil?: string;
  [key: string]: unknown;
}

export interface ActivityReminder {
  id: string;
  activityId: string;
  reminderType: ReminderType;
  channel: ReminderChannel;
  scheduledTime: Date | string;
  deliveryStatus: DeliveryStatus;
  recipientUserIds?: string[];
  recipientEmails?: string[];
  discordChannelId?: string;
  messageTemplate: string;
  messageVariables?: ActivityReminderMessageVariables;
  sentAt?: Date | string;
  errorMessage?: string;
  retryCount: number;
  lastRetryAt?: Date | string;
  isEnabled: boolean;
  createdBy?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateActivityReminderRequest {
  activityId: string;
  reminderType: ReminderType;
  channel?: ReminderChannel;
  scheduledTime: Date | string;
  recipientUserIds?: string[];
  recipientEmails?: string[];
  discordChannelId?: string;
  messageTemplate: string;
  messageVariables?: ActivityReminderMessageVariables;
  isEnabled?: boolean;
}

export interface UpdateActivityReminderRequest extends Partial<CreateActivityReminderRequest> {
  deliveryStatus?: DeliveryStatus;
  errorMessage?: string;
  sentAt?: Date | string;
  retryCount?: number;
  lastRetryAt?: Date | string;
}
