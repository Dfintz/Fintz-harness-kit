import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
export declare class RolesControllerV2 extends BaseController {
    private readonly roleRepository;
    private readonly membershipRepository;
    private readonly permissionChangeEventService;
    private readonly memberRoleAssignmentService;
    private resolveAffectedUserIdsByRole;
    private resolveAffectedUserIdsByRoles;
    private processPermissionChange;
    private verifyRoleManagementAccess;
    listRoles(req: Request, res: Response): Promise<void>;
    getRole(req: Request, res: Response): Promise<void>;
    createRole(req: Request, res: Response): Promise<void>;
    updateRole(req: Request, res: Response): Promise<void>;
    reorderRoles(req: Request, res: Response): Promise<void>;
    deleteRole(req: Request, res: Response): Promise<void>;
    assignRoleToUser(req: Request, res: Response): Promise<void>;
    removeRoleFromUser(req: Request, res: Response): Promise<void>;
    getRolePermissions(req: Request, res: Response): Promise<void>;
    addPermissionToRole(req: Request, res: Response): Promise<void>;
    removePermissionFromRole(req: Request, res: Response): Promise<void>;
    searchByScope(req: Request, res: Response): Promise<void>;
    getTemplates(_req: Request, res: Response): void;
    applyTemplate(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=rolesController.d.ts.map