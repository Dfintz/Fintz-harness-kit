import { logger } from '../../utils/logger';
import { emitToUser, emitToOrganization } from '../websocketServer';

/**
 * Notification WebSocket Controller
 * 
 * Handles real-time notifications:
 * - System notifications
 * - Organization notifications
 * - User-specific notifications
 * - Alerts and warnings
 */

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  category?: 'system' | 'fleet' | 'activity' | 'trading' | 'organization';
  data?: Record<string, unknown>;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

export interface NotificationEvent {
  type: 'notification:new' | 'notification:read' | 'notification:deleted';
  notification: Notification;
  userId?: string;
  organizationId?: string;
}

/**
 * Send notification to specific user
 */
export const sendUserNotification = (userId: string, notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void => {
  const fullNotification: Notification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    read: false
  };

  const event: NotificationEvent = {
    type: 'notification:new',
    notification: fullNotification,
    userId
  };

  emitToUser(userId, 'notification:new', event);
  logger.debug(`Sent notification to user ${userId}: ${notification.title}`);
};

/**
 * Send notification to all members of an organization
 */
export const sendOrganizationNotification = (organizationId: string, notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void => {
  const fullNotification: Notification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    read: false
  };

  const event: NotificationEvent = {
    type: 'notification:new',
    notification: fullNotification,
    organizationId
  };

  emitToOrganization(organizationId, 'notification:new', event);
  logger.debug(`Sent notification to org ${organizationId}: ${notification.title}`);
};

/**
 * Notify about fleet event
 */
export const sendFleetNotification = (organizationId: string, title: string, message: string, data?: Record<string, unknown>): void => {
  sendOrganizationNotification(organizationId, {
    type: 'info',
    title,
    message,
    category: 'fleet',
    data
  });
};

/**
 * Notify about activity event
 */
export const sendActivityNotification = (organizationId: string, title: string, message: string, data?: Record<string, unknown>): void => {
  sendOrganizationNotification(organizationId, {
    type: 'info',
    title,
    message,
    category: 'activity',
    data
  });
};

/**
 * Notify about trading event
 */
export const sendTradingNotification = (userId: string, title: string, message: string, data?: Record<string, unknown>): void => {
  sendUserNotification(userId, {
    type: 'info',
    title,
    message,
    category: 'trading',
    data
  });
};

/**
 * Send warning notification
 */
export const sendWarningNotification = (userId: string, title: string, message: string, data?: Record<string, unknown>): void => {
  sendUserNotification(userId, {
    type: 'warning',
    title,
    message,
    category: 'system',
    data
  });
};

/**
 * Send error notification
 */
export const sendErrorNotification = (userId: string, title: string, message: string, data?: Record<string, unknown>): void => {
  sendUserNotification(userId, {
    type: 'error',
    title,
    message,
    category: 'system',
    data
  });
};
