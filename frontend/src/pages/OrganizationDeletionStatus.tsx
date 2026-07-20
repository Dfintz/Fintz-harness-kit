/**
 * Organization Deletion Status Page
 *
 * Displays the status of organization deletion requests and allows cancellation
 * during the grace period.
 */

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import {
  OrganizationDeletionRequest,
  organizationDeletionService,
} from '@/services/organizationDeletionService';
import { getStatusChipSx, getStatusColor } from '@/utils/statusStyles';
import { Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import {
  AlertDialog,
  Content,
  DialogTrigger,
  TypographyArea,
} from '@/components/ui/SpectrumCompat';
import { CheckCircle as CheckmarkCircle } from '@mui/icons-material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircle from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
const OrganizationDeletionStatus: React.FC = () => {
  const theme = useTheme();
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<OrganizationDeletionRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);

  useEffect(() => {
    fetchDeletionRequest();

    // Refresh every 30 seconds
    const interval = setInterval(fetchDeletionRequest, 30000);
    return () => clearInterval(interval);
  }, [organizationId]);

  const fetchDeletionRequest = async () => {
    if (!organizationId) return;

    try {
      const data = await organizationDeletionService.getLatestDeletionRequest(organizationId);
      setRequest(data);
      setError(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      if (axiosErr.response?.status === 404 || !axiosErr.response) {
        setRequest(null);
        setError('No deletion request found for this organization');
      } else {
        setError(axiosErr.response?.data?.error || 'Failed to fetch deletion request');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!request) return;

    setCancelling(true);
    try {
      await organizationDeletionService.cancelDeletionRequest(
        request.id,
        cancellationReason || 'User requested cancellation'
      );

      await fetchDeletionRequest();
      setCancellationReason('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to cancel deletion request');
    } finally {
      setCancelling(false);
    }
  };

  const handleResendEmail = async () => {
    if (!request) return;

    setResendingEmail(true);
    setError(null);
    try {
      await organizationDeletionService.resendEmailConfirmation(request.id);
      setError('Verification email sent! Please check your inbox.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to resend verification email');
    } finally {
      setResendingEmail(false);
    }
  };

  const getStatusKey = (status: string): string => {
    switch (status) {
      case 'email_verification_pending':
        return 'pending';
      case 'approved':
      case 'rejected':
      case 'cancelled':
      case 'completed':
      case 'failed':
      case 'pending':
        return status;
      default:
        return 'pending';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckmarkCircle fontSize="large" />;
      case 'rejected':
      case 'failed':
        return <CancelIcon fontSize="large" />;
      case 'cancelled':
        return <CancelIcon fontSize="large" />;
      case 'completed':
        return <DeleteIcon fontSize="large" />;
      default:
        return <AccessTimeIcon fontSize="large" />;
    }
  };

  const calculateDaysRemaining = (scheduledFor?: string): number => {
    if (!scheduledFor) return 0;
    const now = new Date();
    const scheduled = new Date(scheduledFor);
    const diff = scheduled.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const canBeCancelled = (req: OrganizationDeletionRequest): boolean => {
    if (req.status !== 'approved') return false;
    if (!req.scheduledFor) return false;
    const daysRemaining = calculateDaysRemaining(req.scheduledFor);
    return daysRemaining > 0;
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Stack justifyContent="center" alignItems="center" sx={{ minHeight: '400px' }}>
          <CircularProgress aria-label="Loading deletion status" size={60} />
        </Stack>
      </Box>
    );
  }

  if (error && !request) {
    return (
      <Box sx={{ p: 4 }}>
        <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.error.main }}>
          <Stack direction="row" gap={2} alignItems="center">
            <ErrorOutline sx={{ color: theme.palette.error.main }} />
            <Typography>{error}</Typography>
          </Stack>
        </Box>
        <Button variant="secondary" onClick={() => navigate(`/organizations/${organizationId}`)}>
          Back to Organization
        </Button>
      </Box>
    );
  }

  if (!request) {
    return (
      <Box sx={{ p: 4 }}>
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Stack direction="column" gap={2} alignItems="center">
            <CheckmarkCircle sx={{ fontSize: '3rem', color: theme.palette.success.main }} />
            <Typography variant="h3">No Active Deletion Request</Typography>
            <Typography>This organization does not have an active deletion request.</Typography>
          </Stack>
        </Box>
        <Button variant="secondary" onClick={() => navigate(`/organizations/${organizationId}`)}>
          Back to Organization
        </Button>
      </Box>
    );
  }

  const daysRemaining = request.scheduledFor ? calculateDaysRemaining(request.scheduledFor) : 0;
  const canCancel = canBeCancelled(request);

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="column" gap={4} sx={{ maxWidth: '800px' }}>
        {/* Header */}
        <Box>
          <Typography variant="h1">Organization Deletion Status</Typography>
          <Typography sx={{ color: theme.palette.text.secondary }}>
            View the status of your organization deletion request
          </Typography>
        </Box>

        {/* Status Card */}
        <Box
          sx={{
            borderRadius: 1,
            p: 2,
            borderColor: getStatusColor(getStatusKey(request.status), theme),
          }}
        >
          <Stack direction="column" gap={3}>
            {/* Status Badge */}
            <Stack direction="row" gap={2} alignItems="center">
              <Box sx={{ color: getStatusColor(getStatusKey(request.status), theme) }}>
                {getStatusIcon(request.status)}
              </Box>
              <Box>
                <Chip
                  label={request.status.toUpperCase().replaceAll('_', ' ')}
                  sx={getStatusChipSx(getStatusKey(request.status), theme)}
                  size="small"
                />
              </Box>
            </Stack>

            {/* Organization Info */}
            <Box>
              <Typography variant="h3">
                {request.deletionPreview?.organizationName || request.organizationId}
              </Typography>
              <Typography sx={{ color: theme.palette.text.secondary }}>
                Organization ID: {request.organizationId}
              </Typography>
            </Box>

            <Divider />

            {/* Request Details */}
            <Stack direction="column" gap={1.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography>
                  <strong>Requested:</strong>
                </Typography>
                <Typography>{formatDate(request.requestedAt)}</Typography>
              </Stack>

              {request.status === 'email_verification_pending' && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography>
                    <strong>Email Verified:</strong>
                  </Typography>
                  <Typography sx={{ color: theme.palette.warning.main }}>
                    Pending verification
                  </Typography>
                </Stack>
              )}

              {request.emailVerifiedAt && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography>
                    <strong>Email Verified:</strong>
                  </Typography>
                  <Typography>{formatDate(request.emailVerifiedAt)}</Typography>
                </Stack>
              )}

              {request.approvedAt && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography>
                    <strong>Approved:</strong>
                  </Typography>
                  <Typography>{formatDate(request.approvedAt)}</Typography>
                </Stack>
              )}

              {request.scheduledFor && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography>
                    <strong>Scheduled For:</strong>
                  </Typography>
                  <Typography>{formatDate(request.scheduledFor)}</Typography>
                </Stack>
              )}

              {request.rejectedAt && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography>
                    <strong>Rejected:</strong>
                  </Typography>
                  <Typography>{formatDate(request.rejectedAt)}</Typography>
                </Stack>
              )}

              {request.cancelledAt && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography>
                    <strong>Cancelled:</strong>
                  </Typography>
                  <Typography>{formatDate(request.cancelledAt)}</Typography>
                </Stack>
              )}

              {request.completedAt && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography>
                    <strong>Completed:</strong>
                  </Typography>
                  <Typography>{formatDate(request.completedAt)}</Typography>
                </Stack>
              )}

              <Stack direction="row" justifyContent="space-between">
                <Typography>
                  <strong>Grace Period:</strong>
                </Typography>
                <Typography>{request.gracePeriodDays} days</Typography>
              </Stack>
            </Stack>

            {/* Days Remaining Countdown */}
            {request.status === 'approved' && daysRemaining > 0 && (
              <>
                <Divider />
                <Box
                  sx={{
                    borderRadius: 1,
                    p: 2,
                    backgroundColor:
                      daysRemaining <= 7
                        ? alpha(theme.palette.error.main, 0.1)
                        : alpha(theme.palette.warning.main, 0.1),
                    border: `2px solid ${daysRemaining <= 7 ? theme.palette.error.main : theme.palette.warning.main}`,
                  }}
                >
                  <Stack direction="column" alignItems="center" gap={1}>
                    <AccessTimeIcon
                      sx={{
                        fontSize: '2.5rem',
                        color:
                          daysRemaining <= 7
                            ? theme.palette.error.main
                            : theme.palette.warning.main,
                      }}
                    />
                    <Typography variant="h2" sx={{ margin: 0 }}>
                      {daysRemaining} Days Remaining
                    </Typography>
                    <Typography sx={{ textAlign: 'center' }}>
                      {daysRemaining <= 7
                        ? 'Final warning: Organization will be deleted soon!'
                        : 'You can still cancel this deletion request'}
                    </Typography>
                  </Stack>
                </Box>
              </>
            )}

            {/* Reason */}
            {request.requestReason && (
              <>
                <Divider />
                <Box>
                  <Typography>
                    <strong>Reason:</strong>
                  </Typography>
                  <Typography>{request.requestReason}</Typography>
                </Box>
              </>
            )}

            {/* Rejection Reason */}
            {request.rejectionReason && (
              <>
                <Divider />
                <Box sx={{ backgroundColor: 'error.main', p: 2, borderRadius: 1 }}>
                  <Typography>
                    <strong>Rejection Reason:</strong>
                  </Typography>
                  <Typography>{request.rejectionReason}</Typography>
                </Box>
              </>
            )}

            {/* Cancellation Reason */}
            {request.cancellationReason && (
              <>
                <Divider />
                <Box>
                  <Typography>
                    <strong>Cancellation Reason:</strong>
                  </Typography>
                  <Typography>{request.cancellationReason}</Typography>
                </Box>
              </>
            )}

            {/* Approval Notes */}
            {request.approvalNotes && (
              <>
                <Divider />
                <Box>
                  <Typography>
                    <strong>Admin Notes:</strong>
                  </Typography>
                  <Typography>{request.approvalNotes}</Typography>
                </Box>
              </>
            )}
          </Stack>
        </Box>

        {/* Deletion Impact */}
        {request.deletionPreview && (
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography variant="h3">Deletion Impact</Typography>
            <Divider sx={{ my: 1 }} />
            <Stack direction="column" gap={1}>
              <Typography>
                <strong>Members affected:</strong> {request.deletionPreview.memberCount || 0}
              </Typography>
              <Typography>
                <strong>Ships to be removed:</strong> {request.deletionPreview.shipCount || 0}
              </Typography>
              {(request.deletionPreview.descendantCount ?? 0) > 0 && (
                <Typography sx={{ color: theme.palette.error.main }}>
                  <strong>Sub-organizations affected:</strong>{' '}
                  {request.deletionPreview.descendantCount}
                </Typography>
              )}
              <Typography>
                <strong>Estimated data size:</strong>{' '}
                {request.deletionPreview.estimatedDataSize || 'Unknown'}
              </Typography>
            </Stack>
          </Box>
        )}

        {/* Next Steps */}
        <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.info.main }}>
          <Typography variant="h3">What Happens Next?</Typography>
          <Divider sx={{ my: 1 }} />
          <Stack direction="column" gap={1.5}>
            {request.status === 'email_verification_pending' && (
              <>
                <Typography>⏳ Waiting for email verification</Typography>
                <Typography>• Check your email inbox for the verification link</Typography>
                <Typography>• Click the link to confirm the deletion request</Typography>
                <Typography>
                  • After verification, the request will be submitted for admin approval
                </Typography>
              </>
            )}
            {request.status === 'pending' && request.emailVerifiedAt && (
              <>
                <Typography>✓ Email verified</Typography>
                <Typography>⏳ Waiting for admin approval</Typography>
                <Typography>• An administrator will review your request</Typography>
                <Typography>• You will be notified of their decision</Typography>
              </>
            )}
            {request.status === 'pending' && !request.emailVerifiedAt && (
              <>
                <Typography>✓ Deletion request submitted</Typography>
                <Typography>⏳ Waiting for admin approval</Typography>
                <Typography>• Grace period will begin after approval</Typography>
                <Typography>• Organization will be deleted after grace period</Typography>
              </>
            )}
            {request.status === 'approved' && daysRemaining > 0 && (
              <>
                <Typography>✓ Request approved by admin</Typography>
                <Typography>✓ Grace period active</Typography>
                <Typography>⏳ {daysRemaining} days until permanent deletion</Typography>
                <Typography>• You can cancel the deletion during this time</Typography>
              </>
            )}
            {request.status === 'rejected' && (
              <>
                <Typography>✓ Request reviewed by admin</Typography>
                <Typography>✗ Request was rejected</Typography>
                <Typography>• Your organization will remain active</Typography>
                <Typography>• No data will be deleted</Typography>
              </>
            )}
            {request.status === 'cancelled' && (
              <>
                <Typography>✓ Request was cancelled</Typography>
                <Typography>• Your organization remains active</Typography>
                <Typography>• No data was deleted</Typography>
              </>
            )}
            {request.status === 'completed' && (
              <>
                <Typography>✓ Organization has been deleted</Typography>
                <Typography>• All data has been archived</Typography>
                <Typography>• Members have been notified</Typography>
              </>
            )}
          </Stack>
        </Box>

        {/* Error/Info Display */}
        {error && (
          <Box
            sx={{
              borderRadius: 1,
              p: 2,
              borderColor: error.includes('sent')
                ? theme.palette.success.main
                : theme.palette.error.main,
            }}
          >
            <Stack direction="row" gap={2} alignItems="center">
              {error.includes('sent') ? (
                <CheckCircle sx={{ color: theme.palette.success.main }} />
              ) : (
                <ErrorOutline sx={{ color: theme.palette.error.main }} />
              )}
              <Typography>{error}</Typography>
            </Stack>
          </Box>
        )}

        {/* Email Verification Reminder */}
        {request.status === 'email_verification_pending' && !request.emailVerifiedAt && (
          <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.warning.main }}>
            <Stack direction="column" gap={2}>
              <Stack direction="row" gap={2} alignItems="center">
                <AccessTimeIcon sx={{ color: theme.palette.warning.main, fontSize: '2rem' }} />
                <Box>
                  <Typography variant="h4">Email Verification Required</Typography>
                  <Typography>
                    Please check your email and click the verification link to proceed.
                  </Typography>
                </Box>
              </Stack>
              <Button variant="secondary" onClick={handleResendEmail} disabled={resendingEmail}>
                {resendingEmail ? 'Sending...' : 'Resend Verification Email'}
              </Button>
            </Stack>
          </Box>
        )}

        {/* Action Buttons */}
        <Stack direction="row" gap={2} justifyContent="space-between">
          <Button variant="secondary" onClick={() => navigate(`/organizations/${organizationId}`)}>
            Back to Organization
          </Button>

          {canCancel && (
            <DialogTrigger>
              <Button variant="danger">
                <CancelIcon />
                <Typography>Cancel Deletion</Typography>
              </Button>
              <AlertDialog
                title="Cancel Deletion Request"
                variant="confirmation"
                primaryActionLabel="Cancel Deletion Request"
                secondaryActionLabel="Keep Deletion Active"
                onPrimaryAction={() => {
                  handleCancel();
                }}
                isPrimaryActionDisabled={cancelling}
              >
                <Content>
                  <Stack direction="column" gap={2}>
                    <Typography>
                      Are you sure you want to cancel the deletion request for{' '}
                      <strong>{request.deletionPreview?.organizationName}</strong>?
                    </Typography>
                    <Typography>
                      Your organization will remain active and no data will be deleted.
                    </Typography>
                    <TypographyArea
                      label="Cancellation Reason (optional)"
                      value={cancellationReason}
                      onChange={setCancellationReason}
                      placeholder="Why are you cancelling the deletion?"
                    />
                  </Stack>
                </Content>
              </AlertDialog>
            </DialogTrigger>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

export const OrganizationDeletionStatusWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Organization Deletion Status"
    fallbackMessage="Unable to load deletion status. Please try again later."
    showHomeButton={true}
  >
    <OrganizationDeletionStatus />
  </FeatureErrorBoundary>
);
