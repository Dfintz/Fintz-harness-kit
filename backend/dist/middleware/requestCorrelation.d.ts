import { Request, Response, NextFunction } from 'express';
export interface CorrelatedRequest extends Request {
    requestId: string;
    correlationId: string;
    startTime: number;
    breadcrumbs?: Breadcrumb[];
}
export interface Breadcrumb {
    timestamp: number;
    category: string;
    message: string;
    level: 'debug' | 'info' | 'warning' | 'error';
    data?: Record<string, unknown>;
}
export declare function requestCorrelationMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
export declare function addBreadcrumb(req: Request, breadcrumb: Omit<Breadcrumb, 'timestamp'>): void;
export declare function getBreadcrumbs(req: Request): Breadcrumb[];
export declare function getCorrelationData(req: Request): {
    requestId: string;
    correlationId: string;
    duration?: number;
};
//# sourceMappingURL=requestCorrelation.d.ts.map