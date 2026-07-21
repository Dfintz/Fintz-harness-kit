// Activity Services Index
// Phase 4.1 - Domain Separation (Completed)
// Phase 4.2 - Event Domain Consolidation (Completed Q4 2025)
// Phase 4.3 - Operations Domain Cleanup (Completed Q4 2025)
// Phase 1 Roadmap - Deprecated Service Removal (Completed Q4 2025)
// Phase 5 - Comprehensive Audit Logging (Completed December 2025)
// Event domain services (Reminder, Attendance, Calendar) merged into Activity domain

export { ActivityAnalyticsService } from './ActivityAnalyticsService';
export {
  ActivityDiscordSyncService,
  activityDiscordSyncService,
} from './ActivityDiscordSyncService';
export { ActivityEventService } from './ActivityEventService';
export { ActivityJobService } from './ActivityJobService';
export { ActivityParticipantService } from './ActivityParticipantService';
export { ActivityService } from './ActivityService';
export { ActivityTemplateService } from './activityTemplate.service';
export type {
  ApplyTemplateDTO,
  CreateTemplateDTO,
  TemplateQueryFilters,
  UpdateTemplateDTO,
} from './activityTemplate.service';
export { CalendarExportService } from './CalendarExportService';
export { OperationService } from './OperationService';
export { RecurringActivityService } from './RecurringActivityService';
export type { RecurrenceRule, RecurringActivityTemplate } from './RecurringActivityService';

// Audit logging for Activity domain (Phase 5 - December 2025)
export {
  ActivityAuditAction,
  ActivityAuditLogger,
  activityAuditLogger,
} from './ActivityAuditLogger';
export type { ActivityAuditEntry } from './ActivityAuditLogger';

// Wave 1.8 — Event Mirroring (February 2026)
export { EventMirrorService } from './EventMirrorService';
export type { CreateMirrorDTO, MirrorResult } from './EventMirrorService';

// Temporary Event Roles (Sprint 26 — Phase 2)
export { EventTempRoleService } from './EventTempRoleService';

// Wave 1.7 — Route Planning Enhancement (February 2026)
export { RouteCalculationService } from './RouteCalculationService';
export type { RouteCalculationResult } from './RouteCalculationService';

// Event domain services merged into Activity domain (Q4 2025)
export { ActivityAttendanceService } from './ActivityAttendanceService';
export { ActivityCalendarService } from './ActivityCalendarService';
export { ActivityReminderService } from './ActivityReminderService';
export { ActivityStarCommsOrchestrationService } from './ActivityStarCommsOrchestrationService';

// Re-export types from ActivityReminderService
export type {
  CreateReminderParams,
  ProcessRemindersResult,
  ReminderStats,
} from './ActivityReminderService';

// Re-export types from ActivityAttendanceService
export type {
  AttendanceRecord,
  AttendanceStats,
  UserAttendanceHistory,
} from './ActivityAttendanceService';

// Re-export types and interfaces from ActivityService
export type {
  ActivitySearchFilters,
  ActivityStatistics,
  CreateActivityDTO,
  JoinActivityDTO,
} from './ActivityService';

// Re-export types from OperationService
export type { CreateOperationDTO } from './OperationService';

// Legacy compatibility exports (deprecated - use Activity* services instead)
// NOTE: EventReminderService export removed (Jan 7, 2026). Use ActivityReminderService directly.
export { ActivityAttendanceService as AttendanceConfirmationService } from './ActivityAttendanceService';
export { ActivityCalendarService as ICalService } from './ActivityCalendarService';

/**
 * Activity Service Domain Architecture
 *
 * This module provides a domain-separated activity management system
 * split from the original monolithic ActivityService for better
 * maintainability and testing.
 *
 * Services:
 * - ActivityService: Core CRUD operations and basic functionality
 * - ActivityParticipantService: Participant management and ship assignments
 * - ActivityEventService: Event lifecycle and Discord integration
 * - ActivityJobService: Job applications and contractor screening
 * - ActivityAnalyticsService: Analytics, reporting, and metrics
 * - OperationService: Operation management
 * - ActivityReminderService: Reminder management (merged from event/ domain)
 * - ActivityAttendanceService: Attendance tracking (merged from event/ domain)
 * - ActivityCalendarService: Calendar/ICS export (merged from event/ domain)
 * - ActivityAuditLogger: Centralized audit logging for all activity operations
 *
 * REMOVED (Phase 1 Cleanup - November 2025):
 * - ActivityLFGService: Use SocialGroupService directly instead
 *
 * @since Phase 4.1 - Domain Separation
 * @since Phase 4.2 - Event Domain Consolidation (Q4 2025)
 * @since Phase 4.3 - Operations Domain Cleanup (Q4 2025)
 * @since Phase 1 Roadmap - Deprecated Service Removal (Q4 2025)
 * @since Phase 5 - Comprehensive Audit Logging (December 2025)
 * @author GitHub Copilot
 */
