/**
 * Recurring Activities Controller V2
 * Handles recurring event/activity management with standardized responses
 */

import { Request, Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import {
  RecurringActivityService,
  RecurrenceRule,
  RecurringActivityTemplate,
} from '../../services/activity/RecurringActivityService';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';

export class RecurringActivityControllerV2 {
  private recurringActivityService: RecurringActivityService;

  constructor() {
    this.recurringActivityService = RecurringActivityService.getInstance();
  }

  /**
   * POST /api/v2/recurring-activities/next-occurrence
   * Calculate next occurrence for a recurrence rule
   */
  async calculateNextOccurrence(req: Request, res: Response): Promise<void> {
    try {
      const { rule, fromDate } = req.body as {
        rule: RecurrenceRule;
        fromDate?: string;
      };

      if (!rule?.frequency) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Recurrence rule with frequency is required',
          400,
          { rule }
        );
      }

      const from = fromDate ? new Date(fromDate) : new Date();
      const nextOccurrence = this.recurringActivityService.calculateNextOccurrence(rule, from);

      res.success({
        nextOccurrence,
        fromDate: from,
        rule,
      });
    } catch (error) {
      if (error instanceof ApiError) {throw error;}
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500);
    }
  }

  /**
   * POST /api/v2/recurring-activities/occurrences
   * Generate multiple occurrences for a recurrence rule
   */
  async generateOccurrences(req: Request, res: Response): Promise<void> {
    try {
      const { rule, startTime, count } = req.body as {
        rule: RecurrenceRule;
        startTime?: string;
        count?: number;
      };

      if (!rule?.frequency) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Recurrence rule with frequency is required',
          400,
          { rule }
        );
      }

      const start = startTime ? new Date(startTime) : new Date();
      const occurrenceCount = Math.min(count || 10, 100); // Max 100 occurrences

      const occurrences = this.recurringActivityService.generateOccurrences(
        rule,
        start,
        occurrenceCount
      );

      res.success({
        occurrences,
        count: occurrences.length,
        startTime: start,
        rule,
      });
    } catch (error) {
      if (error instanceof ApiError) {throw error;}
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500);
    }
  }

  /**
   * POST /api/v2/recurring-activities/parse
   * Parse a human-readable recurrence string
   */
  async parseRecurrenceString(req: Request, res: Response): Promise<void> {
    try {
      const { input } = req.body as { input: string };

      if (!input) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Recurrence string input is required',
          400
        );
      }

      const rule = this.recurringActivityService.parseRecurrenceString(input);

      if (!rule) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Could not parse recurrence string',
          400,
          {
            input,
            examples: [
              'daily',
              'weekly',
              'every monday',
              'every monday and friday',
              'every 2 weeks',
              'monthly',
              'every 3 months',
            ],
          }
        );
      }

      // Format the rule back to human-readable
      const formatted = this.recurringActivityService.formatRecurrenceRule(rule);

      res.success({
        rule,
        formatted,
        input,
      });
    } catch (error) {
      if (error instanceof ApiError) {throw error;}
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500);
    }
  }

  /**
   * POST /api/v2/recurring-activities/format
   * Format a recurrence rule as human-readable string
   */
  async formatRecurrenceRule(req: Request, res: Response): Promise<void> {
    try {
      const { rule } = req.body as { rule: RecurrenceRule };

      if (!rule?.frequency) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Recurrence rule with frequency is required',
          400,
          { rule }
        );
      }

      const formatted = this.recurringActivityService.formatRecurrenceRule(rule);

      res.success({
        formatted,
        rule,
      });
    } catch (error) {
      if (error instanceof ApiError) {throw error;}
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500);
    }
  }

  /**
   * POST /api/v2/recurring-activities/create-instances
   * Create recurring activity instances from a template
   */
  async createRecurringInstances(req: Request, res: Response): Promise<void> {
    try {
      const { template, generateUntil } = req.body as {
        template: RecurringActivityTemplate;
        generateUntil: string;
      };

      if (!template?.recurrenceRule) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Template with recurrence rule is required',
          400,
          { template }
        );
      }

      if (!generateUntil) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'generateUntil date is required',
          400
        );
      }

      const until = new Date(generateUntil);
      const activities = await this.recurringActivityService.createRecurringInstances(
        template,
        until
      );

      res.success({
        message: 'Recurring activity instances created',
        count: activities.length,
        activities: activities.map((a) => ({
          id: a.id,
          title: a.title,
          scheduledStartDate: a.scheduledStartDate,
          scheduledEndDate: a.scheduledEndDate,
        })),
        template: {
          id: template.id,
          title: template.title,
        },
        generateUntil: until,
      });
    } catch (error) {
      if (error instanceof ApiError) {throw error;}
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500);
    }
  }

  /**
   * POST /api/v2/recurring-activities/preview
   * Preview occurrences for a potential recurring activity
   */
  async previewRecurringActivity(req: Request, res: Response): Promise<void> {
    try {
      const { rule, startTime, duration, count, title } = req.body as {
        rule: RecurrenceRule;
        startTime: string;
        duration?: number; // Duration in minutes
        count?: number;
        title?: string;
      };

      if (!rule?.frequency) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Recurrence rule with frequency is required',
          400,
          { rule }
        );
      }

      if (!startTime) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Start time is required',
          400
        );
      }

      const start = new Date(startTime);
      const activityDuration = duration || 60; // Default 1 hour
      const occurrenceCount = Math.min(count || 5, 20); // Max 20 for preview

      const occurrences = this.recurringActivityService.generateOccurrences(
        rule,
        start,
        occurrenceCount
      );
      const formatted = this.recurringActivityService.formatRecurrenceRule(rule);

      // Generate preview with start and end times
      const preview = occurrences.map((occurrence, index) => ({
        index: index + 1,
        title: title || 'Recurring Activity',
        startTime: occurrence,
        endTime: new Date(occurrence.getTime() + activityDuration * 60 * 1000),
      }));

      res.success({
        recurrenceDescription: formatted,
        occurrences: preview,
        count: preview.length,
        rule,
        duration: activityDuration,
      });
    } catch (error) {
      if (error instanceof ApiError) {throw error;}
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500);
    }
  }

  /**
   * GET /api/v2/recurring-activities/frequencies
   * Get available recurrence frequencies
   */
  async getFrequencies(req: Request, res: Response): Promise<void> {
    res.success({
      frequencies: [
        { value: 'daily', label: 'Daily', description: 'Every day' },
        { value: 'weekly', label: 'Weekly', description: 'Once a week' },
        { value: 'biweekly', label: 'Bi-weekly', description: 'Every two weeks' },
        { value: 'monthly', label: 'Monthly', description: 'Once a month' },
        { value: 'yearly', label: 'Yearly', description: 'Once a year' },
      ],
      daysOfWeek: [
        { value: 0, label: 'Sunday', short: 'Sun' },
        { value: 1, label: 'Monday', short: 'Mon' },
        { value: 2, label: 'Tuesday', short: 'Tue' },
        { value: 3, label: 'Wednesday', short: 'Wed' },
        { value: 4, label: 'Thursday', short: 'Thu' },
        { value: 5, label: 'Friday', short: 'Fri' },
        { value: 6, label: 'Saturday', short: 'Sat' },
      ],
    });
  }
}
