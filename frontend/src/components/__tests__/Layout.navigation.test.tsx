import { Layout } from '@/components/Layout';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const theme = createTheme();

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

// Force the new navigation UI for dedicated tests
jest.mock('../../hooks/useFeatureFlag', () => {
  const mockUseFeatureFlag = jest.fn((flagId: string) => ({
    isEnabled: flagId === 'new-navigation-ui',
    isLoading: false,
    error: null,
  }));
  return { useFeatureFlag: mockUseFeatureFlag };
});

// Mock child components to simplify testing
jest.mock('../ConnectionStatusIndicator', () => {
  return function MockConnectionStatusIndicator() {
    return <div data-testid="connection-status">Connection Status</div>;
  };
});

jest.mock('../NotificationBell', () => {
  return function MockNotificationBell() {
    return <div data-testid="notification-bell">Notifications</div>;
  };
});

// NOTE (Sprint 3 cleanup): The original `describe.skip('Layout Navigation - Personal Hangar')`
// block (sidebar hub buttons, hub-specific paths, accessibility, persistence) was deleted.
// Those tests depended on the pre-refactor Layout structure and on synthetic auth state that
// is no longer how Layout/HubSidebar consume their hooks (`useNavigation`, `useCurrentRoute`,
// `useOrganization`). Equivalent coverage now lives in:
//   - Playwright E2E navigation specs in `tests/`

// SKIPPED (QA closeout, May 2026): The `new-navigation-ui` feature flag and the
// legacy `OPERATIONS / LOGISTICS / ORGANIZATION` sidebar sections were fully removed
// from `Layout.tsx`. This test asserts UI that no longer exists. Restore as a meaningful
// jsdom-level coverage check only if a fallback sidebar is reintroduced; otherwise rely
// on the Playwright navigation specs in `tests/`.
describe.skip('Layout Navigation - Legacy (flag off)', () => {
  it('renders legacy sidebar sections when feature flag disabled', () => {
    const { useFeatureFlag } = require('../../hooks/useFeatureFlag') as {
      useFeatureFlag: jest.Mock;
    };

    // Override mock to disable new navigation
    useFeatureFlag.mockImplementation(() => ({ isEnabled: false, isLoading: false, error: null }));

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <BrowserRouter>
            <Layout>
              <div>Legacy Content</div>
            </Layout>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    );

    // Expect legacy section headers to be present (OPERATIONS, LOGISTICS, ORGANIZATION, SECURITY)
    const sections = ['OPERATIONS', 'LOGISTICS', 'ORGANIZATION'];
    sections.forEach(section => {
      expect(screen.getByText(section)).toBeInTheDocument();
    });

    // Expect legacy actions (announcements/info) to render
    expect(screen.getAllByLabelText('Announcements').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('About Fringe Core').length).toBeGreaterThan(0);

    // Restore default implementation
    useFeatureFlag.mockImplementation((flagId: string) => ({
      isEnabled: flagId === 'new-navigation-ui',
      isLoading: false,
      error: null,
    }));
  });
});
