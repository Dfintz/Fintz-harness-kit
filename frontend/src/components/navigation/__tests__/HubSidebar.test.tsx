import React from 'react';

import { HubSidebar } from '@/components/navigation/HubSidebar';
import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const mockUseCurrentRoute = jest.fn();
const mockUseAuthStore = jest.fn();

jest.mock('@/hooks/useCurrentRoute', () => ({
  useCurrentRoute: () => mockUseCurrentRoute(),
}));

jest.mock('@/hooks/useNavigation', () => ({
  useNavigation: () => undefined,
}));

jest.mock('@/hooks/queries', () => ({
  useOrganization: () => ({ data: null }),
}));

jest.mock('@/hooks/usePerformanceMonitor', () => ({
  usePerformanceMonitor: () => undefined,
}));

jest.mock('@/components/FeatureGate', () => ({
  FeatureGate: ({ flagId, children }: { flagId: string; children: React.ReactNode }) =>
    flagId === 'disabled-flag' ? null : <>{children}</>,
}));

jest.mock('@/store/authStore', () => ({
  selectUser: (state: { user: unknown }) => state.user,
  useAuthStore: (selector: (state: { user: unknown }) => unknown) => mockUseAuthStore(selector),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const DummyIcon: React.FC<{ fontSize?: string }> = () => <span aria-hidden="true" />;

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

describe('HubSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuthStore.mockImplementation(
      (selector: (state: { user: Record<string, unknown> | null }) => unknown) =>
        selector({
          user: {
            id: 'user-1',
            role: 'member',
            orgRole: 'member',
            organizationId: 'org-1',
            activeOrgId: 'org-1',
          },
        })
    );

    mockUseCurrentRoute.mockReturnValue({
      hub: {
        id: 'ops',
        label: 'Ops Center',
        icon: DummyIcon,
        path: '/ops',
        sections: [
          {
            title: 'Operations',
            items: [
              {
                id: 'visible-item',
                label: 'Visible Item',
                path: '/ops/visible',
                icon: DummyIcon,
              },
              {
                id: 'feature-item',
                label: 'Feature Item',
                path: '/ops/feature',
                icon: DummyIcon,
                featureFlag: 'disabled-flag',
              },
            ],
          },
        ],
      },
    });
  });

  it('applies feature gates in collapsed mode', () => {
    render(<HubSidebar isVisible={false} isMobile={false} />, { wrapper: Wrapper });

    expect(screen.getByTitle('Visible Item')).toBeInTheDocument();
    expect(screen.queryByTitle('Feature Item')).not.toBeInTheDocument();
  });
});
