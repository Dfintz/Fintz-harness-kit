import { Request } from 'express';
import { Activity } from '../../models/Activity';
import { Organization } from '../../models/Organization';
import type { ActivityParticipantService } from '../../services/activity/ActivityParticipantService';
import { NotificationContext, NotificationRouter } from '../../services/communication/notifications/NotificationRouter';
import type { OrganizationService } from '../../services/organization/OrganizationService';
export declare class ActivityControllerSharedHelpers {
    private readonly participantService;
    private readonly organizationService;
    private readonly notificationRouter;
    constructor(participantService: ActivityParticipantService, organizationService: OrganizationService, notificationRouter: NotificationRouter);
    findActivityById(id: string, options?: {
        organizationId?: string;
        visibility?: Activity['visibility'];
        includeParticipants?: boolean;
    }): Promise<Activity | null>;
    getScopedOrganizationId(req: Request): string | undefined;
    getCompletionActivityForUser(req: Request, activityId: string, userId: string, options?: {
        requireOrganization?: boolean;
    }): Promise<Activity>;
    findOrganizationById(orgId: string): Promise<Organization | null>;
    applyAllowedActivityUpdates(activity: Activity, updates: Record<string, unknown>): void;
    applyScheduleUpdates(activity: Activity, updates: Record<string, unknown>): void;
    applyMetadataUpdate(activity: Activity, updates: Record<string, unknown>): void;
    hydrateParticipants(activity: Activity): Promise<void>;
    notifyOrg(input: {
        context: NotificationContext;
        organizationId: string;
        title: string;
        message: string;
        activityId: string;
        senderId?: string;
        metadata?: Record<string, unknown>;
    }): void;
    notifyActivityJoined(activity: Activity, userId: string, userName: string): void;
    validateQuickJoinActivity(activity: Activity): void;
    findActivityByQuickJoinToken(token: string): Promise<Activity | null>;
    tokensEqualConstantTime(left: string, right: string): boolean;
}
//# sourceMappingURL=activityController.sharedHelpers.d.ts.map