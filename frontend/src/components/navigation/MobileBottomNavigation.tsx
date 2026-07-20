/**
 * MobileBottomNavigation Component
 * Bottom navigation bar for mobile viewports with 5 hub icons
 */

import { BottomNavigation, BottomNavigationAction, Box, Paper, Tooltip } from '@mui/material';
import React, { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { selectUser, useAuthStore } from '@/store/authStore';
import { getHubForPath, hubs } from './hubConfig';
import type { Hub } from './types';
import { useNavigationIntentPrefetch } from './useNavigationIntentPrefetch';

interface MobileBottomNavigationProps {
  /** Whether the mobile sidebar overlay is open — hides bottom nav when true */
  isSidebarOpen?: boolean;
}

const MobileBottomNavigationBase: React.FC<MobileBottomNavigationProps> = ({
  isSidebarOpen = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore(selectUser);
  const hasOrg = !!(user?.organizationId || user?.activeOrgId);
  const organizationId = user?.activeOrgId || user?.organizationId;

  const activeHub = useMemo(
    () => getHubForPath(location.pathname, location.search),
    [location.pathname, location.search]
  );

  const activeValue = activeHub?.id ?? '';

  const prefetchPath = useNavigationIntentPrefetch(organizationId);

  const handleChange = useCallback(
    (_event: React.SyntheticEvent, newValue: string) => {
      const hub = hubs.find(h => h.id === newValue);
      if (hub) {
        const isDisabled = hub.requiresOrg && !hasOrg;
        if (!isDisabled) {
          prefetchPath(hub.path);
          navigate(hub.path);
        }
      }
    },
    [navigate, hasOrg, prefetchPath]
  );

  // Hide when sidebar overlay is open to avoid two overlapping nav UIs
  if (isSidebarOpen) {
    return null;
  }

  return (
    <Paper
      component="nav"
      aria-label="Hub navigation"
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 'var(--z-index-bottom-nav, 800)',
        // Safe area inset for devices with home bar (iPhone etc.)
        paddingBottom: 'env(safe-area-inset-bottom)',
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'var(--nav-bg, rgba(15, 29, 53, 0.95))',
        backdropFilter: 'blur(10px)',
      }}
    >
      <BottomNavigation
        value={activeValue}
        onChange={handleChange}
        showLabels
        sx={{
          bgcolor: 'transparent',
          height: 56,
          '& .MuiBottomNavigationAction-root': {
            color: 'var(--nav-item-text, rgba(255,255,255,0.6))',
            minWidth: 0,
            py: 0.5,
            '&.Mui-selected': {
              color: 'var(--nav-item-text-active, #00d9ff)',
            },
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.65rem',
            '&.Mui-selected': {
              fontSize: '0.7rem',
            },
          },
        }}
      >
        {hubs.map((hub: Hub) => {
          const HubIcon = hub.icon as React.ComponentType<Record<string, unknown>>;
          const isDisabled = hub.requiresOrg && !hasOrg;

          const action = (
            <BottomNavigationAction
              key={hub.id}
              value={hub.id}
              label={hub.label}
              icon={<HubIcon aria-hidden="true" />}
              disabled={isDisabled}
              onMouseEnter={() => !isDisabled && prefetchPath(hub.path)}
              onFocus={() => !isDisabled && prefetchPath(hub.path)}
              onTouchStart={() => !isDisabled && prefetchPath(hub.path)}
              aria-label={`${hub.label}${isDisabled ? ' (requires organization)' : ''}`}
              sx={isDisabled ? { opacity: 0.4 } : undefined}
            />
          );

          return isDisabled ? (
            <Tooltip key={hub.id} title="Requires an active organization" arrow>
              <Box component="span" sx={{ display: 'inline-flex', flex: 1 }}>
                {action}
              </Box>
            </Tooltip>
          ) : (
            action
          );
        })}
      </BottomNavigation>
    </Paper>
  );
};

export const MobileBottomNavigation = React.memo(MobileBottomNavigationBase);
