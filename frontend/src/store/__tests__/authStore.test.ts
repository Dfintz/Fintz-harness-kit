import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types/store';
import { act, renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthStore', () => {
  beforeEach(() => {
    // Clear store state
    useAuthStore.getState().reset();
    jest.clearAllMocks();
    localStorage.clear();

    // Mock axios.post for logout endpoint (used in many tests)
    mockedAxios.post.mockResolvedValue({ data: {} });
  });

  it('initializes with no user', () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('updates user with updateUser', () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser: User = {
      id: '123',
      username: 'testuser',
      email: 'test@example.com',
      role: 'member',
      permissions: [],
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Manually set user to test updateUser
    act(() => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);

    // Update user
    act(() => {
      result.current.updateUser({ username: 'updateduser' });
    });

    expect(result.current.user?.username).toBe('updateduser');
  });

  it('clears user on logout', async () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser: User = {
      id: '123',
      username: 'testuser',
      email: 'test@example.com',
      role: 'member',
      permissions: [],
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    act(() => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true, token: 'test-token' });
    });

    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
  });

  it('sets token via setState', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      useAuthStore.setState({ token: 'test-token-123' });
    });

    expect(result.current.token).toBe('test-token-123');
  });

  it('clears token on logout', async () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      useAuthStore.setState({ token: 'test-token-123', isAuthenticated: true });
    });

    expect(result.current.token).toBe('test-token-123');

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.token).toBeNull();
  });

  it('sets loading state', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.setLoading(false);
    });

    expect(result.current.loading).toBe(false);
  });

  it('sets error state', () => {
    const { result } = renderHook(() => useAuthStore());
    const error = { message: 'Authentication failed', code: 'AUTH_FAILED' };

    act(() => {
      result.current.setError(error);
    });

    expect(result.current.error).toEqual(error);
  });

  it('clears error', () => {
    const { result } = renderHook(() => useAuthStore());
    const error = { message: 'Test error' };

    act(() => {
      result.current.setError(error);
    });

    expect(result.current.error).toEqual(error);

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('resets entire state', () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser: User = {
      id: '123',
      username: 'testuser',
      email: 'test@example.com',
      role: 'member',
      permissions: [],
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    act(() => {
      useAuthStore.setState({
        user: mockUser,
        token: 'test-token',
        error: { message: 'test error' },
        loading: true,
        isAuthenticated: true,
      });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('handles login success', async () => {
    const mockUser: User = {
      id: '123',
      username: 'testuser',
      email: 'test@example.com',
      role: 'member',
      permissions: [],
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Mock the user profile endpoint
    mockedAxios.get.mockResolvedValueOnce({
      data: mockUser,
    });

    const { result } = renderHook(() => useAuthStore());

    await act(async () => {
      await result.current.login('test-token', 'refresh-token');
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.token).toBe('cookie-auth');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('handles login failure', async () => {
    mockedAxios.get.mockRejectedValueOnce({
      response: {
        data: { message: 'Invalid credentials', code: 'AUTH_FAILED' },
        status: 401,
      },
    });

    // Mock axios.post for logout call
    mockedAxios.post.mockResolvedValueOnce({ data: {} });

    const { result } = renderHook(() => useAuthStore());

    let caughtError = false;
    await act(async () => {
      try {
        await result.current.login('invalid-token');
      } catch (error) {
        caughtError = true;
      }
    });

    expect(caughtError).toBe(true);

    // Wait for store to be updated
    await waitFor(() => {
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe('Invalid credentials');
    });
  });

  it('persists state to localStorage', () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser: User = {
      id: '123',
      username: 'testuser',
      email: 'test@example.com',
      role: 'member',
      permissions: [],
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    act(() => {
      useAuthStore.setState({
        user: mockUser,
        token: 'test-token',
        isAuthenticated: true,
      });
    });

    // Check that data is persisted (implementation depends on zustand persist)
    // Wait for async persistence
    waitFor(() => {
      const stored = localStorage.getItem('auth-storage');
      expect(stored).toBeTruthy();
    });
  });

  it('updates user profile', () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser: User = {
      id: '123',
      username: 'testuser',
      email: 'test@example.com',
      role: 'member',
      permissions: [],
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    act(() => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });
    });

    act(() => {
      result.current.updateUser({ email: 'newemail@example.com' });
    });

    expect(result.current.user?.email).toBe('newemail@example.com');
    expect(result.current.user?.username).toBe('testuser');
  });
});
