"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = exports.AppError = exports.asyncHandler = void 0;
const ErrorTrackingService_1 = require("../services/monitoring/ErrorTrackingService");
const logger_1 = require("../utils/logger");
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
exports.asyncHandler = asyncHandler;
class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const errorHandler = (err, req, res, _next) => {
    let statusCode = 500;
    let message = 'Internal server error';
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    }
    else if (err.name === 'ValidationError') {
        statusCode = 400;
        message = err.message;
    }
    else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized';
    }
    else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
    }
    const logContext = {
        message: err.message,
        statusCode,
        path: req.path,
        method: req.method,
        ...(statusCode >= 500 ? { stack: err.stack } : {}),
    };
    if (statusCode >= 500) {
        logger_1.logger.error('Request error', logContext);
    }
    else {
        logger_1.logger.warn('Request client error', logContext);
    }
    const severity = statusCode >= 500 ? ErrorTrackingService_1.ErrorSeverity.Error : ErrorTrackingService_1.ErrorSeverity.Warning;
    ErrorTrackingService_1.errorTrackingService.trackRequestError(err, req, {
        severity,
        context: {
            statusCode,
        },
    });
    const errorResponse = {
        error: message,
    };
    if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
        errorResponse.details = err.message;
    }
    res.status(statusCode).json(errorResponse);
};
exports.errorHandler = errorHandler;
const notFoundHandler = (req, res, next) => {
    const error = new AppError(`Route ${req.originalUrl} not found`, 404);
    next(error);
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=errorHandler.js.map