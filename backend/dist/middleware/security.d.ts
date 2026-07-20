import cors from 'cors';
import { NextFunction, Request, Response } from 'express';
export declare const helmetConfig: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, next: (err?: unknown) => void) => void;
export declare const swaggerCspMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const removePoweredBy: (req: Request, res: Response, next: NextFunction) => void;
export declare function resolveSwaggerEnabled(): boolean;
export declare const corsConfig: (req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void;
export declare const rateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const authRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const uploadRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const webhookRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const rsiApiRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const sanitizeInput: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateEnvironment: () => string[];
//# sourceMappingURL=security.d.ts.map