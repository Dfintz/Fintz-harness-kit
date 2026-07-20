import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class FleetTenantController extends BaseController {
    private static readonly DEFAULT_SHARED_LIMIT;
    private static readonly MAX_SHARED_LIMIT;
    private readonly fleetService;
    constructor();
    list(req: Request, res: Response): Promise<void>;
    listShared(req: Request, res: Response): Promise<void>;
    private getSharedFleetPagination;
    private parseOptionalQueryInteger;
    getStatistics(req: Request, res: Response): Promise<void>;
    search(req: Request, res: Response): Promise<void>;
    getById(req: Request, res: Response): Promise<void>;
    create(req: Request, res: Response): Promise<void>;
    update(req: Request, res: Response): Promise<void>;
    delete(req: Request, res: Response): Promise<void>;
    share(req: Request, res: Response): Promise<void>;
    unshare(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=FleetTenantController.d.ts.map