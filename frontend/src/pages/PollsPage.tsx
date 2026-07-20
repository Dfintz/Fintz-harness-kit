/**
 * Polls Page
 *
 * Dashboard for creating, voting on, and managing organization polls.
 * Supports single-choice, multiple-choice, ranked, and approval voting.
 * Mirrors the Discord bot `/poll` command set in a web UI.
 *
 * Sprint 26 — Bot vs Web Feature Parity
 */

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useGuildNotificationDestinations,
  type GuildNotificationDestination,
} from '@/hooks/queries/useDiscordNotificationDestinationQueries';
import { useDiscordGuilds } from '@/hooks/queries/useOrgSettingsQueries';
import {
  useCastVote,
  useClosePoll,
  useCreatePoll,
  useDeletePoll,
  useMirrorPollToDiscord,
  usePollResults,
  usePolls,
  type CreatePollInput,
  type Poll,
  type PollFilters,
  type PollResults as PollResultsType,
  type PollStatus,
} from '@/hooks/queries/usePollQueries';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';
import AddIcon from '@mui/icons-material/Add';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import LockIcon from '@mui/icons-material/Lock';
import PollIcon from '@mui/icons-material/Poll';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Pagination,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { useAuthStore, useHasMinOrgRole } from '@/store/authStore';

// ============================================================================
// Status helpers
// ============================================================================

const STATUS_CONFIG: Record<
  PollStatus,
  { label: string; color: 'default' | 'info' | 'success' | 'error' }
> = {
  draft: { label: 'Draft', color: 'default' },
  active: { label: 'Active', color: 'info' },
  closed: { label: 'Closed', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'error' },
};

const POLL_TYPE_LABELS: Record<string, string> = {
  single_choice: 'Single Choice',
  multiple_choice: 'Multiple Choice',
  ranked: 'Ranked',
  approval: 'Approval',
};

const summarizeFailedDestinations = (failedDestinations: string[]): string => {
  return failedDestinations.slice(0, 2).join(', ');
};

const formatDestinationLabel = (
  destination: GuildNotificationDestination,
  guildNameById: Map<string, string>
): string => {
  const guildName = guildNameById.get(destination.guildId) ?? destination.guildId;
  const channelTypeLabel =
    destination.channelType === 'announcement'
      ? 'Announcement Channel'
      : 'Pinned Announcement Channel';
  return `${guildName} - ${channelTypeLabel}`;
};

// ============================================================================
// Helper: Format ISO datetime-local input value
// ============================================================================

function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ============================================================================
// Create Poll Dialog
// ============================================================================

interface CreatePollDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePollInput) => void;
  isSubmitting: boolean;
}

const CreatePollDialog: React.FC<CreatePollDialogProps> = ({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pollType, setPollType] = useState<string>('single_choice');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([
    { id: uuidv4(), label: '' },
    { id: uuidv4(), label: '' },
  ]);
  // Schedule
  const [enableEndDate, setEnableEndDate] = useState(false);
  const [endsAt, setEndsAt] = useState('');
  // Visibility
  const [visibility, setVisibility] = useState<string>('members_only');
  // Max selections (for multiple_choice)
  const [maxSelections, setMaxSelections] = useState(1);

  React.useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setPollType('single_choice');
      setIsAnonymous(false);
      setOptions([
        { id: uuidv4(), label: '' },
        { id: uuidv4(), label: '' },
      ]);
      setEnableEndDate(false);
      setEndsAt('');
      setVisibility('members_only');
      setMaxSelections(1);
    }
  }, [open]);

  const handleAddOption = () => {
    if (options.length >= 50) return;
    setOptions(prev => [...prev, { id: uuidv4(), label: '' }]);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleOptionChange = (idx: number, value: string) => {
    setOptions(prev => prev.map((o, i) => (i === idx ? { ...o, label: value } : o)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter(o => o.label.trim());
    if (!title.trim() || validOptions.length < 2) return;

    const data: CreatePollInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      pollType: pollType as CreatePollInput['pollType'],
      visibility: visibility as CreatePollInput['visibility'],
      options: validOptions.map((o, idx) => ({
        id: o.id,
        label: o.label.trim(),
        sortOrder: idx,
      })),
      isAnonymous,
      status: 'active',
    };

    if (pollType === 'multiple_choice' && maxSelections > 1) {
      data.maxSelections = maxSelections;
    }
    if (enableEndDate && endsAt) {
      data.endsAt = new Date(endsAt).toISOString();
    }

    onSubmit(data);
  };

  const validOptionCount = options.filter(o => o.label.trim()).length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create Poll</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Question / Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              fullWidth
              slotProps={{ htmlInput: { maxLength: 200 } }}
              autoFocus
            />
            <TextField
              label="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Poll Type</InputLabel>
                <Select
                  value={pollType}
                  label="Poll Type"
                  onChange={(e: SelectChangeEvent) => setPollType(e.target.value)}
                >
                  <MenuItem value="single_choice">Single Choice</MenuItem>
                  <MenuItem value="multiple_choice">Multiple Choice</MenuItem>
                  <MenuItem value="ranked">Ranked</MenuItem>
                  <MenuItem value="approval">Approval</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>Visibility</InputLabel>
                <Select
                  value={visibility}
                  label="Visibility"
                  onChange={(e: SelectChangeEvent) => setVisibility(e.target.value)}
                >
                  <MenuItem value="public">Public</MenuItem>
                  <MenuItem value="members_only">Members Only</MenuItem>
                  <MenuItem value="role_restricted">Role Restricted</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            {pollType === 'multiple_choice' && (
              <TextField
                label="Max Selections"
                type="number"
                value={maxSelections}
                onChange={e => setMaxSelections(Math.max(1, Math.min(50, Number(e.target.value))))}
                size="small"
                helperText="How many options can each voter select"
                slotProps={{ htmlInput: { min: 1, max: 50 } }}
              />
            )}

            <FormControlLabel
              labelPlacement="start"
              sx={{ m: 0, justifyContent: 'space-between' }}
              control={
                <Switch checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} />
              }
              label="Anonymous voting"
            />

            {/* End Date */}
            <Divider />
            <FormControlLabel
              labelPlacement="start"
              sx={{ m: 0, justifyContent: 'space-between' }}
              control={
                <Switch
                  checked={enableEndDate}
                  onChange={e => setEnableEndDate(e.target.checked)}
                />
              }
              label="Set end date (auto-close)"
            />

            {enableEndDate && (
              <TextField
                label="Ends at"
                type="datetime-local"
                value={endsAt}
                onChange={e => setEndsAt(e.target.value)}
                fullWidth
                size="small"
                slotProps={{
                  htmlInput: {
                    min: toDatetimeLocalValue(new Date(Date.now() + 5 * 60 * 1000).toISOString()),
                  },
                  inputLabel: { shrink: true },
                }}
                helperText="The poll will automatically close at this time"
              />
            )}

            <Divider />
            <Typography variant="subtitle2">Options ({validOptionCount}/50)</Typography>
            {options.map((option, idx) => (
              <Stack key={option.id} direction="row" spacing={1} alignItems="center">
                <TextField
                  label={`Option ${idx + 1}`}
                  value={option.label}
                  onChange={e => handleOptionChange(idx, e.target.value)}
                  fullWidth
                  size="small"
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                />
                <IconButton
                  size="small"
                  sx={{ flexShrink: 0 }}
                  onClick={() => handleRemoveOption(idx)}
                  disabled={options.length <= 2}
                >
                  <RemoveCircleOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <Button
              size="small"
              startIcon={<AddIcon />}
              sx={{ alignSelf: 'flex-start' }}
              onClick={handleAddOption}
              disabled={options.length >= 50}
            >
              Add Option
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || !title.trim() || validOptionCount < 2}
            startIcon={isSubmitting ? <CircularProgress size={16} /> : undefined}
          >
            Create &amp; Activate
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

// ============================================================================
// Inline Results Display
// ============================================================================

interface InlineResultsProps {
  results: PollResultsType;
  userVotes?: string[];
}

const InlineResults: React.FC<Readonly<InlineResultsProps>> = ({ results, userVotes }) => {
  const theme = useTheme();

  return (
    <Stack spacing={1} sx={{ mt: 1.5 }}>
      {results.options.map(opt => {
        const isUserVote = userVotes?.includes(opt.optionId);
        return (
          <Box key={opt.optionId}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 0.25 }}
            >
              <Stack direction="row" alignItems="center" spacing={0.5}>
                {isUserVote && (
                  <CheckBoxIcon fontSize="small" color="primary" sx={{ fontSize: 16 }} />
                )}
                <Typography
                  variant="body2"
                  fontWeight={isUserVote ? 600 : 400}
                  color={isUserVote ? 'primary' : 'text.primary'}
                >
                  {opt.label}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {opt.voteCount} vote{opt.voteCount === 1 ? '' : 's'} ({Math.round(opt.percentage)}%)
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={opt.percentage}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.palette.action.hover,
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  backgroundColor: isUserVote ? theme.palette.primary.main : undefined,
                },
              }}
            />
          </Box>
        );
      })}
      <Typography variant="caption" color="text.secondary">
        Total: {results.totalVotes} vote{results.totalVotes === 1 ? '' : 's'}
      </Typography>
    </Stack>
  );
};

// ============================================================================
// Poll Card — inline results + voting
// ============================================================================

interface PollCardProps {
  poll: Poll;
  canManage: boolean;
  canPostToDiscord: boolean;
  onClose: (id: string) => void;
  onDelete: (id: string) => void;
  onPostToDiscord: (poll: Poll) => void;
  onVote: (pollId: string, optionIds: string[]) => void;
  isVoting: boolean;
}

const PollCard: React.FC<PollCardProps> = ({
  poll,
  canManage,
  canPostToDiscord,
  onClose,
  onDelete,
  onPostToDiscord,
  onVote,
  isVoting,
}) => {
  const theme = useTheme();
  const statusCfg = STATUS_CONFIG[poll.status] || STATUS_CONFIG.draft;
  const isActive = poll.status === 'active';

  // Fetch results for this poll
  const { data: results } = usePollResults(poll.id, isActive);
  const hasVoted = results?.hasVoted ?? false;
  const userVotes = results?.userVotes;

  // Local voting state
  const [expanded, setExpanded] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [isChangingVote, setIsChangingVote] = useState(false);

  const showVoteForm = isActive && (!hasVoted || isChangingVote);
  const isSingleChoice = poll.pollType === 'single_choice';
  const isMultipleChoice = poll.pollType === 'multiple_choice' || poll.pollType === 'approval';

  // Reveal the running totals once the user has voted (including votes cast on Discord).
  useEffect(() => {
    if (hasVoted) {
      setExpanded(true);
    }
  }, [hasVoted]);

  const handleToggleMultiOption = (optionId: string) => {
    setSelectedOptions(prev => {
      const next = new Set(prev);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        // Enforce maxSelections
        const max = poll.maxSelections || poll.options.length;
        if (next.size < max) {
          next.add(optionId);
        }
      }
      return next;
    });
  };

  const handleSubmitVote = () => {
    if (isSingleChoice && selectedOption) {
      onVote(poll.id, [selectedOption]);
      setIsChangingVote(false);
      setExpanded(true);
    } else if (isMultipleChoice && selectedOptions.size > 0) {
      onVote(poll.id, Array.from(selectedOptions));
      setIsChangingVote(false);
      setExpanded(true);
    }
  };

  const handleChangeVote = () => {
    setIsChangingVote(true);
    setSelectedOption('');
    setSelectedOptions(new Set());
  };

  const canSubmitSingle = isSingleChoice && !!selectedOption;
  const canSubmitMulti = isMultipleChoice && selectedOptions.size > 0;
  const canSubmitVote = canSubmitSingle || canSubmitMulti;

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
            {poll.title}
          </Typography>
          <Chip label={statusCfg.label} size="small" sx={getStatusChipSx(poll.status, theme)} />
          <Chip
            label={POLL_TYPE_LABELS[poll.pollType] || poll.pollType}
            size="small"
            variant="outlined"
          />
          {poll.isAnonymous && (
            <Chip
              icon={<LockIcon fontSize="small" />}
              label="Anon"
              size="small"
              variant="outlined"
            />
          )}
          {hasVoted && <Chip label="Voted" size="small" color="success" variant="outlined" />}
        </Stack>

        {poll.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {poll.description}
          </Typography>
        )}

        {/* Inline Results — always show when data is available */}
        <Accordion
          disableGutters
          elevation={0}
          expanded={expanded}
          onChange={() => setExpanded(!expanded)}
          sx={{
            '&:before': { display: 'none' },
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            mt: 1,
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <PollIcon fontSize="small" color="action" />
              <Typography variant="subtitle2">
                {results ? `Results (${results.totalVotes})` : 'Options'}
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            {/* Results with progress bars */}
            {results && <InlineResults results={results} userVotes={userVotes} />}

            {/* If no results loaded yet, show options as text */}
            {!results && (
              <Stack spacing={0.5}>
                {poll.options.map(opt => (
                  <Typography key={opt.id} variant="body2" color="text.secondary">
                    &bull; {opt.label}
                  </Typography>
                ))}
              </Stack>
            )}

            {/* Inline Vote Form */}
            {showVoteForm && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {isChangingVote ? 'Change your vote' : 'Cast your vote'}
                </Typography>

                {/* Single choice */}
                {isSingleChoice && (
                  <RadioGroup
                    value={selectedOption}
                    onChange={e => setSelectedOption(e.target.value)}
                  >
                    {poll.options.map(opt => (
                      <FormControlLabel
                        key={opt.id}
                        value={opt.id}
                        control={<Radio size="small" />}
                        label={opt.label}
                      />
                    ))}
                  </RadioGroup>
                )}

                {/* Multiple choice / approval */}
                {isMultipleChoice && (
                  <Stack spacing={0.5}>
                    {poll.options.map(opt => (
                      <FormControlLabel
                        key={opt.id}
                        control={
                          <IconButton
                            size="small"
                            onClick={() => handleToggleMultiOption(opt.id)}
                            color={selectedOptions.has(opt.id) ? 'primary' : 'default'}
                          >
                            {selectedOptions.has(opt.id) ? (
                              <CheckBoxIcon fontSize="small" />
                            ) : (
                              <CheckBoxOutlineBlankIcon fontSize="small" />
                            )}
                          </IconButton>
                        }
                        label={opt.label}
                      />
                    ))}
                    {poll.pollType === 'multiple_choice' && (
                      <Typography variant="caption" color="text.secondary">
                        Select up to {poll.maxSelections || poll.options.length} option
                        {(poll.maxSelections || poll.options.length) === 1 ? '' : 's'}
                      </Typography>
                    )}
                  </Stack>
                )}

                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={isVoting || !canSubmitVote}
                    onClick={handleSubmitVote}
                    startIcon={isVoting ? <CircularProgress size={14} /> : <HowToVoteIcon />}
                  >
                    {isChangingVote ? 'Update Vote' : 'Vote'}
                  </Button>
                  {isChangingVote && (
                    <Button size="small" onClick={() => setIsChangingVote(false)}>
                      Cancel
                    </Button>
                  )}
                </Stack>
              </>
            )}

            {/* Change vote button */}
            {isActive && hasVoted && !isChangingVote && (
              <Button
                size="small"
                sx={{ mt: 1.5 }}
                onClick={handleChangeVote}
                startIcon={<HowToVoteIcon />}
              >
                Change Vote
              </Button>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Metadata */}
        <Stack direction="row" spacing={2} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            By {poll.createdByName || 'Unknown'} &middot;{' '}
            {new Date(poll.createdAt).toLocaleDateString()}
          </Typography>
          {poll.endsAt && (
            <Chip
              icon={<ScheduleIcon fontSize="small" />}
              label={`Ends: ${new Date(poll.endsAt).toLocaleString()}`}
              size="small"
              color="info"
              variant="outlined"
            />
          )}
          {poll.closedAt && (
            <Typography variant="caption" color="text.secondary">
              Closed: {new Date(poll.closedAt).toLocaleString()}
            </Typography>
          )}
        </Stack>
      </CardContent>

      {canManage && (
        <CardActions sx={{ px: 2, pb: 1.5 }}>
          {canPostToDiscord && poll.status === 'active' && (
            <Tooltip title="Post in Discord">
              <IconButton size="small" color="primary" onClick={() => onPostToDiscord(poll)}>
                <SmartToyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {poll.status === 'active' && (
            <Tooltip title="Close poll">
              <IconButton size="small" onClick={() => onClose(poll.id)}>
                <CancelIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => onDelete(poll.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </CardActions>
      )}
    </Card>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const PollsPage: React.FC = () => {
  // Filters
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<PollStatus | ''>('');
  const filters: PollFilters = {
    page,
    limit: 10,
    ...(statusFilter ? { status: statusFilter } : {}),
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  // Data
  const { data, isLoading, error } = usePolls(filters);

  // Mutations
  const createMutation = useCreatePoll();
  const deleteMutation = useDeletePoll();
  const closeMutation = useClosePoll();
  const castVoteMutation = useCastVote();
  const mirrorMutation = useMirrorPollToDiscord();

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [postTarget, setPostTarget] = useState<Poll | null>(null);
  const activeOrganizationId = useAuthStore(
    state => state.user?.activeOrgId ?? state.user?.organizationId
  );
  const { data: orgGuilds = [] } = useDiscordGuilds(activeOrganizationId);
  const [selectedPostDestinations, setSelectedPostDestinations] = useState<string[]>([]);
  const [postError, setPostError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState<string | null>(null);
  const { openDialog, closeDialog, pendingData, dialogProps } = useConfirmDialog<string>();
  const {
    destinations: postDestinations,
    failedGuilds: postDestinationFailedGuilds,
    isLoading: loadingPostDestinations,
    truncatedGuildCount,
  } = useGuildNotificationDestinations(activeOrganizationId, postOpen ? orgGuilds : []);

  const guildNameById = React.useMemo(
    () => new Map(orgGuilds.map(guild => [guild.guildId, guild.guildName])),
    [orgGuilds]
  );

  const handleCreateSubmit = useCallback(
    async (input: CreatePollInput) => {
      try {
        await createMutation.mutateAsync(input);
        setCreateOpen(false);
      } catch (err) {
        logger.error('Failed to create poll', err instanceof Error ? err : new Error(String(err)));
      }
    },
    [createMutation]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingData) return;
    try {
      await deleteMutation.mutateAsync(pendingData);
      closeDialog();
    } catch (err) {
      logger.error('Failed to delete poll', err instanceof Error ? err : new Error(String(err)));
    }
  }, [pendingData, deleteMutation, closeDialog]);

  const handleClosePoll = useCallback(
    async (id: string) => {
      try {
        await closeMutation.mutateAsync(id);
      } catch (err) {
        logger.error('Failed to close poll', err instanceof Error ? err : new Error(String(err)));
      }
    },
    [closeMutation]
  );

  const handleVote = useCallback(
    async (pollId: string, optionIds: string[]) => {
      try {
        await castVoteMutation.mutateAsync({
          pollId,
          data: { votes: optionIds.map(id => ({ optionId: id })) },
        });
      } catch (err) {
        logger.error('Failed to cast vote', err instanceof Error ? err : new Error(String(err)));
      }
    },
    [castVoteMutation]
  );

  const handleOpenPostDialog = useCallback((poll: Poll) => {
    setPostError(null);
    setPostSuccess(null);
    setPostTarget(poll);
    setSelectedPostDestinations([]);
    setPostOpen(true);
  }, []);

  const handlePostToDiscord = useCallback(async () => {
    if (!postTarget || selectedPostDestinations.length === 0) return;

    setPostError(null);
    setPostSuccess(null);
    const selected = postDestinations.filter(destination =>
      selectedPostDestinations.includes(destination.key)
    );

    if (selected.length === 0) {
      setPostError('No valid Discord destinations are selected.');
      return;
    }

    const outcomes = await Promise.all(
      selected.map(async destination => {
        try {
          await mirrorMutation.mutateAsync({
            pollId: postTarget.id,
            data: {
              guildId: destination.guildId,
              channelId: destination.channelId,
            },
          });
          return { destination, success: true };
        } catch (error: unknown) {
          logger.error(
            `Failed to mirror poll ${postTarget.id} to destination ${destination.key}`,
            error instanceof Error ? error : new Error(String(error))
          );
          return { destination, success: false };
        }
      })
    );

    const failedDestinations = outcomes
      .filter(outcome => !outcome.success)
      .map(outcome => formatDestinationLabel(outcome.destination, guildNameById));
    const failedDestinationKeys = outcomes
      .filter(outcome => !outcome.success)
      .map(outcome => outcome.destination.key);
    const failureCount = failedDestinations.length;
    const successCount = outcomes.length - failureCount;

    const failedSummary = summarizeFailedDestinations(failedDestinations);

    if (successCount === 0) {
      setPostError(
        failedSummary
          ? `Failed to post poll to selected Discord destinations (${failedSummary}).`
          : 'Failed to post poll to selected Discord destinations.'
      );
      return;
    }

    if (failureCount > 0) {
      const destinationWord = successCount === 1 ? 'destination' : 'destinations';
      const failureMessage =
        failedSummary.length > 0
          ? `Posted to ${successCount} ${destinationWord}, but ${failureCount} failed (${failedSummary}).`
          : `Posted to ${successCount} ${destinationWord}, but ${failureCount} failed.`;
      setPostError(failureMessage);
      setSelectedPostDestinations(failedDestinationKeys);
    } else {
      setPostSuccess(
        `Posted poll to ${successCount} configured destination${successCount === 1 ? '' : 's'}. Web and Discord results stay in sync automatically.`
      );
      setPostOpen(false);
      setPostTarget(null);
      setSelectedPostDestinations([]);
    }
  }, [mirrorMutation, postTarget, postDestinations, selectedPostDestinations, guildNameById]);

  const polls = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const canManagePolls = useHasMinOrgRole('officer');
  const canPostPollsToDiscord = useHasMinOrgRole('admin');

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4, px: 2 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <PollIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold', flex: 1 }}>
          Polls
        </Typography>
        {canManagePolls && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            New Poll
          </Button>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Create polls, vote, and view results. Supports single-choice, multiple-choice, ranked, and
        approval voting.
      </Typography>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e: SelectChangeEvent) => {
              setStatusFilter(e.target.value as PollStatus | '');
              setPage(1);
            }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="closed">Closed</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {/* Content */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load polls. Please try again.
        </Alert>
      )}

      {postError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPostError(null)}>
          {postError}
        </Alert>
      )}

      {postSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setPostSuccess(null)}>
          {postSuccess}
        </Alert>
      )}

      {!isLoading && polls.length === 0 && (
        <Alert severity="info">No polls found. Create your first poll to get started.</Alert>
      )}

      {polls.map(poll => (
        <PollCard
          key={poll.id}
          poll={poll}
          canManage={canManagePolls}
          canPostToDiscord={canPostPollsToDiscord}
          onVote={handleVote}
          onClose={handleClosePoll}
          onDelete={id => openDialog(id)}
          onPostToDiscord={handleOpenPostDialog}
          isVoting={castVoteMutation.isPending}
        />
      ))}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_e, value) => setPage(value)}
            color="primary"
          />
        </Box>
      )}

      {/* Dialogs */}
      <CreatePollDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateSubmit}
        isSubmitting={createMutation.isPending}
      />

      <ConfirmDialog
        {...dialogProps}
        title="Delete Poll"
        message="This will permanently delete this poll and all votes. This action cannot be undone."
        onConfirm={handleConfirmDelete}
      />

      <Dialog open={postOpen} onClose={() => setPostOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Post Poll in Discord</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {postTarget ? `Posting: ${postTarget.title}` : 'Select a poll to post'}
            </Typography>
            <FormControl fullWidth size="small" disabled={loadingPostDestinations}>
              <InputLabel>Configured Notification Destinations</InputLabel>
              <Select<string[]>
                multiple
                value={selectedPostDestinations}
                label="Configured Notification Destinations"
                onChange={(e: SelectChangeEvent<string[]>) => {
                  const value = e.target.value;
                  setSelectedPostDestinations(Array.isArray(value) ? value : [value]);
                }}
                renderValue={selected => {
                  if (!Array.isArray(selected) || selected.length === 0) {
                    return 'Select configured channels';
                  }
                  const names = selected
                    .map(key => {
                      const destination = postDestinations.find(d => d.key === key);
                      return destination ? formatDestinationLabel(destination, guildNameById) : key;
                    })
                    .join(', ');
                  return names;
                }}
              >
                {postDestinations.map(destination => (
                  <MenuItem key={destination.key} value={destination.key}>
                    {formatDestinationLabel(destination, guildNameById)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {truncatedGuildCount > 0 && (
              <Alert severity="info">
                Showing destinations for the first {orgGuilds.length - truncatedGuildCount} guilds.
                {` `}
                {truncatedGuildCount} additional guild
                {truncatedGuildCount === 1 ? ' was' : 's were'} skipped to keep load time stable.
              </Alert>
            )}

            {orgGuilds.length === 0 && (
              <Alert severity="info">No Discord servers are linked to this organization yet.</Alert>
            )}

            {postDestinationFailedGuilds.length > 0 && (
              <Alert severity="warning">
                Some guild settings could not be loaded:{' '}
                {postDestinationFailedGuilds.map(g => g.guildName).join(', ')}.
              </Alert>
            )}

            {orgGuilds.length > 0 &&
              !loadingPostDestinations &&
              postDestinations.length === 0 &&
              postDestinationFailedGuilds.length === 0 && (
                <Alert severity="info">
                  No announcement channels are configured. Set channels in Discord Settings &gt;
                  Notifications, then try again.
                </Alert>
              )}

            <Typography variant="caption" color="text.secondary">
              Channels are managed in Discord Settings &gt; Notifications. Poll results are mirrored
              live between web and Discord after votes.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPostOpen(false)} disabled={mirrorMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePostToDiscord}
            disabled={
              mirrorMutation.isPending || selectedPostDestinations.length === 0 || !postTarget
            }
            startIcon={mirrorMutation.isPending ? <CircularProgress size={16} /> : undefined}
          >
            Post to Configured Channels
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export const PollsPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Polls">
    <PollsPage />
  </FeatureErrorBoundary>
);

export { PollsPage };
