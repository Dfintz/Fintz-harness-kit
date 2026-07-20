/**
 * PermissionMatrixGrid — Resource × Action checkbox grid
 *
 * Displays a matrix where:
 * - Rows = resource types (Fleet, Ship, Member, Event, etc.)
 * - Columns = action types (View, Create, Edit, Delete, Manage, Admin)
 * - Cells = checkboxes showing whether the role/user has that permission
 *
 * Supports both read-only (viewing) and edit mode (toggling permissions).
 *
 * Wave 3.3 — Role & Permission UI Improvements
 */
import {
  useAddPermissionToRole,
  useRemovePermissionFromRole,
  useRolePermissions,
} from '@/hooks/queries/usePermissionQueries';
import { logger } from '@/utils/logger';
import {
  Alert,
  Box,
  Checkbox,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useMemo } from 'react';

// ============================================================================
// Constants
// ============================================================================

const RESOURCE_TYPES = [
  { key: 'fleet', label: 'Fleet' },
  { key: 'ship', label: 'Ship' },
  { key: 'member', label: 'Member' },
  { key: 'event', label: 'Event' },
  { key: 'finance', label: 'Finance' },
  { key: 'contract', label: 'Contract' },
  { key: 'recruitment', label: 'Recruitment' },
  { key: 'logistics', label: 'Logistics' },
  { key: 'settings', label: 'Settings' },
  { key: 'permissions', label: 'Permissions' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'intel', label: 'Intel' },
  { key: 'org', label: 'Organization' },
  { key: 'activity', label: 'Activity' },
] as const;

const ACTION_TYPES = [
  { key: 'read', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'manage', label: 'Manage' },
] as const;

// ============================================================================
// Types
// ============================================================================

interface PermissionMatrixGridProps {
  /** Role ID to display/edit permissions for */
  readonly roleId: string;
  /** Whether the grid is editable */
  readonly editable?: boolean;
  /** Organization ID (for cache invalidation) */
  readonly organizationId?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getPermissionTooltip(
  isWildcard: boolean,
  isInherited: boolean,
  has: boolean,
  resource: string,
  action: string
): string {
  if (isWildcard) {
    return 'Granted via wildcard (*)';
  }
  if (isInherited) {
    return `Granted via ${resource}:*`;
  }
  if (has) {
    return `${resource}:${action}`;
  }
  return 'Not granted';
}

// ============================================================================
// Component
// ============================================================================

export const PermissionMatrixGrid: React.FC<PermissionMatrixGridProps> = ({
  roleId,
  editable = false,
  organizationId: _organizationId,
}) => {
  const { data: rolePermData, isLoading, error } = useRolePermissions(roleId);
  const addPermission = useAddPermissionToRole();
  const removePermission = useRemovePermissionFromRole();

  // Parse permissions into a Set for quick lookup
  const permissionSet = useMemo(() => {
    const perms = rolePermData?.permissions ?? [];
    const set = new Set<string>();
    for (const perm of perms) {
      set.add(perm.toLowerCase());
    }
    return set;
  }, [rolePermData]);

  const hasPermission = (resource: string, action: string): boolean => {
    return (
      permissionSet.has(`${resource}:${action}`) ||
      permissionSet.has(`${resource}:*`) ||
      permissionSet.has('*')
    );
  };

  const isWildcard = permissionSet.has('*');

  const handleToggle = (resource: string, action: string) => {
    if (!editable) {
      return;
    }
    const permKey = `${resource}:${action}`;
    const has = permissionSet.has(permKey);

    if (has) {
      removePermission.mutate(
        { roleId, permissionId: permKey },
        {
          onError: err => {
            logger.error(
              'Failed to remove permission',
              err instanceof Error ? err : new Error(String(err))
            );
          },
        }
      );
    } else {
      addPermission.mutate(
        { roleId, permissionId: permKey },
        {
          onError: err => {
            logger.error(
              'Failed to add permission',
              err instanceof Error ? err : new Error(String(err))
            );
          },
        }
      );
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load role permissions.</Alert>;
  }

  const isPending = addPermission.isPending || removePermission.isPending;

  return (
    <TableContainer sx={{ maxHeight: 400 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, minWidth: 120 }}>Resource</TableCell>
            {ACTION_TYPES.map(action => (
              <TableCell key={action.key} align="center" sx={{ fontWeight: 600, minWidth: 70 }}>
                {action.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {RESOURCE_TYPES.map(resource => (
            <TableRow key={resource.key} hover>
              <TableCell>
                <Typography variant="body2">{resource.label}</Typography>
              </TableCell>
              {ACTION_TYPES.map(action => {
                const has = hasPermission(resource.key, action.key);
                const isExplicit = permissionSet.has(`${resource.key}:${action.key}`);
                const isInherited = has && !isExplicit;

                return (
                  <TableCell key={action.key} align="center" padding="checkbox">
                    <Tooltip
                      title={getPermissionTooltip(
                        isWildcard,
                        isInherited,
                        has,
                        resource.key,
                        action.key
                      )}
                    >
                      <span>
                        <Checkbox
                          size="small"
                          checked={has}
                          disabled={!editable || isWildcard || isPending}
                          onChange={() => handleToggle(resource.key, action.key)}
                          sx={{
                            opacity: isInherited ? 0.5 : 1,
                          }}
                        />
                      </span>
                    </Tooltip>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
