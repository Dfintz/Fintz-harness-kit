"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventWaitlistService = exports.WaitlistStatus = void 0;
exports.createEventWaitlistService = createEventWaitlistService;
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
var WaitlistStatus;
(function (WaitlistStatus) {
    WaitlistStatus["WAITING"] = "waiting";
    WaitlistStatus["PROMOTED"] = "promoted";
    WaitlistStatus["EXPIRED"] = "expired";
    WaitlistStatus["CANCELLED"] = "cancelled";
})(WaitlistStatus || (exports.WaitlistStatus = WaitlistStatus = {}));
const DEFAULT_WAITLIST_CONFIG = {
    promotionExpirationMs: 24 * 60 * 60 * 1000,
};
class EventWaitlistService {
    activityRepository;
    notificationService;
    config;
    waitlists = new Map();
    entryIdCounter = 1;
    constructor(notificationService, config) {
        this.activityRepository = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
        this.notificationService = notificationService;
        this.config = { ...DEFAULT_WAITLIST_CONFIG, ...config };
    }
    async joinWaitlist(eventId, userId, organizationId, notes) {
        const activity = await this.activityRepository.findOne({ where: { id: eventId } });
        if (!activity) {
            throw new apiErrors_1.NotFoundError('Event');
        }
        if (activity.activityType !== Activity_1.ActivityType.EVENT) {
            throw new apiErrors_1.ValidationError('Waitlists are only available for EVENT type activities');
        }
        const participantRepo = data_source_1.AppDataSource.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
        const acceptedCount = await participantRepo.count({
            where: { activityId: eventId, status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED },
        });
        const maxParticipants = activity.maxParticipants || Infinity;
        if (acceptedCount < maxParticipants) {
            throw new apiErrors_1.ConflictError('Event is not full - user should join directly');
        }
        const existingEntry = this.getWaitlistEntry(eventId, userId);
        if (existingEntry?.status === WaitlistStatus.WAITING) {
            throw new apiErrors_1.ConflictError('User is already on the waitlist');
        }
        const isAlreadyParticipant = (await participantRepo.count({
            where: { activityId: eventId, userId, status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED },
        })) > 0;
        if (isAlreadyParticipant) {
            throw new apiErrors_1.ConflictError('User is already a participant');
        }
        let waitlist = this.waitlists.get(eventId);
        if (!waitlist) {
            waitlist = [];
            this.waitlists.set(eventId, waitlist);
        }
        const waitingEntries = waitlist.filter(e => e.status === WaitlistStatus.WAITING);
        const position = waitingEntries.length + 1;
        const entry = {
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
        logger_1.logger.info('User joined event waitlist', {
            eventId,
            userId,
            position,
            eventTitle: activity.title,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
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
        await this.sendWaitlistPositionNotification(entry, activity.title);
        return entry;
    }
    async leaveWaitlist(eventId, userId) {
        const waitlist = this.waitlists.get(eventId);
        if (!waitlist) {
            return false;
        }
        const entryIndex = waitlist.findIndex(e => e.userId === userId && e.status === WaitlistStatus.WAITING);
        if (entryIndex === -1) {
            return false;
        }
        waitlist[entryIndex].status = WaitlistStatus.CANCELLED;
        this.recalculatePositions(eventId);
        logger_1.logger.info('User left event waitlist', { eventId, userId });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
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
    getWaitlist(eventId) {
        const waitlist = this.waitlists.get(eventId);
        if (!waitlist) {
            return [];
        }
        return waitlist
            .filter(e => e.status === WaitlistStatus.WAITING)
            .sort((a, b) => a.position - b.position);
    }
    getWaitlistEntry(eventId, userId) {
        const waitlist = this.waitlists.get(eventId);
        if (!waitlist) {
            return undefined;
        }
        return waitlist.find(e => e.userId === userId);
    }
    getWaitlistPosition(eventId, userId) {
        const entry = this.getWaitlistEntry(eventId, userId);
        if (entry?.status !== WaitlistStatus.WAITING) {
            return null;
        }
        return entry.position;
    }
    async promoteFromWaitlist(eventId, spotsAvailable = 1) {
        const activity = await this.activityRepository.findOne({ where: { id: eventId } });
        if (!activity) {
            throw new apiErrors_1.NotFoundError('Event');
        }
        const waitlist = this.waitlists.get(eventId);
        if (!waitlist) {
            return { promoted: [], notified: 0, remainingWaitlist: 0 };
        }
        const waitingEntries = waitlist
            .filter(e => e.status === WaitlistStatus.WAITING)
            .sort((a, b) => a.position - b.position);
        if (waitingEntries.length === 0) {
            return { promoted: [], notified: 0, remainingWaitlist: 0 };
        }
        const toPromote = waitingEntries.slice(0, spotsAvailable);
        const promoted = [];
        let notified = 0;
        for (const entry of toPromote) {
            entry.status = WaitlistStatus.PROMOTED;
            entry.promotedAt = new Date();
            entry.expiresAt = new Date(Date.now() + this.config.promotionExpirationMs);
            promoted.push(entry);
            try {
                await this.sendPromotionNotification(entry, activity.title);
                entry.notificationSent = true;
                notified++;
            }
            catch (error) {
                logger_1.logger.error('Failed to send promotion notification', {
                    eventId,
                    userId: entry.userId,
                    error,
                });
            }
        }
        this.recalculatePositions(eventId);
        const remainingWaitlist = waitingEntries.length - promoted.length;
        logger_1.logger.info('Promoted users from waitlist', {
            eventId,
            promotedCount: promoted.length,
            notified,
            remainingWaitlist,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
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
    async confirmPromotion(eventId, userId) {
        const entry = this.getWaitlistEntry(eventId, userId);
        if (entry?.status !== WaitlistStatus.PROMOTED) {
            return false;
        }
        if (entry.expiresAt && entry.expiresAt < new Date()) {
            entry.status = WaitlistStatus.EXPIRED;
            logger_1.logger.info('Expired waitlist promotion before confirmation', {
                eventId,
                userId,
                organizationId: entry.organizationId,
            });
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ACTIVITY,
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
            await this.promoteFromWaitlist(eventId, 1);
            return false;
        }
        logger_1.logger.info('User confirmed waitlist promotion', { eventId, userId });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
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
    async expireUnconfirmedPromotions(eventId) {
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
            await this.promoteFromWaitlist(eventId, expiredCount);
            logger_1.logger.info('Expired unconfirmed promotions', { eventId, expiredCount });
            const organizationId = waitlist.find(entry => entry.eventId === eventId)?.organizationId;
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ACTIVITY,
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
    getWaitlistStats(eventId) {
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
        const waitTimes = promoted
            .filter(e => e.promotedAt)
            .map(e => e.promotedAt.getTime() - e.joinedAt.getTime());
        const currentWaitTimes = waiting.map(e => now.getTime() - e.joinedAt.getTime());
        const allWaitTimes = [...waitTimes, ...currentWaitTimes];
        const averageWaitTime = allWaitTimes.length > 0
            ? Math.round(allWaitTimes.reduce((a, b) => a + b, 0) / allWaitTimes.length / 60000)
            : 0;
        const longestWaitTime = allWaitTimes.length > 0 ? Math.round(Math.max(...allWaitTimes) / 60000) : 0;
        return {
            totalWaiting: waiting.length,
            totalPromoted: promoted.length,
            totalExpired: expired.length,
            totalCancelled: cancelled.length,
            averageWaitTime,
            longestWaitTime,
        };
    }
    getUserWaitlistEntries(userId) {
        const entries = [];
        for (const waitlist of this.waitlists.values()) {
            const userEntries = waitlist.filter(e => e.userId === userId && e.status === WaitlistStatus.WAITING);
            entries.push(...userEntries);
        }
        return entries;
    }
    clearWaitlist(eventId) {
        const organizationId = this.waitlists.get(eventId)?.[0]?.organizationId;
        this.waitlists.delete(eventId);
        logger_1.logger.info('Event waitlist cleared', { eventId });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
            action: 'EVENT_WAITLIST_CLEARED',
            message: `Cleared waitlist for event ${eventId}`,
            organizationId,
            resource: `event/${eventId}/waitlist`,
            metadata: {
                eventId,
            },
        });
    }
    recalculatePositions(eventId) {
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
    async sendWaitlistPositionNotification(entry, eventTitle) {
        await this.notificationService.sendDiscordNotification({
            subject: 'Added to Waitlist',
            body: `You've been added to the waitlist for "${eventTitle}". Your position: #${entry.position}`,
            recipientIds: [entry.userId],
        });
    }
    async sendPromotionNotification(entry, eventTitle) {
        await this.notificationService.sendDiscordNotification({
            subject: 'Spot Available!',
            body: `A spot has opened up for "${eventTitle}"! Please confirm your attendance within 24 hours.`,
            recipientIds: [entry.userId],
        });
    }
    async notifyPositionUpdates(eventId) {
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
            }
            catch (error) {
                logger_1.logger.error('Failed to send position update notification', {
                    eventId,
                    userId: entry.userId,
                    error,
                });
            }
        }
        return notified;
    }
}
exports.EventWaitlistService = EventWaitlistService;
function createEventWaitlistService(notificationService, config) {
    return new EventWaitlistService(notificationService, config);
}
//# sourceMappingURL=EventWaitlistService.js.map