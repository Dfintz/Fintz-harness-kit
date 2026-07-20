import { ErrorMessage } from '@/components/ErrorMessage';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { Grid } from '@/components/ui/Grid';
import { IconButton } from '@/components/ui/IconButton';
import { Item } from '@/components/ui/Item';
import { Select } from '@/components/ui/Select';
import {
  useHunterAnalytics,
  useHunterHistory,
  useHunterLeaderboard,
  useHunterProfile,
} from '@/hooks/queries/useHunterQueries';
import { isApiClientError } from '@/services/apiClient';
import {
  BountyClaimStatus,
  BountyType,
  HunterRank,
  type HunterAnalyticsSummaryData,
  type HunterBountyHistoryEntryData,
  type HunterLeaderboardEntryData,
  type HunterProfileData,
} from '@/services/bountyService';
import { Refresh as RefreshIcon, Groups as UserGroup } from '@mui/icons-material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import BarChartIcon from '@mui/icons-material/BarChart';
import BlockIcon from '@mui/icons-material/Block';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DangerousIcon from '@mui/icons-material/Dangerous';
import DiamondIcon from '@mui/icons-material/Diamond';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import FiberNewIcon from '@mui/icons-material/FiberNew';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HistoryIcon from '@mui/icons-material/History';
import InventoryIcon from '@mui/icons-material/Inventory';
import LinkIcon from '@mui/icons-material/Link';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import PersonIcon from '@mui/icons-material/Person';
import PublishIcon from '@mui/icons-material/Publish';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import SearchIcon from '@mui/icons-material/Search';
import SosIcon from '@mui/icons-material/Sos';
import StarIcon from '@mui/icons-material/Star';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Alert, Box, Chip, LinearProgress, Stack, Tab, Tabs, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';

import { scColors } from '@/components/ui/tokens';

interface HunterProfilePageProps {
  organizationId?: string;
  userId?: string;
}

/**
 * Get rank emoji
 */
function getRankIcon(rank: HunterRank): React.ReactElement {
  const sx = { fontSize: 'inherit' };
  switch (rank) {
    case HunterRank.LEGENDARY:
      return <EmojiEventsIcon sx={{ ...sx, color: 'gold' }} />;
    case HunterRank.ELITE:
      return <DiamondIcon sx={{ ...sx, color: 'info.light' }} />;
    case HunterRank.VETERAN:
      return <StarIcon sx={{ ...sx, color: 'warning.main' }} />;
    case HunterRank.HUNTER:
      return <GpsFixedIcon sx={sx} />;
    case HunterRank.APPRENTICE:
      return <VerifiedIcon sx={{ ...sx, color: 'success.main' }} />;
    case HunterRank.ROOKIE:
    default:
      return <FiberNewIcon sx={sx} />;
  }
}

/**
 * Get rank badge variant
 */
function getRankBadgeVariant(
  rank: HunterRank
): 'positive' | 'negative' | 'notice' | 'informative' | 'neutral' {
  switch (rank) {
    case HunterRank.LEGENDARY:
      return 'positive';
    case HunterRank.ELITE:
      return 'positive';
    case HunterRank.VETERAN:
      return 'informative';
    case HunterRank.HUNTER:
      return 'notice';
    case HunterRank.APPRENTICE:
      return 'neutral';
    default:
      return 'neutral';
  }
}

/**
 * Get podium medal or rank number for leaderboard position
 */
function getMedalForIndex(index: number): React.ReactElement | string {
  const sx = { fontSize: 20 };
  if (index === 0) return <EmojiEventsIcon sx={{ ...sx, color: scColors.gold }} />;
  if (index === 1) return <EmojiEventsIcon sx={{ ...sx, color: scColors.silver }} />;
  if (index === 2) return <EmojiEventsIcon sx={{ ...sx, color: scColors.bronze }} />;
  return `#${index + 1}`;
}

/**
 * Get bounty type emoji
 */
function getBountyTypeIcon(type: BountyType): React.ReactElement {
  const sx = { fontSize: 'inherit' };
  switch (type) {
    case BountyType.KILL:
      return <DangerousIcon sx={sx} />;
    case BountyType.CAPTURE:
      return <LinkIcon sx={sx} />;
    case BountyType.INTEL:
      return <SearchIcon sx={sx} />;
    case BountyType.TRANSPORT:
      return <InventoryIcon sx={sx} />;
    case BountyType.RESCUE:
      return <SosIcon sx={sx} />;
    case BountyType.CUSTOM:
      return <StarIcon sx={sx} />;
    default:
      return <GpsFixedIcon sx={sx} />;
  }
}

/**
 * Get claim status emoji
 */
function getClaimStatusIcon(status: BountyClaimStatus): React.ReactElement {
  const sx = { fontSize: 'inherit' };
  switch (status) {
    case BountyClaimStatus.COMPLETED:
      return <CheckCircleIcon sx={{ ...sx, color: 'success.main' }} />;
    case BountyClaimStatus.SUBMITTED:
      return <PublishIcon sx={sx} />;
    case BountyClaimStatus.ACTIVE:
      return <RadioButtonCheckedIcon sx={{ ...sx, color: 'warning.main' }} />;
    case BountyClaimStatus.ABANDONED:
      return <BlockIcon sx={sx} />;
    case BountyClaimStatus.REJECTED:
      return <CancelIcon sx={{ ...sx, color: 'error.main' }} />;
    default:
      return <HelpOutlineIcon sx={sx} />;
  }
}

/**
 * Format currency
 */
function formatCurrency(amount?: number): string {
  if (amount == null) return 'Negotiable';
  return `${amount.toLocaleString()} aUEC`;
}

/**
 * Format time duration
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

/**
 * Profile Stats Card Component
 */
const ProfileStatsCard: React.FC<{ profile: HunterProfileData }> = ({ profile }) => {
  return (
    <Box sx={{ borderRadius: 1, p: 2 }}>
      <Grid columns={['1fr', '1fr', '1fr', '1fr']} gap={2}>
        <Stack direction="column" alignItems="center">
          <Typography
            sx={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'primary.main',
            }}
          >
            {profile.totalBountiesCompleted}
          </Typography>
          <Stack alignItems="center" gap={0.5}>
            <GpsFixedIcon fontSize="small" />
            <Typography>Completed</Typography>
          </Stack>
        </Stack>
        <Stack direction="column" alignItems="center">
          <Typography
            sx={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'success.main',
            }}
          >
            {profile.successRate}%
          </Typography>
          <Stack alignItems="center" gap={0.5}>
            <TrendingUpIcon fontSize="small" />
            <Typography>Success Rate</Typography>
          </Stack>
        </Stack>
        <Stack direction="column" alignItems="center">
          <Typography
            sx={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'warning.main',
            }}
          >
            {formatCurrency(profile.totalRewardsEarned)}
          </Typography>
          <Stack alignItems="center" gap={0.5}>
            <AttachMoneyIcon fontSize="small" />
            <Typography>Total Earned</Typography>
          </Stack>
        </Stack>
        <Stack direction="column" alignItems="center">
          <Typography
            sx={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'secondary.main',
            }}
          >
            {profile.reputationScore}
          </Typography>
          <Typography>Reputation</Typography>
        </Stack>
      </Grid>
    </Box>
  );
};

/**
 * Specialization Chart Component
 */
const SpecializationChart: React.FC<{ profile: HunterProfileData }> = ({ profile }) => {
  const specializations: Array<{
    type: string;
    icon: React.ReactElement;
    count: number;
    color: string;
  }> = [
    {
      type: 'Kill',
      icon: <DangerousIcon sx={{ fontSize: 'inherit' }} />,
      count: profile.killBountiesCompleted,
      color: 'error.main',
    },
    {
      type: 'Capture',
      icon: <LinkIcon sx={{ fontSize: 'inherit' }} />,
      count: profile.captureBountiesCompleted,
      color: 'warning.main',
    },
    {
      type: 'Intel',
      icon: <SearchIcon sx={{ fontSize: 'inherit' }} />,
      count: profile.intelBountiesCompleted,
      color: 'primary.main',
    },
    {
      type: 'Transport',
      icon: <InventoryIcon sx={{ fontSize: 'inherit' }} />,
      count: profile.transportBountiesCompleted,
      color: 'success.main',
    },
    {
      type: 'Rescue',
      icon: <SosIcon sx={{ fontSize: 'inherit' }} />,
      count: profile.rescueBountiesCompleted,
      color: 'info.light',
    },
    {
      type: 'Custom',
      icon: <StarIcon sx={{ fontSize: 'inherit' }} />,
      count: profile.customBountiesCompleted,
      color: 'secondary.main',
    },
  ];

  const totalCompleted = profile.totalBountiesCompleted || 1;

  return (
    <Box sx={{ borderRadius: 1, p: 2 }}>
      <Typography variant="h4">
        <MilitaryTechIcon sx={{ fontSize: 22, mr: 0.5, verticalAlign: 'middle' }} /> Specializations
      </Typography>
      <Stack direction="column" gap={1} sx={{ mt: 2 }}>
        {specializations.map(spec => (
          <Stack key={spec.type} direction="column" gap={0.5}>
            <Stack justifyContent="space-between">
              <Typography>
                {spec.icon} {spec.type}
              </Typography>
              <Typography>{spec.count}</Typography>
            </Stack>
            <Box sx={{ width: '100%' }}>
              <LinearProgress
                variant="determinate"
                value={(spec.count / totalCompleted) * 100}
                aria-label={`${spec.type} progress`}
                sx={{
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: spec.color,
                  },
                }}
              />
            </Box>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
};

/**
 * Leaderboard Component
 */
const LeaderboardCard: React.FC<{
  leaderboard: HunterLeaderboardEntryData[];
  sortBy: string;
  onSortChange: (sort: string) => void;
  loading?: boolean;
}> = ({ leaderboard, sortBy, onSortChange, loading }) => {
  if (loading) {
    return (
      <Box sx={{ borderRadius: 1, p: 2 }}>
        <LoadingSpinner message="Loading leaderboard..." />
      </Box>
    );
  }

  return (
    <Box sx={{ borderRadius: 1, p: 2 }}>
      <Stack justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">
          <EmojiEventsIcon sx={{ fontSize: 22, mr: 0.5, verticalAlign: 'middle' }} /> Hunter
          Leaderboard
        </Typography>
        <Select label="Sort by" value={sortBy} onChange={key => onSortChange(key as string)}>
          <Item key="completed">
            <GpsFixedIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Bounties
            Completed
          </Item>
          <Item key="rewards">
            <AttachMoneyIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Rewards
            Earned
          </Item>
          <Item key="successRate">
            <BarChartIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Success Rate
          </Item>
          <Item key="reputation">
            <StarIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Reputation
          </Item>
        </Select>
      </Stack>

      {leaderboard.length === 0 ? (
        <Typography>No hunters found. Complete some bounties to appear here!</Typography>
      ) : (
        <Stack direction="column" gap={1}>
          {leaderboard.map((hunter, index) => {
            const medal = getMedalForIndex(index);
            const rankIcon = getRankIcon(hunter.rank);

            return (
              <Box key={hunter.userId} sx={{ borderRadius: 1, p: 2, padding: '12px' }}>
                <Grid columns={['auto', '1fr', 'auto', 'auto', 'auto']} gap={2} alignItems="center">
                  <Typography sx={{ fontSize: '20px', minWidth: '40px', textAlign: 'center' }}>
                    {medal}
                  </Typography>
                  <Stack direction="column">
                    <Typography sx={{ fontWeight: 'bold' }}>
                      {hunter.userName || 'Unknown Hunter'}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '12px',
                        color: 'text.secondary',
                      }}
                    >
                      {rankIcon} {hunter.rank.toUpperCase()}
                    </Typography>
                  </Stack>
                  <Stack direction="column" alignItems="center">
                    <Typography sx={{ fontWeight: 'bold' }}>
                      {hunter.totalBountiesCompleted}
                    </Typography>
                    <Typography sx={{ fontSize: '11px' }}>Completed</Typography>
                  </Stack>
                  <Stack direction="column" alignItems="center">
                    <Typography sx={{ fontWeight: 'bold' }}>{hunter.successRate}%</Typography>
                    <Typography sx={{ fontSize: '11px' }}>Success</Typography>
                  </Stack>
                  <Stack direction="column" alignItems="center">
                    <Typography sx={{ fontWeight: 'bold' }}>
                      {hunter.totalRewardsEarned.toLocaleString()}
                    </Typography>
                    <Typography sx={{ fontSize: '11px' }}>aUEC</Typography>
                  </Stack>
                </Grid>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

/**
 * Bounty History Component
 */
const BountyHistoryCard: React.FC<{
  history: HunterBountyHistoryEntryData[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}> = ({ history, page, totalPages, onPageChange, loading }) => {
  if (loading) {
    return (
      <Box sx={{ borderRadius: 1, p: 2 }}>
        <LoadingSpinner message="Loading history..." />
      </Box>
    );
  }

  return (
    <Box sx={{ borderRadius: 1, p: 2 }}>
      <Typography variant="h4">
        <HistoryIcon sx={{ fontSize: 22, mr: 0.5, verticalAlign: 'middle' }} /> Bounty History
      </Typography>

      {history.length === 0 ? (
        <Typography sx={{ mt: 2 }}>No bounty history yet. Start hunting!</Typography>
      ) : (
        <>
          <Stack direction="column" gap={1} sx={{ mt: 2 }}>
            {history.map(entry => {
              const statusIcon = getClaimStatusIcon(entry.status);
              const typeIcon = getBountyTypeIcon(entry.bountyType);

              return (
                <Box key={entry.bountyId} sx={{ borderRadius: 1, p: 2, padding: '10px' }}>
                  <Grid columns={['auto', '1fr', 'auto', 'auto']} gap={1.5} alignItems="center">
                    <Box sx={{ fontSize: '20px', display: 'flex', alignItems: 'center' }}>
                      {typeIcon}
                    </Box>
                    <Stack direction="column">
                      <Typography sx={{ fontWeight: 'bold' }}>{entry.bountyTitle}</Typography>
                      <Typography
                        sx={{
                          fontSize: '12px',
                          color: 'text.secondary',
                        }}
                      >
                        Claimed: {new Date(entry.claimedAt).toLocaleDateString()}
                        {entry.completedAt &&
                          ` • Completed: ${new Date(entry.completedAt).toLocaleDateString()}`}
                      </Typography>
                    </Stack>
                    <Chip
                      label={
                        <>
                          {statusIcon} {entry.status}
                        </>
                      }
                      color={entry.status === BountyClaimStatus.COMPLETED ? 'success' : 'default'}
                      size="small"
                    />
                    <Typography sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(entry.rewardAmount)}
                    </Typography>
                  </Grid>
                </Box>
              );
            })}
          </Stack>

          {totalPages > 1 && (
            <Stack justifyContent="center" gap={1} sx={{ mt: 2 }}>
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </Button>
              <Typography sx={{ alignSelf: 'center' }}>
                Page {page} of {totalPages}
              </Typography>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </Stack>
          )}
        </>
      )}
    </Box>
  );
};

/**
 * Analytics Dashboard Component
 */
const AnalyticsDashboard: React.FC<{
  analytics?: HunterAnalyticsSummaryData;
  loading?: boolean;
}> = ({ analytics, loading }) => {
  if (loading) {
    return (
      <Box sx={{ borderRadius: 1, p: 2 }}>
        <LoadingSpinner message="Loading analytics..." />
      </Box>
    );
  }

  if (!analytics) {
    return null;
  }

  return (
    <Box>
      <Typography variant="h3">
        <BarChartIcon sx={{ fontSize: 24, mr: 0.5, verticalAlign: 'middle' }} /> Bounty Analytics
      </Typography>

      <Grid columns={['1fr', '1fr', '1fr', '1fr']} gap={2} sx={{ mt: 2 }}>
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Stack direction="column" alignItems="center">
            <UserGroup fontSize="large" />
            <Typography sx={{ fontSize: '24px', fontWeight: 'bold' }}>
              {analytics.totalHunters}
            </Typography>
            <Typography>Total Hunters</Typography>
            <Typography sx={{ fontSize: '12px', color: 'success.main' }}>
              {analytics.activeHunters} active
            </Typography>
          </Stack>
        </Box>
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Stack direction="column" alignItems="center">
            <GpsFixedIcon fontSize="large" />
            <Typography sx={{ fontSize: '24px', fontWeight: 'bold' }}>
              {analytics.totalBountiesCompleted}
            </Typography>
            <Typography>Bounties Completed</Typography>
          </Stack>
        </Box>
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Stack direction="column" alignItems="center">
            <AttachMoneyIcon fontSize="large" />
            <Typography sx={{ fontSize: '24px', fontWeight: 'bold' }}>
              {analytics.totalRewardsPaid.toLocaleString()}
            </Typography>
            <Typography>aUEC Paid Out</Typography>
          </Stack>
        </Box>
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Stack direction="column" alignItems="center">
            <TrendingUpIcon fontSize="large" />
            <Typography sx={{ fontSize: '24px', fontWeight: 'bold' }}>
              {analytics.averageSuccessRate}%
            </Typography>
            <Typography>Avg Success Rate</Typography>
          </Stack>
        </Box>
      </Grid>

      <Grid columns={['1fr', '1fr']} gap={2} sx={{ mt: 2 }}>
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Typography variant="h4">
            <TrendingUpIcon sx={{ fontSize: 22, mr: 0.5, verticalAlign: 'middle' }} /> Bounty Type
            Distribution
          </Typography>
          <Stack direction="column" gap={1} sx={{ mt: 2 }}>
            {Object.entries(analytics.bountyTypeBreakdown).map(([type, count]) => (
              <Stack key={type} justifyContent="space-between" alignItems="center">
                <Typography>
                  {getBountyTypeIcon(type as BountyType)}{' '}
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Typography>
                <Chip label={String(count)} color="info" size="small" />
              </Stack>
            ))}
          </Stack>
        </Box>
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Typography variant="h4">
            <EmojiEventsIcon sx={{ fontSize: 22, mr: 0.5, verticalAlign: 'middle' }} /> Top Hunters
          </Typography>
          <Stack direction="column" gap={0.5} sx={{ mt: 2 }}>
            {analytics.topHunters.slice(0, 5).map((hunter, index) => {
              const medal = getMedalForIndex(index);
              return (
                <Stack key={hunter.userId} justifyContent="space-between" alignItems="center">
                  <Typography>
                    {medal} {hunter.userName || 'Unknown'}
                  </Typography>
                  <Typography sx={{ fontWeight: 'bold' }}>
                    {hunter.totalBountiesCompleted} bounties
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      </Grid>
    </Box>
  );
};

/**
 * Main Hunter Profile Page Component
 */
const HunterProfilePage: React.FC<HunterProfilePageProps> = ({
  organizationId: _propOrgId,
  userId: propUserId,
}) => {
  // Get userId from URL params if not provided via props
  const { userId: urlUserId } = useParams<{ userId?: string }>();
  const userId = propUserId || urlUserId;

  const [selectedTab, setSelectedTab] = useState<React.Key>('profile');
  const [leaderboardSort, setLeaderboardSort] = useState<string>('completed');
  const [historyPage, setHistoryPage] = useState(1);

  // React Query hooks for hunter data
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useHunterProfile(userId);

  const {
    data: leaderboard,
    isLoading: leaderboardLoading,
    refetch: refetchLeaderboard,
  } = useHunterLeaderboard(
    leaderboardSort as 'completed' | 'rewards' | 'successRate' | 'reputation'
  );

  const {
    data: historyData,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useHunterHistory(userId, historyPage);

  const {
    data: analytics,
    isLoading: analyticsLoading,
    refetch: refetchAnalytics,
  } = useHunterAnalytics();

  const loading = profileLoading;
  const errorMessage = (() => {
    if (!profileError) return '';
    if (isApiClientError(profileError)) {
      if (profileError.statusCode === 400 && profileError.message?.includes('organization')) {
        return 'No active organization selected. Please select an organization to view your hunter profile.';
      }
      return profileError.message || 'Failed to load hunter profile';
    }
    return profileError instanceof Error ? profileError.message : 'Failed to load hunter profile';
  })();

  const handleRefresh = () => {
    refetchProfile();
    refetchLeaderboard();
    refetchHistory();
    refetchAnalytics();
  };

  if (loading && !profile && !profileError) {
    return (
      <Box sx={{ p: 4 }}>
        <LoadingSpinner message="Loading hunter profile..." />
      </Box>
    );
  }

  if (profileError && !profile) {
    return (
      <Box sx={{ p: 4 }}>
        <PageHeader
          title="Hunter Profile"
          description="View your bounty hunting stats and climb the leaderboard"
        />
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={
            <Button variant="ghost" size="sm" onClick={() => refetchProfile()}>
              Retry
            </Button>
          }
        >
          {errorMessage}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <PageHeader
        title="Hunter Profile"
        description="View your bounty hunting stats and climb the leaderboard"
      />

      <Stack justifyContent="flex-end" sx={{ mb: 3 }}>
        <IconButton onClick={handleRefresh} aria-label="Refresh data">
          <RefreshIcon />
        </IconButton>
      </Stack>

      {errorMessage && <ErrorMessage message={errorMessage} />}

      {profile && (
        <Box sx={{ mb: 3 }}>
          <Stack alignItems="center" gap={2} sx={{ mb: 2 }}>
            <Typography variant="h2">{profile.userName || 'Unknown Hunter'}</Typography>
            <Chip
              label={
                <>
                  {getRankIcon(profile.rank)} {profile.rank.toUpperCase()}
                </>
              }
              color={getRankBadgeVariant(profile.rank) === 'positive' ? 'success' : 'default'}
              size="small"
            />
          </Stack>
          <ProfileStatsCard profile={profile} />
        </Box>
      )}

      <Tabs
        value={selectedTab}
        onChange={(_e: React.SyntheticEvent, val: string) => setSelectedTab(val)}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          label="Profile"
          value="profile"
          icon={<PersonIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
        />
        <Tab
          label="History"
          value="history"
          icon={<HistoryIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
        />
        <Tab
          label="Leaderboard"
          value="leaderboard"
          icon={<EmojiEventsIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
        />
        <Tab
          label="Analytics"
          value="analytics"
          icon={<BarChartIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
        />
      </Tabs>

      {selectedTab === 'profile' && (
        <Box sx={{ mt: 2 }}>
          {profile && (
            <Grid columns={['1fr', '1fr']} gap={2}>
              <SpecializationChart profile={profile} />
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Typography variant="h4">
                  <TrendingUpIcon sx={{ fontSize: 22, mr: 0.5, verticalAlign: 'middle' }} />{' '}
                  Activity Stats
                </Typography>
                <Grid columns={['1fr', '1fr']} gap={2} sx={{ mt: 2 }}>
                  <Stack direction="column">
                    <Typography sx={{ fontWeight: 'bold' }}>Total Claimed</Typography>
                    <Typography>{profile.totalBountiesClaimed}</Typography>
                  </Stack>
                  <Stack direction="column">
                    <Typography sx={{ fontWeight: 'bold' }}>Abandoned</Typography>
                    <Typography>{profile.totalBountiesAbandoned}</Typography>
                  </Stack>
                  <Stack direction="column">
                    <Typography sx={{ fontWeight: 'bold' }}>Rejected</Typography>
                    <Typography>{profile.totalBountiesRejected}</Typography>
                  </Stack>
                  <Stack direction="column">
                    <Typography sx={{ fontWeight: 'bold' }}>Avg Completion</Typography>
                    <Typography>{formatDuration(profile.averageCompletionTimeMinutes)}</Typography>
                  </Stack>
                  <Stack direction="column">
                    <Typography sx={{ fontWeight: 'bold' }}>Current Streak</Typography>
                    <Typography>
                      <LocalFireDepartmentIcon
                        sx={{
                          fontSize: 16,
                          mr: 0.3,
                          verticalAlign: 'middle',
                          color: 'warning.main',
                        }}
                      />{' '}
                      {profile.currentStreak}
                    </Typography>
                  </Stack>
                  <Stack direction="column">
                    <Typography sx={{ fontWeight: 'bold' }}>Longest Streak</Typography>
                    <Typography>
                      <MilitaryTechIcon
                        sx={{
                          fontSize: 16,
                          mr: 0.3,
                          verticalAlign: 'middle',
                          color: 'warning.main',
                        }}
                      />{' '}
                      {profile.longestStreak}
                    </Typography>
                  </Stack>
                </Grid>
                {profile.lastBountyCompletedAt && (
                  <Box sx={{ mt: 2 }}>
                    <Divider />
                    <Typography
                      sx={{
                        fontSize: '12px',
                        color: 'text.secondary',
                        marginTop: '8px',
                      }}
                    >
                      Last active: {new Date(profile.lastBountyCompletedAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>
          )}
        </Box>
      )}
      {selectedTab === 'history' && (
        <Box sx={{ mt: 2 }}>
          <BountyHistoryCard
            history={historyData?.history || []}
            page={historyPage}
            totalPages={historyData?.totalPages || 1}
            onPageChange={setHistoryPage}
            loading={historyLoading}
          />
        </Box>
      )}
      {selectedTab === 'leaderboard' && (
        <Box sx={{ mt: 2 }}>
          <LeaderboardCard
            leaderboard={leaderboard || []}
            sortBy={leaderboardSort}
            onSortChange={setLeaderboardSort}
            loading={leaderboardLoading}
          />
        </Box>
      )}
      {selectedTab === 'analytics' && (
        <Box sx={{ mt: 2 }}>
          <AnalyticsDashboard analytics={analytics || undefined} loading={analyticsLoading} />
        </Box>
      )}
    </Box>
  );
};

export const HunterProfilePageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Hunter Profile"
    fallbackMessage="Unable to load hunter profile. Please try again later."
    showHomeButton={true}
  >
    <HunterProfilePage />
  </FeatureErrorBoundary>
);
