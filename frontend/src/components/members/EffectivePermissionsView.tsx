/**
 * EffectivePermissionsView — Merged permissions from all sources
 *
 * Shows a user's effective permissions, combining:
 * - Role-based permissions (from their assigned role)
 * - Direct permission grants (from OrganizationPermission)
 * - Member-specific overrides (from OrganizationMembership)
 *
 * Read-only component for transparency and debugging.
 *
 * Wave 3.3 — Role & Permission UI Improvements
 */
import { useUserPermissions, useUserRole } from '@/hooks/queries/usePermissionQueries';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface EffectivePermissionsViewProps {
  /** Organization ID */
  readonly organizationId: string;
  /** User ID to view permissions for */
  readonly userId: string;
  /** Optional compact mode */
  readonly compact?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

interface GroupedPermissions {
  [resource: string]: string[];
}

function groupPermissions(permissions: string[]): GroupedPermissions {
  const grouped: GroupedPermissions = {};
  for (const perm of permissions) {
    const [resource, action] = perm.split(':');
    if (!resource) {
      continue;
    }
    if (!grouped[resource]) {
      grouped[resource] = [];
    }
    grouped[resource].push(action ?? '*');
  }
  return grouped;
}

function formatResource(resource: string): string {
  return resource.charAt(0).toUpperCase() + resource.slice(1);
}

function normalizePermissionKeys(
  permissions: ReadonlyArray<string | Record<string, unknown>>
): string[] {
  return permissions
    .flatMap(permission => {
      if (typeof permission === 'string') {
        return permission;
      }

      if (permission.granted === false) {
        return [];
      }

      const resource =
        typeof permission.resource === 'string' ? permission.resource.trim() : undefined;
      const action = typeof permission.action === 'string' ? permission.action.trim() : undefined;

      if (resource && action) {
        return `${resource}:${action}`;
      }

      if (typeof permission.name === 'string' && permission.name.trim()) {
        return permission.name.trim();
      }

      return [];
    })
    .filter(Boolean);
}

interface PermissionSimulationResult {
  allowed: boolean;
  explanation: string;
  checkedKeys: string[];
}

function simulatePermission(
  permissionSet: ReadonlySet<string>,
  resource: string,
  action: string
): PermissionSimulationResult {
  const normalizedResource = resource.trim().toLowerCase();
  const normalizedAction = action.trim().toLowerCase();
  const checkedKeys = [
    `${normalizedResource}:${normalizedAction}`,
    `${normalizedResource}:*`,
    `*:${normalizedAction}`,
    '*:*',
  ];

  const matchedKey = checkedKeys.find(key => permissionSet.has(key));
  if (matchedKey) {
    return {
      allowed: true,
      explanation: `Allowed because "${matchedKey}" is present in effective permissions.`,
      checkedKeys,
    };
  }

  return {
    allowed: false,
    explanation:
      'Denied because no matching permission key was found for this resource/action pair.',
    checkedKeys,
  };
}

// ============================================================================
// Component
// ============================================================================

export const EffectivePermissionsView: React.FC<EffectivePermissionsViewProps> = ({
  organizationId,
  userId,
  compact = false,
}) => {
  const [simulateResource, setSimulateResource] = useState('fleet');
  const [simulateAction, setSimulateAction] = useState('read');
  const [simulationResult, setSimulationResult] = useState<PermissionSimulationResult | null>(null);

  const {
    data: permissions = [],
    isLoading: permsLoading,
    error: permsError,
  } = useUserPermissions(organizationId, userId);
  const { data: userRole, isLoading: roleLoading } = useUserRole(organizationId, userId);

  const permissionKeys = useMemo(
    () =>
      normalizePermissionKeys(
        permissions as unknown as ReadonlyArray<string | Record<string, unknown>>
      ),
    [permissions]
  );
  const permissionSet = useMemo(() => new Set(permissionKeys), [permissionKeys]);
  const roleName = useMemo(() => {
    if (!userRole) {
      return null;
    }
    if (typeof userRole === 'string') {
      return userRole;
    }
    if (typeof userRole === 'object' && 'name' in userRole && typeof userRole.name === 'string') {
      return userRole.name;
    }
    return null;
  }, [userRole]);

  const runSimulation = useCallback(() => {
    const resource = simulateResource.trim();
    const action = simulateAction.trim();
    if (!resource || !action) {
      setSimulationResult({
        allowed: false,
        explanation: 'Enter both resource and action to simulate access.',
        checkedKeys: [],
      });
      return;
    }

    setSimulationResult(simulatePermission(permissionSet, resource, action));
  }, [simulateResource, simulateAction, permissionSet]);

  const grouped = useMemo(() => {
    if (permissionKeys.length === 0) {
      return {};
    }
    return groupPermissions(permissionKeys);
  }, [permissionKeys]);

  const isLoading = permsLoading || roleLoading;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (permsError) {
    return <Alert severity="error">Failed to load user permissions.</Alert>;
  }

  const resources = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  const totalPermissions = permissionKeys.length;

  if (totalPermissions === 0) {
    return <Alert severity="info">No permissions found for this user.</Alert>;
  }

  return (
    <Box>
      {/* Header */}
      {!compact && (
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Effective Permissions
          </Typography>
          {roleName && (
            <Chip label={`Role: ${roleName}`} size="small" color="primary" variant="outlined" />
          )}
          <Chip label={`${totalPermissions} permissions`} size="small" variant="outlined" />
        </Stack>
      )}

      <Box
        sx={{
          border: theme => `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          p: 1.5,
          mb: 1.5,
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Permission Simulator
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <TextField
            size="small"
            label="Resource"
            value={simulateResource}
            onChange={event => setSimulateResource(event.target.value)}
            placeholder="fleet"
            sx={{ minWidth: 140 }}
          />
          <TextField
            size="small"
            label="Action"
            value={simulateAction}
            onChange={event => setSimulateAction(event.target.value)}
            placeholder="read"
            sx={{ minWidth: 120 }}
          />
          <Button variant="contained" onClick={runSimulation}>
            Check Access
          </Button>
        </Stack>

        {simulationResult && (
          <Alert severity={simulationResult.allowed ? 'success' : 'warning'} sx={{ mt: 1.5 }}>
            <Typography variant="body2">{simulationResult.explanation}</Typography>
            {simulationResult.checkedKeys.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                Checked keys: {simulationResult.checkedKeys.join(', ')}
              </Typography>
            )}
          </Alert>
        )}
      </Box>

      {/* Permission Groups */}
      <Stack spacing={1}>
        {resources.map(resource => (
          <Box key={resource}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="body2" fontWeight={600} sx={{ minWidth: 90 }}>
                {formatResource(resource)}
              </Typography>
              {grouped[resource].map(action => (
                <Chip
                  key={`${resource}:${action}`}
                  label={action}
                  size="small"
                  variant="outlined"
                  color={action === '*' ? 'warning' : 'default'}
                  sx={{ fontSize: '0.7rem' }}
                />
              ))}
            </Stack>
            {!compact && <Divider sx={{ mt: 1 }} />}
          </Box>
        ))}
      </Stack>
    </Box>
  );
};
