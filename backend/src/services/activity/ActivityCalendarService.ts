import { AppDataSource } from '../../data-source';
import { Activity, ActivityType } from '../../models/Activity';
import { Event } from '../../types';

/**
 * ActivityCalendarService - Unified calendar export for activities
 *
 * Consolidates calendar functionality from:
 * - CalendarExportService (Activity-based ICS generation)
 * - ICalService (Legacy Event-based ICS generation)
 *
 * Supports ICS format export and Google Calendar integration for all activity types.
 *
 * @author GitHub Copilot
 * @since Activity Domain Consolidation (Q4 2025)
 */
export class ActivityCalendarService {
  private static instance: ActivityCalendarService;
  private activityRepository = AppDataSource.getRepository(Activity);

  // Public constructor for direct instantiation (backward compatibility with ICalService)
  constructor() {}

  /**
   * Get singleton instance for services that prefer singleton pattern
   */
  public static getInstance(): ActivityCalendarService {
    if (!ActivityCalendarService.instance) {
      ActivityCalendarService.instance = new ActivityCalendarService();
    }
    return ActivityCalendarService.instance;
  }

  // ==================== ACTIVITY-BASED ICS GENERATION ====================

  /**
   * Generate ICS calendar file for organization activities
   * @param organizationId - Organization ID
   * @param options - Optional filters for activities
   */
  public async generateICS(
    organizationId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      activityTypes?: string[];
      includePrivate?: boolean;
    }
  ): Promise<string> {
    const query = this.activityRepository
      .createQueryBuilder('activity')
      // Select only fields needed for ICS/calendar — exclude large JSON blobs
      .select([
        'activity.id',
        'activity.title',
        'activity.description',
        'activity.scheduledStartDate',
        'activity.scheduledEndDate',
        'activity.location',
        'activity.activityType',
        'activity.status',
        'activity.organizationId',
        'activity.organizationName',
        'activity.currentParticipants',
        'activity.maxParticipants',
        'activity.creatorId',
        'activity.creatorName',
        'activity.createdAt',
        'activity.updatedAt',
      ])
      .where('activity.organizationId = :organizationId', { organizationId });

    // Exclude internal recruitment unless specific types requested
    if (!options?.activityTypes || options.activityTypes.length === 0) {
      query.andWhere('activity.activityType != :excludedType', {
        excludedType: ActivityType.RECRUITMENT,
      });
    }

    // Default date bounds to prevent unbounded loads (past 6 months → future 12 months)
    if (!options?.startDate) {
      const defaultStart = new Date();
      defaultStart.setMonth(defaultStart.getMonth() - 6);
      query.andWhere('activity.scheduledStartDate >= :defaultStart', { defaultStart });
    } else {
      query.andWhere('activity.scheduledStartDate >= :startDate', { startDate: options.startDate });
    }

    if (!options?.endDate) {
      const defaultEnd = new Date();
      defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);
      query.andWhere('activity.scheduledStartDate <= :defaultEnd', { defaultEnd });
    } else {
      query.andWhere('activity.scheduledEndDate <= :endDate', { endDate: options.endDate });
    }

    if (options?.activityTypes && options.activityTypes.length > 0) {
      query.andWhere('activity.activityType IN (:...types)', { types: options.activityTypes });
    }

    // Hard cap to prevent OOM on massive orgs
    const activities = await query.take(5000).getMany();

    return this.buildICSContent(activities, organizationId);
  }

  /**
   * Generate ICS for a single activity
   * @param activityId - Activity ID
   */
  public async generateActivityICS(activityId: string): Promise<string> {
    const activity = await this.activityRepository.findOne({
      where: { id: activityId },
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    return this.buildICSContent([activity], activity.organizationId ?? '');
  }

  /**
   * Generate ICS for user's activities across organizations
   * @param userId - User ID
   * @param options - Optional filters
   */
  public async generateUserICS(
    userId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<string> {
    const query = this.activityRepository
      .createQueryBuilder('activity')
      .where('activity.creatorId = :userId', { userId });

    if (options?.startDate) {
      query.andWhere('activity.scheduledStartDate >= :startDate', { startDate: options.startDate });
    }

    if (options?.endDate) {
      query.andWhere('activity.scheduledEndDate <= :endDate', { endDate: options.endDate });
    }

    const activities = await query.getMany();

    return this.buildICSContent(activities, `user-${userId}`);
  }

  /**
   * Build ICS file content from activities
   */
  private buildICSContent(activities: Activity[], calendarId: string): string {
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Star Citizen Fleet Manager//Activities//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:SC Fleet Manager - ${calendarId}`,
      'X-WR-TIMEZONE:UTC',
    ];

    // Add VTIMEZONE component for UTC
    lines.push(
      'BEGIN:VTIMEZONE',
      'TZID:UTC',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0000',
      'TZOFFSETTO:+0000',
      'END:STANDARD',
      'END:VTIMEZONE'
    );

    // Add events
    for (const activity of activities) {
      lines.push(...this.buildVEvent(activity));
    }

    lines.push('END:VCALENDAR');

    return lines.join('\r\n');
  }

  /**
   * Build VEVENT component for an activity
   */
  private buildVEvent(activity: Activity): string[] {
    const uid = `${activity.id}@fringecore.space`;
    const now = this.formatICSDate(new Date());
    const startDate = activity.scheduledStartDate || new Date();
    const endDate = activity.scheduledEndDate || new Date(startDate.getTime() + 60 * 60 * 1000);
    const dtstart = this.formatICSDate(startDate);
    const dtend = this.formatICSDate(endDate);

    const lines: string[] = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${this.escapeICSText(activity.title)}`,
    ];

    if (activity.description) {
      lines.push(`DESCRIPTION:${this.escapeICSText(activity.description)}`);
    }

    if (activity.location) {
      lines.push(`LOCATION:${this.escapeICSText(activity.location)}`);
    }

    // Add activity type as category
    if (activity.activityType) {
      lines.push(`CATEGORIES:${activity.activityType}`);
    }

    // Add URL if available
    lines.push(`URL:https://fringecore.space/activities/${activity.id}`);

    // Add organizer if available
    if (activity.creatorId) {
      lines.push(`ORGANIZER:mailto:${activity.creatorId}@fringecore.space`);
    }

    // Add status
    const status = this.mapActivityStatus(activity.status);
    if (status) {
      lines.push(`STATUS:${status}`);
    }

    // Add recurrence rule if applicable (from metadata)
    if (activity.metadata?.recurrencePattern && activity.metadata.recurrencePattern !== 'none') {
      const rrule = this.buildRecurrenceRule(
        activity.metadata.recurrencePattern,
        activity.metadata.recurrenceEndDate
      );
      if (rrule) {
        lines.push(rrule);
      }
    }

    // Add created/updated timestamps
    if (activity.createdAt) {
      lines.push(`CREATED:${this.formatICSDate(activity.createdAt)}`);
    }
    if (activity.updatedAt) {
      lines.push(`LAST-MODIFIED:${this.formatICSDate(activity.updatedAt)}`);
    }

    lines.push('END:VEVENT');

    return lines;
  }

  /**
   * Get calendar data for a date range
   * Returns activities formatted for calendar display
   */
  public async getCalendar(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    view?: string
  ): Promise<Record<string, unknown>> {
    const query = this.activityRepository
      .createQueryBuilder('activity')
      // Lightweight select for calendar — exclude participants JSON blob
      .select([
        'activity.id',
        'activity.title',
        'activity.scheduledStartDate',
        'activity.scheduledEndDate',
        'activity.activityType',
        'activity.status',
        'activity.location',
        'activity.description',
      ])
      .where('activity.organizationId = :organizationId', { organizationId })
      .andWhere('activity.scheduledStartDate >= :startDate', { startDate })
      .andWhere('activity.scheduledStartDate <= :endDate', { endDate })
      .andWhere('activity.activityType != :excludedType', {
        excludedType: ActivityType.RECRUITMENT,
      });

    const activities = await query
      .orderBy('activity.scheduledStartDate', 'ASC')
      .take(500) // Cap to prevent unbounded result sets on large date ranges
      .getMany();

    // Format activities for calendar display
    return {
      events: activities.map(activity => ({
        id: activity.id,
        title: activity.title,
        start: activity.scheduledStartDate,
        end: activity.scheduledEndDate,
        type: activity.activityType,
        status: activity.status,
        location: activity.location,
        description: activity.description,
      })),
      view: view || 'month',
    };
  }

  // ==================== LEGACY EVENT SUPPORT ====================

  /**
   * Generate ICS for a legacy Event object
   * @deprecated Use generateActivityICS instead
   */
  public generateICalEvent(event: Event): string {
    const now = new Date();
    const dateFormat = (date: Date): string =>
      `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;

    const icalLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Star Citizen Fleet Manager//Event//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${event.id}@sc-fleet-manager`,
      `DTSTAMP:${dateFormat(now)}`,
      `DTSTART:${dateFormat(new Date(event.date))}`,
      `SUMMARY:${this.escapeICSText(event.title)}`,
      `DESCRIPTION:${this.escapeICSText(event.description)}`,
      `LOCATION:${this.escapeICSText(event.location)}`,
    ];

    if (event.organizerId) {
      icalLines.push(`ORGANIZER:${event.organizerId}`);
    }

    // Add recurrence rule if applicable
    if (event.recurrencePattern && event.recurrencePattern !== 'none') {
      const rrule = this.buildRecurrenceRule(
        event.recurrencePattern,
        event.recurrenceEndDate ? new Date(event.recurrenceEndDate) : undefined
      );
      if (rrule) {
        icalLines.push(rrule);
      }
    }

    icalLines.push('END:VEVENT');
    icalLines.push('END:VCALENDAR');

    return icalLines.join('\r\n');
  }

  /**
   * Generate ICS for multiple legacy Event objects
   * @deprecated Use generateICS instead
   */
  public generateICalCalendar(events: Event[]): string {
    const now = new Date();
    const dateFormat = (date: Date): string =>
      `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;

    const icalLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Star Citizen Fleet Manager//Events//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    events.forEach(event => {
      icalLines.push('BEGIN:VEVENT');
      icalLines.push(`UID:${event.id}@sc-fleet-manager`);
      icalLines.push(`DTSTAMP:${dateFormat(now)}`);
      icalLines.push(`DTSTART:${dateFormat(new Date(event.date))}`);
      icalLines.push(`SUMMARY:${this.escapeICSText(event.title)}`);
      icalLines.push(`DESCRIPTION:${this.escapeICSText(event.description)}`);
      icalLines.push(`LOCATION:${this.escapeICSText(event.location)}`);

      if (event.organizerId) {
        icalLines.push(`ORGANIZER:${event.organizerId}`);
      }

      if (event.recurrencePattern && event.recurrencePattern !== 'none') {
        const rrule = this.buildRecurrenceRule(
          event.recurrencePattern,
          event.recurrenceEndDate ? new Date(event.recurrenceEndDate) : undefined
        );
        if (rrule) {
          icalLines.push(rrule);
        }
      }

      icalLines.push('END:VEVENT');
    });

    icalLines.push('END:VCALENDAR');

    return icalLines.join('\r\n');
  }

  // ==================== GOOGLE CALENDAR INTEGRATION ====================

  /**
   * Generate Google Calendar URL for an activity
   * @param activity - Activity to generate URL for
   */
  public generateGoogleCalendarUrl(activity: Activity): string {
    const baseUrl = 'https://www.google.com/calendar/render';
    const startDate = activity.scheduledStartDate || new Date();
    const endDate = activity.scheduledEndDate || new Date(startDate.getTime() + 60 * 60 * 1000);

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: activity.title,
      dates: `${this.formatGoogleDate(startDate)}/${this.formatGoogleDate(endDate)}`,
      details: activity.description || '',
      location: activity.location || '',
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Generate webcal:// subscription URL
   * @param organizationId - Organization ID
   * @param token - Authentication token
   * @param baseUrl - Base URL for the API
   */
  public generateWebcalUrl(
    organizationId: string,
    token: string,
    baseUrl: string = 'https://api.fringecore.space'
  ): string {
    return `webcal://${baseUrl.replace(/^https?:\/\//, '')}/api/calendar/${organizationId}/ics?token=${token}`;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Format date for ICS format (YYYYMMDDTHHMMSSZ)
   */
  private formatICSDate(date: Date): string {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  }

  /**
   * Format date for Google Calendar URL
   */
  private formatGoogleDate(date: Date): string {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  }

  /**
   * Escape special characters for ICS text fields
   * @param text - Text to escape (handles null/undefined by returning empty string)
   */
  private escapeICSText(text: string | null | undefined): string {
    if (!text) {
      return '';
    }
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  /**
   * Build recurrence rule for ICS
   */
  private buildRecurrenceRule(pattern: string, endDate?: Date): string | null {
    let freq = '';
    switch (pattern) {
      case 'daily':
        freq = 'DAILY';
        break;
      case 'weekly':
        freq = 'WEEKLY';
        break;
      case 'monthly':
        freq = 'MONTHLY';
        break;
      default:
        return null;
    }

    let rrule = `RRULE:FREQ=${freq}`;
    if (endDate) {
      rrule += `;UNTIL=${this.formatICSDate(endDate)}`;
    }
    return rrule;
  }

  /**
   * Map activity status to ICS status
   */
  private mapActivityStatus(status: string): string | null {
    const statusMap: Record<string, string> = {
      open: 'CONFIRMED',
      in_progress: 'CONFIRMED',
      completed: 'CONFIRMED',
      cancelled: 'CANCELLED',
      draft: 'TENTATIVE',
    };
    return statusMap[status] || null;
  }
}

// Re-export CalendarExportService as alias for backward compatibility
export { ActivityCalendarService as CalendarExportService };

