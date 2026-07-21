/**
 * Event Waitlist Service
 *
 * Manages waitlists for events when capacity is reached:
 * - Join/leave waitlist
 * - Automatic promotion when spots open
 * - Priority queue based on join time
 * - Waitlist notifications
 */

import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Activity, ActivityType } from '../../models/Activity';
import {
  ActivityParticipantEntity,
  ActivityParticipantStatus,
} from '../../models/ActivityParticipant';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { AuditCategory, auditService } from '../audit/AuditService';
import { NotificationService } from '../communication';

/**
 * Waitlist entry status
 */
export enum WaitlistStatus {
  WAITING = 'waiting',
  PROMOTED = 'promoted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

/**
 * Waitlist entry
 */
export interface WaitlistEntry {
  id: string;
  eventId: string;
  userId: string;
  organizationId: string;
  position: number;
  status: WaitlistStatus;
  joinedAt: Date;
  promotedAt?: Date;
  expiresAt?: Date;
  notes?: string;
  notificationSent: boolean;
}

/**
 * Waitlist promotion result
 */
export interface PromotionResult {
  promoted: WaitlistEntry[];
  notified: number;
  remainingWaitlist: number;
}

/**
 * Waitlist statistics
 */
export interface WaitlistStats {
  totalWaiting: number;
  totalPromoted: number;
  totalExpired: number;
  totalCancelled: number;
  averageWaitTime: number; // in minutes
  longestWaitTime: number; // in minutes
}

/**
 * Waitlist configuration
 */
export interface WaitlistConfig {
  /** Default promotion expiration time in milliseconds (default: 24 hours) */
  promotionExpirationMs: number;
}

/** Default waitlist configuration */
const DEFAULT_WAITLIST_CONFIG: WaitlistConfig = {
  promotionExpirationMs: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Event Waitlist Service
 *
 * Manages waitlist functionality for events
 */
export class EventWaitlistService {
  private activityRepository: Repository<Activity>;
  private notificationService: NotificationService;
  private config: WaitlistConfig;

  // In-memory waitlist storage (would typically be in database)
  private waitlists: Map<string, WaitlistEntry[]> = new Map();
  private entryIdCounter: number = 1;

  constructor(notificationService: NotificationService, config?: Partial<WaitlistConfig>) {
    this.activityRepository = AppDataSource.getRepository(Activity);
    this.notificationService = notificationService;
    this.config = { ...DEFAULT_WAITLIST_CONFIG, ...config };
  }

  /**
   * Add a user to the waitlist for an event
   */
  async joinWaitlist(
    eventId: string,
    userId: string,
    organizationId: string,
    notes?: string
  ): Promise<WaitlistEntry> {
    // Verify event exists and is of type EVENT
    const activity = await this.activityRepository.findOne({ where: { id: eventId } });
    if (!activity) {
      throw new NotFoundError('Event');
    }

    if (activity.activityType !== ActivityType.EVENT) {
      throw new ValidationError('Waitlists are only available for EVENT type activities');
    }

    // Check if event is full (normalized table count)
    const participantRepo = AppDataSource.getRepository(ActivityParticipantEntity);
    const acceptedCount = await participantRepo.count({
      where: { activityId: eventId, status: ActivityParticipantStatus.ACCEPTED },
    });
    const maxParticipants = activity.maxParticipants || Infinity;

    if (acceptedCount < maxParticipants) {
      throw new ConflictError('Event is not full - user should join directly');
    }

    // Check if user is already on waitlist
    const existingEntry = this.getWaitlistEntry(eventId, userId);
    if (existingEntry?.status === WaitlistStatus.WAITING) {
      throw new ConflictError('User is already on the waitlist');
    }

    // Check if user is already a participant (normalized table)
    const isAlreadyParticipant =
      (await participantRepo.count({
        where: { activityId: eventId, userId, status: ActivityParticipantStatus.ACCEPTED },
      })) > 0;
    if (isAlreadyParticipant) {
      throw new ConflictError('User is already a participant');
    }

    // Get or create waitlist for this event
    let waitlist = this.waitlists.get(eventId);
    if (!waitlist) {
      waitlist = [];
      this.waitlists.set(eventId, waitlist);
    }

    // Calculate position
    const waitingEntries = waitlist.filter(e => e.status === WaitlistStatus.WAITING);
    const position = waitingEntries.length + 1;

    // Create entry
    const entry: WaitlistEntry = {
      id: `wl-${this.entryIdCounter++}`,
      eventId,
      userId,
      organizationId,
      position,
      status: WaitlistStatus.WAITING,
      joinedAt: new Date(),
      notes,
      notificationSent: false,
    };

    waitlist.push(entry);

    logger.info('User joined event waitlist', {
      eventId,
      userId,
      position,
      eventTitle: activity.title,
    });

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'EVENT_WAITLIST_JOINED',
      message: `User ${userId} joined waitlist for event ${eventId}`,
      organizationId,
      userId,
      resource: `event/${eventId}/waitlist/${entry.id}`,
      metadata: {
        eventId,
        waitlistEntryId: entry.id,
        position,
      },
    });

    // Notify user of their position
    await this.sendWaitlistPositionNotification(entry, activity.title);

    return entry;
  }

  /**
   * Remove a user from the waitlist
   */
  async leaveWaitlist(eventId: string, userId: string): Promise<boolean> {
    const waitlist = this.waitlists.get(eventId);
    if (!waitlist) {
      return false;
    }

    const entryIndex = waitlist.findIndex(
      e => e.userId === userId && e.status === WaitlistStatus.WAITING
    );

    if (entryIndex === -1) {
      return false;
    }

    // Mark as cancelled
    waitlist[entryIndex].status = WaitlistStatus.CANCELLED;

    // Recalculate positions for remaining entries
    this.recalculatePositions(eventId);

    logger.info('User left event waitlist', { eventId, userId });

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'EVENT_WAITLIST_LEFT',
      message: `User ${userId} left waitlist for event ${eventId}`,
      organizationId: waitlist[entryIndex].organizationId,
      userId,
      resource: `event/${eventId}/waitlist/${waitlist[entryIndex].id}`,
      metadata: {
        eventId,
        waitlistEntryId: waitlist[entryIndex].id,
      },
    });

    return true;
  }

  /**
   * Get waitlist for an event
   */
  getWaitlist(eventId: string): WaitlistEntry[] {
    const waitlist = this.waitlists.get(eventId);
    if (!waitlist) {
      return [];
    }

    return waitlist
      .filter(e => e.status === WaitlistStatus.WAITING)
      .sort((a, b) => a.position - b.position);
  }

  /**
   * Get a specific waitlist entry
   */
  getWaitlistEntry(eventId: string, userId: string): WaitlistEntry | undefined {
    const waitlist = this.waitlists.get(eventId);
    if (!waitlist) {
      return undefined;
    }

    return waitlist.find(e => e.userId === userId);
  }

  /**
   * Get user's position on the waitlist
   */
  getWaitlistPosition(eventId: string, userId: string): number | null {
    const entry = this.getWaitlistEntry(eventId, userId);
    if (entry?.status !== WaitlistStatus.WAITING) {
      return null;
    }
    return entry.position;
  }

  /**
   * Promote users from waitlist when spots open
   */
  async promoteFromWaitlist(eventId: string, spotsAvailable: number = 1): Promise<PromotionResult> {
    const activity = await this.activityRepository.findOne({ where: { id: eventId } });
    if (!activity) {
      throw new NotFoundError('Event');
    }

    const waitlist = this.waitlists.get(eventId);
    if (!waitlist) {
      return { promoted: [], notified: 0, remainingWaitlist: 0 };
    }

    // Get waiting entries sorted by position
    const waitingEntries = waitlist
      .filter(e => e.status === WaitlistStatus.WAITING)
      .sort((a, b) => a.position - b.position);

    if (waitingEntries.length === 0) {
      return { promoted: [], notified: 0, remainingWaitlist: 0 };
    }

    // Promote up to spotsAvailable users
    const toPromote = waitingEntries.slice(0, spotsAvailable);
    const promoted: WaitlistEntry[] = [];
    let notified = 0;

    for (const entry of toPromote) {
      entry.status = WaitlistStatus.PROMOTED;
      entry.promotedAt = new Date();
      entry.expiresAt = new Date(Date.now() + this.config.promotionExpirationMs);

      promoted.push(entry);

      // Send promotion notification
      try {
        await this.sendPromotionNotification(entry, activity.title);
        entry.notificationSent = true;
        notified++;
      } catch (error: unknown) {
        logger.error('Failed to send promotion notification', {
          eventId,
          userId: entry.userId,
          error,
        });
      }
    }

    // Recalculate positions
    this.recalculatePositions(eventId);

    const remainingWaitlist = waitingEntries.length - promoted.length;

    logger.info('Promoted users from waitlist', {
      eventId,
      promotedCount: promoted.length,
      notified,
      remainingWaitlist,
    });

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'EVENT_WAITLIST_PROMOTED',
      message: `Promoted ${promoted.length} users from waitlist for event ${eventId}`,
      organizationId: activity.organizationId ?? undefined,
      resource: `event/${eventId}/waitlist`,
      metadata: {
        eventId,
        promotedCount: promoted.length,
        promotedUserIds: promoted.map(entry => entry.userId),
        remainingWaitlist,
      },
    });

    return { promoted, notified, remainingWaitlist };
  }

  /**
   * Handle promotion confirmation (user accepts their spot)
   */
  async confirmPromotion(eventId: string, userId: string): Promise<boolean> {
    const entry = this.getWaitlistEntry(eventId, userId);

    if (entry?.status !== WaitlistStatus.PROMOTED) {
      return false;
    }

    // Check if promotion has expired
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      entry.status = WaitlistStatus.EXPIRED;

      logger.info('Expired waitlist promotion before confirmation', {
        eventId,
        userId,
        organizationId: entry.organizationId,
      });

      auditService.log({
        category: AuditCategory.ACTIVITY,
        action: 'EVENT_WAITLIST_PROMOTION_EXPIRED',
        message: `Waitlist promotion expired for user ${userId} in event ${eventId}`,
        organizationId: entry.organizationId,
        userId,
        resource: `event/${eventId}/waitlist/${entry.id}`,
        metadata: {
          eventId,
          waitlistEntryId: entry.id,
        },
      });

      // Promote next person in line
      await this.promoteFromWaitlist(eventId, 1);

      return false;
    }

    logger.info('User confirmed waitlist promotion', { eventId, userId });

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'EVENT_WAITLIST_PROMOTION_CONFIRMED',
      message: `User ${userId} confirmed waitlist promotion for event ${eventId}`,
      organizationId: entry.organizationId,
      userId,
      resource: `event/${eventId}/waitlist/${entry.id}`,
      metadata: {
        eventId,
        waitlistEntryId: entry.id,
      },
    });

    return true;
  }

  /**
   * Expire promotions that haven't been confirmed
   */
  async expireUnconfirmedPromotions(eventId: string): Promise<number> {
    const waitlist = this.waitlists.get(eventId);
    if (!waitlist) {
      return 0;
    }

    const now = new Date();
    let expiredCount = 0;

    for (const entry of waitlist) {
      if (entry.status === WaitlistStatus.PROMOTED && entry.expiresAt && entry.expiresAt < now) {
        entry.status = WaitlistStatus.EXPIRED;
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      // Promote next users
      await this.promoteFromWaitlist(eventId, expiredCount);

      logger.info('Expired unconfirmed promotions', { eventId, expiredCount });

      const organizationId = waitlist.find(entry => entry.eventId === eventId)?.organizationId;

      auditService.log({
        category: AuditCategory.ACTIVITY,
        action: 'EVENT_WAITLIST_UNCONFIRMED_PROMOTIONS_EXPIRED',
        message: `Expired ${expiredCount} unconfirmed waitlist promotions for event ${eventId}`,
        organizationId,
        resource: `event/${eventId}/waitlist`,
        metadata: {
          eventId,
          expiredCount,
        },
      });
    }

    return expiredCount;
  }

  /**
   * Get waitlist statistics for an event
   */
  getWaitlistStats(eventId: string): WaitlistStats {
    const waitlist = this.waitlists.get(eventId);

    if (!waitlist || waitlist.length === 0) {
      return {
        totalWaiting: 0,
        totalPromoted: 0,
        totalExpired: 0,
        totalCancelled: 0,
        averageWaitTime: 0,
        longestWaitTime: 0,
      };
    }

    const now = new Date();
    const waiting = waitlist.filter(e => e.status === WaitlistStatus.WAITING);
    const promoted = waitlist.filter(e => e.status === WaitlistStatus.PROMOTED);
    const expired = waitlist.filter(e => e.status === WaitlistStatus.EXPIRED);
    const cancelled = waitlist.filter(e => e.status === WaitlistStatus.CANCELLED);

    // Calculate wait times for promoted entries
    const waitTimes = promoted
      .filter(e => e.promotedAt)
      // @ts-expect-error - Strict mode compatibility
      .map(e => e.promotedAt.getTime() - e.joinedAt.getTime());

    // Calculate wait times for currently waiting entries
    const currentWaitTimes = waiting.map(e => now.getTime() - e.joinedAt.getTime());
    const allWaitTimes = [...waitTimes, ...currentWaitTimes];

    const averageWaitTime =
      allWaitTimes.length > 0
        ? Math.round(allWaitTimes.reduce((a, b) => a + b, 0) / allWaitTimes.length / 60000)
        : 0;

    const longestWaitTime =
      allWaitTimes.length > 0 ? Math.round(Math.max(...allWaitTimes) / 60000) : 0;

    return {
      totalWaiting: waiting.length,
      totalPromoted: promoted.length,
      totalExpired: expired.length,
      totalCancelled: cancelled.length,
      averageWaitTime,
      longestWaitTime,
    };
  }

  /**
   * Get all waitlist entries for a user across all events
   */
  getUserWaitlistEntries(userId: string): WaitlistEntry[] {
    const entries: WaitlistEntry[] = [];

    for (const waitlist of this.waitlists.values()) {
      const userEntries = waitlist.filter(
        e => e.userId === userId && e.status === WaitlistStatus.WAITING
      );
      entries.push(...userEntries);
    }

    return entries;
  }

  /**
   * Clear waitlist for an event
   */
  clearWaitlist(eventId: string): void {
    const organizationId = this.waitlists.get(eventId)?.[0]?.organizationId;

    this.waitlists.delete(eventId);
    logger.info('Event waitlist cleared', { eventId });

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'EVENT_WAITLIST_CLEARED',
      message: `Cleared waitlist for event ${eventId}`,
      organizationId,
      resource: `event/${eventId}/waitlist`,
      metadata: {
        eventId,
      },
    });
  }

  /**
   * Recalculate positions after changes
   */
  private recalculatePositions(eventId: string): void {
    const waitlist = this.waitlists.get(eventId);
    if (!waitlist) {
      return;
    }

    const waiting = waitlist
      .filter(e => e.status === WaitlistStatus.WAITING)
      .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());

    waiting.forEach((entry, index) => {
      entry.position = index + 1;
    });
  }

  /**
   * Send waitlist position notification
   */
  private async sendWaitlistPositionNotification(
    entry: WaitlistEntry,
    eventTitle: string
  ): Promise<void> {
    await this.notificationService.sendDiscordNotification({
      subject: 'Added to Waitlist',
      body: `You've been added to the waitlist for "${eventTitle}". Your position: #${entry.position}`,
      recipientIds: [entry.userId],
    });
  }

  /**
   * Send promotion notification
   */
  private async sendPromotionNotification(entry: WaitlistEntry, eventTitle: string): Promise<void> {
    await this.notificationService.sendDiscordNotification({
      subject: 'Spot Available!',
      body: `A spot has opened up for "${eventTitle}"! Please confirm your attendance within 24 hours.`,
      recipientIds: [entry.userId],
    });
  }

  /**
   * Notify all waiting users of position updates
   */
  async notifyPositionUpdates(eventId: string): Promise<number> {
    const activity = await this.activityRepository.findOne({ where: { id: eventId } });
    if (!activity) {
      return 0;
    }

    const waitlist = this.getWaitlist(eventId);
    let notified = 0;

    for (const entry of waitlist) {
      try {
        await this.notificationService.sendDiscordNotification({
          subject: 'Waitlist Position Updated',
          body: `Your position for "${activity.title}" is now #${entry.position}`,
          recipientIds: [entry.userId],
        });
        notified++;
      } catch (error: unknown) {
        logger.error('Failed to send position update notification', {
          eventId,
          userId: entry.userId,
          error,
        });
      }
    }

    return notified;
  }
}

// Export singleton - needs NotificationService injection
export function createEventWaitlistService(
  notificationService: NotificationService,
  config?: Partial<WaitlistConfig>
): EventWaitlistService {
  return new EventWaitlistService(notificationService, config);
}
