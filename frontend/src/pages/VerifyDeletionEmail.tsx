/**
 * Email Verification Page for Organization Deletion
 *
 * Handles email confirmation for organization deletion requests.
 */

import { organizationDeletionService } from '@/services/organizationDeletionService';
import { logger } from '@/utils/logger';
import {
  CheckCircle as CheckmarkCircle,
  Cancel as CloseCircle,
  ErrorOutline,
} from '@mui/icons-material';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
export const VerifyDeletionEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Invalid verification link. No token provided.');
      setLoading(false);
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token: string) => {
    try {
      const result = await organizationDeletionService.verifyEmailConfirmation(token);
      setSuccess(true);
      setOrganizationId(result.organizationId);
      setError(null);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('Email verification failed:', err, new Error('Email verification failed'));
      setSuccess(false);
      setError(
        (err as any)?.response?.data?.error ||
          (err as any)?.response?.data?.message ||
          errMsg ||
          'Failed to verify email. The link may have expired or already been used.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Stack
          direction="column"
          alignItems="center"
          justifyContent="center"
          sx={{ minHeight: 400, gap: 3 }}
        >
          <CircularProgress aria-label="Verifying email..." size={60} />
          <Typography variant="h2">Verifying Your Email...</Typography>
          <Typography>Please wait while we confirm your deletion request.</Typography>
        </Stack>
      </Box>
    );
  }

  if (success && organizationId) {
    return (
      <Box sx={{ p: 4 }}>
        <Stack
          direction="column"
          alignItems="center"
          justifyContent="center"
          sx={{ minHeight: 400, gap: 3 }}
        >
          <CheckmarkCircle sx={{ color: 'success.main', fontSize: 48 }} />
          <Typography variant="h1">Email Verified Successfully!</Typography>

          <Box sx={{ borderRadius: 1, p: 2, maxWidth: 600, width: '100%' }}>
            <Stack direction="column" sx={{ gap: 2 }} alignItems="center">
              <Typography variant="h3">What Happens Next?</Typography>
              <Typography sx={{ textAlign: 'center' }}>
                Your organization deletion request has been submitted for admin approval.
              </Typography>

              <Box sx={{ mt: 2 }}>
                <Stack direction="column" sx={{ gap: 1 }}>
                  <Typography>✓ Email verified</Typography>
                  <Typography>⏳ Waiting for admin approval</Typography>
                  <Typography>• You will be notified when the request is reviewed</Typography>
                  <Typography>• If approved, a 30-day grace period will begin</Typography>
                  <Typography>• You can cancel anytime during the grace period</Typography>
                </Stack>
              </Box>
            </Stack>
          </Box>

          <Stack direction="row" sx={{ gap: 2, mt: 3 }}>
            <Button
              variant="contained"
              onClick={() => navigate(`/organizations/${organizationId}/deletion-status`)}
            >
              View Deletion Status
            </Button>
            <Button variant="outlined" onClick={() => navigate(`/organizations/${organizationId}`)}>
              Go to Organization
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack
        direction="column"
        alignItems="center"
        justifyContent="center"
        sx={{ minHeight: 400, gap: 3 }}
      >
        <CloseCircle sx={{ color: 'error.main', fontSize: 48 }} />
        <Typography variant="h1">Verification Failed</Typography>

        <Box
          sx={{ borderRadius: 1, p: 2, maxWidth: 600, width: '100%', borderColor: 'error.main' }}
        >
          <Stack direction="row" sx={{ gap: 2 }} alignItems="flex-start">
            <ErrorOutline sx={{ color: 'error.main', flexShrink: 0 }} />
            <Stack direction="column" sx={{ gap: 1 }}>
              <Typography variant="h3">Unable to Verify Email</Typography>
              <Typography>{error}</Typography>

              <Box sx={{ mt: 2 }}>
                <Typography>
                  <strong>Common reasons:</strong>
                </Typography>
                <Stack direction="column" sx={{ gap: 1, mt: 1 }}>
                  <Typography>
                    • The verification link has expired (links expire after 24 hours)
                  </Typography>
                  <Typography>• The link has already been used</Typography>
                  <Typography>• The deletion request has been cancelled</Typography>
                  <Typography>• The link is malformed or incomplete</Typography>
                </Stack>
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography>
                  <strong>What you can do:</strong>
                </Typography>
                <Stack direction="column" sx={{ gap: 1, mt: 1 }}>
                  <Typography>
                    • Request a new verification email from your organization settings
                  </Typography>
                  <Typography>• Contact support if you continue to have issues</Typography>
                  <Typography>• Ensure you're using the complete link from the email</Typography>
                </Stack>
              </Box>
            </Stack>
          </Stack>
        </Box>

        <Stack direction="row" sx={{ gap: 2, mt: 3 }}>
          <Button variant="outlined" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
          <Button variant="outlined" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
