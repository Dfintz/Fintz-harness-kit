import { ApiErrorCode } from '../types/api';
export declare class ApiError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: Record<string, unknown>;
    readonly isOperational: boolean;
    constructor(code: ApiErrorCode | string, message: string, statusCode?: number, details?: Record<string, unknown>);
    toJSON(): {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}
export declare class ValidationError extends ApiError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class NotFoundError extends ApiError {
    constructor(resource: string, id?: string);
}
export declare class UnauthorizedError extends ApiError {
    constructor(message?: string, details?: Record<string, unknown>);
}
export declare class ForbiddenError extends ApiError {
    readonly permissionContext?: {
        resource: string;
        action: string;
        scope?: string;
        resourceId?: string;
    };
    constructor(message?: string, permissionContext?: {
        resource: string;
        action: string;
        scope?: string;
        resourceId?: string;
    });
}
export declare class ConflictError extends ApiError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class RateLimitError extends ApiError {
    constructor(retryAfter?: number);
}
export declare class DatabaseError extends ApiError {
    constructor(message?: string);
}
export declare class ServiceUnavailableError extends ApiError {
    constructor(message?: string);
}
export declare class BadRequestError extends ApiError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class OrganizationNotFoundError extends ApiError {
    constructor(orgId?: string);
}
export declare class OrganizationAccessDeniedError extends ApiError {
    constructor(orgId?: string);
}
export declare class FleetNotFoundError extends ApiError {
    constructor(fleetId?: string);
}
export declare class ShipNotFoundError extends ApiError {
    constructor(shipId?: string);
}
export declare class ActivityNotFoundError extends ApiError {
    constructor(activityId?: string);
}
export declare class ActivityFullError extends ApiError {
    constructor(activityId?: string, maxParticipants?: number);
}
export declare function createValidationError(joiError: {
    details: Array<{
        message: string;
        path: (string | number)[];
    }>;
}): ValidationError;
export declare function createNotFoundError(resource: string, id?: string): NotFoundError;
export declare function createDatabaseError(error: Error): DatabaseError;
export declare function isApiError(error: unknown): error is ApiError;
export declare function isOperationalError(error: unknown): boolean;
export declare function getErrorStatusCode(error: unknown): number;
export declare function getErrorCode(error: unknown): string;
//# sourceMappingURL=apiErrors.d.ts.map