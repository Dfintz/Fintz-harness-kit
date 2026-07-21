import { Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

/**
 * Extract HTTP status code from an error, supporting both ApiError classes
 * (errorHandlerV2.ApiError and apiErrors.ApiError/NotFoundError/etc.)
 */
export function resolveErrorStatus(error: unknown): number {
  if (error instanceof ApiError) {
    return error.statusCode;
  }
  if (
    error !== null &&
    typeof error === 'object' &&
    'statusCode' in error &&
    typeof (error as Record<string, unknown>).statusCode === 'number'
  ) {
    return (error as { statusCode: number }).statusCode;
  }
  return 500;
}

export function mapStatusToApiErrorCode(statusCode: number): ApiErrorCode {
  switch (statusCode) {
    case 400:
      return ApiErrorCode.INVALID_INPUT;
    case 401:
      return ApiErrorCode.UNAUTHORIZED;
    case 403:
      return ApiErrorCode.FORBIDDEN;
    case 404:
      return ApiErrorCode.RESOURCE_NOT_FOUND;
    case 409:
      return ApiErrorCode.RESOURCE_CONFLICT;
    default:
      return ApiErrorCode.INTERNAL_ERROR;
  }
}

export function normalizeApiError(error: unknown, fallbackMessage: string): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  const statusCode = resolveErrorStatus(error);
  const message = getErrorMessage(error, fallbackMessage);
  const codeValue =
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string'
      ? ((error as { code: string }).code as ApiErrorCode)
      : undefined;

  const resolvedCode =
    codeValue && Object.values(ApiErrorCode).includes(codeValue)
      ? codeValue
      : mapStatusToApiErrorCode(statusCode);

  return new ApiError(resolvedCode, message, statusCode);
}

export interface FleetErrorResponseOptions {
  fallbackMessage?: string;
  forceStatusCode?: number;
  logAtOrAboveStatus?: number;
  logMessage?: string;
  path?: string;
  logContext?: Record<string, unknown>;
}

export function sendFleetErrorResponse(
  res: Response,
  error: unknown,
  options?: FleetErrorResponseOptions
): void {
  const statusCode = options?.forceStatusCode ?? resolveErrorStatus(error);
  const message = getErrorMessage(error, options?.fallbackMessage);

  if (options?.logMessage && statusCode >= (options?.logAtOrAboveStatus ?? 500)) {
    const logPayload = options.logContext
      ? {
          error: message,
          path: options.path,
          ...options.logContext,
        }
      : {
          error: message,
          path: options.path,
        };

    logger.error(options.logMessage, logPayload);
  }

  res.status(statusCode).json({ success: false, error: { code: 'FLEET_ERROR', message } });
}

export function sendFleetInternalErrorResponse(
  res: Response,
  error: unknown,
  logMessage: string,
  path?: string
): void {
  sendFleetErrorResponse(res, error, {
    forceStatusCode: 500,
    logAtOrAboveStatus: 0,
    logMessage,
    path,
  });
}

export function sendFleetLoggedErrorResponse(
  res: Response,
  error: unknown,
  logMessage: string,
  path?: string
): void {
  sendFleetErrorResponse(res, error, {
    logMessage,
    path,
  });
}

export function rethrowApiOrSendFleetInternalErrorResponse(
  res: Response,
  error: unknown,
  logMessage: string,
  path?: string
): void {
  if (error instanceof ApiError) {
    throw error;
  }

  sendFleetInternalErrorResponse(res, error, logMessage, path);
}

export function sendFleetDefaultErrorResponse(res: Response, error: unknown): void {
  sendFleetErrorResponse(res, error);
}

export function throwIfFleetAggregatorFailed(
  result: { success: boolean; error?: unknown },
  fallbackMessage: string
): void {
  if (!result.success) {
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(result.error, fallbackMessage),
      500
    );
  }
}
