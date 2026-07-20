import { Activity, ActivityStatus, ActivityType } from '../../models/Activity';
import { TenantService } from '../base/TenantService';
export interface ActivityConflict {
    activityId: string;
    activityTitle: string;
    activityType: ActivityType;
    scheduledStartDate: Date;
    scheduledEndDate: Date;
    conflictType: 'full' | 'partial' | 'adjacent';
    conflictReason: string;
}
export interface ConflictDetectionOptions {
    includeTypes?: ActivityType[];
    excludeTypes?: ActivityType[];
    includeStatuses?: ActivityStatus[];
    excludeStatuses?: ActivityStatus[];
    organizationId?: string;
    userId?: string;
    bufferMinutes?: number;
    adjacentThresholdMinutes?: number;
    skipSuggestions?: boolean;
}
export interface ConflictCheckResult {
    hasConflicts: boolean;
    conflicts: ActivityConflict[];
    totalConflicts: number;
    suggestedAlternatives?: Date[];
}
export declare class EventConflictService extends TenantService<Activity> {
    private activityRepository;
    constructor();
    private isUserInvolved;
    checkConflicts(organizationId: string, startDate: Date, endDate: Date, excludeActivityId?: string, options?: ConflictDetectionOptions): Promise<ConflictCheckResult>;
    getActivityConflicts(organizationId: string, activityId: string, options?: ConflictDetectionOptions): Promise<ConflictCheckResult>;
    getUserConflicts(organizationId: string, userId: string, options?: ConflictDetectionOptions): Promise<ConflictCheckResult>;
    getConflictsInRange(organizationId: string, startDate: Date, endDate: Date, _options?: ConflictDetectionOptions): Promise<ActivityConflict[]>;
    private determineConflictType;
    private hasTimeOverlap;
    private generateConflictReason;
    private getActivityTypeLabel;
    private suggestAlternativeTimes;
}
//# sourceMappingURL=EventConflictService.d.ts.map