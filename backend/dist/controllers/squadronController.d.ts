import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class SquadronController extends BaseController {
    private readonly teamService;
    private readonly fleetService;
    constructor();
    private resolveTeamId;
    getSquadronMembers: (req: Request, res: Response) => Promise<void>;
    getSquadronMemberById: (req: Request, res: Response) => Promise<void>;
    getSquadronRoster: (req: Request, res: Response) => Promise<void>;
    getUserSquadrons: (req: Request, res: Response) => Promise<void>;
    checkMembership: (req: Request, res: Response) => Promise<void>;
    getMembership: (req: Request, res: Response) => Promise<void>;
    addMember: (req: Request, res: Response) => Promise<void>;
    bulkAddMembers: (req: Request, res: Response) => Promise<void>;
    bulkUpdateMembers: (req: Request, res: Response) => Promise<void>;
    bulkDeleteMembers: (req: Request, res: Response) => Promise<void>;
    bulkUpdateStatus: (req: Request, res: Response) => Promise<void>;
    updateRole: (req: Request, res: Response) => Promise<void>;
    removeMember: (req: Request, res: Response) => Promise<void>;
    getSquadronMemberCount: (req: Request, res: Response) => Promise<void>;
    getActiveCount: (req: Request, res: Response) => Promise<void>;
    getMembersByRole: (req: Request, res: Response) => Promise<void>;
    getMembersByShipType: (req: Request, res: Response) => Promise<void>;
    getSquadronStatistics: (req: Request, res: Response) => Promise<void>;
    getUserSquadronCount: (req: Request, res: Response) => Promise<void>;
    private parseStatusFilter;
}
//# sourceMappingURL=squadronController.d.ts.map