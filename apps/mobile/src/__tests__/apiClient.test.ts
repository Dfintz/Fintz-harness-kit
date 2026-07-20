import axios from 'axios';
import {
  ApiClient,
  ApiClientError,
  getErrorMessage,
  isApiClientError,
  isNetworkError,
} from '../services/apiClient';

// Mock axios
jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockAxiosInstance),
    },
    AxiosHeaders: jest.fn(),
  };
});

jest.mock('../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../utils/storage', () => ({
  getStoredValue: jest.fn().mockResolvedValue(null),
  removeStoredValue: jest.fn().mockResolvedValue(undefined),
}));

describe('ApiClientError', () => {
  it('should create an error with all fields', () => {
    const error = new ApiClientError('Not found', 'NOT_FOUND', 404, 'req-123', { id: '1' }, false);

    expect(error.message).toBe('Not found');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.requestId).toBe('req-123');
    expect(error.details).toEqual({ id: '1' });
    expect(error.isRetryable).toBe(false);
    expect(error.name).toBe('ApiClientError');
    expect(error instanceof Error).toBe(true);
  });

  it('should default isRetryable to false', () => {
    const error = new ApiClientError('err', 'CODE', 500);
    expect(error.isRetryable).toBe(false);
  });
});

describe('isApiClientError', () => {
  it('should return true for ApiClientError instances', () => {
    const error = new ApiClientError('test', 'TEST', 400);
    expect(isApiClientError(error)).toBe(true);
  });

  it('should return false for regular errors', () => {
    expect(isApiClientError(new Error('test'))).toBe(false);
    expect(isApiClientError('string error')).toBe(false);
    expect(isApiClientError(null)).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('should extract message from ApiClientError', () => {
    const error = new ApiClientError('Custom message', 'CODE', 400);
    expect(getErrorMessage(error)).toBe('Custom message');
  });

  it('should extract message from regular Error', () => {
    expect(getErrorMessage(new Error('regular'))).toBe('regular');
  });

  it('should return default for unknown types', () => {
    expect(getErrorMessage(42)).toBe('An unexpected error occurred');
    expect(getErrorMessage(null)).toBe('An unexpected error occurred');
  });
});

describe('isNetworkError', () => {
  it('should return true for network errors', () => {
    const error = new ApiClientError('Network error', 'NETWORK_ERROR', 0);
    expect(isNetworkError(error)).toBe(true);
  });

  it('should return false for non-network errors', () => {
    const error = new ApiClientError('Not found', 'NOT_FOUND', 404);
    expect(isNetworkError(error)).toBe(false);
  });

  it('should return false for non-ApiClientError', () => {
    expect(isNetworkError(new Error('test'))).toBe(false);
  });
});

describe('ApiClient', () => {
  it('should create an instance with default config', () => {
    void new ApiClient();
    expect(axios.create).toHaveBeenCalled();
  });

  it('should accept custom baseURL', () => {
    void new ApiClient({ baseURL: 'https://api.example.com' });
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'https://api.example.com' })
    );
  });

  it('should allow setting token provider', () => {
    const client = new ApiClient();
    const provider = () => 'test-token';
    // Should not throw
    client.setTokenProvider(provider);
  });

  it('should provide retry config', () => {
    const client = new ApiClient({ retry: { maxRetries: 5 } });
    const config = client.getRetryConfig();
    expect(config.maxRetries).toBe(5);
    expect(config.baseDelay).toBe(1000); // default
  });

  it('should create skipRetry config', () => {
    const config = ApiClient.skipRetry({ timeout: 5000 });
    expect(config.__skipRetry).toBe(true);
    expect(config.timeout).toBe(5000);
  });
});
