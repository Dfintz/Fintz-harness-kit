import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ── Mock hooks & stores ─────────────────────────────────────────────────

const mockUseActivityByToken = jest.fn();
const mockJoinMutateAsync = jest.fn();
const mockUseJoinByToken = jest.fn();

jest.mock('../../hooks/queries/useActivityQueries', () => ({
  useActivityByToken: (...args: unknown[]) => mockUseActivityByToken(...args),
  useJoinByToken: () => mockUseJoinByToken(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

let mockIsAuthenticated = true;
jest.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: mockIsAuthenticated }),
}));

const mockNotification = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
};

jest.mock('../../store/uiStore', () => ({
  useNotification: () => mockNotification,
}));

jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../components/FeatureErrorBoundary', () => ({
  FeatureErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Import AFTER mocks ─────────────────────────────────────────────────

import { JoinActivityPageWithErrorBoundary } from '../JoinActivityPage';

// ── Test data ───────────────────────────────────────────────────────────

const mockActivity = {
  id: 'activity-1',
  title: 'Friday Mining Run',
  description: 'Group mining operation',
  type: 'mining',
  startDate: '2026-02-01T20:00:00Z',
  maxParticipants: 10,
  currentParticipants: 4,
};

// ── Helpers ─────────────────────────────────────────────────────────────

function renderPage(token = 'test-token-123') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/join/activity/${token}`]}>
        <Routes>
          <Route path="/join/activity/:token" element={<JoinActivityPageWithErrorBoundary />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function setupDefaultMocks(overrides?: {
  queryLoading?: boolean;
  queryError?: Error | null;
  joinPending?: boolean;
  activity?: typeof mockActivity | null;
}) {
  const {
    queryLoading = false,
    queryError = null,
    joinPending = false,
    activity = mockActivity,
  } = overrides ?? {};

  mockUseActivityByToken.mockReturnValue({
    data: queryLoading ? undefined : activity,
    isLoading: queryLoading,
    error: queryError,
  });

  mockUseJoinByToken.mockReturnValue({
    mutateAsync: mockJoinMutateAsync,
    isPending: joinPending,
  });
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('JoinActivityPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    mockIsAuthenticated = true;
    setupDefaultMocks();
    mockJoinMutateAsync.mockResolvedValue({ id: 'activity-1' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Loading ───────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows loading spinner', () => {
      setupDefaultMocks({ queryLoading: true });
      renderPage();

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText(/Loading activity details/i)).toBeInTheDocument();
    });
  });

  // ── Error states ──────────────────────────────────────────────────────

  describe('error states', () => {
    it('shows expired link message', () => {
      setupDefaultMocks({ queryError: new Error('Link has expired'), activity: null });
      renderPage();

      expect(screen.getByText('Link Expired')).toBeInTheDocument();
      expect(screen.getByText(/ask the activity organizer for a new link/i)).toBeInTheDocument();
    });

    it('shows invalid link message', () => {
      setupDefaultMocks({ queryError: new Error('Not found'), activity: null });
      renderPage();

      expect(screen.getByText('Invalid Link')).toBeInTheDocument();
    });

    it('navigates home on Go to Home click', async () => {
      jest.useRealTimers();
      setupDefaultMocks({ queryError: new Error('Not found'), activity: null });
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Go to Home/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  // ── Activity preview ──────────────────────────────────────────────────

  describe('activity preview', () => {
    it('displays activity title', () => {
      renderPage();

      expect(screen.getByText('Friday Mining Run')).toBeInTheDocument();
    });

    it('displays invitation text', () => {
      renderPage();

      expect(screen.getByText(/You're Invited!/i)).toBeInTheDocument();
    });

    it('displays activity type chip', () => {
      renderPage();

      expect(screen.getByText('mining')).toBeInTheDocument();
    });

    it('displays description', () => {
      renderPage();

      expect(screen.getByText('Group mining operation')).toBeInTheDocument();
    });

    it('displays participant count', () => {
      renderPage();

      expect(screen.getByText(/4 \/ 10 participants/)).toBeInTheDocument();
    });
  });

  // ── Authenticated join ────────────────────────────────────────────────

  describe('authenticated user', () => {
    it('shows Join Activity button when authenticated', () => {
      renderPage();

      expect(screen.getByRole('button', { name: /Join Activity/i })).toBeInTheDocument();
    });

    it('calls joinMutation on Join Activity click', async () => {
      jest.useRealTimers();
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Join Activity/i }));

      await waitFor(() => {
        expect(mockJoinMutateAsync).toHaveBeenCalledWith({ token: 'test-token-123' });
      });
    });

    it('shows success message after join', async () => {
      jest.useRealTimers();
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Join Activity/i }));

      await waitFor(() => {
        expect(mockNotification.success).toHaveBeenCalledWith(
          'Successfully joined! Redirecting to activity...'
        );
      });
    });

    it('shows Joining… when pending', () => {
      setupDefaultMocks({ joinPending: true });
      renderPage();

      expect(screen.getByRole('button', { name: /Joining.../i })).toBeInTheDocument();
    });

    it('shows error alert on join failure', async () => {
      jest.useRealTimers();
      mockJoinMutateAsync.mockRejectedValue(new Error('Already joined'));
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Join Activity/i }));

      await waitFor(() => {
        expect(mockNotification.error).toHaveBeenCalledWith('Already joined');
      });
    });
  });

  // ── Unauthenticated ───────────────────────────────────────────────────

  describe('unauthenticated user', () => {
    beforeEach(() => {
      mockIsAuthenticated = false;
    });

    it('shows Sign In to Join button', () => {
      renderPage();

      expect(screen.getByRole('button', { name: /Sign In to Join/i })).toBeInTheDocument();
    });

    it('does not show Join Activity button', () => {
      renderPage();

      expect(screen.queryByRole('button', { name: /^Join Activity$/i })).not.toBeInTheDocument();
    });

    it('navigates to login with return URL on Sign In click', async () => {
      jest.useRealTimers();
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Sign In to Join/i }));

      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/login?returnUrl='));
    });
  });
});
