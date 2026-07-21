/**
 * Event Domain Services
 * 
 * This module contains event-specific services that extend the Activity domain functionality.
 * 
 * Note: The following services have been merged into the Activity domain:
 * - EventReminderService → ActivityReminderService (use from '../activity')
 * - EventAttendanceService → ActivityAttendanceService (use from '../activity')
 * - ICalService → ActivityCalendarService (use from '../activity')
 * 
 * For general event/activity functionality, use services from '../activity'.
 * This module only exports specialized event features.
 * 
 * @since v3.0.0 - Event Specialization
 */

// Export waitlist service (new in Dec 2025)
export { 
    EventWaitlistService, 
    createEventWaitlistService,
    WaitlistStatus
} from './EventWaitlistService';
export type {
    WaitlistEntry,
    PromotionResult,
    WaitlistStats,
    WaitlistConfig
} from './EventWaitlistService';

// Export conflict detection service (new in Dec 2025)
export { EventConflictService } from './EventConflictService';
export type {
    ActivityConflict,
    ConflictDetectionOptions,
    ConflictCheckResult
} from './EventConflictService';



