/**
 * Request Correlation Middleware
 * 
 * Adds correlation IDs and tracking context to each request for improved
 * error tracing and debugging across distributed systems.
 */

import { randomUUID } from 'crypto';

import { Request, Response, NextFunction } from 'express';

import { logger } from '../utils/logger';
import { requestContextStorage } from '../utils/requestContext';
import { sanitizeQueryParams } from '../utils/securityUtils';

/**
 * Extended Request interface with correlation data
 */
export interface CorrelatedRequest extends Request {
  requestId: string;
  correlationId: string;
  startTime: number;
  breadcrumbs?: Breadcrumb[];
}

/**
 * Breadcrumb for tracking request flow
 */
export interface Breadcrumb {
  timestamp: number;
  category: string;
  message: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}

/**
 * Add correlation ID and request tracking to incoming requests
 */
export function requestCorrelationMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const correlatedReq = req as CorrelatedRequest;
    
    // Generate or use existing request ID
    correlatedReq.requestId = 
      (req.headers['x-request-id'] as string) || 
      randomUUID();
    
    // Generate or use existing correlation ID (for distributed tracing)
    correlatedReq.correlationId = 
      (req.headers['x-correlation-id'] as string) || 
      randomUUID();
    
    // Track request start time
    correlatedReq.startTime = Date.now();
    
    // Initialize breadcrumbs array
    correlatedReq.breadcrumbs = [];
    
    // Add correlation headers to response
    res.setHeader('X-Request-Id', correlatedReq.requestId);
    res.setHeader('X-Correlation-Id', correlatedReq.correlationId);
    
    // Log request start
    logger.debug('Request started', {
      requestId: correlatedReq.requestId,
      correlationId: correlatedReq.correlationId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    // Add breadcrumb
    addBreadcrumb(correlatedReq, {
      category: 'http',
      message: `${req.method} ${req.path}`,
      level: 'info',
      data: {
        method: req.method,
        path: req.path,
        query: sanitizeQueryParams(req.query),
      },
    });
    
    // Track response completion time for all response types
    res.on('finish', () => {
      const duration = Date.now() - correlatedReq.startTime;

      logger.debug('Request completed', {
        requestId: correlatedReq.requestId,
        correlationId: correlatedReq.correlationId,
        duration,
        statusCode: res.statusCode,
      });
    });

    // Run the rest of the middleware/handler chain inside AsyncLocalStorage
    // so any downstream code can call getRequestContext() / getCorrelationMeta()
    requestContextStorage.run(
      {
        requestId: correlatedReq.requestId,
        correlationId: correlatedReq.correlationId,
        startTime: correlatedReq.startTime,
      },
      next,
    );
  };
}

/**
 * Add a breadcrumb to the request for error context
 */
export function addBreadcrumb(
  req: Request,
  breadcrumb: Omit<Breadcrumb, 'timestamp'>
): void {
  const correlatedReq = req as CorrelatedRequest;
  
  if (!correlatedReq.breadcrumbs) {
    correlatedReq.breadcrumbs = [];
  }
  
  correlatedReq.breadcrumbs.push({
    timestamp: Date.now(),
    ...breadcrumb,
  });
  
  // Keep only last 50 breadcrumbs
  if (correlatedReq.breadcrumbs.length > 50) {
    correlatedReq.breadcrumbs = correlatedReq.breadcrumbs.slice(-50);
  }
}

/**
 * Get breadcrumbs from request
 */
export function getBreadcrumbs(req: Request): Breadcrumb[] {
  const correlatedReq = req as CorrelatedRequest;
  return correlatedReq.breadcrumbs || [];
}

/**
 * Get request correlation data
 */
export function getCorrelationData(req: Request): {
  requestId: string;
  correlationId: string;
  duration?: number;
} {
  const correlatedReq = req as CorrelatedRequest;
  
  return {
    requestId: correlatedReq.requestId || 'unknown',
    correlationId: correlatedReq.correlationId || 'unknown',
    duration: correlatedReq.startTime 
      ? Date.now() - correlatedReq.startTime 
      : undefined,
  };
}
