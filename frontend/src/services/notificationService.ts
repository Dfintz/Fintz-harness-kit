/**
 * Notification Service — Phase 3
 *
 * Frontend service for the notifications API.
 * Wraps /api/v2/notifications endpoints.
 */

import type { Notification } from '@/types/apiV2';
import { apiClient } from './apiClient';
import { BaseService, extractData, unwrapResponse } from './baseService';

// ============================================================================
// Types
// ============================================================================

/** Per-channel delivery toggles. */
export interface NotificationChannels {
  inApp: boolean;
  email: boolean;
  discord: boolean;
}

/** Per-category notification toggles. */
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

/**
 * Partial update DTO — only changed fields need to be sent.
 */
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

export interface SendNotificationRequest {
  type: string;
  title: string;
  message: string;
  recipientIds: string[];
  channel?: 'in-app' | 'discord' | 'email';
  data?: Record<string, unknown>;
  recipientEmails?: string[];
}

export interface NotificationListParams {
  [key: string]: unknown;
  page?: number;
  limit?: number;
  read?: boolean;
  category?: string;
}

// ============================================================================
// Service
// ============================================================================

class NotificationServiceV2 extends BaseService {
  protected basePath = '/api/v2/notifications';

  /**
   * Get current user's notifications
   */
  async getNotifications(params?: NotificationListParams): Promise<Notification[]> {
    try {
      this.log('getNotifications', { params });
      const queryString = this.buildQueryString(params);
      const url = `${this.basePath}${queryString}`;
      const response = await apiClient.get<{ data: Notification[]; unreadCount?: number }>(url);
      const body = extractData(response);
      // Backend returns paginated response { data: [...], pagination: {...}, unreadCount }
      const items = Array.isArray(body) ? body : (body.data ?? []);
      // Normalize backend createdAt → frontend timestamp
      return items.map(n => ({
        ...n,
        timestamp: n.timestamp ?? new Date(n.createdAt as unknown as string).getTime(),
      }));
    } catch (error) {
      return this.handleError(error, 'getNotifications');
    }
  }

  /**
   * Send a notification
   */
  async sendNotification(data: SendNotificationRequest): Promise<void> {
    try {
      this.log('sendNotification', { data });
      await apiClient.post(this.basePath, data);
    } catch (error) {
      return this.handleError(error, 'sendNotification');
    }
  }

  /**
   * Mark specific notifications as read
   */
  async markAsRead(notificationIds: string[]): Promise<void> {
    try {
      this.log('markAsRead', { notificationIds });
      await apiClient.post(`${this.basePath}/mark-read`, { notificationIds });
    } catch (error) {
      return this.handleError(error, 'markAsRead');
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      this.log('markAllAsRead');
      await apiClient.post(`${this.basePath}/mark-all-read`);
    } catch (error) {
      return this.handleError(error, 'markAllAsRead');
    }
  }

  /**
   * Get notification digest (daily summary)
   */
  async getDigest(digestId?: string): Promise<NotificationDigest> {
    try {
      this.log('getDigest', { digestId });
      const queryString = digestId ? `?digestId=${digestId}` : '';
      const url = `${this.basePath}/digest${queryString}`;
      const response = await apiClient.get<NotificationDigest>(url);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getDigest');
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      this.log('deleteNotification', { notificationId });
      await apiClient.delete(`${this.basePath}/${notificationId}`);
    } catch (error) {
      return this.handleError(error, 'deleteNotification');
    }
  }

  /**
   * Get notification preferences for the current user
   */
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

  /**
   * Update notification preferences (partial merge)
   */
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
