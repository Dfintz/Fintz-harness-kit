import { Activity } from '../../models/Activity';
export declare class CalendarExportService {
    private static instance;
    private activityRepository;
    private constructor();
    static getInstance(): CalendarExportService;
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
    private formatICSDate;
    private escapeICSText;
    private mapActivityStatus;
    generateGoogleCalendarUrl(activity: Activity): string;
    private formatGoogleDate;
    generateWebcalUrl(organizationId: string, token: string, baseUrl?: string): string;
}
//# sourceMappingURL=CalendarExportService.d.ts.map