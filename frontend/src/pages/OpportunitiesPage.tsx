/**
 * OpportunitiesPage
 * Unified discovery page listing public jobs, service ads, and activity opportunities.
 *
 * Sprint 20-G: Unified Opportunities Discovery Page
 */

import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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
import React, { useCallback, useMemo, useState } from 'react';

import { UnifiedActivityCard } from '@/components/activity/UnifiedActivityCard';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { SEOHead } from '@/components/SEOHead';
import { useOpportunitySearch } from '@/hooks/queries/useOpportunityQueries';
import type {
  OpportunitySearchFilters,
  UnifiedOpportunityItem,
} from '@/services/opportunityService';
import { opportunityToCardData } from '@/utils/activityCardAdapter';

// ============================================================================
// Filter Options
// ============================================================================

/** Display-level filter type — maps to API sourceType + listingCategory */
type DisplaySourceType = 'all' | 'jobs' | 'services' | 'activities';

const SOURCE_OPTIONS: { value: DisplaySourceType; label: string }[] = [
  { value: 'all', label: 'All Opportunities' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'services', label: 'Services' },
  { value: 'activities', label: 'Activities' },
];

const JOB_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Job Types' },
  { value: 'CREW', label: 'Crew' },
  { value: 'PILOT', label: 'Pilot' },
  { value: 'GUNNER', label: 'Gunner' },
  { value: 'ENGINEER', label: 'Engineer' },
  { value: 'MEDIC', label: 'Medic' },
  { value: 'MINER', label: 'Miner' },
  { value: 'HAULER', label: 'Hauler' },
  { value: 'SCOUT', label: 'Scout' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'LEADERSHIP', label: 'Leadership' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'OTHER', label: 'Other' },
];

const SORT_OPTIONS = [
  { value: 'postedAt', label: 'Date Posted' },
  { value: 'title', label: 'Title' },
];

const PAGE_LIMIT = 12;

// ============================================================================
// Opportunity Card
// ============================================================================

interface OpportunityCardProps {
  item: UnifiedOpportunityItem;
  compact?: boolean;
}

const OpportunityCard: React.FC<Readonly<OpportunityCardProps>> = ({ item, compact = false }) => {
  const handleClick = useCallback(
    (id: string) => {
      const isJob = item.sourceType === 'job';
      const path = isJob ? `/directory/jobs/${id}` : `/opportunities/activities/${id}`;
      globalThis.open(path, '_blank');
    },
    [item.sourceType]
  );

  return (
    <UnifiedActivityCard
      data={opportunityToCardData(item)}
      onClick={handleClick}
      compact={compact}
    />
  );
};

// ============================================================================
// Page Component
// ============================================================================

const OpportunitiesPage: React.FC = () => {
  // SEO
  const seoHead = (
    <SEOHead
      title="Opportunities — Jobs, Services & Activities"
      description="Discover Star Citizen job postings, service listings, and group activities. Find crew positions, bounty contracts, trade runs, and mining operations."
      canonical="https://fringecore.space/opportunities"
      keywords={[
        'jobs',
        'opportunities',
        'crew',
        'bounty',
        'trade',
        'mining',
        'Star Citizen careers',
      ]}
    />
  );

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [search, setSearch] = useState('');
  const [displaySource, setDisplaySource] = useState<DisplaySourceType>('all');
  const [jobType, setJobType] = useState('');
  const [hasOpenSlots, setHasOpenSlots] = useState(false);
  const [sortBy, setSortBy] = useState('postedAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [page, setPage] = useState(1);

  const filters: OpportunitySearchFilters = useMemo(() => {
    const result: OpportunitySearchFilters = {};
    // Map display source to API filters
    if (displaySource === 'activities') {
      result.sourceType = 'activity';
    } else if (displaySource !== 'all') {
      result.sourceType = 'job';
    }
    if (displaySource === 'jobs') {
      result.listingCategory = 'job';
    } else if (displaySource === 'services') {
      result.listingCategory = 'service';
    }
    if (search) {
      result.searchTerm = search;
    }
    if (jobType) {
      result.jobTypes = [jobType];
    }
    if (hasOpenSlots) {
      result.hasOpenSlots = true;
    }
    return result;
  }, [displaySource, search, jobType, hasOpenSlots]);

  const { data, isLoading, error } = useOpportunitySearch(
    filters,
    page,
    PAGE_LIMIT,
    sortBy,
    sortOrder
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

  const handleSelectChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string>>) => (e: SelectChangeEvent<string>) => {
      setter(e.target.value);
      setPage(1);
    },
    []
  );

  const hasActiveFilters = jobType || hasOpenSlots;

  const handleClearFilters = useCallback(() => {
    setJobType('');
    setHasOpenSlots(false);
    setSearch('');
    setPage(1);
  }, []);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4, px: 2 }}>
      {seoHead}
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
            Opportunities
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Discover jobs, services, and activities across all organizations.
          </Typography>
        </Box>
      </Stack>

      {/* Source type tabs */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {SOURCE_OPTIONS.map(opt => (
          <Chip
            key={opt.value}
            label={opt.label}
            variant={displaySource === opt.value ? 'filled' : 'outlined'}
            color={displaySource === opt.value ? 'primary' : 'default'}
            onClick={() => {
              setDisplaySource(opt.value);
              setPage(1);
            }}
          />
        ))}
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
          placeholder="Search opportunities..."
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
          {/* Job type — only when source includes jobs or services */}
          {displaySource !== 'activities' && (
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Job Type</InputLabel>
              <Select value={jobType} label="Job Type" onChange={handleSelectChange(setJobType)}>
                {JOB_TYPE_OPTIONS.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Open slots filter */}
          <Chip
            label="Open Slots Only"
            variant={hasOpenSlots ? 'filled' : 'outlined'}
            color={hasOpenSlots ? 'primary' : 'default'}
            onClick={() => {
              setHasOpenSlots(prev => !prev);
              setPage(1);
            }}
          />

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
          Failed to load opportunities. Please try again.
        </Alert>
      )}

      {!isLoading && !error && data && (
        <>
          {(data.data?.length ?? 0) === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                No opportunities found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {hasActiveFilters || search
                  ? 'Try adjusting your filters or search terms.'
                  : 'Check back later for new jobs, services, and activities.'}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {(data.data ?? []).map(item => (
                <Grid
                  key={`${item.sourceType}-${item.id}`}
                  size={{
                    xs: 12,
                    sm: viewMode === 'grid' ? 6 : 12,
                    md: viewMode === 'grid' ? 4 : 12,
                  }}
                >
                  <OpportunityCard item={item} compact={viewMode === 'list'} />
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
    </Box>
  );
};

export const OpportunitiesPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Opportunities">
    <OpportunitiesPage />
  </FeatureErrorBoundary>
);

export { OpportunitiesPage };
