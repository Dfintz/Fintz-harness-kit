/**
 * OrgFlagsFeed
 *
 * Filterable, paginated feed of all audit flags for the current organization.
 * Supports filtering by flag type, severity, status, and date range.
 * Allows creating manual flags and resolving/dismissing open flags inline.
 *
 * Wave 2.1 — Membership Audit & Intel (Phase F2)
 */
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import FlagIcon from '@mui/icons-material/Flag';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
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
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { useTheme } from '@mui/material/styles';
import React, { useCallback, useState } from 'react';

import type {
  CreateManualFlagDto,
  ListFlagsQuery,
  MemberFlagSummary,
  ResolveFlagDto,
} from '@sc-fleet-manager/shared-types';
import { FlagSeverity, FlagStatus, MemberFlagType } from '@sc-fleet-manager/shared-types';

import { useAuditFlags, useCreateManualFlag, useResolveFlag } from '@/hooks/queries';
import { isApiClientError } from '@/services/apiClient';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';

/* ────────────────────────────────────────────────────────────────── */
/*  Constants                                                         */
/* ────────────────────────────────────────────────────────────────── */

const FLAG_TYPES: MemberFlagType[] = [
  MemberFlagType.RSI_ORG_LEFT,
  MemberFlagType.JOINED_HOSTILE_ORG,
  MemberFlagType.JOINED_REDACTED_ORG,
  MemberFlagType.RSI_RANK_CHANGED,
  MemberFlagType.DISCORD_LEFT,
  MemberFlagType.DISCORD_ROLE_CHANGED,
  MemberFlagType.MODERATION_ACTION_RECEIVED,
  MemberFlagType.MODERATION_ACTION_SHARED,
  MemberFlagType.PRIMARY_ORG_SWITCHED,
  MemberFlagType.PLATFORM_LEFT,
  MemberFlagType.MANUAL,
];

const SEVERITIES: FlagSeverity[] = [
  FlagSeverity.INFO,
  FlagSeverity.MEDIUM,
  FlagSeverity.HIGH,
  FlagSeverity.CRITICAL,
];
const STATUSES: FlagStatus[] = [
  FlagStatus.OPEN,
  FlagStatus.RESOLVED,
  FlagStatus.DISMISSED,
  FlagStatus.ESCALATED,
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ────────────────────────────────────────────────────────────────── */
/*  Props                                                             */
/* ────────────────────────────────────────────────────────────────── */

export interface OrgFlagsFeedProps {
  orgId: string | undefined;
  /** Optional: pre-filter to a specific user */
  userId?: string;
  /** If provided, clicking a flag opens the profile drawer */
  onViewProfile?: (userId: string) => void;
}

/* ────────────────────────────────────────────────────────────────── */
/*  Component                                                         */
/* ────────────────────────────────────────────────────────────────── */

export const OrgFlagsFeed: React.FC<OrgFlagsFeedProps> = ({
  orgId,
  userId: preFilterUserId,
  onViewProfile,
}) => {
  const theme = useTheme();
  /* Filter state */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [flagType, setFlagType] = useState<string>('');
  const [severity, setSeverity] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  /* Dialog state */
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveDialogFlag, setResolveDialogFlag] = useState<MemberFlagSummary | null>(null);

  /* Build query */
  const query: ListFlagsQuery = {
    page,
    pageSize,
    ...(preFilterUserId ? { userId: preFilterUserId } : {}),
    ...(flagType ? { flagTypes: [flagType as MemberFlagType] } : {}),
    ...(severity ? { severities: [severity as FlagSeverity] } : {}),
    ...(status ? { statuses: [status as FlagStatus] } : {}),
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  };

  const { data, isLoading, isError, error } = useAuditFlags(orgId, query);
  const createMutation = useCreateManualFlag();
  const resolveMutation = useResolveFlag();

  const flags = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;

  const handlePageChange = useCallback((_: React.ChangeEvent<unknown>, p: number) => {
    setPage(p);
  }, []);

  /* ─── Create Manual Flag Dialog ────────────────────────────────── */

  const [newFlag, setNewFlag] = useState<Partial<CreateManualFlagDto>>({
    severity: FlagSeverity.MEDIUM,
    description: '',
    userId: preFilterUserId ?? '',
  });
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!orgId || !newFlag.userId || !newFlag.description) return;
    if (newFlag.description.trim().length < 3) {
      setCreateError('Description must be at least 3 characters.');
      return;
    }
    try {
      setCreateError(null);
      await createMutation.mutateAsync({
        orgId,
        dto: {
          userId: newFlag.userId,
          severity: (newFlag.severity as FlagSeverity) ?? FlagSeverity.MEDIUM,
          description: newFlag.description,
        },
      });
      setCreateOpen(false);
      setNewFlag({ severity: FlagSeverity.MEDIUM, description: '', userId: preFilterUserId ?? '' });
    } catch (err: unknown) {
      if (isApiClientError(err)) {
        setCreateError(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to create flag.';
        setCreateError(msg);
        logger.error(
          'Manual flag create failed',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    }
  };

  /* ─── Resolve Flag Dialog ──────────────────────────────────────── */

  const [resolveForm, setResolveForm] = useState<ResolveFlagDto>({
    status: FlagStatus.RESOLVED,
    resolutionNote: '',
  });

  const handleResolve = async () => {
    if (!orgId || !resolveDialogFlag) return;
    await resolveMutation.mutateAsync({
      orgId,
      flagId: resolveDialogFlag.id,
      dto: resolveForm,
    });
    setResolveDialogFlag(null);
    setResolveForm({ status: FlagStatus.RESOLVED, resolutionNote: '' });
  };

  /* ─── Render ───────────────────────────────────────────────────── */

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <FlagIcon color="primary" />
          <Typography variant="h6">Audit Flags</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Toggle filters">
            <IconButton size="small" onClick={() => setFiltersOpen(v => !v)}>
              <FilterListIcon />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Manual Flag
          </Button>
        </Stack>
      </Stack>

      {/* Filters */}
      <Collapse in={filtersOpen}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={flagType}
              label="Type"
              onChange={(e: SelectChangeEvent) => {
                setFlagType(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="">All</MenuItem>
              {FLAG_TYPES.map(t => (
                <MenuItem key={t} value={t}>
                  {t.replaceAll('_', ' ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Severity</InputLabel>
            <Select
              value={severity}
              label="Severity"
              onChange={(e: SelectChangeEvent) => {
                setSeverity(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="">All</MenuItem>
              {SEVERITIES.map(s => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={status}
              label="Status"
              onChange={(e: SelectChangeEvent) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="">All</MenuItem>
              {STATUSES.map(s => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Collapse>

      {/* Error */}
      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load flags{error instanceof Error ? `: ${error.message}` : ''}
        </Alert>
      )}

      {/* Loading */}
      {isLoading && (
        <Stack spacing={1}>
          {['s1', 's2', 's3', 's4', 's5'].map(id => (
            <Skeleton key={id} variant="rectangular" height={72} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      )}

      {/* Empty State */}
      {!isLoading && flags.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No flags found for the current filters.
        </Typography>
      )}

      {/* Flag Cards */}
      <Stack spacing={1}>
        {flags.map(flag => (
          <Box
            key={flag.id}
            sx={{
              p: 1.5,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip
                  label={flag.severity}
                  size="small"
                  sx={getStatusChipSx(flag.severity, theme)}
                  variant="filled"
                />
                <Chip
                  label={flag.status}
                  size="small"
                  sx={getStatusChipSx(flag.status, theme)}
                  variant="outlined"
                />
                <Chip label={flag.flagType.replaceAll('_', ' ')} size="small" variant="outlined" />
                {flag.isAutoGenerated && <Chip label="Auto" size="small" />}
              </Stack>
              <Stack direction="row" spacing={0.5}>
                {flag.status === 'open' && (
                  <Button size="small" onClick={() => setResolveDialogFlag(flag)}>
                    Resolve
                  </Button>
                )}
                {onViewProfile && (
                  <Button size="small" onClick={() => onViewProfile(flag.userId)}>
                    Profile
                  </Button>
                )}
              </Stack>
            </Stack>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {flag.description}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(flag.createdAt)}
              {flag.resolvedAt && ` · Resolved ${formatDate(flag.resolvedAt)}`}
            </Typography>
          </Box>
        ))}
      </Stack>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={handlePageChange} size="small" />
        </Box>
      )}

      {/* ─── Create Manual Flag Dialog ─────────────────────────────── */}
      <Dialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Manual Flag</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {createError && <Alert severity="error">{createError}</Alert>}
            {!preFilterUserId && (
              <TextField
                label="User ID"
                size="small"
                fullWidth
                value={newFlag.userId ?? ''}
                onChange={e => setNewFlag(f => ({ ...f, userId: e.target.value }))}
              />
            )}
            <FormControl size="small" fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                value={newFlag.severity ?? FlagSeverity.MEDIUM}
                label="Severity"
                onChange={(e: SelectChangeEvent) =>
                  setNewFlag(f => ({ ...f, severity: e.target.value as FlagSeverity }))
                }
              >
                {SEVERITIES.map(s => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Description"
              size="small"
              fullWidth
              multiline
              minRows={3}
              value={newFlag.description ?? ''}
              onChange={e => setNewFlag(f => ({ ...f, description: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={createMutation.isPending || !newFlag.userId || !newFlag.description}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Flag'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Resolve Flag Dialog ───────────────────────────────────── */}
      <Dialog
        open={!!resolveDialogFlag}
        onClose={() => setResolveDialogFlag(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Resolve Flag</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Resolution</InputLabel>
              <Select
                value={resolveForm.status}
                label="Resolution"
                onChange={(e: SelectChangeEvent) =>
                  setResolveForm(f => ({
                    ...f,
                    status: e.target.value as ResolveFlagDto['status'],
                  }))
                }
              >
                <MenuItem value={FlagStatus.RESOLVED}>Resolved</MenuItem>
                <MenuItem value={FlagStatus.DISMISSED}>Dismissed</MenuItem>
                <MenuItem value={FlagStatus.ESCALATED}>Escalated</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Resolution Note"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={resolveForm.resolutionNote}
              onChange={e => setResolveForm(f => ({ ...f, resolutionNote: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialogFlag(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleResolve}
            disabled={resolveMutation.isPending || !resolveForm.resolutionNote}
          >
            {resolveMutation.isPending ? 'Saving...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
