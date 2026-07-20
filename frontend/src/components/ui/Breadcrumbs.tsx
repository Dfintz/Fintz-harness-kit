import React from 'react';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import { Breadcrumbs as MUIBreadcrumbs, Link, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';

/**
 * Route configuration for breadcrumb labels
 */
const routeLabels: Record<string, string> = {
  '': 'Dashboard',
  dashboard: 'Dashboard',
  fleet: 'Fleet',
  ships: 'Ships',
  members: 'Members',
  organizations: 'Organizations',
  organization: 'Organization',
  activities: 'Activities',
  calendar: 'Calendar',
  trading: 'Trading',
  routes: 'Routes',
  logistics: 'Logistics',
  inventory: 'Inventory',
  recruitment: 'Recruitment',
  discord: 'Discord',
  settings: 'Settings',
  profile: 'Profile',
  admin: 'Admin',
  users: 'Users',
  permissions: 'Permissions',
  security: 'Security',
  integrations: 'Integrations',
  analytics: 'Analytics',
  reports: 'Reports',
  new: 'New',
  edit: 'Edit',
  view: 'View',
  import: 'Import',
  export: 'Export',
};

interface BreadcrumbItem {
  key: string;
  label: string;
  path: string;
  isLast: boolean;
}

/**
 * Generate breadcrumb items from the current path
 */
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const pathParts = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  // Always start with Dashboard
  breadcrumbs.push({
    key: 'home',
    label: 'Dashboard',
    path: '/',
    isLast: pathParts.length === 0,
  });

  // Build breadcrumbs from path parts
  let currentPath = '';
  pathParts.forEach((part, index) => {
    currentPath += `/${part}`;

    // Check if this is a UUID or dynamic segment
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part);
    const isNumericId = /^\d+$/.test(part);

    let label: string;
    if (isUuid || isNumericId) {
      // For IDs, use a generic label based on previous segment
      const prevPart = pathParts[index - 1];
      if (prevPart) {
        const singularLabel = routeLabels[prevPart]?.replace(/s$/, '') || 'Item';
        label = `${singularLabel} Details`;
      } else {
        label = 'Details';
      }
    } else {
      label = routeLabels[part] || part.charAt(0).toUpperCase() + part.slice(1);
    }

    breadcrumbs.push({
      key: currentPath,
      label,
      path: currentPath,
      isLast: index === pathParts.length - 1,
    });
  });

  return breadcrumbs;
}

interface BreadcrumbsProps {
  /** Custom items to override automatic generation */
  items?: { label: string; path?: string }[];
  /** Additional CSS class name */
  className?: string;
  /** Show home icon */
  showHomeIcon?: boolean;
  /** Maximum items to show before collapsing */
  maxItems?: number;
}

/**
 * Breadcrumbs component for navigation context
 *
 * Automatically generates breadcrumbs from the current route,
 * or accepts custom items for manual control.
 *
 * @example
 * // Automatic breadcrumbs
 * <Breadcrumbs />
 *
 * @example
 * // Custom breadcrumbs
 * <Breadcrumbs items={[
 *   { label: 'Dashboard', path: '/' },
 *   { label: 'Fleet', path: '/fleet' },
 *   { label: 'Edit Ship' }
 * ]} />
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  className = '',
  showHomeIcon = true,
  maxItems = 5,
}) => {
  const location = useLocation();

  // Use custom items or generate from path
  const breadcrumbItems = items
    ? items.map((item, index) => ({
        key: item.path || `item-${index}`,
        label: item.label,
        path: item.path || '',
        isLast: index === items.length - 1,
      }))
    : generateBreadcrumbs(location.pathname);

  // Collapse if too many items
  let displayItems = breadcrumbItems;
  if (breadcrumbItems.length > maxItems) {
    const first = breadcrumbItems.slice(0, 1);
    const last = breadcrumbItems.slice(-2);
    displayItems = [...first, { key: 'ellipsis', label: '...', path: '', isLast: false }, ...last];
  }

  // Don't show breadcrumbs on dashboard
  if (breadcrumbItems.length <= 1) {
    return null;
  }

  // Helper to render home icon if needed
  const renderHomeIcon = (isHome: boolean) => {
    return showHomeIcon && isHome ? <HomeIcon fontSize="small" /> : null;
  };

  return (
    <nav
      className={`breadcrumbs ${className}`}
      aria-label="Breadcrumb"
      style={{
        marginBottom: '16px',
      }}
    >
      <MUIBreadcrumbs aria-label="breadcrumb">
        {displayItems.map(item => {
          const isHome = item.key === 'home';

          if (item.isLast || !item.path || item.key === 'ellipsis') {
            return (
              <Typography
                key={item.key}
                color="text.primary"
                sx={{
                  fontWeight: item.isLast ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                {renderHomeIcon(isHome)}
                {item.label}
              </Typography>
            );
          }

          return (
            <Link
              key={item.key}
              component={RouterLink}
              to={item.path}
              underline="hover"
              color="inherit"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              {renderHomeIcon(isHome)}
              {item.label}
            </Link>
          );
        })}
      </MUIBreadcrumbs>
    </nav>
  );
};

/**
 * Simple breadcrumbs without Spectrum (fallback)
 */
export const SimpleBreadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  className = '',
  showHomeIcon = true,
}) => {
  const location = useLocation();

  const breadcrumbItems = items
    ? items.map((item, index) => ({
        key: item.path || `item-${index}`,
        label: item.label,
        path: item.path || '',
        isLast: index === items.length - 1,
      }))
    : generateBreadcrumbs(location.pathname);

  if (breadcrumbItems.length <= 1) {
    return null;
  }

  return (
    <nav
      className={`breadcrumbs-simple ${className}`}
      aria-label="Breadcrumb"
      style={{
        marginBottom: '16px',
      }}
    >
      <MUIBreadcrumbs aria-label="breadcrumb">
        {breadcrumbItems.map(item => {
          const isHome = item.key === 'home';
          const showIcon = showHomeIcon && isHome;

          if (item.isLast || !item.path) {
            return (
              <Typography
                key={item.key}
                color="text.primary"
                sx={{
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                {showIcon && <HomeIcon fontSize="small" />}
                {item.label}
              </Typography>
            );
          }

          return (
            <Link
              key={item.key}
              component={RouterLink}
              to={item.path}
              underline="hover"
              color="inherit"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              {showIcon && <HomeIcon fontSize="small" />}
              {item.label}
            </Link>
          );
        })}
      </MUIBreadcrumbs>
    </nav>
  );
};
