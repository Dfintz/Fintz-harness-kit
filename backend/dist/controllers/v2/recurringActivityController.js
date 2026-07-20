"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecurringActivityControllerV2 = void 0;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const RecurringActivityService_1 = require("../../services/activity/RecurringActivityService");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
class RecurringActivityControllerV2 {
    recurringActivityService;
    constructor() {
        this.recurringActivityService = RecurringActivityService_1.RecurringActivityService.getInstance();
    }
    async calculateNextOccurrence(req, res) {
        try {
            const { rule, fromDate } = req.body;
            if (!rule?.frequency) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Recurrence rule with frequency is required', 400, { rule });
            }
            const from = fromDate ? new Date(fromDate) : new Date();
            const nextOccurrence = this.recurringActivityService.calculateNextOccurrence(rule, from);
            res.success({
                nextOccurrence,
                fromDate: from,
                rule,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500);
        }
    }
    async generateOccurrences(req, res) {
        try {
            const { rule, startTime, count } = req.body;
            if (!rule?.frequency) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Recurrence rule with frequency is required', 400, { rule });
            }
            const start = startTime ? new Date(startTime) : new Date();
            const occurrenceCount = Math.min(count || 10, 100);
            const occurrences = this.recurringActivityService.generateOccurrences(rule, start, occurrenceCount);
            res.success({
                occurrences,
                count: occurrences.length,
                startTime: start,
                rule,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500);
        }
    }
    async parseRecurrenceString(req, res) {
        try {
            const { input } = req.body;
            if (!input) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Recurrence string input is required', 400);
            }
            const rule = this.recurringActivityService.parseRecurrenceString(input);
            if (!rule) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Could not parse recurrence string', 400, {
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
                });
            }
            const formatted = this.recurringActivityService.formatRecurrenceRule(rule);
            res.success({
                rule,
                formatted,
                input,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500);
        }
    }
    async formatRecurrenceRule(req, res) {
        try {
            const { rule } = req.body;
            if (!rule?.frequency) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Recurrence rule with frequency is required', 400, { rule });
            }
            const formatted = this.recurringActivityService.formatRecurrenceRule(rule);
            res.success({
                formatted,
                rule,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500);
        }
    }
    async createRecurringInstances(req, res) {
        try {
            const { template, generateUntil } = req.body;
            if (!template?.recurrenceRule) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Template with recurrence rule is required', 400, { template });
            }
            if (!generateUntil) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'generateUntil date is required', 400);
            }
            const until = new Date(generateUntil);
            const activities = await this.recurringActivityService.createRecurringInstances(template, until);
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
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500);
        }
    }
    async previewRecurringActivity(req, res) {
        try {
            const { rule, startTime, duration, count, title } = req.body;
            if (!rule?.frequency) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Recurrence rule with frequency is required', 400, { rule });
            }
            if (!startTime) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Start time is required', 400);
            }
            const start = new Date(startTime);
            const activityDuration = duration || 60;
            const occurrenceCount = Math.min(count || 5, 20);
            const occurrences = this.recurringActivityService.generateOccurrences(rule, start, occurrenceCount);
            const formatted = this.recurringActivityService.formatRecurrenceRule(rule);
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
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            const message = (0, errorHandler_1.getErrorMessage)(error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, message, 500);
        }
    }
    async getFrequencies(req, res) {
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
exports.RecurringActivityControllerV2 = RecurringActivityControllerV2;
//# sourceMappingURL=recurringActivityController.js.map