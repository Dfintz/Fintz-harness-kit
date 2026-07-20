/**
 * LandingOrRedirect Component Tests
 *
 * Tests the redirect behavior for authenticated users accessing '/'
 */

import { LandingOrRedirect } from '@/components/LandingOrRedirect';
import { useAuthStore } from '@/store/authStore';
import { render } from '@testing-library/react';
import { BrowserRouter, useLocation } from 'react-router-dom';

// Mock the Landing component
jest.mock('@/pages/Landing', () => ({
  Landing: () => <div data-testid="landing-page">Landing Page</div>,
}));

// Component to track navigation
const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

describe('LandingOrRedirect', () => {
  beforeEach(() => {
    // Reset auth store before each test
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      expiresAt: null,
    });
  });

  it('should show landing page for unauthenticated users', () => {
    const { getByTestId } = render(
      <BrowserRouter>
        <LandingOrRedirect />
      </BrowserRouter>
    );

    expect(getByTestId('landing-page')).toBeInTheDocument();
  });

  it('should redirect authenticated users to /dashboard', () => {
    // Set user as authenticated
    useAuthStore.setState({
      user: {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'member',
        permissions: [],
        twoFactorEnabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      token: 'valid-token',
      refreshToken: 'valid-refresh-token',
      isAuthenticated: true,
      expiresAt: Date.now() + 3600000,
    });

    const { getByTestId } = render(
      <BrowserRouter>
        <LandingOrRedirect />
        <LocationDisplay />
      </BrowserRouter>
    );

    // Should redirect to /dashboard
    expect(getByTestId('location').textContent).toBe('/dashboard');
  });
});
