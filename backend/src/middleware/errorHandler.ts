import { NextFunction, Request, Response } from 'express';

import { ErrorSeverity, errorTrackingService } from '../services/monitoring/ErrorTrackingService';
import { logger } from '../utils/logger';

/**
 * Async handler wrapper to catch errors in async route handlers
 * Usage: app.get('/route', asyncHandler(async (req, res) => { ... }))
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom error class for operational errors
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 * Should be added as the last middleware in the chain
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Default to 500 internal server error
  let statusCode = 500;
  let message = 'Internal server error';

  // Check if it's our custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // Log at a level proportional to severity: client errors (4xx) are routine
  // (404s from scanners/probes, validation/auth rejects) and must not raise error
  // alarms — only server errors (5xx) are logged at error level.
  const logContext = {
    message: err.message,
    statusCode,
    path: req.path,
    method: req.method,
    ...(statusCode >= 500 ? { stack: err.stack } : {}),
  };
  if (statusCode >= 500) {
    logger.error('Request error', logContext);
  } else {
    logger.warn('Request client error', logContext);
  }

  // Track error with Application Insights
  const severity = statusCode >= 500 ? ErrorSeverity.Error : ErrorSeverity.Warning;
  errorTrackingService.trackRequestError(err, req, {
    severity,
    context: {
      statusCode,
    },
  });

  // Send error response
  const errorResponse: { error: string; stack?: string; details?: string } = {
    error: message,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err.message;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 * Should be added after all routes but before error handler
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};
