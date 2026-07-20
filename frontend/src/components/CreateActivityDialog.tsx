/**
 * Unified Create Dialog — Create Activity, Event, or Job Listing
 *
 * Consolidates the three creation flows into a single MUI Dialog with
 * a type selector and contextual form fields.
 */
import { RecurrenceSection } from '@/components/RecurrenceSection';
import { ReminderSection, type ReminderConfig } from '@/components/ReminderSection';
import {
    ShipRequirementsEditor,
    type ShipRequirementMode,
    type ShipRequirementOutput,
} from '@/components/ShipRequirementsEditor';
import { useCreateActivity } from '@/hooks/queries/useActivityQueries';
import { activityReminderService } from '@/services/activityReminderService';
import { activityTemplateService } from '@/services/activityTemplateService';
import { apiClient } from '@/services/apiClient';
import {
    publicJobListingService,
    type CreateJobListingInput,
    type JobType,
    type ListingCategory,
    type OrgPrimaryFocus,
    type PayType,
} from '@/services/publicDirectoryService';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import type { ActivityType, ActivityVisibility } from '@/types/activity';
import { ActivityTemplateCategory } from '@/types/apiV2';
import type { CrewMode } from '@/utils/crewCalculation';
import { logger } from '@/utils/logger';
import {
    RocketLaunch as ActivityIcon,
    CalendarMonth as CalendarIcon,
    Work as JobIcon,
    Link as LinkIcon,
    BookmarkAdd as SaveTemplateIcon,
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormHelperText,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { RecurrenceRule } from '@sc-fleet-manager/shared-types';
import React, { useEffect, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CreationType = 'activity' | 'event' | 'job';

export interface CreateActivityDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after successful creation with the type and created item */
  onCreated?: (type: CreationType, item: unknown) => void;
  /** Pre-select a creation type */
  defaultType?: CreationType;
  /** Organization ID scope — required for activities & jobs */
  organizationId?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'mission', label: 'Mission' },
  { value: 'contract', label: 'Contract' },
  { value: 'bounty', label: 'Bounty' },
  { value: 'event', label: 'Event' },
  { value: 'lfg', label: 'Looking for Group' },
  { value: 'operation', label: 'Operation' },
];

const VISIBILITY_OPTIONS: { value: ActivityVisibility; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'organization', label: 'Organization Only' },
  { value: 'alliance', label: 'Alliance' },
  { value: 'private', label: 'Private' },
];

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: 'crew', label: 'Crew' },
  { value: 'pilot', label: 'Pilot' },
  { value: 'gunner', label: 'Gunner' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'medic', label: 'Medic' },
  { value: 'miner', label: 'Miner' },
  { value: 'hauler', label: 'Hauler' },
  { value: 'scout', label: 'Scout' },
  { value: 'security', label: 'Security' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'support', label: 'Support' },
  { value: 'other', label: 'Other' },
];

const FOCUS_OPTIONS: { value: OrgPrimaryFocus; label: string }[] = [
  { value: 'combat', label: 'Combat' },
  { value: 'mining', label: 'Mining' },
  { value: 'trading', label: 'Trading' },
  { value: 'exploration', label: 'Exploration' },
  { value: 'bounty_hunting', label: 'Bounty Hunting' },
  { value: 'medical', label: 'Medical' },
  { value: 'transport', label: 'Transport' },
  { value: 'salvage', label: 'Salvage' },
  { value: 'security', label: 'Security' },
  { value: 'social', label: 'Social' },
  { value: 'piracy', label: 'Piracy' },
  { value: 'racing', label: 'Racing' },
  { value: 'mixed', label: 'Mixed' },
];

const PAY_TYPES: { value: PayType; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'negotiable', label: 'Negotiable' },
  { value: 'volunteer', label: 'Volunteer' },
];

const LISTING_CATEGORIES: { value: ListingCategory; label: string }[] = [
  { value: 'job', label: 'Job Posting — Looking to hire' },
  { value: 'service', label: 'Service Offering — Advertising your skills' },
];

/** Human-readable label for each creation type */
function typeLabel(t: CreationType): string {
  switch (t) {
    case 'activity':
      return 'Activity';
    case 'event':
      return 'Event';
    case 'job':
      return 'Job Listing';
  }
}

/** Placeholder text per creation type */
function titlePlaceholder(t: CreationType): string {
  switch (t) {
    case 'activity':
      return 'e.g. Mining Operation — Lyria Belt';
    case 'event':
      return 'e.g. Friday Night Flight';
    case 'job':
      return 'e.g. Looking for experienced Pilot';
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeRecurrenceStart(
  type: CreationType,
  startDate: string,
  eventDate: string,
  eventTime: string
): string | undefined {
  if (type === 'activity' && startDate) return startDate;
  if (type === 'event' && eventDate) {
    return eventTime ? `${eventDate}T${eventTime}:00` : `${eventDate}T00:00:00`;
  }
  return undefined;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const CreateActivityDialog: React.FC<CreateActivityDialogProps> = ({
  open,
  onClose,
  onCreated,
  defaultType = 'activity',
  organizationId: propOrgId,
}) => {
  const { user } = useAuthStore();
  const theme = useTheme();
  const organizationId = propOrgId || user?.organizationId || '';

  // ── Type selector ──
  const [creationType, setCreationType] = useState<CreationType>(defaultType);

  // ── Shared fields ──
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  // ── Activity-specific ──
  const [activityType, setActivityType] = useState<ActivityType>('mission');
  const [visibility, setVisibility] = useState<ActivityVisibility>(
    organizationId ? 'organization' : 'public'
  );
  const [postAsLfg, setPostAsLfg] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ── Event-specific ──
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');

  // ── Job-specific ──
  const defaultContact = user?.discordUsername
    ? `Discord: ${user.discordUsername}`
    : user?.username || '';
  // Use UTC offset format (e.g. "UTC+2") instead of IANA timezone (e.g. "Europe/Prague") for GDPR
  const browserOffset = new Date().getTimezoneOffset();
  const offsetHours = -browserOffset / 60;
  const defaultTimezone = `UTC${offsetHours >= 0 ? '+' : ''}${offsetHours}`;

  const [listingCategory, setListingCategory] = useState<ListingCategory>('job');
  const [jobType, setJobType] = useState<JobType>('crew');
  const [focus, setFocus] = useState<OrgPrimaryFocus>('mixed');
  const [payType, setPayType] = useState<PayType>('negotiable');
  const [payMin, setPayMin] = useState('');
  const [payMax, setPayMax] = useState('');
  const [contactInfo, setContactInfo] = useState(defaultContact);
  const [inviteLink, setInviteLink] = useState('');
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [tags, setTags] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // ── Ship & crew fields (shared between activity, event, and job) ──
  const [shipRequirementType, setShipRequirementType] = useState<ShipRequirementMode>('none');
  const [shipRequirements, setShipRequirements] = useState<ShipRequirementOutput[]>([]);
  const [calculatedCrew, setCalculatedCrew] = useState(0);
  const [crewSpotsTotal, setCrewSpotsTotal] = useState('');
  const [crewMode, setCrewMode] = useState<CrewMode>('lean');
  const [minCrew, setMinCrew] = useState(0);

  // ── Recurrence ──
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>({
    frequency: 'weekly',
  });

  // ── Reminders ──
  const [selectedReminders, setSelectedReminders] = useState<ReminderConfig[]>([]);

  // ── Status ──
  const [saving, setSaving] = useState(false);
  const notification = useNotification();

  // ── Reset ──
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setActivityType('mission');
    setVisibility(organizationId ? 'organization' : 'public');
    setPostAsLfg(false);
    setMaxParticipants('');
    setStartDate('');
    setEndDate('');
    setEventDate('');
    setEventTime('');
    setListingCategory('job');
    setJobType('crew');
    setFocus('mixed');
    setPayType('negotiable');
    setPayMin('');
    setPayMax('');
    setContactInfo(defaultContact);
    setInviteLink('');
    setTimezone(defaultTimezone);
    setTags('');
    setExpiresAt('');
    setShipRequirementType('none');
    setShipRequirements([]);
    setCalculatedCrew(0);
    setCrewSpotsTotal('');
    setCrewMode('lean');
    setMinCrew(0);
    setIsRecurring(false);
    setRecurrenceRule({ frequency: 'weekly' });
    setSelectedReminders([]);
  };

  // ── Auto-sync crew → maxParticipants (for activities) ──
  useEffect(() => {
    if (calculatedCrew > 1 && !crewSpotsTotal) {
      // Only auto-fill maxParticipants for activities when user hasn't manually set it
      // Skip if calculatedCrew is 1 — that's too restrictive, let it be "unlimited"
      if (creationType === 'activity' && !maxParticipants) {
        setMaxParticipants(String(calculatedCrew));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to crew changes
  }, [calculatedCrew]);

  /** Resolve effective crew spots: manual override > auto-calculated > undefined */
  const resolveCrewSpots = (): number | undefined => {
    if (crewSpotsTotal) return Number.parseInt(crewSpotsTotal, 10);
    if (calculatedCrew > 0) return calculatedCrew;
    return undefined;
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // ── Submit helpers (split to reduce cognitive complexity) ──
  const createActivityMutation = useCreateActivity();
  const submitActivity = async (): Promise<unknown> => {
    if (!organizationId) {
      throw new Error('You must be in an organization to create activities');
    }
    // Routed through hook so meta.invalidates fires for activity lists/upcoming.
    return createActivityMutation.mutateAsync({
      organizationId,
      data: {
        title: title.trim(),
        description: description.trim() || undefined,
        type: activityType,
        maxParticipants: maxParticipants ? Number.parseInt(maxParticipants, 10) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        location: location.trim() || undefined,
        visibility,
        isRecurring: isRecurring || undefined,
        recurringSchedule: isRecurring ? JSON.stringify(recurrenceRule) : undefined,
        metadata: postAsLfg ? { originatedFromLFG: true, quickJoin: true } : undefined,
        shipRequirementType: shipRequirementType === 'none' ? undefined : shipRequirementType,
        requiredShips: shipRequirements.length > 0 ? shipRequirements : undefined,
        crewSpotsTotal: resolveCrewSpots(),
      },
    });
  };

  const submitEvent = async (): Promise<unknown> => {
    if (!eventDate) {
      throw new Error('Date is required for events');
    }
    const dateTime = eventTime ? `${eventDate}T${eventTime}:00` : `${eventDate}T00:00:00`;

    // Recurring event uses dedicated endpoint
    if (isRecurring) {
      const result = await apiClient.post('/api/v2/events/recurring', {
        title: title.trim(),
        description: description.trim() || undefined,
        type: 'event',
        startDate: dateTime,
        location: location.trim() || undefined,
        organizationId: organizationId || undefined,
        recurrenceRule,
        shipRequirementType: shipRequirementType === 'none' ? undefined : shipRequirementType,
        requiredShips: shipRequirements.length > 0 ? shipRequirements : undefined,
        crewSpotsTotal: resolveCrewSpots(),
      });
      return result.data;
    }

    const result = await apiClient.post('/api/v2/events', {
      title: title.trim(),
      description: description.trim() || undefined,
      type: 'event',
      startDate: dateTime,
      location: location.trim() || undefined,
      organizationId: organizationId || undefined,
      shipRequirementType: shipRequirementType === 'none' ? undefined : shipRequirementType,
      requiredShips: shipRequirements.length > 0 ? shipRequirements : undefined,
      crewSpotsTotal: resolveCrewSpots(),
    });
    return result.data;
  };

  const submitJob = async (): Promise<unknown> => {
    const jobData: CreateJobListingInput = {
      listingCategory,
      title: title.trim(),
      description: description.trim() || undefined,
      jobType,
      focus,
      payType,
      payMin: payMin ? Number.parseFloat(payMin) : undefined,
      payMax: payMax ? Number.parseFloat(payMax) : undefined,
      contactInfo: inviteLink
        ? `${contactInfo.trim()} | ${inviteLink.trim()}`
        : contactInfo.trim() || undefined,
      timezone: timezone.trim() || undefined,
      tags: tags
        ? tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean)
        : undefined,
      expiresAt: expiresAt || undefined,
      shipRequirementType: shipRequirementType === 'none' ? undefined : shipRequirementType,
      requiredShips: shipRequirements.length > 0 ? shipRequirements : undefined,
      crewSpotsTotal: resolveCrewSpots(),
    };
    // Individual user job when no org, otherwise org job
    if (organizationId) {
      return publicJobListingService.createOrganizationJob(organizationId, jobData);
    }
    return publicJobListingService.createUserJob(jobData);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      notification.error('Title is required');
      return;
    }

    setSaving(true);

    try {
      const submitters: Record<CreationType, () => Promise<unknown>> = {
        activity: submitActivity,
        event: submitEvent,
        job: submitJob,
      };
      const result = await submitters[creationType]();

      // Create reminders if configured (activity & event only)
      if (
        selectedReminders.length > 0 &&
        (creationType === 'activity' || creationType === 'event')
      ) {
        const created = result as { id?: string };
        if (created?.id) {
          await activityReminderService.createReminders(created.id, selectedReminders);
        }
      }

      onCreated?.(creationType, result);
      handleClose();
    } catch (err: unknown) {
      // Extract validation details from ApiClientError or raw AxiosError
      let message = `Failed to create ${creationType}`;
      if (err && typeof err === 'object') {
        const apiErr = err as {
          details?: { errors?: Array<{ message: string }> };
          message?: string;
          response?: { data?: { errors?: Array<{ message: string }>; message?: string } };
        };
        const validationErrors = apiErr.details?.errors ?? apiErr.response?.data?.errors;
        if (validationErrors?.length) {
          message = validationErrors.map((e: { message: string }) => e.message).join('. ');
        } else {
          message = apiErr.response?.data?.message ?? apiErr.message ?? message;
        }
      }
      logger.error(
        `Failed to create ${creationType}`,
        err instanceof Error ? err : new Error(String(err))
      );
      notification.error(message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render helpers ──
  const needsOrg = creationType === 'activity';
  const missingOrg = needsOrg && !organizationId;

  const getSubmitDisabledReason = (): string => {
    if (missingOrg) return 'Join an organization first';
    if (!title.trim()) return 'Title is required';
    return '';
  };
  const submitDisabledReason = getSubmitDisabledReason();

  // Compute recurrence start time (extracted to reduce cognitive complexity)
  const recurrenceStartTime = computeRecurrenceStart(creationType, startDate, eventDate, eventTime);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
          },
        },
      }}
    >
      <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, pb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          {creationType === 'activity' && <ActivityIcon sx={{ color: theme.palette.info.main }} />}
          {creationType === 'event' && <CalendarIcon sx={{ color: theme.palette.success.main }} />}
          {creationType === 'job' && <JobIcon sx={{ color: theme.palette.warning.main }} />}
          <Typography variant="h6">Create {typeLabel(creationType)}</Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: '16px !important' }}>
        <Stack spacing={2.5}>
          {/* ── Type Selector ── */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              What would you like to create?
            </Typography>
            <Box
              sx={{
                background: `${theme.palette.background.default}80`,
                backdropFilter: 'blur(12px)',
                borderRadius: 2,
                p: 0.75,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <ToggleButtonGroup
                exclusive
                value={creationType}
                onChange={(_, val) => {
                  if (val) {
                    setCreationType(val as CreationType);
                  }
                }}
                fullWidth
                size="small"
                sx={{
                  '& .MuiToggleButtonGroup-grouped': {
                    border: 'none !important',
                    mx: 0.5,
                  },
                  '& .MuiToggleButton-root': {
                    borderRadius: 1.5,
                    px: 3,
                    py: 1.2,
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    letterSpacing: 0.5,
                    color: theme.palette.text.secondary,
                    textTransform: 'none',
                    transition: theme.transitions.create('all', { duration: 220 }),
                    '&:hover': {
                      background: `${theme.palette.primary.main}12`,
                      color: theme.palette.common.white,
                    },
                    '&.Mui-selected': {
                      background: `linear-gradient(135deg, ${theme.palette.primary.main}2E 0%, ${theme.palette.secondary.main}2E 100%)`,
                      color: theme.palette.common.white,
                      border: `1px solid ${theme.palette.primary.main}40 !important`,
                      boxShadow: `0 0 16px 2px ${theme.palette.primary.main}1A`,
                      '&:hover': {
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}47 0%, ${theme.palette.secondary.main}47 100%)`,
                      },
                    },
                  },
                }}
              >
                <ToggleButton value="activity">
                  <ActivityIcon sx={{ mr: 0.5, fontSize: 18 }} /> Activity
                </ToggleButton>
                <ToggleButton value="event">
                  <CalendarIcon sx={{ mr: 0.5, fontSize: 18 }} /> Event
                </ToggleButton>
                <ToggleButton value="job">
                  <JobIcon sx={{ mr: 0.5, fontSize: 18 }} /> Job Listing
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          {missingOrg && (
            <Alert severity="warning">
              You must be a member of an organization to create{' '}
              {creationType === 'activity' ? 'activities' : 'job listings'}.
            </Alert>
          )}

          {/* ── Shared Fields ── */}
          <TextField
            label="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            fullWidth
            size="small"
            placeholder={titlePlaceholder(creationType)}
            sx={fieldSx}
          />

          <TextField
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            multiline
            minRows={2}
            maxRows={6}
            fullWidth
            size="small"
            helperText={`${description.length}/2000`}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
            sx={fieldSx}
          />

          {/* ── Activity-specific ── */}
          {creationType === 'activity' && (
            <>
              <Stack direction="row" spacing={2}>
                <FormControl size="small" fullWidth sx={fieldSx}>
                  <InputLabel>Activity Type</InputLabel>
                  <Select
                    value={activityType}
                    label="Activity Type"
                    onChange={e => setActivityType(e.target.value as ActivityType)}
                  >
                    {ACTIVITY_TYPES.map(t => (
                      <MenuItem key={t.value} value={t.value}>
                        {t.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth sx={fieldSx}>
                  <InputLabel>Visibility</InputLabel>
                  <Select
                    value={visibility}
                    label="Visibility"
                    onChange={e => setVisibility(e.target.value as ActivityVisibility)}
                  >
                    {VISIBILITY_OPTIONS.map(v => (
                      <MenuItem key={v.value} value={v.value}>
                        {v.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <FormControlLabel
                control={
                  <Switch
                    checked={postAsLfg}
                    onChange={e => setPostAsLfg(e.target.checked)}
                    size="small"
                  />
                }
                label="Quick Join (without approval)"
              />

              <Stack direction="row" spacing={2}>
                <TextField
                  label="Max Participants"
                  type="number"
                  value={maxParticipants}
                  onChange={e => setMaxParticipants(e.target.value)}
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { min: 1 } }}
                  sx={fieldSx}
                />
                <TextField
                  label="Location"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="e.g. Stanton — Crusader"
                  sx={fieldSx}
                />
              </Stack>

              <Stack direction="row" spacing={2}>
                <TextField
                  label="Start Date & Time"
                  type="datetime-local"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  size="small"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={fieldSx}
                />
                <TextField
                  label="End Date & Time"
                  type="datetime-local"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  size="small"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={fieldSx}
                />
              </Stack>
            </>
          )}

          {/* ── Event-specific ── */}
          {creationType === 'event' && (
            <>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Date"
                  type="date"
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  required
                  size="small"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={fieldSx}
                />
                <TextField
                  label="Time"
                  type="time"
                  value={eventTime}
                  onChange={e => setEventTime(e.target.value)}
                  size="small"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={fieldSx}
                />
              </Stack>

              <TextField
                label="Location"
                value={location}
                onChange={e => setLocation(e.target.value)}
                size="small"
                fullWidth
                placeholder="e.g. Area 18, ArcCorp"
                sx={fieldSx}
              />
            </>
          )}

          {/* ── Job Listing-specific ── */}
          {creationType === 'job' && (
            <>
              <FormControl size="small" fullWidth sx={fieldSx}>
                <InputLabel>Listing Category</InputLabel>
                <Select
                  value={listingCategory}
                  label="Listing Category"
                  onChange={e => setListingCategory(e.target.value as ListingCategory)}
                >
                  {LISTING_CATEGORIES.map(c => (
                    <MenuItem key={c.value} value={c.value}>
                      {c.label}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText sx={{ color: theme.palette.text.secondary }}>
                  {listingCategory === 'job'
                    ? 'Your org is hiring or looking for help'
                    : 'You are advertising services'}
                </FormHelperText>
              </FormControl>

              <Stack direction="row" spacing={2}>
                <FormControl size="small" fullWidth sx={fieldSx}>
                  <InputLabel>Job Type</InputLabel>
                  <Select
                    value={jobType}
                    label="Job Type"
                    onChange={e => setJobType(e.target.value as JobType)}
                  >
                    {JOB_TYPES.map(j => (
                      <MenuItem key={j.value} value={j.value}>
                        {j.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth sx={fieldSx}>
                  <InputLabel>Focus Area</InputLabel>
                  <Select
                    value={focus}
                    label="Focus Area"
                    onChange={e => setFocus(e.target.value as OrgPrimaryFocus)}
                  >
                    {FOCUS_OPTIONS.map(f => (
                      <MenuItem key={f.value} value={f.value}>
                        {f.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <Stack direction="row" spacing={2}>
                <FormControl size="small" fullWidth sx={fieldSx}>
                  <InputLabel>Pay Type</InputLabel>
                  <Select
                    value={payType}
                    label="Pay Type"
                    onChange={e => setPayType(e.target.value as PayType)}
                  >
                    {PAY_TYPES.map(p => (
                      <MenuItem key={p.value} value={p.value}>
                        {p.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Pay Min"
                  type="number"
                  value={payMin}
                  onChange={e => setPayMin(e.target.value)}
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { min: 0 } }}
                  sx={fieldSx}
                />

                <TextField
                  label="Pay Max"
                  type="number"
                  value={payMax}
                  onChange={e => setPayMax(e.target.value)}
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { min: 0 } }}
                  sx={fieldSx}
                />
              </Stack>

              <Stack direction="row" spacing={2}>
                <TextField
                  label="Contact Info"
                  value={contactInfo}
                  onChange={e => setContactInfo(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="e.g. Discord: user#1234"
                  sx={fieldSx}
                />

                <TextField
                  label="Timezone"
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="e.g. UTC-5"
                  sx={fieldSx}
                />
              </Stack>

              <TextField
                label="Invite Link"
                value={inviteLink}
                onChange={e => setInviteLink(e.target.value)}
                size="small"
                fullWidth
                placeholder="e.g. https://discord.gg/yourserver"
                helperText="Discord invite or other join link (shown as clickable icon)"
                slotProps={{
                  input: {
                    startAdornment: inviteLink ? (
                      <InputAdornment position="start">
                        <LinkIcon fontSize="small" sx={{ color: theme.palette.info.main }} />
                      </InputAdornment>
                    ) : undefined,
                  },
                }}
                sx={fieldSx}
              />

              <TextField
                label="Tags"
                value={tags}
                onChange={e => setTags(e.target.value)}
                size="small"
                fullWidth
                placeholder="Comma-separated, e.g. mining, hauling, casual"
                helperText="Separate multiple tags with commas"
                sx={fieldSx}
              />

              <TextField
                label="Expires At"
                type="datetime-local"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="When should this listing expire?"
                sx={fieldSx}
              />
            </>
          )}

          {/* ── Recurrence (activity & event only) ── */}
          {(creationType === 'activity' || creationType === 'event') && (
            <RecurrenceSection
              isRecurring={isRecurring}
              onIsRecurringChange={setIsRecurring}
              recurrenceRule={recurrenceRule}
              onRuleChange={setRecurrenceRule}
              startTime={recurrenceStartTime}
            />
          )}

          {/* ── Reminders (activity & event only) ── */}
          {(creationType === 'activity' || creationType === 'event') && (
            <ReminderSection
              reminders={selectedReminders}
              onRemindersChange={setSelectedReminders}
            />
          )}

          {/* ── Ship & Crew Management (all types) ── */}
          <ShipRequirementsEditor
            shipRequirementType={shipRequirementType}
            onShipRequirementTypeChange={setShipRequirementType}
            onRequirementsChange={setShipRequirements}
            onCrewTotalChange={setCalculatedCrew}
            onMinCrewChange={setMinCrew}
            onCrewModeChange={setCrewMode}
            crewMode={crewMode}
          />

          {/* Editable crew spots total (auto-filled from ship requirements) */}
          {shipRequirementType !== 'none' && (
            <TextField
              label="Total Crew Spots"
              type="number"
              value={crewSpotsTotal || (calculatedCrew > 0 ? String(calculatedCrew) : '')}
              onChange={e => setCrewSpotsTotal(e.target.value)}
              size="small"
              fullWidth
              placeholder={calculatedCrew > 0 ? String(calculatedCrew) : 'e.g. 8'}
              helperText={
                calculatedCrew > 0
                  ? `Max: ${calculatedCrew} · Min (${crewMode}): ${minCrew} (editable)`
                  : 'How many crew members are needed in total?'
              }
              slotProps={{ htmlInput: { min: 1 } }}
            />
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}`, px: 3, py: 2 }}>
        <Button onClick={handleClose} sx={{ color: theme.palette.text.secondary }}>
          Cancel
        </Button>
        {creationType === 'activity' && (
          <Tooltip title="Save current form as a reusable template" arrow>
            <Button
              variant="outlined"
              startIcon={<SaveTemplateIcon />}
              disabled={saving || !title.trim()}
              onClick={async () => {
                if (!title.trim()) return;
                setSaving(true);
                try {
                  await activityTemplateService.createTemplate({
                    name: title,
                    description: description || undefined,
                    activityType: activityType,
                    category: ActivityTemplateCategory.CUSTOM,
                    isPublic: false,
                    tags:
                      tags.length > 0
                        ? tags
                            .split(',')
                            .map(t => t.trim())
                            .filter(Boolean)
                        : undefined,
                  });
                  onCreated?.('activity', { savedAsTemplate: true });
                  handleClose();
                } catch (err) {
                  logger.error(
                    'Failed to save as template',
                    err instanceof Error ? err : new Error(String(err))
                  );
                  notification.error('Failed to save as template');
                } finally {
                  setSaving(false);
                }
              }}
              sx={{ textTransform: 'none' }}
            >
              Save as Template
            </Button>
          </Tooltip>
        )}
        <Tooltip title={submitDisabledReason} arrow>
          <span>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={saving || !title.trim() || missingOrg}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{
                bgcolor: theme.palette.success.dark,
                '&:hover': { bgcolor: theme.palette.success.main },
                textTransform: 'none',
              }}
            >
              {saving ? 'Creating…' : `Create ${typeLabel(creationType)}`}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};

// ─── Shared field styling — inherits from MUI theme (muiTheme.ts MuiTextField overrides) ───
const fieldSx = {};
