/**
 * OperationsPage (formerly MissionsPage)
 * List/grid view of operations with filtering, search, and create capabilities.
 *
 * Sprint 1 — Wave 3.1
 */

import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import type { SelectChangeEvent } from '@mui/material/Select';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type {
  MissionDifficulty,
  MissionPriority,
  MissionStatus,
  MissionType,
} from '@sc-fleet-manager/shared-types';
import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { MissionCard } from '@/components/missions/MissionCard';
import { useMissions, usePrefetchMission } from '@/hooks/queries/useMissionQueries';
import type { MissionQueryParams } from '@/services/missionService';
import { useAuthStore, useHasMinOrgRole } from '@/store/authStore';

import { CreateMissionDialog } from './CreateMissionDialog';

// ============================================================================
// Filter Options
// ============================================================================

const STATUS_OPTIONS: { value: MissionStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'planned', label: 'Planned' },
  { value: 'briefed', label: 'Briefed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const TYPE_OPTIONS: { value: MissionType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'combat', label: 'Combat' },
  { value: 'mining', label: 'Mining' },
  { value: 'trading', label: 'Trading' },
  { value: 'exploration', label: 'Exploration' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'rescue', label: 'Rescue' },
  { value: 'reconnaissance', label: 'Recon' },
  { value: 'escort', label: 'Escort' },
  { value: 'salvage', label: 'Salvage' },
  { value: 'custom', label: 'Custom' },
];

const DIFFICULTY_OPTIONS: { value: MissionDifficulty | ''; label: string }[] = [
  { value: '', label: 'All Difficulties' },
  { value: 'trivial', label: 'Trivial' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'extreme', label: 'Extreme' },
];

const PRIORITY_OPTIONS: { value: MissionPriority | ''; label: string }[] = [
  { value: '', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Created Date' },
  { value: 'startDate', label: 'Start Date' },
  { value: 'title', label: 'Title' },
  { value: 'priority', label: 'Priority' },
  { value: 'difficulty', label: 'Difficulty' },
];

// ============================================================================
// Component
// ============================================================================

const MissionsPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const prefetchMission = usePrefetchMission();
  const canCreateOps = useHasMinOrgRole('officer');

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Filter state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [missionType, setMissionType] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [page, setPage] = useState(1);

  const queryParams: MissionQueryParams = useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(missionType ? { missionType } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(priority ? { priority } : {}),
      sortBy,
      sortOrder,
      page,
      limit: 12,
    }),
    [search, status, missionType, difficulty, priority, sortBy, sortOrder, page]
  );

  const { data, isLoading, error } = useMissions(queryParams);

  const handleMissionClick = useCallback(
    (missionId: string) => {
      navigate(`/missions/${missionId}`);
    },
    [navigate]
  );

  const handleMissionHover = useCallback(
    (missionId: string) => {
      prefetchMission(missionId);
    },
    [prefetchMission]
  );

  const handleViewChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newView: 'grid' | 'list' | null) => {
      if (newView) setViewMode(newView);
    },
    []
  );

  const handlePageChange = useCallback((_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string>>) => (e: SelectChangeEvent<string>) => {
      setter(e.target.value);
      setPage(1);
    },
    []
  );

  const hasActiveFilters = status || missionType || difficulty || priority;

  const handleClearFilters = useCallback(() => {
    setStatus('');
    setMissionType('');
    setDifficulty('');
    setPriority('');
    setSearch('');
    setPage(1);
  }, []);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4, px: 2 }}>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            Operations
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Plan, brief, and execute operations with your organization.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          {user?.activeOrgId && canCreateOps && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              New Operation
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Search + Controls bar */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
        sx={{ mb: 2 }}
      >
        <TextField
          size="small"
          placeholder="Search missions..."
          value={search}
          onChange={handleSearchChange}
          sx={{ flex: 1, minWidth: 200 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant={showFilters ? 'contained' : 'outlined'}
            size="small"
            startIcon={<FilterListIcon />}
            onClick={() => setShowFilters(prev => !prev)}
            color={hasActiveFilters ? 'primary' : 'inherit'}
          >
            Filters
            {hasActiveFilters ? ' (active)' : ''}
          </Button>

          <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewChange} size="small">
            <ToggleButton value="grid" aria-label="Grid view">
              <ViewModuleIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="list" aria-label="List view">
              <ViewListIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {/* Filter panel */}
      <Collapse in={showFilters}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{
            mb: 2,
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={handleFilterChange(setStatus)}>
              {STATUS_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Type</InputLabel>
            <Select value={missionType} label="Type" onChange={handleFilterChange(setMissionType)}>
              {TYPE_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Difficulty</InputLabel>
            <Select
              value={difficulty}
              label="Difficulty"
              onChange={handleFilterChange(setDifficulty)}
            >
              {DIFFICULTY_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Priority</InputLabel>
            <Select value={priority} label="Priority" onChange={handleFilterChange(setPriority)}>
              {PRIORITY_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Sort By</InputLabel>
            <Select value={sortBy} label="Sort By" onChange={e => setSortBy(e.target.value)}>
              {SORT_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <IconButton
            size="small"
            onClick={() => setSortOrder(prev => (prev === 'ASC' ? 'DESC' : 'ASC'))}
            title={`Sort ${sortOrder === 'ASC' ? 'ascending' : 'descending'}`}
          >
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {sortOrder === 'ASC' ? '↑' : '↓'}
            </Typography>
          </IconButton>

          {hasActiveFilters && (
            <Button size="small" onClick={handleClearFilters}>
              Clear
            </Button>
          )}
        </Stack>
      </Collapse>

      {/* Content */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load missions. Please try again.
        </Alert>
      )}

      {!isLoading && !error && data && (
        <>
          {(data.data?.length ?? 0) === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                No missions found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {hasActiveFilters
                  ? 'Try adjusting your filters or search terms.'
                  : 'Create your first mission to get started.'}
              </Typography>
              {user?.activeOrgId && !hasActiveFilters && canCreateOps && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateDialogOpen(true)}
                >
                  Create Mission
                </Button>
              )}
            </Box>
          ) : (
            <Grid container spacing={2}>
              {(data.data ?? []).map(mission => (
                <Grid
                  key={mission.id}
                  size={{
                    xs: 12,
                    sm: viewMode === 'grid' ? 6 : 12,
                    md: viewMode === 'grid' ? 4 : 12,
                  }}
                >
                  <Box onMouseEnter={() => handleMissionHover(mission.id)}>
                    <MissionCard
                      mission={mission}
                      onClick={handleMissionClick}
                      compact={viewMode === 'list'}
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Pagination */}
          {data?.pagination?.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
              <Pagination
                count={data.pagination.totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </>
      )}

      {/* Create Dialog */}
      <CreateMissionDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
    </Box>
  );
};

export const MissionsPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Missions">
    <MissionsPage />
  </FeatureErrorBoundary>
);

export { MissionsPage };
