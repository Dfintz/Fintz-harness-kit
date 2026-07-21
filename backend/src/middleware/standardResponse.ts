/**
 * Standard Response Middleware
 * Adds helper methods to Response object for consistent API responses
 * Updated for API v2 with HATEOAS links and offset-based pagination
 */

import { Request, Response, NextFunction } from 'express';

import { ResponseMeta, PaginationMeta, ApiErrorCode, HateoasLinks } from '../types/api';

export const standardResponseMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Add success response helper
    res.success = function <T>(data: T, meta?: Partial<ResponseMeta>) {
        const response = {
            success: true as const,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.id,
                ...meta
            }
        };
        
        return this.json(response);
    };
    
    // Add paginated response helper with HATEOAS links support
    res.paginated = function <T>(data: T[], pagination: PaginationMeta, links?: HateoasLinks) {
        // Calculate legacy pagination fields for backward compatibility
        const limit = pagination.limit;
        const offset = pagination.offset;
        const total = pagination.total;
        const page = pagination.page ?? Math.floor(offset / limit) + 1;
        const totalPages = pagination.totalPages ?? Math.ceil(total / limit);
        
        const response: {
            success: true;
            data: T[];
            meta: {
                timestamp: string;
                requestId: string | undefined;
                pagination: PaginationMeta;
            };
            links?: HateoasLinks;
        } = {
            success: true as const,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.id,
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: pagination.hasMore ?? (offset + limit < total),
                    // Legacy fields
                    page,
                    totalPages,
                    hasNext: pagination.hasNext ?? (page < totalPages),
                    hasPrevious: pagination.hasPrevious ?? (page > 1)
                }
            }
        };
        
        // Add HATEOAS links if provided
        if (links) {
            response.links = links;
        }
        
        return this.json(response);
    };
    
    // Add error response helper
    res.error = function (
        code: ApiErrorCode | string,
        message: string,
        details?: unknown,
        statusCode: number = 500
    ) {
        const response = {
            success: false as const,
            error: {
                code,
                message,
                details,
                timestamp: new Date().toISOString(),
                requestId: req.id
            }
        };
        
        return this.status(statusCode).json(response);
    };
    
    next();
};
