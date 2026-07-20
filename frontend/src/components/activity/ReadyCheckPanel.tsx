import {
    useCancelReadyCheck,
    useInitiateReadyCheck,
    useReadyCheck,
    useRespondToReadyCheck,
} from '@/hooks/queries';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import {
    Cancel as CancelIcon,
    CheckCircle as CheckIcon,
    RemoveCircle as NotReadyIcon,
    HowToReg as ReadyIcon,
    Timer as TimerIcon,
} from '@mui/icons-material';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Collapse,
    LinearProgress,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Paper,
    Stack,
    Tooltip,
    Typography,
    useTheme,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReadyCheckPanelProps {
  readonly activityId: string;
  readonly isLeader?: boolean;
}

interface ParticipantResponseEntry {
  userId: string;
  userName: string;
  response: string;
  respondedAt?: string;
}

// ---------------------------------------------------------------------------
// Helpers (extracted to reduce cognitive complexity)
// ---------------------------------------------------------------------------

function getTimerColor(timeLeft: number): 'error' | 'warning' | 'default' {
  if (timeLeft <= 10) return 'error';
  if (timeLeft <= 30) return 'warning';
  return 'default';
}

function normalizeResponses(raw: unknown): ParticipantResponseEntry[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return Object.values(raw);
  return [];
}

function countByResponse(responses: ParticipantResponseEntry[], value: string): number {
  return responses.filter(r => r.response === value).length;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const ResponseStatusIcon: React.FC<Readonly<{ response: string }>> = ({ response }) => {
  if (response === 'ready') return <CheckIcon fontSize="small" color="success" />;
  if (response === 'not_ready') return <CancelIcon fontSize="small" color="error" />;
  return <CircularProgress size={16} />;
};

const ParticipantRow: React.FC<Readonly<{ entry: ParticipantResponseEntry }>> = ({ entry }) => (
  <ListItem key={entry.userId} disableGutters sx={{ py: 0.25 }}>
    <ListItemAvatar sx={{ minWidth: 36 }}>
      <Avatar sx={{ width: 24, height: 24, fontSize: 14 }}>
        {entry.userName.charAt(0).toUpperCase()}
      </Avatar>
    </ListItemAvatar>
    <ListItemText primary={entry.userName} slotProps={{ primary: { variant: 'body2' } }} />
    <Tooltip title={entry.response === 'pending' ? 'Waiting...' : entry.response}>
      <Box component="span" sx={{ display: 'inline-flex' }}>
        <ResponseStatusIcon response={entry.response} />
      </Box>
    </Tooltip>
  </ListItem>
);

// ---------------------------------------------------------------------------
// Result sub-component (completed/expired/cancelled)
// ---------------------------------------------------------------------------

interface ReadyCheckResultProps {
  readonly readyCheck: { readyCount?: number; totalParticipants?: number; status?: string };
  readonly isLeader?: boolean;
  readonly onInitiate: () => void;
  readonly isPending: boolean;
}

const ReadyCheckResult: React.FC<ReadyCheckResultProps> = ({
  readyCheck,
  isLeader,
  onInitiate,
  isPending,
}) => {
  const theme = useTheme();
  const allReady = readyCheck.readyCount === readyCheck.totalParticipants;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderColor: allReady ? theme.palette.success.main : theme.palette.warning.main,
      }}
    >
      <Alert
        severity={allReady ? 'success' : 'warning'}
        icon={allReady ? <CheckIcon /> : <NotReadyIcon />}
        sx={{ mb: 1 }}
      >
        Ready check {readyCheck.status} —{' '}
        {allReady
          ? 'All participants ready!'
          : `${readyCheck.readyCount}/${readyCheck.totalParticipants} ready`}
      </Alert>
      {isLeader && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<ReadyIcon />}
          onClick={onInitiate}
          disabled={isPending}
        >
          New Ready Check
        </Button>
      )}
    </Paper>
  );
};

// ---------------------------------------------------------------------------
// Active ready check sub-component
// ---------------------------------------------------------------------------

interface ActiveReadyCheckProps {
  readonly readyCheck: {
    responses?: unknown;
    totalParticipants?: number;
  };
  readonly timeLeft: number;
  readonly isLeader?: boolean;
  readonly hasResponded: boolean;
  readonly myResponse?: { response: string };
  readonly onRespond: (response: 'ready' | 'not_ready') => void;
  readonly onCancel: () => void;
  readonly isResponding: boolean;
  readonly isCancelling: boolean;
}

const ActiveReadyCheck: React.FC<ActiveReadyCheckProps> = ({
  readyCheck,
  timeLeft,
  isLeader,
  hasResponded,
  myResponse,
  onRespond,
  onCancel,
  isResponding,
  isCancelling,
}) => {
  const theme = useTheme();

  const responses = normalizeResponses(readyCheck.responses);
  const readyCount = countByResponse(responses, 'ready');
  const notReadyCount = countByResponse(responses, 'not_ready');
  const pendingCount = countByResponse(responses, 'pending');
  const total = readyCheck.totalParticipants || responses.length;
  const progressPercent = total > 0 ? ((total - pendingCount) / total) * 100 : 0;

  return (
    <Paper variant="outlined" sx={{ p: 2, borderColor: theme.palette.info.main, borderWidth: 2 }}>
      {/* Header with timer */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ReadyIcon color="info" />
          <Typography variant="subtitle1" fontWeight="bold">
            Ready Check
          </Typography>
        </Stack>
        <Chip
          icon={<TimerIcon />}
          label={`${timeLeft}s`}
          color={getTimerColor(timeLeft)}
          size="small"
        />
      </Stack>

      {/* Progress */}
      <Box sx={{ mb: 2 }}>
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          color={notReadyCount > 0 ? 'warning' : 'success'}
          sx={{ height: 8, borderRadius: 4, mb: 0.5 }}
        />
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">
            {total - pendingCount}/{total} responded
          </Typography>
          <Stack direction="row" spacing={1}>
            <Typography variant="caption" sx={{ color: theme.palette.success.main }}>
              {readyCount} ready
            </Typography>
            {notReadyCount > 0 && (
              <Typography variant="caption" sx={{ color: theme.palette.error.main }}>
                {notReadyCount} not ready
              </Typography>
            )}
          </Stack>
        </Stack>
      </Box>

      {/* Response buttons — large touch targets for mobile */}
      <Collapse in={!hasResponded && !!myResponse}>
        <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckIcon />}
            onClick={() => onRespond('ready')}
            disabled={isResponding}
            fullWidth
            sx={{ py: 1.5, fontSize: '1rem' }}
          >
            Ready
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<CancelIcon />}
            onClick={() => onRespond('not_ready')}
            disabled={isResponding}
            fullWidth
            sx={{ py: 1.5, fontSize: '1rem' }}
          >
            Not Ready
          </Button>
        </Stack>
      </Collapse>

      {/* Already responded */}
      {hasResponded && (
        <Alert severity={myResponse?.response === 'ready' ? 'success' : 'warning'} sx={{ mb: 2 }}>
          You responded: {myResponse?.response === 'ready' ? 'Ready' : 'Not Ready'}
        </Alert>
      )}

      {/* Participant list — grouped by status for leaders, flat for members */}
      {isLeader ? (
        <Box>
          {pendingCount > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ pl: 0.5 }}>
                AWAITING ({pendingCount})
              </Typography>
              <List dense disablePadding>
                {responses.filter(r => r.response === 'pending').map(r => (
                  <ParticipantRow key={r.userId} entry={r} />
                ))}
              </List>
            </Box>
          )}
          {notReadyCount > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" fontWeight="bold" color="error.main" sx={{ pl: 0.5 }}>
                NOT READY ({notReadyCount})
              </Typography>
              <List dense disablePadding>
                {responses.filter(r => r.response === 'not_ready').map(r => (
                  <ParticipantRow key={r.userId} entry={r} />
                ))}
              </List>
            </Box>
          )}
          {readyCount > 0 && (
            <Box>
              <Typography variant="caption" fontWeight="bold" color="success.main" sx={{ pl: 0.5 }}>
                READY ({readyCount})
              </Typography>
              <List dense disablePadding>
                {responses.filter(r => r.response === 'ready').map(r => (
                  <ParticipantRow key={r.userId} entry={r} />
                ))}
              </List>
            </Box>
          )}
        </Box>
      ) : (
        <List dense disablePadding>
          {responses.map(r => (
            <ParticipantRow key={r.userId} entry={r} />
          ))}
        </List>
      )}

      {/* Cancel button for leaders */}
      {isLeader && (
        <Box sx={{ mt: 1, textAlign: 'right' }}>
          <Button
            size="small"
            color="error"
            startIcon={<CancelIcon />}
            onClick={onCancel}
            disabled={isCancelling}
          >
            Cancel Check
          </Button>
        </Box>
      )}
    </Paper>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * ReadyCheckPanel — Voice-command-ready ready check UI for fleet operations
 *
 * Shows:
 * - Initiate button for leaders
 * - Live countdown timer
 * - Participant response status (ready/not ready/pending)
 * - Progress bar and summary counts
 *
 * Designed for real-time updates via polling (3s interval while active).
 */
export const ReadyCheckPanel: React.FC<ReadyCheckPanelProps> = ({ activityId, isLeader }) => {
  const userId = useAuthStore(state => state.user?.id);

  const { data, isLoading } = useReadyCheck(activityId);
  const initiateReadyCheck = useInitiateReadyCheck();
  const respondToReadyCheck = useRespondToReadyCheck();
  const cancelReadyCheck = useCancelReadyCheck();

  const [timeLeft, setTimeLeft] = useState<number>(0);

  const readyCheck = data?.readyCheck;
  const isActive = data?.active === true;

  // Countdown timer
  useEffect(() => {
    if (!readyCheck?.expiresAt || !isActive) {
      setTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(readyCheck.expiresAt).getTime() - Date.now()) / 1000)
      );
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [readyCheck?.expiresAt, isActive]);

  const myResponse = useMemo(() => {
    if (!readyCheck?.responses || !userId) return undefined;
    return normalizeResponses(readyCheck.responses).find(r => r.userId === userId);
  }, [readyCheck?.responses, userId]);

  const hasResponded = myResponse?.response !== 'pending' && myResponse?.response !== undefined;

  const handleInitiate = useCallback(async () => {
    try {
      await initiateReadyCheck.mutateAsync({ activityId, durationSeconds: 120 });
    } catch (err) {
      logger.error(
        'Failed to initiate ready check',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [activityId, initiateReadyCheck]);

  const handleRespond = useCallback(
    async (response: 'ready' | 'not_ready') => {
      try {
        await respondToReadyCheck.mutateAsync({ activityId, response });
      } catch (err) {
        logger.error(
          'Failed to respond to ready check',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    },
    [activityId, respondToReadyCheck]
  );

  const handleCancel = useCallback(async () => {
    try {
      await cancelReadyCheck.mutateAsync({ activityId });
    } catch (err) {
      logger.error(
        'Failed to cancel ready check',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [activityId, cancelReadyCheck]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  // No active ready check — show initiate button for leaders
  if (!isActive && !readyCheck) {
    if (!isLeader) return null;
    return (
      <Box sx={{ p: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ReadyIcon />}
          onClick={handleInitiate}
          disabled={initiateReadyCheck.isPending}
          fullWidth
        >
          {initiateReadyCheck.isPending ? 'Starting...' : 'Start Ready Check'}
        </Button>
      </Box>
    );
  }

  // Completed/expired/cancelled — show result summary
  if (readyCheck && !isActive) {
    return (
      <ReadyCheckResult
        readyCheck={readyCheck}
        isLeader={isLeader}
        onInitiate={handleInitiate}
        isPending={initiateReadyCheck.isPending}
      />
    );
  }

  if (!readyCheck) return null;

  return (
    <ActiveReadyCheck
      readyCheck={readyCheck}
      timeLeft={timeLeft}
      isLeader={isLeader}
      hasResponded={hasResponded}
      myResponse={myResponse}
      onRespond={handleRespond}
      onCancel={handleCancel}
      isResponding={respondToReadyCheck.isPending}
      isCancelling={cancelReadyCheck.isPending}
    />
  );
};
