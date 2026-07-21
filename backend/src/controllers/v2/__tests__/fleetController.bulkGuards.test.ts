import { ApiErrorCode } from '../../../types/api';

import {
  requireAuthenticatedUser,
  validateBulkDeleteRequest,
  validateBulkUpdateRequest,
} from '../fleetController.bulkGuards';

describe('fleetController.bulkGuards', () => {
  describe('requireAuthenticatedUser', () => {
    it('returns user id when present', () => {
      expect(requireAuthenticatedUser('user-1')).toBe('user-1');
    });

    it('throws unauthorized when user id is missing', () => {
      expect(() => requireAuthenticatedUser(undefined)).toThrow(
        expect.objectContaining({
          code: ApiErrorCode.UNAUTHORIZED,
          statusCode: 401,
          message: 'Authentication required',
        })
      );
    });
  });

  describe('validateBulkUpdateRequest', () => {
    it('accepts non-empty arrays up to limit', () => {
      expect(() => validateBulkUpdateRequest([{}, {}])).not.toThrow();
    });

    it('rejects empty or non-array payloads', () => {
      expect(() => validateBulkUpdateRequest(undefined)).toThrow(
        expect.objectContaining({
          code: ApiErrorCode.INVALID_INPUT,
          message: 'Updates array is required',
        })
      );
      expect(() => validateBulkUpdateRequest([])).toThrow(
        expect.objectContaining({
          code: ApiErrorCode.INVALID_INPUT,
          message: 'Updates array is required',
        })
      );
    });

    it('rejects payloads above the max bulk limit', () => {
      const overLimit = Array.from({ length: 101 }, () => ({}));

      expect(() => validateBulkUpdateRequest(overLimit)).toThrow(
        expect.objectContaining({
          code: ApiErrorCode.INVALID_INPUT,
          message: 'Maximum 100 members can be updated at once',
        })
      );
    });
  });

  describe('validateBulkDeleteRequest', () => {
    it('accepts non-empty arrays up to limit', () => {
      expect(() => validateBulkDeleteRequest([{}, {}])).not.toThrow();
    });

    it('rejects empty or non-array payloads', () => {
      expect(() => validateBulkDeleteRequest(undefined)).toThrow(
        expect.objectContaining({
          code: ApiErrorCode.INVALID_INPUT,
          message: 'items array is required (each entry must include fleetId and shipId)',
        })
      );
      expect(() => validateBulkDeleteRequest([])).toThrow(
        expect.objectContaining({
          code: ApiErrorCode.INVALID_INPUT,
          message: 'items array is required (each entry must include fleetId and shipId)',
        })
      );
    });

    it('rejects payloads above the max bulk limit', () => {
      const overLimit = Array.from({ length: 101 }, () => ({}));

      expect(() => validateBulkDeleteRequest(overLimit)).toThrow(
        expect.objectContaining({
          code: ApiErrorCode.INVALID_INPUT,
          message: 'Maximum 100 members can be deleted at once',
        })
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
