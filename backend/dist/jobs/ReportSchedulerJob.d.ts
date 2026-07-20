export interface ReportScheduleConfig {
    organizationId: string;
    schedule: string;
    recipients: string[];
    format: string;
    timezone: string;
    createdBy: string;
    createdAt: string;
}
declare class ReportSchedulerJobClass {
    private readonly analyticsService;
    private readonly jobs;
    constructor();
    start(): void;
    stop(): void;
    private processScheduledReports;
    private shouldRunNow;
    static saveSchedule(config: ReportScheduleConfig): Promise<void>;
    static getSchedule(organizationId: string): Promise<ReportScheduleConfig | null>;
    private static getAllSchedulesStatic;
    private getAllSchedules;
    getStatus(): {
        running: boolean;
        jobCount: number;
    };
}
export declare const ReportSchedulerJob: ReportSchedulerJobClass;
export { ReportSchedulerJobClass };
//# sourceMappingURL=ReportSchedulerJob.d.ts.map