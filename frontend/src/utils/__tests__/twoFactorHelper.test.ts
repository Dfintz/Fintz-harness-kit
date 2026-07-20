import { clear2FACode, executeWith2FA, is2FAError, set2FACode } from '@/utils/twoFactorHelper';
import axios from 'axios';

jest.mock('axios');

describe('twoFactorHelper', () => {
  beforeEach(() => {
    // Clear axios defaults before each test
    axios.defaults.headers.common = {};
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('set2FACode', () => {
    it('sets 2FA code in axios headers', () => {
      const code = '123456';
      set2FACode(code);

      expect(axios.defaults.headers.common['X-2FA-Code']).toBe('123456');
    });

    it('requires 6-digit code', () => {
      const shortCode = '123';
      set2FACode(shortCode);

      expect(axios.defaults.headers.common['X-2FA-Code']).toBeUndefined();
    });

    it('does not set code if too long', () => {
      const longCode = '1234567';
      set2FACode(longCode);

      expect(axios.defaults.headers.common['X-2FA-Code']).toBeUndefined();
    });

    it('does not set code if empty', () => {
      set2FACode('');

      expect(axios.defaults.headers.common['X-2FA-Code']).toBeUndefined();
    });

    it('accepts numeric string codes', () => {
      set2FACode('000000');

      expect(axios.defaults.headers.common['X-2FA-Code']).toBe('000000');
    });

    it('accepts alphanumeric codes', () => {
      set2FACode('ABC123');

      expect(axios.defaults.headers.common['X-2FA-Code']).toBe('ABC123');
    });
  });

  describe('clear2FACode', () => {
    it('removes 2FA code from axios headers', () => {
      set2FACode('123456');
      expect(axios.defaults.headers.common['X-2FA-Code']).toBe('123456');

      clear2FACode();

      expect(axios.defaults.headers.common['X-2FA-Code']).toBeUndefined();
    });

    it('handles clearing when code not set', () => {
      expect(() => clear2FACode()).not.toThrow();
      expect(axios.defaults.headers.common['X-2FA-Code']).toBeUndefined();
    });

    it('only removes 2FA header, preserves others', () => {
      axios.defaults.headers.common['Authorization'] = 'Bearer token';
      set2FACode('123456');

      clear2FACode();

      expect(axios.defaults.headers.common['Authorization']).toBe('Bearer token');
      expect(axios.defaults.headers.common['X-2FA-Code']).toBeUndefined();
    });
  });

  describe('executeWith2FA', () => {
    it('executes API call with 2FA code', async () => {
      const mockApiCall = jest.fn().mockResolvedValue({ success: true });
      const code = '123456';

      await executeWith2FA(code, mockApiCall);

      expect(axios.defaults.headers.common['X-2FA-Code']).toBeUndefined(); // Cleared after
      expect(mockApiCall).toHaveBeenCalled();
    });

    it('executes API call without 2FA code', async () => {
      const mockApiCall = jest.fn().mockResolvedValue({ success: true });

      const result = await executeWith2FA(null, mockApiCall);

      expect(result).toEqual({ success: true });
      expect(mockApiCall).toHaveBeenCalled();
      expect(axios.defaults.headers.common['X-2FA-Code']).toBeUndefined();
    });

    it('clears 2FA code after successful call', async () => {
      const mockApiCall = jest.fn().mockResolvedValue({ data: 'success' });
      const code = '123456';

      await executeWith2FA(code, mockApiCall);

      expect(axios.defaults.headers.common['X-2FA-Code']).toBeUndefined();
    });

    it('clears 2FA code after failed call', async () => {
      const mockApiCall = jest.fn().mockRejectedValue(new Error('API Error'));
      const code = '123456';

      await expect(executeWith2FA(code, mockApiCall)).rejects.toThrow('API Error');

      expect(axios.defaults.headers.common['X-2FA-Code']).toBeUndefined();
    });

    it('returns API call result', async () => {
      const mockData = { user: 'test', id: 123 };
      const mockApiCall = jest.fn().mockResolvedValue(mockData);

      const result = await executeWith2FA('123456', mockApiCall);

      expect(result).toEqual(mockData);
    });

    it('sets code before API call', async () => {
      let codeWasSet = false;
      const mockApiCall = jest.fn().mockImplementation(() => {
        codeWasSet = axios.defaults.headers.common['X-2FA-Code'] === '123456';
        return Promise.resolve({ success: true });
      });

      await executeWith2FA('123456', mockApiCall);

      expect(codeWasSet).toBe(true);
    });

    it('handles async API calls', async () => {
      const mockApiCall = jest
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve({ data: 'async' }), 10))
        );

      const result = await executeWith2FA('123456', mockApiCall);

      expect(result).toEqual({ data: 'async' });
      expect(axios.defaults.headers.common['X-2FA-Code']).toBeUndefined();
    });

    it('preserves error details', async () => {
      const mockError = {
        response: { status: 403, data: { error: '2FA required' } },
      };
      const mockApiCall = jest.fn().mockRejectedValue(mockError);

      await expect(executeWith2FA('123456', mockApiCall)).rejects.toEqual(mockError);
    });
  });

  describe('is2FAError', () => {
    it('identifies 2FA error with "2fa" in message', () => {
      const error = {
        response: {
          status: 403,
          data: { error: '2FA verification required' },
        },
      };

      expect(is2FAError(error)).toBe(true);
    });

    it('identifies 2FA error with "two-factor" in message', () => {
      const error = {
        response: {
          status: 403,
          data: { error: 'Two-Factor authentication required' },
        },
      };

      expect(is2FAError(error)).toBe(true);
    });

    it('returns false for non-403 errors', () => {
      const error = {
        response: {
          status: 401,
          data: { error: '2FA required' },
        },
      };

      expect(is2FAError(error)).toBe(false);
    });

    it('returns false for 403 without 2FA message', () => {
      const error = {
        response: {
          status: 403,
          data: { error: 'Forbidden' },
        },
      };

      expect(is2FAError(error)).toBe(false);
    });

    it('handles missing response', () => {
      const error = { message: '2FA required' };

      expect(is2FAError(error)).toBe(false);
    });

    it('handles missing error data', () => {
      const error = {
        response: { status: 403 },
      };

      expect(is2FAError(error)).toBe(false);
    });

    it('handles null error', () => {
      expect(is2FAError(null)).toBe(false);
    });

    it('handles undefined error', () => {
      expect(is2FAError(undefined)).toBe(false);
    });

    it('is case-insensitive for 2FA detection', () => {
      const error1 = {
        response: { status: 403, data: { error: '2FA REQUIRED' } },
      };
      const error2 = {
        response: { status: 403, data: { error: 'Two-FACTOR needed' } },
      };

      expect(is2FAError(error1)).toBe(true);
      expect(is2FAError(error2)).toBe(true);
    });

    it('detects 2FA in various message formats', () => {
      const errors = [
        { response: { status: 403, data: { error: 'Please provide 2FA code' } } },
        { response: { status: 403, data: { error: 'two-factor authentication failed' } } },
        { response: { status: 403, data: { error: 'Invalid 2fa token' } } },
      ];

      errors.forEach(error => {
        expect(is2FAError(error)).toBe(true);
      });
    });
  });

  describe('integration scenarios', () => {
    it('handles complete 2FA flow', async () => {
      const mockApiCall = jest.fn().mockResolvedValue({ authenticated: true });
      const code = '123456';

      // Execute with 2FA
      const result = await executeWith2FA(code, mockApiCall);

      // Verify result
      expect((result as any).authenticated).toBe(true);

      // Verify code was cleared
      expect(axios.defaults.headers.common['X-2FA-Code']).toBeUndefined();
    });

    it('handles retry after 2FA error', async () => {
      const firstCall = jest.fn().mockRejectedValue({
        response: { status: 403, data: { error: '2FA required' } },
      });

      const secondCall = jest.fn().mockResolvedValue({ success: true });

      // First call fails with 2FA error
      try {
        await executeWith2FA(null, firstCall);
      } catch (error) {
        expect(is2FAError(error)).toBe(true);
      }

      // Second call succeeds with 2FA code
      const result = await executeWith2FA('123456', secondCall);
      expect((result as any).success).toBe(true);
    });

    it('handles multiple sequential 2FA calls', async () => {
      const call1 = jest.fn().mockResolvedValue({ data: 1 });
      const call2 = jest.fn().mockResolvedValue({ data: 2 });
      const call3 = jest.fn().mockResolvedValue({ data: 3 });

      const result1 = await executeWith2FA('123456', call1);
      const result2 = await executeWith2FA('654321', call2);
      const result3 = await executeWith2FA('111111', call3);

      expect((result1 as any).data).toBe(1);
      expect((result2 as any).data).toBe(2);
      expect((result3 as any).data).toBe(3);
      expect(axios.defaults.headers.common['X-2FA-Code']).toBeUndefined();
    });
  });
});
