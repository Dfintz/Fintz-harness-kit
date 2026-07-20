import {
    useAcknowledgeCommand,
    useIssueCommand,
    useOperationCommands,
    usePreflightCheck,
} from '@/hooks/queries';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import {
    Check as AckIcon,
    Campaign as CommandIcon,
    Warning as CriticalIcon,
    KeyboardArrowDown as ExpandIcon,
    FlightTakeoff as PreflightIcon,
    Send as SendIcon,
    NotificationsActive as UrgentIcon,
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Collapse,
    FormControl,
    IconButton,
    InputLabel,
    LinearProgress,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Paper,
    Select,
    type SelectChangeEvent,
    Stack,
    TextField,
    Typography,
    useTheme,
} from '@mui/material';
import React, { useCallback, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandFeedPanelProps {
  readonly activityId: string;
  readonly isCommander?: boolean;
}

interface CommandEntry {
  id: string;
  type: string;
  priority: string;
  message: string;
  issuedByName: string;
  issuedAt: string;
  status: string;
  totalRecipients: number;
  acknowledgedCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPriorityColor(priority: string): 'default' | 'warning' | 'error' {
  if (priority === 'critical') return 'error';
  if (priority === 'urgent') return 'warning';
  return 'default';
}

function getPriorityBorderColor(priority: string, theme: { palette: { error: { main: string }; warning: { main: string }; info: { main: string } } }): string {
  if (priority === 'critical') return theme.palette.error.main;
  if (priority === 'urgent') return theme.palette.warning.main;
  return theme.palette.info.main;
}

function getPriorityIcon(priority: string): React.ReactNode {
  if (priority === 'critical') return <CriticalIcon fontSize="small" />;
  if (priority === 'urgent') return <UrgentIcon fontSize="small" />;
  return <CommandIcon fontSize="small" />;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const CommandItem: React.FC<
  Readonly<{
    command: CommandEntry;
    activityId: string;
    userId?: string;
  }>
> = ({ command, activityId, userId }) => {
  const theme = useTheme();
  const acknowledgeCommand = useAcknowledgeCommand();
  const [expanded, setExpanded] = useState(false);

  const progress =
    command.totalRecipients > 0 ? (command.acknowledgedCount / command.totalRecipients) * 100 : 0;

  const handleAck = useCallback(async () => {
    if (!userId) return;
    try {
      await acknowledgeCommand.mutateAsync({
        activityId,
        commandId: command.id,
      });
    } catch (err) {
      logger.error(
        'Failed to acknowledge command',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [activityId, command.id, userId, acknowledgeCommand]);

  return (
    <ListItem
      disableGutters
      sx={{
        flexDirection: 'column',
        alignItems: 'stretch',
        borderLeft: `3px solid ${getPriorityBorderColor(command.priority, theme)}`,
        pl: 1.5,
        mb: 1,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <ListItemIcon sx={{ minWidth: 32 }}>{getPriorityIcon(command.priority)}</ListItemIcon>
        <ListItemText
          primary={command.message}
          secondary={`${command.issuedByName} · ${formatTime(command.issuedAt)}`}
          slotProps={{
            primary: { variant: 'body2', fontWeight: 600 },
            secondary: { variant: 'caption' },
          }}
        />
        <Chip
          label={command.type.replaceAll('_', ' ')}
          size="small"
          color={getPriorityColor(command.priority)}
          variant="outlined"
          sx={{ display: { xs: 'none', sm: 'flex' } }}
        />
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          <ExpandIcon
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          />
        </IconButton>
      </Stack>

      <Collapse in={expanded}>
        <Box sx={{ mt: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            color={command.status === 'acknowledged' ? 'success' : 'info'}
            sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
          />
          <Typography variant="caption" color="text.secondary">
            {command.acknowledgedCount}/{command.totalRecipients} acknowledged
          </Typography>
          {command.status !== 'acknowledged' && userId && (
            <Button
              size="small"
              variant="contained"
              startIcon={<AckIcon />}
              onClick={handleAck}
              disabled={acknowledgeCommand.isPending}
              sx={{ mt: 1 }}
            >
              Acknowledge
            </Button>
          )}
        </Box>
      </Collapse>
    </ListItem>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * CommandFeedPanel — Real-time command feed for fleet operations.
 *
 * Shows:
 * - Live command stream from the chain of command
 * - Issue new commands (for commanders)
 * - Acknowledge commands
 * - Pre-flight check shortcut
 *
 * Polls every 5 seconds for new commands.
 */
export const CommandFeedPanel: React.FC<CommandFeedPanelProps> = ({ activityId, isCommander }) => {
  const theme = useTheme();
  const userId = useAuthStore(s => s.user?.id);

  const { data, isLoading } = useOperationCommands(activityId);
  const issueCommand = useIssueCommand();
  const preflightCheck = usePreflightCheck();

  const [showIssue, setShowIssue] = useState(false);
  const [cmdType, setCmdType] = useState('order');
  const [cmdMessage, setCmdMessage] = useState('');
  const [cmdPriority, setCmdPriority] = useState('routine');

  const commands = data?.commands ?? [];

  const handleIssueCommand = useCallback(async () => {
    if (!cmdMessage.trim()) return;
    try {
      await issueCommand.mutateAsync({
        activityId,
        data: {
          type: cmdType,
          priority: cmdPriority,
          message: cmdMessage.trim(),
          targetScope: { type: 'all' },
        },
      });
      setCmdMessage('');
      setShowIssue(false);
    } catch (err) {
      logger.error('Failed to issue command', err instanceof Error ? err : new Error(String(err)));
    }
  }, [activityId, cmdType, cmdMessage, cmdPriority, issueCommand]);

  const handlePreflight = useCallback(async () => {
    try {
      await preflightCheck.mutateAsync({ activityId });
    } catch (err) {
      logger.error(
        'Failed to issue pre-flight check',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [activityId, preflightCheck]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      {/* Header — stacks vertically on mobile */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <CommandIcon color="primary" />
          <Typography variant="subtitle1" fontWeight="bold">
            Operations Commands
          </Typography>
        </Stack>
        {isCommander && (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PreflightIcon />}
              onClick={handlePreflight}
              disabled={preflightCheck.isPending}
              fullWidth
            >
              Pre-Flight
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<SendIcon />}
              onClick={() => setShowIssue(!showIssue)}
              fullWidth
            >
              Issue Order
            </Button>
          </Stack>
        )}
      </Stack>

      {/* Issue Command Form */}
      <Collapse in={showIssue && isCommander}>
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: theme.palette.primary.main }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <FormControl size="small" fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={cmdType}
                  label="Type"
                  onChange={(e: SelectChangeEvent) => setCmdType(e.target.value)}
                >
                  <MenuItem value="order">Order</MenuItem>
                  <MenuItem value="move_to">Move To</MenuItem>
                  <MenuItem value="hold_position">Hold Position</MenuItem>
                  <MenuItem value="engage">Engage</MenuItem>
                  <MenuItem value="disengage">Disengage</MenuItem>
                  <MenuItem value="rally">Rally</MenuItem>
                  <MenuItem value="form_up">Form Up</MenuItem>
                  <MenuItem value="weapons_free">Weapons Free</MenuItem>
                  <MenuItem value="weapons_hold">Weapons Hold</MenuItem>
                  <MenuItem value="refuel">Refuel</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={cmdPriority}
                  label="Priority"
                  onChange={(e: SelectChangeEvent) => setCmdPriority(e.target.value)}
                >
                  <MenuItem value="routine">Routine</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <TextField
              fullWidth
              size="small"
              placeholder="Enter command message..."
              value={cmdMessage}
              onChange={e => setCmdMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleIssueCommand();
              }}
            />
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={handleIssueCommand}
              disabled={issueCommand.isPending || !cmdMessage.trim()}
            >
              {issueCommand.isPending ? 'Sending...' : 'Send Command'}
            </Button>
          </Stack>
        </Paper>
      </Collapse>

      {/* Command Feed */}
      {commands.length === 0 ? (
        <Alert severity="info" variant="outlined">
          No commands issued yet. {isCommander ? 'Use the buttons above to issue orders.' : ''}
        </Alert>
      ) : (
        <List dense disablePadding>
          {commands.map(cmd => (
            <CommandItem key={cmd.id} command={cmd} activityId={activityId} userId={userId} />
          ))}
        </List>
      )}
    </Paper>
  );
};
