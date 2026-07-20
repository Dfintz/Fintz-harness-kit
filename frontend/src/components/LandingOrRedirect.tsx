/**
 * Landing Or Redirect Component
 *
 * Redirects authenticated users to /dashboard, shows landing page to guests.
 * This ensures bookmarks to '/' work correctly for both authenticated and unauthenticated users.
 */

import { selectIsAuthenticated, useAuthStore } from '@/store/authStore';
import React from 'react';
import { Navigate } from 'react-router-dom';
import { Landing } from '@/pages/Landing';

/**
 * Wrapper component for the root route that redirects authenticated users to dashboard
 * while showing the landing page to unauthenticated visitors.
 */
export const LandingOrRedirect: React.FC = () => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  // Redirect authenticated users to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show landing page to unauthenticated users
  return <Landing />;
};
