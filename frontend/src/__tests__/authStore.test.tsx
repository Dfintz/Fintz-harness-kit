/**
 * Auth Store Tests
 * Tests for Zustand authentication store actions
 */

import { useAuthStore } from '@/store/authStore';
import axios from 'axios';
import { apiClient } from '@/services/apiClient';

// Mock error tracking service
jest.mock('../services/errorTracking', () => ({
  errorTrackingService: {
    trackError: jest.fn(),
  },
  ErrorSeverity: {
    Warning: 2,
    Error: 3,
    Critical: 4,
  },
}));

// Mock apiClient (the cookie-auth code path used by login/tryAuthWithCookies)
jest.mock('../services/apiClient', () => {
  const actual = jest.requireActual('../services/apiClient');
  return {
    ...actual,
    apiClient: {
      getRaw: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    },
  };
});
const mockedApiClient = apiClient as unknown as {
  getRaw: jest.Mock;
};

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  defaults: {
    headers: {
      common: {},
    },
    baseURL: '',
  },
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock crypto for encryption
Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: {
      importKey: jest.fn().mockResolvedValue({}),
      deriveKey: jest.fn().mockResolvedValue({}),
      encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(16)),
      decrypt: jest.fn().mockResolvedValue(new TextEncoder().encode('test')),
    },
    getRandomValues: jest.fn((arr: Uint8Array) => arr),
  },
});

describe('Auth Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      expiresAt: null,
      loading: false,
      error: null,
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.expiresAt).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('logout action', () => {
    it('should clear all auth state', async () => {
      // Set some initial state
      useAuthStore.setState({
        user: { id: '123', name: 'Test User' } as any,
        token: 'test-token',
        refreshToken: 'test-refresh-token',
        isAuthenticated: true,
        expiresAt: Date.now() + 3600000,
      });

      // Logout
      await useAuthStore.getState().logout();

      // Check state is cleared
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.expiresAt).toBeNull();
    });

    it('should clear axios authorization header', async () => {
      axios.defaults.headers.common['Authorization'] = 'Bearer test-token';

      await useAuthStore.getState().logout();

      expect(axios.defaults.headers.common['Authorization']).toBeUndefined();
    });
  });

  describe('updateUser action', () => {
    it('should update user data when user exists', () => {
      // Set initial user
      useAuthStore.setState({
        user: {
          id: '123',
          username: 'Test User',
          email: 'test@example.com',
        } as any,
      });

      // Update user
      useAuthStore.getState().updateUser({ username: 'Updated Name' });

      // Check user is updated
      const state = useAuthStore.getState();
      expect(state.user?.username).toBe('Updated Name');
      expect(state.user?.id).toBe('123');
      expect(state.user?.email).toBe('test@example.com');
    });

    it('should not update when user is null', () => {
      useAuthStore.setState({ user: null });

      useAuthStore.getState().updateUser({ username: 'New Name' });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });
  });

  describe('clearError action', () => {
    it('should clear error state', () => {
      // Set error
      useAuthStore.setState({
        error: { message: 'Test error', code: 'TEST_ERROR' },
      });

      // Clear error
      useAuthStore.getState().clearError();

      // Check error is cleared
      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('setLoading action', () => {
    it('should set loading state to true', () => {
      useAuthStore.setState({ loading: false });

      useAuthStore.getState().setLoading(true);

      const state = useAuthStore.getState();
      expect(state.loading).toBe(true);
    });

    it('should set loading state to false', () => {
      useAuthStore.setState({ loading: true });

      useAuthStore.getState().setLoading(false);

      const state = useAuthStore.getState();
      expect(state.loading).toBe(false);
    });
  });

  describe('setError action', () => {
    it('should set error state', () => {
      const error = { message: 'Test error', code: 'TEST_ERROR' };

      useAuthStore.getState().setError(error);

      const state = useAuthStore.getState();
      expect(state.error).toEqual(error);
    });

    it('should set error to null', () => {
      useAuthStore.setState({
        error: { message: 'Test error', code: 'TEST_ERROR' },
      });

      useAuthStore.getState().setError(null);

      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('checkAuth action', () => {
    it('should return false when not authenticated', () => {
      useAuthStore.setState({
        isAuthenticated: false,
        token: null,
      });

      const result = useAuthStore.getState().checkAuth();

      expect(result).toBe(false);
    });

    it('should return false when token is null', () => {
      useAuthStore.setState({
        isAuthenticated: true,
        token: null,
      });

      const result = useAuthStore.getState().checkAuth();

      expect(result).toBe(false);
    });

    it('should return false when token is expired', () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: '1' } as any,
        token: 'test-token',
        expiresAt: Date.now() - 1000, // Expired
      });

      const result = useAuthStore.getState().checkAuth();

      expect(result).toBe(false);
    });

    it('should return true when authenticated with valid session', () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: '1' } as any,
        token: 'cookie-auth',
        expiresAt: Date.now() + 3600000,
      });

      const result = useAuthStore.getState().checkAuth();

      expect(result).toBe(true);
    });

    it('should never set axios authorization header (cookie-only auth)', () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: '1' } as any,
        token: 'cookie-auth',
        expiresAt: Date.now() + 3600000,
      });

      axios.defaults.headers.common['Authorization'] = 'Bearer leftover';

      useAuthStore.getState().checkAuth();

      expect(axios.defaults.headers.common['Authorization']).toBeUndefined();
    });
  });

  describe('login action', () => {
    it('should set loading state during login', async () => {
      mockedApiClient.getRaw.mockRejectedValueOnce(new Error('Network error'));

      const loginPromise = useAuthStore.getState().login('test-token');

      // Check loading is true immediately
      expect(useAuthStore.getState().loading).toBe(true);

      // Wait for login to complete
      await expect(loginPromise).rejects.toThrow();

      expect(useAuthStore.getState().loading).toBe(false);
    });

    it('should handle login error', async () => {
      const apiClientErr = Object.assign(new Error('Invalid token'), {
        name: 'ApiClientError',
        code: 'INVALID_TOKEN',
        statusCode: 401,
      });
      mockedApiClient.getRaw.mockRejectedValueOnce(apiClientErr);

      await expect(useAuthStore.getState().login('invalid-token')).rejects.toBeDefined();

      const state = useAuthStore.getState();
      expect(state.error).toBeDefined();
      expect(state.error?.message).toBe('Invalid token');
      expect(state.loading).toBe(false);
    });
  });
});

describe('Auth Store Selectors', () => {
  it('should have selectUser selector', () => {
    useAuthStore.setState({
      user: { id: '123', name: 'Test' } as any,
    });

    const { selectUser } = require('../store/authStore');
    const user = selectUser(useAuthStore.getState());

    expect(user?.id).toBe('123');
  });

  it('should have selectIsAuthenticated selector', () => {
    useAuthStore.setState({ isAuthenticated: true });

    const { selectIsAuthenticated } = require('../store/authStore');
    const isAuth = selectIsAuthenticated(useAuthStore.getState());

    expect(isAuth).toBe(true);
  });

  it('should have selectToken selector', () => {
    useAuthStore.setState({ token: 'my-token' });

    const { selectToken } = require('../store/authStore');
    const token = selectToken(useAuthStore.getState());

    expect(token).toBe('my-token');
  });

  it('should have selectAuthLoading selector', () => {
    useAuthStore.setState({ loading: true });

    const { selectAuthLoading } = require('../store/authStore');
    const loading = selectAuthLoading(useAuthStore.getState());

    expect(loading).toBe(true);
  });

  it('should have selectAuthError selector', () => {
    const error = { message: 'Test error' };
    useAuthStore.setState({ error });

    const { selectAuthError } = require('../store/authStore');
    const stateError = selectAuthError(useAuthStore.getState());

    expect(stateError).toEqual(error);
  });
});

describe('tryAuthWithCookies action', () => {
  beforeEach(() => {
    // Reset auth store to initial state
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      expiresAt: null,
      loading: false,
      error: null,
      _logoutInProgress: false,
    });
    mockedApiClient.getRaw.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should successfully authenticate with valid cookies', async () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      role: 'member',
      permissions: [],
    };

    mockedApiClient.getRaw.mockResolvedValue({ data: mockUser });

    const result = await useAuthStore.getState().tryAuthWithCookies();

    expect(result).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().loading).toBe(false);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('should return false on failed authentication (401)', async () => {
    const apiClientErr = Object.assign(new Error('Unauthorized'), {
      name: 'ApiClientError',
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
    mockedApiClient.getRaw.mockRejectedValue(apiClientErr);

    const result = await useAuthStore.getState().tryAuthWithCookies();

    expect(result).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('should return false on failed authentication (403)', async () => {
    const apiClientErr = Object.assign(new Error('Forbidden'), {
      name: 'ApiClientError',
      code: 'FORBIDDEN',
      statusCode: 403,
    });
    mockedApiClient.getRaw.mockRejectedValue(apiClientErr);

    const result = await useAuthStore.getState().tryAuthWithCookies();

    expect(result).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('should handle network errors and log them', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const networkError = new Error('Network request failed');

    mockedApiClient.getRaw.mockRejectedValue(networkError);

    const result = await useAuthStore.getState().tryAuthWithCookies();

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ERROR] Cookie authentication failed:',
      networkError
    );
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().loading).toBe(false);
    expect(useAuthStore.getState().error).toEqual({
      message: 'Network request failed',
      code: 'COOKIE_AUTH_FAILED',
    });

    consoleErrorSpy.mockRestore();
  });

  it('should re-validate against backend even if already authenticated', async () => {
    useAuthStore.setState({ isAuthenticated: true });

    mockedApiClient.getRaw.mockResolvedValue({
      data: { id: 'user-1', username: 'test' },
    });

    const result = await useAuthStore.getState().tryAuthWithCookies();

    expect(result).toBe(true);
    expect(mockedApiClient.getRaw).toHaveBeenCalled();
  });

  it('should set loading state during authentication', async () => {
    let loadingDuringFetch = false;

    mockedApiClient.getRaw.mockImplementation(async () => {
      loadingDuringFetch = useAuthStore.getState().loading;
      return {
        data: {
          id: '1',
          username: 'test',
          role: 'member',
          permissions: [],
        },
      };
    });

    await useAuthStore.getState().tryAuthWithCookies();

    expect(loadingDuringFetch).toBe(true);
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('should call /api/v2/auth/me via apiClient (cookie-based)', async () => {
    mockedApiClient.getRaw.mockResolvedValue({
      data: { id: '1', username: 'test', role: 'member', permissions: [] },
    });

    await useAuthStore.getState().tryAuthWithCookies();

    expect(mockedApiClient.getRaw).toHaveBeenCalledWith(
      expect.stringContaining('/api/v2/auth/me')
    );
  });
});
