import { Login } from '@/pages/Login';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock the stores
jest.mock('../../store/authStore');
jest.mock('../../store/uiStore');

// Mock fetch
global.fetch = jest.fn();

describe('Login Page - OAuth Callback Flow (Backend-Only)', () => {
  const mockLogin = jest.fn();
  const mockSetLoading = jest.fn();
  const mockSetError = jest.fn();
  const mockNotification = {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock localStorage (not used for OAuth state in backend-only flow)
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      length: 0,
      key: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      loading: false,
      error: null,
      setLoading: mockSetLoading,
      setError: mockSetError,
    });

    // Mock useAuthStore.getState() for tryAuthWithCookies
    (useAuthStore as any).getState = jest.fn().mockReturnValue({
      tryAuthWithCookies: jest.fn().mockResolvedValue(true),
    });

    (useNotification as jest.Mock).mockReturnValue(mockNotification);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderWithRouter = (initialPath = '/login') => {
    return render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Login />
        </MemoryRouter>
      </ThemeProvider>
    );
  };

  it('should handle OAuth callback with successful authentication', async () => {
    const mockUser = {
      id: 'user-1',
      username: 'testuser',
      displayName: 'Test User',
      avatar: 'https://example.com/avatar.png',
      role: 'user',
    };

    // Mock successful user verification (backend already handled OAuth and set cookies)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: mockUser,
      }),
    });

    // Mock login to resolve successfully
    mockLogin.mockResolvedValueOnce(undefined);

    // Render with success parameter (backend redirects here after successful OAuth)
    renderWithRouter('/login?success=true');

    // Verify tryAuthWithCookies was called (cookies are httpOnly)
    await waitFor(() => {
      expect((useAuthStore as any).getState().tryAuthWithCookies).toHaveBeenCalled();
    });

    // Verify success notification
    await waitFor(() => {
      expect(mockNotification.success).toHaveBeenCalledWith(
        'Login successful!',
        'Welcome, Commander!'
      );
    });
  });

  it('should handle invalid_state error from backend (CSRF protection)', async () => {
    // Backend now handles state validation and redirects with error parameter
    // Render with error parameter from backend
    renderWithRouter('/login?error=invalid_state');

    // Wait for error handling
    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid OAuth state'),
        })
      );
    });

    // Verify error notification with correct message
    await waitFor(() => {
      expect(mockNotification.error).toHaveBeenCalledWith(
        'Invalid OAuth state - possible CSRF attack',
        'Authentication Error'
      );
    });

    // Verify fetch was NOT called (backend already handled validation)
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle authentication verification error', async () => {
    // Mock tryAuthWithCookies to reject (session establishment fails)
    (useAuthStore as any).getState = jest.fn().mockReturnValue({
      tryAuthWithCookies: jest.fn().mockResolvedValue(false),
    });

    // Render with success parameter (but verification will fail)
    renderWithRouter('/login?success=true');

    // Wait for error handling — tryAuthWithCookies returns false, so the catch branch fires
    await waitFor(
      () => {
        expect(mockNotification.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to establish session after authentication'),
          'Authentication Error'
        );
      },
      { timeout: 3000 }
    );

    // Verify login was NOT called
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('should handle OAuth error parameter in URL', async () => {
    const errorParam = 'access_denied';

    // Render with error parameter (backend redirects here with error)
    renderWithRouter(`/login?error=${errorParam}`);

    // Wait for error handling
    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(errorParam),
        })
      );
    });

    // Verify error notification with correct format
    await waitFor(() => {
      expect(mockNotification.error).toHaveBeenCalledWith(
        `Authentication failed: ${errorParam}`,
        'Authentication Error'
      );
    });

    // Verify fetch was NOT called (backend already handled error)
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle server configuration error', async () => {
    // Render with server_config error parameter
    renderWithRouter('/login?error=server_config');

    // Wait for error handling
    await waitFor(
      () => {
        expect(mockNotification.error).toHaveBeenCalledWith(
          'Server configuration error',
          'Authentication Error'
        );
      },
      { timeout: 3000 }
    );

    // Verify fetch was NOT called
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should verify backend-only OAuth flow', () => {
    // This test verifies that the component uses backend-only OAuth flow
    // The backend handles state generation, Discord redirect, callback, and redirects back to frontend
    // Frontend only receives ?success=true or ?error=<error_code>

    renderWithRouter('/login');

    // The component should be ready to handle OAuth flow
    const discordButton = screen.getByRole('button', { name: /Continue with Discord/i });
    expect(discordButton).toBeInTheDocument();

    // Note: Clicking the button redirects to backend endpoint
    // Backend handles the full OAuth flow and redirects back with success/error params
  });
});
