import { Request, Response, NextFunction } from 'express';
interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        role: string;
    };
    startTime?: number;
}
export declare class ActivityLoggerMiddleware {
    private activityService;
    private excludedPaths;
    private excludedMethods;
    constructor();
    private determineAction;
    private shouldLog;
    logActivity: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    static logSpecificAction(req: AuthRequest, action: string, metadata?: Record<string, unknown>): Promise<void>;
}
export declare const activityLogger: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const logSpecificAction: typeof ActivityLoggerMiddleware.logSpecificAction;
export {};
//# sourceMappingURL=activityLogger.d.ts.map