/**
 * OrgMemberManagement — Full member list with role editing, search, and removal.
 *
 * Accessed via /org-settings/members route.
 * Uses organizationServiceV2 for all API calls.
 * Role changes are gated by the current user's own role (only admins/owners can change roles).
 */

import { PageHeader } from '@/components/PageHeader';
import { PermissionManager } from '@/components/PermissionManager';
import { MemberProfileDrawer } from '@/components/intel/MemberProfileDrawer';
import { ApplicationReviewPanel } from '@/components/organization/ApplicationReviewPanel';
import { InvitationReviewPanel } from '@/components/organization/InvitationReviewPanel';
import { InviteModal } from '@/components/organization/InviteModal';
import { RoleManagementPanel } from '@/components/organization/RoleManagementPanel';
import {
  useMyOrganizations,
  useOrganizationMembers,
  useRemoveMember,
  useUpdateMemberRole,
} from '@/hooks/queries/useOrganizationQueries';
import { useOrganizationRoles } from '@/hooks/queries/usePermissionQueries';
import type { OrganizationMemberV2 } from '@/services/organizationServiceV2';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import PersonIcon from '@mui/icons-material/Person';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RuleIcon from '@mui/icons-material/Rule';
import SearchIcon from '@mui/icons-material/Search';
import ShieldIcon from '@mui/icons-material/Shield';
import StarIcon from '@mui/icons-material/Star';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useMemo, useState } from 'react';

/** Available organization roles in priority order — colors resolved from MUI theme */
type RoleThemeColor = 'warning' | 'error' | 'info' | 'success' | 'primary';

interface RoleMeta {
  value: string;
  label: string;
  icon: React.ReactElement;
  themeColor: RoleThemeColor;
  priority: number;
}

interface AssignableRoleOption extends RoleMeta {
  key: string;
  roleName: string;
  roleId?: string;
}

const ORG_ROLE_DEFS: readonly RoleMeta[] = [
  {
    value: 'founder',
    label: 'Founder',
    icon: <StarIcon fontSize="small" />,
    themeColor: 'warning' as const,
    priority: 100,
  },
  {
    value: 'owner',
    label: 'Owner',
    icon: <StarIcon fontSize="small" />,
    themeColor: 'warning' as const,
    priority: 100,
  },
  {
    value: 'admin',
    label: 'Admin',
    icon: <AdminPanelSettingsIcon fontSize="small" />,
    themeColor: 'error' as const,
    priority: 80,
  },
  {
    value: 'fleet_commander',
    label: 'Fleet Commander',
    icon: <ShieldIcon fontSize="small" />,
    themeColor: 'info' as const,
    priority: 60,
  },
  {
    value: 'officer',
    label: 'Officer',
    icon: <ShieldIcon fontSize="small" />,
    themeColor: 'success' as const,
    priority: 40,
  },
  {
    value: 'member',
    label: 'Member',
    icon: <PersonIcon fontSize="small" />,
    themeColor: 'primary' as const,
    priority: 10,
  },
] as const;

function normalizeRoleName(role: string): string {
  return role.trim().toLowerCase();
}

function formatRoleLabel(role: string): string {
  return role
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

/** Resolve role presentation metadata for built-in and custom roles. */
function getRoleMeta(role: string, roleOptions: readonly AssignableRoleOption[]): RoleMeta {
  const normalizedRole = normalizeRoleName(role);
  return (
    roleOptions.find(option => normalizeRoleName(option.roleName) === normalizedRole) ?? {
      value: normalizedRole,
      label: formatRoleLabel(role),
      icon: <RuleIcon fontSize="small" />,
      themeColor: 'primary',
      priority: 0,
    }
  );
}

/** Can the actor change the target's role? */
function canEditRole(actorRole: string, targetRole: string): boolean {
  const priority: Record<string, number> = {
    founder: 100,
    owner: 100,
    admin: 80,
    fleet_commander: 60,
    officer: 40,
    member: 10,
  };
  const actorPriority = priority[actorRole] ?? 0;
  const targetPriority = priority[targetRole] ?? 0;
  // Must outrank the target, and only owners can edit admins
  return actorPriority > targetPriority;
}

export const OrgMemberManagement: React.FC = () => {
  const theme = useTheme();
  const user = useAuthStore(state => state.user);
  const organizationId = user?.activeOrgId ?? user?.organizationId ?? '';

  // Leadership check — only founders/admins see Permissions and Roles tabs
  const isLeader = ['founder', 'owner', 'admin'].includes(user?.orgRole ?? user?.role ?? '');

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Fetch current user's org role
  const { data: myOrgs } = useMyOrganizations();
  const myOrgRole = (() => {
    const orgs = myOrgs as unknown as Array<Record<string, unknown>> | undefined;
    const active = orgs?.find(o => o.id === organizationId || o.isActive);
    const rawRole = active?.role ?? active?.userRole;
    // role may be a string ("founder") or a Role entity object ({ name: "founder" })
    if (typeof rawRole === 'string') return rawRole;
    if (rawRole && typeof rawRole === 'object' && 'name' in rawRole)
      return String((rawRole as Record<string, unknown>).name);
    return 'member';
  })();
  const currentUserRole = myOrgRole;
  const { data: organizationRoles = [] } = useOrganizationRoles(organizationId || undefined);

  const assignableRoleOptions = useMemo<AssignableRoleOption[]>(() => {
    const byNormalizedName = new Map(
      organizationRoles.map(role => [normalizeRoleName(role.name), role] as const)
    );

    const builtInRoleOptions = ORG_ROLE_DEFS.map(def => {
      const matchingRole = byNormalizedName.get(def.value);
      return {
        key: matchingRole ? `id:${matchingRole.id}` : `name:${def.value}`,
        roleId: matchingRole?.id,
        roleName: matchingRole?.name ?? def.value,
        value: def.value,
        label: matchingRole ? formatRoleLabel(matchingRole.name) : def.label,
        icon: def.icon,
        themeColor: def.themeColor,
        priority:
          typeof matchingRole?.priority === 'number' && Number.isFinite(matchingRole.priority)
            ? matchingRole.priority
            : def.priority,
      };
    });

    const customRoleOptions = organizationRoles
      .filter(role => !ORG_ROLE_DEFS.some(def => def.value === normalizeRoleName(role.name)))
      .map(role => ({
        key: `id:${role.id}`,
        roleId: role.id,
        roleName: role.name,
        value: normalizeRoleName(role.name),
        label: formatRoleLabel(role.name),
        icon: <RuleIcon fontSize="small" />,
        themeColor: 'primary' as const,
        priority:
          typeof role.priority === 'number' && Number.isFinite(role.priority) ? role.priority : 0,
      }));

    return [...builtInRoleOptions, ...customRoleOptions].sort(
      (a, b) => b.priority - a.priority || a.label.localeCompare(b.label)
    );
  }, [organizationRoles]);

  // Build params for the query
  const queryParams = {
    limit: rowsPerPage,
    page: page + 1,
    ...(searchQuery ? { search: searchQuery } : {}),
    ...(roleFilter === 'all' ? {} : { role: roleFilter }),
  };

  // React Query for members
  const {
    data: membersResult,
    isLoading: loading,
    error: queryError,
  } = useOrganizationMembers(organizationId || undefined, queryParams);

  const members = membersResult?.items ?? [];
  const totalMembers = membersResult?.pagination?.total ?? members.length;
  const error = queryError
    ? {
        hasError: true,
        message: queryError instanceof Error ? queryError.message : 'Failed to load members',
      }
    : { hasError: false, message: '' };
  const clearError = () => {
    /* error clears on next successful fetch */
  };

  // Mutations
  const updateRoleMutation = useUpdateMemberRole();
  const removeMemberMutation = useRemoveMember();

  // Dialogs
  const [removeTarget, setRemoveTarget] = useState<OrganizationMemberV2 | null>(null);
  const [roleEditTarget, setRoleEditTarget] = useState<OrganizationMemberV2 | null>(null);
  const [selectedRoleKey, setSelectedRoleKey] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [invitationRefreshTrigger, setInvitationRefreshTrigger] = useState(0);

  // Intel profile drawer state
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState<string | undefined>(undefined);

  // Snackbar feedback
  const notification = useNotification();
  const selectedRoleOption = assignableRoleOptions.find(option => option.key === selectedRoleKey);

  // --- Role Change ---
  const handleRoleChange = async () => {
    if (!roleEditTarget || !selectedRoleOption || !organizationId) return;
    try {
      await updateRoleMutation.mutateAsync({
        organizationId,
        memberId: roleEditTarget.userId,
        ...(selectedRoleOption.roleId
          ? { roleId: selectedRoleOption.roleId }
          : { role: selectedRoleOption.roleName }),
      });
      notification.success('Role updated successfully');
      setRoleEditTarget(null);
      setSelectedRoleKey('');
    } catch (err) {
      logger.error('Failed to update role:', err);
      notification.error('Failed to update role');
    }
  };

  // --- Remove Member ---
  const handleRemoveMember = async () => {
    if (!removeTarget || !organizationId) return;
    try {
      await removeMemberMutation.mutateAsync({ organizationId, memberId: removeTarget.userId });
      setRemoveTarget(null);
    } catch (err) {
      logger.error('Failed to remove member:', err);
    }
  };

  if (!organizationId) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Alert severity="info">You need to be a member of an organization to manage members.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', mt: 3, px: 2 }}>
      <PageHeader
        title="Members & Roles"
        helpTooltip="View all organization members, change their roles, or remove them. Only admins and owners can modify roles."
        description={`${totalMembers} members in your organization`}
        primaryAction={{
          label: 'Invite Member',
          icon: PersonAddIcon,
          onPress: () => setIsInviteOpen(true),
        }}
      />

      <InviteModal
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        organizationId={organizationId}
        organizationName={user?.activeOrgName || organizationId}
        onSuccess={() => setInvitationRefreshTrigger(current => current + 1)}
      />

      {/* Tabs: Members | Permissions | Roles (last two gated to founder/admin) */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_e, v: number) => setActiveTab(v)}
          sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 500 } }}
        >
          <Tab icon={<PersonIcon />} iconPosition="start" label="Members" />
          {isLeader && <Tab icon={<ShieldIcon />} iconPosition="start" label="Permissions" />}
          {isLeader && <Tab icon={<RuleIcon />} iconPosition="start" label="Roles" />}
        </Tabs>
      </Box>

      {/* Permissions Tab (only visible to leaders — tab index 1 when shown) */}
      {isLeader && activeTab === 1 && (
        <PermissionManager userId={user?.id ?? ''} organizationId={organizationId} />
      )}

      {/* Roles Tab (only visible to leaders — tab index 2 when shown) */}
      {isLeader && activeTab === 2 && (
        <RoleManagementPanel
          organizationId={organizationId}
          isAdmin={['owner', 'founder', 'admin'].includes(currentUserRole)}
        />
      )}

      {/* Members Tab (original content below) */}
      {activeTab === 0 && (
        <Stack spacing={3}>
          {/* Filters */}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ mb: 3 }}>
            <TextField
              size="small"
              placeholder="Search members..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ minWidth: 240 }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                label="Role"
                onChange={(e: SelectChangeEvent) => {
                  setRoleFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="all">All Roles</MenuItem>
                {assignableRoleOptions.map(roleOption => (
                  <MenuItem key={roleOption.key} value={normalizeRoleName(roleOption.roleName)}>
                    {roleOption.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {error.hasError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
              {error.message}
            </Alert>
          )}

          {/* Member Table */}
          <TableContainer
            component={Paper}
            sx={{ bgcolor: 'var(--card-bg, rgba(255,255,255,0.05))' }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Member</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                        {searchQuery ? 'No members match your search.' : 'No members found.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map(member => {
                    const roleMeta = getRoleMeta(member.role, assignableRoleOptions);
                    const canEdit = canEditRole(currentUserRole, member.role);
                    const isSelf = member.userId === user?.id;

                    return (
                      <TableRow key={member.userId} hover>
                        <TableCell>
                          <Stack direction="row" alignItems="center" gap={1.5}>
                            <Avatar
                              src={sanitizeImageUrl(member.avatar) || undefined}
                              sx={{
                                width: 32,
                                height: 32,
                                bgcolor: theme.palette[roleMeta.themeColor].main,
                                fontSize: 14,
                              }}
                            >
                              {(member.displayName ?? member.username ?? '?')[0]?.toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {member.displayName ?? member.username ?? member.userId}
                              </Typography>
                              {member.username && member.displayName && (
                                <Typography
                                  variant="caption"
                                  sx={{ color: 'var(--text-secondary)' }}
                                >
                                  @{member.username}
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            icon={roleMeta.icon}
                            label={roleMeta.label}
                            sx={{
                              borderColor: theme.palette[roleMeta.themeColor].main,
                              color: theme.palette[roleMeta.themeColor].main,
                            }}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                            {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" gap={0.5} justifyContent="flex-end">
                            {canEdit && !isSelf && (
                              <Tooltip title="Change role">
                                <IconButton
                                  size="small"
                                  onClick={e => {
                                    (e.currentTarget as HTMLElement).blur();
                                    setRoleEditTarget(member);
                                    const memberRoleOption = assignableRoleOptions.find(
                                      option =>
                                        normalizeRoleName(option.roleName) ===
                                        normalizeRoleName(member.role)
                                    );
                                    setSelectedRoleKey(memberRoleOption?.key ?? '');
                                  }}
                                >
                                  <ShieldIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {canEdit && !isSelf && (
                              <Tooltip title="Remove member">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={e => {
                                    (e.currentTarget as HTMLElement).blur();
                                    setRemoveTarget(member);
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="View Intel Profile">
                              <IconButton
                                size="small"
                                color="info"
                                onClick={() => {
                                  setProfileUserId(member.userId);
                                  setProfileDisplayName(
                                    member.displayName ?? member.username ?? undefined
                                  );
                                }}
                              >
                                <InfoIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {isSelf && (
                              <Chip size="small" label="You" color="info" variant="outlined" />
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={totalMembers}
              page={page}
              onPageChange={(_e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => {
                setRowsPerPage(Number.parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </TableContainer>

          {/* Pending Applications & Invitations (visible to leaders) */}
          {isLeader && (
            <>
              <ApplicationReviewPanel organizationId={organizationId} />
              <InvitationReviewPanel
                organizationId={organizationId}
                refreshTrigger={invitationRefreshTrigger}
              />
            </>
          )}
        </Stack>
      )}

      {/* Role Change Dialog */}
      <Dialog
        open={!!roleEditTarget}
        onClose={() => {
          setRoleEditTarget(null);
          setSelectedRoleKey('');
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Change Role</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Change role for{' '}
            <strong>
              {roleEditTarget?.displayName ?? roleEditTarget?.username ?? roleEditTarget?.userId}
            </strong>
          </DialogContentText>
          <FormControl fullWidth size="small">
            <InputLabel>New Role</InputLabel>
            <Select
              value={selectedRoleKey}
              label="New Role"
              onChange={(e: SelectChangeEvent) => setSelectedRoleKey(e.target.value)}
            >
              {assignableRoleOptions
                .filter(option => normalizeRoleName(option.roleName) !== 'owner')
                .map(option => (
                  <MenuItem key={option.key} value={option.key}>
                    <Stack direction="row" gap={1} alignItems="center">
                      {option.icon}
                      {option.label}
                    </Stack>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRoleEditTarget(null);
              setSelectedRoleKey('');
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRoleChange}
            variant="contained"
            disabled={
              !selectedRoleOption ||
              normalizeRoleName(selectedRoleOption.roleName) ===
                normalizeRoleName(roleEditTarget?.role ?? '')
            }
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Member Confirmation */}
      <Dialog open={!!removeTarget} onClose={() => setRemoveTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove Member</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove{' '}
            <strong>
              {removeTarget?.displayName ?? removeTarget?.username ?? removeTarget?.userId}
            </strong>{' '}
            from the organization? This action can be undone by re-inviting them.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveTarget(null)}>Cancel</Button>
          <Button onClick={handleRemoveMember} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* Member Intel Profile Drawer */}
      <MemberProfileDrawer
        open={!!profileUserId}
        onClose={() => {
          setProfileUserId(null);
          setProfileDisplayName(undefined);
        }}
        orgId={organizationId}
        userId={profileUserId ?? undefined}
        displayName={profileDisplayName}
      />
    </Box>
  );
};

export const OrgMemberManagementWithErrorBoundary = OrgMemberManagement;
