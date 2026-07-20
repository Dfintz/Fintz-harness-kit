import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class UserShipController extends BaseController {
    private readonly userShipService;
    constructor();
    private resolveUserId;
    getUserShips: (req: Request, res: Response) => Promise<void>;
    getUserShipById: (req: Request, res: Response) => Promise<void>;
    createUserShip: (req: Request, res: Response) => Promise<void>;
    bulkImportUserShips: (req: Request, res: Response) => Promise<void>;
    updateUserShip: (req: Request, res: Response) => Promise<void>;
    deleteUserShip: (req: Request, res: Response) => Promise<void>;
    clearAllUserShips: (req: Request, res: Response) => Promise<void>;
    loanShip: (req: Request, res: Response) => Promise<void>;
    returnLoanedShip: (req: Request, res: Response) => Promise<void>;
    getShipsNeedingInsurance: (req: Request, res: Response) => Promise<void>;
    getOrgAvailableShips: (req: Request, res: Response) => Promise<void>;
    getUserShipSummary: (req: Request, res: Response) => Promise<void>;
    updateShipSharing: (req: Request, res: Response) => Promise<void>;
    shareShipWithUsers: (req: Request, res: Response) => Promise<void>;
    unshareShipFromUser: (req: Request, res: Response) => Promise<void>;
    getOrgSharedShips: (req: Request, res: Response) => Promise<void>;
    getAccessibleShips: (req: Request, res: Response) => Promise<void>;
    getAllianceSharedShips: (req: Request, res: Response) => Promise<void>;
    getOrgFleetSummary: (req: Request, res: Response) => Promise<void>;
    updateErkulLoadoutUrl: (req: Request, res: Response) => Promise<void>;
    private parseStatusFilter;
    private parseConditionFilter;
    private parseSharingLevelFilter;
    private parseBooleanFilter;
}
//# sourceMappingURL=userShipController.d.ts.map