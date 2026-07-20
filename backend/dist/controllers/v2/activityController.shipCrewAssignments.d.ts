import { Request, Response } from 'express';
export type ActivityControllerRouteHandler = (req: Request, res: Response) => Promise<void>;
export declare function addShipHandler(req: Request, res: Response): Promise<void>;
export declare function loanShipsHandler(req: Request, res: Response): Promise<void>;
export declare function joinShipCrewHandler(req: Request, res: Response): Promise<void>;
export declare function leaveShipCrewHandler(req: Request, res: Response): Promise<void>;
export declare function getAvailableCrewPositionsHandler(req: Request, res: Response): Promise<void>;
export declare function setCrewPositionHandler(req: Request, res: Response): Promise<void>;
export declare function setPassengerSlotsHandler(req: Request, res: Response): Promise<void>;
export declare function joinShipPassengerHandler(req: Request, res: Response): Promise<void>;
export declare function leaveShipPassengerHandler(req: Request, res: Response): Promise<void>;
export declare function getAvailablePassengerSlotsHandler(req: Request, res: Response): Promise<void>;
export declare function setCrewSlotsHandler(req: Request, res: Response): Promise<void>;
export declare function getCrewSlotAvailabilityHandler(req: Request, res: Response): Promise<void>;
export declare function bringFleetToActivityHandler(req: Request, res: Response): Promise<void>;
export declare function bringFleetAndInviteMembersHandler(req: Request, res: Response): Promise<void>;
export declare function inviteFleetMembersHandler(req: Request, res: Response): Promise<void>;
export declare function nestShipHandler(req: Request, res: Response): Promise<void>;
export declare class ActivityControllerShipCrewBindings {
    readonly addShip: ActivityControllerRouteHandler;
    readonly loanShips: ActivityControllerRouteHandler;
    readonly joinShipCrew: ActivityControllerRouteHandler;
    readonly leaveShipCrew: ActivityControllerRouteHandler;
    readonly getAvailableCrewPositions: ActivityControllerRouteHandler;
    readonly setCrewPosition: ActivityControllerRouteHandler;
    readonly setPassengerSlots: ActivityControllerRouteHandler;
    readonly joinShipPassenger: ActivityControllerRouteHandler;
    readonly leaveShipPassenger: ActivityControllerRouteHandler;
    readonly getAvailablePassengerSlots: ActivityControllerRouteHandler;
    readonly setCrewSlots: ActivityControllerRouteHandler;
    readonly getCrewSlotAvailability: ActivityControllerRouteHandler;
    readonly bringFleetToActivity: ActivityControllerRouteHandler;
    readonly bringFleetAndInviteMembers: ActivityControllerRouteHandler;
    readonly inviteFleetMembers: ActivityControllerRouteHandler;
    readonly nestShip: ActivityControllerRouteHandler;
}
//# sourceMappingURL=activityController.shipCrewAssignments.d.ts.map