import { Request, Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { ApiError, ForbiddenError, UnauthorizedError, ValidationError } from '../utils/apiErrors';
import { logger } from '../utils/logger';

/**
 * Base Controller
 * Provides common patterns for error handling, response formatting, and validation
 * Reduces code duplication across 46+ controllers
 */
export abstract class BaseController {
  /**
   * Execute a controller action with automatic error handling
   * @param req Express request
   * @param res Express response
   * @param action Async function to execute
   */
  protected async execute(
    req: Request | AuthRequest,
    res: Response,
    action: (req: Request | AuthRequest, res: Response) => Promise<void>
  ): Promise<void> {
    try {
      await action(req, res);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Execute an action and return a standardized success response
   * @param req Express request
   * @param res Express response
   * @param action Async function that returns data
   * @param statusCode HTTP status code (default: 200)
   */
  protected async executeAndReturn<T>(
    req: Request | AuthRequest,
    res: Response,
    action: (req: Request | AuthRequest) => Promise<T>,
    statusCode: number = 200
  ): Promise<void> {
    try {
      const data = await action(req);
      res.status(statusCode).json(data);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Execute an action with paginated results
   * @param req Express request
   * @param res Express response
   * @param action Async function that returns paginated data
   */
  protected async executeWithPagination<T>(
    req: Request | AuthRequest,
    res: Response,
    action: (
      req: Request | AuthRequest,
      page: number,
      limit: number
    ) => Promise<{
      data: T[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>
  ): Promise<void> {
    try {
      const page = Number.parseInt(req.query.page as string, 10) || 1;
      const limit = Math.min(Number.parseInt(req.query.limit as string, 10) || 20, 100); // Max 100 items

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
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Standardized error handler
   * @param res Express response
   * @param error Error object
   * @param defaultMessage Default error message
   */
  protected handleError(res: Response, error: unknown, defaultMessage?: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    let statusCode = 500;
    let message = defaultMessage || 'An unexpected error occurred';

    // Handle ApiError subclasses (preferred path)
    if (error instanceof ApiError) {
      statusCode = error.statusCode;
      message = error.message || message;
    } else if (error instanceof Error) {
      const errorName = error.name;
      const errorMessage = error.message || 'An unexpected error occurred';
      const errorWithStatusCode = error as Error & { statusCode?: number };

      if (errorName === 'ValidationError') {
        statusCode = 400;
        message = errorMessage || 'Validation failed';
      } else if (errorName === 'UnauthorizedError' || errorMessage.includes('Unauthorized')) {
        statusCode = 401;
        message = 'Unauthorized access';
      } else if (errorName === 'ForbiddenError' || errorMessage.includes('Forbidden')) {
        statusCode = 403;
        message = 'Access forbidden';
      } else if (errorName === 'NotFoundError' || errorMessage.includes('not found')) {
        statusCode = 404;
        message = errorMessage || 'Resource not found';
      } else if (errorName === 'ConflictError') {
        statusCode = 409;
        message = errorMessage || 'Resource conflict';
      } else if (errorWithStatusCode.statusCode) {
        statusCode = errorWithStatusCode.statusCode;
        message = errorMessage;
      } else {
        message = errorMessage;
      }
    }

    // Log at appropriate severity: 4xx client errors are not server failures
    this.logControllerError(error, errorMessage, statusCode);

    // Determine error code for structured error responses
    const codeMap: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
    };
    const code =
      (error instanceof ApiError && error.code) || codeMap[statusCode] || 'INTERNAL_ERROR';

    // Never attempt a second write if the action already responded (e.g. it
    // streamed/sent then threw). Logging above still happens; only the send is
    // guarded — mirrors the per-controller `if (!res.headersSent)` pattern.
    if (res.headersSent) {
      return;
    }

    // Send error response (message at top-level for backward compat + structured error object)
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

  /**
   * Log a controller error at the appropriate severity.
   * 5xx (and unknown) get full stack trace at error level.
   * 4xx client errors get a compact warn line — they are not server failures.
   */
  private logControllerError(error: unknown, errorMessage: string, statusCode: number): void {
    if (statusCode >= 500) {
      logger.error(`Controller error: ${errorMessage}`, {
        error: error instanceof Error ? error.stack : String(error),
        controller: this.constructor.name,
        statusCode,
      });
    } else {
      logger.warn(`Controller client error: ${errorMessage}`, {
        controller: this.constructor.name,
        statusCode,
      });
    }
  }

  /**
   * Validate required fields in request body
   * @param body Request body
   * @param fields Required field names
   * @throws ValidationError if any field is missing
   */
  protected validateRequired(body: Record<string, unknown>, ...fields: string[]): void {
    const missing = fields.filter(field => !body[field]);

    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Validate required query parameters
   * @param query Request query
   * @param params Required parameter names
   * @throws ValidationError if any parameter is missing
   */
  protected validateQueryParams(query: Record<string, unknown>, ...params: string[]): void {
    const missing = params.filter(param => !query[param]);

    if (missing.length > 0) {
      throw new ValidationError(`Missing required query parameters: ${missing.join(', ')}`);
    }
  }

  /**
   * Get authenticated user from request
   * @param req AuthRequest
   * @returns User object from token
   * @throws UnauthorizedError if user not authenticated
   */
  protected getAuthUser(req: AuthRequest): NonNullable<AuthRequest['user']> {
    if (!req.user) {
      throw new UnauthorizedError('User not authenticated');
    }
    return req.user;
  }

  /**
   * Get organization ID from authenticated user
   * @param req AuthRequest
   * @returns Current organization ID
   * @throws Error if organization not set
   */
  protected getOrganizationId(req: AuthRequest): string {
    const user = this.getAuthUser(req);

    if (!user.currentOrganizationId) {
      throw new ForbiddenError('No organization context set');
    }

    return user.currentOrganizationId;
  }

  /**
   * Check if user has required role
   * @param req AuthRequest
   * @param allowedRoles Array of allowed roles
   * @throws ForbiddenError if user doesn't have permission
   */
  protected requireRole(req: AuthRequest, ...allowedRoles: string[]): void {
    const user = this.getAuthUser(req);

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError(
        `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`
      );
    }
  }

  /**
   * Send success response with data
   * @param res Express response
   * @param data Response data
   * @param statusCode HTTP status code
   */
  protected sendSuccess<T>(res: Response, data: T, statusCode: number = 200): void {
    res.status(statusCode).json(data);
  }

  /**
   * Send success response with message
   * @param res Express response
   * @param message Success message
   * @param statusCode HTTP status code
   */
  protected sendMessage(res: Response, message: string, statusCode: number = 200): void {
    res.status(statusCode).json({ message });
  }

  /**
   * Parse pagination parameters from request
   * @param req Express request
   * @param defaultLimit Default page size
   * @param maxLimit Maximum page size
   */
  protected getPaginationParams(
    req: Request,
    defaultLimit: number = 20,
    maxLimit: number = 100
  ): { page: number; limit: number; offset: number } {
    const page = Math.max(1, Number.parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(
      Math.max(1, Number.parseInt(req.query.limit as string, 10) || defaultLimit),
      maxLimit
    );
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Create paginated response object
   * @param data Array of items
   * @param total Total count
   * @param page Current page
   * @param limit Items per page
   */
  protected createPaginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ): {
    data: T[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  } {
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

  /**
   * Verify that user is a member of the requested organization
   * @param req AuthRequest
   * @param organizationId Organization ID to verify membership
   * @throws ForbiddenError if user is not a member
   */
  protected verifyOrganizationMembership(req: AuthRequest, organizationId: string): void {
    const user = this.getAuthUser(req);

    // Check if user's current organization matches the requested organization
    // OR if they explicitly are requesting a different organization they're a member of
    // For now, we require the current organization context to match
    if (user.currentOrganizationId !== organizationId) {
      throw new ForbiddenError(
        'You do not have access to this organization. Please switch your organization context.'
      );
    }
  }
}
