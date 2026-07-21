import { AppDataSource } from '../../data-source';
import { Activity, ActivityType } from '../../models/Activity';
import { logger } from '../../utils/logger';
import { AuditCategory, auditService } from '../audit/AuditService';

import { ActivityService, CreateActivityDTO } from './ActivityService';

/**
 * Recurrence rule configuration
 * Issue #169: Recurring activities - Weekly/monthly scheduling
 */
export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  interval?: number; // Every N frequency units (default: 1)
  daysOfWeek?: number[]; // 0-6, Sunday-Saturday (for weekly)
  dayOfMonth?: number; // 1-31 (for monthly)
  monthOfYear?: number; // 1-12 (for yearly)
  endDate?: Date; // When recurrence ends
  maxOccurrences?: number; // Maximum number of occurrences
  exceptions?: Date[]; // Dates to skip
}

export interface RecurringActivityTemplate {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  activityType: ActivityType;
  duration: number; // Duration in minutes
  location?: string;
  recurrenceRule: RecurrenceRule;
  createdBy: string;
  createdByName: string;
  isActive: boolean;
  lastGenerated?: Date;
  nextOccurrence?: Date;
  parentActivityId?: string;
}

/**
 * Recurring Activity Service
 * Manages recurring activity patterns and generates instances
 */
export class RecurringActivityService {
  private static instance: RecurringActivityService;
  private activityRepository = AppDataSource.getRepository(Activity);
  private activityService: ActivityService;

  private constructor() {
    this.activityService = new ActivityService();
  }

  public static getInstance(): RecurringActivityService {
    if (!RecurringActivityService.instance) {
      RecurringActivityService.instance = new RecurringActivityService();
    }
    return RecurringActivityService.instance;
  }

  /**
   * Calculate next occurrence based on recurrence rule
   */
  public calculateNextOccurrence(rule: RecurrenceRule, fromDate: Date = new Date()): Date | null {
    const interval = rule.interval || 1;
    const nextDate = new Date(fromDate);

    // Check if we've exceeded end conditions
    if (rule.endDate && nextDate > rule.endDate) {
      return null;
    }

    switch (rule.frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + interval);
        break;

      case 'weekly':
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
          // Find next matching day of week
          const currentDay = nextDate.getDay();
          const sortedDays = [...rule.daysOfWeek].sort((a, b) => a - b);

          // Find next day in current week
          const nextDayInWeek = sortedDays.find(d => d > currentDay);

          if (nextDayInWeek !== undefined) {
            nextDate.setDate(nextDate.getDate() + (nextDayInWeek - currentDay));
          } else {
            // Move to first day of next week(s)
            const daysUntilNextWeek = 7 - currentDay + sortedDays[0];
            nextDate.setDate(nextDate.getDate() + daysUntilNextWeek + (interval - 1) * 7);
          }
        } else {
          nextDate.setDate(nextDate.getDate() + 7 * interval);
        }
        break;

      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14 * interval);
        break;

      case 'monthly':
        if (rule.dayOfMonth) {
          nextDate.setMonth(nextDate.getMonth() + interval);
          nextDate.setDate(Math.min(rule.dayOfMonth, this.getDaysInMonth(nextDate)));
        } else {
          nextDate.setMonth(nextDate.getMonth() + interval);
        }
        break;

      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + interval);
        if (rule.monthOfYear) {
          nextDate.setMonth(rule.monthOfYear - 1);
        }
        if (rule.dayOfMonth) {
          nextDate.setDate(Math.min(rule.dayOfMonth, this.getDaysInMonth(nextDate)));
        }
        break;
    }

    // Check exceptions
    if (rule.exceptions?.some(ex => this.isSameDay(ex, nextDate))) {
      return this.calculateNextOccurrence(rule, nextDate);
    }

    // Check end date
    if (rule.endDate && nextDate > rule.endDate) {
      return null;
    }

    return nextDate;
  }

  /**
   * Generate multiple occurrences for a recurrence rule
   */
  public generateOccurrences(rule: RecurrenceRule, startTime: Date, count: number = 10): Date[] {
    const occurrences: Date[] = [];
    let currentDate = new Date(startTime);
    let generated = 0;

    while (generated < count) {
      if (rule.maxOccurrences && generated >= rule.maxOccurrences) {
        break;
      }

      const nextDate = this.calculateNextOccurrence(rule, currentDate);
      if (!nextDate) {
        break;
      }

      occurrences.push(nextDate);
      currentDate = nextDate;
      generated++;
    }

    return occurrences;
  }

  /**
   * Create activity instances from a recurring template
   */
  public async createRecurringInstances(
    template: RecurringActivityTemplate,
    generateUntil: Date
  ): Promise<Activity[]> {
    const occurrences = this.generateOccurrencesUntil(
      template.recurrenceRule,
      template.lastGenerated || new Date(),
      generateUntil
    );

    const activities: Activity[] = [];

    for (const occurrence of occurrences) {
      try {
        const endTime = new Date(occurrence.getTime() + template.duration * 60 * 1000);

        const dto: CreateActivityDTO = {
          title: template.title,
          description: template.description || '',
          activityType: template.activityType,
          creatorId: template.createdBy,
          creatorName: template.createdByName,
          scheduledStartDate: occurrence,
          scheduledEndDate: endTime,
          location: template.location,
          metadata: {
            isRecurring: true,
            recurringTemplateId: template.id,
            parentActivityId: template.parentActivityId,
          },
        };

        const activity = await this.activityService.createActivity(template.organizationId, dto);

        activities.push(activity);
      } catch (error: unknown) {
        logger.error('Failed to create recurring activity instance', {
          templateId: template.id,
          occurrence,
          error,
        });
      }
    }

    logger.info('Generated recurring activity instances', {
      templateId: template.id,
      count: activities.length,
      until: generateUntil,
    });

    auditService.log({
      category: AuditCategory.ACTIVITY,
      action: 'RECURRING_ACTIVITY_INSTANCES_GENERATED',
      message: `Generated ${activities.length} recurring activity instances for template ${template.id}`,
      organizationId: template.organizationId,
      userId: template.createdBy,
      resource: `recurring-template/${template.id}`,
      metadata: {
        templateId: template.id,
        generatedCount: activities.length,
        generateUntil,
      },
    });

    return activities;
  }

  /**
   * Generate occurrences until a specific date
   */
  private generateOccurrencesUntil(rule: RecurrenceRule, fromDate: Date, untilDate: Date): Date[] {
    const occurrences: Date[] = [];
    let currentDate = new Date(fromDate);
    let count = 0;
    const maxIterations = Math.min(rule.maxOccurrences ?? 365, 365); // Respect rule cap, hard max 365

    while (count < maxIterations) {
      const nextDate = this.calculateNextOccurrence(rule, currentDate);
      if (!nextDate || nextDate > untilDate) {
        break;
      }

      occurrences.push(nextDate);
      currentDate = nextDate;
      count++;
    }

    return occurrences;
  }

  /**
   * Parse a human-readable recurrence string
   */
  public parseRecurrenceString(input: string): RecurrenceRule | null {
    const lower = input.toLowerCase().trim();

    // Daily patterns
    if (lower === 'daily' || lower === 'every day') {
      return { frequency: 'daily' };
    }

    // Weekly patterns
    if (lower === 'weekly' || lower === 'every week') {
      return { frequency: 'weekly' };
    }

    // Biweekly patterns
    if (lower === 'biweekly' || lower === 'every two weeks' || lower === 'every 2 weeks') {
      return { frequency: 'biweekly' };
    }

    // Monthly patterns
    if (lower === 'monthly' || lower === 'every month') {
      return { frequency: 'monthly' };
    }

    // Specific day patterns (e.g., "every monday", "every monday and friday")
    const dayPattern = /every\s+(\w+(?:\s+and\s+\w+)*)/i;
    const dayMatch = lower.match(dayPattern);
    if (dayMatch) {
      const daysOfWeek = this.parseDaysOfWeek(dayMatch[1]);
      if (daysOfWeek.length > 0) {
        return { frequency: 'weekly', daysOfWeek };
      }
    }

    // Interval patterns (e.g., "every 3 days", "every 2 weeks")
    const intervalPattern = /every\s+(\d+)\s+(day|week|month|year)s?/i;
    const intervalMatch = lower.match(intervalPattern);
    if (intervalMatch) {
      const interval = parseInt(intervalMatch[1], 10);
      const unit = intervalMatch[2].toLowerCase();
      const frequencyMap: Record<string, RecurrenceRule['frequency']> = {
        day: 'daily',
        week: 'weekly',
        month: 'monthly',
        year: 'yearly',
      };
      return { frequency: frequencyMap[unit], interval };
    }

    return null;
  }

  /**
   * Parse day names to day numbers
   */
  private parseDaysOfWeek(input: string): number[] {
    const dayMap: Record<string, number> = {
      sunday: 0,
      sun: 0,
      monday: 1,
      mon: 1,
      tuesday: 2,
      tue: 2,
      wednesday: 3,
      wed: 3,
      thursday: 4,
      thu: 4,
      friday: 5,
      fri: 5,
      saturday: 6,
      sat: 6,
    };

    const days: number[] = [];
    const words = input.toLowerCase().split(/\s+and\s+|\s*,\s*/);

    for (const word of words) {
      const trimmed = word.trim();
      if (dayMap[trimmed] !== undefined) {
        days.push(dayMap[trimmed]);
      }
    }

    return [...new Set(days)].sort((a, b) => a - b);
  }

  /**
   * Get the number of days in a month
   */
  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  /**
   * Check if two dates are the same day
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  /**
   * Format recurrence rule as human-readable string
   */
  public formatRecurrenceRule(rule: RecurrenceRule): string {
    const interval = rule.interval || 1;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    switch (rule.frequency) {
      case 'daily':
        return interval === 1 ? 'Daily' : `Every ${interval} days`;

      case 'weekly':
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
          const days = rule.daysOfWeek.map(d => dayNames[d]).join(', ');
          return interval === 1 ? `Weekly on ${days}` : `Every ${interval} weeks on ${days}`;
        }
        return interval === 1 ? 'Weekly' : `Every ${interval} weeks`;

      case 'biweekly':
        return 'Every 2 weeks';

      case 'monthly':
        if (rule.dayOfMonth) {
          const suffix = this.getOrdinalSuffix(rule.dayOfMonth);
          return interval === 1
            ? `Monthly on the ${rule.dayOfMonth}${suffix}`
            : `Every ${interval} months on the ${rule.dayOfMonth}${suffix}`;
        }
        return interval === 1 ? 'Monthly' : `Every ${interval} months`;

      case 'yearly':
        return interval === 1 ? 'Yearly' : `Every ${interval} years`;

      default:
        return 'Custom recurrence';
    }
  }

  /**
   * Get ordinal suffix for a number
   */
  private getOrdinalSuffix(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }
}
