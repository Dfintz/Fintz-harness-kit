import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { useActivityByToken, useJoinByToken } from '@/hooks/queries/useActivityQueries';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import GroupIcon from '@mui/icons-material/Group';
import LoginIcon from '@mui/icons-material/Login';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Divider,
    Stack,
    Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const JoinActivityPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const notification = useNotification();
  const [joined, setJoined] = useState(false);

  const { data: activity, isLoading, error } = useActivityByToken(token);
  const joinMutation = useJoinByToken();

  const handleJoin = async () => {
    if (!token) return;

    try {
      const result = await joinMutation.mutateAsync({ token });
      setJoined(true);
      notification.success('Successfully joined! Redirecting to activity...');
      // Navigate to the activity detail after a brief delay
      setTimeout(() => {
        navigate(`/activities/${result.id}`);
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join activity';
      notification.error(message);
      logger.error(
        'Failed to join activity via token',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleLogin = () => {
    // Redirect to login with a return URL back to this join page
    const returnUrl = encodeURIComponent(`/j/${token}`);
    navigate(`/login?returnUrl=${returnUrl}`);
  };

  if (isLoading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          Loading activity details...
        </Typography>
      </Container>
    );
  }

  if (error || !activity) {
    const isExpired = error?.message?.includes('expired');
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h5" gutterBottom>
              {isExpired ? 'Link Expired' : 'Invalid Link'}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {isExpired
                ? 'This join link has expired. Please ask the activity organizer for a new link.'
                : 'This join link is invalid or the activity no longer exists.'}
            </Typography>
            <Button variant="contained" onClick={() => navigate('/')}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const startDate = activity.startDate
    ? new Date(activity.startDate).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const startTime = activity.startDate
    ? new Date(activity.startDate).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
      <Card elevation={3}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            You&apos;re Invited!
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            You&apos;ve been invited to join an activity
          </Typography>

          <Divider sx={{ mb: 3 }} />

          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <RocketLaunchIcon color="primary" />
              <Typography variant="h6">{activity.title}</Typography>
            </Stack>

            {activity.type && (
              <Chip
                label={activity.type}
                color="primary"
                variant="outlined"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              />
            )}

            {activity.description && (
              <Typography color="text.secondary">{activity.description}</Typography>
            )}

            {startDate && (
              <Stack direction="row" spacing={1} alignItems="center">
                <EventIcon fontSize="small" color="action" />
                <Typography variant="body2">{startDate}</Typography>
              </Stack>
            )}

            {startTime && (
              <Stack direction="row" spacing={1} alignItems="center">
                <AccessTimeIcon fontSize="small" color="action" />
                <Typography variant="body2">{startTime}</Typography>
              </Stack>
            )}

            {(activity.maxParticipants || activity.currentParticipants !== undefined) && (
              <Stack direction="row" spacing={1} alignItems="center">
                <GroupIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  {activity.currentParticipants ?? 0}
                  {activity.maxParticipants ? ` / ${activity.maxParticipants}` : ''} participants
                </Typography>
              </Stack>
            )}
          </Stack>

          <Divider sx={{ my: 3 }} />

          {!joined && (
            <Box>
              {isAuthenticated ? (
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  startIcon={<RocketLaunchIcon />}
                  onClick={handleJoin}
                  disabled={joinMutation.isPending}
                >
                  {joinMutation.isPending ? 'Joining...' : 'Join Activity'}
                </Button>
              ) : (
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    Sign in to join this activity
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={<LoginIcon />}
                    onClick={handleLogin}
                  >
                    Sign In to Join
                  </Button>
                </Stack>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};

export const JoinActivityPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Join Activity"
    fallbackMessage="Unable to load the join activity page. Please try again later."
    showHomeButton={true}
  >
    <JoinActivityPage />
  </FeatureErrorBoundary>
);
