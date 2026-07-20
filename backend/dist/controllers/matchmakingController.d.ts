import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class MatchmakingController {
    private get preferencesRepo();
    getPreferences(req: AuthRequest, res: Response): Promise<void>;
    setPreferences(req: AuthRequest, res: Response): Promise<void>;
    findMatches(req: AuthRequest, res: Response): Promise<void>;
    trackJoin(req: AuthRequest, res: Response): Promise<void>;
    getAnalytics(req: AuthRequest, res: Response): Promise<void>;
    getEnums(req: AuthRequest, res: Response): Promise<void>;
}
export declare const matchmakingController: MatchmakingController;
//# sourceMappingURL=matchmakingController.d.ts.map