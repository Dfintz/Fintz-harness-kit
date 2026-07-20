import {
  Business as BusinessIcon,
  CheckCircle as CheckCircleIcon,
  GpsFixed as GpsFixedIcon,
  Groups as GroupsIcon,
  Handshake as HandshakeIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Tune as TuneIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { type Theme, alpha, useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { CommunityMembersPanel as MembersPanel } from '@/components/directories/CommunityMembersPanel';
import { SEOHead } from '@/components/SEOHead';
import { scColors } from '@/components/ui/tokens';
import { publicDirectoryKeys } from '@/hooks/queries/queryKeys';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import {
  DIRECTORY_ORGANIZATIONS_FILTER_DEFAULTS,
  buildDirectoryPagination,
  buildDirectoryQueryFilters,
  parseDirectoryActivityLevels,
  parseDirectoryFocuses,
  parseDirectoryOrganizationsFilters,
} from '@/pages/directoryFilters';
import { selectIsAuthenticated, useAuthStore } from '@/store/authStore';

function triStateToBool(v: 'all' | 'true' | 'false'): boolean | undefined {
  if (v === 'all') return undefined;
  return v === 'true';
}

function boolToTriState(v: boolean | undefined): 'all' | 'true' | 'false' {
  if (v === undefined) return 'all';
  return v ? 'true' : 'false';
}

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { PublicFederationCard } from '@/components/PublicFederationCard';
import { PublicOrgCard } from '@/components/PublicOrgCard';
import { AdvancedSearchFiltersPanel } from '@/components/search/AdvancedSearchFiltersPanel';
import { useOpportunitySearch } from '@/hooks/queries/useOpportunityQueries';
import type {
  OpportunitySearchFilters,
  OpportunitySourceType,
} from '@/services/opportunityService';
import type { PaginationOptions } from '@/services/publicDirectoryService';
import {
  ActivityLevel,
  FederationFilters,
  OrgPrimaryFocus,
  getFocusLabel,
  publicDirectoryService,
  publicFederationService,
} from '@/services/publicDirectoryService';

const DEFAULT_PAGE_SIZE = 12;

/* ─── Shared styles: Fringe Core palette (login page colors) ─── */
const searchBoxSx = (theme: Theme) => ({
  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.7)} 0%, ${alpha(theme.palette.background.default, 0.7)} 100%)`,
  backdropFilter: 'blur(10px)',
  border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
  borderRadius: 2,
  p: 1.5,
});

const darkFieldSx = (theme: Theme) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: alpha(theme.palette.background.default, 0.6),
    color: theme.palette.common.white,
    fontSize: '0.9rem',
    '& fieldset': { borderColor: alpha(theme.palette.primary.main, 0.25) },
    '&:hover fieldset': { borderColor: alpha(theme.palette.primary.main, 0.5) },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main,
      boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.15)}`,
    },
  },
  '& .MuiInputLabel-root': { color: alpha(theme.palette.common.white, 0.5), fontSize: '0.85rem' },
  '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.primary.main },
});

const darkSelectSx = (theme: Theme) => ({
  ...darkFieldSx(theme),
  '& .MuiSelect-icon': { color: alpha(theme.palette.common.white, 0.5) },
});

// Discord brand blue — intentionally hardcoded
const searchBtnSx = {
  px: 2.5,
  fontWeight: 700,
  background: 'linear-gradient(135deg, #5865f2 0%, #4752c4 100%)',
  border: '1px solid rgba(88, 101, 242, 0.5)',
  borderRadius: '8px',
  textTransform: 'none' as const,
  fontSize: '0.85rem',
  boxShadow: '0 2px 8px rgba(88, 101, 242, 0.3)',
  '&:hover': {
    background: 'linear-gradient(135deg, #4752c4 0%, #5865f2 100%)',
    boxShadow: '0 4px 12px rgba(88, 101, 242, 0.5)',
  },
  transition: (theme: Theme) => theme.transitions.create('all', { duration: 200 }),
};

const cyanBtnSx = (theme: Theme) => ({
  borderColor: alpha(theme.palette.primary.main, 0.4),
  color: theme.palette.primary.main,
  borderRadius: '8px',
  textTransform: 'none' as const,
  fontWeight: 600,
  fontSize: '0.85rem',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
  },
  transition: theme.transitions.create('all', { duration: 200 }),
});

const filterToggleSx = (active: boolean, theme: Theme) => ({
  ...cyanBtnSx(theme),
  ...(active && {
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
    borderColor: theme.palette.primary.main,
    color: theme.palette.common.white,
  }),
});

const chipSx = (theme: Theme) => ({
  borderColor: alpha(theme.palette.primary.main, 0.25),
  color: theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.primary.main, 0.06),
  backdropFilter: 'blur(4px)',
  '& .MuiChip-label': { fontWeight: 600, letterSpacing: '0.02em', fontSize: '0.8rem' },
  '& .MuiChip-icon': { color: 'inherit', fontSize: '1rem' },
});

// Category colors — intentionally hardcoded
const greenChipSx = (theme: Theme) => ({
  ...chipSx(theme),
  borderColor: 'rgba(0, 255, 136, 0.25)',
  color: scColors.success,
  backgroundColor: 'rgba(0, 255, 136, 0.06)',
});
const amberChipSx = (theme: Theme) => ({
  ...chipSx(theme),
  borderColor: 'rgba(255, 170, 0, 0.25)',
  color: scColors.warning,
  backgroundColor: 'rgba(255, 170, 0, 0.06)',
});
const purpleChipSx = (theme: Theme) => ({
  ...chipSx(theme),
  borderColor: 'rgba(167, 139, 250, 0.25)',
  color: '#a78bfa',
  backgroundColor: 'rgba(167, 139, 250, 0.06)',
});

/* ─── Segmented tab button styles ─── */
const tabBtnBase = (theme: Theme) => ({
  textTransform: 'none' as const,
  fontWeight: 700,
  fontSize: '0.85rem',
  letterSpacing: '0.03em',
  px: 3,
  py: 1.2,
  borderRadius: '12px !important',
  border: `1px solid ${alpha(theme.palette.common.white, 0.08)} !important`,
  color: alpha(theme.palette.common.white, 0.5),
  transition: theme.transitions.create('all', { duration: 250 }),
  gap: 1,
  '& .MuiButton-startIcon': { mr: 0.8 },
  '&:hover': {
    color: alpha(theme.palette.common.white, 0.85),
    backgroundColor: alpha(theme.palette.common.white, 0.06),
    borderColor: `${alpha(theme.palette.primary.main, 0.25)} !important`,
  },
});

const tabBtnActive = (theme: Theme) => ({
  ...tabBtnBase(theme),
  color: `${theme.palette.common.white} !important`,
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.18)} 0%, rgba(88, 101, 242, 0.18) 100%) !important`,
  borderColor: `${alpha(theme.palette.primary.main, 0.4)} !important`,
  boxShadow: `0 0 20px ${alpha(theme.palette.primary.main, 0.12)}, inset 0 1px 0 ${alpha(theme.palette.common.white, 0.08)}`,
  '&:hover': {
    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.25)} 0%, rgba(88, 101, 242, 0.25) 100%) !important`,
    borderColor: `${alpha(theme.palette.primary.main, 0.55)} !important`,
    boxShadow: `0 0 25px ${alpha(theme.palette.primary.main, 0.2)}, inset 0 1px 0 ${alpha(theme.palette.common.white, 0.1)}`,
  },
});

type TabKey = 'organizations' | 'alliances' | 'opportunities' | 'members';

const TAB_SEQUENCE: readonly TabKey[] = ['organizations', 'alliances', 'opportunities', 'members'];

function getDirectoryTabId(tab: TabKey): string {
  return `directory-tab-${tab}`;
}

function getDirectoryPanelId(tab: TabKey): string {
  return `directory-panel-${tab}`;
}

/**
 * UnifiedPublicDirectoriesPage - Consolidated public directory with tabs
 *
 * Features:
 * - Tab navigation between Organizations, Alliances, and Jobs
 * - Floating card design
 * - Compact search bar with filter buttons
 * - No authentication required
 */
const UnifiedPublicDirectoriesPage: React.FC = () => {
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  // Tab state - default to 'organizations' or from URL params
  const [selectedTab, setSelectedTab] = useState<TabKey>(() => {
    const param = searchParams.get('tab');
    // Backward compat: redirect old ?tab=jobs to ?tab=opportunities
    if (param === 'jobs') return 'opportunities';
    // Members tab requires authentication — handled by validTab effect
    return (param as TabKey) || 'organizations';
  });

  // Sync tab state with URL params (for browser back/forward navigation)
  const tabParam = searchParams.get('tab');
  const rawTab = (tabParam === 'jobs' ? 'opportunities' : (tabParam as TabKey)) || 'organizations';
  // Members tab requires authentication — fall back to organizations if not logged in
  const validTab = rawTab === 'members' && !isAuthenticated ? 'organizations' : rawTab;
  useEffect(() => {
    if (validTab !== selectedTab) {
      setSelectedTab(validTab);
    }
  }, [validTab, selectedTab]);

  // Update URL when tab changes
  const handleTabChange = useCallback(
    (key: React.Key | string) => {
      const newTab = key as TabKey;

      if (newTab === 'members' && !isAuthenticated) {
        setSearchParams({ tab: 'organizations' });
        setSelectedTab('organizations');
        return;
      }

      setSelectedTab(newTab);
      setSearchParams({ tab: newTab });
    },
    [isAuthenticated, setSearchParams]
  );

  const availableTabs = useMemo(
    () => TAB_SEQUENCE.filter(tab => tab !== 'members' || isAuthenticated),
    [isAuthenticated]
  );

  const tabButtonRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});

  const focusTabButton = useCallback((tab: TabKey) => {
    tabButtonRefs.current[tab]?.focus();
  }, []);

  const getSiblingTab = useCallback(
    (currentTab: TabKey, direction: 1 | -1): TabKey => {
      const currentIndex = availableTabs.indexOf(currentTab);
      if (currentIndex === -1) {
        return availableTabs[0] ?? 'organizations';
      }

      const nextIndex = (currentIndex + direction + availableTabs.length) % availableTabs.length;
      return availableTabs[nextIndex] ?? currentTab;
    },
    [availableTabs]
  );

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, tab: TabKey) => {
      if (availableTabs.length === 0) {
        return;
      }

      let nextTab: TabKey | null = null;

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          nextTab = getSiblingTab(tab, 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          nextTab = getSiblingTab(tab, -1);
          break;
        case 'Home':
          nextTab = availableTabs[0] ?? null;
          break;
        case 'End':
          nextTab = availableTabs.at(-1) ?? null;
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          handleTabChange(tab);
          return;
        default:
          return;
      }

      if (!nextTab) {
        return;
      }

      event.preventDefault();
      handleTabChange(nextTab);
      focusTabButton(nextTab);
    },
    [availableTabs, focusTabButton, getSiblingTab, handleTabChange]
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.background.default} 50%, ${theme.palette.background.paper} 100%)`,
      }}
    >
      <SEOHead
        title="Directory — Organizations, Federations & Opportunities"
        description="Browse Star Citizen organizations, federations, and job opportunities. Find your next crew, join an org, or discover trade and combat missions."
        canonical="https://fringecore.space/directory"
        keywords={[
          'directory',
          'organizations',
          'federations',
          'jobs',
          'recruitment',
          'Star Citizen orgs',
        ]}
      />
      <Box sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
        <Stack direction="column" spacing={3}>
          {/* Tab Navigation */}
          <ButtonGroup
            variant="outlined"
            role="tablist"
            aria-label="Public directory sections"
            sx={{
              gap: 1,
              flexWrap: 'wrap',
              '& .MuiButtonGroup-grouped': {
                borderRadius: '12px !important',
                minWidth: 'auto',
              },
              '& .MuiButtonGroup-grouped:not(:last-of-type)': {
                borderRight: 'none',
              },
              background: alpha(theme.palette.background.default, 0.5),
              backdropFilter: 'blur(12px)',
              border: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
              borderRadius: '16px',
              p: 0.6,
            }}
          >
            <Button
              startIcon={<BusinessIcon sx={{ fontSize: '1.1rem !important' }} />}
              onClick={() => handleTabChange('organizations')}
              role="tab"
              id={getDirectoryTabId('organizations')}
              aria-selected={selectedTab === 'organizations'}
              aria-controls={getDirectoryPanelId('organizations')}
              tabIndex={selectedTab === 'organizations' ? 0 : -1}
              onKeyDown={event => handleTabKeyDown(event, 'organizations')}
              ref={button => {
                tabButtonRefs.current.organizations = button;
              }}
              sx={{
                ...(selectedTab === 'organizations' ? tabBtnActive(theme) : tabBtnBase(theme)),
                px: { xs: 1.5, sm: 3 },
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
              }}
            >
              Organizations
            </Button>
            <Button
              startIcon={<HandshakeIcon sx={{ fontSize: '1.1rem !important' }} />}
              onClick={() => handleTabChange('alliances')}
              role="tab"
              id={getDirectoryTabId('alliances')}
              aria-selected={selectedTab === 'alliances'}
              aria-controls={getDirectoryPanelId('alliances')}
              tabIndex={selectedTab === 'alliances' ? 0 : -1}
              onKeyDown={event => handleTabKeyDown(event, 'alliances')}
              ref={button => {
                tabButtonRefs.current.alliances = button;
              }}
              sx={{
                ...(selectedTab === 'alliances' ? tabBtnActive(theme) : tabBtnBase(theme)),
                px: { xs: 1.5, sm: 3 },
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
              }}
            >
              Alliances
            </Button>
            <Button
              startIcon={<WorkIcon sx={{ fontSize: '1.1rem !important' }} />}
              onClick={() => handleTabChange('opportunities')}
              role="tab"
              id={getDirectoryTabId('opportunities')}
              aria-selected={selectedTab === 'opportunities'}
              aria-controls={getDirectoryPanelId('opportunities')}
              tabIndex={selectedTab === 'opportunities' ? 0 : -1}
              onKeyDown={event => handleTabKeyDown(event, 'opportunities')}
              ref={button => {
                tabButtonRefs.current.opportunities = button;
              }}
              sx={{
                ...(selectedTab === 'opportunities' ? tabBtnActive(theme) : tabBtnBase(theme)),
                px: { xs: 1.5, sm: 3 },
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
              }}
            >
              Jobs & Opportunities
            </Button>
            {isAuthenticated && (
              <Button
                startIcon={<PeopleIcon sx={{ fontSize: '1.1rem !important' }} />}
                onClick={() => handleTabChange('members')}
                role="tab"
                id={getDirectoryTabId('members')}
                aria-selected={selectedTab === 'members'}
                aria-controls={getDirectoryPanelId('members')}
                tabIndex={selectedTab === 'members' ? 0 : -1}
                onKeyDown={event => handleTabKeyDown(event, 'members')}
                ref={button => {
                  tabButtonRefs.current.members = button;
                }}
                sx={{
                  ...(selectedTab === 'members' ? tabBtnActive(theme) : tabBtnBase(theme)),
                  px: { xs: 1.5, sm: 3 },
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                }}
              >
                Members
              </Button>
            )}
          </ButtonGroup>

          {selectedTab === 'organizations' && (
            <Box
              role="tabpanel"
              id={getDirectoryPanelId('organizations')}
              aria-labelledby={getDirectoryTabId('organizations')}
            >
              <OrganizationsPanel />
            </Box>
          )}
          {selectedTab === 'alliances' && (
            <Box
              role="tabpanel"
              id={getDirectoryPanelId('alliances')}
              aria-labelledby={getDirectoryTabId('alliances')}
            >
              <AlliancesPanel />
            </Box>
          )}
          {selectedTab === 'opportunities' && (
            <Box
              role="tabpanel"
              id={getDirectoryPanelId('opportunities')}
              aria-labelledby={getDirectoryTabId('opportunities')}
            >
              <OpportunitiesPanel />
            </Box>
          )}
          {selectedTab === 'members' && isAuthenticated && (
            <Box
              role="tabpanel"
              id={getDirectoryPanelId('members')}
              aria-labelledby={getDirectoryTabId('members')}
            >
              <MembersPanel />
            </Box>
          )}
        </Stack>
      </Box>
    </Box>
  );
};

/**
 * Organizations Panel Component
 */
const OrganizationsPanel: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const { filters: urlFilters, updateFilters } = useUrlFilters({
    parse: parseDirectoryOrganizationsFilters,
    defaults: DIRECTORY_ORGANIZATIONS_FILTER_DEFAULTS,
    paginationKeys: ['page'] as const,
  });
  const limit = DEFAULT_PAGE_SIZE;

  // Pagination derived from URL
  const page = urlFilters.page;
  const setPage = (next: number | ((prev: number) => number)) =>
    updateFilters({ page: typeof next === 'function' ? next(page) : next });

  // Draft filter inputs (hydrated from URL on mount)
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState(urlFilters.search);
  const [selectedFocuses, setSelectedFocuses] = useState<OrgPrimaryFocus[]>(() =>
    parseDirectoryFocuses(urlFilters.focuses)
  );
  const [selectedActivityLevels, setSelectedActivityLevels] = useState<ActivityLevel[]>(() =>
    parseDirectoryActivityLevels(urlFilters.activityLevels)
  );
  const [minMemberCount, setMinMemberCount] = useState<number | undefined>(
    urlFilters.minMembers > 0 ? urlFilters.minMembers : undefined
  );
  const [maxMemberCount, setMaxMemberCount] = useState<number | undefined>(
    urlFilters.maxMembers > 0 ? urlFilters.maxMembers : undefined
  );
  const [isRecruiting, setIsRecruiting] = useState<boolean | undefined>(
    triStateToBool(urlFilters.isRecruiting)
  );
  const [isVerified, setIsVerified] = useState<boolean | undefined>(
    triStateToBool(urlFilters.isVerified)
  );

  // Sort options committed immediately to URL
  const sortBy = urlFilters.sortBy;
  const setSortBy = (v: PaginationOptions['sortBy']) =>
    updateFilters({ sortBy: (v ?? 'memberCount') as typeof urlFilters.sortBy });

  // Committed filters derived from URL
  const committedFilters = buildDirectoryQueryFilters(urlFilters);
  const committedPagination = buildDirectoryPagination(urlFilters, limit);

  // Build filters object
  // (legacy buildFilters removed; URL-derived committedFilters is canonical)

  // React Query for organizations
  const {
    data: result,
    isLoading: loading,
    error: queryError,
    refetch: refetchOrganizations,
  } = useQuery({
    queryKey: publicDirectoryKeys.orgList(
      committedFilters,
      committedPagination as unknown as Record<string, unknown>
    ),
    queryFn: () => publicDirectoryService.getDirectory(committedFilters, committedPagination),
    retry: 2,
  });

  const organizations = Array.isArray(result?.data) ? result.data : [];
  const totalPages = result?.pagination?.totalPages ?? 1;
  const total = result?.pagination?.total ?? 0;
  const orgErrorMessage = queryError instanceof Error ? queryError.message : 'Unknown error';
  const error = queryError
    ? `Failed to load organizations: ${orgErrorMessage}. Please try again.`
    : null;

  // React Query for stats
  const { data: stats } = useQuery({
    queryKey: publicDirectoryKeys.orgStats(),
    queryFn: () => publicDirectoryService.getDirectoryStats(),
  });

  // Handle search - commit current draft filters to URL
  const handleSearch = () => {
    updateFilters({
      search: searchTerm,
      focuses: selectedFocuses.join(','),
      activityLevels: selectedActivityLevels.join(','),
      minMembers: minMemberCount ?? 0,
      maxMembers: maxMemberCount ?? 0,
      isRecruiting: boolToTriState(isRecruiting),
      isVerified: boolToTriState(isVerified),
    });
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedFocuses([]);
    setSelectedActivityLevels([]);
    setMinMemberCount(undefined);
    setMaxMemberCount(undefined);
    setIsRecruiting(undefined);
    setIsVerified(undefined);
    updateFilters({
      search: '',
      focuses: '',
      activityLevels: '',
      minMembers: 0,
      maxMembers: 0,
      isRecruiting: 'all',
      isVerified: 'all',
      sortBy: 'memberCount',
      sortOrder: 'DESC',
    });
  };

  // Handle Box profile
  const handleBoxProfile = (slug: string) => {
    navigate(`/directory/${slug}`);
  };

  const fetchOrganizations = () => refetchOrganizations();

  const hasActiveFilters =
    selectedFocuses.length > 0 ||
    selectedActivityLevels.length > 0 ||
    minMemberCount !== undefined ||
    maxMemberCount !== undefined ||
    isRecruiting !== undefined ||
    isVerified !== undefined ||
    searchTerm !== '';

  // Focus options
  const focusOptions: OrgPrimaryFocus[] = [
    'combat',
    'mining',
    'trading',
    'exploration',
    'bounty_hunting',
    'medical',
    'transport',
    'salvage',
    'security',
    'social',
    'piracy',
    'racing',
    'mixed',
  ];

  // Activity level options
  const activityLevelOptions: ActivityLevel[] = [
    'inactive',
    'low',
    'moderate',
    'high',
    'very_high',
  ];

  return (
    <Stack direction="column" spacing={3} sx={{ mt: 2 }}>
      {/* Stats Summary */}
      {stats && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Chip
            icon={<BusinessIcon />}
            label={`${stats.totalOrganizations} Organizations`}
            variant="outlined"
            size="small"
            sx={chipSx(theme)}
          />
          <Chip
            icon={<GroupsIcon />}
            label={`${stats.recruitingOrganizations} Recruiting`}
            variant="outlined"
            size="small"
            sx={greenChipSx(theme)}
          />
          <Chip
            icon={<CheckCircleIcon />}
            label={`${stats.verifiedOrganizations} Verified`}
            variant="outlined"
            size="small"
            sx={amberChipSx(theme)}
          />
        </Stack>
      )}

      {/* Compact Search Bar */}
      <Box sx={searchBoxSx(theme)}>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }} alignItems="center">
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <TextField
              size="small"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search organizations..."
              fullWidth
              sx={darkFieldSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon
                        sx={{ color: alpha(theme.palette.primary.main, 0.5), fontSize: 20 }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
          </Box>

          <FormControl size="small" sx={{ minWidth: 130, ...darkSelectSx(theme) }}>
            <InputLabel id="org-sort-label">Sort</InputLabel>
            <Select
              labelId="org-sort-label"
              label="Sort"
              value={sortBy}
              onChange={e => {
                setSortBy(e.target.value);
              }}
            >
              <MenuItem value="memberCount">Members</MenuItem>
              <MenuItem value="createdAt">Created</MenuItem>
              <MenuItem value="updatedAt">Updated</MenuItem>
              <MenuItem value="activityLevel">Activity</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
              sx={searchBtnSx}
            >
              Search
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<TuneIcon />}
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Toggle Filters"
              sx={filterToggleSx(showFilters, theme)}
            >
              Filters
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={fetchOrganizations}
              sx={cyanBtnSx(theme)}
            >
              Refresh
            </Button>
            {hasActiveFilters && (
              <Button variant="outlined" size="small" onClick={clearFilters} sx={cyanBtnSx(theme)}>
                Clear
              </Button>
            )}
          </Stack>
        </Stack>

        {/* Advanced Filters */}
        {showFilters && (
          <Stack
            direction="column"
            spacing={2}
            sx={{ mt: 2, pt: 2, borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.1)}` }}
          >
            {/* Member Count Filters */}
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }} alignItems="center">
              <TextField
                label="Min Members"
                size="small"
                type="number"
                value={minMemberCount ?? ''}
                onChange={e =>
                  setMinMemberCount(e.target.value === '' ? undefined : Number(e.target.value))
                }
                slotProps={{ htmlInput: { min: 0 } }}
                sx={{ width: 160, ...darkFieldSx(theme) }}
              />
              <TextField
                label="Max Members"
                size="small"
                type="number"
                value={maxMemberCount ?? ''}
                onChange={e =>
                  setMaxMemberCount(e.target.value === '' ? undefined : Number(e.target.value))
                }
                slotProps={{ htmlInput: { min: 0 } }}
                sx={{ width: 160, ...darkFieldSx(theme) }}
              />
            </Stack>

            {/* Focus Areas */}
            <Box>
              <Typography
                sx={{
                  fontWeight: 600,
                  mb: 1,
                  color: alpha(theme.palette.common.white, 0.7),
                  fontSize: '0.85rem',
                  letterSpacing: '0.03em',
                }}
              >
                Focus Areas
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {focusOptions.map(focus => (
                  <Button
                    key={focus}
                    variant="outlined"
                    size="small"
                    sx={filterToggleSx(selectedFocuses.includes(focus), theme)}
                    onClick={() => {
                      if (selectedFocuses.includes(focus)) {
                        setSelectedFocuses(selectedFocuses.filter(f => f !== focus));
                      } else {
                        setSelectedFocuses([...selectedFocuses, focus]);
                      }
                    }}
                  >
                    {getFocusLabel(focus)}
                  </Button>
                ))}
              </Stack>
            </Box>

            {/* Activity Levels */}
            <Box>
              <Typography
                sx={{
                  fontWeight: 600,
                  mb: 1,
                  color: alpha(theme.palette.common.white, 0.7),
                  fontSize: '0.85rem',
                  letterSpacing: '0.03em',
                }}
              >
                Activity Level
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {activityLevelOptions.map(level => (
                  <Button
                    key={level}
                    variant="outlined"
                    size="small"
                    sx={filterToggleSx(selectedActivityLevels.includes(level), theme)}
                    onClick={() => {
                      if (selectedActivityLevels.includes(level)) {
                        setSelectedActivityLevels(selectedActivityLevels.filter(l => l !== level));
                      } else {
                        setSelectedActivityLevels([...selectedActivityLevels, level]);
                      }
                    }}
                  >
                    {level.replace('_', ' ')}
                  </Button>
                ))}
              </Stack>
            </Box>

            {/* Boolean Filters */}
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                sx={filterToggleSx(isRecruiting === true, theme)}
                onClick={() => setIsRecruiting(isRecruiting === true ? undefined : true)}
              >
                Recruiting Only
              </Button>
              <Button
                variant="outlined"
                size="small"
                sx={filterToggleSx(isVerified === true, theme)}
                onClick={() => setIsVerified(isVerified === true ? undefined : true)}
              >
                Verified Only
              </Button>
            </Stack>

            <Button variant="contained" size="small" onClick={handleSearch} sx={searchBtnSx}>
              Apply Filters
            </Button>
          </Stack>
        )}
      </Box>

      {/* Results Count */}
      {!loading && (
        <Typography sx={{ color: alpha(theme.palette.common.white, 0.5), fontSize: '0.85rem' }}>
          Showing {organizations.length} of {total} organizations
        </Typography>
      )}

      {/* Loading State */}
      {loading && (
        <Stack
          direction="column"
          alignItems="center"
          justifyContent="center"
          sx={{ minHeight: 240 }}
        >
          <CircularProgress aria-label="Loading..." size={40} />
          <Typography sx={{ mt: 2 }}>Loading organizations...</Typography>
        </Stack>
      )}

      {/* Error State */}
      {error && (
        <Box sx={{ bgcolor: 'error.light', p: 2, borderRadius: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography>{error}</Typography>
            <Button variant="outlined" onClick={fetchOrganizations}>
              Retry
            </Button>
          </Stack>
        </Box>
      )}

      {/* Floating Cards Grid */}
      {!loading && !error && organizations.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(auto-fill, minmax(300px, 1fr))',
            },
            alignItems: 'stretch',
          }}
        >
          {organizations.map(org => (
            <Box
              key={org.id}
              sx={{
                display: 'flex',
                borderRadius: 2,
                overflow: 'hidden',
                boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.15)}`,
                transition: theme.transitions.create(['transform', 'box-shadow'], {
                  duration: 200,
                }),
              }}
              className="floating-card"
            >
              <PublicOrgCard organization={org} onViewProfile={handleBoxProfile} />
            </Box>
          ))}
        </Box>
      )}

      {/* Empty State */}
      {!loading && !error && organizations.length === 0 && (
        <Stack
          direction="column"
          alignItems="center"
          justifyContent="center"
          sx={{ minHeight: 240 }}
        >
          <Typography variant="h6" sx={{ color: alpha(theme.palette.common.white, 0.8) }}>
            No organizations found
          </Typography>
          <Typography sx={{ color: alpha(theme.palette.common.white, 0.45) }}>
            Try adjusting your filters or search terms
          </Typography>
          <Button variant="outlined" sx={{ mt: 2, ...cyanBtnSx(theme) }} onClick={clearFilters}>
            Clear Filters
          </Button>
        </Stack>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
          <Button
            variant="outlined"
            size="small"
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            sx={cyanBtnSx(theme)}
          >
            Previous
          </Button>
          <Typography sx={{ color: alpha(theme.palette.common.white, 0.6), fontSize: '0.85rem' }}>
            Page {page} of {totalPages}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            sx={cyanBtnSx(theme)}
          >
            Next
          </Button>
        </Stack>
      )}
    </Stack>
  );
};

/**
 * Alliances Panel Component
 */
const AlliancesPanel: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Pagination state
  const [page, setPage] = useState(1);
  const limit = DEFAULT_PAGE_SIZE;

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [minMembers, setMinMembers] = useState<number | undefined>(undefined);
  const [maxMembers, setMaxMembers] = useState<number | undefined>(undefined);

  // Sort options
  const [sortBy, setSortBy] = useState<'memberCount' | 'createdAt' | 'name'>('memberCount');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Committed filters (applied on search click)
  const [committedFilters, setCommittedFilters] = useState<FederationFilters>({});

  // Build filters object
  const buildFilters = useCallback((): FederationFilters => {
    const filters: FederationFilters = {};
    if (searchTerm) filters.name = searchTerm;
    if (minMembers !== undefined) filters.minMembers = minMembers;
    if (maxMembers !== undefined) filters.maxMembers = maxMembers;
    return filters;
  }, [searchTerm, minMembers, maxMembers]);

  // React Query for federations
  const {
    data: result,
    isLoading: loading,
    error: queryError,
    refetch: refetchFederations,
  } = useQuery({
    queryKey: publicDirectoryKeys.federationList(committedFilters, {
      page,
      sortBy,
      sortOrder,
      limit,
    }),
    queryFn: () =>
      publicFederationService.getFederations(committedFilters, { page, limit, sortBy, sortOrder }),
    retry: 2,
  });

  const federations = Array.isArray(result?.data) ? result.data : [];
  const totalPages = result?.pagination?.totalPages ?? 1;
  const total = result?.pagination?.total ?? 0;
  const fedErrorMessage = queryError instanceof Error ? queryError.message : 'Unknown error';
  const error = queryError
    ? `Failed to load alliances: ${fedErrorMessage}. Please try again.`
    : null;

  // React Query for stats
  const { data: stats } = useQuery({
    queryKey: publicDirectoryKeys.federationStats(),
    queryFn: () => publicFederationService.getFederationStats(),
  });

  // Handle search - commit current filters
  const handleSearch = () => {
    setPage(1);
    setCommittedFilters(buildFilters());
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setMinMembers(undefined);
    setMaxMembers(undefined);
    setSortBy('memberCount');
    setSortOrder('DESC');
    setPage(1);
    setCommittedFilters({});
  };

  // Handle Box details
  const handleBoxDetails = (slug: string) => {
    navigate(`/directory/federations/${slug}`);
  };

  const fetchFederations = () => refetchFederations();

  const hasActiveFilters =
    searchTerm !== '' || minMembers !== undefined || maxMembers !== undefined;

  return (
    <Stack direction="column" spacing={3} sx={{ mt: 2 }}>
      {/* Stats Summary */}
      {stats && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Chip
            icon={<HandshakeIcon />}
            label={`${stats.totalFederations} Alliances`}
            variant="outlined"
            size="small"
            sx={chipSx(theme)}
          />
          <Chip
            icon={<GroupsIcon />}
            label={`${stats.totalMemberOrganizations} Members`}
            variant="outlined"
            size="small"
            sx={greenChipSx(theme)}
          />
        </Stack>
      )}

      {/* Compact Search Bar */}
      <Box sx={searchBoxSx(theme)}>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }} alignItems="center">
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <TextField
              size="small"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search alliances..."
              fullWidth
              sx={darkFieldSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon
                        sx={{ color: alpha(theme.palette.primary.main, 0.5), fontSize: 20 }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
          </Box>

          <FormControl size="small" sx={{ minWidth: 130, ...darkSelectSx(theme) }}>
            <InputLabel id="fed-sort-label">Sort</InputLabel>
            <Select
              labelId="fed-sort-label"
              label="Sort"
              value={sortBy}
              onChange={e => {
                setSortBy(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="memberCount">Members</MenuItem>
              <MenuItem value="createdAt">Created</MenuItem>
              <MenuItem value="name">Name</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
              sx={searchBtnSx}
            >
              Search
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<TuneIcon />}
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Toggle Filters"
              sx={filterToggleSx(showFilters, theme)}
            >
              Filters
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={fetchFederations}
              sx={cyanBtnSx(theme)}
            >
              Refresh
            </Button>
            {hasActiveFilters && (
              <Button variant="outlined" size="small" onClick={clearFilters} sx={cyanBtnSx(theme)}>
                Clear
              </Button>
            )}
          </Stack>
        </Stack>

        {/* Advanced Filters */}
        {showFilters && (
          <Stack
            direction="column"
            spacing={2}
            sx={{ mt: 2, pt: 2, borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.1)}` }}
          >
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }} alignItems="center">
              <TextField
                label="Min Members"
                size="small"
                type="number"
                value={minMembers ?? ''}
                onChange={e =>
                  setMinMembers(e.target.value === '' ? undefined : Number(e.target.value))
                }
                slotProps={{ htmlInput: { min: 0 } }}
                sx={{ width: 160, ...darkFieldSx(theme) }}
              />
              <TextField
                label="Max Members"
                size="small"
                type="number"
                value={maxMembers ?? ''}
                onChange={e =>
                  setMaxMembers(e.target.value === '' ? undefined : Number(e.target.value))
                }
                slotProps={{ htmlInput: { min: 0 } }}
                sx={{ width: 160, ...darkFieldSx(theme) }}
              />
            </Stack>

            <Button variant="contained" size="small" onClick={handleSearch} sx={searchBtnSx}>
              Apply Filters
            </Button>
          </Stack>
        )}
      </Box>

      {/* Results Count */}
      {!loading && (
        <Typography sx={{ color: alpha(theme.palette.common.white, 0.5), fontSize: '0.85rem' }}>
          Showing {federations.length} of {total} alliances
        </Typography>
      )}

      {/* Loading State */}
      {loading && (
        <Stack
          direction="column"
          alignItems="center"
          justifyContent="center"
          sx={{ minHeight: 240 }}
        >
          <CircularProgress aria-label="Loading..." size={40} />
          <Typography sx={{ mt: 2 }}>Loading alliances...</Typography>
        </Stack>
      )}

      {/* Error State */}
      {error && (
        <Box sx={{ bgcolor: 'error.light', p: 2, borderRadius: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography>{error}</Typography>
            <Button variant="outlined" onClick={fetchFederations}>
              Retry
            </Button>
          </Stack>
        </Box>
      )}

      {/* Floating Cards Grid */}
      {!loading && !error && federations.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(auto-fill, minmax(300px, 1fr))',
            },
            alignItems: 'stretch',
          }}
        >
          {federations.map(federation => (
            <Box
              key={federation.id}
              sx={{
                display: 'flex',
                borderRadius: 2,
                overflow: 'hidden',
                boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.15)}`,
                transition: theme.transitions.create(['transform', 'box-shadow'], {
                  duration: 200,
                }),
              }}
              className="floating-card"
            >
              <PublicFederationCard federation={federation} onViewDetails={handleBoxDetails} />
            </Box>
          ))}
        </Box>
      )}

      {/* Empty State */}
      {!loading && !error && federations.length === 0 && (
        <Stack
          direction="column"
          alignItems="center"
          justifyContent="center"
          sx={{ minHeight: 240 }}
        >
          <Typography variant="h6" sx={{ color: alpha(theme.palette.common.white, 0.8) }}>
            No alliances found
          </Typography>
          <Typography sx={{ color: alpha(theme.palette.common.white, 0.45) }}>
            Try adjusting your filters or search terms
          </Typography>
          <Button variant="outlined" sx={{ mt: 2, ...cyanBtnSx(theme) }} onClick={clearFilters}>
            Clear Filters
          </Button>
        </Stack>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
          <Button
            variant="outlined"
            size="small"
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            sx={cyanBtnSx(theme)}
          >
            Previous
          </Button>
          <Typography sx={{ color: alpha(theme.palette.common.white, 0.6), fontSize: '0.85rem' }}>
            Page {page} of {totalPages}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            sx={cyanBtnSx(theme)}
          >
            Next
          </Button>
        </Stack>
      )}

      {/* Create Alliance is only available on the authenticated /directories page */}
    </Stack>
  );
};

/* ─── Opportunities Panel ─── */
const OpportunitiesPanel: React.FC = () => {
  const theme = useTheme();

  // Pagination state
  const [page, setPage] = useState(1);
  const limit = DEFAULT_PAGE_SIZE;

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceType, setSourceType] = useState<OpportunitySourceType>('all');

  // Sort options
  const [sortBy, setSortBy] = useState('postedAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Advanced filters (Sprint 23-E)
  const [advancedFilters, setAdvancedFilters] = useState<{
    minReputationScore?: number;
    reputationTiers: string[];
    minSuccessRate?: number;
  }>({ reputationTiers: [] });

  // Build filters
  const filters: OpportunitySearchFilters = React.useMemo(() => {
    const f: OpportunitySearchFilters = {};
    if (searchTerm) f.searchTerm = searchTerm;
    if (sourceType !== 'all') f.sourceType = sourceType;
    if (advancedFilters.minReputationScore && advancedFilters.minReputationScore > 0) {
      f.minReputationScore = advancedFilters.minReputationScore;
    }
    if (advancedFilters.reputationTiers.length > 0) {
      f.reputationTiers = advancedFilters.reputationTiers;
    }
    if (advancedFilters.minSuccessRate && advancedFilters.minSuccessRate > 0) {
      f.minSuccessRate = advancedFilters.minSuccessRate;
    }
    return f;
  }, [searchTerm, sourceType, advancedFilters]);

  // Fetch opportunities via React Query
  const {
    data: result,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useOpportunitySearch(filters, page, limit, sortBy, sortOrder);

  const opportunities = Array.isArray(result?.data) ? result.data : [];
  const totalPages = result?.pagination?.totalPages ?? 1;
  const total = result?.pagination?.total ?? 0;
  const error = queryError ? 'Failed to load opportunities. Please try again.' : null;

  // Handle search
  const handleSearch = () => {
    setPage(1);
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setSourceType('all');
    setSortBy('postedAt');
    setSortOrder('DESC');
    setAdvancedFilters({ reputationTiers: [] });
    setPage(1);
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    sourceType !== 'all' ||
    (advancedFilters.minReputationScore !== undefined && advancedFilters.minReputationScore > 0) ||
    advancedFilters.reputationTiers.length > 0 ||
    (advancedFilters.minSuccessRate !== undefined && advancedFilters.minSuccessRate > 0);

  return (
    <Stack direction="column" spacing={3} sx={{ mt: 2 }}>
      {/* Source Type Toggle */}
      <ButtonGroup size="small" sx={{ alignSelf: 'flex-start' }}>
        {(['all', 'job', 'activity'] as const).map(type => (
          <Button
            key={type}
            variant={sourceType === type ? 'contained' : 'outlined'}
            onClick={() => {
              setSourceType(type);
              setPage(1);
            }}
            sx={sourceType === type ? searchBtnSx : cyanBtnSx(theme)}
          >
            {type === 'all' && (
              <>
                <SearchIcon sx={{ fontSize: 16, mr: 0.5 }} />
                All
              </>
            )}
            {type === 'job' && (
              <>
                <WorkIcon sx={{ fontSize: 16, mr: 0.5 }} />
                Jobs
              </>
            )}
            {type === 'activity' && (
              <>
                <GpsFixedIcon sx={{ fontSize: 16, mr: 0.5 }} />
                Service Offerings
              </>
            )}
          </Button>
        ))}
      </ButtonGroup>

      {/* Compact Search Bar */}
      <Box sx={searchBoxSx(theme)}>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }} alignItems="center">
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <TextField
              size="small"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search opportunities..."
              fullWidth
              sx={darkFieldSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon
                        sx={{ color: alpha(theme.palette.primary.main, 0.5), fontSize: 20 }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
          </Box>

          <FormControl size="small" sx={{ minWidth: 130, ...darkSelectSx(theme) }}>
            <InputLabel id="opp-sort-label">Sort</InputLabel>
            <Select
              labelId="opp-sort-label"
              label="Sort"
              value={sortBy}
              onChange={e => {
                setSortBy(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="postedAt">Posted</MenuItem>
              <MenuItem value="title">Title</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
              sx={searchBtnSx}
            >
              Search
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => refetch()}
              sx={cyanBtnSx(theme)}
            >
              Refresh
            </Button>
            {hasActiveFilters && (
              <Button variant="outlined" size="small" onClick={clearFilters} sx={cyanBtnSx(theme)}>
                Clear
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>

      {/* Advanced Filters */}
      <AdvancedSearchFiltersPanel filters={advancedFilters} onChange={setAdvancedFilters} />

      {/* Results Count */}
      {!loading && (
        <Typography sx={{ color: alpha(theme.palette.common.white, 0.5), fontSize: '0.85rem' }}>
          Showing {opportunities.length} of {total} opportunities
        </Typography>
      )}

      {/* Loading State */}
      {loading && (
        <Stack
          direction="column"
          alignItems="center"
          justifyContent="center"
          sx={{ minHeight: 240 }}
        >
          <CircularProgress aria-label="Loading..." size={40} />
          <Typography sx={{ mt: 2 }}>Loading opportunities...</Typography>
        </Stack>
      )}

      {/* Error State */}
      {error && (
        <Box sx={{ bgcolor: 'error.light', p: 2, borderRadius: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography>{error}</Typography>
            <Button variant="outlined" onClick={() => refetch()}>
              Retry
            </Button>
          </Stack>
        </Box>
      )}

      {/* Cards Grid */}
      {!loading && !error && opportunities.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(auto-fill, minmax(300px, 1fr))',
            },
            alignItems: 'stretch',
          }}
        >
          {opportunities.map(item => (
            <Box
              key={`${item.sourceType}-${item.id}`}
              onClick={() => {
                if (item.sourceType === 'job') {
                  globalThis.open(`/directory/jobs/${item.id}`, '_blank');
                } else {
                  globalThis.open(`/activities/${item.id}`, '_blank');
                }
              }}
              sx={{
                boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.15)}`,
                transition: theme.transitions.create(['transform', 'box-shadow'], {
                  duration: 200,
                }),
                display: 'flex',
                borderRadius: 2,
                overflow: 'hidden',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                backgroundColor: alpha(theme.palette.background.paper, 0.5),
                backdropFilter: 'blur(8px)',
                flexDirection: 'column',
                height: '100%',
                p: 2,
                cursor: 'pointer',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.25)}`,
                },
              }}
              className="floating-card"
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Chip
                  label={item.sourceType === 'job' ? 'Job' : 'Activity'}
                  size="small"
                  sx={item.sourceType === 'job' ? greenChipSx(theme) : purpleChipSx(theme)}
                />
                {item.organizationName && (
                  <Typography
                    variant="caption"
                    sx={{ color: alpha(theme.palette.common.white, 0.5) }}
                  >
                    {item.organizationName}
                  </Typography>
                )}
              </Stack>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  color: theme.palette.common.white,
                  mb: 0.5,
                  lineHeight: 1.3,
                }}
              >
                {item.title}
              </Typography>
              {item.description && (
                <Typography
                  variant="body2"
                  sx={{
                    color: alpha(theme.palette.common.white, 0.6),
                    mb: 1.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {item.description}
                </Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 'auto', flexWrap: 'wrap', gap: 0.5 }}>
                {item.jobType && (
                  <Chip label={item.jobType} size="small" variant="outlined" sx={chipSx(theme)} />
                )}
                {item.activityType && (
                  <Chip
                    label={item.activityType}
                    size="small"
                    variant="outlined"
                    sx={chipSx(theme)}
                  />
                )}
                {item.payDisplay && (
                  <Chip
                    label={item.payDisplay}
                    size="small"
                    variant="outlined"
                    sx={amberChipSx(theme)}
                  />
                )}
                {item.location && (
                  <Chip label={item.location} size="small" variant="outlined" sx={chipSx(theme)} />
                )}
              </Stack>
              {item.postedAt && (
                <Typography
                  variant="caption"
                  sx={{ color: alpha(theme.palette.common.white, 0.35), mt: 1 }}
                >
                  Posted {new Date(item.postedAt).toLocaleDateString()}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Empty State */}
      {!loading && !error && opportunities.length === 0 && (
        <Stack
          direction="column"
          alignItems="center"
          justifyContent="center"
          sx={{ minHeight: 240 }}
        >
          <Typography variant="h6" sx={{ color: alpha(theme.palette.common.white, 0.8) }}>
            No opportunities found
          </Typography>
          <Typography sx={{ color: alpha(theme.palette.common.white, 0.45) }}>
            {hasActiveFilters
              ? 'Try adjusting your filters or search terms'
              : 'No opportunities available at this time'}
          </Typography>
          {hasActiveFilters && (
            <Button variant="outlined" sx={{ mt: 2, ...cyanBtnSx(theme) }} onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </Stack>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
          <Button
            variant="outlined"
            size="small"
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            sx={cyanBtnSx(theme)}
          >
            Previous
          </Button>
          <Typography sx={{ color: alpha(theme.palette.common.white, 0.6), fontSize: '0.85rem' }}>
            Page {page} of {totalPages}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            sx={cyanBtnSx(theme)}
          >
            Next
          </Button>
        </Stack>
      )}
    </Stack>
  );
};

export const UnifiedPublicDirectoriesPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Public Directories"
    fallbackMessage="Unable to load public directories. Please try again later."
    showHomeButton={true}
  >
    <UnifiedPublicDirectoriesPage />
  </FeatureErrorBoundary>
);

// Export panels for use in authenticated DirectoriesPage
export { AlliancesPanel, OpportunitiesPanel, OrganizationsPanel };

// Members panel — imported from standalone component (needs auth)
export { CommunityMembersPanel as MembersPanel } from '@/components/directories/CommunityMembersPanel';
