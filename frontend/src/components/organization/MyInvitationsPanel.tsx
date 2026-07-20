import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useState } from 'react';

import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';

import { getErrorMessage } from '@/services/apiClient';
import { invitationService } from '@/services/invitationService';
import { useNotification } from '@/store/uiStore';
import { getStatusChipSx } from '@/utils/statusStyles';

import type { InvitationDto } from '@sc-fleet-manager/shared-types';

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
 * MyInvitationsPanel — User panel showing received invitations with accept/decline actions.
 *
 * Displays all invitations sent to the current user across all organizations.
 * Users can accept (join the org) or decline approved invitations.
 */
export const MyInvitationsPanel: React.FC = () => {
  const theme = useTheme();
  const notification = useNotification();
  const [invitations, setInvitations] = useState<InvitationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'accept' | 'decline'>('accept');
  const {
    dialogProps,
    openDialog: openConfirmDialog,
    pendingData: pendingInvitation,
  } = useConfirmDialog<InvitationDto>();

  // ── Data Loading ──────────────────────────────────────────────

  const loadInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invitationService.getMyInvitations();
      // Defensive: handle both array and envelope { data: [...] } responses
      type InvitationsEnvelope = { data?: InvitationDto[] };
      let invArray: InvitationDto[] = [];
      if (Array.isArray(data)) {
        invArray = data;
      } else {
        const envelope = data as InvitationsEnvelope;
        if (Array.isArray(envelope.data)) {
          invArray = envelope.data;
        }
      }
      setInvitations(invArray);
    } catch (err) {
      notification.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  // ── Actions ───────────────────────────────────────────────────

  const handleAccept = async (invitation: InvitationDto) => {
    if (!invitation.token) {
      notification.error('Missing invitation token');
      return;
    }
    setActionLoading(invitation.id);
    try {
      await invitationService.acceptInvitation(invitation.token);
      await loadInvitations();
    } catch (err) {
      notification.error(getErrorMessage(err));
    } finally {
      setActionLoading(null);
      dialogProps.onCancel();
    }
  };

  const handleDecline = async (invitation: InvitationDto) => {
    if (!invitation.token) {
      notification.error('Missing invitation token');
      return;
    }
    setActionLoading(invitation.id);
    try {
      await invitationService.declineInvitation(invitation.token);
      await loadInvitations();
    } catch (err) {
      notification.error(getErrorMessage(err));
    } finally {
      setActionLoading(null);
      dialogProps.onCancel();
    }
  };

  const handleOpenConfirm = (action: 'accept' | 'decline', invitation: InvitationDto) => {
    setConfirmAction(action);
    openConfirmDialog(invitation);
  };

  // ── Can user act on this invitation? ──────────────────────────

  const canActOn = (invitation: InvitationDto): boolean => {
    if (invitation.status !== 'approved') return false;
    // Don't show action buttons for expired invitations
    const expiresAt = new Date(invitation.expiresAt);
    return expiresAt > new Date();
  };

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theme.palette.common.white }}>
        My Invitations
      </Typography>

      {invitations.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: theme.palette.text.secondary }}>
          <MailOutlineIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
          <Typography variant="body1">No invitations</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            You haven&apos;t received any organization invitations yet.
          </Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table size="small" aria-label="My invitations">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                  }}
                >
                  Organization
                </TableCell>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                  }}
                >
                  Message
                </TableCell>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                  }}
                >
                  Received
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
                    {invitation.organizationName || invitation.organizationId}
                  </TableCell>
                  <TableCell
                    sx={{
                      color: theme.palette.text.secondary,
                      borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                      maxWidth: 200,
                    }}
                  >
                    <Tooltip title={invitation.message || ''}>
                      <Typography variant="body2" noWrap>
                        {invitation.message || '—'}
                      </Typography>
                    </Tooltip>
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
                    {canActOn(invitation) ? (
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {actionLoading === invitation.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <>
                            <Tooltip title="Accept invitation — join this organization">
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={<CheckIcon />}
                                onClick={() => handleOpenConfirm('accept', invitation)}
                                sx={{
                                  bgcolor: theme.palette.success.dark,
                                  '&:hover': { bgcolor: theme.palette.success.main },
                                  textTransform: 'none',
                                  minWidth: 'auto',
                                }}
                              >
                                Accept
                              </Button>
                            </Tooltip>
                            <Tooltip title="Decline invitation">
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<CloseIcon />}
                                onClick={() => handleOpenConfirm('decline', invitation)}
                                sx={{
                                  color: theme.palette.error.light,
                                  borderColor: alpha(theme.palette.error.light, 0.4),
                                  '&:hover': {
                                    borderColor: theme.palette.error.light,
                                    bgcolor: alpha(theme.palette.error.light, 0.08),
                                  },
                                  textTransform: 'none',
                                  minWidth: 'auto',
                                }}
                              >
                                Decline
                              </Button>
                            </Tooltip>
                          </>
                        )}
                      </Stack>
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{ color: theme.palette.text.disabled, fontStyle: 'italic' }}
                      >
                        {invitation.status === 'pending' ? 'Awaiting approval' : 'No action needed'}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Confirmation Dialog ──────────────────────────────────── */}
      <ConfirmDialog
        {...dialogProps}
        title={confirmAction === 'accept' ? 'Accept Invitation?' : 'Decline Invitation?'}
        message={
          confirmAction === 'accept'
            ? 'You will be added as a member of this organization. This action cannot be undone from here.'
            : 'You will decline this invitation. You can ask for another invitation later if you change your mind.'
        }
        confirmLabel={confirmAction === 'accept' ? 'Accept & Join' : 'Decline'}
        confirmColor={confirmAction === 'accept' ? 'success' : 'error'}
        loading={actionLoading !== null}
        onConfirm={() => {
          if (!pendingInvitation) return;
          if (confirmAction === 'accept') {
            handleAccept(pendingInvitation);
          } else {
            handleDecline(pendingInvitation);
          }
        }}
      />
    </Box>
  );
};
