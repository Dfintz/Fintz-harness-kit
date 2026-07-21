/**
 * API Errors Utility Test Suite
 * 
 * Tests for the standardized error handling utilities
 */

import { ApiErrorCode } from '../../types/api';
import {
    ApiError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
    RateLimitError,
    DatabaseError,
    ServiceUnavailableError,
    BadRequestError,
    OrganizationNotFoundError,
    OrganizationAccessDeniedError,
    FleetNotFoundError,
    ShipNotFoundError,
    ActivityNotFoundError,
    ActivityFullError,
    createValidationError,
    createNotFoundError,
    createDatabaseError,
    isApiError,
    isOperationalError,
    getErrorStatusCode,
    getErrorCode,
} from '../../utils/apiErrors';

describe('API Errors Utility', () => {
    describe('ApiError', () => {
        it('should create error with correct properties', () => {
            const error = new ApiError(
                ApiErrorCode.INTERNAL_ERROR,
                'Test error',
                500,
                { field: 'value' }
            );

            expect(error.message).toBe('Test error');
            expect(error.code).toBe(ApiErrorCode.INTERNAL_ERROR);
            expect(error.statusCode).toBe(500);
            expect(error.details).toEqual({ field: 'value' });
            expect(error.isOperational).toBe(true);
            expect(error.name).toBe('ApiError');
        });

        it('should default to 500 status code', () => {
            const error = new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Test');
            expect(error.statusCode).toBe(500);
        });

        it('should convert to JSON correctly', () => {
            const error = new ApiError(
                ApiErrorCode.VALIDATION_ERROR,
                'Invalid input',
                400,
                { field: 'email' }
            );

            expect(error.toJSON()).toEqual({
                code: ApiErrorCode.VALIDATION_ERROR,
                message: 'Invalid input',
                details: { field: 'email' },
            });
        });

        it('should not include details in JSON if not provided', () => {
            const error = new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Error');
            const json = error.toJSON();
            expect(json).not.toHaveProperty('details');
        });
    });

    describe('Specific Error Classes', () => {
        it('should create ValidationError', () => {
            const error = new ValidationError('Invalid email format', { field: 'email' });
            expect(error.name).toBe('ValidationError');
            expect(error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
            expect(error.statusCode).toBe(400);
        });

        it('should create NotFoundError with resource name and id', () => {
            const error = new NotFoundError('User', '123');
            expect(error.message).toBe("User with id '123' not found");
            expect(error.statusCode).toBe(404);
            expect(error.details).toEqual({ resource: 'User', id: '123' });
        });

        it('should create NotFoundError without id', () => {
            const error = new NotFoundError('User');
            expect(error.message).toBe('User not found');
        });

        it('should create UnauthorizedError', () => {
            const error = new UnauthorizedError();
            expect(error.statusCode).toBe(401);
            expect(error.message).toBe('Authentication required');
        });

        it('should create ForbiddenError', () => {
            const error = new ForbiddenError();
            expect(error.statusCode).toBe(403);
            expect(error.message).toBe('Access denied');
        });

        it('should create ConflictError', () => {
            const error = new ConflictError('Resource already exists');
            expect(error.statusCode).toBe(409);
            expect(error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
        });

        it('should create RateLimitError with retryAfter', () => {
            const error = new RateLimitError(60);
            expect(error.statusCode).toBe(429);
            expect(error.details).toEqual({ retryAfter: 60 });
        });

        it('should create DatabaseError', () => {
            const error = new DatabaseError();
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe(ApiErrorCode.DATABASE_ERROR);
        });

        it('should create ServiceUnavailableError', () => {
            const error = new ServiceUnavailableError();
            expect(error.statusCode).toBe(503);
        });

        it('should create BadRequestError', () => {
            const error = new BadRequestError('Invalid request');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe(ApiErrorCode.INVALID_INPUT);
        });
    });

    describe('Domain-specific Error Classes', () => {
        it('should create OrganizationNotFoundError', () => {
            const error = new OrganizationNotFoundError('org-123');
            expect(error.code).toBe(ApiErrorCode.ORG_NOT_FOUND);
            expect(error.message).toBe("Organization with id 'org-123' not found");
            expect(error.details).toEqual({ organizationId: 'org-123' });
        });

        it('should create OrganizationAccessDeniedError', () => {
            const error = new OrganizationAccessDeniedError('org-123');
            expect(error.code).toBe(ApiErrorCode.ORG_ACCESS_DENIED);
            expect(error.statusCode).toBe(403);
        });

        it('should create FleetNotFoundError', () => {
            const error = new FleetNotFoundError('fleet-123');
            expect(error.code).toBe(ApiErrorCode.FLEET_NOT_FOUND);
            expect(error.message).toBe("Fleet with id 'fleet-123' not found");
        });

        it('should create ShipNotFoundError', () => {
            const error = new ShipNotFoundError('ship-123');
            expect(error.code).toBe(ApiErrorCode.SHIP_NOT_FOUND);
        });

        it('should create ActivityNotFoundError', () => {
            const error = new ActivityNotFoundError('activity-123');
            expect(error.code).toBe(ApiErrorCode.ACTIVITY_NOT_FOUND);
        });

        it('should create ActivityFullError', () => {
            const error = new ActivityFullError('activity-123', 10);
            expect(error.code).toBe(ApiErrorCode.ACTIVITY_FULL);
            expect(error.statusCode).toBe(400);
            expect(error.details).toEqual({ activityId: 'activity-123', maxParticipants: 10 });
        });
    });

    describe('Error Factory Functions', () => {
        describe('createValidationError', () => {
            it('should create validation error from Joi-like error', () => {
                const joiError = {
                    details: [
                        { message: 'Email is required', path: ['email'] },
                        { message: 'Name must be at least 2 characters', path: ['name'] },
                    ],
                };

                const error = createValidationError(joiError);
                expect(error).toBeInstanceOf(ValidationError);
                expect(error.details).toEqual({
                    fields: {
                        email: 'Email is required',
                        name: 'Name must be at least 2 characters',
                    },
                });
            });

            it('should use single error message when only one error', () => {
                const joiError = {
                    details: [
                        { message: 'Email is required', path: ['email'] },
                    ],
                };

                const error = createValidationError(joiError);
                expect(error.message).toBe('Email is required');
            });
        });

        describe('createNotFoundError', () => {
            it('should create not found error', () => {
                const error = createNotFoundError('User', 'user-123');
                expect(error).toBeInstanceOf(NotFoundError);
                expect(error.message).toBe("User with id 'user-123' not found");
            });
        });

        describe('createDatabaseError', () => {
            const originalEnv = process.env.NODE_ENV;

            afterEach(() => {
                process.env.NODE_ENV = originalEnv;
            });

            it('should hide details in production', () => {
                process.env.NODE_ENV = 'production';
                const error = createDatabaseError(new Error('SQL syntax error near...'));
                expect(error.message).toBe('A database error occurred');
            });

            it('should show details in development', () => {
                process.env.NODE_ENV = 'development';
                const error = createDatabaseError(new Error('SQL syntax error'));
                expect(error.message).toBe('SQL syntax error');
            });
        });
    });

    describe('Type Guards', () => {
        describe('isApiError', () => {
            it('should return true for ApiError instances', () => {
                expect(isApiError(new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Test', 400))).toBe(true);
                expect(isApiError(new ValidationError('Test'))).toBe(true);
                expect(isApiError(new NotFoundError('Resource'))).toBe(true);
            });

            it('should return false for non-ApiError instances', () => {
                expect(isApiError(new Error('Test'))).toBe(false);
                expect(isApiError({ message: 'Test' })).toBe(false);
                expect(isApiError(null)).toBe(false);
            });
        });

        describe('isOperationalError', () => {
            it('should return true for operational errors', () => {
                expect(isOperationalError(new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Test', 400))).toBe(true);
            });

            it('should return false for non-ApiError', () => {
                expect(isOperationalError(new Error('Test'))).toBe(false);
            });
        });

        describe('getErrorStatusCode', () => {
            it('should return status code for ApiError', () => {
                expect(getErrorStatusCode(new ValidationError('Test'))).toBe(400);
                expect(getErrorStatusCode(new NotFoundError('Resource'))).toBe(404);
            });

            it('should return 500 for non-ApiError', () => {
                expect(getErrorStatusCode(new Error('Test'))).toBe(500);
            });
        });

        describe('getErrorCode', () => {
            it('should return code for ApiError', () => {
                expect(getErrorCode(new ValidationError('Test'))).toBe(ApiErrorCode.VALIDATION_ERROR);
            });

            it('should return INTERNAL_ERROR for non-ApiError', () => {
                expect(getErrorCode(new Error('Test'))).toBe(ApiErrorCode.INTERNAL_ERROR);
            });
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
