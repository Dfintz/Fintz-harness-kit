import { AppDataSource } from '../../data-source';
import { Activity } from '../../models/Activity';

/**
 * Calendar Export Service - ICS format export
 * Issue #169: Calendar sync - ICS export, Google Calendar integration
 */
export class CalendarExportService {
  private static instance: CalendarExportService;
  private activityRepository = AppDataSource.getRepository(Activity);

  private constructor() {}

  public static getInstance(): CalendarExportService {
    if (!CalendarExportService.instance) {
      CalendarExportService.instance = new CalendarExportService();
    }
    return CalendarExportService.instance;
  }

  /**
   * Generate ICS calendar file for activities
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
      .where('activity.organizationId = :organizationId', { organizationId });

    if (options?.startDate) {
      query.andWhere('activity.scheduledStartDate >= :startDate', { startDate: options.startDate });
    }

    if (options?.endDate) {
      query.andWhere('activity.scheduledEndDate <= :endDate', { endDate: options.endDate });
    }

    if (options?.activityTypes && options.activityTypes.length > 0) {
      query.andWhere('activity.activityType IN (:...types)', { types: options.activityTypes });
    }

    const activities = await query.getMany();

    return this.buildICSContent(activities, organizationId);
  }

  /**
   * Generate ICS for a single activity
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
   * Format date for ICS format (YYYYMMDDTHHMMSSZ)
   */
  private formatICSDate(date: Date): string {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  }

  /**
   * Escape special characters for ICS text fields
   */
  private escapeICSText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
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

  /**
   * Generate Google Calendar URL for an activity
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
   * Format date for Google Calendar URL
   */
  private formatGoogleDate(date: Date): string {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  }

  /**
   * Generate webcal:// subscription URL
   */
  public generateWebcalUrl(
    organizationId: string,
    token: string,
    baseUrl: string = 'https://api.fringecore.space'
  ): string {
    return `webcal://${baseUrl.replace(/^https?:\/\//, '')}/api/calendar/${organizationId}/ics?token=${token}`;
  }
}

