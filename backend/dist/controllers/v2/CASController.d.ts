import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
export declare class CASController extends BaseController {
    private readonly queryService;
    private parseBooleanQuery;
    getScore(req: Request, res: Response): Promise<void>;
    getHistory(req: Request, res: Response): Promise<void>;
    getBreakdown(req: Request, res: Response): Promise<void>;
    getHeatmap(req: Request, res: Response): Promise<void>;
    getRanking(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=CASController.d.ts.map