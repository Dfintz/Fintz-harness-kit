import { OrganizationDeletionRequest } from '../../models/OrganizationDeletionRequest';
export declare enum OrgDeletionNotificationType {
    REQUEST_CREATED = "deletion_request_created",
    REQUEST_APPROVED = "deletion_request_approved",
    REQUEST_REJECTED = "deletion_request_rejected",
    REQUEST_CANCELLED = "deletion_request_cancelled",
    GRACE_PERIOD_REMINDER = "grace_period_reminder",
    FINAL_WARNING = "final_warning",
    DELETION_COMPLETED = "deletion_completed"
}
export declare class OrganizationDeletionNotificationService {
    private userRepository;
    private membershipRepository;
    private deletionRequestRepository;
    constructor();
    notifyRequestCreated(request: OrganizationDeletionRequest): Promise<void>;
    notifyRequestApproved(request: OrganizationDeletionRequest): Promise<void>;
    notifyRequestRejected(request: OrganizationDeletionRequest): Promise<void>;
    notifyRequestCancelled(request: OrganizationDeletionRequest): Promise<void>;
    notifyGracePeriodReminder(request: OrganizationDeletionRequest, daysRemaining: number): Promise<void>;
    notifyFinalWarning(request: OrganizationDeletionRequest): Promise<void>;
    notifyDeletionCompleted(request: OrganizationDeletionRequest): Promise<void>;
    private getOrganizationStakeholders;
    private getUserById;
    private getUserNotificationPreferences;
    private sendEmailNotifications;
    private sendInAppNotifications;
    private calculateDaysRemaining;
    private buildRequestCreatedEmailContent;
    private buildRequestApprovedEmailContent;
    private buildRequestRejectedEmailContent;
    private buildRequestCancelledEmailContent;
    private buildGracePeriodReminderEmailContent;
    private buildFinalWarningEmailContent;
    private buildDeletionCompletedEmailContent;
}
//# sourceMappingURL=OrganizationDeletionNotificationService.d.ts.map