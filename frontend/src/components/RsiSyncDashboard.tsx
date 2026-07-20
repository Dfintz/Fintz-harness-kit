/**
 * RSI Sync Dashboard Component
 *
 * Provides administrators with visibility into:
 * - Sync schedule status (enabled/disabled, next sync, failures)
 * - Recent sync operations (success/failure, changes applied)
 * - Overall sync statistics
 * - Manual sync trigger
 */

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SyncIcon from '@mui/icons-material/Sync';
import WarningIcon from '@mui/icons-material/Warning';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import {
  rsiSyncService,
  SyncAuditLog,
  SyncChangeDetails,
  SyncScheduleStatus,
  SyncStats,
  type CreateScheduleInput,
} from '@/services/rsiSyncService';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';

interface RsiSyncDashboardProps {
  /** Organization ID - if not provided, reads from URL params */
  organizationId?: string;
}

/** Extract error message from caught exception */
function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  const resp = err as { response?: { data?: { message?: string } } };
  return resp?.response?.data?.message ?? fallback;
}

/** Map success rate percentage to MUI color */
function getSuccessRateColor(rate: number): 'success' | 'warning' | 'error' {
  if (rate >= 90) return 'success';
  if (rate >= 70) return 'warning';
  return 'error';
}

/** Render a single sync log row */
const SyncLogRow: React.FC<{ log: SyncAuditLog; onClick: (log: SyncAuditLog) => void }> = ({
  log,
  onClick,
}) => {
  const theme = useTheme();
  return (
    <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => onClick(log)}>
      <TableCell>
        {log.errors > 0 ? (
          <Tooltip title={`${log.errors} error(s)`}>
            <Chip
              size="small"
              icon={<ErrorIcon />}
              label="Failed"
              sx={getStatusChipSx('failed', theme)}
            />
          </Tooltip>
        ) : (
          <Chip
            size="small"
            icon={<CheckCircleIcon />}
            label="Success"
            sx={getStatusChipSx('success', theme)}
          />
        )}
      </TableCell>
      <TableCell>
        <Chip size="small" label={log.syncType} variant="outlined" />
      </TableCell>
      <TableCell align="center">
        {log.changesApplied > 0 ? (
          <Typography variant="body2" fontWeight={600}>
            {log.changesApplied}/{log.changesDetected}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {log.changesDetected === 0 ? 'No changes' : `0/${log.changesDetected}`}
          </Typography>
        )}
      </TableCell>
      <TableCell align="center">
        {log.errors > 0 ? (
          <Typography variant="body2" color="error.main" fontWeight={600}>
            {log.errors}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            0
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          {log.durationSeconds == null ? '-' : `${log.durationSeconds.toFixed(1)}s`}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2">{new Date(log.syncedAt).toLocaleString()}</Typography>
      </TableCell>
    </TableRow>
  );
};

/** Render sync change detail sections */
const SyncDetailSection: React.FC<{
  title: string;
  count: number;
  color: 'success' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
}> = ({ title, count, color, children }) => {
  if (count === 0) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Chip size="small" label={count} color={color} />
      </Stack>
      {children}
    </Box>
  );
};

/** Dialog showing detailed sync change information */
const SyncLogDetailDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  log: SyncAuditLog | null;
  details: SyncChangeDetails | null;
  loading: boolean;
}> = ({ open, onClose, log, details, loading }) => {
  const theme = useTheme();
  if (!log) return null;

  const rolesAdded = details?.rolesAdded ?? [];
  const rolesRemoved = details?.rolesRemoved ?? [];
  const rankChanges = details?.rankChanges ?? [];
  const removedMembers = details?.removedMembers ?? [];
  const deltaNew = details?.delta?.newMembers ?? [];
  const deltaRemoved = details?.delta?.removedMembers ?? [];
  const deltaRanks = details?.delta?.rankChanges ?? [];
  const deltaStatus = details?.delta?.statusChanges ?? [];
  const errors = details?.errors ?? [];
  const snapshot = details?.memberSnapshot;
  const hasNoDetails =
    !loading &&
    rolesAdded.length === 0 &&
    rolesRemoved.length === 0 &&
    rankChanges.length === 0 &&
    removedMembers.length === 0 &&
    deltaNew.length === 0 &&
    deltaRemoved.length === 0 &&
    deltaRanks.length === 0 &&
    deltaStatus.length === 0 &&
    errors.length === 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6">Sync Details</Typography>
            <Chip size="small" label={log.syncType} variant="outlined" />
            {log.errors > 0 ? (
              <Chip
                size="small"
                icon={<ErrorIcon />}
                label="Failed"
                sx={getStatusChipSx('failed', theme)}
              />
            ) : (
              <Chip
                size="small"
                icon={<CheckCircleIcon />}
                label="Success"
                sx={getStatusChipSx('success', theme)}
              />
            )}
          </Stack>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {new Date(log.syncedAt).toLocaleString()}
          {log.durationSeconds != null && ` \u2022 ${log.durationSeconds.toFixed(1)}s`}
          {` \u2022 ${log.changesApplied}/${log.changesDetected} changes applied`}
        </Typography>
      </DialogTitle>
      <Divider />
      <DialogContent>
        {loading && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CircularProgress size={32} />
            <Typography sx={{ mt: 1 }} color="text.secondary">
              Loading details...
            </Typography>
          </Box>
        )}
        {!loading && hasNoDetails && (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">No changes in this sync operation.</Typography>
          </Box>
        )}
        {!loading && !hasNoDetails && (
          <Box>
            {/* Roles Added */}
            <SyncDetailSection title="Roles Added" count={rolesAdded.length} color="success">
              <List dense disablePadding>
                {rolesAdded.map(r => (
                  <ListItem key={`${r.rsiHandle}-${r.roleId}`} disablePadding sx={{ pl: 1 }}>
                    <ListItemText primary={r.rsiHandle} secondary={r.roleName ?? r.roleId} />
                  </ListItem>
                ))}
              </List>
            </SyncDetailSection>

            {/* Roles Removed */}
            <SyncDetailSection title="Roles Removed" count={rolesRemoved.length} color="error">
              <List dense disablePadding>
                {rolesRemoved.map(r => (
                  <ListItem key={`${r.rsiHandle}-${r.roleId}`} disablePadding sx={{ pl: 1 }}>
                    <ListItemText primary={r.rsiHandle} secondary={r.roleName ?? r.roleId} />
                  </ListItem>
                ))}
              </List>
            </SyncDetailSection>

            {/* Rank Changes */}
            <SyncDetailSection title="Rank Changes" count={rankChanges.length} color="info">
              <List dense disablePadding>
                {rankChanges.map(r => (
                  <ListItem key={`${r.rsiHandle}-${r.previousRank}`} disablePadding sx={{ pl: 1 }}>
                    <ListItemText
                      primary={r.rsiHandle}
                      secondary={`${r.previousRank} \u2192 ${r.newRank}`}
                    />
                  </ListItem>
                ))}
              </List>
            </SyncDetailSection>

            {/* Removed Members */}
            <SyncDetailSection
              title="Removed Members"
              count={removedMembers.length}
              color="warning"
            >
              <List dense disablePadding>
                {removedMembers.map(r => (
                  <ListItem key={r.rsiHandle} disablePadding sx={{ pl: 1 }}>
                    <ListItemText
                      primary={r.rsiHandle}
                      secondary={r.lastKnownRank ? `Last rank: ${r.lastKnownRank}` : undefined}
                    />
                  </ListItem>
                ))}
              </List>
            </SyncDetailSection>

            {/* Delta: New Members */}
            <SyncDetailSection title="New Members (Delta)" count={deltaNew.length} color="success">
              <List dense disablePadding>
                {deltaNew.map(m => (
                  <ListItem key={m.handle} disablePadding sx={{ pl: 1 }}>
                    <ListItemText
                      primary={m.handle}
                      secondary={[m.rank, m.isAffiliate ? 'Affiliate' : null]
                        .filter(Boolean)
                        .join(' \u2022 ')}
                    />
                  </ListItem>
                ))}
              </List>
            </SyncDetailSection>

            {/* Delta: Removed Members */}
            <SyncDetailSection
              title="Left Organization (Delta)"
              count={deltaRemoved.length}
              color="error"
            >
              <List dense disablePadding>
                {deltaRemoved.map(m => (
                  <ListItem key={m.handle} disablePadding sx={{ pl: 1 }}>
                    <ListItemText
                      primary={m.handle}
                      secondary={m.lastRank ? `Last rank: ${m.lastRank}` : undefined}
                    />
                  </ListItem>
                ))}
              </List>
            </SyncDetailSection>

            {/* Delta: Rank Changes */}
            <SyncDetailSection title="Rank Changes (Delta)" count={deltaRanks.length} color="info">
              <List dense disablePadding>
                {deltaRanks.map(m => (
                  <ListItem key={`${m.handle}-${m.oldRank}`} disablePadding sx={{ pl: 1 }}>
                    <ListItemText
                      primary={m.handle}
                      secondary={`${m.oldRank} \u2192 ${m.newRank}`}
                    />
                  </ListItem>
                ))}
              </List>
            </SyncDetailSection>

            {/* Delta: Status Changes */}
            <SyncDetailSection
              title="Status Changes (Delta)"
              count={deltaStatus.length}
              color="warning"
            >
              <List dense disablePadding>
                {deltaStatus.map(m => (
                  <ListItem key={`${m.handle}-${m.field}`} disablePadding sx={{ pl: 1 }}>
                    <ListItemText
                      primary={m.handle}
                      secondary={`${m.field}: ${m.oldValue} \u2192 ${m.newValue}`}
                    />
                  </ListItem>
                ))}
              </List>
            </SyncDetailSection>

            {/* Errors */}
            {errors.length > 0 && (
              <SyncDetailSection title="Errors" count={errors.length} color="error">
                <List dense disablePadding>
                  {errors.map(e => (
                    <ListItem
                      key={`${e.rsiHandle ?? e.userId ?? 'err'}-${e.error.slice(0, 20)}`}
                      disablePadding
                      sx={{ pl: 1 }}
                    >
                      <ListItemText
                        primary={e.rsiHandle ?? e.userId ?? 'Unknown'}
                        secondary={e.error}
                        slotProps={{ secondary: { color: 'error.main' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              </SyncDetailSection>
            )}

            {/* Member Snapshot */}
            {snapshot && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Member Snapshot
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Chip size="small" label={`Total: ${snapshot.total}`} />
                  <Chip size="small" label={`Main: ${snapshot.main}`} color="primary" />
                  <Chip size="small" label={`Affiliate: ${snapshot.affiliate}`} />
                  <Chip size="small" label={`Hidden: ${snapshot.hidden}`} />
                  <Chip size="small" label={`Redacted: ${snapshot.redacted}`} />
                </Stack>
              </>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

/** Stats summary cards */
const SyncStatsCards: React.FC<{ stats: SyncStats | null }> = ({ stats }) => {
  const successRate =
    stats && stats.totalSyncs > 0
      ? ((stats.successfulSyncs / stats.totalSyncs) * 100).toFixed(1)
      : '0';

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 6, md: 3 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Total Syncs
            </Typography>
            <Typography variant="h4">{stats?.totalSyncs ?? 0}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Successful
            </Typography>
            <Typography variant="h4" color="success.main">
              {stats?.successfulSyncs ?? 0}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Failed
            </Typography>
            <Typography
              variant="h4"
              color={(stats?.failedSyncs ?? 0) > 0 ? 'error.main' : 'text.primary'}
            >
              {stats?.failedSyncs ?? 0}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Success Rate
            </Typography>
            <Typography variant="h4">{successRate}%</Typography>
            <LinearProgress
              variant="determinate"
              value={Number.parseFloat(successRate)}
              color={getSuccessRateColor(Number.parseFloat(successRate))}
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

/** Active schedule status bar */
const ScheduleStatusBar: React.FC<{
  schedule: SyncScheduleStatus;
  onToggle: () => void;
}> = ({ schedule, onToggle }) => {
  const theme = useTheme();

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={2} alignItems="center">
          <ScheduleIcon color={schedule.enabled ? 'success' : 'disabled'} />
          <Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1">Automatic Sync</Typography>
              <Chip
                size="small"
                label={schedule.enabled ? 'Enabled' : 'Disabled'}
                color={schedule.enabled ? 'success' : 'default'}
              />
              {schedule.autoDisabled && (
                <Chip
                  size="small"
                  label="Auto-disabled"
                  icon={<WarningIcon />}
                  sx={getStatusChipSx('disabled', theme)}
                />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Interval: {schedule.interval}
              {schedule.lastSync && ` | Last sync: ${new Date(schedule.lastSync).toLocaleString()}`}
              {schedule.nextSync && ` | Next: ${new Date(schedule.nextSync).toLocaleString()}`}
              {schedule.failures > 0 && ` | Consecutive failures: ${schedule.failures}`}
            </Typography>
          </Stack>
        </Stack>
        <Button
          variant="outlined"
          size="small"
          startIcon={schedule.enabled ? <PauseCircleIcon /> : <PlayArrowIcon />}
          onClick={onToggle}
          color={schedule.enabled ? 'warning' : 'success'}
        >
          {schedule.enabled ? 'Pause' : 'Enable'}
        </Button>
      </Stack>
    </Paper>
  );
};

/** Create schedule form */
const CreateSchedulePanel: React.FC<{
  showCreate: boolean;
  createForm: CreateScheduleInput;
  creating: boolean;
  onFormChange: (update: Partial<CreateScheduleInput>) => void;
  onCreate: () => void;
  onCancel: () => void;
  onShowCreate: () => void;
}> = ({ showCreate, createForm, creating, onFormChange, onCreate, onCancel, onShowCreate }) => (
  <Paper sx={{ p: 2, mb: 3 }}>
    {showCreate ? (
      <Stack spacing={2}>
        <Typography variant="subtitle1" fontWeight={600}>
          Create RSI Sync Schedule
        </Typography>
        <TextField
          label="RSI Organization SID"
          placeholder="e.g. MYORG"
          value={createForm.rsiOrgSid}
          onChange={e => onFormChange({ rsiOrgSid: e.target.value })}
          size="small"
          required
          helperText="The Spectrum ID of your RSI organization (found in the RSI URL)"
        />
        <TextField
          label="Sync Interval"
          select
          value={String(createForm.intervalMinutes)}
          onChange={e => onFormChange({ intervalMinutes: Number(e.target.value) })}
          size="small"
          slotProps={{ select: { native: true } }}
        >
          <option value="360">Every 6 hours</option>
          <option value="720">Every 12 hours</option>
          <option value="1440">Every 24 hours</option>
        </TextField>
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            onClick={onCreate}
            disabled={creating || !createForm.rsiOrgSid.trim()}
            startIcon={creating ? <CircularProgress size={16} /> : <PlayArrowIcon />}
          >
            {creating ? 'Creating...' : 'Create Schedule'}
          </Button>
          <Button variant="outlined" onClick={onCancel} disabled={creating}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    ) : (
      <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
        <ScheduleIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
        <Typography color="text.secondary">
          No sync schedule configured for this organization.
        </Typography>
        <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={onShowCreate}>
          Create Sync Schedule
        </Button>
      </Stack>
    )}
  </Paper>
);

/** Hook: manage the sync log detail dialog state */
function useSyncLogDetail(organizationId: string) {
  const [selectedLog, setSelectedLog] = useState<SyncAuditLog | null>(null);
  const [details, setDetails] = useState<SyncChangeDetails | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(
    async (log: SyncAuditLog) => {
      setSelectedLog(log);
      setDetails(null);
      setLoading(true);
      try {
        const fullLog = await rsiSyncService.getAuditLogById(organizationId, log.id);
        setDetails(fullLog.details ?? null);
      } catch (err: unknown) {
        logger.error(
          'Failed to load sync log details',
          err instanceof Error ? err : new Error(String(err))
        );
        setDetails(null);
      } finally {
        setLoading(false);
      }
    },
    [organizationId]
  );

  const close = useCallback(() => {
    setSelectedLog(null);
    setDetails(null);
  }, []);

  return { selectedLog, details, loading, open, close };
}

export const RsiSyncDashboard: React.FC<RsiSyncDashboardProps> = ({
  organizationId: propOrgId,
}) => {
  const { orgId: paramOrgId } = useParams<{ orgId: string }>();
  const organizationId = propOrgId || paramOrgId || '';

  const [schedule, setSchedule] = useState<SyncScheduleStatus | null>(null);
  const [logs, setLogs] = useState<SyncAuditLog[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateScheduleInput>({
    rsiOrgSid: '',
    intervalMinutes: 360,
    isEnabled: true,
    notifyOnChanges: true,
    notifyOnErrors: true,
  });
  const [creating, setCreating] = useState(false);

  const logDetail = useSyncLogDetail(organizationId);

  const notification = useNotification();

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [scheduleData, auditData] = await Promise.all([
        rsiSyncService.getScheduleStatus(organizationId).catch(() => null),
        rsiSyncService.getAuditLogs(organizationId, { limit: 15 }).catch(() => ({
          logs: [],
          total: 0,
          stats: { totalSyncs: 0, successfulSyncs: 0, failedSyncs: 0, totalChangesApplied: 0 },
        })),
      ]);

      setSchedule(scheduleData);
      setLogs(auditData?.logs ?? []);
      setTotalLogs(auditData?.total ?? 0);
      setStats(auditData?.stats ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load sync dashboard data');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadData();

    // Poll interval in ms — constant, not user-derived input.
    // Snyk CWE-94 false positive: loadData is a function reference, not a string.
    const POLL_INTERVAL_MS: number = 30_000;
    const interval = setInterval(loadData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  if (!organizationId) {
    return (
      <Alert severity="warning">
        No organization selected. Please navigate to this page from an organization context.
      </Alert>
    );
  }

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await rsiSyncService.triggerManualSync(organizationId);
      notification.success(
        'Manual sync has been triggered. Results will appear shortly.',
        'Sync Triggered'
      );
      // Reload data after a short delay
      // Delay in ms — constant, not user-derived input.
      // Snyk CWE-94 false positive: loadData is a function reference, not a string.
      const RELOAD_DELAY_MS: number = 3_000;
      setTimeout(loadData, RELOAD_DELAY_MS);
    } catch (err: unknown) {
      notification.error(extractErrorMessage(err, 'Failed to trigger manual sync.'), 'Sync Failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleSchedule = async () => {
    try {
      if (schedule?.enabled) {
        await rsiSyncService.disableSchedule(organizationId);
        notification.success('Automatic sync has been paused.', 'Schedule Disabled');
      } else {
        await rsiSyncService.enableSchedule(organizationId);
        notification.success('Automatic sync has been enabled.', 'Schedule Enabled');
      }
      await loadData();
    } catch (err: unknown) {
      notification.error(extractErrorMessage(err, 'Failed to update schedule.'), 'Error');
    }
  };

  const handleCreateSchedule = async () => {
    if (!createForm.rsiOrgSid.trim()) {
      notification.error('RSI Organization SID is required.', 'Validation');
      return;
    }
    setCreating(true);
    try {
      const created = await rsiSyncService.createSchedule(organizationId, {
        ...createForm,
        rsiOrgSid: createForm.rsiOrgSid.trim(),
      });
      notification.success('RSI sync schedule has been created successfully.', 'Schedule Created');
      // Immediately reflect the created schedule so it appears in the UI
      if (created) {
        setSchedule(created);
      }
      setShowCreate(false);
      setCreateForm({
        rsiOrgSid: '',
        intervalMinutes: 360,
        isEnabled: true,
        notifyOnChanges: true,
        notifyOnErrors: true,
      });
      // Also reload to get full data including audit logs
      loadData();
    } catch (err: unknown) {
      notification.error(
        extractErrorMessage(err, 'Failed to create sync schedule.'),
        'Create Failed'
      );
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={40} />
        <Typography sx={{ mt: 2 }}>Loading sync dashboard...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={<Button onClick={loadData}>Retry</Button>}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <SyncIcon />
          <Typography variant="h5">RSI Sync Dashboard</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={loadData}>
            Refresh
          </Button>
          <Tooltip
            title={schedule ? '' : 'No sync schedule configured'}
            disableHoverListener={Boolean(schedule)}
          >
            <span>
              <Button
                variant="contained"
                size="small"
                startIcon={syncing ? <CircularProgress size={16} /> : <SyncIcon />}
                onClick={handleManualSync}
                disabled={syncing || !schedule}
              >
                {syncing ? 'Syncing...' : 'Trigger Sync'}
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Stats Cards */}
      <SyncStatsCards stats={stats} />

      {/* Schedule Status */}
      {schedule ? (
        <ScheduleStatusBar schedule={schedule} onToggle={handleToggleSchedule} />
      ) : (
        <CreateSchedulePanel
          showCreate={showCreate}
          createForm={createForm}
          creating={creating}
          onFormChange={update => setCreateForm(prev => ({ ...prev, ...update }))}
          onCreate={handleCreateSchedule}
          onCancel={() => setShowCreate(false)}
          onShowCreate={() => setShowCreate(true)}
        />
      )}

      {/* Recent Sync Operations */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Recent Sync Operations</Typography>
            <Typography variant="body2" color="text.secondary">
              {totalLogs} total operations
            </Typography>
          </Stack>
        </Box>
        <Divider />
        {logs.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="center">Changes</TableCell>
                  <TableCell align="center">Errors</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map(log => (
                  <SyncLogRow key={log.id} log={log} onClick={logDetail.open} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <SyncIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No sync operations recorded yet.</Typography>
          </Box>
        )}
      </Paper>

      {/* Total Changes Applied */}
      {stats && stats.totalChangesApplied > 0 && (
        <Alert severity="info" icon={<CheckCircleIcon />}>
          <Typography variant="body2">
            Total role changes applied: <strong>{stats.totalChangesApplied}</strong> across{' '}
            {stats.totalSyncs} sync operations
          </Typography>
        </Alert>
      )}

      {/* Sync Log Detail Dialog */}
      <SyncLogDetailDialog
        open={logDetail.selectedLog !== null}
        onClose={logDetail.close}
        log={logDetail.selectedLog}
        details={logDetail.details}
        loading={logDetail.loading}
      />
    </Box>
  );
};
