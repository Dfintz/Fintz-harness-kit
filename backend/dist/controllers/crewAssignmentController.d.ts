import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class CrewAssignmentController extends BaseController {
    private readonly service;
    private readonly permissionService;
    constructor();
    private verifyFleetPermission;
    private getOrgId;
    private getUserId;
    createAssignment: (req: Request, res: Response) => Promise<void>;
    getAssignments: (req: Request, res: Response) => Promise<void>;
    getAssignmentById: (req: Request, res: Response) => Promise<void>;
    addCrewMember: (req: Request, res: Response) => Promise<void>;
    removeCrewMember: (req: Request, res: Response) => Promise<void>;
    updateStatus: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=crewAssignmentController.d.ts.map