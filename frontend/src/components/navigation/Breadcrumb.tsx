/**
 * Breadcrumb Component
 *
 * Displays hierarchical navigation breadcrumbs with support for:
 * - Static and dynamic breadcrumb trails
 * - Hub context awareness
 * - Mobile-responsive collapsing
 * - Keyboard navigation (ARIA compliant)
 *
 * @module navigation/Breadcrumb
 */

import { Link, Breadcrumbs as MUIBreadcrumbs, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import './Breadcrumb.css';
import { BreadcrumbItem, generateBreadcrumbs } from './breadcrumbConfig';

export interface BreadcrumbProps {
  /** Optional data for resolving dynamic labels (e.g., entity names) */
  data?: Record<string, any>;
  /** Whether to show breadcrumbs (controlled externally) */
  isVisible?: boolean;
  /** Maximum items to show before collapsing (mobile) */
  maxItems?: number;
  /** Custom CSS class */
  className?: string;
}

/**
 * Breadcrumb navigation component
 *
 * Automatically generates breadcrumbs based on current route pathname
 * using the breadcrumbConfig. Supports dynamic segment resolution.
 *
 * @example
 * ```tsx
 * // Simple usage - auto-generates from route
 * <Breadcrumb />
 *
 * // With dynamic data
 * <Breadcrumb data={{ orgName: 'Alpha Squadron', userName: 'John Doe' }} />
 *
 * // Mobile-optimized (show only 3 items)
 * <Breadcrumb maxItems={3} />
 * ```
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  data,
  isVisible = true,
  maxItems,
  className,
}) => {
  const location = useLocation();

  // Generate breadcrumbs for current route
  const breadcrumbs = useMemo(
    () =>
      generateBreadcrumbs(
        {
          pathname: location.pathname,
          search: location.search,
        },
        data
      ),
    [location.pathname, location.search, data]
  );

  // Apply mobile collapsing if maxItems specified
  const displayBreadcrumbs = useMemo(() => {
    if (!maxItems || breadcrumbs.length <= maxItems) {
      return breadcrumbs;
    }

    // Show first item, ellipsis, and last (maxItems - 1) items
    const ellipsisItem: BreadcrumbItem = {
      label: '...',
      path: '#',
      isDynamic: false,
    };

    const firstItem = breadcrumbs[0];
    const lastItems = breadcrumbs.slice(-(maxItems - 1));

    return [firstItem, ellipsisItem, ...lastItems];
  }, [breadcrumbs, maxItems]);

  // Don't render if hidden or no breadcrumbs
  if (!isVisible || breadcrumbs.length === 0) {
    return null;
  }

  // Don't render if only Home/Dashboard (at root path - not useful)
  // After refactoring, root returns 2 items: Home and Dashboard
  if (breadcrumbs.length <= 2 && breadcrumbs.every(b => b.path === '/')) {
    return null;
  }

  return (
    <nav className={`breadcrumb-nav ${className || ''}`} aria-label="Breadcrumb navigation">
      <MUIBreadcrumbs
        aria-label="breadcrumb"
        className="breadcrumb-container"
        sx={{ fontSize: '0.875rem' }}
      >
        {displayBreadcrumbs.map((item, index) => {
          const isLast = index === displayBreadcrumbs.length - 1;
          const isEllipsis = item.label === '...';

          if (isLast || isEllipsis || item.path === '#') {
            return (
              <Typography
                key={item.path + index}
                color={isLast ? 'text.primary' : 'text.secondary'}
                className={`
                  breadcrumb-item
                  ${isLast ? 'breadcrumb-item--last' : ''}
                  ${isEllipsis ? 'breadcrumb-item--ellipsis' : ''}
                `.trim()}
              >
                {item.label}
              </Typography>
            );
          }

          return (
            <Link
              key={item.path + index}
              component={RouterLink}
              to={item.path}
              underline="hover"
              color="inherit"
              className="breadcrumb-item breadcrumb-link"
            >
              {item.label}
            </Link>
          );
        })}
      </MUIBreadcrumbs>
    </nav>
  );
};
