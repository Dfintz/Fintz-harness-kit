import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class PermissionTemplateController extends BaseController {
    private templateService;
    private permissionService;
    listTemplates: (req: AuthRequest, res: Response) => Promise<void>;
    getTemplate: (req: AuthRequest, res: Response) => Promise<void>;
    createTemplate: (req: AuthRequest, res: Response) => Promise<void>;
    updateTemplate: (req: AuthRequest, res: Response) => Promise<void>;
    deleteTemplate: (req: AuthRequest, res: Response) => Promise<void>;
    applyTemplate: (req: AuthRequest, res: Response) => Promise<void>;
    getUserStats: (req: AuthRequest, res: Response) => Promise<void>;
    generateReport: (req: AuthRequest, res: Response) => Promise<void>;
    getAuditLog: (req: AuthRequest, res: Response) => Promise<void>;
    getServiceStats: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=permissionTemplateController.d.ts.map