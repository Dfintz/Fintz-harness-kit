"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarExportService = exports.ActivityCalendarService = void 0;
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
class ActivityCalendarService {
    static instance;
    activityRepository = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
    constructor() { }
    static getInstance() {
        if (!ActivityCalendarService.instance) {
            ActivityCalendarService.instance = new ActivityCalendarService();
        }
        return ActivityCalendarService.instance;
    }
    async generateICS(organizationId, options) {
        const query = this.activityRepository
            .createQueryBuilder('activity')
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
        if (!options?.activityTypes || options.activityTypes.length === 0) {
            query.andWhere('activity.activityType != :excludedType', {
                excludedType: Activity_1.ActivityType.RECRUITMENT,
            });
        }
        if (!options?.startDate) {
            const defaultStart = new Date();
            defaultStart.setMonth(defaultStart.getMonth() - 6);
            query.andWhere('activity.scheduledStartDate >= :defaultStart', { defaultStart });
        }
        else {
            query.andWhere('activity.scheduledStartDate >= :startDate', { startDate: options.startDate });
        }
        if (!options?.endDate) {
            const defaultEnd = new Date();
            defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);
            query.andWhere('activity.scheduledStartDate <= :defaultEnd', { defaultEnd });
        }
        else {
            query.andWhere('activity.scheduledEndDate <= :endDate', { endDate: options.endDate });
        }
        if (options?.activityTypes && options.activityTypes.length > 0) {
            query.andWhere('activity.activityType IN (:...types)', { types: options.activityTypes });
        }
        const activities = await query.take(5000).getMany();
        return this.buildICSContent(activities, organizationId);
    }
    async generateActivityICS(activityId) {
        const activity = await this.activityRepository.findOne({
            where: { id: activityId },
        });
        if (!activity) {
            throw new Error('Activity not found');
        }
        return this.buildICSContent([activity], activity.organizationId ?? '');
    }
    async generateUserICS(userId, options) {
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
    buildICSContent(activities, calendarId) {
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Star Citizen Fleet Manager//Activities//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            `X-WR-CALNAME:SC Fleet Manager - ${calendarId}`,
            'X-WR-TIMEZONE:UTC',
        ];
        lines.push('BEGIN:VTIMEZONE', 'TZID:UTC', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0000', 'TZOFFSETTO:+0000', 'END:STANDARD', 'END:VTIMEZONE');
        for (const activity of activities) {
            lines.push(...this.buildVEvent(activity));
        }
        lines.push('END:VCALENDAR');
        return lines.join('\r\n');
    }
    buildVEvent(activity) {
        const uid = `${activity.id}@fringecore.space`;
        const now = this.formatICSDate(new Date());
        const startDate = activity.scheduledStartDate || new Date();
        const endDate = activity.scheduledEndDate || new Date(startDate.getTime() + 60 * 60 * 1000);
        const dtstart = this.formatICSDate(startDate);
        const dtend = this.formatICSDate(endDate);
        const lines = [
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
        if (activity.activityType) {
            lines.push(`CATEGORIES:${activity.activityType}`);
        }
        lines.push(`URL:https://fringecore.space/activities/${activity.id}`);
        if (activity.creatorId) {
            lines.push(`ORGANIZER:mailto:${activity.creatorId}@fringecore.space`);
        }
        const status = this.mapActivityStatus(activity.status);
        if (status) {
            lines.push(`STATUS:${status}`);
        }
        if (activity.metadata?.recurrencePattern && activity.metadata.recurrencePattern !== 'none') {
            const rrule = this.buildRecurrenceRule(activity.metadata.recurrencePattern, activity.metadata.recurrenceEndDate);
            if (rrule) {
                lines.push(rrule);
            }
        }
        if (activity.createdAt) {
            lines.push(`CREATED:${this.formatICSDate(activity.createdAt)}`);
        }
        if (activity.updatedAt) {
            lines.push(`LAST-MODIFIED:${this.formatICSDate(activity.updatedAt)}`);
        }
        lines.push('END:VEVENT');
        return lines;
    }
    async getCalendar(organizationId, startDate, endDate, view) {
        const query = this.activityRepository
            .createQueryBuilder('activity')
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
            excludedType: Activity_1.ActivityType.RECRUITMENT,
        });
        const activities = await query
            .orderBy('activity.scheduledStartDate', 'ASC')
            .take(500)
            .getMany();
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
    generateICalEvent(event) {
        const now = new Date();
        const dateFormat = (date) => `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
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
        if (event.recurrencePattern && event.recurrencePattern !== 'none') {
            const rrule = this.buildRecurrenceRule(event.recurrencePattern, event.recurrenceEndDate ? new Date(event.recurrenceEndDate) : undefined);
            if (rrule) {
                icalLines.push(rrule);
            }
        }
        icalLines.push('END:VEVENT');
        icalLines.push('END:VCALENDAR');
        return icalLines.join('\r\n');
    }
    generateICalCalendar(events) {
        const now = new Date();
        const dateFormat = (date) => `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
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
                const rrule = this.buildRecurrenceRule(event.recurrencePattern, event.recurrenceEndDate ? new Date(event.recurrenceEndDate) : undefined);
                if (rrule) {
                    icalLines.push(rrule);
                }
            }
            icalLines.push('END:VEVENT');
        });
        icalLines.push('END:VCALENDAR');
        return icalLines.join('\r\n');
    }
    generateGoogleCalendarUrl(activity) {
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
    generateWebcalUrl(organizationId, token, baseUrl = 'https://api.fringecore.space') {
        return `webcal://${baseUrl.replace(/^https?:\/\//, '')}/api/calendar/${organizationId}/ics?token=${token}`;
    }
    formatICSDate(date) {
        return date
            .toISOString()
            .replace(/[-:]/g, '')
            .replace(/\.\d{3}/, '');
    }
    formatGoogleDate(date) {
        return date
            .toISOString()
            .replace(/[-:]/g, '')
            .replace(/\.\d{3}/, '');
    }
    escapeICSText(text) {
        if (!text) {
            return '';
        }
        return text
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n');
    }
    buildRecurrenceRule(pattern, endDate) {
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
    mapActivityStatus(status) {
        const statusMap = {
            open: 'CONFIRMED',
            in_progress: 'CONFIRMED',
            completed: 'CONFIRMED',
            cancelled: 'CANCELLED',
            draft: 'TENTATIVE',
        };
        return statusMap[status] || null;
    }
}
exports.ActivityCalendarService = ActivityCalendarService;
exports.CalendarExportService = ActivityCalendarService;
//# sourceMappingURL=ActivityCalendarService.js.map