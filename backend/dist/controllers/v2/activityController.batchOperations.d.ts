import { Request, Response } from 'express';
import { Activity } from '../../models/Activity';
type BatchOperationDeps = {
    findActivityById: (id: string) => Promise<Activity | null>;
};
export declare function batchCreateActivitiesHandler(req: Request, res: Response): Promise<void>;
export declare function batchUpdateActivitiesHandler(req: Request, res: Response, deps: BatchOperationDeps): Promise<void>;
export declare function batchDeleteActivitiesHandler(req: Request, res: Response, deps: BatchOperationDeps): Promise<void>;
export {};
//# sourceMappingURL=activityController.batchOperations.d.ts.map