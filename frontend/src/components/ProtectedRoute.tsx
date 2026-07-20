/**
 * Protected Route Component
 *
 * Wraps routes that require authentication and optionally specific roles/permissions.
 * Redirects unauthenticated users to the login page.
 *
 * @module components/ProtectedRoute
 */

import { selectIsAuthenticated, selectUser, useAuthStore } from '@/store/authStore';
import type { Permission, UserRole } from '@/types/store';
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingSpinner } from './LoadingSpinner';

interface ProtectedRouteProps {
  /** The content to render if authenticated */
  children: React.ReactNode;
  /** Required roles to access this route (optional) */
  requiredRoles?: UserRole[];
  /** Required permissions to access this route (optional) */
  requiredPermissions?: Permission[];
  /** Redirect path if authentication fails */
  redirectTo?: string;
  /** Whether all required permissions must be present, or just one (default: false = any) */
  requireAllPermissions?: boolean;
  /** Whether the user must belong to an organization to access this route */
  requireOrganization?: boolean;
}

/**
 * ProtectedRoute component that guards routes requiring authentication
 *
 * Features:
 * - Redirects unauthenticated users to login
 * - Supports role-based access control
 * - Supports permission-based access control
 * - Preserves the original location for post-login redirect
 * - Shows loading state while checking authentication
 *
 * @example
 * // Basic protected route
 * <ProtectedRoute>
 *   <Dashboard />
 * </ProtectedRoute>
 *
 * @example
 * // Role-restricted route
 * <ProtectedRoute requiredRoles={['admin', 'moderator']}>
 *   <AdminDashboard />
 * </ProtectedRoute>
 *
 * @example
 * // Permission-restricted route
 * <ProtectedRoute requiredPermissions={['fleet.edit']} requireAllPermissions>
 *   <FleetEditor />
 * </ProtectedRoute>
 */

/**
 * Check if the user satisfies role requirements.
 * Returns a redirect path/state if the check fails, or null if it passes.
 */
function checkRoleAccess(
  user: { role: UserRole; permissions?: Permission[] },
  requiredRoles: UserRole[] | undefined,
  location: ReturnType<typeof useLocation>
): React.ReactElement | null {
  if (!requiredRoles || requiredRoles.length === 0) {
    return null;
  }
  if (requiredRoles.includes(user.role)) {
    return null;
  }
  if (requiredRoles.includes('admin')) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }
  return (
    <Navigate
      to="/dashboard"
      state={{ error: 'You do not have permission to access this page.' }}
      replace
    />
  );
}

/**
 * Check if the user satisfies permission requirements.
 * Returns a redirect element if the check fails, or null if it passes.
 */
function checkPermissionAccess(
  user: { permissions?: Permission[] },
  requiredPermissions: Permission[] | undefined,
  requireAll: boolean
): React.ReactElement | null {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return null;
  }
  const userPermissions = user.permissions || [];
  const hasAccess = requireAll
    ? requiredPermissions.every(p => userPermissions.includes(p))
    : requiredPermissions.some(p => userPermissions.includes(p));

  if (hasAccess) {
    return null;
  }
  return (
    <Navigate
      to="/dashboard"
      state={{ error: 'You do not have permission to access this page.' }}
      replace
    />
  );
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  requiredPermissions,
  redirectTo = '/login',
  requireAllPermissions = false,
  requireOrganization = false,
}) => {
  const location = useLocation();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore(selectUser);
  const loading = useAuthStore(state => state.loading);
  const checkAuth = useAuthStore(state => state.checkAuth);
  const tryAuthWithCookies = useAuthStore(state => state.tryAuthWithCookies);
  const [hasTriedCookieAuth, setHasTriedCookieAuth] = React.useState(false);
  const [isTryingCookieAuth, setIsTryingCookieAuth] = React.useState(false);
  const isMountedRef = React.useRef(true);

  // Try to authenticate with cookies on first mount if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated && !hasTriedCookieAuth && !isTryingCookieAuth) {
      setIsTryingCookieAuth(true);
      tryAuthWithCookies().finally(() => {
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setHasTriedCookieAuth(true);
          setIsTryingCookieAuth(false);
        }
      });
    }
  }, [isAuthenticated, hasTriedCookieAuth, isTryingCookieAuth, tryAuthWithCookies]);

  // Cleanup: mark component as unmounted
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Check if authentication is still valid when authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      checkAuth();
    }
  }, [isAuthenticated, checkAuth]);

  // Show loading while checking authentication state
  if (loading || isTryingCookieAuth || (!isAuthenticated && !hasTriedCookieAuth)) {
    return <LoadingSpinner />;
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check role requirements
  const roleRedirect = checkRoleAccess(user, requiredRoles, location);
  if (roleRedirect) {
    return roleRedirect;
  }

  // Check permission requirements
  const permissionRedirect = checkPermissionAccess(
    user,
    requiredPermissions,
    requireAllPermissions
  );
  if (permissionRedirect) {
    return permissionRedirect;
  }

  // Check organization requirement — activeOrgId is the field the backend
  // tenantContextMiddleware actually checks; organizationId alone is not enough.
  if (requireOrganization && !user.activeOrgId) {
    return (
      <Navigate
        to="/dashboard"
        state={{ error: 'You must belong to an organization to access this page.' }}
        replace
      />
    );
  }

  // All checks passed - render children
  return <>{children}</>;
};
