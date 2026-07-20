import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class FleetViewController extends BaseController {
    private readonly fleetViewService;
    private readonly organizationPermissionService;
    private readonly organizationRepository;
    private static readonly IMPORT_OPTION_FIELDS;
    uploadMiddleware: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
    private normalizeFleetViewSchema;
    private hasDirectSchemaInBody;
    private parseFleetViewSchema;
    exportUserFleet: (req: AuthRequest, res: Response) => Promise<void>;
    exportOrgFleet: (req: AuthRequest, res: Response) => Promise<void>;
    importUserFleet: (req: AuthRequest, res: Response) => Promise<void>;
    importOrgFleet: (req: AuthRequest, res: Response) => Promise<void>;
    validateSchema: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=fleetViewController.d.ts.map