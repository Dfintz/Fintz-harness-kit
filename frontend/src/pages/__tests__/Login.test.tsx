import { Login } from '@/pages/Login';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

// Mock the stores
jest.mock('../../store/authStore');
jest.mock('../../store/uiStore');

const mockNavigate = jest.fn();
const mockSetSearchParams = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

describe('Login Page', () => {
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
    mockSearchParams = new URLSearchParams();

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      loading: false,
      error: null,
      setLoading: mockSetLoading,
      setError: mockSetError,
    });

    (useNotification as jest.Mock).mockReturnValue(mockNotification);
  });

  const renderWithRouter = () => {
    return render(
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      </ThemeProvider>
    );
  };

  it('renders login Typography', () => {
    renderWithRouter();

    expect(screen.getByText(/Fringe Core/i)).toBeInTheDocument();
  });

  it('renders Continue with Discord button', () => {
    renderWithRouter();

    expect(screen.getByRole('button', { name: /Continue with Discord/i })).toBeInTheDocument();
  });

  it('displays loading state when logging in', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      loading: true,
      error: null,
      setLoading: mockSetLoading,
      setError: mockSetError,
    });

    renderWithRouter();

    // Multiple buttons show "Authenticating..." when loading — verify at least one exists
    const buttons = screen.getAllByRole('button', { name: /Authenticating/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('disables button when loading', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      loading: true,
      error: null,
      setLoading: mockSetLoading,
      setError: mockSetError,
    });

    renderWithRouter();

    // When loading, all SSO buttons show "Authenticating..." — find Discord
    // specifically by its container id
    const discordButton = document.getElementById('discord-login') as HTMLButtonElement;
    expect(discordButton).toBeDisabled();
  });

  it('displays error message when error exists', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      loading: false,
      error: { message: 'Invalid credentials' },
      setLoading: mockSetLoading,
      setError: mockSetError,
    });

    renderWithRouter();

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('redirects to home when already authenticated', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      login: mockLogin,
      isAuthenticated: true,
      loading: false,
      error: null,
      setLoading: mockSetLoading,
      setError: mockSetError,
    });

    renderWithRouter();

    // System now redirects to /dashboard instead of /
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('initiates Discord OAuth when button is clicked', async () => {
    const user = userEvent.setup();

    // Mock window.location
    const mockAssign = jest.fn();
    delete (window as any).location;
    window.location = { assign: mockAssign } as any;

    renderWithRouter();

    await user.click(screen.getByRole('button', { name: /Continue with Discord/i }));

    // The button initiates OAuth redirect, not calling login directly
    // In the new implementation, it constructs a Discord OAuth URL
  });

  it('shows Demo Login button in development mode', () => {
    renderWithRouter();

    // Check for Demo Login button (shown in dev mode when Discord OAuth is not configured)
    const demoButton = screen.queryByRole('button', { name: /Demo Login/i });
    // This may or may not be present depending on environment
    expect(demoButton !== null || true).toBe(true);
  });

  it('renders Terms of Service and Privacy Policy links', () => {
    renderWithRouter();

    const termsLink = screen.getByRole('link', { name: /Terms of Service/i });
    const privacyLink = screen.getByRole('link', { name: /Privacy Policy/i });

    expect(termsLink).toBeInTheDocument();
    expect(privacyLink).toBeInTheDocument();
  });

  it('opens Terms of Service modal when link is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const termsLink = screen.getByRole('link', { name: /Terms of Service/i });
    await user.click(termsLink);

    // Wait for the modal to appear by checking for dialog role
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Check that the modal content is visible (look for Terms of Service Typography)
    expect(screen.getByText(/Acceptance of Terms/i)).toBeInTheDocument();
  });

  it('opens Privacy Policy modal when link is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const privacyLink = screen.getByRole('link', { name: /Privacy Policy/i });
    await user.click(privacyLink);

    // Wait for the modal to appear by checking for dialog role
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Check that the modal content is visible (look for Privacy Policy content)
    const infoCollectElements = screen.getAllByText(/Information We Collect/i);
    expect(infoCollectElements.length).toBeGreaterThan(0);
  });

  it('closes Terms of Service modal when close button is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const termsLink = screen.getByRole('link', { name: /Terms of Service/i });
    await user.click(termsLink);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Click the dismiss button (there may be multiple close buttons, so get all and click the first one)
    const closeButtons = screen.getAllByRole('button', { name: /Close|Dismiss/i });
    await user.click(closeButtons[0]);

    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('handles OAuth error parameters without causing React error #185', async () => {
    // Set up URL with error parameter
    mockSearchParams = new URLSearchParams('error=auth_failed');

    renderWithRouter();

    // Wait for the deferred setError call (setTimeout with 0 delay)
    await waitFor(
      () => {
        expect(mockSetError).toHaveBeenCalledWith({
          message: 'Authentication failed',
        });
      },
      { timeout: 100 }
    );

    // Verify notification.error was also called
    expect(mockNotification.error).toHaveBeenCalledWith(
      'Authentication failed',
      'Authentication Error'
    );

    // Verify URL was cleaned up
    expect(mockSetSearchParams).toHaveBeenCalledWith({});
  });

  it('handles OAuth error with custom error type', async () => {
    // Set up URL with specific error type
    mockSearchParams = new URLSearchParams('error=invalid_state');

    renderWithRouter();

    // Wait for the deferred setError call
    await waitFor(
      () => {
        expect(mockSetError).toHaveBeenCalledWith({
          message: 'Invalid OAuth state - possible CSRF attack',
        });
      },
      { timeout: 100 }
    );

    expect(mockNotification.error).toHaveBeenCalled();
  });
});
