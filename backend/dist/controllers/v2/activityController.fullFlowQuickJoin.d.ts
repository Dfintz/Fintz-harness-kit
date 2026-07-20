import { Request, Response } from 'express';
import { Activity } from '../../models/Activity';
import { ActivityParticipantStatus } from '../../models/ActivityParticipant';
import type { ActivityParticipantService } from '../../services/activity/ActivityParticipantService';
type QuickJoinDeps = {
    findActivityById: (id: string) => Promise<Activity | null>;
    getCompletionActivityForUser: (req: Request, activityId: string, userId: string) => Promise<Activity>;
    findActivityByQuickJoinToken: (token: string) => Promise<Activity | null>;
    validateQuickJoinActivity: (activity: Activity) => void;
    organizationServiceCanUserAccessOrganization: (userId: string, organizationId: string) => Promise<{
        canAccess: boolean;
        accessLevel?: string;
        reason?: string;
    }>;
    getParticipantCount: (activityId: string, status: ActivityParticipantStatus) => Promise<number>;
    isParticipant: (activityId: string, userId: string) => Promise<boolean>;
    joinActivityByToken: (activityId: string, input: Parameters<ActivityParticipantService['joinActivity']>[1]) => Promise<{
        activity: Activity;
    }>;
};
export declare function createActivityFullHandler(req: Request, res: Response, deps: Pick<QuickJoinDeps, 'organizationServiceCanUserAccessOrganization'>): Promise<void>;
export declare function completeActivityFullHandler(req: Request, res: Response, deps: Pick<QuickJoinDeps, 'getCompletionActivityForUser'>): Promise<void>;
export declare function generateJoinLinkHandler(req: Request, res: Response, deps: Pick<QuickJoinDeps, 'findActivityById'>): Promise<void>;
export declare function previewActivityByTokenHandler(req: Request, res: Response, deps: Pick<QuickJoinDeps, 'findActivityByQuickJoinToken' | 'getParticipantCount'>): Promise<void>;
export declare function joinActivityByTokenHandler(req: Request, res: Response, deps: Pick<QuickJoinDeps, 'findActivityByQuickJoinToken' | 'validateQuickJoinActivity' | 'isParticipant' | 'joinActivityByToken'>): Promise<void>;
export {};
//# sourceMappingURL=activityController.fullFlowQuickJoin.d.ts.map