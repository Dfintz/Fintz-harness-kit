import { Activity } from '../../models/Activity';
import { Event } from '../../types';
export declare class ActivityCalendarService {
    private static instance;
    private activityRepository;
    constructor();
    static getInstance(): ActivityCalendarService;
    generateICS(organizationId: string, options?: {
        startDate?: Date;
        endDate?: Date;
        activityTypes?: string[];
        includePrivate?: boolean;
    }): Promise<string>;
    generateActivityICS(activityId: string): Promise<string>;
    generateUserICS(userId: string, options?: {
        startDate?: Date;
        endDate?: Date;
    }): Promise<string>;
    private buildICSContent;
    private buildVEvent;
    getCalendar(organizationId: string, startDate: Date, endDate: Date, view?: string): Promise<Record<string, unknown>>;
    generateICalEvent(event: Event): string;
    generateICalCalendar(events: Event[]): string;
    generateGoogleCalendarUrl(activity: Activity): string;
    generateWebcalUrl(organizationId: string, token: string, baseUrl?: string): string;
    private formatICSDate;
    private formatGoogleDate;
    private escapeICSText;
    private buildRecurrenceRule;
    private mapActivityStatus;
}
export { ActivityCalendarService as CalendarExportService };
//# sourceMappingURL=ActivityCalendarService.d.ts.map