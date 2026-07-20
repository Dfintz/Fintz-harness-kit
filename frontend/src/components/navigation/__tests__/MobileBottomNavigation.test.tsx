import { MobileBottomNavigation } from '@/components/navigation/MobileBottomNavigation';
import { prefetchNavigationIntent } from '@/components/navigation/navigationIntentPrefetch';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

jest.mock('@/components/navigation/navigationIntentPrefetch', () => ({
  prefetchNavigationIntent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/store/authStore', () => ({
  selectUser: (state: { user: unknown }) => state.user,
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({
      user: {
        id: 'user-1',
        organizationId: 'org-1',
        activeOrgId: 'org-1',
      },
    }),
}));

const mockPrefetchNavigationIntent = jest.mocked(prefetchNavigationIntent);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

describe('MobileBottomNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefetches route data on hover intent', async () => {
    render(<MobileBottomNavigation isSidebarOpen={false} />, { wrapper: Wrapper });

    const dashboardAction = screen.getByRole('button', { name: /^Dashboard$/i });
    fireEvent.mouseEnter(dashboardAction);

    await waitFor(() => {
      expect(mockPrefetchNavigationIntent).toHaveBeenCalled();
    });
  });

  it('hides bottom navigation when sidebar overlay is open', () => {
    render(<MobileBottomNavigation isSidebarOpen={true} />, { wrapper: Wrapper });

    expect(screen.queryByRole('navigation', { name: /hub navigation/i })).not.toBeInTheDocument();
  });
});
