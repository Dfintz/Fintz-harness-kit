import { NotificationService } from '../communication/notifications/NotificationService';
export interface VerificationSuccessPayload {
    userEmail?: string;
    username: string;
    rsiHandle: string;
    displayName?: string;
    discordUserId?: string;
}
export interface VerificationFailedPayload {
    userEmail?: string;
    username: string;
    rsiHandle: string;
    reason: string;
    discordUserId?: string;
}
export interface RoleSyncPayload {
    userEmail?: string;
    username: string;
    rsiHandle: string;
    organizationName: string;
    rolesAdded: string[];
    rolesRemoved: string[];
    discordUserId?: string;
}
export interface ReviewNeededPayload {
    adminEmail?: string;
    adminDiscordUserId?: string;
    rsiHandle: string;
    organizationName: string;
    reason: string;
    linkId: string;
}
export declare class RsiNotificationService {
    private readonly notificationService;
    private readonly enabled;
    constructor(notificationService?: NotificationService);
    sendVerificationSuccess(payload: VerificationSuccessPayload): Promise<void>;
    sendVerificationFailed(payload: VerificationFailedPayload): Promise<void>;
    sendRoleSyncNotification(payload: RoleSyncPayload): Promise<void>;
    sendReviewNeededNotification(payload: ReviewNeededPayload): Promise<void>;
}
//# sourceMappingURL=RsiNotificationService.d.ts.map