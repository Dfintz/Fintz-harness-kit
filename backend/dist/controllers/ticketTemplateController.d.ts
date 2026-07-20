import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class TicketTemplateController extends BaseController {
    private getTemplateService;
    listTemplates: (req: AuthRequest, res: Response) => Promise<void>;
    getTemplate: (req: AuthRequest, res: Response) => Promise<void>;
    createFromTemplate: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=ticketTemplateController.d.ts.map