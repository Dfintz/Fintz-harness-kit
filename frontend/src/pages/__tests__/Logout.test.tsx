import { Logout } from '@/pages/Logout';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock the stores and navigation
jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Helper to render with router
const renderWithRouter = (initialEntries = ['/logout']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Logout />
    </MemoryRouter>
  );
};

describe('Logout', () => {
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockLogout.mockResolvedValue(undefined);
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      logout: mockLogout,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('calls logout function on mount', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('redirects to login page by default after delay', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });

    jest.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  describe('Open Redirect Protection', () => {
    it('should allow valid internal redirect paths', async () => {
      renderWithRouter(['/logout?redirect=/dashboard']);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });

      jest.advanceTimersByTime(1500);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });

    it('should allow internal redirects with query parameters', async () => {
      renderWithRouter(['/logout?redirect=/profile?tab=ships']);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });

      jest.advanceTimersByTime(1500);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/profile?tab=ships', { replace: true });
      });
    });

    it('should strip hash fragments from redirects (security)', async () => {
      renderWithRouter(['/logout?redirect=/dashboard#section']);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });

      jest.advanceTimersByTime(1500);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });

    it('should block external URL redirects', async () => {
      renderWithRouter(['/logout?redirect=https://evil.com/phishing']);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });

      jest.advanceTimersByTime(1500);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Attempted redirect to external URL blocked:',
        'https://evil.com/phishing'
      );
    });

    it('should block protocol-relative URLs', async () => {
      renderWithRouter(['/logout?redirect=//evil.com/phishing']);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });

      jest.advanceTimersByTime(1500);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Attempted redirect to external URL blocked:',
        '//evil.com/phishing'
      );
    });

    it('should block javascript: protocol URLs', async () => {
      renderWithRouter(['/logout?redirect=javascript:alert(1)']);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });

      jest.advanceTimersByTime(1500);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Attempted redirect to external URL blocked:',
        'javascript:alert(1)'
      );
    });
  });

  it('handles errors during logout gracefully', () => {
    const errorLogout = jest.fn().mockImplementation(() => {
      throw new Error('Logout failed');
    });

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      logout: errorLogout,
    });

    renderWithRouter();

    expect(logger.error).toHaveBeenCalledWith('Error during logout:', expect.any(Error));
  });
});
