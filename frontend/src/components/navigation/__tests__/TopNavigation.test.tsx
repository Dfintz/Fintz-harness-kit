/**
 * TopNavigation Component Tests
 */

import { GuideModeProvider } from '@/components/guide';
import { TopNavigation } from '@/components/navigation/TopNavigation';
import { prefetchNavigationIntent } from '@/components/navigation/navigationIntentPrefetch';
import { useAuthStore } from '@/store/authStore';
import { theme } from '@/theme';
import type { User } from '@/types/store';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

jest.mock('@/components/navigation/navigationIntentPrefetch', () => ({
  prefetchNavigationIntent: jest.fn().mockResolvedValue(undefined),
}));

const mockPrefetchNavigationIntent = jest.mocked(prefetchNavigationIntent);

const authenticatedMobileUser: User = {
  id: 'user-1',
  username: 'Test Pilot',
  email: 'pilot@example.com',
  organizationId: 'org-1',
  activeOrgId: 'org-1',
  role: 'member',
  permissions: ['org.view'],
  twoFactorEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

// Wrapper component with required ThemeProviders
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={testQueryClient}>
    <BrowserRouter>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

describe('TopNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().reset();
  });

  describe('Desktop Box', () => {
    it('renders all 5 hubs on desktop', () => {
      render(<TopNavigation isMobile={false} />, { wrapper: Wrapper });

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Ops Center')).toBeInTheDocument();
      expect(screen.getByText('Organization')).toBeInTheDocument();
      expect(screen.getByText('Community Hub')).toBeInTheDocument();
      expect(screen.getByText('Alliance')).toBeInTheDocument();
    });

    it('renders logo and app name', () => {
      render(<TopNavigation isMobile={false} />, { wrapper: Wrapper });

      expect(screen.getByText('Fringe Core')).toBeInTheDocument();
      expect(screen.getByAltText('Fringe Core Logo')).toBeInTheDocument();
    });

    it('renders info button', () => {
      render(<TopNavigation isMobile={false} onAboutClick={jest.fn()} />, { wrapper: Wrapper });

      expect(screen.getByLabelText('About Fringe Core')).toBeInTheDocument();
    });

    it('calls onAboutClick when info button is clicked', () => {
      const onAboutClick = jest.fn();
      render(<TopNavigation isMobile={false} onAboutClick={onAboutClick} />, { wrapper: Wrapper });

      const infoButton = screen.getByLabelText('About Fringe Core');
      fireEvent.click(infoButton);

      expect(onAboutClick).toHaveBeenCalledTimes(1);
    });

    it('does not render mobile menu toggle on desktop', () => {
      render(<TopNavigation isMobile={false} />, { wrapper: Wrapper });

      expect(screen.queryByLabelText('Open navigation menu')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Close navigation menu')).not.toBeInTheDocument();
    });

    it('renders sidebar toggle and triggers onToggleSidebar', () => {
      const onToggleSidebar = jest.fn();
      render(
        <TopNavigation
          isMobile={false}
          isSidebarCollapsed={false}
          onToggleSidebar={onToggleSidebar}
        />,
        { wrapper: Wrapper }
      );

      const sidebarToggle = screen.getByLabelText('Collapse navigation');
      expect(sidebarToggle).toBeInTheDocument();

      fireEvent.click(sidebarToggle);
      expect(onToggleSidebar).toHaveBeenCalledTimes(1);
    });

    it('triggers navigation intent prefetch on hub hover', () => {
      render(<TopNavigation isMobile={false} />, { wrapper: Wrapper });

      const opsHubButton = screen.getByRole('button', { name: /Navigate to Ops Center/i });
      fireEvent.mouseEnter(opsHubButton);

      expect(mockPrefetchNavigationIntent).toHaveBeenCalled();
      const latestCall = mockPrefetchNavigationIntent.mock.calls.at(-1);
      expect(latestCall?.[1]).toBeTruthy();
    });
  });

  describe('Mobile Box', () => {
    it('does not render hub list on mobile', () => {
      render(<TopNavigation isMobile={true} />, { wrapper: Wrapper });

      // Hub buttons should not be directly in the top nav on mobile
      expect(screen.queryByRole('button', { name: /Dashboard/i })).not.toBeInTheDocument();
    });

    it('renders mobile menu toggle button', () => {
      const onMobileMenuToggle = jest.fn();
      render(
        <TopNavigation
          isMobile={true}
          isMobileMenuOpen={false}
          onMobileMenuToggle={onMobileMenuToggle}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
    });

    it('calls onMobileMenuToggle when menu button is clicked', () => {
      const onMobileMenuToggle = jest.fn();
      render(
        <TopNavigation
          isMobile={true}
          isMobileMenuOpen={false}
          onMobileMenuToggle={onMobileMenuToggle}
        />,
        { wrapper: Wrapper }
      );

      const menuButton = screen.getByLabelText('Open navigation menu');
      fireEvent.click(menuButton);

      expect(onMobileMenuToggle).toHaveBeenCalledTimes(1);
    });

    it('shows close icon when menu is open', () => {
      render(
        <TopNavigation isMobile={true} isMobileMenuOpen={true} onMobileMenuToggle={jest.fn()} />,
        { wrapper: Wrapper }
      );

      expect(screen.getByLabelText('Close navigation menu')).toBeInTheDocument();
    });

    it('renders compact logo on mobile', () => {
      render(<TopNavigation isMobile={true} />, { wrapper: Wrapper });

      const logo = screen.getByAltText('Fringe Core Logo');
      expect(logo).toHaveClass('logo');
    });

    it('keeps mobile action area usable for authenticated users', async () => {
      const user = userEvent.setup();
      const onMobileMenuToggle = jest.fn();
      const onSearchClick = jest.fn();
      const onAboutClick = jest.fn();

      useAuthStore.setState({
        user: authenticatedMobileUser,
        isAuthenticated: true,
        token: 'cookie-auth',
      });

      render(
        <GuideModeProvider>
          <TopNavigation
            isMobile={true}
            isMobileMenuOpen={false}
            onMobileMenuToggle={onMobileMenuToggle}
            onSearchClick={onSearchClick}
            onAboutClick={onAboutClick}
          />
        </GuideModeProvider>,
        { wrapper: Wrapper }
      );

      const menuToggle = screen.getByLabelText('Open navigation menu');
      const searchButton = screen.getByLabelText('Open global search');
      const announcementsButton = screen.getByRole('button', { name: 'Announcements' });
      const guideButton = screen.getByLabelText('Start guided tour');
      const aboutButton = screen.getByLabelText('About Fringe Core');
      const userMenuButton = screen.getByLabelText('Test Pilot user menu');

      expect(menuToggle).toBeEnabled();
      expect(searchButton).toBeEnabled();
      expect(announcementsButton).toBeEnabled();
      expect(guideButton).toBeEnabled();
      expect(aboutButton).toBeEnabled();
      expect(userMenuButton).toBeEnabled();

      await user.click(menuToggle);
      await user.click(searchButton);
      await user.click(aboutButton);
      await user.click(userMenuButton);

      expect(onMobileMenuToggle).toHaveBeenCalledTimes(1);
      expect(onSearchClick).toHaveBeenCalledTimes(1);
      expect(onAboutClick).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole('menu')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for action buttons', () => {
      render(<TopNavigation onAboutClick={jest.fn()} />, { wrapper: Wrapper });

      expect(screen.getByLabelText('About Fringe Core')).toBeInTheDocument();
    });

    it('has proper ARIA labels for mobile menu toggle', () => {
      render(
        <TopNavigation isMobile={true} isMobileMenuOpen={false} onMobileMenuToggle={jest.fn()} />,
        { wrapper: Wrapper }
      );

      expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
    });
  });

  describe('Logo Fallback', () => {
    it('handles logo loading error gracefully', () => {
      render(<TopNavigation />, { wrapper: Wrapper });

      const logo = screen.getByAltText('Fringe Core Logo');
      fireEvent.error(logo);

      // Logo should be removed from DOM after error
      expect(screen.queryByAltText('Fringe Core Logo')).not.toBeInTheDocument();
      // App name should still be visible
      expect(screen.getByText('Fringe Core')).toBeInTheDocument();
    });
  });
});
