/**
 * TopNavigation Component
 * Horizontal navigation bar with 4 main hubs
 */

import {
  Campaign,
  ChevronLeft,
  ChevronRight,
  Close,
  Info,
  Menu as MenuIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import React, { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { GuideLauncherButton } from '@/components/guide';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { selectUser, useAuthStore } from '@/store/authStore';
import { getHubForPath, hubs } from './hubConfig';
import './TopNavigation.css';
import type { Hub } from './types';
import { useNavigationIntentPrefetch } from './useNavigationIntentPrefetch';
import { UserMenu } from './UserMenu';

interface TopNavigationProps {
  /** Whether mobile menu is open */
  isMobileMenuOpen?: boolean;
  /** Callback when mobile menu toggle is clicked */
  onMobileMenuToggle?: () => void;
  /** Callback when about/info is clicked */
  onAboutClick?: () => void;
  /** Whether we're in mobile Box */
  isMobile?: boolean;
  /** Whether the sidebar is currently collapsed (desktop only) */
  isSidebarCollapsed?: boolean;
  /** Callback to toggle sidebar (desktop only) */
  onToggleSidebar?: () => void;
  /** Callback when search button is clicked (opens command palette) */
  onSearchClick?: () => void;
}

const TopNavigationBase: React.FC<TopNavigationProps> = ({
  isMobileMenuOpen = false,
  onMobileMenuToggle,
  onAboutClick,
  isMobile = false,
  isSidebarCollapsed = false,
  onToggleSidebar,
  onSearchClick,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [logoLoadError, setLogoLoadError] = React.useState(false);
  const user = useAuthStore(selectUser);
  const hasOrg = !!(user?.organizationId || user?.activeOrgId);
  const organizationId = user?.activeOrgId || user?.organizationId;

  // Performance monitoring in development
  usePerformanceMonitor('TopNavigation');

  // Determine active hub based on current path (memoized)
  const activeHub = useMemo(
    () => getHubForPath(location.pathname, location.search),
    [location.pathname, location.search]
  );

  const handleHubClick = useCallback(
    (hub: Hub) => {
      navigate(hub.path);
    },
    [navigate]
  );

  const prefetchPath = useNavigationIntentPrefetch(organizationId);

  return (
    <>
      {/* Skip to main content link for keyboard users */}
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <nav aria-label="Main navigation" data-guide="topnav">
        <Box
          p={2}
          className="top-navigation"
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={{ xs: 0.5, sm: 1 }}
          >
            {/* Left section: Logo and Hubs */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={{ xs: 0.5, sm: 2 }}
              flex={1}
              minWidth={0}
            >
              {/* Mobile Menu Toggle */}
              {isMobile && onMobileMenuToggle && (
                <IconButton
                  onClick={onMobileMenuToggle}
                  className="mobile-menu-toggle"
                  aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                  aria-expanded={isMobileMenuOpen}
                  aria-controls="mobile-navigation"
                >
                  {isMobileMenuOpen ? <Close /> : <MenuIcon />}
                </IconButton>
              )}

              {/* Logo */}
              <Stack direction="row" alignItems="center" spacing={{ xs: 0.5, sm: 1.5 }}>
                {!logoLoadError && (
                  <img
                    src="/fringecore.png"
                    alt="Fringe Core Logo"
                    className="logo"
                    onError={() => setLogoLoadError(true)}
                  />
                )}
                <Typography className="logo-text">Fringe Core</Typography>
              </Stack>

              {/* Mobile: show active hub indicator */}
              {isMobile && activeHub && (
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  sx={{
                    color: 'var(--nav-item-text-active, #00d9ff)',
                    opacity: 0.9,
                    ml: 0.5,
                    '@media (max-width: 480px)': {
                      display: 'none',
                    },
                  }}
                  aria-label={`Current hub: ${activeHub.label}`}
                >
                  {React.createElement(
                    activeHub.icon as React.ComponentType<Record<string, unknown>>,
                    { 'aria-hidden': true }
                  )}
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                    {activeHub.label}
                  </Typography>
                </Stack>
              )}

              {/* Desktop sidebar toggle for new navigation */}
              {!isMobile && onToggleSidebar && (
                <IconButton
                  onClick={onToggleSidebar}
                  aria-label={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                  className="sidebar-toggle"
                >
                  {isSidebarCollapsed ? <ChevronRight /> : <ChevronLeft />}
                </IconButton>
              )}

              {/* Desktop Hub Navigation */}
              {!isMobile && (
                <Stack
                  direction="row"
                  spacing={2.5}
                  flex={1}
                  className="hub-list"
                  role="group"
                  aria-label="Main hub navigation"
                >
                  {hubs.map(hub => {
                    const isActive = activeHub?.id === hub.id;
                    const HubIcon = hub.icon as React.ComponentType<Record<string, unknown>>;
                    const isDisabled = hub.requiresOrg && !hasOrg;

                    const button = (
                      <button
                        key={hub.id}
                        data-guide={`hub-${hub.id}`}
                        onClick={() => !isDisabled && handleHubClick(hub)}
                        onMouseEnter={() => !isDisabled && prefetchPath(hub.path)}
                        onFocus={() => !isDisabled && prefetchPath(hub.path)}
                        className={`hub-button ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                        aria-label={`Navigate to ${hub.label}${isActive ? ', current' : ''}${isDisabled ? ' (requires organization)' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                        {...(isDisabled ? { 'aria-disabled': true } : {})}
                        tabIndex={isDisabled ? -1 : 0}
                      >
                        <HubIcon size="S" aria-hidden="true" />
                        <span>{hub.label}</span>
                      </button>
                    );

                    return isDisabled ? (
                      <Tooltip key={hub.id} title="Requires an active organization" arrow>
                        <span>{button}</span>
                      </Tooltip>
                    ) : (
                      button
                    );
                  })}
                </Stack>
              )}
            </Stack>

            {/* Right section: Actions */}
            <Stack direction="row" alignItems="center" spacing={2}>
              {/* Global Search */}
              {onSearchClick && (
                <Tooltip title="Search orgs, federations, people (Ctrl+K)">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SearchIcon />}
                    onClick={onSearchClick}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 500,
                      color: 'text.secondary',
                      borderColor: 'divider',
                      borderRadius: 2,
                      px: 2,
                      minWidth: isMobile ? 'auto' : 180,
                      justifyContent: 'flex-start',
                      '&:hover': {
                        borderColor: 'text.secondary',
                        color: 'text.primary',
                      },
                    }}
                    aria-label="Open global search"
                  >
                    {!isMobile && (
                      <>
                        Search...
                        <Chip
                          label="Ctrl+K"
                          size="small"
                          sx={{
                            ml: 'auto',
                            height: 20,
                            fontSize: '0.65rem',
                            bgcolor: 'action.hover',
                            color: 'text.secondary',
                          }}
                        />
                      </>
                    )}
                  </Button>
                </Tooltip>
              )}

              {/* Announcements */}
              <Tooltip
                title={hasOrg ? 'Announcements' : 'Join an organization to create announcements'}
              >
                <span>
                  <Button
                    variant="text"
                    startIcon={<Campaign />}
                    onClick={() => navigate('/announcements')}
                    disabled={!hasOrg}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 500,
                      color: 'text.secondary',
                      '&:hover': { color: 'text.primary' },
                    }}
                    aria-label="Announcements"
                  >
                    Announcements
                  </Button>
                </span>
              </Tooltip>

              {/* Guided tour */}
              <GuideLauncherButton />

              {/* About/Info */}
              {onAboutClick && (
                <IconButton
                  onClick={onAboutClick}
                  className="action-button"
                  aria-label="About Fringe Core"
                >
                  <Info />
                </IconButton>
              )}

              {/* User Menu */}
              <UserMenu />
            </Stack>
          </Stack>
        </Box>
      </nav>
    </>
  );
};

// Memoize component to prevent unnecessary re-renders
export const TopNavigation = React.memo(TopNavigationBase);
