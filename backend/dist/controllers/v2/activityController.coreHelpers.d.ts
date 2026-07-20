import { Request } from 'express';
import { Activity } from '../../models/Activity';
import { ActivityParticipantEntity } from '../../models/ActivityParticipant';
import { Organization } from '../../models/Organization';
import { NotificationContext } from '../../services/communication/notifications/NotificationRouter';
export declare function findActivityByIdHelper(id: string, options?: {
    organizationId?: string;
    visibility?: Activity['visibility'];
    includeParticipants?: boolean;
}): Promise<Activity | null>;
export declare function getScopedOrganizationIdHelper(req: Request): string | undefined;
export declare function getCompletionActivityForUserHelper(input: {
    req: Request;
    activityId: string;
    userId: string;
    options?: {
        requireOrganization?: boolean;
    };
    getScopedOrganizationId: (req: Request) => string | undefined;
    findActivityById: (id: string, options?: {
        organizationId?: string;
        visibility?: Activity['visibility'];
        includeParticipants?: boolean;
    }) => Promise<Activity | null>;
    canUserAccessOrganization: (userId: string, orgId: string) => Promise<{
        canAccess: boolean;
    }>;
}): Promise<Activity>;
export declare function findOrganizationByIdHelper(orgId: string, getOrganizationById: (orgId: string) => Promise<Organization | null>): Promise<Organization | null>;
export declare function applyAllowedActivityUpdatesHelper(activity: Activity, updates: Record<string, unknown>): void;
export declare function applyScheduleUpdatesHelper(activity: Activity, updates: Record<string, unknown>): void;
export declare function applyMetadataUpdateHelper(activity: Activity, updates: Record<string, unknown>): void;
export declare function hydrateParticipantsHelper(activity: Activity, getParticipants: (activityId: string) => Promise<ActivityParticipantEntity[]>): Promise<void>;
export declare function notifyOrgHelper(input: {
    context: NotificationContext;
    organizationId: string;
    title: string;
    message: string;
    activityId: string;
    senderId?: string;
    metadata?: Record<string, unknown>;
}, notifyOrganization: (payload: {
    context: NotificationContext;
    organizationId: string;
    title: string;
    message: string;
    senderId?: string;
    actionUrl: string;
    metadata: Record<string, unknown>;
}) => void): void;
//# sourceMappingURL=activityController.coreHelpers.d.ts.map