import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import InboxIcon from '@mui/icons-material/Inbox';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useState } from 'react';

import {
  useJobApplications,
  useReviewApplication,
} from '@/hooks/queries/usePublicDirectoryQueries';
import { isApiClientError } from '@/services/apiClient';
import type {
  JobApplicationItem,
  JobApplicationStatus,
  JobApplicationType,
} from '@/services/publicDirectoryService';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';

interface JobApplicationsPanelProps {
  readonly jobId: string;
}

/** Status filter options */
const STATUS_FILTERS: { label: string; value: JobApplicationStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Waitlisted', value: 'waitlisted' },
  { label: 'Withdrawn', value: 'withdrawn' },
];

/** Format a date string */
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Get application type label */
function getAppTypeLabel(type: JobApplicationType): string {
  const labels: Record<JobApplicationType, string> = {
    crew: 'Crew',
    passenger: 'Passenger',
    vehicle: 'Vehicle',
    general: 'General',
  };
  return labels[type];
}

/**
 * Single application row with expand/collapse for review actions.
 */
const ApplicationRow: React.FC<
  Readonly<{
    application: JobApplicationItem;
    jobId: string;
  }>
> = ({ application, jobId }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reviewMutation = useReviewApplication(jobId);

  const handleReview = useCallback(
    async (status: 'approved' | 'rejected' | 'waitlisted') => {
      setError(null);
      try {
        await reviewMutation.mutateAsync({
          applicationId: application.id,
          data: { status, reviewNote: reviewNote || undefined },
        });
        setExpanded(false);
        setReviewNote('');
      } catch (err: unknown) {
        let msg = 'Review failed';
        if (isApiClientError(err)) {
          msg = err.message;
        } else if (err instanceof Error) {
          msg = err.message;
        }
        setError(msg);
        logger.error(
          'Failed to review application',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    },
    [application.id, reviewMutation, reviewNote]
  );

  const isPending = application.status === 'pending';
  const isWaitlisted = application.status === 'waitlisted';
  const canReview = isPending || isWaitlisted;

  return (
    <Box
      sx={{
        bgcolor: theme.palette.background.default,
        borderRadius: 1.5,
        border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
        overflow: 'hidden',
        '&:hover': { borderColor: alpha(theme.palette.common.white, 0.15) },
      }}
    >
      {/* Main row */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{
          px: 2,
          py: 1.5,
          cursor: canReview ? 'pointer' : 'default',
        }}
        onClick={() => canReview && setExpanded(!expanded)}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: '0.88rem',
                color: theme.palette.common.white,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {application.applicantDisplayName}
            </Typography>
            <Chip
              label={getAppTypeLabel(application.applicationType)}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 600,
                bgcolor: alpha(theme.palette.info.main, 0.1),
                color: theme.palette.info.light,
                border: `1px solid ${alpha(theme.palette.info.main, 0.25)}`,
              }}
            />
            {application.vehicleName && (
              <Chip
                icon={<RocketLaunchIcon sx={{ fontSize: '0.75rem' }} />}
                label={application.vehicleName}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: alpha(theme.palette.secondary.main, 0.1),
                  color: theme.palette.secondary.light,
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.25)}`,
                }}
              />
            )}
            {application.roleName && (
              <Chip
                label={application.roleName}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  color: theme.palette.warning.light,
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                }}
              />
            )}
          </Stack>
          {application.message && (
            <Typography
              sx={{
                fontSize: '0.78rem',
                color: theme.palette.text.secondary,
                mt: 0.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 320,
              }}
            >
              &ldquo;{application.message}&rdquo;
            </Typography>
          )}
        </Box>

        <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.disabled, flexShrink: 0 }}>
          {formatRelativeDate(application.createdAt)}
        </Typography>

        <Chip
          label={application.status.charAt(0).toUpperCase() + application.status.slice(1)}
          size="small"
          sx={{
            fontWeight: 600,
            fontSize: '0.68rem',
            ...getStatusChipSx(application.status, theme),
          }}
        />

        {canReview && (
          <IconButton
            size="small"
            sx={{
              color: theme.palette.text.secondary,
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: theme.transitions.create('transform', { duration: 200 }),
            }}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>

      {/* Expandable review section */}
      <Collapse in={expanded}>
        <Box
          sx={{
            px: 2,
            pb: 2,
            pt: 0.5,
            borderTop: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
          }}
        >
          {error && (
            <Alert severity="error" sx={{ mb: 1, fontSize: '0.8rem' }}>
              {error}
            </Alert>
          )}

          {application.reviewNote && (
            <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, mb: 1 }}>
              Previous note: {application.reviewNote}
            </Typography>
          )}

          <TextField
            placeholder="Optional review note..."
            value={reviewNote}
            onChange={e => setReviewNote(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={1}
            maxRows={2}
            slotProps={{
              input: {
                sx: {
                  bgcolor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                  borderRadius: 1.5,
                  fontSize: '0.82rem',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                },
              },
            }}
            sx={{ mb: 1.5 }}
          />

          <Stack direction="row" spacing={1}>
            <Tooltip title="Approve this application">
              <Button
                size="small"
                variant="contained"
                startIcon={
                  reviewMutation.isPending ? <CircularProgress size={14} /> : <CheckIcon />
                }
                disabled={reviewMutation.isPending}
                onClick={e => {
                  e.stopPropagation();
                  handleReview('approved');
                }}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  bgcolor: theme.palette.success.dark,
                  '&:hover': { bgcolor: theme.palette.success.main },
                }}
              >
                Approve
              </Button>
            </Tooltip>

            <Tooltip title="Reject this application">
              <Button
                size="small"
                variant="outlined"
                startIcon={
                  reviewMutation.isPending ? <CircularProgress size={14} /> : <CloseIcon />
                }
                disabled={reviewMutation.isPending}
                onClick={e => {
                  e.stopPropagation();
                  handleReview('rejected');
                }}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  color: theme.palette.error.light,
                  borderColor: alpha(theme.palette.error.main, 0.4),
                  '&:hover': {
                    borderColor: theme.palette.error.light,
                    bgcolor: alpha(theme.palette.error.main, 0.1),
                  },
                }}
              >
                Reject
              </Button>
            </Tooltip>

            {isPending && (
              <Tooltip title="Move to waitlist">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={
                    reviewMutation.isPending ? (
                      <CircularProgress size={14} />
                    ) : (
                      <HourglassEmptyIcon />
                    )
                  }
                  disabled={reviewMutation.isPending}
                  onClick={e => {
                    e.stopPropagation();
                    handleReview('waitlisted');
                  }}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.78rem',
                    color: theme.palette.warning.light,
                    borderColor: alpha(theme.palette.warning.main, 0.4),
                    '&:hover': {
                      borderColor: theme.palette.warning.light,
                      bgcolor: alpha(theme.palette.warning.main, 0.1),
                    },
                  }}
                >
                  Waitlist
                </Button>
              </Tooltip>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
};

/**
 * JobApplicationsPanel — displays and manages applications for a job listing.
 * Only visible to the listing owner / org admin.
 */
export const JobApplicationsPanel: React.FC<Readonly<JobApplicationsPanelProps>> = ({ jobId }) => {
  const theme = useTheme();
  const [statusFilter, setStatusFilter] = useState<JobApplicationStatus | 'all'>('all');

  const queryStatus = statusFilter === 'all' ? undefined : statusFilter;
  const { data: applications, isLoading, error } = useJobApplications(jobId, queryStatus, true);
  // Separate query for all applications to get accurate pending count even when filtered
  const { data: allApplications, error: allError } = useJobApplications(jobId, undefined, true);

  // If the unfiltered query returns a permission error (403/401), the user doesn't have
  // management access — hide the entire panel rather than showing an error
  const isPermissionError =
    allError &&
    isApiClientError(allError) &&
    (allError.statusCode === 403 || allError.statusCode === 401);
  if (isPermissionError) return null;

  const pendingCount = allApplications?.filter(a => a.status === 'pending').length ?? 0;

  return (
    <Box
      sx={{
        bgcolor: theme.palette.background.paper,
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
        p: 2.5,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <InboxIcon sx={{ fontSize: 20, color: theme.palette.info.light }} />
        <Typography sx={{ fontWeight: 600, color: theme.palette.common.white, fontSize: '0.9rem' }}>
          Applications
        </Typography>
        {pendingCount > 0 && (
          <Chip
            label={`${pendingCount} pending`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.68rem',
              fontWeight: 700,
              bgcolor: alpha(theme.palette.warning.main, 0.12),
              color: theme.palette.warning.main,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
            }}
          />
        )}
        <Typography
          sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, ml: 'auto !important' }}
        >
          {applications?.length ?? 0} total
        </Typography>
      </Stack>

      {/* Status filter chips */}
      <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
        {STATUS_FILTERS.map(f => (
          <Chip
            key={f.value}
            label={f.label}
            size="small"
            onClick={() => setStatusFilter(f.value)}
            sx={{
              height: 24,
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              bgcolor:
                statusFilter === f.value
                  ? alpha(theme.palette.primary.main, 0.15)
                  : alpha(theme.palette.common.white, 0.04),
              color:
                statusFilter === f.value
                  ? theme.palette.primary.light
                  : theme.palette.text.secondary,
              border: `1px solid ${
                statusFilter === f.value
                  ? alpha(theme.palette.primary.main, 0.4)
                  : alpha(theme.palette.common.white, 0.1)
              }`,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.1),
              },
            }}
          />
        ))}
      </Stack>

      {/* Content */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ fontSize: '0.82rem' }}>
          Failed to load applications
        </Alert>
      )}

      {!isLoading && !error && applications?.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <InboxIcon sx={{ fontSize: 36, color: theme.palette.text.disabled, mb: 1 }} />
          <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.85rem' }}>
            {statusFilter === 'all' ? 'No applications yet' : `No ${statusFilter} applications`}
          </Typography>
        </Box>
      )}

      {!isLoading && applications && applications.length > 0 && (
        <Stack spacing={1}>
          {applications.map(app => (
            <ApplicationRow key={app.id} application={app} jobId={jobId} />
          ))}
        </Stack>
      )}
    </Box>
  );
};
