import { ApiError } from '../../../middleware/errorHandlerV2';
import { ApiErrorCode } from '../../../types/api';

import {
  mapStatusToApiErrorCode,
  normalizeApiError,
  resolveErrorStatus,
  sendFleetErrorResponse,
} from '../fleetController.errors';

jest.mock('../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import { logger } from '../../../utils/logger';

describe('fleetController.errors', () => {
  describe('resolveErrorStatus', () => {
    it('returns status from ApiError instance', () => {
      const error = new ApiError(ApiErrorCode.INVALID_INPUT, 'bad input', 400);

      expect(resolveErrorStatus(error)).toBe(400);
    });

    it('returns statusCode from plain object errors', () => {
      expect(resolveErrorStatus({ statusCode: 409 })).toBe(409);
    });

    it('falls back to 500 for unknown errors', () => {
      expect(resolveErrorStatus(new Error('boom'))).toBe(500);
      expect(resolveErrorStatus(null)).toBe(500);
    });
  });

  describe('mapStatusToApiErrorCode', () => {
    it('maps known HTTP statuses', () => {
      expect(mapStatusToApiErrorCode(400)).toBe(ApiErrorCode.INVALID_INPUT);
      expect(mapStatusToApiErrorCode(401)).toBe(ApiErrorCode.UNAUTHORIZED);
      expect(mapStatusToApiErrorCode(403)).toBe(ApiErrorCode.FORBIDDEN);
      expect(mapStatusToApiErrorCode(404)).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      expect(mapStatusToApiErrorCode(409)).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });

    it('maps unknown statuses to INTERNAL_ERROR', () => {
      expect(mapStatusToApiErrorCode(418)).toBe(ApiErrorCode.INTERNAL_ERROR);
      expect(mapStatusToApiErrorCode(500)).toBe(ApiErrorCode.INTERNAL_ERROR);
    });
  });

  describe('normalizeApiError', () => {
    it('returns ApiError instances unchanged', () => {
      const existing = new ApiError(ApiErrorCode.FORBIDDEN, 'forbidden', 403);

      expect(normalizeApiError(existing, 'fallback')).toBe(existing);
    });

    it('normalizes unknown errors with fallback mapping', () => {
      const normalized = normalizeApiError(
        { statusCode: 404, message: 'missing' },
        'Failed to load fleet'
      );

      expect(normalized).toBeInstanceOf(ApiError);
      expect(normalized.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      expect(normalized.statusCode).toBe(404);
      expect(normalized.message).toBe('missing');
    });

    it('respects valid explicit API error code from unknown error object', () => {
      const normalized = normalizeApiError(
        { statusCode: 409, message: 'conflict', code: ApiErrorCode.FLEET_NOT_FOUND },
        'fallback'
      );

      expect(normalized.code).toBe(ApiErrorCode.FLEET_NOT_FOUND);
      expect(normalized.statusCode).toBe(409);
      expect(normalized.message).toBe('conflict');
    });

    it('ignores invalid explicit code and falls back to status mapping', () => {
      const normalized = normalizeApiError(
        { statusCode: 401, message: 'unauthorized', code: 'NOT_REAL' },
        'fallback'
      );

      expect(normalized.code).toBe(ApiErrorCode.UNAUTHORIZED);
      expect(normalized.statusCode).toBe(401);
      expect(normalized.message).toBe('unauthorized');
    });
  });

  describe('sendFleetErrorResponse', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const createResponse = () => {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      return { status, json };
    };

    it('resolves status and emits standardized fleet error body', () => {
      const { status, json } = createResponse();

      sendFleetErrorResponse(
        { status } as unknown as Parameters<typeof sendFleetErrorResponse>[0],
        { statusCode: 404, message: 'missing' }
      );

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'FLEET_ERROR', message: 'missing' },
      });
    });

    it('honors forced status code and logs when configured', () => {
      const { status } = createResponse();

      sendFleetErrorResponse(
        { status } as unknown as Parameters<typeof sendFleetErrorResponse>[0],
        new Error('boom'),
        {
          forceStatusCode: 500,
          logAtOrAboveStatus: 0,
          logMessage: 'Crew position unselect failed',
          path: '/api/v2/fleets/1/crew/select',
        }
      );

      expect(status).toHaveBeenCalledWith(500);
      expect(logger.error).toHaveBeenCalledWith('Crew position unselect failed', {
        error: 'boom',
        path: '/api/v2/fleets/1/crew/select',
      });
    });

    it('merges additional log context when provided', () => {
      const { status } = createResponse();

      sendFleetErrorResponse(
        { status } as unknown as Parameters<typeof sendFleetErrorResponse>[0],
        new Error('failed'),
        {
          logAtOrAboveStatus: 0,
          logMessage: 'Fleet deletion failed',
          path: '/api/v2/fleets/1',
          logContext: { timings: { total: 42 } },
        }
      );

      expect(logger.error).toHaveBeenCalledWith('Fleet deletion failed', {
        error: 'failed',
        path: '/api/v2/fleets/1',
        timings: { total: 42 },
      });
    });

    it('does not log when status is below threshold', () => {
      const { status } = createResponse();

      sendFleetErrorResponse(
        { status } as unknown as Parameters<typeof sendFleetErrorResponse>[0],
        { statusCode: 400, message: 'invalid' },
        {
          logMessage: 'Get fleet crew members failed',
          logAtOrAboveStatus: 500,
          path: '/api/v2/fleets/1/crew/members',
        }
      );

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
