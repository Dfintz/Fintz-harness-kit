export declare class TacticalOperationsScheduler {
    private reminderService;
    private attendanceService;
    private notificationService;
    private jobs;
    constructor();
    start(): void;
    stop(): void;
    getStatus(): {
        totalJobs: number;
        runningJobs: number;
    };
}
export declare function startTacticalOperationsJobs(): void;
export declare function stopTacticalOperationsJobs(): void;
export declare function getTacticalOperationsJobsStatus(): {
    totalJobs: number;
    runningJobs: number;
};
//# sourceMappingURL=tacticalOperationsScheduler.d.ts.map