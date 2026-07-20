import { Request, Response } from 'express';
export declare class EventConflictControllerV2 {
    private readonly conflictService;
    constructor();
    checkConflicts(req: Request, res: Response): Promise<void>;
    getMyConflicts(req: Request, res: Response): Promise<void>;
    getActivityConflicts(req: Request, res: Response): Promise<void>;
    getUserConflicts(req: Request, res: Response): Promise<void>;
    getConflictsInRange(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=eventConflictController.d.ts.map