/**
 * Request ID Middleware
 * Generates unique ID for each request for tracing and debugging
 */

import { randomUUID } from 'crypto';

import { Request, Response, NextFunction } from 'express';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Generate unique request ID
    req.id = randomUUID();
    
    // Add to response headers for client-side tracking
    res.setHeader('X-Request-Id', req.id);
    
    // Track request start time for performance monitoring
    req.startTime = Date.now();
    
    next();
};
