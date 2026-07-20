/**
 * CommunityMembersPanel — Browse community members with public profiles.
 *
 * Follows OrganizationsPanel pattern: search bar + sort + pagination + card grid.
 * Uses PublicUserCard for rendering. Loading uses skeleton cards (per N-3).
 * Shows result count indicator (per N-5).
 */

import { PublicUserCard, type PublicUserInfo } from '@/components/PublicUserCard';
import { useCommunityMembers } from '@/hooks/queries/useUserQueries';
import { logger } from '@/utils/logger';
import {
  CheckCircle as CheckCircleIcon,
  FilterList as FilterListIcon,
  Groups as OrgIcon,
  People as PeopleIcon,
  Search as SearchIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  InputAdornment,
  MenuItem,
  Pagination,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/** Skeleton card placeholder matching PublicUserCard dimensions */
const MemberCardSkeleton: React.FC = () => (
  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
    <Stack direction="row" spacing={2} alignItems="center" mb={1.5}>
      <Skeleton variant="circular" width={48} height={48} />
      <Stack flex={1}>
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="text" width="40%" height={18} />
      </Stack>
    </Stack>
    <Stack direction="row" spacing={0.5} mb={1}>
      <Skeleton variant="rounded" width={90} height={24} />
      <Skeleton variant="rounded" width={80} height={24} />
    </Stack>
    <Skeleton variant="text" width="90%" />
    <Skeleton variant="text" width="70%" />
    <Skeleton variant="rounded" width="100%" height={32} sx={{ mt: 1 }} />
    <Stack direction="row" spacing={1} mt={1.5}>
      <Skeleton variant="text" width={60} />
      <Skeleton variant="text" width={80} />
    </Stack>
  </Box>
);

export const CommunityMembersPanel: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'createdAt' | 'username'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [rsiVerifiedOnly, setRsiVerifiedOnly] = useState(false);
  const [hasOrganization, setHasOrganization] = useState(false);

  // Debounce search input
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();
  React.useEffect(() => () => clearTimeout(debounceRef.current), []);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  };

  const { data, isLoading, error, refetch } = useCommunityMembers({
    search: debouncedSearch || undefined,
    page,
    limit: 20,
    sortBy,
    sortOrder,
    rsiVerifiedOnly: rsiVerifiedOnly || undefined,
    hasOrganization: hasOrganization || undefined,
  });

  const members = data?.data ?? [];
  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  const handleViewProfile = (user: PublicUserInfo) => {
    navigate(`/profile/${user.username}`);
  };

  const handleSortChange = (newSortBy: 'createdAt' | 'username') => {
    if (newSortBy === sortBy) {
      setSortOrder(prev => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(newSortBy);
      setSortOrder(newSortBy === 'username' ? 'ASC' : 'DESC');
    }
    setPage(1);
  };

  return (
    <Stack spacing={3}>
      {/* Search + Sort + Filters */}
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            placeholder="Search by name, username, or RSI handle..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            value={sortBy}
            onChange={e => handleSortChange(e.target.value as 'createdAt' | 'username')}
            size="small"
            sx={{ minWidth: 180 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SortIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                  </InputAdornment>
                ),
              },
            }}
          >
            <MenuItem value="createdAt">Newest First</MenuItem>
            <MenuItem value="username">Username A-Z</MenuItem>
          </TextField>
        </Stack>

        {/* Filter Chips */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <FilterListIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
            label="RSI Verified"
            size="small"
            clickable
            onClick={() => {
              setRsiVerifiedOnly(prev => !prev);
              setPage(1);
            }}
            sx={{
              fontWeight: 600,
              fontSize: '0.78rem',
              bgcolor: rsiVerifiedOnly
                ? alpha(theme.palette.success.main, 0.15)
                : alpha(theme.palette.common.white, 0.06),
              color: rsiVerifiedOnly ? theme.palette.success.light : theme.palette.text.secondary,
              border: `1px solid ${
                rsiVerifiedOnly
                  ? alpha(theme.palette.success.light, 0.4)
                  : alpha(theme.palette.common.white, 0.12)
              }`,
              '&:hover': {
                bgcolor: rsiVerifiedOnly
                  ? alpha(theme.palette.success.main, 0.22)
                  : alpha(theme.palette.common.white, 0.1),
              },
            }}
          />
          <Chip
            icon={<OrgIcon sx={{ fontSize: 14 }} />}
            label="Has Organization"
            size="small"
            clickable
            onClick={() => {
              setHasOrganization(prev => !prev);
              setPage(1);
            }}
            sx={{
              fontWeight: 600,
              fontSize: '0.78rem',
              bgcolor: hasOrganization
                ? alpha(theme.palette.primary.main, 0.15)
                : alpha(theme.palette.common.white, 0.06),
              color: hasOrganization ? theme.palette.primary.light : theme.palette.text.secondary,
              border: `1px solid ${
                hasOrganization
                  ? alpha(theme.palette.primary.light, 0.4)
                  : alpha(theme.palette.common.white, 0.12)
              }`,
              '&:hover': {
                bgcolor: hasOrganization
                  ? alpha(theme.palette.primary.main, 0.22)
                  : alpha(theme.palette.common.white, 0.1),
              },
            }}
          />
          {(rsiVerifiedOnly || hasOrganization || debouncedSearch) && (
            <Chip
              label="Clear All"
              size="small"
              clickable
              onClick={() => {
                setSearch('');
                setDebouncedSearch('');
                setRsiVerifiedOnly(false);
                setHasOrganization(false);
                setPage(1);
              }}
              onDelete={() => {
                setSearch('');
                setDebouncedSearch('');
                setRsiVerifiedOnly(false);
                setHasOrganization(false);
                setPage(1);
              }}
              sx={{
                fontWeight: 500,
                fontSize: '0.75rem',
                bgcolor: alpha(theme.palette.error.main, 0.08),
                color: theme.palette.error.light,
                border: `1px solid ${alpha(theme.palette.error.light, 0.2)}`,
              }}
            />
          )}
          {/* Result Count — inline with filters */}
          {!isLoading && total > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total.toLocaleString()}{' '}
              members
            </Typography>
          )}
        </Stack>
      </Stack>

      {/* Error State */}
      {error && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                refetch().catch(err =>
                  logger.error(
                    'Failed to refetch community members',
                    err instanceof Error ? err : new Error(String(err))
                  )
                );
              }}
            >
              Retry
            </Button>
          }
        >
          Failed to load community members
        </Alert>
      )}

      {/* Loading: Skeleton Cards */}
      {isLoading && (
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <MemberCardSkeleton />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Members Grid */}
      {!isLoading && members.length > 0 && (
        <Grid container spacing={2}>
          {members.map(member => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={member.id}>
              <PublicUserCard user={member} onViewProfile={() => handleViewProfile(member)} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Empty State */}
      {!isLoading && !error && members.length === 0 && (
        <Box
          sx={{
            textAlign: 'center',
            py: 6,
            color: 'text.secondary',
          }}
        >
          <PeopleIcon sx={{ fontSize: 48, mb: 1, color: theme.palette.text.disabled }} />
          <Typography variant="h6" gutterBottom>
            No members found
          </Typography>
          <Typography variant="body2">
            {debouncedSearch || rsiVerifiedOnly || hasOrganization
              ? 'Try adjusting your search or filters'
              : 'No community members have public profiles yet'}
          </Typography>
          {(debouncedSearch || rsiVerifiedOnly || hasOrganization) && (
            <Button
              variant="text"
              size="small"
              sx={{ mt: 1 }}
              onClick={() => {
                setSearch('');
                setDebouncedSearch('');
                setRsiVerifiedOnly(false);
                setHasOrganization(false);
              }}
            >
              Clear all filters
            </Button>
          )}
        </Box>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, newPage) => setPage(newPage)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Stack>
  );
};
