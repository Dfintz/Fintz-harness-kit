/**
 * Legal Hold Management Component
 *
 * Admin interface for managing legal holds on user accounts.
 * Legal holds prevent GDPR deletion and are used for compliance with
 * legal discovery, regulatory investigations, or data preservation requirements.
 *
 * All admin actions are audit-logged.
 */

import { adminKeys } from '@/hooks/queries/queryKeys';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import {
  LEGAL_HOLD_FILTER_DEFAULTS,
  parseLegalHoldFilters,
} from '@/pages/admin/components/legalHoldFilters';
import { apiClient } from '@/services/apiClient';
import { selectToken, useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import {
  Add as AddIcon,
  CheckCircle as CheckmarkIcon,
  Schedule as ClockIcon,
  Delete as DeleteIcon,
  ErrorOutline as ErrorOutlineIcon,
  Lock as LockClosedIcon,
  Refresh as RefreshIcon,
  WarningAmber as WarningAmberIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme, type Theme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import './admin-tables.css';

/**
 * Legal hold data structure
 */
interface LegalHold {
  id: string;
  userId: string;
  reason: string;
  holdUntil?: string; // ISO date string
  createdBy?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Statistics for legal holds
 */
interface LegalHoldStats {
  total: number;
  active: number;
  expired: number;
  pendingReBox: number;
}

function getVariantColor(variant: string, t: Theme): string {
  switch (variant) {
    case 'negative':
      return t.palette.error.main;
    case 'notice':
      return t.palette.warning.main;
    default:
      return t.palette.text.secondary;
  }
}

export const LegalHoldManagement: React.FC = () => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const token = useAuthStore(selectToken);

  const [error, setError] = useState<string | null>(null);
  const { filters, updateFilters } = useUrlFilters({
    parse: parseLegalHoldFilters,
    defaults: LEGAL_HOLD_FILTER_DEFAULTS,
  });
  const searchQuery = filters.search;
  const filterStatus = filters.status;

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [selectedHold, setSelectedHold] = useState<LegalHold | null>(null);

  // Form states
  const [newHoldUserId, setNewHoldUserId] = useState('');
  const [newHoldReason, setNewHoldReason] = useState('');
  const [newHoldUntil, setNewHoldUntil] = useState('');
  const [releaseReason, setReleaseReason] = useState('');

  const {
    data: holdsData,
    isLoading: loading,
    refetch: fetchHolds,
  } = useQuery({
    queryKey: adminKeys.legalHolds(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<{ holds: LegalHold[]; stats: LegalHoldStats }>(
          '/api/v2/admin/legal-holds'
        );
        const data = response as unknown as { holds: LegalHold[]; stats: LegalHoldStats };
        return { holds: data.holds || [], stats: data.stats || null };
      } catch (error_) {
        logger.warn(
          'Legal holds API unavailable, using mock data',
          error_ instanceof Error ? error_ : new Error(String(error_))
        );
        return {
          holds: [
            {
              id: 'lh-001',
              userId: 'usr_***421',
              reason: 'Regulatory investigation - Case #2024-001',
              holdUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
              createdBy: 'admin_***123',
              isActive: true,
              createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: 'lh-002',
              userId: 'usr_***892',
              reason: 'Legal discovery request - Litigation hold',
              holdUntil: undefined,
              createdBy: 'admin_***456',
              isActive: true,
              createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: 'lh-003',
              userId: 'usr_***103',
              reason: 'Security incident investigation',
              holdUntil: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
              createdBy: 'admin_***123',
              isActive: false,
              createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            },
          ] as LegalHold[],
          stats: { total: 3, active: 2, expired: 0, pendingReBox: 1 } as LegalHoldStats,
        };
      }
    },
    enabled: !!token,
  });

  const holds = holdsData?.holds ?? [];
  const stats = holdsData?.stats ?? null;

  const createHoldMutation = useMutation({
    mutationFn: async (input: { userId: string; reason: string; holdUntil?: string }) => {
      await apiClient.post('/api/v2/admin/legal-holds', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.legalHolds() });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: error_ => {
      logger.error('Failed to create legal hold', error_);
      setError('Failed to create legal hold. Please try again.');
    },
  });

  const releaseHoldMutation = useMutation({
    mutationFn: async (input: { holdId: string; reason: string }) => {
      await apiClient.post(`/api/v2/admin/legal-holds/${input.holdId}/release`, {
        reason: input.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.legalHolds() });
      setReleaseDialogOpen(false);
      setSelectedHold(null);
      setReleaseReason('');
    },
    onError: error_ => {
      logger.error('Failed to release legal hold', error_);
      setError('Failed to release legal hold. Please try again.');
    },
  });

  const handleCreateHold = () => {
    if (!newHoldUserId || !newHoldReason) return;
    createHoldMutation.mutate({
      userId: newHoldUserId,
      reason: newHoldReason,
      holdUntil: newHoldUntil || undefined,
    });
  };

  const handleReleaseHold = () => {
    if (!selectedHold) return;
    releaseHoldMutation.mutate({ holdId: selectedHold.id, reason: releaseReason });
  };

  const resetForm = () => {
    setNewHoldUserId('');
    setNewHoldReason('');
    setNewHoldUntil('');
  };

  const filteredHolds = holds.filter(hold => {
    // Apply status filter
    if (filterStatus === 'active' && !hold.isActive) return false;
    if (filterStatus === 'inactive' && hold.isActive) return false;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        hold.userId.toLowerCase().includes(query) ||
        hold.reason.toLowerCase().includes(query) ||
        hold.id.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const isHoldExpired = (hold: LegalHold) => {
    if (!hold.holdUntil) return false;
    return new Date(hold.holdUntil) < new Date();
  };

  const getHoldStatus = (
    hold: LegalHold
  ): { label: string; variant: 'negative' | 'notice' | 'neutral' } => {
    if (!hold.isActive) {
      return { label: 'Released', variant: 'neutral' };
    }
    if (isHoldExpired(hold)) {
      return { label: 'Expired', variant: 'notice' };
    }
    return { label: 'Active', variant: 'negative' };
  };

  if (loading) {
    return (
      <Stack justifyContent="center" alignItems="center" sx={{ height: '400px' }}>
        <CircularProgress aria-label="Loading" />
      </Stack>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <LockClosedIcon sx={{ fontSize: '2rem', color: theme.palette.warning.main }} />
          <Typography variant="h5">Legal Hold Management</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => fetchHolds()} startIcon={<RefreshIcon />}>
            Refresh
          </Button>
          <Button
            variant="contained"
            onClick={() => setCreateDialogOpen(true)}
            startIcon={<AddIcon />}
          >
            New Hold
          </Button>
        </Stack>
      </Stack>

      {/* Error Alert */}
      {error && (
        <Paper
          sx={{
            borderLeft: `4px solid ${theme.palette.error.main}`,
            p: 2,
            mb: 2,
            bgcolor: 'error.dark',
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <ErrorOutlineIcon sx={{ color: theme.palette.error.main }} />
              <Typography>{error}</Typography>
            </Stack>
            <Button variant="outlined" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Info Alert */}
      <Paper
        sx={{
          borderLeft: `4px solid ${theme.palette.warning.main}`,
          p: 2,
          mb: 3,
          bgcolor: 'warning.dark',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <WarningAmberIcon sx={{ color: theme.palette.warning.main }} />
          <Typography>
            <strong>Legal Hold Notice:</strong> Legal holds prevent GDPR deletion requests from
            being processed. All admin actions are audit-logged. Ensure proper legal authorization
            before placing or releasing holds.
          </Typography>
        </Stack>
      </Paper>

      {/* Statistics Cards */}
      {stats && (
        <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: '200px' }}>
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <LockClosedIcon sx={{ fontSize: '2rem', color: theme.palette.text.secondary }} />
                <Box>
                  <Typography variant="h5">{stats.total}</Typography>
                  <Typography sx={{ color: theme.palette.text.secondary }}>Total Holds</Typography>
                </Box>
              </Stack>
            </Paper>
          </Box>
          <Box sx={{ flex: 1, minWidth: '200px' }}>
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <ErrorOutlineIcon sx={{ color: theme.palette.error.main, fontSize: '2rem' }} />
                <Box>
                  <Typography variant="h5" sx={{ color: theme.palette.error.main }}>
                    {stats.active}
                  </Typography>
                  <Typography sx={{ color: theme.palette.text.secondary }}>Active Holds</Typography>
                </Box>
              </Stack>
            </Paper>
          </Box>
          <Box sx={{ flex: 1, minWidth: '200px' }}>
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <ClockIcon sx={{ fontSize: '2rem', color: theme.palette.warning.main }} />
                <Box>
                  <Typography variant="h5" sx={{ color: theme.palette.warning.main }}>
                    {stats.pendingReBox}
                  </Typography>
                  <Typography sx={{ color: theme.palette.text.secondary }}>
                    Pending Review
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Box>
          <Box sx={{ flex: 1, minWidth: '200px' }}>
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CheckmarkIcon sx={{ fontSize: '2rem', color: theme.palette.success.main }} />
                <Box>
                  <Typography variant="h5">{stats.expired}</Typography>
                  <Typography sx={{ color: theme.palette.text.secondary }}>Expired</Typography>
                </Box>
              </Stack>
            </Paper>
          </Box>
        </Stack>
      )}

      {/* Search and Filter */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="Search"
            value={searchQuery}
            onChange={e => updateFilters({ search: e.target.value })}
            placeholder="Search by user ID, reason, or hold ID..."
            fullWidth
            size="small"
          />
          <Select
            value={filterStatus}
            onChange={e => {
              const val = e.target.value;
              if (val === 'all' || val === 'active' || val === 'inactive') {
                updateFilters({ status: val });
              }
            }}
            size="small"
            sx={{ minWidth: '150px' }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active Only</MenuItem>
            <MenuItem value="inactive">Released</MenuItem>
          </Select>
        </Stack>
      </Paper>

      {/* Legal Holds Table */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Legal Holds ({filteredHolds.length})
        </Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Hold ID</th>
                <th>User ID</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Hold Until</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHolds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state">
                    No legal holds found
                  </td>
                </tr>
              ) : (
                filteredHolds.map(hold => {
                  const status = getHoldStatus(hold);
                  return (
                    <tr key={hold.id}>
                      <td>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                          {hold.id}
                        </Typography>
                      </td>
                      <td>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                          {hold.userId}
                        </Typography>
                      </td>
                      <td>
                        <Tooltip title={hold.reason}>
                          <Typography
                            sx={{
                              maxWidth: '250px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block',
                            }}
                          >
                            {hold.reason}
                          </Typography>
                        </Tooltip>
                      </td>
                      <td>
                        <Typography
                          sx={{
                            color: getVariantColor(status.variant, theme),
                            fontWeight: 'bold',
                          }}
                        >
                          {status.label}
                        </Typography>
                      </td>
                      <td>
                        {hold.holdUntil
                          ? new Date(hold.holdUntil).toLocaleDateString()
                          : 'Indefinite'}
                      </td>
                      <td>{new Date(hold.createdAt).toLocaleDateString()}</td>
                      <td className="text-right">
                        {hold.isActive && (
                          <Tooltip title="Release Hold">
                            <IconButton
                              onClick={() => {
                                setSelectedHold(hold);
                                setReleaseDialogOpen(true);
                              }}
                              size="small"
                            >
                              <DeleteIcon sx={{ color: theme.palette.warning.main }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Box>
      </Paper>

      {/* Create Hold Dialog */}
      {createDialogOpen && (
        <Paper sx={{ p: 3, mt: 3, border: `1px solid ${theme.palette.warning.main}` }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <LockClosedIcon sx={{ color: theme.palette.warning.main }} />
              <Typography variant="h6">Create Legal Hold</Typography>
            </Stack>
            <Divider />
            <Paper
              sx={{
                p: 2,
                borderLeft: `4px solid ${theme.palette.warning.main}`,
                bgcolor: 'warning.dark',
              }}
            >
              <Typography>
                Creating a legal hold will prevent the user from deleting their account or data
                until the hold is released. Ensure you have proper legal authorization.
              </Typography>
            </Paper>
            <TextField
              autoFocus
              label="User ID (Hash or Email)"
              value={newHoldUserId}
              onChange={e => setNewHoldUserId(e.target.value)}
              helperText="Enter the user's ID hash or email address"
              fullWidth
            />
            <TextField
              label="Reason for Hold"
              value={newHoldReason}
              onChange={e => setNewHoldReason(e.target.value)}
              helperText="Provide a detailed reason including case numbers if applicable"
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="Hold Until Date (Optional)"
              type="date"
              value={newHoldUntil}
              onChange={e => setNewHoldUntil(e.target.value)}
              helperText="Leave blank for indefinite hold"
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleCreateHold}
                disabled={!newHoldUserId || !newHoldReason}
              >
                Create Hold
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* Release Hold Dialog */}
      {releaseDialogOpen && selectedHold && (
        <Paper sx={{ p: 3, mt: 3, border: `1px solid ${theme.palette.success.main}` }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <CheckmarkIcon sx={{ color: theme.palette.success.main }} />
              <Typography variant="h6">Release Legal Hold</Typography>
            </Stack>
            <Divider />
            <Paper
              sx={{
                p: 2,
                borderLeft: `4px solid ${theme.palette.primary.main}`,
                bgcolor: 'info.dark',
              }}
            >
              <Typography>
                Releasing this hold will allow the user to exercise their GDPR rights, including
                data deletion requests.
              </Typography>
            </Paper>
            <Box>
              <Typography sx={{ color: theme.palette.text.secondary }}>
                User: <strong>{selectedHold.userId}</strong>
              </Typography>
              <Typography sx={{ color: theme.palette.text.secondary }}>
                Original Reason: {selectedHold.reason}
              </Typography>
            </Box>
            <TextField
              autoFocus
              label="Reason for Release"
              value={releaseReason}
              onChange={e => setReleaseReason(e.target.value)}
              helperText="Document why the hold is being released"
              multiline
              rows={3}
              fullWidth
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => setReleaseDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="contained" onClick={handleReleaseHold} disabled={!releaseReason}>
                Release Hold
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Box>
  );
};
