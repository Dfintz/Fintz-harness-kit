/**
 * Notification Service for Mobile
 * Handles all notification-related API calls.
 * Ported from frontend/src/services/notificationService.ts
 */

import type { Notification } from '@/types/apiV2';
import { apiClient } from './apiClient';
import { BaseService, extractData, unwrapResponse } from './baseService';

export interface NotificationChannels {
  inApp: boolean;
  email: boolean;
  discord: boolean;
}

export interface NotificationCategories {
  fleet: boolean;
  activity: boolean;
  organization: boolean;
  trade: boolean;
  social: boolean;
  security: boolean;
  lfg: boolean;
  system: boolean;
}

export interface NotificationPreferences {
  muteAll: boolean;
  channels: NotificationChannels;
  categories: NotificationCategories;
  digestFrequency: 'daily' | 'weekly' | 'none';
}

export interface UpdateNotificationPreferencesDto {
  muteAll?: boolean;
  channels?: Partial<NotificationChannels>;
  categories?: Partial<NotificationCategories>;
  digestFrequency?: 'daily' | 'weekly' | 'none';
}

export interface NotificationDigest {
  id: string;
  userId: string;
  period: string;
  notifications: Notification[];
  generatedAt: string;
}

export interface NotificationListParams {
  [key: string]: unknown;
  page?: number;
  limit?: number;
  read?: boolean;
  category?: string;
}

class NotificationServiceV2 extends BaseService {
  protected basePath = '/api/v2/notifications';

  async getNotifications(params?: NotificationListParams): Promise<Notification[]> {
    try {
      this.log('getNotifications', { params });
      const queryString = this.buildQueryString(params);
      const url = `${this.basePath}${queryString}`;
      const response = await apiClient.get<{ data: Notification[]; unreadCount?: number }>(url);
      const body = extractData(response);
      const items = Array.isArray(body) ? body : (body.data ?? []);
      return items.map((n: Notification) => ({
        ...n,
        timestamp: n.timestamp ?? new Date(n.createdAt).getTime(),
      }));
    } catch (error) {
      return this.handleError(error, 'getNotifications');
    }
  }

  async markAsRead(notificationIds: string[]): Promise<void> {
    try {
      this.log('markAsRead', { notificationIds });
      await apiClient.post(`${this.basePath}/mark-read`, { notificationIds });
    } catch (error) {
      return this.handleError(error, 'markAsRead');
    }
  }

  async markAllAsRead(): Promise<void> {
    try {
      this.log('markAllAsRead');
      await apiClient.post(`${this.basePath}/mark-all-read`);
    } catch (error) {
      return this.handleError(error, 'markAllAsRead');
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    try {
      this.log('deleteNotification', { notificationId });
      await apiClient.delete(`${this.basePath}/${notificationId}`);
    } catch (error) {
      return this.handleError(error, 'deleteNotification');
    }
  }

  async getPreferences(): Promise<NotificationPreferences> {
    try {
      this.log('getPreferences');
      const response = await apiClient.get<NotificationPreferences>(
        `${this.basePath}/preferences/user`
      );
      return unwrapResponse<NotificationPreferences>(response);
    } catch (error) {
      return this.handleError(error, 'getPreferences');
    }
  }

  async updatePreferences(
    preferences: UpdateNotificationPreferencesDto
  ): Promise<NotificationPreferences> {
    try {
      this.log('updatePreferences', { preferences });
      const response = await apiClient.put<NotificationPreferences>(
        `${this.basePath}/preferences/user`,
        preferences
      );
      return unwrapResponse<NotificationPreferences>(response);
    } catch (error) {
      return this.handleError(error, 'updatePreferences');
    }
  }
}

export const notificationService = new NotificationServiceV2();
