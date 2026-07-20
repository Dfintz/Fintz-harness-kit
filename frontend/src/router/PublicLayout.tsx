/**
 * Public Layout Component for React Router
 *
 * Minimal layout for public pages (login, directory, landing, etc.)
 * without navigation sidebar or authenticated header.
 * Includes the PublicNavBar for consistent navigation across public pages.
 *
 * Note: Depends on the MUI ThemeProvider at the app root; wrap in tests/Storybook if used standalone.
 */

import { LoadingSpinner } from '@/components/LoadingSpinner';
import { NavigationProgress } from '@/components/NavigationProgress';
import { RouteAnnouncer } from '@/components/RouteAnnouncer';
import { PublicNavBar } from '@/components/layout/PublicNavBar';
import { Box, useTheme } from '@mui/material';
import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

/** Pages where the public nav bar should be hidden (fullscreen auth pages) */
const HIDE_NAV_PATHS = new Set(['/login', '/admin/login', '/logout', '/verify-deletion']);

export const PublicLayout: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();
  const showNavBar = !HIDE_NAV_PATHS.has(location.pathname);

  return (
    <>
      <NavigationProgress />
      <RouteAnnouncer />
      {showNavBar && <PublicNavBar />}
      <Box
        minHeight="100vh"
        width="100%"
        sx={{
          background: `linear-gradient(180deg, ${theme.palette.background.default} 0%, ${theme.palette.background.default} 50%, ${theme.palette.background.paper} 100%)`,
        }}
      >
        <Suspense fallback={<LoadingSpinner />}>
          <Outlet />
        </Suspense>
      </Box>
    </>
  );
};
