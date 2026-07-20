import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useState } from 'react';

import { getErrorMessage } from '@/services/apiClient';
import { invitationService } from '@/services/invitationService';
import { useNotification } from '@/store/uiStore';
import { getStatusChipSx } from '@/utils/statusStyles';

import type { InvitationDto, InvitationStatus } from '@sc-fleet-manager/shared-types';

interface InvitationReviewPanelProps {
  organizationId: string;
  refreshTrigger?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function formatExpiry(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) return `${diffHours}h left`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d left`;
}

// ── Component ────────────────────────────────────────────────────────

/**
 * InvitationReviewPanel — Admin panel for managing org invitations.
 *
 * Displays a table of invitations with approve/reject actions for
 * member-sent invitations that need admin approval.
 */
export const InvitationReviewPanel: React.FC<InvitationReviewPanelProps> = ({
  organizationId,
  refreshTrigger,
}) => {
  const theme = useTheme();
  const notification = useNotification();
  const [invitations, setInvitations] = useState<InvitationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<InvitationStatus | undefined>(undefined);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Data Loading ──────────────────────────────────────────────

  const loadInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invitationService.getInvitationsForOrg(organizationId, {
        status: statusFilter,
        page: page + 1,
        limit: rowsPerPage,
      });
      setInvitations(result.data ?? []);
      setTotal(result.meta?.total ?? 0);
    } catch (err) {
      notification.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [organizationId, statusFilter, page, rowsPerPage]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations, refreshTrigger]);

  // ── Actions ───────────────────────────────────────────────────

  const handleApprove = async (invitationId: string) => {
    setActionLoading(invitationId);
    try {
      await invitationService.approveInvitation(organizationId, invitationId);
      await loadInvitations();
    } catch (err) {
      notification.error(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (invitationId: string) => {
    setActionLoading(invitationId);
    try {
      await invitationService.rejectInvitation(organizationId, invitationId);
      await loadInvitations();
    } catch (err) {
      notification.error(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  // ── Filter Chips ──────────────────────────────────────────────

  const statusOptions: Array<{ label: string; value: InvitationStatus | undefined }> = [
    { label: 'All', value: undefined },
    { label: 'Pending', value: 'pending' as InvitationStatus },
    { label: 'Approved', value: 'approved' as InvitationStatus },
    { label: 'Accepted', value: 'accepted' as InvitationStatus },
    { label: 'Rejected', value: 'rejected' as InvitationStatus },
    { label: 'Declined', value: 'declined' as InvitationStatus },
    { label: 'Expired', value: 'expired' as InvitationStatus },
  ];

  // ── Render ────────────────────────────────────────────────────

  const renderBody = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      );
    }

    if (invitations.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 6, color: theme.palette.text.secondary }}>
          <MailOutlineIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
          <Typography variant="body1">No invitations</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {statusFilter
              ? `No ${statusFilter} invitations found.`
              : 'No invitations have been sent yet.'}
          </Typography>
        </Box>
      );
    }

    return (
      <>
        <TableContainer>
          <Table size="small" aria-label="Organization invitations">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                  }}
                >
                  Invitee
                </TableCell>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                  }}
                >
                  Invited By
                </TableCell>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                  }}
                >
                  Role
                </TableCell>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                  }}
                >
                  Sent
                </TableCell>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                  }}
                >
                  Expires
                </TableCell>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                  }}
                >
                  Status
                </TableCell>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                  }}
                  align="right"
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invitations.map(invitation => (
                <TableRow
                  key={invitation.id}
                  sx={{ '&:hover': { bgcolor: alpha(theme.palette.background.paper, 0.4) } }}
                >
                  <TableCell
                    sx={{
                      color: theme.palette.common.white,
                      borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                    }}
                  >
                    {invitation.inviteeUsername || invitation.inviteeUserId}
                  </TableCell>
                  <TableCell
                    sx={{
                      color: theme.palette.text.secondary,
                      borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                    }}
                  >
                    {invitation.inviterUsername || invitation.inviterId}
                  </TableCell>
                  <TableCell
                    sx={{
                      color: theme.palette.text.secondary,
                      borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                    }}
                  >
                    <Chip label={invitation.inviterRole} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell
                    sx={{
                      color: theme.palette.text.secondary,
                      borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                    }}
                  >
                    {formatDate(invitation.createdAt)}
                  </TableCell>
                  <TableCell
                    sx={{
                      color: theme.palette.text.secondary,
                      borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                    }}
                  >
                    {formatExpiry(invitation.expiresAt)}
                  </TableCell>
                  <TableCell
                    sx={{ borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}` }}
                  >
                    <Chip
                      label={invitation.status}
                      sx={getStatusChipSx(invitation.status, theme)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell
                    sx={{ borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}` }}
                    align="right"
                  >
                    {invitation.status === 'pending' ? (
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {actionLoading === invitation.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <>
                            <Tooltip title="Approve — send invitation to the user">
                              <IconButton
                                size="small"
                                onClick={() => handleApprove(invitation.id)}
                                sx={{ color: theme.palette.success.dark }}
                                aria-label="Approve invitation"
                              >
                                <CheckIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject — cancel this invitation">
                              <IconButton
                                size="small"
                                onClick={() => handleReject(invitation.id)}
                                sx={{ color: theme.palette.error.light }}
                                aria-label="Reject invitation"
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Stack>
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{ color: theme.palette.text.disabled, fontStyle: 'italic' }}
                      >
                        —
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={e => {
            setRowsPerPage(Number.parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25]}
          sx={{
            color: theme.palette.text.secondary,
            '.MuiTablePagination-selectIcon': { color: theme.palette.text.secondary },
          }}
        />
      </>
    );
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <MailOutlineIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
          Sent Invitations
        </Typography>
        {!loading && total > 0 && (
          <Chip
            label={total}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        )}
      </Stack>
      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
        Invitations your organization has sent to prospective members.
      </Typography>

      {/* Status filter chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        {statusOptions.map(opt => (
          <Chip
            key={opt.label}
            label={opt.label}
            size="small"
            variant={statusFilter === opt.value ? 'filled' : 'outlined'}
            color={statusFilter === opt.value ? 'primary' : 'default'}
            onClick={() => {
              setStatusFilter(opt.value);
              setPage(0);
            }}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Stack>

      {renderBody()}
    </Box>
  );
};
