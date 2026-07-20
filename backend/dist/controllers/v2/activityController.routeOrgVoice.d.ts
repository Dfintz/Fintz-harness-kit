import { Request, Response } from 'express';
export type ActivityControllerRouteOrgVoiceHandler = (req: Request, res: Response) => Promise<void>;
export declare function addRoutePlanHandler(req: Request, res: Response): Promise<void>;
export declare function updateWaypointHandler(req: Request, res: Response): Promise<void>;
export declare function enrichWithMiningDataHandler(req: Request, res: Response): Promise<void>;
export declare function inviteOrganizationHandler(req: Request, res: Response): Promise<void>;
export declare function acceptOrganizationInviteHandler(req: Request, res: Response): Promise<void>;
export declare function declineOrganizationInviteHandler(req: Request, res: Response): Promise<void>;
export declare function createVoiceChannelHandler(req: Request, res: Response): Promise<void>;
export declare function linkVoiceChannelHandler(req: Request, res: Response): Promise<void>;
export declare class ActivityControllerRouteOrgVoiceBindings {
    readonly addRoutePlan: ActivityControllerRouteOrgVoiceHandler;
    readonly updateWaypoint: ActivityControllerRouteOrgVoiceHandler;
    readonly enrichWithMiningData: ActivityControllerRouteOrgVoiceHandler;
    readonly inviteOrganization: ActivityControllerRouteOrgVoiceHandler;
    readonly acceptOrganizationInvite: ActivityControllerRouteOrgVoiceHandler;
    readonly declineOrganizationInvite: ActivityControllerRouteOrgVoiceHandler;
    readonly createVoiceChannel: ActivityControllerRouteOrgVoiceHandler;
    readonly linkVoiceChannel: ActivityControllerRouteOrgVoiceHandler;
}
//# sourceMappingURL=activityController.routeOrgVoice.d.ts.map