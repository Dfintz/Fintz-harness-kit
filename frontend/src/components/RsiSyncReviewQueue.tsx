/**
 * RSI Sync Review Queue Component
 *
 * Displays links flagged for admin review and allows resolution.
 * Supports approve, reject, resync, and remove actions.
 *
 * Wave 1.6: RSI Sync Review Queue
 */

import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import FlagIcon from '@mui/icons-material/Flag';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
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
  Grid,
  IconButton,
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
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { isApiClientError } from '@/services/apiClient';
import {
  ReviewQueueItem,
  ReviewResolution,
  ReviewStats,
  rsiSyncService,
} from '@/services/rsiSyncService';
import { useNotification } from '@/store/uiStore';
import { getStatusChipSx, getStatusColor } from '@/utils/statusStyles';

interface RsiSyncReviewQueueProps {
  organizationId: string;
}

const reasonLabels: Record<string, string> = {
  rank_mismatch: 'Rank Mismatch',
  handle_not_found: 'Handle Not Found',
  multiple_failures: 'Multiple Failures',
  manual_flag: 'Manually Flagged',
  affiliate_change: 'Affiliate Change',
  suspicious_activity: 'Suspicious Activity',
  unknown: 'Unknown',
};

export const RsiSyncReviewQueue: React.FC<RsiSyncReviewQueueProps> = ({ organizationId }) => {
  const theme = useTheme();
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReviewQueueItem | null>(null);
  const [selectedResolution, setSelectedResolution] = useState<ReviewResolution>('approved');
  const [adminNotes, setAdminNotes] = useState('');
  const [updatedRank, setUpdatedRank] = useState('');

  const notification = useNotification();
  const showErrorRef = useRef(notification.error);
  showErrorRef.current = notification.error;

  const loadData = useCallback(async () => {
    try {
      const [queueData, statsData] = await Promise.all([
        rsiSyncService.getReviewQueue(organizationId, { limit: 50 }),
        rsiSyncService.getReviewStats(organizationId),
      ]);
      setItems(queueData?.items ?? []);
      setTotal(queueData?.total ?? 0);
      setStats(statsData ?? null);
    } catch (err: unknown) {
      if (isApiClientError(err) && (err.statusCode === 403 || err.statusCode === 401)) {
        setPermissionDenied(true);
      } else {
        showErrorRef.current(
          (err as Error).message || 'Failed to load review queue',
          'Load Failed'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openResolveDialog = (item: ReviewQueueItem, resolution: ReviewResolution) => {
    setSelectedItem(item);
    setSelectedResolution(resolution);
    setAdminNotes('');
    setUpdatedRank(item.lastKnownRank ?? '');
    setDialogOpen(true);
  };

  const handleResolve = async () => {
    if (!selectedItem) return;

    setResolving(selectedItem.id);
    setDialogOpen(false);

    try {
      await rsiSyncService.resolveReviewItem(organizationId, {
        linkId: selectedItem.id,
        resolution: selectedResolution,
        adminNotes: adminNotes || undefined,
        updatedRank: updatedRank || undefined,
      });
      notification.success(`${selectedItem.rsiHandle} marked as ${selectedResolution}`, 'Resolved');
      await loadData();
    } catch (err: unknown) {
      notification.error((err as Error).message || 'Failed to resolve review item', 'Failed');
    } finally {
      setResolving(null);
      setSelectedItem(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={32} />
        <Typography sx={{ mt: 1 }}>Loading review queue...</Typography>
      </Box>
    );
  }

  if (permissionDenied) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        RSI Sync Review Queue is only available to system administrators.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <FlagIcon color="warning" />
          <Typography variant="h6">Review Queue</Typography>
          {total > 0 && <Chip label={`${total} pending`} color="warning" size="small" />}
        </Stack>
        <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={loadData}>
          Refresh
        </Button>
      </Stack>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Pending Review
                </Typography>
                <Typography variant="h5" color="warning.main">
                  {stats.totalPendingReview}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Resolved (30d)
                </Typography>
                <Typography variant="h5" color="success.main">
                  {stats.resolvedLast30Days}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          {Object.entries(stats.byReason ?? {})
            .slice(0, 2)
            .map(([reason, count]) => (
              <Grid size={{ xs: 6, md: 3 }} key={reason}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      {reasonLabels[reason] ?? reason}
                    </Typography>
                    <Typography variant="h5">{count}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
        </Grid>
      )}

      {/* Queue Table */}
      {items.length === 0 ? (
        <Alert severity="success" icon={<CheckCircleIcon />}>
          No items pending review. All RSI sync links are in good shape.
        </Alert>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>RSI Handle</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Last Rank</TableCell>
                <TableCell>Flagged</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={600}>
                        {item.rsiHandle}
                      </Typography>
                      {item.isAffiliate && (
                        <Chip label="Affiliate" size="small" variant="outlined" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={reasonLabels[item.reviewReason ?? 'unknown'] ?? item.reviewReason}
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                    {item.lastFailureReason && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        {item.lastFailureReason}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.lastKnownRank ?? '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {item.reviewFlaggedAt
                        ? new Date(item.reviewFlaggedAt).toLocaleDateString()
                        : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {resolving === item.id ? (
                      <CircularProgress size={20} />
                    ) : (
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Approve (mark as synced)">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => openResolveDialog(item, 'approved')}
                          >
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Re-sync (reset to pending)">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() => openResolveDialog(item, 'resynced')}
                          >
                            <SyncIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reject">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => openResolveDialog(item, 'rejected')}
                          >
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove member">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => openResolveDialog(item, 'removed')}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Resolve Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Resolve Review — {selectedItem?.rsiHandle}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Resolution
              </Typography>
              <Chip label={selectedResolution} sx={getStatusChipSx(selectedResolution, theme)} />
            </Box>
            {selectedResolution === 'resynced' && (
              <TextField
                label="Updated Rank (optional)"
                value={updatedRank}
                onChange={e => setUpdatedRank(e.target.value)}
                size="small"
                fullWidth
              />
            )}
            <TextField
              label="Admin Notes (optional)"
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              size="small"
              fullWidth
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleResolve}
            sx={{
              bgcolor: getStatusColor(selectedResolution, theme),
              color: theme.palette.getContrastText(getStatusColor(selectedResolution, theme)),
              '&:hover': {
                bgcolor: alpha(getStatusColor(selectedResolution, theme), 0.85),
              },
            }}
          >
            Confirm {selectedResolution}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
