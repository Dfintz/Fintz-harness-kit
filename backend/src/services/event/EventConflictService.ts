import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Activity, ActivityStatus, ActivityType } from '../../models/Activity';
import { ActivityParticipantEntity } from '../../models/ActivityParticipant';
import { logger } from '../../utils/logger';
import { TenantService } from '../base/TenantService';

/**
 * Represents a time conflict between activities
 */
export interface ActivityConflict {
  activityId: string;
  activityTitle: string;
  activityType: ActivityType;
  scheduledStartDate: Date;
  scheduledEndDate: Date;
  conflictType: 'full' | 'partial' | 'adjacent';
  conflictReason: string;
}

/**
 * Options for conflict detection
 */
export interface ConflictDetectionOptions {
  includeTypes?: ActivityType[];
  excludeTypes?: ActivityType[];
  includeStatuses?: ActivityStatus[];
  excludeStatuses?: ActivityStatus[];
  organizationId?: string;
  userId?: string;
  bufferMinutes?: number; // Buffer time to consider between events
  adjacentThresholdMinutes?: number; // Threshold for adjacent conflicts (default: 5 minutes)
  skipSuggestions?: boolean; // Skip generating alternative time suggestions (prevents infinite recursion)
}

/**
 * Result of conflict check
 */
export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: ActivityConflict[];
  totalConflicts: number;
  suggestedAlternatives?: Date[];
}

/**
 * Service for detecting and managing time conflicts between activities
 *
 * Multi-tenancy: Extends TenantService for automatic tenant isolation
 */
export class EventConflictService extends TenantService<Activity> {
  private activityRepository: Repository<Activity>;

  constructor() {
    const repository = AppDataSource.getRepository(Activity);
    super(repository);
    this.activityRepository = repository;
  }

  /**
   * Check if a user is involved in an activity (creator or participant)
   */
  private async isUserInvolved(activity: Activity, userId: string): Promise<boolean> {
    if (activity.creatorId === userId) {
      return true;
    }
    const participantRepo = AppDataSource.getRepository(ActivityParticipantEntity);
    const count = await participantRepo.count({ where: { activityId: activity.id, userId } });
    return count > 0;
  }

  /**
   * Check for conflicts with a new or updated activity
   */
  async checkConflicts(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    excludeActivityId?: string,
    options?: ConflictDetectionOptions
  ): Promise<ConflictCheckResult> {
    try {
      const bufferMinutes = options?.bufferMinutes || 0;
      const bufferMs = bufferMinutes * 60 * 1000;

      // Adjust dates with buffer
      const adjustedStart = new Date(startDate.getTime() - bufferMs);
      const adjustedEnd = new Date(endDate.getTime() + bufferMs);

      // Build query
      const queryBuilder = this.activityRepository
        .createQueryBuilder('activity')
        .where('activity.organizationId = :organizationId', { organizationId })
        .andWhere('activity.scheduledStartDate IS NOT NULL')
        .andWhere('activity.scheduledEndDate IS NOT NULL');

      // Exclude the activity being checked (for updates)
      if (excludeActivityId) {
        queryBuilder.andWhere('activity.id != :excludeActivityId', { excludeActivityId });
      }

      // Filter by statuses (exclude cancelled/completed by default)
      const excludeStatuses = options?.excludeStatuses || [
        ActivityStatus.CANCELLED,
        ActivityStatus.COMPLETED,
        ActivityStatus.FAILED,
        ActivityStatus.EXPIRED,
      ];
      if (excludeStatuses.length > 0) {
        queryBuilder.andWhere('activity.status NOT IN (:...excludeStatuses)', { excludeStatuses });
      }

      // Include specific statuses if provided
      if (options?.includeStatuses && options.includeStatuses.length > 0) {
        queryBuilder.andWhere('activity.status IN (:...includeStatuses)', {
          includeStatuses: options.includeStatuses,
        });
      }

      // Filter by activity types
      if (options?.includeTypes && options.includeTypes.length > 0) {
        queryBuilder.andWhere('activity.activityType IN (:...includeTypes)', {
          includeTypes: options.includeTypes,
        });
      }

      if (options?.excludeTypes && options.excludeTypes.length > 0) {
        queryBuilder.andWhere('activity.activityType NOT IN (:...excludeTypes)', {
          excludeTypes: options.excludeTypes,
        });
      }

      // Check for time overlap
      queryBuilder.andWhere(
        '(activity.scheduledStartDate <= :adjustedEnd AND activity.scheduledEndDate >= :adjustedStart)',
        { adjustedStart, adjustedEnd }
      );

      let conflictingActivities = await queryBuilder.getMany();

      // Filter by user participation if specified
      if (options?.userId) {
        const userId = options.userId;
        const filteredResults = await Promise.all(
          conflictingActivities.map(async activity => ({
            activity,
            involved: await this.isUserInvolved(activity, userId),
          }))
        );
        conflictingActivities = filteredResults.filter(r => r.involved).map(r => r.activity);
      }

      // Convert to conflict objects
      const conflicts: ActivityConflict[] = conflictingActivities.map(activity => {
        const conflictType = this.determineConflictType(
          startDate,
          endDate,
          activity.scheduledStartDate!,
          activity.scheduledEndDate!,
          options?.adjacentThresholdMinutes
        );

        return {
          activityId: activity.id,
          activityTitle: activity.title,
          activityType: activity.activityType,
          scheduledStartDate: activity.scheduledStartDate!,
          scheduledEndDate: activity.scheduledEndDate!,
          conflictType,
          conflictReason: this.generateConflictReason(conflictType, activity),
        };
      });

      // Generate suggested alternatives if there are conflicts and suggestions are not skipped
      const suggestedAlternatives =
        conflicts.length > 0 && !options?.skipSuggestions
          ? await this.suggestAlternativeTimes(organizationId, startDate, endDate, options)
          : undefined;

      return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        totalConflicts: conflicts.length,
        suggestedAlternatives,
      };
    } catch (error: unknown) {
      logger.error('Error checking conflicts:', error);
      throw error;
    }
  }

  /**
   * Get all conflicts for a specific activity
   */
  async getActivityConflicts(
    organizationId: string,
    activityId: string,
    options?: ConflictDetectionOptions
  ): Promise<ConflictCheckResult> {
    const activity = await this.findOne(organizationId, { id: activityId });

    if (!activity?.scheduledStartDate || !activity.scheduledEndDate) {
      return {
        hasConflicts: false,
        conflicts: [],
        totalConflicts: 0,
      };
    }

    return this.checkConflicts(
      organizationId,
      activity.scheduledStartDate,
      activity.scheduledEndDate,
      activityId,
      options
    );
  }

  /**
   * Get conflicts for a user across all their activities
   */
  async getUserConflicts(
    organizationId: string,
    userId: string,
    options?: ConflictDetectionOptions
  ): Promise<ConflictCheckResult> {
    const userOptions: ConflictDetectionOptions = {
      ...options,
      userId,
    };

    // Get all upcoming activities in the organization
    const allActivities = await this.activityRepository
      .createQueryBuilder('activity')
      .where('activity.organizationId = :organizationId', { organizationId })
      .andWhere('activity.scheduledStartDate IS NOT NULL')
      .andWhere('activity.scheduledStartDate >= :now', { now: new Date() })
      .orderBy('activity.scheduledStartDate', 'ASC')
      .getMany();

    // Filter to only activities where user is creator or participant
    const involvementChecks = await Promise.all(
      allActivities.map(async activity => ({
        activity,
        involved: await this.isUserInvolved(activity, userId),
      }))
    );
    const userActivities = involvementChecks.filter(r => r.involved).map(r => r.activity);

    const allConflicts: ActivityConflict[] = [];

    // Check each activity for conflicts in parallel for better performance
    const conflictResults = await Promise.all(
      userActivities
        .filter(activity => activity.scheduledStartDate && activity.scheduledEndDate)
        .map(activity =>
          this.checkConflicts(
            organizationId,
            activity.scheduledStartDate!,
            activity.scheduledEndDate!,
            activity.id,
            userOptions
          )
        )
    );

    // Flatten all conflicts into a single array
    conflictResults.forEach(result => {
      allConflicts.push(...result.conflicts);
    });

    return {
      hasConflicts: allConflicts.length > 0,
      conflicts: allConflicts,
      totalConflicts: allConflicts.length,
    };
  }

  /**
   * Get conflicts within a date range
   */
  async getConflictsInRange(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    _options?: ConflictDetectionOptions
  ): Promise<ActivityConflict[]> {
    const activities = await this.activityRepository
      .createQueryBuilder('activity')
      .where('activity.organizationId = :organizationId', { organizationId })
      .andWhere('activity.scheduledStartDate IS NOT NULL')
      .andWhere('activity.scheduledEndDate IS NOT NULL')
      .andWhere('activity.scheduledStartDate <= :endDate', { endDate })
      .andWhere('activity.scheduledEndDate >= :startDate', { startDate })
      .orderBy('activity.scheduledStartDate', 'ASC')
      .getMany();

    const conflicts: ActivityConflict[] = [];

    // Check each pair of activities for conflicts
    for (let i = 0; i < activities.length; i++) {
      for (let j = i + 1; j < activities.length; j++) {
        const activity1 = activities[i];
        const activity2 = activities[j];

        if (
          activity1.scheduledStartDate &&
          activity1.scheduledEndDate &&
          activity2.scheduledStartDate &&
          activity2.scheduledEndDate
        ) {
          const hasOverlap = this.hasTimeOverlap(
            activity1.scheduledStartDate,
            activity1.scheduledEndDate,
            activity2.scheduledStartDate,
            activity2.scheduledEndDate
          );

          if (hasOverlap) {
            const conflictType = this.determineConflictType(
              activity1.scheduledStartDate,
              activity1.scheduledEndDate,
              activity2.scheduledStartDate,
              activity2.scheduledEndDate
            );

            conflicts.push({
              activityId: activity2.id,
              activityTitle: activity2.title,
              activityType: activity2.activityType,
              scheduledStartDate: activity2.scheduledStartDate,
              scheduledEndDate: activity2.scheduledEndDate,
              conflictType,
              conflictReason: `Conflicts with "${activity1.title}"`,
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Determine the type of conflict between two time periods
   */
  private determineConflictType(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date,
    adjacentThresholdMinutes: number = 5
  ): 'full' | 'partial' | 'adjacent' {
    // Full overlap: one completely contains the other
    if ((start1 <= start2 && end1 >= end2) || (start2 <= start1 && end2 >= end1)) {
      return 'full';
    }

    // Adjacent: events are touching or very close (check both directions)
    const thresholdMs = adjacentThresholdMinutes * 60 * 1000;
    const gap1 = Math.abs(end1.getTime() - start2.getTime());
    const gap2 = Math.abs(end2.getTime() - start1.getTime());

    if (gap1 < thresholdMs || gap2 < thresholdMs) {
      return 'adjacent';
    }

    // Partial: events overlap but neither fully contains the other
    return 'partial';
  }

  /**
   * Check if two time periods overlap
   */
  private hasTimeOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && end1 > start2;
  }

  /**
   * Generate a human-readable conflict reason
   */
  private generateConflictReason(conflictType: string, activity: Activity): string {
    const typeLabel = this.getActivityTypeLabel(activity.activityType);
    const startTime = activity.scheduledStartDate?.toLocaleString();

    switch (conflictType) {
      case 'full':
        return `Completely overlaps with ${typeLabel} "${activity.title}" (${startTime})`;
      case 'partial':
        return `Partially overlaps with ${typeLabel} "${activity.title}" (${startTime})`;
      case 'adjacent':
        return `Very close to ${typeLabel} "${activity.title}" (${startTime})`;
      default:
        return `Conflicts with ${typeLabel} "${activity.title}"`;
    }
  }

  /**
   * Get human-readable label for activity type
   */
  private getActivityTypeLabel(type: ActivityType): string {
    const labels: Record<ActivityType, string> = {
      [ActivityType.MISSION]: 'Mission',
      [ActivityType.CONTRACT]: 'Contract',
      [ActivityType.BOUNTY]: 'Bounty',
      [ActivityType.EVENT]: 'Event',
      [ActivityType.LFG]: 'LFG Session',
      [ActivityType.OPERATION]: 'Operation',
      [ActivityType.RECRUITMENT]: 'Recruitment',
      [ActivityType.JOB_LISTING]: 'Job Listing',
    };
    return labels[type] || type;
  }

  /**
   * Suggest alternative times that don't conflict
   */
  private async suggestAlternativeTimes(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    options?: ConflictDetectionOptions
  ): Promise<Date[]> {
    const duration = endDate.getTime() - startDate.getTime();
    const suggestions: Date[] = [];

    // Prevent infinite recursion by skipping suggestions in recursive calls
    const checkOptions: ConflictDetectionOptions = {
      ...options,
      skipSuggestions: true,
    };

    // Try next 7 days
    for (let i = 1; i <= 7 && suggestions.length < 3; i++) {
      const newStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const newEnd = new Date(newStart.getTime() + duration);

      const result = await this.checkConflicts(
        organizationId,
        newStart,
        newEnd,
        undefined,
        checkOptions
      );

      if (!result.hasConflicts) {
        suggestions.push(newStart);
      }
    }

    return suggestions;
  }
}

