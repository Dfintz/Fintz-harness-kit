export declare class OrganizationDeletionReminderJob {
    private readonly deletionService;
    private readonly notificationService;
    private readonly REMINDER_INTERVALS;
    private readonly FINAL_WARNING_HOURS;
    constructor();
    execute(): Promise<void>;
    private executeUnlocked;
    private getApprovedRequestsInGracePeriod;
    private calculateDaysRemaining;
    private calculateHoursRemaining;
    private shouldSendReminder;
    private hasSentReminderToday;
    private hasSentFinalWarning;
    private markReminderSent;
    private markFinalWarningSent;
    getStats(): Promise<{
        approvedRequestsInGracePeriod: number;
        requestsRequiringReminders: number;
        requestsRequiringFinalWarning: number;
    }>;
}
export declare const organizationDeletionReminderJob: OrganizationDeletionReminderJob;
export declare function runOrganizationDeletionReminderJob(): Promise<void>;
export interface OrgDeletionReminderJobHandle {
    cleanup: () => void;
}
export declare function scheduleOrgDeletionReminders(): OrgDeletionReminderJobHandle;
//# sourceMappingURL=organizationDeletionReminderJob.d.ts.map