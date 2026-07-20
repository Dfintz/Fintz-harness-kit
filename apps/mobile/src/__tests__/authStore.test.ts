import { useAuthStore } from '../store/authStore';

// Mock dependencies
jest.mock('../services/apiClient', () => ({
  apiClient: {
    setTokenProvider: jest.fn(),
    getData: jest.fn(),
    post: jest.fn(),
    postRaw: jest.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode: number) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

jest.mock('../utils/storage', () => ({
  asyncStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
  setStoredValue: jest.fn().mockResolvedValue(undefined),
  removeStoredValue: jest.fn().mockResolvedValue(undefined),
  getStoredValue: jest.fn().mockResolvedValue(null),
}));

jest.mock('../hooks/queries/queryClient', () => ({
  queryClient: {
    clear: jest.fn(),
  },
}));

describe('AuthStore', () => {
  beforeEach(() => {
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

  it('should initialize with default values', () => {
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should handle logout', async () => {
    useAuthStore.setState({
      user: { id: '1', username: 'test', email: 'test@example.com' },
      token: 'test-token',
      isAuthenticated: true,
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should clear error', () => {
    useAuthStore.setState({ error: { message: 'Test error', code: 'TEST' } });

    useAuthStore.getState().clearError();

    expect(useAuthStore.getState().error).toBeNull();
  });

  it('should update user data', () => {
    useAuthStore.setState({
      user: { id: '1', username: 'test', email: 'test@example.com' },
      isAuthenticated: true,
    });

    useAuthStore.getState().updateUser({ displayName: 'Test User' });

    expect(useAuthStore.getState().user?.displayName).toBe('Test User');
    expect(useAuthStore.getState().user?.username).toBe('test');
  });

  it('should report not authenticated when no token', () => {
    const result = useAuthStore.getState().checkAuth();
    expect(result).toBe(false);
  });
});
