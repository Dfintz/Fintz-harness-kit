"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = exports.errorHandlerV2 = void 0;
const api_1 = require("../types/api");
const logger_1 = require("../utils/logger");
const errorMappings = {
    EntityNotFoundError: { code: api_1.ApiErrorCode.RESOURCE_NOT_FOUND, status: 404 },
    QueryFailedError: { code: api_1.ApiErrorCode.DATABASE_ERROR, status: 500 },
    ValidationError: { code: api_1.ApiErrorCode.VALIDATION_ERROR, status: 400 },
    UnauthorizedError: { code: api_1.ApiErrorCode.UNAUTHORIZED, status: 401 },
    ForbiddenError: { code: api_1.ApiErrorCode.FORBIDDEN, status: 403 },
    ConflictError: { code: api_1.ApiErrorCode.RESOURCE_CONFLICT, status: 409 },
    NotFoundError: { code: api_1.ApiErrorCode.RESOURCE_NOT_FOUND, status: 404 },
    BadRequestError: { code: api_1.ApiErrorCode.INVALID_INPUT, status: 400 },
};
const errorHandlerV2 = (error, req, res, _next) => {
    const errorName = error.constructor?.name || 'Error';
    const mapped = errorMappings[errorName] || {
        code: api_1.ApiErrorCode.INTERNAL_ERROR,
        status: 500,
    };
    let code = mapped.code;
    let message = error.message || 'An error occurred';
    let details = error.details;
    let status = mapped.status;
    if (error.name === 'ValidationError' && error.errors) {
        code = api_1.ApiErrorCode.VALIDATION_ERROR;
        message = 'Validation failed';
        details = Object.keys(error.errors).map(key => ({
            field: key,
            message: error.errors[key].message,
        }));
        status = 400;
    }
    let requiresOrgSelection;
    if (message === 'Organization context required') {
        requiresOrgSelection = true;
    }
    if (error.code && Object.values(api_1.ApiErrorCode).includes(error.code)) {
        code = error.code;
        status = error.statusCode || status;
    }
    if (status === 500 && process.env.NODE_ENV === 'production') {
        message = 'An internal server error occurred';
        details = undefined;
    }
    const logContext = {
        requestId: req.id,
        path: req.path,
        method: req.method,
        error: error?.message,
        statusCode: status,
        userId: req.user?.id,
        organizationId: req.tenantContext?.organizationId,
        ...(status >= 500 ? { stack: error?.stack } : {}),
    };
    if (status >= 500) {
        logger_1.logger.error('API v2 error', logContext);
    }
    else {
        logger_1.logger.warn('API v2 client error', logContext);
    }
    return res.status(status).json({
        success: false,
        error: {
            code,
            message,
            details,
            ...(requiresOrgSelection ? { requiresOrgSelection: true } : {}),
            timestamp: new Date().toISOString(),
            requestId: req.id,
        },
    });
};
exports.errorHandlerV2 = errorHandlerV2;
var apiErrors_1 = require("../utils/apiErrors");
Object.defineProperty(exports, "ApiError", { enumerable: true, get: function () { return apiErrors_1.ApiError; } });
//# sourceMappingURL=errorHandlerV2.js.map