import path from 'path';

import { Request, Response, NextFunction } from 'express';
import * as OpenApiValidator from 'express-openapi-validator';

import { logger } from '../utils/logger';

/**
 * OpenAPI validation middleware configuration
 * Validates requests and responses against OpenAPI 3.1 specification
 */
export const openapiValidatorMiddleware = OpenApiValidator.middleware({
    apiSpec: path.join(__dirname, '../../openapi/api.yaml'),
    validateRequests: true,
    validateResponses: false, // Enable in development for stricter validation
    validateSecurity: {
        handlers: {
            bearerAuth: async (req: Request, _scopes: string[]) => {
                // Security validation is handled by authenticateToken middleware
                // This handler just verifies the Authorization header exists
                // The actual token validation happens in the auth middleware chain
                const authHeader = req.headers.authorization;
                if (!authHeader?.startsWith('Bearer ')) {
                    return false;
                }
                return true;
            },
        },
    },
    ignorePaths: /^\/(?!api).*/, // Only validate /api/* routes
    validateFormats: 'fast', // Validate string formats (email, uri, uuid, etc.)
    $refParser: {
        mode: 'dereference',
    },
});

/**
 * OpenAPI validation error structure
 */
interface OpenApiValidationError {
    path: string;
    message: string;
    errorCode?: string;
}

/**
 * Custom error handler for OpenAPI validation errors
 * Formats validation errors in a consistent API error response format
 */
export const openapiErrorHandler = (
    err: Error & { status?: number; errors?: OpenApiValidationError[] },
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (err?.status) {
        // OpenAPI validation error
        logger.warn('OpenAPI validation error', {
            path: req.path,
            method: req.method,
            error: err.message,
            errors: err.errors,
        });

        const errors = (err.errors)?.map((e) => ({
            field: e.path,
            message: e.message,
            code: e.errorCode,
        })) || [];

        res.status(err.status).json({
            status: 'error',
            code: 'VALIDATION_ERROR',
            message: err.message || 'Request validation failed',
            details: errors,
            timestamp: new Date().toISOString(),
        });
        return;
    }

    // Pass to next error handler
    next(err);
};

/**
 * Optional: Middleware to log validated requests
 * Useful for debugging and monitoring contract compliance
 */
export const logValidatedRequest = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    logger.debug('Request validated against OpenAPI spec', {
        path: req.path,
        method: req.method,
        operationId: (req as Request & { openapi?: { schema?: { operationId?: string } } }).openapi?.schema?.operationId,
    });
    next();
};
