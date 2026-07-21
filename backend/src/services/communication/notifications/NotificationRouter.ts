/**
 * NotificationRouter — Sprint 19-H
 *
 * Unified notification entry-point that consolidates cross-system
 * notifications for Teams, Activities, Social, Jobs, Fleet, Trade,
 * Bounties, and Organization events.
 *
 * Responsibilities:
 *  1. Maps a high-level `NotificationContext` to the preference category
 *     and DB notification type so callers don't need to know the plumbing.
 *  2. Checks user notification preferences before every channel delivery.
 *  3. Persists in-app notifications (DB) and emits real-time WebSocket
 *     events in a single call.
 *  4. Optionally routes to Discord (future: email).
 */

import { NotificationPriority, NotificationType } from '../../../models/Notification';
import type { NotificationCategories } from '../../../models/NotificationPreferences';
import { logger } from '../../../utils/logger';
import { emitToOrganization, emitToUser } from '../../../websocket/websocketServer';

import { NotificationPreferencesService } from './NotificationPreferencesService';
import { NotificationService } from './NotificationService';

// ============================================================================
// Context enum — one value per cross-system event
// ============================================================================

export enum NotificationContext {
  // Team
  TEAM_JOINED = 'team_joined',
  TEAM_LEFT = 'team_left',
  TEAM_ROLE_CHANGED = 'team_role_changed',

  // Activity
  ACTIVITY_JOINED = 'activity_joined',
  ACTIVITY_LEFT = 'activity_left',
  ACTIVITY_COMPLETED = 'activity_completed',
  ACTIVITY_CANCELLED = 'activity_cancelled',
  ACTIVITY_INVITATION = 'activity_invitation',
  ACTIVITY_REMINDER = 'activity_reminder',

  // Social / LFG
  LFG_SESSION_STARTED = 'lfg_session_started',
  LFG_SESSION_FILLED = 'lfg_session_filled',
  CONTACT_REQUEST_RECEIVED = 'contact_request_received',
  CONTACT_REQUEST_ACCEPTED = 'contact_request_accepted',

  // Jobs / Applications
  APPLICATION_RECEIVED = 'application_received',
  APPLICATION_REVIEWED = 'application_reviewed',
  JOB_LISTING_EXPIRED = 'job_listing_expired',

  // Fleet
  FLEET_CREATED = 'fleet_created',
  FLEET_DEPLOYED = 'fleet_deployed',
  FLEET_DISSOLVED = 'fleet_dissolved',

  // Trade
  TRADE_OPERATION_CREATED = 'trade_operation_created',
  ROUTE_STATUS_CHANGED = 'route_status_changed',

  // Bounty
  BOUNTY_CLAIMED = 'bounty_claimed',
  BOUNTY_COMPLETED = 'bounty_completed',

  // Organization
  ORG_MEMBER_JOINED = 'org_member_joined',
  ORG_MEMBER_LEFT = 'org_member_left',
  ORG_ROLE_CHANGED = 'org_role_changed',

  // System
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  SECURITY_ALERT = 'security_alert',

  // Operations — Ready Check & Chain of Command
  READY_CHECK_INITIATED = 'ready_check_initiated',
  READY_CHECK_COMPLETED = 'ready_check_completed',
  COMMAND_RECEIVED = 'command_received',
  PREFLIGHT_CHECK = 'preflight_check',
}

// ============================================================================
// Mapping tables
// ============================================================================

/** Maps each context to the preference category used by shouldDeliver(). */
const CONTEXT_TO_CATEGORY: Record<NotificationContext, keyof NotificationCategories> = {
  // Team → organization
  [NotificationContext.TEAM_JOINED]: 'organization',
  [NotificationContext.TEAM_LEFT]: 'organization',
  [NotificationContext.TEAM_ROLE_CHANGED]: 'organization',

  // Activity
  [NotificationContext.ACTIVITY_JOINED]: 'activity',
  [NotificationContext.ACTIVITY_LEFT]: 'activity',
  [NotificationContext.ACTIVITY_COMPLETED]: 'activity',
  [NotificationContext.ACTIVITY_CANCELLED]: 'activity',
  [NotificationContext.ACTIVITY_INVITATION]: 'activity',
  [NotificationContext.ACTIVITY_REMINDER]: 'activity',

  // Social / LFG
  [NotificationContext.LFG_SESSION_STARTED]: 'social',
  [NotificationContext.LFG_SESSION_FILLED]: 'social',
  [NotificationContext.CONTACT_REQUEST_RECEIVED]: 'social',
  [NotificationContext.CONTACT_REQUEST_ACCEPTED]: 'social',

  // Jobs → activity (closest existing category)
  [NotificationContext.APPLICATION_RECEIVED]: 'activity',
  [NotificationContext.APPLICATION_REVIEWED]: 'activity',
  [NotificationContext.JOB_LISTING_EXPIRED]: 'activity',

  // Fleet
  [NotificationContext.FLEET_CREATED]: 'fleet',
  [NotificationContext.FLEET_DEPLOYED]: 'fleet',
  [NotificationContext.FLEET_DISSOLVED]: 'fleet',

  // Trade
  [NotificationContext.TRADE_OPERATION_CREATED]: 'trade',
  [NotificationContext.ROUTE_STATUS_CHANGED]: 'trade',

  // Bounty → security (closest; bounties are enforcement actions)
  [NotificationContext.BOUNTY_CLAIMED]: 'security',
  [NotificationContext.BOUNTY_COMPLETED]: 'security',

  // Organization
  [NotificationContext.ORG_MEMBER_JOINED]: 'organization',
  [NotificationContext.ORG_MEMBER_LEFT]: 'organization',
  [NotificationContext.ORG_ROLE_CHANGED]: 'organization',

  // System
  [NotificationContext.SYSTEM_ANNOUNCEMENT]: 'system',
  [NotificationContext.SECURITY_ALERT]: 'system',

  // Operations — Ready Check & Chain of Command → activity category
  [NotificationContext.READY_CHECK_INITIATED]: 'activity',
  [NotificationContext.READY_CHECK_COMPLETED]: 'activity',
  [NotificationContext.COMMAND_RECEIVED]: 'activity',
  [NotificationContext.PREFLIGHT_CHECK]: 'activity',
};

/** Maps each context to the DB NotificationType for persistence. */
const CONTEXT_TO_TYPE: Record<NotificationContext, NotificationType> = {
  [NotificationContext.TEAM_JOINED]: NotificationType.INFO,
  [NotificationContext.TEAM_LEFT]: NotificationType.INFO,
  [NotificationContext.TEAM_ROLE_CHANGED]: NotificationType.INFO,

  [NotificationContext.ACTIVITY_JOINED]: NotificationType.SUCCESS,
  [NotificationContext.ACTIVITY_LEFT]: NotificationType.INFO,
  [NotificationContext.ACTIVITY_COMPLETED]: NotificationType.ACTIVITY_COMPLETED,
  [NotificationContext.ACTIVITY_CANCELLED]: NotificationType.ACTIVITY_CANCELLED,
  [NotificationContext.ACTIVITY_INVITATION]: NotificationType.ACTIVITY_INVITATION,
  [NotificationContext.ACTIVITY_REMINDER]: NotificationType.WARNING,

  [NotificationContext.LFG_SESSION_STARTED]: NotificationType.INFO,
  [NotificationContext.LFG_SESSION_FILLED]: NotificationType.SUCCESS,
  [NotificationContext.CONTACT_REQUEST_RECEIVED]: NotificationType.INFO,
  [NotificationContext.CONTACT_REQUEST_ACCEPTED]: NotificationType.SUCCESS,

  [NotificationContext.APPLICATION_RECEIVED]: NotificationType.INFO,
  [NotificationContext.APPLICATION_REVIEWED]: NotificationType.INFO,
  [NotificationContext.JOB_LISTING_EXPIRED]: NotificationType.WARNING,

  [NotificationContext.FLEET_CREATED]: NotificationType.FLEET_CREATED,
  [NotificationContext.FLEET_DEPLOYED]: NotificationType.FLEET_DEPLOYED,
  [NotificationContext.FLEET_DISSOLVED]: NotificationType.FLEET_DISSOLVED,

  [NotificationContext.TRADE_OPERATION_CREATED]: NotificationType.TRADE_OPERATION_CREATED,
  [NotificationContext.ROUTE_STATUS_CHANGED]: NotificationType.ROUTE_STATUS_CHANGED,

  [NotificationContext.BOUNTY_CLAIMED]: NotificationType.WARNING,
  [NotificationContext.BOUNTY_COMPLETED]: NotificationType.SUCCESS,

  [NotificationContext.ORG_MEMBER_JOINED]: NotificationType.INFO,
  [NotificationContext.ORG_MEMBER_LEFT]: NotificationType.INFO,
  [NotificationContext.ORG_ROLE_CHANGED]: NotificationType.INFO,

  [NotificationContext.SYSTEM_ANNOUNCEMENT]: NotificationType.ANNOUNCEMENT,
  [NotificationContext.SECURITY_ALERT]: NotificationType.ERROR,

  // Operations
  [NotificationContext.READY_CHECK_INITIATED]: NotificationType.WARNING,
  [NotificationContext.READY_CHECK_COMPLETED]: NotificationType.SUCCESS,
  [NotificationContext.COMMAND_RECEIVED]: NotificationType.WARNING,
  [NotificationContext.PREFLIGHT_CHECK]: NotificationType.WARNING,
};

// ============================================================================
// Input / output types
// ============================================================================

/** Payload accepted by every route*() method. */
export interface RouteNotificationInput {
  /** High-level context that determines category, type, and icon. */
  context: NotificationContext;
  /** Recipient user ID. */
  userId: string;
  /** Notification headline. */
  title: string;
  /** Notification body. */
  message: string;
  /** Optional sender user ID (null = system). */
  senderId?: string;
  /** Optional deep-link for the notification action. */
  actionUrl?: string;
  /** Arbitrary metadata attached to the notification. */
  metadata?: Record<string, unknown>;
  /** Override the default priority derived from context. */
  priority?: NotificationPriority;
}

/** Payload for organisation-wide broadcasts. */
export interface RouteOrgNotificationInput {
  context: NotificationContext;
  organizationId: string;
  title: string;
  message: string;
  senderId?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  priority?: NotificationPriority;
}

/** Result returned after routing a notification. */
export interface NotificationRouteResult {
  /** Channels that successfully received the notification. */
  delivered: string[];
  /** Channels skipped because of user preferences. */
  skipped: string[];
  /** Channels where delivery failed (with error messages). */
  errors: string[];
  /** The persisted notification ID (if in-app was delivered). */
  notificationId?: string;
}

// ============================================================================
// Router
// ============================================================================

export class NotificationRouter {
  private readonly notificationService: NotificationService;
  private readonly preferencesService: NotificationPreferencesService;

  constructor(
    notificationService?: NotificationService,
    preferencesService?: NotificationPreferencesService
  ) {
    this.notificationService = notificationService ?? new NotificationService(undefined, undefined);
    this.preferencesService = preferencesService ?? new NotificationPreferencesService();
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Route a notification to a single user.
   * Checks preferences, persists in-app, and emits a WebSocket event.
   */
  async notifyUser(input: RouteNotificationInput): Promise<NotificationRouteResult> {
    const { userId, context, title, message } = input;
    const category = CONTEXT_TO_CATEGORY[context];
    const type = CONTEXT_TO_TYPE[context];
    const result: NotificationRouteResult = { delivered: [], skipped: [], errors: [] };

    // In-App + WebSocket share the same preference gate
    const shouldInApp = await this.shouldDeliver(userId, 'inApp', category);
    if (shouldInApp) {
      await this.deliverInApp(input, type, result);
      this.deliverWebSocket(userId, type, title, message, category, input, result);
    } else {
      result.skipped.push('inApp', 'websocket');
    }

    // Discord has its own preference
    const shouldDiscord = await this.shouldDeliver(userId, 'discord', category);
    if (shouldDiscord) {
      await this.deliverDiscord(title, message, result);
    } else {
      result.skipped.push('discord');
    }

    logger.debug('NotificationRouter: routed user notification', {
      userId,
      context,
      delivered: result.delivered,
      skipped: result.skipped,
      errors: result.errors,
    });

    return result;
  }

  /**
   * Broadcast a notification to an entire organisation via WebSocket.
   * Org-wide notifications are NOT persisted per-user (too many rows);
   * they use WebSocket broadcast only.
   */
  notifyOrganization(input: RouteOrgNotificationInput): NotificationRouteResult {
    const { organizationId, context, title, message, actionUrl, metadata } = input;
    const category = CONTEXT_TO_CATEGORY[context];
    const type = CONTEXT_TO_TYPE[context];
    const result: NotificationRouteResult = { delivered: [], skipped: [], errors: [] };

    try {
      emitToOrganization(organizationId, 'notification:new', {
        id: crypto.randomUUID(),
        type: this.mapTypeToWsType(type),
        title,
        message,
        category,
        data: { context, actionUrl, ...metadata },
        timestamp: new Date().toISOString(),
        read: false,
        actionUrl,
      });
      result.delivered.push('websocket');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('NotificationRouter: org broadcast failed', {
        organizationId,
        context,
        error: errorMsg,
      });
      result.errors.push(`websocket: ${errorMsg}`);
    }

    logger.debug('NotificationRouter: routed org notification', {
      organizationId,
      context,
      delivered: result.delivered,
      errors: result.errors,
    });

    return result;
  }

  // ── Private delivery helpers ────────────────────────────────────────

  private async deliverInApp(
    input: RouteNotificationInput,
    type: NotificationType,
    result: NotificationRouteResult
  ): Promise<void> {
    const { userId, context, title, message, senderId, actionUrl, metadata, priority } = input;
    try {
      const persisted = await this.notificationService.create({
        userId,
        type,
        title,
        message,
        senderId,
        priority: priority ?? NotificationPriority.NORMAL,
        data: { context, actionUrl, ...metadata },
      });
      result.notificationId = persisted.notificationId;
      result.delivered.push('inApp');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('NotificationRouter: in-app delivery failed', {
        userId,
        context,
        error: errorMsg,
      });
      result.errors.push(`inApp: ${errorMsg}`);
    }
  }

  private deliverWebSocket(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    category: keyof NotificationCategories,
    input: RouteNotificationInput,
    result: NotificationRouteResult
  ): void {
    const { context, actionUrl, metadata } = input;
    try {
      emitToUser(userId, 'notification:new', {
        id: result.notificationId ?? crypto.randomUUID(),
        type: this.mapTypeToWsType(type),
        title,
        message,
        category,
        data: { context, actionUrl, ...metadata },
        timestamp: new Date().toISOString(),
        read: false,
        actionUrl,
      });
      result.delivered.push('websocket');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('NotificationRouter: websocket delivery failed', {
        userId,
        context,
        error: errorMsg,
      });
      result.errors.push(`websocket: ${errorMsg}`);
    }
  }

  private async deliverDiscord(
    title: string,
    message: string,
    result: NotificationRouteResult
  ): Promise<void> {
    try {
      await this.notificationService.sendDiscordNotification({ subject: title, body: message });
      result.delivered.push('discord');
    } catch {
      // Discord is best-effort — missing client or channel is expected
      result.skipped.push('discord');
    }
  }

  // ── Convenience helpers ───────────────────────────────────────────

  /** Resolve context → preference category. */
  getCategoryForContext(context: NotificationContext): keyof NotificationCategories {
    return CONTEXT_TO_CATEGORY[context];
  }

  /** Resolve context → DB notification type. */
  getTypeForContext(context: NotificationContext): NotificationType {
    return CONTEXT_TO_TYPE[context];
  }

  // ── Private ────────────────────────────────────────────────────────

  /** Delegate preference check, swallowing errors (default: deliver). */
  private async shouldDeliver(
    userId: string,
    channel: 'inApp' | 'email' | 'discord',
    category: keyof NotificationCategories
  ): Promise<boolean> {
    try {
      return await this.preferencesService.shouldDeliver(userId, channel, category);
    } catch (err: unknown) {
      logger.warn('NotificationRouter: preference check failed, defaulting to deliver', {
        userId,
        channel,
        category,
        error: err instanceof Error ? err.message : String(err),
      });
      return true; // fail-open: deliver when in doubt
    }
  }

  /**
   * Map a DB NotificationType to the WebSocket type string expected
   * by the frontend notification toast component.
   */
  private mapTypeToWsType(type: NotificationType): string {
    switch (type) {
      case NotificationType.ERROR:
        return 'error';
      case NotificationType.WARNING:
        return 'warning';
      case NotificationType.SUCCESS:
      case NotificationType.ACTIVITY_COMPLETED:
      case NotificationType.FLEET_DEPLOYED:
        return 'success';
      default:
        return 'info';
    }
  }
}

