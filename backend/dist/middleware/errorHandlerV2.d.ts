import { NextFunction, Response } from 'express';
interface ExtendedRequest {
    id?: string;
    user?: {
        id?: string;
    };
    tenantContext?: {
        organizationId?: string;
    };
    path: string;
    method: string;
    get(name: string): string | undefined;
}
export declare const errorHandlerV2: (error: Error & {
    code?: string;
    statusCode?: number;
    details?: unknown;
    errors?: Record<string, {
        message: string;
    }>;
}, req: ExtendedRequest, res: Response, _next: NextFunction) => Response<any, Record<string, any>>;
export { ApiError } from '../utils/apiErrors';
//# sourceMappingURL=errorHandlerV2.d.ts.map