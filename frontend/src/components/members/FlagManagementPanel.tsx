/**
 * FlagManagementPanel — Actionable member audit flag management
 *
 * Displays a table of member flags with:
 * - Status/severity filtering
 * - Resolve/dismiss/escalate actions
 * - Manual flag creation
 * - Expandable detail rows
 *
 * Wave 3.3 — Member Audit & Moderation Redesign
 */
import {
  useAuditFlags,
  useCreateManualFlag,
  useResolveFlag,
} from '@/hooks/queries/useMemberAuditQueries';
import { logger } from '@/utils/logger';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';

import type { MemberFlagSummary } from '@sc-fleet-manager/shared-types';
import { FlagSeverity, FlagStatus } from '@sc-fleet-manager/shared-types';

// ============================================================================
// Type helpers
// ============================================================================

interface FlagManagementPanelProps {
  readonly organizationId: string;
}

type StatusFilter = 'ALL' | FlagStatus;
type SeverityFilter = 'ALL' | FlagSeverity;

// ============================================================================
// Helpers
// ============================================================================

function getSeverityColor(severity: FlagSeverity): 'info' | 'warning' | 'error' | 'default' {
  switch (severity) {
    case FlagSeverity.CRITICAL:
      return 'error';
    case FlagSeverity.HIGH:
      return 'warning';
    case FlagSeverity.MEDIUM:
      return 'info';
    default:
      return 'default';
  }
}

function getStatusColor(status: FlagStatus): 'warning' | 'success' | 'default' | 'error' {
  switch (status) {
    case FlagStatus.OPEN:
      return 'warning';
    case FlagStatus.RESOLVED:
      return 'success';
    case FlagStatus.DISMISSED:
      return 'default';
    case FlagStatus.ESCALATED:
      return 'error';
    default:
      return 'default';
  }
}

function formatFlagType(flagType: string): string {
  return flagType
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// Resolve Dialog
// ============================================================================

interface ResolveDialogProps {
  readonly open: boolean;
  readonly flag: MemberFlagSummary | null;
  readonly onClose: () => void;
  readonly onSubmit: (
    status: FlagStatus.RESOLVED | FlagStatus.DISMISSED | FlagStatus.ESCALATED,
    note: string
  ) => void;
  readonly isPending: boolean;
}

const ResolveDialog: React.FC<ResolveDialogProps> = ({
  open,
  flag,
  onClose,
  onSubmit,
  isPending,
}) => {
  const [status, setStatus] = useState<
    FlagStatus.RESOLVED | FlagStatus.DISMISSED | FlagStatus.ESCALATED
  >(FlagStatus.RESOLVED);
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    if (!note.trim()) {
      return;
    }
    onSubmit(status, note.trim());
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Resolve Flag — {flag ? formatFlagType(flag.flagType) : ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel id="resolve-status-label">Action</InputLabel>
            <Select
              labelId="resolve-status-label"
              value={status}
              label="Action"
              onChange={e => setStatus(e.target.value as typeof status)}
            >
              <MenuItem value={FlagStatus.RESOLVED}>Resolve</MenuItem>
              <MenuItem value={FlagStatus.DISMISSED}>Dismiss</MenuItem>
              <MenuItem value={FlagStatus.ESCALATED}>Escalate</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Resolution Note"
            multiline
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
            required
            placeholder="Describe the action taken..."
            slotProps={{ htmlInput: { minLength: 1, maxLength: 2000 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isPending || !note.trim()}>
          {isPending ? <CircularProgress size={20} /> : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// Create Manual Flag Dialog
// ============================================================================

interface CreateFlagDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (userId: string, severity: FlagSeverity, description: string) => void;
  readonly isPending: boolean;
}

const CreateFlagDialog: React.FC<CreateFlagDialogProps> = ({
  open,
  onClose,
  onSubmit,
  isPending,
}) => {
  const [userId, setUserId] = useState('');
  const [severity, setSeverity] = useState<FlagSeverity>(FlagSeverity.MEDIUM);
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!userId.trim() || !description.trim()) {
      return;
    }
    onSubmit(userId.trim(), severity, description.trim());
  };

  const handleClose = () => {
    setUserId('');
    setSeverity(FlagSeverity.MEDIUM);
    setDescription('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Manual Flag</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="User ID"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            required
            placeholder="Target user ID"
          />
          <FormControl fullWidth>
            <InputLabel id="flag-severity-label">Severity</InputLabel>
            <Select
              labelId="flag-severity-label"
              value={severity}
              label="Severity"
              onChange={e => setSeverity(e.target.value as FlagSeverity)}
            >
              <MenuItem value={FlagSeverity.INFO}>Info</MenuItem>
              <MenuItem value={FlagSeverity.MEDIUM}>Medium</MenuItem>
              <MenuItem value={FlagSeverity.HIGH}>High</MenuItem>
              <MenuItem value={FlagSeverity.CRITICAL}>Critical</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Description"
            multiline
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
            placeholder="Describe the flag reason..."
            slotProps={{ htmlInput: { minLength: 3, maxLength: 2000 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isPending || !userId.trim() || !description.trim()}
        >
          {isPending ? <CircularProgress size={20} /> : 'Create Flag'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const FlagManagementPanel: React.FC<FlagManagementPanelProps> = ({ organizationId }) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(FlagStatus.OPEN);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [resolveTarget, setResolveTarget] = useState<MemberFlagSummary | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Build query from filters
  const query = {
    statuses: statusFilter === 'ALL' ? undefined : [statusFilter],
    severities: severityFilter === 'ALL' ? undefined : [severityFilter],
    page: page + 1,
    pageSize,
    sortBy: 'createdAt' as const,
    sortOrder: 'DESC' as const,
  };

  const { data, isLoading, error } = useAuditFlags(organizationId, query);
  const resolveFlag = useResolveFlag();
  const createFlag = useCreateManualFlag();

  const handleResolve = (
    status: FlagStatus.RESOLVED | FlagStatus.DISMISSED | FlagStatus.ESCALATED,
    note: string
  ) => {
    if (!resolveTarget) {
      return;
    }
    resolveFlag.mutate(
      {
        orgId: organizationId,
        flagId: resolveTarget.id,
        dto: { status, resolutionNote: note },
      },
      {
        onSuccess: () => {
          setResolveTarget(null);
        },
        onError: err => {
          logger.error(
            'Failed to resolve flag',
            err instanceof Error ? err : new Error(String(err))
          );
        },
      }
    );
  };

  const handleCreateFlag = (userId: string, severity: FlagSeverity, description: string) => {
    createFlag.mutate(
      {
        orgId: organizationId,
        dto: { userId, severity, description },
      },
      {
        onSuccess: () => {
          setShowCreateDialog(false);
        },
        onError: err => {
          logger.error(
            'Failed to create flag',
            err instanceof Error ? err : new Error(String(err))
          );
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load audit flags.</Alert>;
  }

  const flags = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <Box>
      {/* Toolbar */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="status-filter-label">Status</InputLabel>
          <Select
            labelId="status-filter-label"
            value={statusFilter}
            label="Status"
            onChange={e => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(0);
            }}
          >
            <MenuItem value="ALL">All Statuses</MenuItem>
            <MenuItem value={FlagStatus.OPEN}>Open</MenuItem>
            <MenuItem value={FlagStatus.RESOLVED}>Resolved</MenuItem>
            <MenuItem value={FlagStatus.DISMISSED}>Dismissed</MenuItem>
            <MenuItem value={FlagStatus.ESCALATED}>Escalated</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="severity-filter-label">Severity</InputLabel>
          <Select
            labelId="severity-filter-label"
            value={severityFilter}
            label="Severity"
            onChange={e => {
              setSeverityFilter(e.target.value as SeverityFilter);
              setPage(0);
            }}
          >
            <MenuItem value="ALL">All Severities</MenuItem>
            <MenuItem value={FlagSeverity.CRITICAL}>Critical</MenuItem>
            <MenuItem value={FlagSeverity.HIGH}>High</MenuItem>
            <MenuItem value={FlagSeverity.MEDIUM}>Medium</MenuItem>
            <MenuItem value={FlagSeverity.INFO}>Info</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1 }} />

        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setShowCreateDialog(true)}
        >
          Create Flag
        </Button>
      </Stack>

      {/* Flags Table */}
      {flags.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          No flags found matching the current filters.
        </Alert>
      ) : (
        <>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {flags.map(flag => (
                  <FlagRow key={flag.id} flag={flag} onResolve={() => setResolveTarget(flag)} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={e => {
              setPageSize(Number.parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25]}
          />
        </>
      )}

      {/* Resolve Dialog */}
      <ResolveDialog
        open={!!resolveTarget}
        flag={resolveTarget}
        onClose={() => setResolveTarget(null)}
        onSubmit={handleResolve}
        isPending={resolveFlag.isPending}
      />

      {/* Create Flag Dialog */}
      <CreateFlagDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateFlag}
        isPending={createFlag.isPending}
      />
    </Box>
  );
};

// ============================================================================
// Flag Row with expandable detail
// ============================================================================

interface FlagRowProps {
  readonly flag: MemberFlagSummary;
  readonly onResolve: () => void;
}

const FlagRow: React.FC<FlagRowProps> = ({ flag, onResolve }) => {
  const isOpen = flag.status === FlagStatus.OPEN;

  return (
    <TableRow hover>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center">
          {flag.isAutoGenerated ? (
            <PriorityHighIcon fontSize="small" color="action" />
          ) : (
            <AddIcon fontSize="small" color="action" />
          )}
          <Typography variant="body2">{formatFlagType(flag.flagType)}</Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Chip
          label={flag.severity}
          color={getSeverityColor(flag.severity)}
          size="small"
          variant="outlined"
        />
      </TableCell>
      <TableCell>
        <Chip label={flag.status} color={getStatusColor(flag.status)} size="small" />
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
          {flag.userId.slice(0, 8)}…
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {formatDate(flag.createdAt)}
        </Typography>
      </TableCell>
      <TableCell>
        {isOpen && (
          <Stack direction="row" spacing={0.5}>
            <Button
              size="small"
              color="success"
              onClick={onResolve}
              startIcon={<CheckCircleIcon />}
            >
              Resolve
            </Button>
          </Stack>
        )}
        {flag.status === FlagStatus.RESOLVED && (
          <Typography variant="caption" color="text.secondary">
            {flag.resolutionNote ? `${flag.resolutionNote.slice(0, 40)}…` : 'Resolved'}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
};
