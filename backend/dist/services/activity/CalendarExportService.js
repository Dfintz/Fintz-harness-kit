"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarExportService = void 0;
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
class CalendarExportService {
    static instance;
    activityRepository = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
    constructor() { }
    static getInstance() {
        if (!CalendarExportService.instance) {
            CalendarExportService.instance = new CalendarExportService();
        }
        return CalendarExportService.instance;
    }
    async generateICS(organizationId, options) {
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
        if (activity.createdAt) {
            lines.push(`CREATED:${this.formatICSDate(activity.createdAt)}`);
        }
        if (activity.updatedAt) {
            lines.push(`LAST-MODIFIED:${this.formatICSDate(activity.updatedAt)}`);
        }
        lines.push('END:VEVENT');
        return lines;
    }
    formatICSDate(date) {
        return date
            .toISOString()
            .replace(/[-:]/g, '')
            .replace(/\.\d{3}/, '');
    }
    escapeICSText(text) {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n');
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
    formatGoogleDate(date) {
        return date
            .toISOString()
            .replace(/[-:]/g, '')
            .replace(/\.\d{3}/, '');
    }
    generateWebcalUrl(organizationId, token, baseUrl = 'https://api.fringecore.space') {
        return `webcal://${baseUrl.replace(/^https?:\/\//, '')}/api/calendar/${organizationId}/ics?token=${token}`;
    }
}
exports.CalendarExportService = CalendarExportService;
//# sourceMappingURL=CalendarExportService.js.map