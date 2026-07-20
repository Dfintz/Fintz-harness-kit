"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventConflictService = void 0;
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const logger_1 = require("../../utils/logger");
const TenantService_1 = require("../base/TenantService");
class EventConflictService extends TenantService_1.TenantService {
    activityRepository;
    constructor() {
        const repository = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
        super(repository);
        this.activityRepository = repository;
    }
    async isUserInvolved(activity, userId) {
        if (activity.creatorId === userId) {
            return true;
        }
        const participantRepo = data_source_1.AppDataSource.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
        const count = await participantRepo.count({ where: { activityId: activity.id, userId } });
        return count > 0;
    }
    async checkConflicts(organizationId, startDate, endDate, excludeActivityId, options) {
        try {
            const bufferMinutes = options?.bufferMinutes || 0;
            const bufferMs = bufferMinutes * 60 * 1000;
            const adjustedStart = new Date(startDate.getTime() - bufferMs);
            const adjustedEnd = new Date(endDate.getTime() + bufferMs);
            const queryBuilder = this.activityRepository
                .createQueryBuilder('activity')
                .where('activity.organizationId = :organizationId', { organizationId })
                .andWhere('activity.scheduledStartDate IS NOT NULL')
                .andWhere('activity.scheduledEndDate IS NOT NULL');
            if (excludeActivityId) {
                queryBuilder.andWhere('activity.id != :excludeActivityId', { excludeActivityId });
            }
            const excludeStatuses = options?.excludeStatuses || [
                Activity_1.ActivityStatus.CANCELLED,
                Activity_1.ActivityStatus.COMPLETED,
                Activity_1.ActivityStatus.FAILED,
                Activity_1.ActivityStatus.EXPIRED,
            ];
            if (excludeStatuses.length > 0) {
                queryBuilder.andWhere('activity.status NOT IN (:...excludeStatuses)', { excludeStatuses });
            }
            if (options?.includeStatuses && options.includeStatuses.length > 0) {
                queryBuilder.andWhere('activity.status IN (:...includeStatuses)', {
                    includeStatuses: options.includeStatuses,
                });
            }
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
            queryBuilder.andWhere('(activity.scheduledStartDate <= :adjustedEnd AND activity.scheduledEndDate >= :adjustedStart)', { adjustedStart, adjustedEnd });
            let conflictingActivities = await queryBuilder.getMany();
            if (options?.userId) {
                const userId = options.userId;
                const filteredResults = await Promise.all(conflictingActivities.map(async (activity) => ({
                    activity,
                    involved: await this.isUserInvolved(activity, userId),
                })));
                conflictingActivities = filteredResults.filter(r => r.involved).map(r => r.activity);
            }
            const conflicts = conflictingActivities.map(activity => {
                const conflictType = this.determineConflictType(startDate, endDate, activity.scheduledStartDate, activity.scheduledEndDate, options?.adjacentThresholdMinutes);
                return {
                    activityId: activity.id,
                    activityTitle: activity.title,
                    activityType: activity.activityType,
                    scheduledStartDate: activity.scheduledStartDate,
                    scheduledEndDate: activity.scheduledEndDate,
                    conflictType,
                    conflictReason: this.generateConflictReason(conflictType, activity),
                };
            });
            const suggestedAlternatives = conflicts.length > 0 && !options?.skipSuggestions
                ? await this.suggestAlternativeTimes(organizationId, startDate, endDate, options)
                : undefined;
            return {
                hasConflicts: conflicts.length > 0,
                conflicts,
                totalConflicts: conflicts.length,
                suggestedAlternatives,
            };
        }
        catch (error) {
            logger_1.logger.error('Error checking conflicts:', error);
            throw error;
        }
    }
    async getActivityConflicts(organizationId, activityId, options) {
        const activity = await this.findOne(organizationId, { id: activityId });
        if (!activity?.scheduledStartDate || !activity.scheduledEndDate) {
            return {
                hasConflicts: false,
                conflicts: [],
                totalConflicts: 0,
            };
        }
        return this.checkConflicts(organizationId, activity.scheduledStartDate, activity.scheduledEndDate, activityId, options);
    }
    async getUserConflicts(organizationId, userId, options) {
        const userOptions = {
            ...options,
            userId,
        };
        const allActivities = await this.activityRepository
            .createQueryBuilder('activity')
            .where('activity.organizationId = :organizationId', { organizationId })
            .andWhere('activity.scheduledStartDate IS NOT NULL')
            .andWhere('activity.scheduledStartDate >= :now', { now: new Date() })
            .orderBy('activity.scheduledStartDate', 'ASC')
            .getMany();
        const involvementChecks = await Promise.all(allActivities.map(async (activity) => ({
            activity,
            involved: await this.isUserInvolved(activity, userId),
        })));
        const userActivities = involvementChecks.filter(r => r.involved).map(r => r.activity);
        const allConflicts = [];
        const conflictResults = await Promise.all(userActivities
            .filter(activity => activity.scheduledStartDate && activity.scheduledEndDate)
            .map(activity => this.checkConflicts(organizationId, activity.scheduledStartDate, activity.scheduledEndDate, activity.id, userOptions)));
        conflictResults.forEach(result => {
            allConflicts.push(...result.conflicts);
        });
        return {
            hasConflicts: allConflicts.length > 0,
            conflicts: allConflicts,
            totalConflicts: allConflicts.length,
        };
    }
    async getConflictsInRange(organizationId, startDate, endDate, _options) {
        const activities = await this.activityRepository
            .createQueryBuilder('activity')
            .where('activity.organizationId = :organizationId', { organizationId })
            .andWhere('activity.scheduledStartDate IS NOT NULL')
            .andWhere('activity.scheduledEndDate IS NOT NULL')
            .andWhere('activity.scheduledStartDate <= :endDate', { endDate })
            .andWhere('activity.scheduledEndDate >= :startDate', { startDate })
            .orderBy('activity.scheduledStartDate', 'ASC')
            .getMany();
        const conflicts = [];
        for (let i = 0; i < activities.length; i++) {
            for (let j = i + 1; j < activities.length; j++) {
                const activity1 = activities[i];
                const activity2 = activities[j];
                if (activity1.scheduledStartDate &&
                    activity1.scheduledEndDate &&
                    activity2.scheduledStartDate &&
                    activity2.scheduledEndDate) {
                    const hasOverlap = this.hasTimeOverlap(activity1.scheduledStartDate, activity1.scheduledEndDate, activity2.scheduledStartDate, activity2.scheduledEndDate);
                    if (hasOverlap) {
                        const conflictType = this.determineConflictType(activity1.scheduledStartDate, activity1.scheduledEndDate, activity2.scheduledStartDate, activity2.scheduledEndDate);
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
    determineConflictType(start1, end1, start2, end2, adjacentThresholdMinutes = 5) {
        if ((start1 <= start2 && end1 >= end2) || (start2 <= start1 && end2 >= end1)) {
            return 'full';
        }
        const thresholdMs = adjacentThresholdMinutes * 60 * 1000;
        const gap1 = Math.abs(end1.getTime() - start2.getTime());
        const gap2 = Math.abs(end2.getTime() - start1.getTime());
        if (gap1 < thresholdMs || gap2 < thresholdMs) {
            return 'adjacent';
        }
        return 'partial';
    }
    hasTimeOverlap(start1, end1, start2, end2) {
        return start1 < end2 && end1 > start2;
    }
    generateConflictReason(conflictType, activity) {
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
    getActivityTypeLabel(type) {
        const labels = {
            [Activity_1.ActivityType.MISSION]: 'Mission',
            [Activity_1.ActivityType.CONTRACT]: 'Contract',
            [Activity_1.ActivityType.BOUNTY]: 'Bounty',
            [Activity_1.ActivityType.EVENT]: 'Event',
            [Activity_1.ActivityType.LFG]: 'LFG Session',
            [Activity_1.ActivityType.OPERATION]: 'Operation',
            [Activity_1.ActivityType.RECRUITMENT]: 'Recruitment',
            [Activity_1.ActivityType.JOB_LISTING]: 'Job Listing',
        };
        return labels[type] || type;
    }
    async suggestAlternativeTimes(organizationId, startDate, endDate, options) {
        const duration = endDate.getTime() - startDate.getTime();
        const suggestions = [];
        const checkOptions = {
            ...options,
            skipSuggestions: true,
        };
        for (let i = 1; i <= 7 && suggestions.length < 3; i++) {
            const newStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
            const newEnd = new Date(newStart.getTime() + duration);
            const result = await this.checkConflicts(organizationId, newStart, newEnd, undefined, checkOptions);
            if (!result.hasConflicts) {
                suggestions.push(newStart);
            }
        }
        return suggestions;
    }
}
exports.EventConflictService = EventConflictService;
//# sourceMappingURL=EventConflictService.js.map