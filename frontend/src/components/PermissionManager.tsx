/**
 * PermissionManager
 *
 * Manages user permissions, security levels, and inter-org security.
 * Migrated to MUI + permissionService/securityLevelService + React Query hooks.
 *
 * Sprint 0.5 — Wire Unwired Features
 */

import DeleteIcon from '@mui/icons-material/Delete';
import SecurityIcon from '@mui/icons-material/Security';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';

import { useAlliances } from '@/hooks/queries/useAllianceQueries';
import { useMyFederations } from '@/hooks/queries/useFederationManagementQueries';
import { useOrganizationMembers } from '@/hooks/queries/useOrganizationQueries';
import {
  useGrantPermission,
  useRevokePermission,
  useUpdateSecurityLevel,
  useUserPermissions,
} from '@/hooks/queries/usePermissionQueries';
import { useOrgRelationships } from '@/hooks/queries/useRelationshipQueries';
import { useOrgSecurityLevels, useSetSecurityLevel } from '@/hooks/queries/useSecurityLevelQueries';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import { buildRelatedOrganizationOptions } from '@/utils/relatedOrganizationOptions';
import { UserPermissionsDisplay } from './UserPermissionsDisplay';

interface PermissionManagerProps {
  userId: string;
  organizationId: string;
}

const SECURITY_LEVEL_MARKS = [
  { value: 1, label: 'Basic' },
  { value: 2, label: 'Standard' },
  { value: 3, label: 'Elevated' },
  { value: 4, label: 'High' },
  { value: 5, label: 'Maximum' },
];

const SECURITY_LEVEL_DESC: Record<number, string> = {
  1: 'Standard member access',
  2: 'Access to routine operations',
  3: 'Access to sensitive operations',
  4: 'Access to critical resources',
  5: 'Full clearance, administrative access',
};

export const PermissionManager: React.FC<Readonly<PermissionManagerProps>> = ({
  userId,
  organizationId,
}) => {
  const [activeTab, setActiveTab] = useState(0);

  // Fetch diplomatic relationships to populate target org dropdown
  const { data: relationshipsData, isLoading: relationshipsLoading } =
    useOrgRelationships(organizationId);
  const { data: alliances = [], isLoading: alliancesLoading } = useAlliances();
  const { data: federations = [], isLoading: federationsLoading } = useMyFederations();
  const relatedOrgs = useMemo(() => {
    return buildRelatedOrganizationOptions({
      organizationId,
      relationships: relationshipsData?.data ?? [],
      alliances,
      federations,
    });
  }, [organizationId, relationshipsData, alliances, federations]);
  const relatedOrgsLoading = relationshipsLoading || alliancesLoading || federationsLoading;

  // Fetch org members for the target user dropdown
  const { data: membersData } = useOrganizationMembers(organizationId, { limit: 100 });
  const orgMembers = membersData?.items ?? [];

  // Permission form state
  const [newPermission, setNewPermission] = useState({
    targetUserId: '',
    resource: 'events',
    action: 'read',
    scope: '',
    conditions: '',
    priority: 50,
    expiresAt: '',
  });

  // Security level form state
  const [newSecurityLevel, setNewSecurityLevel] = useState({
    targetUserId: '',
    level: 1,
  });

  // Inter-org security form state
  const [newInterOrgSecurity, setNewInterOrgSecurity] = useState({
    toOrganizationId: '',
    level: 1,
    resourceType: 'events',
    accessLevel: 'read',
  });

  const notification = useNotification();

  // ============================================================================
  // Queries & Mutations
  // ============================================================================

  const {
    data: permissions = [],
    isLoading: permissionsLoading,
    error: permissionsError,
  } = useUserPermissions(organizationId, userId);

  const {
    data: securityLevels = [],
    isLoading: securityLevelsLoading,
    error: securityLevelsError,
  } = useOrgSecurityLevels(organizationId);

  const grantPermission = useGrantPermission();
  const revokePermission = useRevokePermission();
  const updateSecurityLevel = useUpdateSecurityLevel();
  const setSecurityLevel = useSetSecurityLevel();

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await grantPermission.mutateAsync({
        organizationId,
        userId: newPermission.targetUserId,
        resource: newPermission.resource,
        action: newPermission.action,
        scope: newPermission.scope.trim() || undefined,
        conditions: newPermission.conditions.trim() || undefined,
        priority: newPermission.priority,
        expiresAt: newPermission.expiresAt ? new Date(newPermission.expiresAt) : undefined,
      });
      setNewPermission({
        targetUserId: '',
        resource: 'events',
        action: 'read',
        scope: '',
        conditions: '',
        priority: 50,
        expiresAt: '',
      });
      notification.success('Permission granted successfully');
    } catch (err) {
      logger.error(
        'Error granting permission:',
        err,
        err instanceof Error ? err : new Error(String(err))
      );
      notification.error('Failed to grant permission');
    }
  };

  const handleRevokePermission = async (permission: {
    userId: string;
    resource: string;
    action: string;
    scope?: string;
    resourceId?: string;
    permissionId?: string;
  }) => {
    try {
      await revokePermission.mutateAsync({
        organizationId,
        userId: permission.userId,
        resource: permission.resource,
        action: permission.action,
        scope: permission.scope ?? permission.resourceId,
      });
      notification.success('Permission revoked successfully');
    } catch (err) {
      logger.error(
        'Error revoking permission:',
        err,
        err instanceof Error ? err : new Error(String(err))
      );
      notification.error('Failed to revoke permission');
    }
  };

  const handleUpdateSecurityLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSecurityLevel.mutateAsync({
        organizationId,
        userId: newSecurityLevel.targetUserId,
        securityLevel: newSecurityLevel.level,
      });
      setNewSecurityLevel({ targetUserId: '', level: 1 });
      notification.success('Security level updated successfully');
    } catch (err) {
      logger.error(
        'Error updating security level:',
        err,
        err instanceof Error ? err : new Error(String(err))
      );
      notification.error('Failed to update security level');
    }
  };

  const handleSetInterOrgSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setSecurityLevel.mutateAsync({
        sourceOrgId: organizationId,
        targetOrgId: newInterOrgSecurity.toOrganizationId,
        level: newInterOrgSecurity.level,
        resourceType: newInterOrgSecurity.resourceType,
        accessLevel: newInterOrgSecurity.accessLevel as 'none' | 'read' | 'write' | 'full',
      });
      setNewInterOrgSecurity({
        toOrganizationId: '',
        level: 1,
        resourceType: 'events',
        accessLevel: 'read',
      });
      notification.success('Inter-org security level set successfully');
    } catch (err) {
      logger.error(
        'Error setting inter-org security:',
        err,
        err instanceof Error ? err : new Error(String(err))
      );
      notification.error('Failed to set inter-org security level');
    }
  };

  // ============================================================================
  // Loading / Error
  // ============================================================================

  const isLoading = permissionsLoading || securityLevelsLoading;
  let errorMessage: string | null = null;
  if (permissionsError) {
    errorMessage = 'Failed to load permissions';
  } else if (securityLevelsError) {
    errorMessage = 'Failed to load security levels';
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <SecurityIcon color="primary" />
        <Typography variant="h6">Permission & Access Control Manager</Typography>
      </Stack>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="User Permissions" />
          <Tab label="Security Levels" />
          <Tab label="Inter-Org Security" />
        </Tabs>
      </Box>

      {/* Tab 0: User Permissions */}
      {activeTab === 0 && (
        <Box>
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
            <Typography variant="subtitle1" gutterBottom>
              Grant Permission
            </Typography>
            <Box component="form" onSubmit={handleGrantPermission}>
              <Stack spacing={2}>
                <FormControl size="small" fullWidth required>
                  <InputLabel>Target Member</InputLabel>
                  <Select
                    value={newPermission.targetUserId}
                    label="Target Member"
                    onChange={e =>
                      setNewPermission({ ...newPermission, targetUserId: e.target.value })
                    }
                  >
                    {orgMembers.map(m => (
                      <MenuItem key={m.userId} value={m.userId}>
                        {m.displayName || m.username || m.userId}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Resource</InputLabel>
                  <Select
                    value={newPermission.resource}
                    label="Resource"
                    onChange={e => setNewPermission({ ...newPermission, resource: e.target.value })}
                  >
                    <MenuItem value="events">Events</MenuItem>
                    <MenuItem value="ships">Ships</MenuItem>
                    <MenuItem value="missions">Missions</MenuItem>
                    <MenuItem value="fleets">Fleets</MenuItem>
                    <MenuItem value="users">Users</MenuItem>
                    <MenuItem value="permissions">Permissions</MenuItem>
                    <MenuItem value="security">Security</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Action</InputLabel>
                  <Select
                    value={newPermission.action}
                    label="Action"
                    onChange={e => setNewPermission({ ...newPermission, action: e.target.value })}
                  >
                    <MenuItem value="read">Read</MenuItem>
                    <MenuItem value="create">Create</MenuItem>
                    <MenuItem value="update">Update</MenuItem>
                    <MenuItem value="delete">Delete</MenuItem>
                    <MenuItem value="share">Share</MenuItem>
                    <MenuItem value="grant">Grant</MenuItem>
                    <MenuItem value="revoke">Revoke</MenuItem>
                    <MenuItem value="manage">Manage</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Scope ID (optional)"
                  value={newPermission.scope}
                  onChange={e => setNewPermission({ ...newPermission, scope: e.target.value })}
                  size="small"
                  fullWidth
                  helperText="Optional resource scope. Example: fleet-123"
                />
                <TextField
                  label="Conditions (optional)"
                  value={newPermission.conditions}
                  onChange={e => setNewPermission({ ...newPermission, conditions: e.target.value })}
                  size="small"
                  fullWidth
                  multiline
                  minRows={2}
                  helperText="Optional condition expression or notes"
                />
                <FormControl size="small" fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={newPermission.priority}
                    label="Priority"
                    onChange={e =>
                      setNewPermission({ ...newPermission, priority: Number(e.target.value) || 50 })
                    }
                  >
                    <MenuItem value={10}>10 (Low)</MenuItem>
                    <MenuItem value={25}>25</MenuItem>
                    <MenuItem value={50}>50 (Normal)</MenuItem>
                    <MenuItem value={75}>75</MenuItem>
                    <MenuItem value={100}>100 (High)</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Expires At (optional)"
                  type="datetime-local"
                  value={newPermission.expiresAt}
                  onChange={e => setNewPermission({ ...newPermission, expiresAt: e.target.value })}
                  size="small"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Button type="submit" variant="contained" disabled={grantPermission.isPending}>
                  {grantPermission.isPending ? 'Granting...' : 'Grant Permission'}
                </Button>
              </Stack>
            </Box>
          </Paper>

          <Typography variant="subtitle1" gutterBottom>
            Active Permissions
          </Typography>
          <UserPermissionsDisplay permissions={permissions} showSecurityLevel={false} />

          {/* Revoke controls */}
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {permissions
              .filter((p: { granted: boolean }) => p.granted)
              .map(
                (permission: {
                  userId: string;
                  resource: string;
                  action: string;
                  scope?: string;
                  resourceId?: string;
                  permissionId?: string;
                  expiresAt?: Date;
                }) => {
                  const permissionScope = permission.scope ?? permission.resourceId;
                  const permissionKey = permissionScope
                    ? `${permission.resource}:${permission.action}:${permissionScope}`
                    : `${permission.resource}:${permission.action}`;

                  return (
                    <Paper
                      key={permission.permissionId ?? permissionKey}
                      sx={{
                        p: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        bgcolor: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={permissionKey}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        {permission.expiresAt && (
                          <Typography variant="caption" color="text.secondary">
                            expires {new Date(permission.expiresAt).toLocaleDateString()}
                          </Typography>
                        )}
                      </Stack>
                      <Tooltip title="Revoke permission">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRevokePermission(permission)}
                          disabled={revokePermission.isPending}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Paper>
                  );
                }
              )}
          </Stack>
        </Box>
      )}

      {/* Tab 1: Security Levels */}
      {activeTab === 1 && (
        <Box>
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
            <Typography variant="subtitle1" gutterBottom>
              Update User Security Level
            </Typography>
            <Box component="form" onSubmit={handleUpdateSecurityLevel}>
              <Stack spacing={2}>
                <FormControl size="small" fullWidth required>
                  <InputLabel>Member</InputLabel>
                  <Select
                    value={newSecurityLevel.targetUserId}
                    label="Member"
                    onChange={e =>
                      setNewSecurityLevel({
                        ...newSecurityLevel,
                        targetUserId: e.target.value,
                      })
                    }
                  >
                    {orgMembers.map(m => (
                      <MenuItem key={m.userId} value={m.userId}>
                        {m.displayName || m.username || m.userId}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Box sx={{ px: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    Security Level: {newSecurityLevel.level}
                  </Typography>
                  <Slider
                    value={newSecurityLevel.level}
                    onChange={(_, value) =>
                      setNewSecurityLevel({
                        ...newSecurityLevel,
                        level: Array.isArray(value) ? value[0] : value,
                      })
                    }
                    min={1}
                    max={5}
                    step={1}
                    marks={SECURITY_LEVEL_MARKS}
                    valueLabelDisplay="auto"
                  />
                </Box>
                <Button type="submit" variant="contained" disabled={updateSecurityLevel.isPending}>
                  {updateSecurityLevel.isPending ? 'Updating...' : 'Update Security Level'}
                </Button>
              </Stack>
            </Box>
          </Paper>

          <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Typography variant="subtitle1" gutterBottom>
              Security Level Guide
            </Typography>
            <Stack spacing={0.5}>
              {SECURITY_LEVEL_MARKS.map(mark => (
                <Stack key={mark.value} direction="row" spacing={1} alignItems="center">
                  <Chip label={mark.value} size="small" sx={{ minWidth: 28 }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>{mark.label}:</strong> {SECURITY_LEVEL_DESC[mark.value]}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Box>
      )}

      {/* Tab 2: Inter-Org Security */}
      {activeTab === 2 && (
        <Box>
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
            <Typography variant="subtitle1" gutterBottom>
              Set Inter-Organization Security Level
            </Typography>
            <Box component="form" onSubmit={handleSetInterOrgSecurity}>
              <Stack spacing={2}>
                <FormControl size="small" fullWidth required>
                  <InputLabel>Target Organization</InputLabel>
                  <Select
                    value={newInterOrgSecurity.toOrganizationId}
                    label="Target Organization"
                    onChange={e =>
                      setNewInterOrgSecurity({
                        ...newInterOrgSecurity,
                        toOrganizationId: e.target.value,
                      })
                    }
                  >
                    {relatedOrgsLoading && (
                      <MenuItem disabled value="">
                        Loading related organizations...
                      </MenuItem>
                    )}
                    {!relatedOrgsLoading && relatedOrgs.length === 0 && (
                      <MenuItem disabled value="">
                        No diplomatic, treaty, or federation member organizations found
                      </MenuItem>
                    )}
                    {relatedOrgs.map(org => (
                      <MenuItem key={org.id} value={org.id}>
                        {org.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Resource Type</InputLabel>
                  <Select
                    value={newInterOrgSecurity.resourceType}
                    label="Resource Type"
                    onChange={e =>
                      setNewInterOrgSecurity({
                        ...newInterOrgSecurity,
                        resourceType: e.target.value,
                      })
                    }
                  >
                    <MenuItem value="events">Events</MenuItem>
                    <MenuItem value="ships">Ships</MenuItem>
                    <MenuItem value="intelligence">Intelligence</MenuItem>
                    <MenuItem value="missions">Missions</MenuItem>
                    <MenuItem value="logistics">Logistics</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Access Level</InputLabel>
                  <Select
                    value={newInterOrgSecurity.accessLevel}
                    label="Access Level"
                    onChange={e =>
                      setNewInterOrgSecurity({
                        ...newInterOrgSecurity,
                        accessLevel: e.target.value,
                      })
                    }
                  >
                    <MenuItem value="none">None</MenuItem>
                    <MenuItem value="read">Read</MenuItem>
                    <MenuItem value="write">Write</MenuItem>
                    <MenuItem value="full">Full</MenuItem>
                  </Select>
                </FormControl>
                <Box sx={{ px: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    Trust Level: {newInterOrgSecurity.level}
                  </Typography>
                  <Slider
                    value={newInterOrgSecurity.level}
                    onChange={(_, value) =>
                      setNewInterOrgSecurity({
                        ...newInterOrgSecurity,
                        level: Array.isArray(value) ? value[0] : value,
                      })
                    }
                    min={1}
                    max={5}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                  />
                </Box>
                <Button type="submit" variant="contained" disabled={setSecurityLevel.isPending}>
                  {setSecurityLevel.isPending ? 'Setting...' : 'Set Security Level'}
                </Button>
              </Stack>
            </Box>
          </Paper>

          <Typography variant="subtitle1" gutterBottom>
            Active Inter-Org Security Levels
          </Typography>
          {securityLevels.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No inter-org security levels configured
            </Typography>
          ) : (
            <Stack spacing={1}>
              {securityLevels.map(level => (
                <Paper key={level.id} sx={{ p: 2, bgcolor: 'background.paper' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle2">{level.resourceType}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        From: {level.sourceOrgName || level.sourceOrgId}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        To: {level.targetOrgName || level.targetOrgId}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={`Level ${level.level}`} size="small" color="primary" />
                      <Chip label={level.accessLevel} size="small" variant="outlined" />
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
};
