import { Request, Response } from 'express';
import { Activity, ParticipantRole } from '../../models/Activity';
import { NotificationContext } from '../../services/communication/notifications/NotificationRouter';
type LifecycleDiscoveryDeps = {
    findActivityById: (id: string, options?: {
        organizationId?: string;
        visibility?: Activity['visibility'];
        includeParticipants?: boolean;
    }) => Promise<Activity | null>;
    findOrganizationById: (orgId: string) => Promise<{
        name: string;
    } | null>;
    hydrateParticipants: (activity: Activity) => Promise<void>;
    applyAllowedActivityUpdates: (activity: Activity, updates: Record<string, unknown>) => void;
    applyScheduleUpdates: (activity: Activity, updates: Record<string, unknown>) => void;
    applyMetadataUpdate: (activity: Activity, updates: Record<string, unknown>) => void;
    notifyOrg: (input: {
        context: NotificationContext;
        organizationId: string;
        title: string;
        message: string;
        activityId: string;
        senderId?: string;
        metadata?: Record<string, unknown>;
    }) => void;
    participantService: {
        joinActivity: (activityId: string, dto: {
            userId: string;
            userName: string;
            organizationId?: string;
            organizationName?: string;
            role?: ParticipantRole;
        }) => Promise<{
            activity: Activity;
            wasUpdate: boolean;
        }>;
    };
};
export declare function listOrgActivitiesHandler(req: Request, res: Response): Promise<void>;
export declare function getPublicActivityByIdHandler(req: Request, res: Response, deps: Pick<LifecycleDiscoveryDeps, 'hydrateParticipants'>): Promise<void>;
export declare function getActivityByIdHandler(req: Request, res: Response, deps: Pick<LifecycleDiscoveryDeps, 'hydrateParticipants'>): Promise<void>;
export declare function createActivityHandler(req: Request, res: Response, deps: Pick<LifecycleDiscoveryDeps, 'findOrganizationById' | 'participantService' | 'notifyOrg'>): Promise<void>;
export declare function updateActivityHandler(req: Request, res: Response, deps: Pick<LifecycleDiscoveryDeps, 'findActivityById' | 'applyAllowedActivityUpdates' | 'applyScheduleUpdates' | 'applyMetadataUpdate' | 'hydrateParticipants'>): Promise<void>;
export declare function deleteActivityHandler(req: Request, res: Response, deps: Pick<LifecycleDiscoveryDeps, 'findActivityById'>): Promise<void>;
export declare function getRecommendedActivitiesHandler(req: Request, res: Response): Promise<void>;
export declare function getUpcomingActivitiesHandler(req: Request, res: Response): Promise<void>;
export declare function getActivityAnalyticsHandler(req: Request, res: Response): Promise<void>;
export {};
//# sourceMappingURL=activityController.lifecycleDiscovery.d.ts.map