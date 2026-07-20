import { NextFunction, Request, Response } from 'express';
export declare const trackApiVersion: (req: Request, res: Response, next: NextFunction) => void;
export declare const v1DeprecationMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const v1ShutdownMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare function getV1UsageStats(): Promise<{
    totalRequests: number;
    uniqueEndpoints: string[];
    topEndpoints: Array<{
        path: string;
        count: number;
    }>;
    uniqueUsers: number;
}>;
//# sourceMappingURL=v1Deprecation.d.ts.map