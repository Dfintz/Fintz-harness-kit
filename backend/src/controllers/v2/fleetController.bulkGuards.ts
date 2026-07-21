import { ApiError } from '../../middleware/errorHandlerV2';
import { ApiErrorCode } from '../../types/api';

const BULK_OPERATION_LIMIT = 100;

/** Require an authenticated user id for protected controller operations. */
export function requireAuthenticatedUser(userId: string | undefined): string {
  if (!userId) {
    throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
  }
  return userId;
}

/** Validate the top-level updates array for bulk member updates. */
export function validateBulkUpdateRequest(updates: unknown): asserts updates is unknown[] {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Updates array is required', 400);
  }

  if (updates.length > BULK_OPERATION_LIMIT) {
    throw new ApiError(
      ApiErrorCode.INVALID_INPUT,
      'Maximum 100 members can be updated at once',
      400
    );
  }
}

/** Validate the top-level items array for bulk member deletions. */
export function validateBulkDeleteRequest(items: unknown): asserts items is unknown[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(
      ApiErrorCode.INVALID_INPUT,
      'items array is required (each entry must include fleetId and shipId)',
      400
    );
  }

  if (items.length > BULK_OPERATION_LIMIT) {
    throw new ApiError(
      ApiErrorCode.INVALID_INPUT,
      'Maximum 100 members can be deleted at once',
      400
    );
  }
}
