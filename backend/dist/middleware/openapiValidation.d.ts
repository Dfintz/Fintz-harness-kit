import { Request, Response, NextFunction } from 'express';
export declare const openapiValidatorMiddleware: import("express-openapi-validator/dist/framework/types").OpenApiRequestHandler[];
interface OpenApiValidationError {
    path: string;
    message: string;
    errorCode?: string;
}
export declare const openapiErrorHandler: (err: Error & {
    status?: number;
    errors?: OpenApiValidationError[];
}, req: Request, res: Response, next: NextFunction) => void;
export declare const logValidatedRequest: (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=openapiValidation.d.ts.map