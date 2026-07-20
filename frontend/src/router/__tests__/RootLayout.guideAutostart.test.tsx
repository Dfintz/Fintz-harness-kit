import { GuideScript } from '@/components/guide/guideScript';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { useProactiveTokenRefresh } from '@/hooks/useProactiveTokenRefresh';
import { useRealtimeQueryInvalidation } from '@/hooks/useRealtime';
import { useAuthStore } from '@/store/authStore';
import { muiTheme } from '@/theme/muiTheme';
import type { User } from '@/types/store';
import {
  getGuideNewUserDismissedStorageKey,
  ONBOARDING_COMPLETED_KEY,
} from '@/utils/guideAutostart';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RootLayout } from '../RootLayout';
import { PublicLayout } from '../PublicLayout';

jest.mock('@/hooks/useProactiveTokenRefresh', () => ({
  useProactiveTokenRefresh: jest.fn(),
}));

jest.mock('@/hooks/useRealtime', () => ({
  useRealtimeQueryInvalidation: jest.fn(),
}));

jest.mock('@/hooks/useIdleTimeout', () => ({
  useIdleTimeout: jest.fn(),
}));

const idleTimeoutMock = useIdleTimeout as jest.MockedFunction<typeof useIdleTimeout>;
const proactiveTokenRefreshMock = useProactiveTokenRefresh as jest.MockedFunction<
  typeof useProactiveTokenRefresh
>;
const realtimeInvalidationMock = useRealtimeQueryInvalidation as jest.MockedFunction<
  typeof useRealtimeQueryInvalidation
>;

const shortScript: GuideScript = {
  id: 'root-layout-integration-autostart',
  title: 'RootLayout Integration Autostart',
  steps: [{ id: 'a', scene: 'One', title: 'First step', body: 'first body' }],
};

const testUser: User = {
  id: 'root-layout-new-user',
  username: 'root-layout-new-user',
  email: 'root-layout-new-user@example.com',
  role: 'user',
  permissions: [],
  twoFactorEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function resetAuthState(): void {
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
}

function renderRouter(router: ReturnType<typeof createMemoryRouter>): {
  unmount: () => void;
  queryClient: QueryClient;
} {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const view = render(
    <MuiThemeProvider theme={muiTheme}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MuiThemeProvider>
  );

  return {
    unmount: () => {
      view.unmount();
      queryClient.clear();
    },
    queryClient,
  };
}

describe('RootLayout guide auto-start integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();

    idleTimeoutMock.mockReturnValue({
      remainingTime: 0,
      reset: jest.fn(),
    });
    proactiveTokenRefreshMock.mockImplementation(() => undefined);
    realtimeInvalidationMock.mockImplementation(() => undefined);

    globalThis.localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    globalThis.localStorage.removeItem(getGuideNewUserDismissedStorageKey(testUser.id));

    act(() => {
      resetAuthState();
      useAuthStore.setState({
        user: testUser,
        token: 'cookie-auth',
        isAuthenticated: true,
      });
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();

    globalThis.localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    globalThis.localStorage.removeItem(getGuideNewUserDismissedStorageKey(testUser.id));

    act(() => {
      resetAuthState();
    });
  });

  it('auto-starts only inside protected RootLayout routes', async () => {
    const protectedRouter = createMemoryRouter(
      [
        {
          path: '/',
          element: <RootLayout />,
          children: [{ path: 'fleet', element: <div>protected page</div> }],
        },
      ],
      { initialEntries: ['/fleet'] }
    );

    const protectedView = renderRouter(protectedRouter);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(await screen.findByTestId('guide-overlay')).toBeInTheDocument();
    protectedView.unmount();

    const publicRouter = createMemoryRouter(
      [
        {
          path: '/',
          element: <PublicLayout />,
          children: [{ path: 'directory', element: <div>public page</div> }],
        },
      ],
      { initialEntries: ['/directory'] }
    );

    const publicView = renderRouter(publicRouter);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
    publicView.unmount();
  });
});
