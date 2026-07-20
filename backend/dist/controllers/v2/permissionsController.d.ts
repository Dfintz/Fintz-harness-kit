import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
export declare class PermissionsControllerV2 extends BaseController {
    private readonly membershipRepository;
    private readonly permissionManager;
    private readonly userRepository;
    private verifyAdminAccess;
    listPermissions(req: Request, res: Response): Promise<void>;
    getPermission(req: Request, res: Response): Promise<void>;
    getUserPermissions(req: Request, res: Response): Promise<void>;
    checkPermission(req: Request, res: Response): Promise<void>;
    listRoles(req: Request, res: Response): Promise<void>;
    getRole(req: Request, res: Response): Promise<void>;
    getUserPermissionsForOrg(req: Request, res: Response): Promise<void>;
    grantPermission(req: Request, res: Response): Promise<void>;
    revokePermission(req: Request, res: Response): Promise<void>;
    updateSecurityLevel(req: Request, res: Response): Promise<void>;
    setInterOrgSecurityLevel(req: Request, res: Response): Promise<void>;
    getOrgSecurityLevels(req: Request, res: Response): Promise<void>;
    getAllSecurityLevels(req: Request, res: Response): Promise<void>;
    revokeInterOrgSecurityLevel(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=permissionsController.d.ts.map