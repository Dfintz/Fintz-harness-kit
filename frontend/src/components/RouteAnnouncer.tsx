/**
 * RouteAnnouncer - Announces page navigation to screen readers
 *
 * When the user navigates between routes in the SPA, screen readers
 * don't automatically announce the new page. This component listens
 * for location changes and announces the new page title via an
 * aria-live region.
 *
 * WCAG 2.1 SC 4.1.3 - Status Messages
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Map route pathnames to human-readable page titles for announcements.
 * Falls back to a cleaned-up version of the pathname if not found.
 */
const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/fleet': 'Fleet Management',
  '/activities': 'Activities',
  '/trading': 'Trading',
  '/logistics': 'Logistics',
  '/intel': 'Intel Vault',
  '/intel-officer': 'Intel Officer Management',
  '/settings': 'Settings',
  '/profile': 'User Profile',
  '/privacy': 'Privacy Settings',
  '/login': 'Login',
  '/admin': 'Admin Dashboard',
  '/admin/login': 'Admin Login',
  '/org-fleet': 'Organization Fleet',
  '/org-profile': 'Organization Profile',
  '/directory': 'Public Directories',
  '/directories': 'Public Directories',
  '/discord-settings': 'Discord Settings',
  '/notifications': 'Notifications',
  '/fleet/ships': 'Organization Ships',
  '/fleet/loans': 'Ship Loans',
  '/fleet/compare': 'Ship Comparison',
  '/hangar': 'Personal Hangar',
  '/personal-hangar': 'Personal Hangar',
  '/org-ships': 'Organization Ships',
  '/user-ships': 'User Ships',
  '/recruitment': 'Recruitment',
  '/verify-deletion': 'Verify Account Deletion',
  '/org-deletion-status': 'Organization Deletion Status',
};

/**
 * Derive a human-readable title from a pathname.
 * - Checks ROUTE_TITLES map first
 * - Falls back to cleaning up the last segment of the path
 */
function getPageTitle(pathname: string, search: string = ''): string {
  if (pathname === '/activities') {
    const params = new URLSearchParams(search);
    const tab = params.get('tab');
    const legacyView = params.get('view');
    if (tab === 'calendar' || legacyView === 'calendar') {
      return 'Calendar';
    }
  }

  // Exact match
  if (ROUTE_TITLES[pathname]) {
    return ROUTE_TITLES[pathname];
  }

  // Try matching the first two segments (e.g., /admin/login)
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 2) {
    const twoSegment = `/${segments[0]}/${segments[1]}`;
    if (ROUTE_TITLES[twoSegment]) {
      return ROUTE_TITLES[twoSegment];
    }
  }

  // Try matching just the first segment
  if (segments.length >= 1) {
    const oneSegment = `/${segments[0]}`;
    if (ROUTE_TITLES[oneSegment]) {
      return ROUTE_TITLES[oneSegment];
    }
  }

  // Fallback: clean up the last path segment
  const lastSegment = segments.at(-1) || 'Page';
  return lastSegment.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Component that announces route changes to screen readers.
 * Place this inside the router context (e.g., in RootLayout).
 */
export const RouteAnnouncer: React.FC = () => {
  const location = useLocation();
  const prevLocationRef = useRef(`${location.pathname}${location.search}`);
  const announcerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const routeKey = `${location.pathname}${location.search}`;

    // Don't announce on initial render
    if (prevLocationRef.current === routeKey) {
      return;
    }

    prevLocationRef.current = routeKey;
    const title = getPageTitle(location.pathname, location.search);

    // Clear then set to trigger screen reader announcement
    if (announcerRef.current) {
      announcerRef.current.textContent = '';
      requestAnimationFrame(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = `Navigated to ${title}`;
        }
      });
    }
  }, [location.pathname, location.search]);

  return (
    <div
      ref={announcerRef}
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    />
  );
};
