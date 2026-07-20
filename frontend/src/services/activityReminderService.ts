import type {
  ActivityReminder,
  CreateActivityReminderRequest,
  ReminderChannel,
  ReminderType,
} from '@sc-fleet-manager/shared-types';
import { apiClient } from './apiClient';
import { BaseService } from './baseService';

class ActivityReminderService extends BaseService {
  protected basePath = '/api/v2/activities';

  /** Create a reminder for an activity */
  async createReminder(
    activityId: string,
    data: Omit<CreateActivityReminderRequest, 'activityId'>
  ): Promise<ActivityReminder> {
    try {
      this.log('createReminder', { activityId, ...data });
      const response = await apiClient.post<ActivityReminder>(
        `${this.basePath}/${activityId}/reminders`,
        data
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'createReminder');
    }
  }

  /** Create multiple reminders for an activity */
  async createReminders(
    activityId: string,
    reminders: Array<{ reminderType: ReminderType; channel: ReminderChannel }>
  ): Promise<ActivityReminder[]> {
    const results: ActivityReminder[] = [];
    for (const reminder of reminders) {
      const created = await this.createReminder(activityId, {
        reminderType: reminder.reminderType,
        channel: reminder.channel,
        scheduledTime: new Date().toISOString(),
        messageTemplate: '',
      });
      results.push(created);
    }
    return results;
  }

  /** Get all reminders for an activity */
  async getReminders(activityId: string): Promise<ActivityReminder[]> {
    try {
      this.log('getReminders', { activityId });
      const response = await apiClient.get<ActivityReminder[]>(
        `${this.basePath}/${activityId}/reminders`
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getReminders');
    }
  }
}

export const activityReminderService = new ActivityReminderService();
