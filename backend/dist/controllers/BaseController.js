"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseController = void 0;
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
class BaseController {
    async execute(req, res, action) {
        try {
            await action(req, res);
        }
        catch (error) {
            this.handleError(res, error);
        }
    }
    async executeAndReturn(req, res, action, statusCode = 200) {
        try {
            const data = await action(req);
            res.status(statusCode).json(data);
        }
        catch (error) {
            this.handleError(res, error);
        }
    }
    async executeWithPagination(req, res, action) {
        try {
            const page = Number.parseInt(req.query.page, 10) || 1;
            const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 100);
            const result = await action(req, page, limit);
            res.status(200).json({
                success: true,
                data: result.data,
                meta: {
                    total: result.total,
                    page: result.page,
                    limit: result.limit,
                    totalPages: result.totalPages,
                },
            });
        }
        catch (error) {
            this.handleError(res, error);
        }
    }
    handleError(res, error, defaultMessage) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        let statusCode = 500;
        let message = defaultMessage || 'An unexpected error occurred';
        if (error instanceof apiErrors_1.ApiError) {
            statusCode = error.statusCode;
            message = error.message || message;
        }
        else if (error instanceof Error) {
            const errorName = error.name;
            const errorMessage = error.message || 'An unexpected error occurred';
            const errorWithStatusCode = error;
            if (errorName === 'ValidationError') {
                statusCode = 400;
                message = errorMessage || 'Validation failed';
            }
            else if (errorName === 'UnauthorizedError' || errorMessage.includes('Unauthorized')) {
                statusCode = 401;
                message = 'Unauthorized access';
            }
            else if (errorName === 'ForbiddenError' || errorMessage.includes('Forbidden')) {
                statusCode = 403;
                message = 'Access forbidden';
            }
            else if (errorName === 'NotFoundError' || errorMessage.includes('not found')) {
                statusCode = 404;
                message = errorMessage || 'Resource not found';
            }
            else if (errorName === 'ConflictError') {
                statusCode = 409;
                message = errorMessage || 'Resource conflict';
            }
            else if (errorWithStatusCode.statusCode) {
                statusCode = errorWithStatusCode.statusCode;
                message = errorMessage;
            }
            else {
                message = errorMessage;
            }
        }
        this.logControllerError(error, errorMessage, statusCode);
        const codeMap = {
            400: 'VALIDATION_ERROR',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
        };
        const code = (error instanceof apiErrors_1.ApiError && error.code) || codeMap[statusCode] || 'INTERNAL_ERROR';
        if (res.headersSent) {
            return;
        }
        res.status(statusCode).json({
            success: false,
            message,
            error: {
                code,
                message,
                ...(process.env.NODE_ENV !== 'production' &&
                    error instanceof Error && { stack: error.stack }),
            },
        });
    }
    logControllerError(error, errorMessage, statusCode) {
        if (statusCode >= 500) {
            logger_1.logger.error(`Controller error: ${errorMessage}`, {
                error: error instanceof Error ? error.stack : String(error),
                controller: this.constructor.name,
                statusCode,
            });
        }
        else {
            logger_1.logger.warn(`Controller client error: ${errorMessage}`, {
                controller: this.constructor.name,
                statusCode,
            });
        }
    }
    validateRequired(body, ...fields) {
        const missing = fields.filter(field => !body[field]);
        if (missing.length > 0) {
            throw new apiErrors_1.ValidationError(`Missing required fields: ${missing.join(', ')}`);
        }
    }
    validateQueryParams(query, ...params) {
        const missing = params.filter(param => !query[param]);
        if (missing.length > 0) {
            throw new apiErrors_1.ValidationError(`Missing required query parameters: ${missing.join(', ')}`);
        }
    }
    getAuthUser(req) {
        if (!req.user) {
            throw new apiErrors_1.UnauthorizedError('User not authenticated');
        }
        return req.user;
    }
    getOrganizationId(req) {
        const user = this.getAuthUser(req);
        if (!user.currentOrganizationId) {
            throw new apiErrors_1.ForbiddenError('No organization context set');
        }
        return user.currentOrganizationId;
    }
    requireRole(req, ...allowedRoles) {
        const user = this.getAuthUser(req);
        if (!allowedRoles.includes(user.role)) {
            throw new apiErrors_1.ForbiddenError(`Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`);
        }
    }
    sendSuccess(res, data, statusCode = 200) {
        res.status(statusCode).json(data);
    }
    sendMessage(res, message, statusCode = 200) {
        res.status(statusCode).json({ message });
    }
    getPaginationParams(req, defaultLimit = 20, maxLimit = 100) {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(Math.max(1, Number.parseInt(req.query.limit, 10) || defaultLimit), maxLimit);
        const offset = (page - 1) * limit;
        return { page, limit, offset };
    }
    createPaginatedResponse(data, total, page, limit) {
        const totalPages = Math.ceil(total / limit);
        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNext: page < totalPages,
                hasPrevious: page > 1,
            },
        };
    }
    verifyOrganizationMembership(req, organizationId) {
        const user = this.getAuthUser(req);
        if (user.currentOrganizationId !== organizationId) {
            throw new apiErrors_1.ForbiddenError('You do not have access to this organization. Please switch your organization context.');
        }
    }
}
exports.BaseController = BaseController;
//# sourceMappingURL=BaseController.js.map