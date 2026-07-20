import {
  getAxiosErrorInfo,
  getErrorMessage,
  handleFetchError,
  isAxiosError,
  isError,
  toError,
} from '../utils/errorHandling';

jest.mock('../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('errorHandling', () => {
  describe('isError', () => {
    it('should return true for Error instances', () => {
      expect(isError(new Error('test'))).toBe(true);
      expect(isError(new TypeError('test'))).toBe(true);
    });

    it('should return false for non-errors', () => {
      expect(isError('string')).toBe(false);
      expect(isError(42)).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
    });
  });

  describe('isAxiosError', () => {
    it('should return true for objects with response property', () => {
      expect(isAxiosError({ response: { status: 404 } })).toBe(true);
    });

    it('should return false for non-axios errors', () => {
      expect(isAxiosError(new Error('test'))).toBe(false);
      expect(isAxiosError(null)).toBe(false);
      expect(isAxiosError('string')).toBe(false);
    });
  });

  describe('toError', () => {
    it('should return Error as-is', () => {
      const err = new Error('test');
      expect(toError(err)).toBe(err);
    });

    it('should wrap strings', () => {
      const result = toError('string error');
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('string error');
    });

    it('should wrap other types', () => {
      const result = toError(42);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('42');
    });
  });

  describe('getErrorMessage', () => {
    it('should extract from Error', () => {
      expect(getErrorMessage(new Error('hello'))).toBe('hello');
    });

    it('should extract from string', () => {
      expect(getErrorMessage('direct string')).toBe('direct string');
    });

    it('should extract from axios-like error', () => {
      const axiosErr = { response: { data: { message: 'Not found' } } };
      expect(getErrorMessage(axiosErr)).toBe('Not found');
    });

    it('should return default for unknown', () => {
      expect(getErrorMessage(42)).toBe('An unexpected error occurred');
    });
  });

  describe('getAxiosErrorInfo', () => {
    it('should extract from axios error response', () => {
      const err = { response: { status: 404, data: { message: 'Not found', code: 'NOT_FOUND' } } };
      const info = getAxiosErrorInfo(err);
      expect(info.message).toBe('Not found');
      expect(info.code).toBe('NOT_FOUND');
      expect(info.status).toBe(404);
    });

    it('should handle Error instances', () => {
      const info = getAxiosErrorInfo(new Error('plain error'));
      expect(info.message).toBe('plain error');
    });

    it('should handle unknown types', () => {
      const info = getAxiosErrorInfo(42);
      expect(info.message).toBe('An unexpected error occurred');
    });
  });

  describe('handleFetchError', () => {
    it('should detect network errors', () => {
      const err = new TypeError('Network request failed');
      const result = handleFetchError(err, 'Test');
      expect(result.isNetworkError).toBe(true);
      expect(result.message).toContain('Cannot connect');
    });

    it('should handle regular errors', () => {
      const result = handleFetchError(new Error('Server error'), 'Test');
      expect(result.isNetworkError).toBe(false);
      expect(result.message).toBe('Server error');
    });

    it('should handle unknown error types', () => {
      const result = handleFetchError(42, 'Test');
      expect(result.isNetworkError).toBe(false);
      expect(result.message).toBe('Test failed');
    });
  });
});
