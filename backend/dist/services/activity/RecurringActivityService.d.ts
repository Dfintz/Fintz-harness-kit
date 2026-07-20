import { Activity, ActivityType } from '../../models/Activity';
export interface RecurrenceRule {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    monthOfYear?: number;
    endDate?: Date;
    maxOccurrences?: number;
    exceptions?: Date[];
}
export interface RecurringActivityTemplate {
    id: string;
    organizationId: string;
    title: string;
    description?: string;
    activityType: ActivityType;
    duration: number;
    location?: string;
    recurrenceRule: RecurrenceRule;
    createdBy: string;
    createdByName: string;
    isActive: boolean;
    lastGenerated?: Date;
    nextOccurrence?: Date;
    parentActivityId?: string;
}
export declare class RecurringActivityService {
    private static instance;
    private activityRepository;
    private activityService;
    private constructor();
    static getInstance(): RecurringActivityService;
    calculateNextOccurrence(rule: RecurrenceRule, fromDate?: Date): Date | null;
    generateOccurrences(rule: RecurrenceRule, startTime: Date, count?: number): Date[];
    createRecurringInstances(template: RecurringActivityTemplate, generateUntil: Date): Promise<Activity[]>;
    private generateOccurrencesUntil;
    parseRecurrenceString(input: string): RecurrenceRule | null;
    private parseDaysOfWeek;
    private getDaysInMonth;
    private isSameDay;
    formatRecurrenceRule(rule: RecurrenceRule): string;
    private getOrdinalSuffix;
}
//# sourceMappingURL=RecurringActivityService.d.ts.map