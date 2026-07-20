/**
 * User Permissions Display Component
 * Shows user's permissions within an organization with visual indicators
 */

import {
  AdminPanelSettings as AdminIcon,
  Anchor as AnchorIcon,
  Business as BusinessIcon,
  CalendarMonth as CalendarIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Groups as GroupsIcon,
  Insights as InsightsIcon,
  ListAlt as ListAltIcon,
  RocketLaunch as RocketIcon,
  Search as SearchIcon,
  SecuritySharp as SecurityIcon,
  Settings as SettingsIcon,
  Shield as ShieldIcon,
  Sports as SwordsIcon,
} from '@mui/icons-material';
import {
  alpha,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import React from 'react';

import { getStatusChipSx } from '@/utils/statusStyles';

interface Permission {
  resource: string;
  action: string;
  granted: boolean;
  scope?: string;
  resourceId?: string;
  permissionId?: string;
}

interface UserPermissionsDisplayProps {
  permissions: Permission[];
  securityLevel?: number;
  roleName?: string;
  showSecurityLevel?: boolean;
}

export const UserPermissionsDisplay: React.FC<UserPermissionsDisplayProps> = ({
  permissions,
  securityLevel,
  roleName,
  showSecurityLevel = true,
}) => {
  const theme = useTheme();

  // Normalize permissions: handle both object and string formats
  const normalizedPermissions: Permission[] = (
    permissions as (Permission | string | Record<string, unknown>)[]
  ).map(perm => {
    if (typeof perm === 'string') {
      const parts = perm.split(':');
      return { resource: parts[0] || 'general', action: parts[1] || perm, granted: true };
    }
    const p = perm as unknown as Record<string, unknown>;
    // Handle { name: 'resource:action' } format
    if (typeof p.name === 'string' && !p.action) {
      const parts = p.name.split(':');
      return {
        resource: parts[0] || 'general',
        action: parts[1] || p.name,
        granted: p.granted !== false,
      };
    }
    return {
      resource: String(p.resource ?? 'general'),
      action: String(p.action ?? 'access'),
      granted: p.granted !== false,
      scope: p.scope as string | undefined,
      resourceId: p.resourceId as string | undefined,
      permissionId: p.permissionId as string | undefined,
    };
  });

  // Group permissions by resource
  const groupedPermissions = normalizedPermissions.reduce(
    (acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  const getSecurityLevelLabel = (level: number): string => {
    if (level >= 1 && level <= 3) return 'Public/Low';
    if (level >= 4 && level <= 6) return 'Restricted/Medium';
    if (level >= 7 && level <= 9) return 'Confidential/High';
    if (level === 10) return 'Top Secret';
    return 'Unknown';
  };

  const getResourceIcon = (resource: string): React.ReactNode => {
    const iconSx = { fontSize: '1.5rem', color: 'text.secondary' };
    const icons: Record<string, React.ReactNode> = {
      users: <GroupsIcon sx={iconSx} />,
      organizations: <BusinessIcon sx={iconSx} />,
      ships: <RocketIcon sx={iconSx} />,
      fleet: <AnchorIcon sx={iconSx} />,
      events: <CalendarIcon sx={iconSx} />,
      intelligence: <SearchIcon sx={iconSx} />,
      operations: <SwordsIcon sx={iconSx} />,
      analytics: <InsightsIcon sx={iconSx} />,
      settings: <SettingsIcon sx={iconSx} />,
      admin: <AdminIcon sx={iconSx} />,
    };
    return icons[resource] || <ListAltIcon sx={iconSx} />;
  };

  const formatResourceName = (resource: string): string => {
    return resource
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatActionName = (action: string | undefined | null): string => {
    if (!action) return 'Access';
    const actionMap: Record<string, string> = {
      create: 'Create',
      read: 'View',
      update: 'Edit',
      delete: 'Delete',
      manage: 'Manage',
      assign: 'Assign',
      revoke: 'Revoke',
    };
    return actionMap[action] || action.charAt(0).toUpperCase() + action.slice(1);
  };

  return (
    <Box>
      {/* Role and Security Level Header */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
        {roleName && (
          <Chip
            icon={<ShieldIcon />}
            label={`Role: ${roleName}`}
            color="primary"
            variant="filled"
            sx={{ fontWeight: 'bold' }}
          />
        )}

        {showSecurityLevel && securityLevel !== undefined && (
          <Tooltip title={getSecurityLevelLabel(securityLevel)}>
            <Chip
              icon={<SecurityIcon />}
              label={`Security Level ${securityLevel}`}
              sx={{
                ...getStatusChipSx(`security-level-${securityLevel}`, theme),
                fontWeight: 'bold',
              }}
            />
          </Tooltip>
        )}
      </Box>

      {/* Permissions by Resource */}
      <Grid container spacing={2}>
        {Object.entries(groupedPermissions).map(([resource, perms]) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={resource}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Box display="flex" alignItems="center">
                    {getResourceIcon(resource)}
                  </Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {formatResourceName(resource)}
                  </Typography>
                </Box>

                <Divider sx={{ mb: 1.5 }} />

                <Box display="flex" flexDirection="column" gap={0.75}>
                  {perms.map(perm => {
                    const permissionScope = perm.scope ?? perm.resourceId;
                    const permissionKey = permissionScope
                      ? `${perm.resource}:${perm.action}:${permissionScope}`
                      : `${perm.resource}:${perm.action}`;

                    return (
                      <Box
                        key={permissionKey}
                        display="flex"
                        alignItems="center"
                        gap={1}
                        sx={{
                          py: 0.5,
                          px: 1,
                          borderRadius: 1,
                          backgroundColor: perm.granted
                            ? alpha(theme.palette.success.main, 0.1)
                            : alpha(theme.palette.error.main, 0.1),
                        }}
                      >
                        {perm.granted ? (
                          <CheckIcon fontSize="small" sx={{ color: 'success.main' }} />
                        ) : (
                          <CloseIcon fontSize="small" sx={{ color: 'error.main' }} />
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            color: perm.granted ? 'text.primary' : 'text.secondary',
                            textDecoration: perm.granted ? 'none' : 'line-through',
                          }}
                        >
                          {formatActionName(perm.action)}
                          {permissionScope && (
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{
                                ml: 0.5,
                                color: 'text.secondary',
                                fontStyle: 'italic',
                              }}
                            >
                              ({permissionScope})
                            </Typography>
                          )}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {permissions.length === 0 && (
        <Box textAlign="center" py={4}>
          <Typography color="textSecondary">No permissions assigned</Typography>
        </Box>
      )}
    </Box>
  );
};
