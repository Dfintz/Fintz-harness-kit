export interface ScheduledJobHandle {
    cleanup: () => void;
}
export interface DailyUtcScheduleOptions {
    jobName: string;
    hourUtc: number;
    minuteUtc?: number;
    run: () => Promise<void>;
    runOnStartup?: boolean;
}
export declare function scheduleDailyUtcJob(options: DailyUtcScheduleOptions): ScheduledJobHandle;
export interface FixedIntervalScheduleOptions {
    jobName: string;
    intervalMs: number;
    run: () => Promise<void>;
    runOnStartup?: boolean;
}
export declare function scheduleFixedIntervalJob(options: FixedIntervalScheduleOptions): ScheduledJobHandle;
//# sourceMappingURL=jobSchedulerHelper.d.ts.map