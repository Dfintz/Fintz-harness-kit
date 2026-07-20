/**
 * OrgWatchlistPanel
 *
 * CRUD panel for managing the citizen watchlist.
 * Supports adding citizens to the watchlist, editing threat levels / reasons,
 * and removing entries. Designed for embedding in org settings or intel pages.
 *
 * Wave 2.1 — Membership Audit & Intel (Phase F3)
 */
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import type { SelectChangeEvent } from '@mui/material/Select';
import React, { useCallback, useState } from 'react';

import { isApiClientError } from '@/services/apiClient';
import { logger } from '@/utils/logger';
import type {
  CreateWatchlistEntryDto,
  ListWatchlistQuery,
  UpdateWatchlistEntryDto,
  WatchlistEntrySummary,
} from '@sc-fleet-manager/shared-types';
import { WatchlistReason, WatchlistThreatLevel } from '@sc-fleet-manager/shared-types';

import {
  useCreateWatchlistEntry,
  useDeleteWatchlistEntry,
  useUpdateWatchlistEntry,
  useWatchlistEntries,
} from '@/hooks/queries';

/* ────────────────────────────────────────────────────────────────── */
/*  Constants                                                         */
/* ────────────────────────────────────────────────────────────────── */

const REASONS: WatchlistReason[] = [
  WatchlistReason.HOSTILE,
  WatchlistReason.GRIEFER,
  WatchlistReason.SUSPICIOUS,
  WatchlistReason.UNDER_INVESTIGATION,
  WatchlistReason.REDACTED,
  WatchlistReason.NEGATIVE_HISTORY,
  WatchlistReason.IMPERSONATION,
  WatchlistReason.SPY,
  WatchlistReason.OTHER,
];

const THREAT_LEVELS: WatchlistThreatLevel[] = [
  WatchlistThreatLevel.LOW,
  WatchlistThreatLevel.MODERATE,
  WatchlistThreatLevel.HIGH,
  WatchlistThreatLevel.CRITICAL,
];

const THREAT_COLOR: Record<WatchlistThreatLevel, 'success' | 'warning' | 'error'> = {
  [WatchlistThreatLevel.LOW]: 'success',
  [WatchlistThreatLevel.MODERATE]: 'warning',
  [WatchlistThreatLevel.HIGH]: 'error',
  [WatchlistThreatLevel.CRITICAL]: 'error',
};

const REASON_LABEL: Record<WatchlistReason, string> = {
  [WatchlistReason.HOSTILE]: 'Hostile',
  [WatchlistReason.GRIEFER]: 'Griefer',
  [WatchlistReason.SUSPICIOUS]: 'Suspicious',
  [WatchlistReason.UNDER_INVESTIGATION]: 'Under Investigation',
  [WatchlistReason.REDACTED]: 'Redacted',
  [WatchlistReason.NEGATIVE_HISTORY]: 'Negative History',
  [WatchlistReason.IMPERSONATION]: 'Impersonation',
  [WatchlistReason.SPY]: 'Spy',
  [WatchlistReason.OTHER]: 'Other',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ────────────────────────────────────────────────────────────────── */
/*  Props                                                             */
/* ────────────────────────────────────────────────────────────────── */

export interface OrgWatchlistPanelProps {
  orgId: string | undefined;
}

/* ────────────────────────────────────────────────────────────────── */
/*  Component                                                         */
/* ────────────────────────────────────────────────────────────────── */

export const OrgWatchlistPanel: React.FC<Readonly<OrgWatchlistPanelProps>> = ({ orgId }) => {
  /* Pagination & search */
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const pageSize = 15;

  const query: ListWatchlistQuery = {
    page,
    pageSize,
    ...(search ? { search } : {}),
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  };

  const { data, isLoading, isError, error } = useWatchlistEntries(orgId, query);
  const createMutation = useCreateWatchlistEntry();
  const updateMutation = useUpdateWatchlistEntry();
  const deleteMutation = useDeleteWatchlistEntry();

  const entries = data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  /* Dialog state */
  const [createOpen, setCreateOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<WatchlistEntrySummary | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<WatchlistEntrySummary | null>(null);

  /* ─── Create Form ─────────────────────────────────────────────── */

  const emptyCreate: CreateWatchlistEntryDto = {
    rsiHandle: '',
    citizenName: '',
    reason: WatchlistReason.SUSPICIOUS,
    threatLevel: WatchlistThreatLevel.MODERATE,
    notes: '',
  };
  const [createForm, setCreateForm] = useState<CreateWatchlistEntryDto>(emptyCreate);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!orgId || !createForm.rsiHandle) return;
    try {
      setCreateError(null);
      await createMutation.mutateAsync({ orgId, dto: createForm });
      setCreateOpen(false);
      setCreateForm(emptyCreate);
    } catch (err: unknown) {
      if (isApiClientError(err) && err.statusCode === 409) {
        setCreateError('This RSI handle is already on the watchlist.');
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to add watchlist entry.';
        setCreateError(msg);
        logger.error(
          'Watchlist create failed',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    }
  };

  /* ─── Edit Form ───────────────────────────────────────────────── */

  const [editForm, setEditForm] = useState<UpdateWatchlistEntryDto>({});

  const openEdit = useCallback((entry: WatchlistEntrySummary) => {
    setEditEntry(entry);
    setEditForm({
      reason: entry.reason,
      threatLevel: entry.threatLevel,
      notes: entry.notes ?? '',
      citizenName: entry.citizenName,
    });
  }, []);

  const handleEdit = async () => {
    if (!orgId || !editEntry) return;
    await updateMutation.mutateAsync({ orgId, entryId: editEntry.id, dto: editForm });
    setEditEntry(null);
  };

  /* ─── Delete ──────────────────────────────────────────────────── */

  const handleDelete = async () => {
    if (!orgId || !deleteEntry) return;
    await deleteMutation.mutateAsync({ orgId, entryId: deleteEntry.id });
    setDeleteEntry(null);
  };

  const handlePageChange = useCallback((_: React.ChangeEvent<unknown>, p: number) => {
    setPage(p);
  }, []);

  /* ─── Render ───────────────────────────────────────────────────── */

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PersonSearchIcon color="primary" />
          <Typography variant="h6">Citizen Watchlist</Typography>
        </Stack>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          Add Entry
        </Button>
      </Stack>

      {/* Search */}
      <TextField
        placeholder="Search by RSI handle or name..."
        size="small"
        fullWidth
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          setPage(1);
        }}
        sx={{ mb: 2 }}
      />

      {/* Error */}
      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load watchlist{error instanceof Error ? `: ${error.message}` : ''}
        </Alert>
      )}

      {/* Loading */}
      {isLoading && (
        <Stack spacing={1}>
          {['s1', 's2', 's3', 's4', 's5'].map(id => (
            <Skeleton key={id} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      )}

      {/* Empty */}
      {!isLoading && entries.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No watchlist entries. Add citizens to monitor.
        </Typography>
      )}

      {/* Table */}
      {entries.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>RSI Handle</TableCell>
                <TableCell>Citizen Name</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Threat</TableCell>
                <TableCell>Added</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map(entry => (
                <TableRow key={entry.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {entry.rsiHandle}
                    </Typography>
                  </TableCell>
                  <TableCell>{entry.citizenName}</TableCell>
                  <TableCell>
                    <Chip
                      label={REASON_LABEL[entry.reason] ?? entry.reason}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={entry.threatLevel}
                      size="small"
                      color={THREAT_COLOR[entry.threatLevel]}
                      variant="filled"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{formatDate(entry.createdAt)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(entry)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove">
                        <IconButton size="small" onClick={() => setDeleteEntry(entry)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={handlePageChange} size="small" />
        </Box>
      )}

      {/* ─── Create Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Watchlist Entry</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {createError && <Alert severity="error">{createError}</Alert>}
            <TextField
              label="RSI Handle"
              size="small"
              fullWidth
              required
              value={createForm.rsiHandle}
              onChange={e => setCreateForm(f => ({ ...f, rsiHandle: e.target.value }))}
            />
            <TextField
              label="Citizen Name"
              size="small"
              fullWidth
              value={createForm.citizenName}
              onChange={e => setCreateForm(f => ({ ...f, citizenName: e.target.value }))}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Reason</InputLabel>
              <Select
                value={createForm.reason}
                label="Reason"
                onChange={(e: SelectChangeEvent) =>
                  setCreateForm(f => ({ ...f, reason: e.target.value as WatchlistReason }))
                }
              >
                {REASONS.map(r => (
                  <MenuItem key={r} value={r}>
                    {REASON_LABEL[r]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Threat Level</InputLabel>
              <Select
                value={createForm.threatLevel}
                label="Threat Level"
                onChange={(e: SelectChangeEvent) =>
                  setCreateForm(f => ({
                    ...f,
                    threatLevel: e.target.value as WatchlistThreatLevel,
                  }))
                }
              >
                {THREAT_LEVELS.map(t => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Notes"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={createForm.notes ?? ''}
              onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={createMutation.isPending || !createForm.rsiHandle}
          >
            {createMutation.isPending ? 'Adding...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Edit Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!editEntry} onClose={() => setEditEntry(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Watchlist Entry</DialogTitle>
        <DialogContent dividers>
          {editEntry && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Editing: <strong>{editEntry.rsiHandle}</strong>
              </Typography>
              <TextField
                label="Citizen Name"
                size="small"
                fullWidth
                value={editForm.citizenName ?? ''}
                onChange={e => setEditForm(f => ({ ...f, citizenName: e.target.value }))}
              />
              <FormControl size="small" fullWidth>
                <InputLabel>Reason</InputLabel>
                <Select
                  value={editForm.reason ?? editEntry.reason}
                  label="Reason"
                  onChange={(e: SelectChangeEvent) =>
                    setEditForm(f => ({ ...f, reason: e.target.value as WatchlistReason }))
                  }
                >
                  {REASONS.map(r => (
                    <MenuItem key={r} value={r}>
                      {REASON_LABEL[r]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Threat Level</InputLabel>
                <Select
                  value={editForm.threatLevel ?? editEntry.threatLevel}
                  label="Threat Level"
                  onChange={(e: SelectChangeEvent) =>
                    setEditForm(f => ({
                      ...f,
                      threatLevel: e.target.value as WatchlistThreatLevel,
                    }))
                  }
                >
                  {THREAT_LEVELS.map(t => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Notes"
                size="small"
                fullWidth
                multiline
                minRows={2}
                value={editForm.notes ?? ''}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditEntry(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Delete Confirm Dialog ─────────────────────────────────── */}
      <Dialog open={!!deleteEntry} onClose={() => setDeleteEntry(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove Watchlist Entry</DialogTitle>
        <DialogContent>
          <Typography>
            Remove <strong>{deleteEntry?.citizenName ?? deleteEntry?.rsiHandle}</strong> from the
            watchlist? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteEntry(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
