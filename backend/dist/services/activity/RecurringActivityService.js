"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecurringActivityService = void 0;
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
const ActivityService_1 = require("./ActivityService");
class RecurringActivityService {
    static instance;
    activityRepository = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
    activityService;
    constructor() {
        this.activityService = new ActivityService_1.ActivityService();
    }
    static getInstance() {
        if (!RecurringActivityService.instance) {
            RecurringActivityService.instance = new RecurringActivityService();
        }
        return RecurringActivityService.instance;
    }
    calculateNextOccurrence(rule, fromDate = new Date()) {
        const interval = rule.interval || 1;
        const nextDate = new Date(fromDate);
        if (rule.endDate && nextDate > rule.endDate) {
            return null;
        }
        switch (rule.frequency) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + interval);
                break;
            case 'weekly':
                if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
                    const currentDay = nextDate.getDay();
                    const sortedDays = [...rule.daysOfWeek].sort((a, b) => a - b);
                    const nextDayInWeek = sortedDays.find(d => d > currentDay);
                    if (nextDayInWeek !== undefined) {
                        nextDate.setDate(nextDate.getDate() + (nextDayInWeek - currentDay));
                    }
                    else {
                        const daysUntilNextWeek = 7 - currentDay + sortedDays[0];
                        nextDate.setDate(nextDate.getDate() + daysUntilNextWeek + (interval - 1) * 7);
                    }
                }
                else {
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
                }
                else {
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
        if (rule.exceptions?.some(ex => this.isSameDay(ex, nextDate))) {
            return this.calculateNextOccurrence(rule, nextDate);
        }
        if (rule.endDate && nextDate > rule.endDate) {
            return null;
        }
        return nextDate;
    }
    generateOccurrences(rule, startTime, count = 10) {
        const occurrences = [];
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
    async createRecurringInstances(template, generateUntil) {
        const occurrences = this.generateOccurrencesUntil(template.recurrenceRule, template.lastGenerated || new Date(), generateUntil);
        const activities = [];
        for (const occurrence of occurrences) {
            try {
                const endTime = new Date(occurrence.getTime() + template.duration * 60 * 1000);
                const dto = {
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
            }
            catch (error) {
                logger_1.logger.error('Failed to create recurring activity instance', {
                    templateId: template.id,
                    occurrence,
                    error,
                });
            }
        }
        logger_1.logger.info('Generated recurring activity instances', {
            templateId: template.id,
            count: activities.length,
            until: generateUntil,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
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
    generateOccurrencesUntil(rule, fromDate, untilDate) {
        const occurrences = [];
        let currentDate = new Date(fromDate);
        let count = 0;
        const maxIterations = Math.min(rule.maxOccurrences ?? 365, 365);
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
    parseRecurrenceString(input) {
        const lower = input.toLowerCase().trim();
        if (lower === 'daily' || lower === 'every day') {
            return { frequency: 'daily' };
        }
        if (lower === 'weekly' || lower === 'every week') {
            return { frequency: 'weekly' };
        }
        if (lower === 'biweekly' || lower === 'every two weeks' || lower === 'every 2 weeks') {
            return { frequency: 'biweekly' };
        }
        if (lower === 'monthly' || lower === 'every month') {
            return { frequency: 'monthly' };
        }
        const dayPattern = /every\s+(\w+(?:\s+and\s+\w+)*)/i;
        const dayMatch = lower.match(dayPattern);
        if (dayMatch) {
            const daysOfWeek = this.parseDaysOfWeek(dayMatch[1]);
            if (daysOfWeek.length > 0) {
                return { frequency: 'weekly', daysOfWeek };
            }
        }
        const intervalPattern = /every\s+(\d+)\s+(day|week|month|year)s?/i;
        const intervalMatch = lower.match(intervalPattern);
        if (intervalMatch) {
            const interval = parseInt(intervalMatch[1], 10);
            const unit = intervalMatch[2].toLowerCase();
            const frequencyMap = {
                day: 'daily',
                week: 'weekly',
                month: 'monthly',
                year: 'yearly',
            };
            return { frequency: frequencyMap[unit], interval };
        }
        return null;
    }
    parseDaysOfWeek(input) {
        const dayMap = {
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
        const days = [];
        const words = input.toLowerCase().split(/\s+and\s+|\s*,\s*/);
        for (const word of words) {
            const trimmed = word.trim();
            if (dayMap[trimmed] !== undefined) {
                days.push(dayMap[trimmed]);
            }
        }
        return [...new Set(days)].sort((a, b) => a - b);
    }
    getDaysInMonth(date) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    }
    isSameDay(date1, date2) {
        return (date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate());
    }
    formatRecurrenceRule(rule) {
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
    getOrdinalSuffix(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    }
}
exports.RecurringActivityService = RecurringActivityService;
//# sourceMappingURL=RecurringActivityService.js.map