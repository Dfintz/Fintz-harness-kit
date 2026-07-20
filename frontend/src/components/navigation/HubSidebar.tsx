/**
 * HubSidebar Component
 * Contextual sidebar navigation for the active hub
 */

import {
  ExpandMore as ChevronDown,
  ChevronRight,
  Business as OrganisationsIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material';
import { Avatar, Box, Stack, SwipeableDrawer, Tooltip, Typography } from '@mui/material';
import React, { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { FeatureGate } from '@/components/FeatureGate';
import { useOrganization } from '@/hooks/queries';
import { useCurrentRoute } from '@/hooks/useCurrentRoute';
import { useNavigation } from '@/hooks/useNavigation';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { selectUser, useAuthStore } from '@/store/authStore';
import { meetsMinOrgRole } from '@/utils/roleUtils';
import { sanitizeImageUrl } from '@/utils/sanitize';
import './HubSidebar.css';
import { routePathMatchesLocation } from './routeMatcher';
import { NavItem, NavSection } from './types';
import { useNavigationIntentPrefetch } from './useNavigationIntentPrefetch';

/** User context fields needed for nav-item access checks */
interface NavUserContext {
  organizationId?: string | null;
  activeOrgId?: string | null;
  rsiVerified?: boolean;
  role?: string;
  orgRole?: string;
  orgPermissions?: string[];
  permissions?: string[];
}

/**
 * Determine whether a nav item is currently active based on the current location.
 * Uses exact match first; only falls back to prefix match when the current path
 * isn't an exact match for any registered route (i.e. deep sub-pages).
 */
function isNavItemActive(
  itemPath: string,
  location: { pathname: string; search: string },
  allPaths?: string[]
): boolean {
  const currentLocation = { pathname: location.pathname, search: location.search };

  if (
    routePathMatchesLocation(itemPath, currentLocation, {
      allowPrefixMatch: false,
      ignoreRouteSearch: false,
    })
  ) {
    return true;
  }

  // If another registered route is an exact match for the current path,
  // don't let a shorter prefix route also highlight.
  if (
    allPaths?.some(
      path =>
        path !== itemPath &&
        routePathMatchesLocation(path, currentLocation, {
          allowPrefixMatch: false,
          ignoreRouteSearch: false,
        })
    )
  ) {
    return false;
  }

  return routePathMatchesLocation(itemPath, currentLocation, {
    allowPrefixMatch: true,
    ignoreRouteSearch: false,
  });
}

/**
 * Determine the disabled state and reason for a nav item.
 */
function getNavItemDisabledState(
  item: NavItem,
  user: NavUserContext | null
): { isDisabled: boolean; disabledReason: string } {
  // Unconditional disable via disabledTooltip (used for "Coming Soon™" features)
  if (item.disabledTooltip) {
    return { isDisabled: true, disabledReason: item.disabledTooltip };
  }

  const hasOrg = !!(user?.organizationId || user?.activeOrgId);
  const isRsiVerified = !!user?.rsiVerified;
  const isOrgOwner = !!(
    user?.rsiVerified &&
    (user?.role === 'admin' ||
      user?.orgRole === 'owner' ||
      user?.orgRole === 'founder' ||
      user?.orgRole === 'admin' ||
      user?.orgPermissions?.includes('org.manage') ||
      user?.permissions?.includes('org.manage'))
  );

  if (item.requiresOrg && !hasOrg) {
    return { isDisabled: true, disabledReason: 'Requires an active organization' };
  }
  if (item.requiresRsiVerified && !isRsiVerified) {
    return {
      isDisabled: true,
      disabledReason: 'Requires a verified RSI profile',
    };
  }
  if (item.requiresOrgOwner && !isOrgOwner) {
    return {
      isDisabled: true,
      disabledReason: 'Requires verified org owner status',
    };
  }
  // minRole check: hide/disable items when user's org role is too low
  if (item.minRole && !meetsMinOrgRole(user?.orgRole, item.minRole) && user?.role !== 'admin') {
    return {
      isDisabled: true,
      disabledReason: 'Insufficient organization role',
    };
  }
  return { isDisabled: false, disabledReason: '' };
}

interface HubSidebarProps {
  /** Whether the sidebar should be visible */
  isVisible?: boolean;
  /** Whether the sidebar is open (primarily for mobile) */
  isOpen?: boolean;
  /** Whether we're in mobile Box */
  isMobile?: boolean;
  /** Callback when the mobile drawer should open (swipe gesture) */
  onOpen?: () => void;
  /** Callback when the mobile drawer should close (swipe gesture or backdrop tap) */
  onClose?: () => void;
}

const HubSidebarBase: React.FC<HubSidebarProps> = ({
  isVisible = true,
  isOpen = true,
  isMobile = false,
  onOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsedSections, setCollapsedSections] = React.useState<Set<string>>(new Set());

  // Performance monitoring in development
  usePerformanceMonitor('HubSidebar');

  // Get user from auth store
  const user = useAuthStore(selectUser);

  // Get org RSI verification status
  const orgId = user?.organizationId || user?.activeOrgId || undefined;
  const { data: orgData } = useOrganization(orgId, { staleTime: 5 * 60 * 1000 });

  const prefetchPath = useNavigationIntentPrefetch(orgId);

  // Get current route info from hook
  const { hub: currentHub } = useCurrentRoute();

  const routeLocation = React.useMemo(
    () => ({ pathname: location.pathname, search: location.search }),
    [location.pathname, location.search]
  );

  // Subscribe to navigation registry updates.
  useNavigation();

  // Collect all registered paths in the current hub for accurate active-state detection
  const allHubPaths = React.useMemo(() => {
    if (!currentHub) return [] as string[];
    const paths: string[] = [];
    if (currentHub.sections) {
      for (const section of currentHub.sections) {
        for (const item of section.items) {
          paths.push(item.path);
        }
      }
    }
    if (currentHub.items) {
      for (const item of currentHub.items) {
        paths.push(item.path);
      }
    }
    return paths;
  }, [currentHub]);

  const toggleSection = useCallback((sectionTitle: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionTitle)) {
        newSet.delete(sectionTitle);
      } else {
        newSet.add(sectionTitle);
      }
      return newSet;
    });
  }, []);

  const renderNavItem = useCallback(
    (item: NavItem) => {
      // Hide admin-only items from non-admin users
      if (item.adminOnly && user?.role !== 'admin') {
        return null;
      }

      // Hide items gated by minRole when user's org role is insufficient
      if (item.minRole && user?.role !== 'admin' && !meetsMinOrgRole(user?.orgRole, item.minRole)) {
        return null;
      }

      const isActive = isNavItemActive(item.path, routeLocation, allHubPaths);
      const { isDisabled, disabledReason } = getNavItemDisabledState(item, user);
      const ItemIcon = item.icon as React.ComponentType<{ fontSize?: string }>;

      const itemContent = (
        <button
          type="button"
          onClick={() => !isDisabled && navigate(item.path)}
          onMouseEnter={() => !isDisabled && prefetchPath(item.path)}
          onFocus={() => !isDisabled && prefetchPath(item.path)}
          className={`nav-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
          disabled={isDisabled}
          tabIndex={isDisabled ? -1 : 0}
          aria-current={isActive ? 'page' : undefined}
          aria-label={isDisabled ? `${item.label} (${disabledReason})` : item.label}
          title={isDisabled ? disabledReason : undefined}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
              e.preventDefault();
              navigate(item.path);
            }
          }}
        >
          <ItemIcon fontSize="small" />
          <span className="nav-item-label">{item.label}</span>
          {item.badge && item.badge > 0 && <span className="nav-item-badge">{item.badge}</span>}
        </button>
      );

      // Wrap with feature gate if specified
      if (item.featureFlag) {
        return (
          <FeatureGate key={item.id} flagId={item.featureFlag}>
            {itemContent}
          </FeatureGate>
        );
      }

      return <div key={item.id}>{itemContent}</div>;
    },
    [routeLocation, user, navigate, allHubPaths, prefetchPath]
  );

  const renderCollapsedNavItem = useCallback(
    (item: NavItem) => {
      // Hide admin-only items from non-admin users
      if (item.adminOnly && user?.role !== 'admin') {
        return null;
      }

      // Hide items gated by minRole when user's org role is insufficient
      if (item.minRole && user?.role !== 'admin' && !meetsMinOrgRole(user?.orgRole, item.minRole)) {
        return null;
      }

      const isActive = isNavItemActive(item.path, routeLocation, allHubPaths);
      const { isDisabled, disabledReason } = getNavItemDisabledState(item, user);
      const ItemIcon = item.icon as React.ComponentType<{ fontSize?: string }>;

      const itemContent = (
        <button
          type="button"
          onClick={() => !isDisabled && navigate(item.path)}
          onMouseEnter={() => !isDisabled && prefetchPath(item.path)}
          onFocus={() => !isDisabled && prefetchPath(item.path)}
          className={`nav-item-collapsed ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
          disabled={isDisabled}
          tabIndex={isDisabled ? -1 : 0}
          aria-label={isDisabled ? `${item.label} (${disabledReason})` : item.label}
          title={item.label}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
              e.preventDefault();
              navigate(item.path);
            }
          }}
        >
          <ItemIcon fontSize="small" />
        </button>
      );

      if (item.featureFlag) {
        return (
          <FeatureGate key={item.id} flagId={item.featureFlag}>
            {itemContent}
          </FeatureGate>
        );
      }

      return <div key={item.id}>{itemContent}</div>;
    },
    [routeLocation, user, navigate, allHubPaths, prefetchPath]
  );

  const renderSection = useCallback(
    (section: NavSection) => {
      const isSectionCollapsed = collapsedSections.has(section.title);

      return (
        <Box key={section.title} mb={1.5}>
          {/* Section Header */}
          <button
            type="button"
            onClick={() => toggleSection(section.title)}
            className="section-header"
            aria-label={`${section.title} section, ${isSectionCollapsed ? 'collapsed' : 'expanded'}`}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSection(section.title);
              }
            }}
          >
            {isSectionCollapsed ? (
              <ChevronRight fontSize="small" className="section-chevron" />
            ) : (
              <ChevronDown fontSize="small" className="section-chevron" />
            )}
            <Typography className="section-title">{section.title}</Typography>
          </button>

          {/* Section Items */}
          {!isSectionCollapsed && (
            <Stack direction="column" spacing={0.25} mt={0.5}>
              {section.items.map(renderNavItem)}
            </Stack>
          )}
        </Box>
      );
    },
    [collapsedSections, toggleSection, renderNavItem]
  );

  const renderOrgDisplay = useCallback(
    () => (
      <Box p={1.5} mb={2} className="org-display" role="region" aria-label="Primary organization">
        <Typography className="org-label">PRIMARY ORG</Typography>
        {user?.organizationId || user?.activeOrgId ? (
          <Box display="flex" alignItems="center" gap={1} px={0.5} py={0.5}>
            {user.activeOrgLogoUrl ? (
              <Avatar
                src={sanitizeImageUrl(user.activeOrgLogoUrl)}
                alt={user.activeOrgName || 'Organization'}
                sx={{ width: 32, height: 32 }}
                variant="rounded"
              />
            ) : (
              <OrganisationsIcon sx={{ fontSize: 32, opacity: 0.7 }} />
            )}
            {user.activeOrgName && (
              <Typography
                variant="body2"
                noWrap
                sx={{
                  color: 'var(--nav-text)',
                  fontWeight: 500,
                  maxWidth: 140,
                }}
              >
                {user.activeOrgName}
              </Typography>
            )}
            {orgData?.rsiVerified && (
              <Tooltip title="RSI Verified" arrow>
                <VerifiedIcon sx={{ fontSize: 16, color: 'success.main', flexShrink: 0 }} />
              </Tooltip>
            )}
          </Box>
        ) : (
          <Box p={1.5} className="org-empty">
            <Typography className="org-empty-text" role="status" aria-live="polite">
              No Org
            </Typography>
          </Box>
        )}
      </Box>
    ),
    [user, orgData]
  );

  if (!currentHub) {
    return null;
  }

  // Mobile: use SwipeableDrawer for gesture support
  if (isMobile) {
    const handleDrawerOpen = () => onOpen?.();
    const handleDrawerClose = () => onClose?.();

    return (
      <SwipeableDrawer
        anchor="left"
        open={isOpen}
        onOpen={handleDrawerOpen}
        onClose={handleDrawerClose}
        swipeAreaWidth={20}
        hysteresis={0.5}
        minFlingVelocity={400}
        disableSwipeToOpen={false}
        ModalProps={{ keepMounted: true }}
        slotProps={{
          paper: {
            sx: {
              width: 280,
              bgcolor: 'var(--nav-bg, rgba(15, 29, 53, 0.95))',
              backdropFilter: 'blur(10px)',
              borderRight: '1px solid var(--nav-border, rgba(42, 63, 95, 0.4))',
              top: 'var(--nav-header-height, 60px)',
              height: 'calc(100% - var(--nav-header-height, 60px))',
            },
          },
        }}
      >
        <nav aria-label={`${currentHub.label} navigation`} role="navigation" id="mobile-navigation">
          <Box width="280px" p={2}>
            <Stack direction="column" spacing={1} height="100%">
              {renderOrgDisplay()}
              {currentHub.sections?.map(renderSection)}
              {currentHub.items && currentHub.items.length > 0 && (
                <Stack direction="column" spacing={0.25}>
                  {currentHub.items.map(renderNavItem)}
                </Stack>
              )}
            </Stack>
          </Box>
        </nav>
      </SwipeableDrawer>
    );
  }

  // Collapsed icon-only sidebar (desktop only)
  if (!isVisible && !isMobile) {
    return (
      <nav
        aria-label={`${currentHub.label} navigation (collapsed)`}
        role="navigation"
        className="hub-sidebar hub-sidebar-collapsed"
      >
        <Box width="56px" p={1} className="hub-sidebar hub-sidebar-collapsed">
          <Stack direction="column" spacing={0.5} alignItems="center">
            {/* Collapsed org indicator */}
            <Box mb={1} sx={{ opacity: 0.7 }}>
              {user?.activeOrgLogoUrl ? (
                <Avatar
                  src={sanitizeImageUrl(user.activeOrgLogoUrl)}
                  alt={user.activeOrgName || 'Organization'}
                  sx={{ width: 24, height: 24 }}
                  variant="rounded"
                />
              ) : (
                <OrganisationsIcon
                  fontSize="small"
                  sx={{ color: 'var(--nav-section-header-text)' }}
                />
              )}
            </Box>

            {/* Collapsed nav items — icons only */}
            {currentHub.sections?.map(section => section.items.map(renderCollapsedNavItem))}

            {currentHub.items &&
              currentHub.items.length > 0 &&
              currentHub.items.map(renderCollapsedNavItem)}
          </Stack>
        </Box>
      </nav>
    );
  }

  return (
    <nav aria-label={`${currentHub.label} navigation`} role="navigation" className="hub-sidebar">
      <Box width="260px" p={2} className="hub-sidebar">
        <Stack direction="column" spacing={1} height="100%">
          {/* Primary Organization Display */}
          {renderOrgDisplay()}

          {/* Navigation Items */}
          {currentHub.sections?.map(renderSection)}

          {currentHub.items && currentHub.items.length > 0 && (
            <Stack direction="column" spacing={0.25}>
              {currentHub.items.map(renderNavItem)}
            </Stack>
          )}
        </Stack>
      </Box>
    </nav>
  );
};

// Memoize component to prevent unnecessary re-renders
export const HubSidebar = React.memo(HubSidebarBase);
