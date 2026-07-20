/**
 * Moderation Page
 *
 * Dashboard for managing moderation incidents — create, view, revoke, and
 * share blacklist entries. Includes analytics, repeat offenders, user lookup,
 * and cross-org sharing configuration. Mirrors the Discord bot `/blacklist`
 * command set in a web UI.
 *
 * Sprint 26 — Bot vs Web Feature Parity
 */

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useCreateIncident,
  useIncidents,
  useLookupUser,
  useModerationAnalytics,
  useRepeatOffenders,
  useRevokeIncident,
  useShareIncident,
  useUnshareIncident,
  type CreateIncidentInput,
  type ModerationIncident,
} from '@/hooks/queries/useModerationQueries';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import {
  buildModerationQueryFilters,
  MODERATION_FILTER_DEFAULTS,
  parseModerationFilters,
} from '@/pages/moderationFilters';
import {
  INCIDENT_TYPE_LABELS,
  SEVERITY_LABELS,
  type IncidentStatus,
  type IncidentType,
} from '@/services/moderationService';
import { logger } from '@/utils/logger';
import AddIcon from '@mui/icons-material/Add';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import BlockIcon from '@mui/icons-material/Block';
import GavelIcon from '@mui/icons-material/Gavel';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import RepeatIcon from '@mui/icons-material/Repeat';
import SearchIcon from '@mui/icons-material/Search';
import ShareIcon from '@mui/icons-material/Share';
import UndoIcon from '@mui/icons-material/Undo';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { Theme, useTheme } from '@mui/material/styles';
import React, { useCallback, useMemo, useState } from 'react';

// ============================================================================
// Constants
// ============================================================================

const INCIDENT_TYPE_OPTIONS: IncidentType[] = ['WARNING', 'TIMEOUT', 'LONG_TIMEOUT', 'KICK', 'BAN'];
const STATUS_OPTIONS: IncidentStatus[] = ['ACTIVE', 'EXPIRED', 'REVOKED'];

const TYPE_COLORS: Record<IncidentType, 'default' | 'info' | 'warning' | 'error'> = {
  WARNING: 'warning',
  TIMEOUT: 'info',
  LONG_TIMEOUT: 'info',
  KICK: 'warning',
  BAN: 'error',
};

const STATUS_COLORS: Record<IncidentStatus, 'success' | 'default' | 'warning'> = {
  ACTIVE: 'warning',
  EXPIRED: 'default',
  REVOKED: 'success',
};

// ============================================================================
// Create Incident Dialog
// ============================================================================

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
}

const CreateIncidentDialog: React.FC<Readonly<CreateDialogProps>> = ({ open, onClose }) => {
  const createIncident = useCreateIncident();

  const [form, setForm] = useState<CreateIncidentInput>({
    guildId: '',
    targetDiscordId: '',
    incidentType: 'WARNING',
  });

  const handleChange = useCallback(
    (field: keyof CreateIncidentInput) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
      },
    []
  );

  const handleTypeChange = useCallback((e: SelectChangeEvent) => {
    setForm(prev => ({ ...prev, incidentType: e.target.value as IncidentType }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.guildId.trim() || !form.targetDiscordId.trim()) return;
    try {
      await createIncident.mutateAsync(form);
      setForm({ guildId: '', targetDiscordId: '', incidentType: 'WARNING' });
      onClose();
    } catch (err) {
      logger.error(
        'Failed to create incident',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [form, createIncident, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GavelIcon color="error" />
        Create Moderation Incident
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Target Discord ID"
            value={form.targetDiscordId}
            onChange={handleChange('targetDiscordId')}
            required
            fullWidth
            placeholder="e.g. 123456789012345678"
          />
          <TextField
            label="Target Username"
            value={form.targetUsername ?? ''}
            onChange={handleChange('targetUsername')}
            fullWidth
            placeholder="Optional — display name"
          />
          <TextField
            label="Guild (Server) ID"
            value={form.guildId}
            onChange={handleChange('guildId')}
            required
            fullWidth
          />
          <TextField
            label="Guild Name"
            value={form.guildName ?? ''}
            onChange={handleChange('guildName')}
            fullWidth
            placeholder="Optional"
          />
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select value={form.incidentType} label="Type" onChange={handleTypeChange}>
              {INCIDENT_TYPE_OPTIONS.map(t => (
                <MenuItem key={t} value={t}>
                  {INCIDENT_TYPE_LABELS[t]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Reason"
            value={form.reason ?? ''}
            onChange={handleChange('reason')}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            label="Duration (minutes)"
            value={form.durationMinutes ?? ''}
            onChange={e =>
              setForm(prev => ({
                ...prev,
                durationMinutes: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
            type="number"
            fullWidth
            placeholder="For timeouts"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="error"
          disabled={
            createIncident.isPending || !form.guildId.trim() || !form.targetDiscordId.trim()
          }
          startIcon={createIncident.isPending ? <CircularProgress size={16} /> : <AddIcon />}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// Helpers
// ============================================================================

function getBorderColor(status: string, theme: Theme): string {
  if (status === 'ACTIVE') return theme.palette.error.main;
  if (status === 'REVOKED') return theme.palette.success.main;
  return theme.palette.grey[400];
}

function getSeverityColor(severity: number): 'error' | 'warning' | 'default' {
  if (severity >= 4) return 'error';
  if (severity >= 2) return 'warning';
  return 'default';
}

// ============================================================================
// Incident Card
// ============================================================================

interface IncidentCardProps {
  incident: ModerationIncident;
  onRevoke: (id: string) => void;
  onShare: (id: string) => void;
  onUnshare: (id: string) => void;
}

const IncidentCard: React.FC<Readonly<IncidentCardProps>> = ({
  incident,
  onRevoke,
  onShare,
  onUnshare,
}) => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        opacity: incident.status === 'REVOKED' ? 0.7 : 1,
        borderLeft: `4px solid ${getBorderColor(incident.status, theme)}`,
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              {incident.targetUsername ?? incident.targetDiscordId}
            </Typography>
            {incident.targetUsername && (
              <Typography variant="caption" color="text.secondary">
                {incident.targetDiscordId}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Chip
              label={INCIDENT_TYPE_LABELS[incident.incidentType]}
              color={TYPE_COLORS[incident.incidentType]}
              size="small"
            />
            <Chip
              label={incident.status}
              color={STATUS_COLORS[incident.status]}
              size="small"
              variant="outlined"
            />
            {incident.isShared && (
              <Chip
                label="Shared"
                icon={<ShareIcon />}
                size="small"
                color="info"
                variant="outlined"
              />
            )}
            <Chip
              label={`Severity ${incident.severity} — ${SEVERITY_LABELS[incident.severity] ?? 'Unknown'}`}
              size="small"
              color={getSeverityColor(incident.severity)}
              variant="outlined"
            />
          </Stack>
        </Box>

        {incident.reason && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            {incident.reason}
          </Typography>
        )}

        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}
        >
          <Typography variant="caption" color="text.secondary">
            by {incident.moderatorUsername ?? incident.moderatorDiscordId ?? 'System'} &middot;{' '}
            {new Date(incident.createdAt).toLocaleDateString()}
            {incident.guildName ? ` · ${incident.guildName}` : ''}
          </Typography>

          {incident.status === 'ACTIVE' && (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title={incident.isShared ? 'Stop sharing' : 'Share with allies'}>
                <IconButton
                  size="small"
                  onClick={() =>
                    incident.isShared ? onUnshare(incident.id) : onShare(incident.id)
                  }
                >
                  <ShareIcon fontSize="small" color={incident.isShared ? 'primary' : 'inherit'} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Revoke incident">
                <IconButton size="small" onClick={() => onRevoke(incident.id)} color="success">
                  <UndoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Box>

        {incident.revokedAt && (
          <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block' }}>
            Revoked {new Date(incident.revokedAt).toLocaleDateString()}
            {incident.revokeReason ? `: ${incident.revokeReason}` : ''}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Incidents Tab
// ============================================================================

const IncidentsTab: React.FC = () => {
  const { filters: urlFilters, updateFilters } = useUrlFilters({
    parse: parseModerationFilters,
    defaults: MODERATION_FILTER_DEFAULTS,
    paginationKeys: ['page'] as const,
  });
  const apiFilters = useMemo(() => buildModerationQueryFilters(urlFilters), [urlFilters]);
  const [searchTerm, setSearchTerm] = useState(urlFilters.search);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, error } = useIncidents(apiFilters);
  const revokeIncident = useRevokeIncident();
  const shareIncident = useShareIncident();
  const unshareIncident = useUnshareIncident();
  const { openDialog, closeDialog, pendingData, dialogProps } = useConfirmDialog<string>();

  const handleSearch = useCallback(() => {
    updateFilters({ search: searchTerm });
  }, [searchTerm, updateFilters]);

  const handleTypeFilter = useCallback(
    (e: SelectChangeEvent) => {
      const value = e.target.value;
      updateFilters({
        incidentType: (value || 'all') as typeof urlFilters.incidentType,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- urlFilters used only in type position
    [updateFilters]
  );

  const handleStatusFilter = useCallback(
    (e: SelectChangeEvent) => {
      const value = e.target.value;
      updateFilters({
        status: (value || 'all') as typeof urlFilters.status,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- urlFilters used only in type position
    [updateFilters]
  );

  const handlePageChange = useCallback(
    (_: React.ChangeEvent<unknown>, page: number) => {
      updateFilters({ page });
    },
    [updateFilters]
  );

  const handleRevoke = useCallback(
    async (incidentId: string) => {
      openDialog(incidentId);
    },
    [openDialog]
  );

  const handleConfirmRevoke = useCallback(async () => {
    if (!pendingData) return;
    try {
      await revokeIncident.mutateAsync({ incidentId: pendingData });
      closeDialog();
    } catch (err) {
      logger.error(
        'Failed to revoke incident',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [pendingData, revokeIncident, closeDialog]);

  const handleShare = useCallback(
    async (incidentId: string) => {
      try {
        await shareIncident.mutateAsync(incidentId);
      } catch (err) {
        logger.error(
          'Failed to share incident',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    },
    [shareIncident]
  );

  const handleUnshare = useCallback(
    async (incidentId: string) => {
      try {
        await unshareIncident.mutateAsync(incidentId);
      } catch (err) {
        logger.error(
          'Failed to unshare incident',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    },
    [unshareIncident]
  );

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">Failed to load incidents</Alert>;

  const incidents = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <Box>
      {/* Toolbar */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          placeholder="Search by user ID or name…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          slotProps={{
            input: {
              endAdornment: (
                <IconButton size="small" onClick={handleSearch}>
                  <SearchIcon fontSize="small" />
                </IconButton>
              ),
            },
          }}
          sx={{ minWidth: 240 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={urlFilters.incidentType === 'all' ? '' : urlFilters.incidentType}
            label="Type"
            onChange={handleTypeFilter}
          >
            <MenuItem value="">All Types</MenuItem>
            {INCIDENT_TYPE_OPTIONS.map(t => (
              <MenuItem key={t} value={t}>
                {INCIDENT_TYPE_LABELS[t]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={urlFilters.status === 'all' ? '' : urlFilters.status}
            label="Status"
            onChange={handleStatusFilter}
          >
            <MenuItem value="">All Status</MenuItem>
            {STATUS_OPTIONS.map(s => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          color="error"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          New Incident
        </Button>
      </Stack>

      {/* Incident cards */}
      {incidents.length === 0 ? (
        <Alert severity="info">No incidents found matching your filters.</Alert>
      ) : (
        <Stack spacing={2}>
          {incidents.map(incident => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onRevoke={handleRevoke}
              onShare={handleShare}
              onUnshare={handleUnshare}
            />
          ))}
        </Stack>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={pagination.totalPages}
            page={pagination.page}
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )}

      <CreateIncidentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ConfirmDialog
        {...dialogProps}
        title="Revoke Incident"
        message="This will mark the incident as revoked. The record will be kept for audit purposes."
        onConfirm={handleConfirmRevoke}
      />
    </Box>
  );
};

// ============================================================================
// Analytics Tab
// ============================================================================

const AnalyticsTab: React.FC = () => {
  const { data: analytics, isLoading, error } = useModerationAnalytics();

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">Failed to load analytics</Alert>;
  if (!analytics) return null;

  return (
    <Box>
      {/* Summary cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Total Incidents
            </Typography>
            <Typography variant="h4">{analytics.totalIncidents}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Active
            </Typography>
            <Typography variant="h4" color="error.main">
              {analytics.activeIncidents}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Shared
            </Typography>
            <Typography variant="h4" color="info.main">
              {analytics.sharedIncidents}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Avg Severity
            </Typography>
            <Typography variant="h4" color="warning.main">
              {analytics.averageSeverity.toFixed(1)}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Recent activity row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
          gap: 2,
          mb: 3,
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Last 24 Hours
            </Typography>
            <Typography variant="h5">{analytics.incidentsLast24Hours}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Last 7 Days
            </Typography>
            <Typography variant="h5">{analytics.incidentsLast7Days}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Last 30 Days
            </Typography>
            <Typography variant="h5">{analytics.incidentsLast30Days}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Breakdown by type */}
      <Typography variant="h6" sx={{ mb: 1 }}>
        Breakdown by Type
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
        {Object.entries(analytics.byType).map(([type, count]) => (
          <Chip
            key={type}
            label={`${INCIDENT_TYPE_LABELS[type as IncidentType] ?? type}: ${count}`}
            color={TYPE_COLORS[type as IncidentType] ?? 'default'}
          />
        ))}
      </Stack>

      {/* Breakdown by severity */}
      <Typography variant="h6" sx={{ mb: 1 }}>
        Breakdown by Severity
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
        {Object.entries(analytics.bySeverity).map(([sev, count]) => (
          <Chip
            key={sev}
            label={`${SEVERITY_LABELS[Number(sev)] ?? 'Level ' + sev}: ${count}`}
            color={getSeverityColor(Number(sev))}
            variant="outlined"
          />
        ))}
      </Stack>

      {/* Mirror / sharing stats */}
      <Typography variant="h6" sx={{ mb: 1 }}>
        Cross-Org Sharing
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <Chip label={`Total mirrors: ${analytics.mirrorStats.totalMirrors}`} />
        <Chip label={`Pending: ${analytics.mirrorStats.pendingMirrors}`} color="info" />
        <Chip label={`Confirmed: ${analytics.mirrorStats.confirmedMirrors}`} color="success" />
        {analytics.mirrorStats.failedMirrors > 0 && (
          <Chip label={`Failed: ${analytics.mirrorStats.failedMirrors}`} color="error" />
        )}
      </Stack>
    </Box>
  );
};

// ============================================================================
// Repeat Offenders Tab
// ============================================================================

const RepeatOffendersTab: React.FC = () => {
  const theme = useTheme();
  const { data: offenders, isLoading, error } = useRepeatOffenders();

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">Failed to load repeat offenders</Alert>;
  if (!offenders || offenders.length === 0)
    return <Alert severity="info">No repeat offenders detected.</Alert>;

  return (
    <Stack spacing={2}>
      {offenders.map(offender => (
        <Card
          key={offender.targetDiscordId}
          sx={{
            borderLeft: `4px solid ${
              offender.isHighRisk ? theme.palette.error.main : theme.palette.warning.main
            }`,
          }}
        >
          <CardContent>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  {offender.targetUsername ?? offender.targetDiscordId}
                </Typography>
                {offender.targetUsername && (
                  <Typography variant="caption" color="text.secondary">
                    {offender.targetDiscordId}
                  </Typography>
                )}
              </Box>
              <Stack direction="row" spacing={0.5}>
                {offender.isHighRisk && <Chip label="HIGH RISK" color="error" size="small" />}
                <Chip label={`Risk Score: ${offender.riskScore}`} size="small" variant="outlined" />
                <Chip
                  label={`${offender.totalIncidents} incidents (${offender.activeIncidents} active)`}
                  size="small"
                />
              </Stack>
            </Box>

            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              {Object.entries(offender.incidentsByType).map(([type, count]) => (
                <Chip
                  key={type}
                  label={`${INCIDENT_TYPE_LABELS[type as IncidentType] ?? type}: ${count}`}
                  size="small"
                  variant="outlined"
                  color={TYPE_COLORS[type as IncidentType] ?? 'default'}
                />
              ))}
            </Stack>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              First: {new Date(offender.firstIncident).toLocaleDateString()} &middot; Last:{' '}
              {new Date(offender.lastIncident).toLocaleDateString()}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};

// ============================================================================
// User Lookup Tab
// ============================================================================

const UserLookupTab: React.FC = () => {
  const [discordId, setDiscordId] = useState('');
  const [lookupId, setLookupId] = useState<string | undefined>();

  const { data: summary, isLoading, error } = useLookupUser(lookupId, true);

  const handleLookup = useCallback(() => {
    if (discordId.trim()) setLookupId(discordId.trim());
  }, [discordId]);

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          size="small"
          label="Discord User ID"
          value={discordId}
          onChange={e => setDiscordId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLookup()}
          placeholder="123456789012345678"
          sx={{ minWidth: 280 }}
        />
        <Button
          variant="contained"
          startIcon={isLoading ? <CircularProgress size={16} /> : <PersonSearchIcon />}
          onClick={handleLookup}
          disabled={!discordId.trim() || isLoading}
        >
          Lookup
        </Button>
      </Stack>

      {error && <Alert severity="error">User not found or lookup failed.</Alert>}

      {summary && (
        <Box>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6">
                {summary.targetUsername ?? summary.targetDiscordId}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
                  gap: 2,
                  mt: 2,
                }}
              >
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Total
                  </Typography>
                  <Typography variant="h5">{summary.totalIncidents}</Typography>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Active
                  </Typography>
                  <Typography variant="h5" color="error.main">
                    {summary.activeIncidents}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Highest Severity
                  </Typography>
                  <Typography variant="h5" color="warning.main">
                    {summary.highestSeverity} — {SEVERITY_LABELS[summary.highestSeverity] ?? '?'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Shared Reports
                  </Typography>
                  <Typography variant="h5" color="info.main">
                    {summary.sharedIncidents}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* User's incidents */}
          <Typography variant="h6" sx={{ mb: 1 }}>
            Incident History
          </Typography>
          {summary.incidents.length === 0 ? (
            <Alert severity="info">No incidents recorded.</Alert>
          ) : (
            <Stack spacing={1}>
              {summary.incidents.map(incident => (
                <Card key={incident.id} variant="outlined">
                  <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={INCIDENT_TYPE_LABELS[incident.incidentType]}
                        color={TYPE_COLORS[incident.incidentType]}
                        size="small"
                      />
                      <Chip
                        label={incident.status}
                        color={STATUS_COLORS[incident.status]}
                        size="small"
                        variant="outlined"
                      />
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {incident.reason ?? 'No reason provided'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(incident.createdAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const ModerationPageContent: React.FC = () => {
  const theme = useTheme();
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <GavelIcon sx={{ fontSize: 32, color: theme.palette.error.main }} />
        <Box>
          <Typography variant="h4">Moderation</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage moderation incidents, review repeat offenders, and share intel across
            organizations
          </Typography>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab icon={<BlockIcon />} iconPosition="start" label="Incidents" />
        <Tab icon={<AnalyticsIcon />} iconPosition="start" label="Analytics" />
        <Tab icon={<RepeatIcon />} iconPosition="start" label="Repeat Offenders" />
        <Tab icon={<PersonSearchIcon />} iconPosition="start" label="User Lookup" />
      </Tabs>

      {tab === 0 && <IncidentsTab />}
      {tab === 1 && <AnalyticsTab />}
      {tab === 2 && <RepeatOffendersTab />}
      {tab === 3 && <UserLookupTab />}
    </Box>
  );
};

export const ModerationPage: React.FC = () => <ModerationPageContent />;

export const ModerationPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Moderation">
    <ModerationPage />
  </FeatureErrorBoundary>
);
