"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityFullError = exports.ActivityNotFoundError = exports.ShipNotFoundError = exports.FleetNotFoundError = exports.OrganizationAccessDeniedError = exports.OrganizationNotFoundError = exports.BadRequestError = exports.ServiceUnavailableError = exports.DatabaseError = exports.RateLimitError = exports.ConflictError = exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = exports.ApiError = void 0;
exports.createValidationError = createValidationError;
exports.createNotFoundError = createNotFoundError;
exports.createDatabaseError = createDatabaseError;
exports.isApiError = isApiError;
exports.isOperationalError = isOperationalError;
exports.getErrorStatusCode = getErrorStatusCode;
exports.getErrorCode = getErrorCode;
const api_1 = require("../types/api");
class ApiError extends Error {
    code;
    statusCode;
    details;
    isOperational;
    constructor(code, message, statusCode = 500, details) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            code: this.code,
            message: this.message,
            ...(this.details && { details: this.details }),
        };
    }
}
exports.ApiError = ApiError;
class ValidationError extends ApiError {
    constructor(message, details) {
        super(api_1.ApiErrorCode.VALIDATION_ERROR, message, 400, details);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends ApiError {
    constructor(resource, id) {
        const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
        super(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, message, 404, { resource, id });
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends ApiError {
    constructor(message = 'Authentication required', details) {
        super(api_1.ApiErrorCode.UNAUTHORIZED, message, 401, details);
        this.name = 'UnauthorizedError';
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends ApiError {
    permissionContext;
    constructor(message = 'Access denied', permissionContext) {
        const details = {};
        if (permissionContext) {
            details.permission = permissionContext;
            details.requiredPermission = `${permissionContext.resource}:${permissionContext.action}`;
        }
        super(api_1.ApiErrorCode.FORBIDDEN, message, 403, details);
        this.name = 'ForbiddenError';
        this.permissionContext = permissionContext;
    }
}
exports.ForbiddenError = ForbiddenError;
class ConflictError extends ApiError {
    constructor(message, details) {
        super(api_1.ApiErrorCode.RESOURCE_CONFLICT, message, 409, details);
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends ApiError {
    constructor(retryAfter) {
        super(api_1.ApiErrorCode.RATE_LIMIT_EXCEEDED, 'Too many requests. Please try again later.', 429, retryAfter ? { retryAfter } : undefined);
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
class DatabaseError extends ApiError {
    constructor(message = 'A database error occurred') {
        super(api_1.ApiErrorCode.DATABASE_ERROR, message, 500);
        this.name = 'DatabaseError';
    }
}
exports.DatabaseError = DatabaseError;
class ServiceUnavailableError extends ApiError {
    constructor(message = 'Service temporarily unavailable') {
        super(api_1.ApiErrorCode.SERVICE_UNAVAILABLE, message, 503);
        this.name = 'ServiceUnavailableError';
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
class BadRequestError extends ApiError {
    constructor(message, details) {
        super(api_1.ApiErrorCode.INVALID_INPUT, message, 400, details);
        this.name = 'BadRequestError';
    }
}
exports.BadRequestError = BadRequestError;
class OrganizationNotFoundError extends ApiError {
    constructor(orgId) {
        const message = orgId ? `Organization with id '${orgId}' not found` : 'Organization not found';
        super(api_1.ApiErrorCode.ORG_NOT_FOUND, message, 404, { organizationId: orgId });
        this.name = 'OrganizationNotFoundError';
    }
}
exports.OrganizationNotFoundError = OrganizationNotFoundError;
class OrganizationAccessDeniedError extends ApiError {
    constructor(orgId) {
        super(api_1.ApiErrorCode.ORG_ACCESS_DENIED, 'You do not have access to this organization', 403, orgId ? { organizationId: orgId } : undefined);
        this.name = 'OrganizationAccessDeniedError';
    }
}
exports.OrganizationAccessDeniedError = OrganizationAccessDeniedError;
class FleetNotFoundError extends ApiError {
    constructor(fleetId) {
        const message = fleetId ? `Fleet with id '${fleetId}' not found` : 'Fleet not found';
        super(api_1.ApiErrorCode.FLEET_NOT_FOUND, message, 404, { fleetId });
        this.name = 'FleetNotFoundError';
    }
}
exports.FleetNotFoundError = FleetNotFoundError;
class ShipNotFoundError extends ApiError {
    constructor(shipId) {
        const message = shipId ? `Ship with id '${shipId}' not found` : 'Ship not found';
        super(api_1.ApiErrorCode.SHIP_NOT_FOUND, message, 404, { shipId });
        this.name = 'ShipNotFoundError';
    }
}
exports.ShipNotFoundError = ShipNotFoundError;
class ActivityNotFoundError extends ApiError {
    constructor(activityId) {
        const message = activityId
            ? `Activity with id '${activityId}' not found`
            : 'Activity not found';
        super(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, message, 404, { activityId });
        this.name = 'ActivityNotFoundError';
    }
}
exports.ActivityNotFoundError = ActivityNotFoundError;
class ActivityFullError extends ApiError {
    constructor(activityId, maxParticipants) {
        super(api_1.ApiErrorCode.ACTIVITY_FULL, 'This activity has reached its maximum capacity', 400, {
            activityId,
            maxParticipants,
        });
        this.name = 'ActivityFullError';
    }
}
exports.ActivityFullError = ActivityFullError;
function createValidationError(joiError) {
    const details = {};
    joiError.details.forEach(detail => {
        const field = detail.path.join('.');
        details[field] = detail.message;
    });
    const message = joiError.details.length === 1
        ? joiError.details[0].message
        : 'Validation failed for multiple fields';
    return new ValidationError(message, { fields: details });
}
function createNotFoundError(resource, id) {
    return new NotFoundError(resource, id);
}
function createDatabaseError(error) {
    const message = process.env.NODE_ENV === 'production' ? 'A database error occurred' : error.message;
    return new DatabaseError(message);
}
function isApiError(error) {
    return error instanceof ApiError;
}
function isOperationalError(error) {
    return isApiError(error) && error.isOperational;
}
function getErrorStatusCode(error) {
    if (isApiError(error)) {
        return error.statusCode;
    }
    return 500;
}
function getErrorCode(error) {
    if (isApiError(error)) {
        return error.code;
    }
    return api_1.ApiErrorCode.INTERNAL_ERROR;
}
//# sourceMappingURL=apiErrors.js.map