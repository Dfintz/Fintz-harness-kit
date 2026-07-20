import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { DataTable } from '@/components/shared';
import {
  useAppointIntelOfficer,
  useIntelAuditLogs,
  useIntelOfficers,
  useRemoveIntelOfficer,
  useUpdateIntelOfficer,
} from '@/hooks/queries/useIntelQueries';
import { useOrganizationMembers } from '@/hooks/queries/useOrganizationQueries';
import { intelVaultService } from '@/services/intelVaultService';
import type { OrganizationMemberV2 } from '@/services/organizationServiceV2';
import { useAuthStore } from '@/store/authStore';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  ErrorOutline,
  Security as Shield,
  PersonAdd as UserAdd,
} from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select as MuiSelect,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
interface IntelOfficer {
  id: string;
  userId: string;
  user?: { id: string; username: string };
  rank: string;
  accessLevel: string;
  isActive: boolean;
  specializations?: string;
  appointedBy: string;
  notes?: string;
  appointedAt: Date;
}

interface IntelAuditLog {
  id: string;
  userId: string;
  username?: string;
  intelEntryId?: string;
  action: string;
  description?: string;
  severity: string;
  createdAt: Date;
}

const RANKS = [
  { value: 'junior', label: 'Junior Officer', level: 1 },
  { value: 'officer', label: 'Officer', level: 2 },
  { value: 'senior', label: 'Senior Officer', level: 3 },
  { value: 'lead', label: 'Lead Officer', level: 4 },
  { value: 'chief', label: 'Chief Officer', level: 5 },
];

const ACCESS_LEVELS = [
  { value: 'read', label: 'Read Only' },
  { value: 'write', label: 'Read & Write' },
  { value: 'edit', label: 'Read, Write & Edit' },
  { value: 'delete', label: 'Full Access' },
  { value: 'admin', label: 'Admin' },
];

export const IntelOfficerManagement: React.FC = () => {
  const { user } = useAuthStore();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<React.Key>('officers');
  const [isOwner, setIsOwner] = useState(false);
  const [canBoxAudit, setCanBoxAudit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'appoint' | 'edit'>('appoint');
  const [selectedOfficer, setSelectedOfficer] = useState<IntelOfficer | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    userId: '',
    rank: 'junior',
    accessLevel: 'read',
    specializations: '',
    notes: '',
  });

  const orgId = user?.activeOrgId;

  // Selected member for autocomplete
  const [selectedMember, setSelectedMember] = useState<OrganizationMemberV2 | null>(null);

  // React Query hooks
  const { data: officers = [], isLoading: officersLoading } = useIntelOfficers(orgId, {
    includeInactive: true,
  });

  const { data: membersResult } = useOrganizationMembers(orgId, { limit: 200 });
  const orgMembers = useMemo(() => membersResult?.items ?? [], [membersResult]);

  // Filter out users who are already active officers
  const availableMembers = useMemo(() => {
    const activeOfficerUserIds = new Set(officers.filter(o => o.isActive).map(o => o.userId));
    return orgMembers.filter(m => !activeOfficerUserIds.has(m.userId));
  }, [orgMembers, officers]);

  const { data: auditResult, isLoading: auditLoading } = useIntelAuditLogs(
    orgId,
    { limit: 100 },
    { enabled: !!orgId && canBoxAudit && activeTab === 'audit' }
  );
  const auditLogs = auditResult?.logs ?? [];
  const loading = officersLoading || (activeTab === 'audit' && auditLoading);

  // Mutations
  const appointMutation = useAppointIntelOfficer(orgId ?? '');
  const updateMutation = useUpdateIntelOfficer(orgId ?? '');
  const removeMutation = useRemoveIntelOfficer(orgId ?? '');

  const checkPermissions = useCallback(async () => {
    try {
      const access = await intelVaultService.checkAccess(orgId!);
      setIsOwner(access?.isOwner || false);

      // Check if user can view audit logs (owner or chief officer)
      const officersList = await intelVaultService.getOfficers(orgId!);
      const chiefOfficer = officersList.find(o => o.rank === 'chief' && o.isActive);
      setCanBoxAudit(access?.isOwner || chiefOfficer?.userId === user?.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err) || 'Failed to check permissions');
    }
  }, [orgId, user?.id]);

  useEffect(() => {
    if (orgId) {
      checkPermissions();
    }
  }, [orgId, checkPermissions]);

  const handleOpenDialog = (mode: 'appoint' | 'edit', officer?: IntelOfficer) => {
    setDialogMode(mode);
    setSelectedOfficer(officer || null);

    if (mode === 'appoint') {
      setFormData({
        userId: '',
        rank: 'junior',
        accessLevel: 'read',
        specializations: '',
        notes: '',
      });
      setSelectedMember(null);
    } else if (officer) {
      setFormData({
        userId: officer.userId,
        rank: officer.rank,
        accessLevel: officer.accessLevel,
        specializations: officer.specializations || '',
        notes: officer.notes || '',
      });
    }

    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedOfficer(null);
  };

  const handleSubmit = async () => {
    setError(null);

    try {
      const payload = {
        userId: formData.userId,
        rank: formData.rank,
        accessLevel: formData.accessLevel,
        specializations: formData.specializations
          ? formData.specializations
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : [],
        notes: formData.notes?.trim() || undefined,
      };

      if (dialogMode === 'appoint') {
        await appointMutation.mutateAsync(payload);
      } else if (selectedOfficer) {
        await updateMutation.mutateAsync({ officerId: selectedOfficer.id, data: payload });
      }

      handleCloseDialog();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err) || 'Failed to save Intel officer');
    }
  };

  const handleRemove = async (officerId: string) => {
    const reason = globalThis.prompt('Please provide a reason for removing this Intel officer:');
    if (!reason) return;

    setError(null);

    try {
      await removeMutation.mutateAsync({ officerId, reason });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : String(err) || 'Failed to remove Intel officer'
      );
    }
  };

  const getRankLabel = (rank: string) => {
    return RANKS.find(r => r.value === rank)?.label || rank;
  };

  const getAccessLevelLabel = (accessLevel: string) => {
    return ACCESS_LEVELS.find(a => a.value === accessLevel)?.label || accessLevel;
  };

  const _getSeverityVariant = (severity: string): 'negative' | 'notice' | 'info' => {
    switch (severity) {
      case 'critical':
        return 'negative';
      case 'warning':
        return 'notice';
      default:
        return 'info';
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'error.main';
      case 'warning':
        return 'error.light';
      default:
        return 'info.light';
    }
  };

  const getSeverityBgColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return alpha(theme.palette.error.main, 0.15);
      case 'warning':
        return alpha(theme.palette.error.light, 0.15);
      default:
        return alpha(theme.palette.info.light, 0.15);
    }
  };

  // Show message if user has no organization
  if (!orgId) {
    return (
      <Box padding="size-300">
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Stack direction="row" gap={2} alignItems="center">
            <Shield />
            <Box>
              <Typography variant="subtitle1">Organization Required</Typography>
              <Typography>
                You need to be a member of an organization to manage Intel officers. Please join or
                create an organization first.
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Box>
    );
  }

  if (!isOwner && !canBoxAudit) {
    return (
      <Box padding="size-300">
        <Box sx={{ borderRadius: 1, p: 2, borderColor: 'error.main' }}>
          <Stack direction="row" gap={2} alignItems="center">
            <Shield sx={{ color: 'error.main' }} />
            <Box>
              <Typography variant="subtitle1">Access Denied</Typography>
              <Typography>Only organization owners can manage Intel officers.</Typography>
            </Box>
          </Stack>
        </Box>
      </Box>
    );
  }

  return (
    <Box padding="size-300">
      {/* Header */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        marginBottom="size-300"
      >
        <Stack direction="row" gap={2} alignItems="center">
          <Shield />
          <Typography variant="h5">Intel Officer Management</Typography>
        </Stack>
        {isOwner && (
          <Button variant="contained" onClick={() => handleOpenDialog('appoint')}>
            <UserAdd />
            <Typography>Appoint Officer</Typography>
          </Button>
        )}
      </Stack>

      {error && (
        <Box sx={{ borderRadius: 1, p: 2, borderColor: 'error.main', marginBottom: '16px' }}>
          <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" gap={1} alignItems="center">
              <ErrorOutline sx={{ color: 'error.main' }} />
              <Typography>{error}</Typography>
            </Stack>
            <Button variant="outlined" onClick={() => setError(null)}>
              <Typography>Dismiss</Typography>
            </Button>
          </Stack>
        </Box>
      )}

      <Tabs value={activeTab} onChange={(_e, newValue) => setActiveTab(newValue)}>
        <Tab label="Intel Officers" value="officers" />
        {canBoxAudit && <Tab label="Audit Logs" value="audit" />}
      </Tabs>
      <Box sx={{ mt: 2 }}>
        {activeTab === 'officers' && (
          <Box paddingTop="size-300">
            <DataTable<IntelOfficer>
              columns={[
                {
                  key: 'userId',
                  header: 'User',
                  render: o => o.user?.username ?? o.userId,
                },
                { key: 'rank', header: 'Rank', render: o => getRankLabel(o.rank) },
                {
                  key: 'accessLevel',
                  header: 'Access Level',
                  render: o => getAccessLevelLabel(o.accessLevel),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: o => (
                    <Box
                      sx={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        background: o.isActive
                          ? alpha(theme.palette.success.main, 0.15)
                          : alpha(theme.palette.grey[500], 0.15),
                        color: o.isActive ? 'success.main' : 'text.secondary',
                      }}
                    >
                      {o.isActive ? 'Active' : 'Inactive'}
                    </Box>
                  ),
                },
                {
                  key: 'specializations',
                  header: 'Specializations',
                  render: o => o.specializations || '-',
                },
                {
                  key: 'appointedAt',
                  header: 'Appointed',
                  render: o => new Date(o.appointedAt).toLocaleDateString(),
                },
                ...(isOwner
                  ? [
                      {
                        key: 'actions',
                        header: 'Actions',
                        align: 'right' as const,
                        render: (o: IntelOfficer) => (
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton
                              onClick={() => handleOpenDialog('edit', o)}
                              size="small"
                              aria-label="Edit officer"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            {o.isActive && (
                              <IconButton
                                onClick={() => handleRemove(o.id)}
                                size="small"
                                aria-label="Remove officer"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        ),
                      },
                    ]
                  : []),
              ]}
              data={officers}
              getRowKey={o => o.id}
              loading={loading}
              emptyMessage="No Intel officers appointed yet."
              size="small"
              sortable
            />
          </Box>
        )}

        {activeTab === 'audit' && canBoxAudit && (
          <Box paddingTop="size-300">
            <DataTable<IntelAuditLog>
              columns={[
                {
                  key: 'createdAt',
                  header: 'Timestamp',
                  render: log => new Date(log.createdAt).toLocaleString(),
                },
                { key: 'userId', header: 'User', render: log => log.username ?? log.userId },
                {
                  key: 'action',
                  header: 'Action',
                  render: log =>
                    log.action.replaceAll('_', ' ').replaceAll(/\b\w/g, c => c.toUpperCase()),
                },
                {
                  key: 'description',
                  header: 'Description',
                  render: log => log.description || '-',
                },
                {
                  key: 'severity',
                  header: 'Severity',
                  render: log => (
                    <Box
                      sx={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        background: getSeverityBgColor(log.severity),
                        color: getSeverityColor(log.severity),
                      }}
                    >
                      {log.severity}
                    </Box>
                  ),
                },
              ]}
              data={auditLogs}
              getRowKey={log => log.id}
              loading={loading}
              emptyMessage="No audit logs found."
              size="small"
              sortable
              paginated
              pageSize={25}
            />
          </Box>
        )}
      </Box>

      {/* Officer Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === 'appoint' ? 'Appoint Intel Officer' : 'Edit Intel Officer'}
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Stack direction="column" spacing={2} sx={{ pt: 2 }}>
            {dialogMode === 'appoint' ? (
              <Autocomplete
                options={availableMembers}
                getOptionLabel={option => option.displayName || option.username || option.userId}
                value={selectedMember}
                onChange={(_e, value) => {
                  setSelectedMember(value);
                  setFormData({ ...formData, userId: value?.userId ?? '' });
                }}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Member"
                    required
                    placeholder="Search members..."
                    helperText="Select an organization member to appoint"
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.userId}>
                    <Stack>
                      <Typography variant="body2">
                        {option.displayName || option.username}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.role}
                      </Typography>
                    </Stack>
                  </li>
                )}
                noOptionsText="No available members"
                fullWidth
              />
            ) : (
              <TextField
                label="Member"
                value={
                  orgMembers.find(m => m.userId === formData.userId)?.displayName ||
                  orgMembers.find(m => m.userId === formData.userId)?.username ||
                  formData.userId
                }
                disabled
                fullWidth
              />
            )}
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth required>
                <InputLabel>Rank</InputLabel>
                <MuiSelect
                  value={formData.rank}
                  label="Rank"
                  onChange={e => setFormData({ ...formData, rank: e.target.value })}
                >
                  {RANKS.map(r => (
                    <MenuItem key={r.value} value={r.value}>
                      {r.label}
                    </MenuItem>
                  ))}
                </MuiSelect>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel>Access Level</InputLabel>
                <MuiSelect
                  value={formData.accessLevel}
                  label="Access Level"
                  onChange={e => setFormData({ ...formData, accessLevel: e.target.value })}
                >
                  {ACCESS_LEVELS.map(a => (
                    <MenuItem key={a.value} value={a.value}>
                      {a.label}
                    </MenuItem>
                  ))}
                </MuiSelect>
              </FormControl>
            </Stack>
            <TextField
              label="Specializations (comma-separated)"
              value={formData.specializations}
              onChange={e => setFormData({ ...formData, specializations: e.target.value })}
              helperText="e.g., strategic, tactical, personnel"
              fullWidth
            />
            <TextField
              label="Notes"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || appointMutation.isPending || updateMutation.isPending}
            startIcon={
              loading || appointMutation.isPending || updateMutation.isPending ? (
                <CircularProgress size={20} />
              ) : null
            }
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export const IntelOfficerManagementWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Intel Officer Management"
    fallbackMessage="Unable to load intel officer management. Please try again later."
    showHomeButton={true}
  >
    <IntelOfficerManagement />
  </FeatureErrorBoundary>
);
