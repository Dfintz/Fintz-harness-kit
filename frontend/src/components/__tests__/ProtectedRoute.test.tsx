/**
 * ProtectedRoute Component Tests
 *
 * Tests for authentication wrapper that guards protected routes
 */

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock the auth store
jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn(),
  selectIsAuthenticated: (state: any) => state.isAuthenticated,
  selectUser: (state: any) => state.user,
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
);

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when user is authenticated', () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        isAuthenticated: true,
        user: { id: '1', username: 'testuser', role: 'member', permissions: [] },
        loading: false,
        checkAuth: jest.fn().mockReturnValue(true),
        tryAuthWithCookies: jest.fn().mockResolvedValue(true),
      };
      return selector(state);
    });

    render(
      <TestWrapper>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </TestWrapper>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to login when user is not authenticated', async () => {
    const mockTryAuthWithCookies = jest.fn().mockResolvedValue(false);

    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        isAuthenticated: false,
        user: null,
        loading: false,
        checkAuth: jest.fn().mockReturnValue(false),
        tryAuthWithCookies: mockTryAuthWithCookies,
      };
      return selector(state);
    });

    render(
      <TestWrapper>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </TestWrapper>
    );

    // Wait for cookie auth to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('allows access when user has required role', () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        isAuthenticated: true,
        user: { id: '1', username: 'admin', role: 'admin', permissions: [] },
        loading: false,
        checkAuth: jest.fn().mockReturnValue(true),
        tryAuthWithCookies: jest.fn().mockResolvedValue(true),
      };
      return selector(state);
    });

    render(
      <TestWrapper>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <div>Admin Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </TestWrapper>
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('allows access when user has required permission', () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        isAuthenticated: true,
        user: { id: '1', username: 'editor', role: 'member', permissions: ['fleet.edit'] },
        loading: false,
        checkAuth: jest.fn().mockReturnValue(true),
        tryAuthWithCookies: jest.fn().mockResolvedValue(true),
      };
      return selector(state);
    });

    render(
      <TestWrapper>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute requiredPermissions={['fleet.edit']}>
                <div>Editor Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </TestWrapper>
    );

    expect(screen.getByText('Editor Content')).toBeInTheDocument();
  });

  describe('Cookie Authentication Flow', () => {
    it('should call tryAuthWithCookies on mount when not authenticated', async () => {
      const mockTryAuthWithCookies = jest.fn().mockResolvedValue(false);

      (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) => {
        const state = {
          isAuthenticated: false,
          user: null,
          loading: false,
          checkAuth: jest.fn().mockReturnValue(false),
          tryAuthWithCookies: mockTryAuthWithCookies,
        };
        return selector(state);
      });

      render(
        <TestWrapper>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </TestWrapper>
      );

      // Wait for effect to run
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockTryAuthWithCookies).toHaveBeenCalled();
    });

    it('should transition from unauthenticated to authenticated after cookie auth succeeds', async () => {
      let isAuthenticated = false;
      let user: any = null;
      const mockTryAuthWithCookies = jest.fn().mockImplementation(async () => {
        // Simulate successful authentication
        isAuthenticated = true;
        user = { id: '1', username: 'testuser', role: 'member', permissions: [] };
        return true;
      });

      (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) => {
        const state = {
          isAuthenticated,
          user,
          loading: false,
          checkAuth: jest.fn().mockReturnValue(true),
          tryAuthWithCookies: mockTryAuthWithCookies,
        };
        return selector(state);
      });

      const { rerender } = render(
        <TestWrapper>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </TestWrapper>
      );

      // After cookie auth succeeds, rerender to show protected content
      rerender(
        <TestWrapper>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </TestWrapper>
      );

      expect(mockTryAuthWithCookies).toHaveBeenCalled();
    });

    it('should show loading state while cookie authentication is in progress', () => {
      (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) => {
        const state = {
          isAuthenticated: false,
          user: null,
          loading: true,
          checkAuth: jest.fn().mockReturnValue(false),
          tryAuthWithCookies: jest.fn().mockResolvedValue(false),
        };
        return selector(state);
      });

      render(
        <TestWrapper>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </TestWrapper>
      );

      // Should show loading spinner, not protected content
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should redirect to login when cookie auth fails and user is not authenticated', async () => {
      const mockTryAuthWithCookies = jest.fn().mockResolvedValue(false);

      (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) => {
        const state = {
          isAuthenticated: false,
          user: null,
          loading: false,
          checkAuth: jest.fn().mockReturnValue(false),
          tryAuthWithCookies: mockTryAuthWithCookies,
        };
        return selector(state);
      });

      render(
        <TestWrapper>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </TestWrapper>
      );

      // Wait for effect to run and cookie auth to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockTryAuthWithCookies).toHaveBeenCalled();
      expect(await screen.findByText('Login Page')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should not call tryAuthWithCookies if already authenticated', async () => {
      const mockTryAuthWithCookies = jest.fn().mockResolvedValue(true);

      (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) => {
        const state = {
          isAuthenticated: true,
          user: { id: '1', username: 'testuser', role: 'member', permissions: [] },
          loading: false,
          checkAuth: jest.fn().mockReturnValue(true),
          tryAuthWithCookies: mockTryAuthWithCookies,
        };
        return selector(state);
      });

      render(
        <TestWrapper>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </TestWrapper>
      );

      // Wait for effect to run
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockTryAuthWithCookies).not.toHaveBeenCalled();
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });
});
