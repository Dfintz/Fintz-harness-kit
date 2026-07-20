import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class WorkflowController extends BaseController {
    private readonly workflowService;
    constructor();
    list: (req: AuthRequest, res: Response) => Promise<void>;
    create: (req: AuthRequest, res: Response) => Promise<void>;
    getById: (req: AuthRequest, res: Response) => Promise<void>;
    update: (req: AuthRequest, res: Response) => Promise<void>;
    delete: (req: AuthRequest, res: Response) => Promise<void>;
    execute_: (req: AuthRequest, res: Response) => Promise<void>;
    getExecutions: (req: AuthRequest, res: Response) => Promise<void>;
    enable: (req: AuthRequest, res: Response) => Promise<void>;
    disable: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=workflowController.d.ts.map