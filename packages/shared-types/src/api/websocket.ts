/**
 * WebSocket event types for real-time communication
 */

import type { Fleet, FleetV2 } from '../models/fleet';
import type { Activity, ActivityV2 } from '../models/activity';
import type { Organization, OrganizationV2 } from '../models/organization';
import type { User } from '../models/user';

/**
 * Base WebSocket event
 */
export interface BaseWebSocketEvent {
  timestamp: number;
  userId?: string;
  organizationId?: string;
}

/**
 * Fleet-related WebSocket events
 */
export type FleetEventType =
  | 'fleet:created'
  | 'fleet:updated'
  | 'fleet:deleted'
  | 'fleet:ship_added'
  | 'fleet:ship_removed'
  | 'fleet:member_added'
  | 'fleet:member_removed'
  | 'fleet:composition_updated';

export interface FleetEvent extends BaseWebSocketEvent {
  type: FleetEventType;
  fleetId: string;
  data: Partial<Fleet> | Partial<FleetV2>;
}

/**
 * Activity-related WebSocket events
 */
export type ActivityEventType =
  | 'activity:created'
  | 'activity:updated'
  | 'activity:deleted'
  | 'activity:participant_joined'
  | 'activity:participant_left'
  | 'activity:status_changed'
  | 'activity:reminder';

export interface ActivityEvent extends BaseWebSocketEvent {
  type: ActivityEventType;
  activityId: string;
  data: Partial<Activity> | Partial<ActivityV2>;
}

/**
 * Organization-related WebSocket events
 */
export type OrganizationEventType =
  | 'organization:created'
  | 'organization:updated'
  | 'organization:deleted'
  | 'organization:member_joined'
  | 'organization:member_left'
  | 'organization:member_role_changed';

export interface OrganizationEvent extends BaseWebSocketEvent {
  type: OrganizationEventType;
  organizationId: string;
  data: Partial<Organization> | Partial<OrganizationV2>;
}

/**
 * User presence status
 */
export type PresenceStatus = 'online' | 'idle' | 'offline';

/**
 * User presence event
 */
export type PresenceEventType =
  | 'user:online'
  | 'user:offline'
  | 'user:idle'
  | 'user:typing'
  | 'user:typing_stopped'
  | 'user:activity_changed'
  | 'user:status_changed';

export interface PresenceEvent extends BaseWebSocketEvent {
  type: PresenceEventType;
  userId: string;
  status?: PresenceStatus;
  data?: {
    lastSeen?: number;
    currentActivity?: string;
    isTyping?: boolean;
    typingLocation?: string;
    customStatus?: {
      text: string;
      emoji?: string;
      expiresAt?: number;
    };
  };
}

/**
 * User presence state
 */
export interface PresenceState {
  userId: string;
  user: User;
  status: PresenceStatus;
  lastSeen: number;
  currentActivity?: string;
  isTyping?: boolean;
  typingLocation?: string;
  customStatus?: {
    text: string;
    emoji?: string;
    expiresAt?: number;
  };
}

/**
 * Notification types
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationCategory = 'system' | 'fleet' | 'activity' | 'trading' | 'organization';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  category?: NotificationCategory;
  data?: Record<string, unknown>;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

/**
 * Notification event
 */
export type NotificationEventType =
  | 'notification:new'
  | 'notification:read'
  | 'notification:deleted';

export interface NotificationEvent extends BaseWebSocketEvent {
  type: NotificationEventType;
  notification: Notification;
}

/**
 * Trading event data types
 */
export interface TradingRouteData {
  routeId: string;
  name?: string;
  status?: string;
  [key: string]: unknown;
}

export interface MarketData {
  location?: string;
  commodity?: string;
  price?: number;
  [key: string]: unknown;
}

/**
 * Trading-related WebSocket events
 */
export type TradingEventType =
  | 'trading:route_created'
  | 'trading:route_updated'
  | 'trading:route_deleted'
  | 'trading:route_status_changed'
  | 'trading:opportunity_discovered'
  | 'trading:market_updated'
  | 'trading:price_changed';

export interface TradingEvent extends BaseWebSocketEvent {
  type: TradingEventType;
  routeId?: string;
  data: TradingRouteData | MarketData;
}

/**
 * Union type for all WebSocket events
 */
export type WebSocketEvent =
  | FleetEvent
  | ActivityEvent
  | OrganizationEvent
  | PresenceEvent
  | NotificationEvent
  | TradingEvent;
