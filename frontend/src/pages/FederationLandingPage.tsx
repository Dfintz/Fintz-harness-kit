/**
 * Federation Landing Page
 *
 * Entry point for Alliance Management from the sidebar.
 * - If the user's org belongs to exactly one federation → redirect to its manage page.
 * - If the user's org belongs to multiple → show a picker.
 * - If the user's org has no federations → show CTA to browse/create one.
 */
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import {
  useAcceptFederationInvitation,
  useDeclineFederationInvitation,
} from '@/hooks/queries/useFederationManagementQueries';
import {
  federationManagementService,
  type ManagedFederation,
} from '@/services/federationManagementService';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import { slugify } from '@/utils/slugify';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import GroupsIcon from '@mui/icons-material/Groups';
import HandshakeIcon from '@mui/icons-material/Handshake';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const FederationLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const user = useAuthStore(state => state.user);

  const [federations, setFederations] = useState<ManagedFederation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const acceptInvitation = useAcceptFederationInvitation();
  const declineInvitation = useDeclineFederationInvitation();

  const fetchFederations = useCallback(async () => {
    if (!user?.activeOrgId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await federationManagementService.getMyFederations();
      setFederations(result);

      // Auto-redirect only if exactly one federation and none pending
      const active = result.filter(f => {
        const myMember = f.members?.find(m => m.organizationId === user.activeOrgId);
        return myMember?.status !== 'pending';
      });
      const pending = result.filter(f => {
        const myMember = f.members?.find(m => m.organizationId === user.activeOrgId);
        return myMember?.status === 'pending';
      });

      if (active.length === 1 && pending.length === 0) {
        navigate(`/directories/federations/${slugify(active[0].name)}/manage`, { replace: true });
        return;
      }
    } catch (err) {
      logger.error(
        'Failed to load federations',
        err instanceof Error ? err : new Error(String(err))
      );
      setError('Failed to load your alliances.');
    } finally {
      setLoading(false);
    }
  }, [user?.activeOrgId, navigate]);

  useEffect(() => {
    fetchFederations();
  }, [fetchFederations]);

  const handleAccept = async (federationId: string) => {
    try {
      await acceptInvitation.mutateAsync(federationId);
      setError(null);
      await fetchFederations();
    } catch (err) {
      logger.error(
        'Failed to accept invitation',
        err instanceof Error ? err : new Error(String(err))
      );
      setError('Failed to accept invitation. Please try again.');
    }
  };

  const handleDecline = async (federationId: string, memberId: string) => {
    try {
      await declineInvitation.mutateAsync({ federationId, memberId });
      setError(null);
      await fetchFederations();
    } catch (err) {
      logger.error(
        'Failed to decline invitation',
        err instanceof Error ? err : new Error(String(err))
      );
      setError('Failed to decline invitation. Please try again.');
    }
  };

  // Separate pending invitations from active memberships
  const pendingInvitations = federations.filter(f => {
    const myMember = f.members?.find(m => m.organizationId === user?.activeOrgId);
    return myMember?.status === 'pending';
  });
  const activeFederations = federations.filter(f => {
    const myMember = f.members?.find(m => m.organizationId === user?.activeOrgId);
    return myMember?.status !== 'pending';
  });

  if (!user?.activeOrgId) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, px: 2 }}>
        <Alert severity="info">
          You must be a member of an organization to access alliance management.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, px: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  // No federations — show CTA (but still show pending invitations if any)
  if (federations.length === 0) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 6, px: 2, textAlign: 'center' }}>
        <HandshakeIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h5" sx={{ mb: 1 }}>
          No Alliance Memberships
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
          Your organization is not a member of any alliance yet. Browse the directory to find one or
          create your own.
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="contained"
            href="https://fringecore.space/directories?tab=alliances"
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon />}
          >
            Browse Alliances
          </Button>
        </Stack>
      </Box>
    );
  }

  // Multiple federations — show picker with pending section
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, color: 'text.primary' }}>
        Alliance Management
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Your organization belongs to {activeFederations.length} alliance
        {activeFederations.length === 1 ? '' : 's'}
        {pendingInvitations.length > 0 &&
          ` and has ${pendingInvitations.length} pending invitation${pendingInvitations.length === 1 ? '' : 's'}`}
        .
      </Typography>

      {/* Pending Invitations Section */}
      {pendingInvitations.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <MailOutlineIcon sx={{ color: 'warning.main' }} />
            <Typography variant="h6" sx={{ color: 'text.primary' }}>
              Pending Invitations
            </Typography>
          </Stack>
          <Stack spacing={2}>
            {pendingInvitations.map(fed => {
              const myMember = fed.members?.find(
                m => m.organizationId === user?.activeOrgId
              );
              return (
                <Card
                  key={fed.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'warning.main',
                    bgcolor: alpha(theme.palette.warning.main, 0.04),
                  }}
                >
                  <CardContent>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <HandshakeIcon sx={{ color: 'warning.main', fontSize: 32 }} />
                        <Box>
                          <Typography variant="h6">{fed.name}</Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {fed.description || 'No description'}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip
                          icon={<GroupsIcon sx={{ fontSize: 16 }} />}
                          label={`${fed.members?.length ?? 0} members`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label="Pending"
                          size="small"
                          color="warning"
                        />
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          startIcon={<CheckCircleOutlineIcon />}
                          onClick={() => handleAccept(fed.id)}
                          disabled={acceptInvitation.isPending}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={<HighlightOffIcon />}
                          onClick={() => handleDecline(fed.id, myMember?.id ?? '')}
                          disabled={declineInvitation.isPending}
                        >
                          Decline
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Active Federations */}
      {activeFederations.length > 0 && (
        <Stack spacing={2}>
          {activeFederations.map(fed => (
            <Card
              key={fed.id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                '&:hover': {
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                },
              }}
            >
              <CardActionArea
                onClick={() => navigate(`/directories/federations/${slugify(fed.name)}/manage`)}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <HandshakeIcon sx={{ color: 'primary.main', fontSize: 32 }} />
                      <Box>
                        <Typography variant="h6">{fed.name}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {fed.description || 'No description'}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip
                        icon={<GroupsIcon sx={{ fontSize: 16 }} />}
                        label={`${fed.members?.length ?? 0} members`}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={fed.status}
                        size="small"
                        color={fed.status === 'active' ? 'success' : 'default'}
                        sx={{ textTransform: 'capitalize' }}
                      />
                      <OpenInNewIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
                    </Stack>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export const FederationLandingPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Alliance Management">
    <FederationLandingPage />
  </FeatureErrorBoundary>
);
