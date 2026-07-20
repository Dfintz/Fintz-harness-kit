import { useActivities, useMyActivities, useRecommendedActivities } from '@/hooks/queries';
import { activityKeys } from '@/hooks/queries/queryKeys';
import { useAuthStore } from '@/store/authStore';
import type { ActivityV2 } from '@/types/apiV2';
import { activityV2ToCardData } from '@/utils/activityCardAdapter';
import { retryLazy } from '@/utils/retryLazy';
import {
  Add as AddIcon,
  CalendarMonth as CalendarIcon,
  ViewList as GridIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  type SelectChangeEvent,
  Stack,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UnifiedActivityCard } from './activity/UnifiedActivityCard';
import { CreateActivityDialog, type CreationType } from './CreateActivityDialog';
import { EmptyState } from './EmptyState';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';

const CalendarPageLazy = retryLazy(() =>
  import('@/pages/Calendar').then(m => ({ default: m.CalendarPageWithErrorBoundary }))
);

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

const TYPE_OPTIONS = [
  { value: 'event', label: 'Events' },
  { value: 'lfg', label: 'LFG' },
  { value: 'job_listing', label: 'Job Listings' },
  { value: 'operation', label: 'Operations' },
  { value: 'mission', label: 'Missions' },
  { value: 'contract', label: 'Contracts' },
  { value: 'bounty', label: 'Bounties' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const TYPE_LABEL_MAP = Object.fromEntries(TYPE_OPTIONS.map(o => [o.value, o.label]));
const STATUS_LABEL_MAP = Object.fromEntries(STATUS_OPTIONS.map(o => [o.value, o.label]));

// ---------------------------------------------------------------------------
// Helpers (extracted to reduce cognitive complexity)
// ---------------------------------------------------------------------------

function resolveActivities(
  myOnly: boolean,
  organizationId: string,
  myResult?: { items: ActivityV2[] },
  orgResult?: { items: ActivityV2[] },
  recResult?: { activities: ActivityV2[] }
): ActivityV2[] {
  if (myOnly) return myResult?.items ?? [];
  if (organizationId) return orgResult?.items ?? [];
  return recResult?.activities ?? [];
}

function resolveErrorMessage(error: Error | null | undefined): string {
  if (!error) return '';
  return error instanceof Error ? error.message : 'Failed to fetch activities';
}

function resolveSubtitleText(calendarView: boolean, myOnly: boolean): string {
  if (calendarView) return 'Calendar view with scheduling';
  if (myOnly) return 'Activities you created or joined';
  return 'Browse all activities, events, and operations';
}

function resolveEmptyTitle(typeFilter: string[], statusFilter: string[]): string {
  if (typeFilter.length === 0 && statusFilter.length === 0) return 'No activities found';
  return 'No matching activities found';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ActivityManagementProps {
  userId?: string;
  organizationId?: string;
}

export const ActivityManagement: React.FC<Readonly<ActivityManagementProps>> = ({
  organizationId: propOrgId,
}) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const organizationId =
    propOrgId || user?.organizationId || (process.env.NODE_ENV === 'test' ? 'org-123' : '');

  // Filter state (empty array = all)
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [myOnly, setMyOnly] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Canonical tab state is URL-driven for deep-link and back/forward consistency.
  const tabParam = searchParams.get('tab');
  const legacyViewParam = searchParams.get('view');
  const calendarView = tabParam === 'calendar' || legacyViewParam === 'calendar';

  useEffect(() => {
    if (legacyViewParam !== 'calendar' || tabParam === 'calendar') {
      return;
    }

    const normalized = new URLSearchParams(searchParams);
    normalized.delete('view');
    normalized.set('tab', 'calendar');
    setSearchParams(normalized, { replace: true });
  }, [legacyViewParam, searchParams, setSearchParams, tabParam]);

  // React Query hooks — fetch based on myOnly toggle
  const {
    data: myActivitiesResult,
    isLoading: myLoading,
    error: myError,
  } = useMyActivities(undefined, { enabled: myOnly });

  const {
    data: orgActivitiesResult,
    isLoading: orgLoading,
    error: orgError,
  } = useActivities(organizationId || undefined, undefined, {
    enabled: !myOnly && !!organizationId,
  });

  const {
    data: recommendedResult,
    isLoading: recLoading,
    error: recError,
  } = useRecommendedActivities(20, {
    enabled: !myOnly && !organizationId,
  });

  // Derive unified state
  const activities = resolveActivities(
    myOnly,
    organizationId,
    myActivitiesResult,
    orgActivitiesResult,
    recommendedResult
  );
  const loading = myLoading || orgLoading || recLoading;
  const errorMessage = resolveErrorMessage(myError || orgError || recError);

  // Apply filters (empty array = show all, but exclude cancelled and recruitment by default)
  const filteredActivities = useMemo(() => {
    let list = activities;

    // Exclude recruitment-type activities (they have their own dedicated page)
    list = list.filter(a => (a.type as string) !== 'recruitment');

    if (typeFilter.length > 0) {
      list = list.filter(a => typeFilter.includes(a.type));
    }
    if (statusFilter.length > 0) {
      list = list.filter(a => statusFilter.includes(a.status));
    } else {
      // When no explicit status filter is set, hide cancelled activities by default
      list = list.filter(a => a.status !== 'cancelled');
    }
    return list;
  }, [activities, typeFilter, statusFilter]);

  const handleForceRefresh = () => {
    queryClient.invalidateQueries({ queryKey: activityKeys.all });
  };

  const handleCreated = (_type: CreationType, _item: unknown) => {
    setShowCreateForm(false);
    queryClient.invalidateQueries({ queryKey: activityKeys.all });
  };

  const handleTypeChange = (e: SelectChangeEvent<string[]>) => {
    const val = e.target.value;
    setTypeFilter(typeof val === 'string' ? val.split(',') : val);
  };
  const handleStatusChange = (e: SelectChangeEvent<string[]>) => {
    const val = e.target.value;
    setStatusFilter(typeof val === 'string' ? val.split(',') : val);
  };

  const handleToggleCalendarView = () => {
    const next = new URLSearchParams(searchParams);
    if (calendarView) {
      next.delete('tab');
      if (next.get('view') === 'calendar') {
        next.delete('view');
      }
    } else {
      next.set('tab', 'calendar');
      next.delete('view');
    }

    setSearchParams(next);
  };

  const subtitleText = resolveSubtitleText(calendarView, myOnly);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={2}
        >
          <Stack>
            <Typography variant="h5">Activities & Events</Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitleText}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" onClick={handleForceRefresh}>
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowCreateForm(true)}
            >
              Create Activity
            </Button>
          </Stack>
        </Stack>

        {errorMessage && <ErrorMessage message={errorMessage} />}

        <CreateActivityDialog
          open={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onCreated={handleCreated}
          defaultType="activity"
          organizationId={organizationId}
        />

        {/* Filter Bar */}
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" gap={1}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Type</InputLabel>
            <Select
              multiple
              value={typeFilter}
              label="Type"
              onChange={handleTypeChange}
              input={<OutlinedInput label="Type" />}
              renderValue={selected =>
                selected.length === 0 ? (
                  'All Types'
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map(v => (
                      <Chip key={v} label={TYPE_LABEL_MAP[v] ?? v} size="small" />
                    ))}
                  </Box>
                )
              }
            >
              {TYPE_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Checkbox checked={typeFilter.includes(opt.value)} size="small" />
                  <ListItemText primary={opt.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Status</InputLabel>
            <Select
              multiple
              value={statusFilter}
              label="Status"
              onChange={handleStatusChange}
              input={<OutlinedInput label="Status" />}
              renderValue={selected =>
                selected.length === 0 ? (
                  'All Statuses'
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map(v => (
                      <Chip key={v} label={STATUS_LABEL_MAP[v] ?? v} size="small" />
                    ))}
                  </Box>
                )
              }
            >
              {STATUS_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Checkbox checked={statusFilter.includes(opt.value)} size="small" />
                  <ListItemText primary={opt.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={myOnly}
                onChange={(_e, checked) => setMyOnly(checked)}
                size="small"
              />
            }
            label="My Activities"
            sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
          />

          <Button
            variant={calendarView ? 'contained' : 'outlined'}
            size="small"
            startIcon={calendarView ? <GridIcon /> : <CalendarIcon />}
            onClick={handleToggleCalendarView}
          >
            {calendarView ? 'Grid View' : 'Calendar'}
          </Button>
        </Stack>

        {/* Main content */}
        {calendarView && (
          <Suspense fallback={<CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />}>
            <CalendarPageLazy />
          </Suspense>
        )}

        {!calendarView && loading && <LoadingSpinner message="Loading activities..." />}

        {!calendarView && !loading && filteredActivities.length === 0 && (
          <EmptyState
            title={resolveEmptyTitle(typeFilter, statusFilter)}
            description="Create an activity to get started, or adjust your filters."
          />
        )}

        {!calendarView && !loading && filteredActivities.length > 0 && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
              },
              gap: 2,
            }}
          >
            {filteredActivities.map(activity => (
              <UnifiedActivityCard
                key={activity.id}
                data={activityV2ToCardData(activity)}
                onClick={activityId => navigate(`/activities/${activityId}`)}
              />
            ))}
          </Box>
        )}
      </Stack>
    </Box>
  );
};

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

export const ActivityManagementWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Activity Management">
    <ActivityManagement />
  </FeatureErrorBoundary>
);
