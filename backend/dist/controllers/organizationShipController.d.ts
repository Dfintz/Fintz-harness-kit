import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class OrganizationShipController extends BaseController {
    private readonly orgShipService;
    constructor();
    private getOrgIdFromRequest;
    getOrgShips: (req: Request, res: Response) => Promise<void>;
    getOrgShipById: (req: Request, res: Response) => Promise<void>;
    createOrgShip: (req: Request, res: Response) => Promise<void>;
    updateOrgShip: (req: Request, res: Response) => Promise<void>;
    deleteOrgShip: (req: Request, res: Response) => Promise<void>;
    assignCaptain: (req: Request, res: Response) => Promise<void>;
    assignCrew: (req: Request, res: Response) => Promise<void>;
    addCrewMember: (req: Request, res: Response) => Promise<void>;
    removeCrewMember: (req: Request, res: Response) => Promise<void>;
    getShipsNeedingMaintenance: (req: Request, res: Response) => Promise<void>;
    getCapitalShips: (req: Request, res: Response) => Promise<void>;
    getShipsByRole: (req: Request, res: Response) => Promise<void>;
    getAvailableShips: (req: Request, res: Response) => Promise<void>;
    getFleetSummary: (req: Request, res: Response) => Promise<void>;
    loanOrgShip: (req: Request, res: Response) => Promise<void>;
    returnOrgShipLoan: (req: Request, res: Response) => Promise<void>;
    private parseRoleFilter;
    private parseStatusFilter;
    private parseConditionFilter;
    private parseBooleanFilter;
}
//# sourceMappingURL=organizationShipController.d.ts.map