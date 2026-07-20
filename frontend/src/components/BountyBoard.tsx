import { Divider } from '@/components/ui/Divider';
import { Grid } from '@/components/ui/Grid';
import { Item } from '@/components/ui/Item';
import { Select } from '@/components/ui/Select';
import { TypographyArea, TypographyField } from '@/components/ui/SpectrumCompat';
import {
  useApproveBountyClaim,
  useCreateBounty,
  useCreateBountyClaim,
  useRejectBountyClaim,
} from '@/hooks/queries/useBountyQueries';
import {
  BountyDifficulty,
  BountyRewardType,
  BountyStatus,
  BountyTargetType,
  BountyType,
  bountyService,
  type Bounty,
  type BountyClaim,
  type CreateBountyDTO,
} from '@/services/bountyService';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';
import { CheckCircle as Checkmark, Close } from '@mui/icons-material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import BarChartIcon from '@mui/icons-material/BarChart';
import CancelIcon from '@mui/icons-material/Cancel';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DangerousIcon from '@mui/icons-material/Dangerous';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import InventoryIcon from '@mui/icons-material/Inventory';
import LinkIcon from '@mui/icons-material/Link';
import ListAltIcon from '@mui/icons-material/ListAlt';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PersonIcon from '@mui/icons-material/Person';
import PublishIcon from '@mui/icons-material/Publish';
import SearchIcon from '@mui/icons-material/Search';
import SosIcon from '@mui/icons-material/Sos';
import StarIcon from '@mui/icons-material/Star';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useState } from 'react';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';

import Add from '@mui/icons-material/Add';
/**
 * Bounty Types (re-exported from service)
 */
export { BountyType } from '@/services/bountyService';

/**
 * Bounty Target Types (re-exported from service)
 */
export { BountyTargetType } from '@/services/bountyService';

/**
 * Bounty Reward Types (re-exported from service)
 */
export { BountyRewardType } from '@/services/bountyService';

/**
 * Bounty Status (re-exported from service)
 */
export { BountyStatus } from '@/services/bountyService';

/**
 * Bounty Difficulty (re-exported from service)
 */
export { BountyDifficulty } from '@/services/bountyService';

/**
 * Phase 3: Bounty Claim Status for tracking (re-exported from service)
 */
export { BountyClaimStatus } from '@/services/bountyService';

/**
 * Phase 3: Evidence Interface (re-exported from service)
 */
export type { BountyEvidence } from '@/services/bountyService';

/**
 * Phase 3: Bounty Claim Interface (re-exported from service)
 */
export type { BountyClaim } from '@/services/bountyService';

/**
 * Bounty Statistics Interface
 */
export interface BountyStats {
  totalBounties: number;
  activeBounties: number;
  completedBounties: number;
  claimedBounties: number;
  totalRewardsPosted: number;
  totalRewardsPaid: number;
  // Phase 3: Reward tracking
  pendingRewards?: number;
  pendingApprovals?: number;
}

interface BountyBoardProps {
  organizationId?: string;
  userId?: string;
}

interface BountyListRenderOptions {
  loadingMessage: string;
  emptyMessage: string;
  includeClaimAction?: boolean;
}

/**
 * Get bounty type emoji and label
 */
function getBountyTypeInfo(type: BountyType): {
  icon: React.ComponentType<import('@mui/material/SvgIcon').SvgIconProps>;
  label: string;
  color: string;
} {
  switch (type) {
    case BountyType.KILL:
      return { icon: DangerousIcon, label: 'Kill', color: 'negative' };
    case BountyType.CAPTURE:
      return { icon: LinkIcon, label: 'Capture', color: 'notice' };
    case BountyType.INTEL:
      return { icon: SearchIcon, label: 'Intel', color: 'informative' };
    case BountyType.TRANSPORT:
      return { icon: InventoryIcon, label: 'Transport', color: 'positive' };
    case BountyType.RESCUE:
      return { icon: SosIcon, label: 'Rescue', color: 'positive' };
    case BountyType.CUSTOM:
      return { icon: StarIcon, label: 'Custom', color: 'neutral' };
    default:
      return { icon: GpsFixedIcon, label: 'Unknown', color: 'neutral' };
  }
}

/**
 * Get difficulty badge variant
 */
function getDifficultyChipColor(
  difficulty?: BountyDifficulty
): 'success' | 'error' | 'warning' | 'info' | 'default' {
  switch (difficulty) {
    case BountyDifficulty.EASY:
      return 'success';
    case BountyDifficulty.MEDIUM:
      return 'warning';
    case BountyDifficulty.HARD:
      return 'warning';
    case BountyDifficulty.EXPERT:
      return 'error';
    default:
      return 'default';
  }
}

/**
 * Format currency
 */
function formatCurrency(amount?: number): string {
  if (amount == null) return 'Negotiable';
  return `${amount.toLocaleString()} aUEC`;
}

function getStatusFilterForTab(selectedTab: React.Key): BountyStatus | undefined {
  if (selectedTab === 'active') return BountyStatus.ACTIVE;
  if (selectedTab === 'claimed') return BountyStatus.CLAIMED;
  if (selectedTab === 'completed') return BountyStatus.COMPLETED;
  return undefined;
}

function buildBountyStats(items: Bounty[], total: number): BountyStats {
  const completedStatuses = new Set([
    BountyStatus.COMPLETED,
    BountyStatus.VERIFIED,
    BountyStatus.PAID,
  ]);
  return {
    totalBounties: total,
    activeBounties: items.filter(b => b.status === BountyStatus.ACTIVE).length,
    completedBounties: items.filter(b => completedStatuses.has(b.status)).length,
    claimedBounties: items.filter(b => b.status === BountyStatus.CLAIMED).length,
    totalRewardsPosted: items.reduce((sum, b) => sum + (b.rewardAmount || 0), 0),
    totalRewardsPaid: items
      .filter(b => b.status === BountyStatus.PAID)
      .reduce((sum, b) => sum + (b.rewardAmount || 0), 0),
  };
}

/**
 * Bounty Card Component
 */
const BountyCard: React.FC<{
  bounty: Bounty;
  onClaim?: (bounty: Bounty) => void;
  onView?: (bounty: Bounty) => void;
  userId?: string;
}> = ({ bounty, onClaim, onView, userId }) => {
  const theme = useTheme();
  const typeInfo = getBountyTypeInfo(bounty.bountyType);
  const BountyTypeIcon = typeInfo.icon;
  const canClaim = bounty.status === BountyStatus.ACTIVE && bounty.createdBy !== userId;

  return (
    <Box sx={{ borderRadius: 1, p: 2, marginBottom: '12px' }}>
      <Stack direction="column" spacing={1}>
        <Stack justifyContent="space-between" alignItems="center">
          <Stack alignItems="center" spacing={1}>
            <BountyTypeIcon sx={{ fontSize: 20 }} />
            <Typography variant="subtitle1" margin={0}>
              {bounty.title}
            </Typography>
          </Stack>
          <Chip
            label={bounty.status.toUpperCase()}
            sx={getStatusChipSx(bounty.status, theme)}
            size="small"
          />
        </Stack>

        {bounty.description && (
          <Typography color="text.secondary">
            {bounty.description.substring(0, 150)}
            {bounty.description.length > 150 ? '...' : ''}
          </Typography>
        )}

        <Divider />

        <Grid columns={['1fr', '1fr', '1fr']} gap={1}>
          <Stack alignItems="center" spacing={0.5}>
            <GpsFixedIcon fontSize="small" />
            <Typography>{bounty.targetName || bounty.targetType}</Typography>
          </Stack>
          <Stack alignItems="center" spacing={0.5}>
            <AttachMoneyIcon fontSize="small" />
            <Typography>{formatCurrency(bounty.rewardAmount)}</Typography>
          </Stack>
          {bounty.difficulty && (
            <Chip
              label={bounty.difficulty.toUpperCase()}
              color={getDifficultyChipColor(bounty.difficulty)}
              size="small"
            />
          )}
        </Grid>

        {bounty.location && (
          <Stack alignItems="center" spacing={0.5}>
            <LocationOnIcon fontSize="small" />
            <Typography>{bounty.location}</Typography>
          </Stack>
        )}

        <Stack justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
          <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
            Posted by {bounty.createdByName || 'Unknown'}
            {bounty.claimedByName && ` • Claimed by ${bounty.claimedByName}`}
          </Typography>
          <Stack spacing={1}>
            {onView && (
              <Button variant="outlined" onClick={() => onView(bounty)}>
                View
              </Button>
            )}
            {canClaim && onClaim && (
              <Button variant="contained" onClick={() => onClaim(bounty)}>
                Claim Bounty
              </Button>
            )}
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
};

/**
 * Create Bounty Form Component
 */
const CreateBountyForm: React.FC<{
  onSubmit: (data: Partial<Bounty>) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}> = ({ onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    bountyType: BountyType.KILL as BountyType,
    targetType: BountyTargetType.PLAYER as BountyTargetType,
    targetName: '',
    rewardType: BountyRewardType.CREDITS as BountyRewardType,
    rewardAmount: 0,
    rewardDescription: '',
    difficulty: '' as BountyDifficulty | '',
    location: '',
    systemLocation: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      ...formData,
      difficulty: formData.difficulty || undefined,
    } as Partial<Bounty>);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack direction="column" spacing={2}>
        <TypographyField
          label="Title"
          value={formData.title}
          onChange={value => setFormData({ ...formData, title: value })}
          isRequired
        />

        <TypographyArea
          label="Description"
          value={formData.description}
          onChange={value => setFormData({ ...formData, description: value })}
        />

        <Grid columns={['1fr', '1fr']} gap={2}>
          <Select
            label="Bounty Type"
            value={formData.bountyType}
            onChange={key => setFormData({ ...formData, bountyType: key as BountyType })}
            required
          >
            <Item key={BountyType.KILL}>
              <DangerousIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Kill
            </Item>
            <Item key={BountyType.CAPTURE}>
              <LinkIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Capture
            </Item>
            <Item key={BountyType.INTEL}>
              <SearchIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Intel
            </Item>
            <Item key={BountyType.TRANSPORT}>
              <InventoryIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Transport
            </Item>
            <Item key={BountyType.RESCUE}>
              <SosIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Rescue
            </Item>
            <Item key={BountyType.CUSTOM}>
              <StarIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Custom
            </Item>
          </Select>

          <Select
            label="Target Type"
            value={formData.targetType}
            onChange={key => setFormData({ ...formData, targetType: key as BountyTargetType })}
            required
          >
            <Item key={BountyTargetType.PLAYER}>Player</Item>
            <Item key={BountyTargetType.NPC}>NPC</Item>
            <Item key={BountyTargetType.SHIP}>Ship</Item>
            <Item key={BountyTargetType.LOCATION}>Location</Item>
            <Item key={BountyTargetType.ITEM}>Item</Item>
            <Item key={BountyTargetType.OTHER}>Other</Item>
          </Select>
        </Grid>

        <TypographyField
          label="Target Name/Identifier"
          value={formData.targetName}
          onChange={value => setFormData({ ...formData, targetName: value })}
        />

        <Grid columns={['1fr', '1fr']} gap={2}>
          <Select
            label="Reward Type"
            value={formData.rewardType}
            onChange={key => setFormData({ ...formData, rewardType: key as BountyRewardType })}
            required
          >
            <Item key={BountyRewardType.CREDITS}>
              <AttachMoneyIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Credits
            </Item>
            <Item key={BountyRewardType.ITEM}>
              <InventoryIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Item
            </Item>
            <Item key={BountyRewardType.REPUTATION}>
              <StarIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Reputation
            </Item>
            <Item key={BountyRewardType.MIXED}>
              <CardGiftcardIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Mixed
            </Item>
            <Item key={BountyRewardType.OTHER}>
              <HelpOutlineIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Other
            </Item>
          </Select>

          <TypographyField
            label="Reward Amount (aUEC)"
            type="number"
            value={formData.rewardAmount.toString()}
            onChange={value =>
              setFormData({ ...formData, rewardAmount: Number.parseInt(value, 10) || 0 })
            }
          />
        </Grid>

        <TypographyField
          label="Reward Description"
          value={formData.rewardDescription}
          onChange={value => setFormData({ ...formData, rewardDescription: value })}
        />

        <Grid columns={['1fr', '1fr']} gap={2}>
          <Select
            label="Difficulty"
            value={formData.difficulty}
            onChange={key => setFormData({ ...formData, difficulty: key as BountyDifficulty })}
          >
            <Item key="">Not Specified</Item>
            <Item key={BountyDifficulty.EASY}>
              <FiberManualRecordIcon
                sx={{ fontSize: 12, color: 'success.main', mr: 0.5, verticalAlign: 'middle' }}
              />{' '}
              Easy
            </Item>
            <Item key={BountyDifficulty.MEDIUM}>
              <FiberManualRecordIcon
                sx={{ fontSize: 12, color: 'warning.main', mr: 0.5, verticalAlign: 'middle' }}
              />{' '}
              Medium
            </Item>
            <Item key={BountyDifficulty.HARD}>
              <FiberManualRecordIcon
                sx={{ fontSize: 12, color: 'warning.dark', mr: 0.5, verticalAlign: 'middle' }}
              />{' '}
              Hard
            </Item>
            <Item key={BountyDifficulty.EXPERT}>
              <FiberManualRecordIcon
                sx={{ fontSize: 12, color: 'error.main', mr: 0.5, verticalAlign: 'middle' }}
              />{' '}
              Expert
            </Item>
          </Select>

          <TypographyField
            label="Location"
            value={formData.location}
            onChange={value => setFormData({ ...formData, location: value })}
          />
        </Grid>

        <Stack justifyContent="end" spacing={1} sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="contained" type="submit" disabled={loading || !formData.title}>
            {loading ? 'Creating...' : 'Create Bounty'}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
};

/**
 * Bounty Statistics Card
 */
const BountyStatsCard: React.FC<{ stats?: BountyStats; loading?: boolean }> = ({
  stats,
  loading,
}) => {
  if (loading) {
    return (
      <Box sx={{ borderRadius: 1, p: 2 }}>
        <Box sx={{ width: '100%' }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Loading statistics...
          </Typography>
          <LinearProgress />
        </Box>
      </Box>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Box sx={{ borderRadius: 1, p: 2 }}>
      <Typography variant="subtitle1">
        <BarChartIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} /> Bounty Statistics
      </Typography>
      <Grid columns={['1fr', '1fr', '1fr']} gap={2} sx={{ mt: 2 }}>
        <Stack direction="column" alignItems="center">
          <Typography sx={{ fontSize: '24px', fontWeight: 'bold' }}>
            {stats.totalBounties}
          </Typography>
          <Typography color="text.secondary">Total Bounties</Typography>
        </Stack>
        <Stack direction="column" alignItems="center">
          <Typography
            sx={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'success.main',
            }}
          >
            {stats.activeBounties}
          </Typography>
          <Typography color="text.secondary">Active</Typography>
        </Stack>
        <Stack direction="column" alignItems="center">
          <Typography
            sx={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'info.main',
            }}
          >
            {stats.completedBounties}
          </Typography>
          <Typography color="text.secondary">Completed</Typography>
        </Stack>
      </Grid>
      <Divider sx={{ my: 2 }} />
      <Grid columns={['1fr', '1fr']} gap={2}>
        <Stack direction="column" alignItems="center">
          <Typography sx={{ fontSize: '18px', fontWeight: 'bold' }}>
            {formatCurrency(stats.totalRewardsPosted)}
          </Typography>
          <Typography color="text.secondary">Total Rewards Posted</Typography>
        </Stack>
        <Stack direction="column" alignItems="center">
          <Typography
            sx={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: 'success.main',
            }}
          >
            {formatCurrency(stats.totalRewardsPaid)}
          </Typography>
          <Typography color="text.secondary">Rewards Paid Out</Typography>
        </Stack>
      </Grid>
    </Box>
  );
};

/**
 * Main Bounty Board Component
 */
export const BountyBoard: React.FC<BountyBoardProps> = ({
  organizationId: _organizationId,
  userId,
}) => {
  const theme = useTheme();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [stats, setStats] = useState<BountyStats | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedTab, setSelectedTab] = useState<React.Key>('active');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  // Phase 3: Approval workflow state
  const [pendingClaims, setPendingClaims] = useState<BountyClaim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<BountyClaim | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');

  // Mutation hooks (route through meta.invalidates so other consumers refresh)
  const createBountyMutation = useCreateBounty();
  const claimBountyMutation = useCreateBountyClaim();
  const approveBountyClaimMutation = useApproveBountyClaim();
  const rejectBountyClaimMutation = useRejectBountyClaim();

  const renderBountyList = ({
    loadingMessage,
    emptyMessage,
    includeClaimAction = false,
  }: BountyListRenderOptions) => {
    if (loading) {
      return <LoadingSpinner message={loadingMessage} />;
    }

    if (bounties.length === 0) {
      return (
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Typography>{emptyMessage}</Typography>
        </Box>
      );
    }

    return bounties.map(bounty => (
      <BountyCard
        key={bounty.id}
        bounty={bounty}
        onClaim={includeClaimAction ? handleClaimBounty : undefined}
        onView={handleViewBounty}
        userId={userId}
      />
    ));
  };

  // Mock API calls - replace with actual service calls
  const fetchBounties = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const statusFilter = getStatusFilterForTab(selectedTab);

      // Call actual API
      const result = await bountyService.searchBounties({
        status: statusFilter,
        page: 1,
        limit: 100,
      });

      const items = result.data ?? [];
      setBounties(items);

      setStats(buildBountyStats(items, result.total));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bounties');
      logger.error('Error fetching bounties:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTab]);

  useEffect(() => {
    fetchBounties();
  }, [fetchBounties]);

  const handleCreateBounty = async (data: Partial<Bounty>) => {
    try {
      setFormLoading(true);
      setError('');

      // Routed through hook so meta.invalidates fires for other consumers.
      await createBountyMutation.mutateAsync(data as unknown as CreateBountyDTO);

      setShowCreateForm(false);
      fetchBounties();
    } catch (err: unknown) {
      logger.error('Error creating bounty:', err);
      setError(err instanceof Error ? err.message : 'Failed to create bounty');
    } finally {
      setFormLoading(false);
    }
  };

  const handleClaimBounty = async (bounty: Bounty) => {
    try {
      setError('');

      // Routed through hook so meta.invalidates fires for other consumers.
      await claimBountyMutation.mutateAsync({ bountyId: bounty.id });

      fetchBounties();
    } catch (err: unknown) {
      logger.error('Error claiming bounty:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim bounty');
    }
  };

  const handleViewBounty = (bounty: Bounty) => {
    setSelectedBounty(bounty);
  };

  // Phase 3: Approval workflow handlers
  const handleReviewClaim = (claim: BountyClaim) => {
    setSelectedClaim(claim);
    setShowApprovalDialog(true);
    setApprovalAction(null);
    setRejectionReason('');
    setApprovalNotes('');
  };

  const handleApproveClaim = async () => {
    if (!selectedClaim) return;

    try {
      setFormLoading(true);
      setError('');

      // Routed through hook so meta.invalidates fires for other consumers.
      await approveBountyClaimMutation.mutateAsync({
        bountyId: selectedClaim.bountyId,
        claimId: selectedClaim.id,
        notes: approvalNotes,
      });

      setShowApprovalDialog(false);
      setSelectedClaim(null);
      setPendingClaims(prev => prev.filter(c => c.id !== selectedClaim.id));
      fetchBounties();
    } catch (err: unknown) {
      logger.error('Error approving claim:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve claim');
    } finally {
      setFormLoading(false);
    }
  };

  const handleRejectClaim = async () => {
    if (!selectedClaim || !rejectionReason) return;

    try {
      setFormLoading(true);
      setError('');

      // Routed through hook so meta.invalidates fires for other consumers.
      await rejectBountyClaimMutation.mutateAsync({
        bountyId: selectedClaim.bountyId,
        claimId: selectedClaim.id,
        reason: rejectionReason,
      });

      setShowApprovalDialog(false);
      setSelectedClaim(null);
      setPendingClaims(prev => prev.filter(c => c.id !== selectedClaim.id));
      fetchBounties();
    } catch (err: unknown) {
      logger.error('Error rejecting claim:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject claim');
    } finally {
      setFormLoading(false);
    }
  };

  // Fetch pending claims for approval
  const fetchPendingClaims = useCallback(async () => {
    try {
      // Call actual API
      const claims = await bountyService.getPendingClaims();

      // Only show if current user is the bounty creator
      setPendingClaims(claims);
    } catch (err) {
      logger.error('Error fetching pending claims:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedTab === 'pending') {
      fetchPendingClaims();
    }
  }, [selectedTab, fetchPendingClaims]);

  return (
    <Box p={4}>
      <Stack justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5">
          <GpsFixedIcon sx={{ fontSize: 22, mr: 0.5, verticalAlign: 'middle' }} /> Bounty Board
        </Typography>
        <Button variant="contained" onClick={() => setShowCreateForm(true)} startIcon={<Add />}>
          Create Bounty
        </Button>
      </Stack>

      {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}

      <BountyStatsCard stats={stats} loading={loading && !stats} />

      <Box sx={{ mt: 3 }}>
        <Tabs
          value={selectedTab}
          onChange={(_event: React.SyntheticEvent, key: React.Key) => setSelectedTab(key)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            label="Active"
            value="active"
            icon={<TrendingUpIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
          />
          <Tab label="Claimed" value="claimed" />
          <Tab
            label="Completed"
            value="completed"
            icon={<CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
          />
          <Tab
            label="Pending Approvals"
            value="pending"
            icon={<ListAltIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
          />
          <Tab
            label="My Bounties"
            value="my"
            icon={<PersonIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
          />
          <Tab
            label="All"
            value="all"
            icon={<ListAltIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
          />
        </Tabs>

        {/* Tab content — rendered based on selectedTab */}
        {selectedTab === 'active' && (
          <Box sx={{ mt: 2 }}>
            {renderBountyList({
              loadingMessage: 'Loading bounties...',
              emptyMessage: 'No active bounties found. Create one to get started!',
              includeClaimAction: true,
            })}
          </Box>
        )}
        {selectedTab === 'claimed' && (
          <Box sx={{ mt: 2 }}>
            {renderBountyList({
              loadingMessage: 'Loading bounties...',
              emptyMessage: 'No claimed bounties found.',
            })}
          </Box>
        )}
        {selectedTab === 'completed' && (
          <Box sx={{ mt: 2 }}>
            {renderBountyList({
              loadingMessage: 'Loading bounties...',
              emptyMessage: 'No completed bounties found.',
            })}
          </Box>
        )}
        {selectedTab === 'pending' && (
          <Box sx={{ mt: 2 }}>
            {pendingClaims.length === 0 ? (
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" alignItems="center" spacing={2}>
                  <Typography>
                    <ListAltIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> No
                    pending approvals
                  </Typography>
                  <Typography color="text.secondary">
                    When hunters submit evidence for your bounties, they will appear here for
                    review.
                  </Typography>
                </Stack>
              </Box>
            ) : (
              pendingClaims.map(claim => (
                <Box key={claim.id} sx={{ borderRadius: 1, p: 2, marginBottom: '12px' }}>
                  <Stack direction="column" spacing={1}>
                    <Stack justifyContent="space-between" alignItems="center">
                      <Stack alignItems="center" spacing={1}>
                        <PublishIcon sx={{ fontSize: 20 }} />
                        <Typography variant="subtitle1" margin={0}>
                          {claim.bounty?.title || 'Unknown Bounty'}
                        </Typography>
                      </Stack>
                      <Chip
                        label="PENDING REVIEW"
                        size="small"
                        sx={getStatusChipSx('pending', theme)}
                      />
                    </Stack>

                    <Divider />

                    <Grid columns={['1fr', '1fr', '1fr']} gap={1}>
                      <Stack direction="column">
                        <Typography sx={{ fontWeight: 'bold' }}>Hunter</Typography>
                        <Typography>{claim.hunterName || 'Unknown'}</Typography>
                      </Stack>
                      <Stack direction="column">
                        <Typography sx={{ fontWeight: 'bold' }}>Reward</Typography>
                        <Typography>
                          {claim.bounty?.rewardAmount?.toLocaleString() || 'Negotiable'} aUEC
                        </Typography>
                      </Stack>
                      <Stack direction="column">
                        <Typography sx={{ fontWeight: 'bold' }}>Evidence</Typography>
                        <Typography>{claim.evidence?.length || 0} item(s)</Typography>
                      </Stack>
                    </Grid>

                    {claim.notes && (
                      <Box
                        sx={{
                          borderRadius: 1,
                          p: 2,
                          backgroundColor: theme.palette.action.hover,
                        }}
                      >
                        <Typography sx={{ fontWeight: 'bold' }}>Hunter Notes:</Typography>
                        <Typography>{claim.notes}</Typography>
                      </Box>
                    )}

                    {/* Evidence Preview */}
                    {claim.evidence && claim.evidence.length > 0 && (
                      <Box>
                        <Typography sx={{ fontWeight: 'bold', marginBottom: '8px' }}>
                          Evidence Submitted:
                        </Typography>
                        <Stack direction="column" spacing={0.5}>
                          {claim.evidence.map(ev => (
                            <Box key={ev.id} sx={{ borderRadius: 1, padding: '8px' }}>
                              <Stack alignItems="center" spacing={1}>
                                <Chip label={ev.evidenceType} color="info" size="small" />
                                <Typography>{ev.content || ev.fileName || ev.fileUrl}</Typography>
                              </Stack>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    <Stack justifyContent="end" spacing={1} sx={{ mt: 1 }}>
                      <Button
                        variant="contained"
                        color="error"
                        onClick={() => handleReviewClaim(claim)}
                        startIcon={<Close />}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        onClick={() => {
                          setSelectedClaim(claim);
                          setApprovalAction('approve');
                          setShowApprovalDialog(true);
                        }}
                        startIcon={<Checkmark />}
                      >
                        Approve
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              ))
            )}
          </Box>
        )}
        {selectedTab === 'my' && (
          <Box sx={{ mt: 2 }}>
            {renderBountyList({
              loadingMessage: 'Loading your bounties...',
              emptyMessage: "You haven't created or claimed any bounties yet.",
            })}
          </Box>
        )}
        {selectedTab === 'all' && (
          <Box sx={{ mt: 2 }}>
            {renderBountyList({
              loadingMessage: 'Loading all bounties...',
              emptyMessage: 'No bounties found.',
              includeClaimAction: true,
            })}
          </Box>
        )}
      </Box>

      <Dialog
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Bounty</DialogTitle>
        <DialogContent>
          <CreateBountyForm
            onSubmit={handleCreateBounty}
            onCancel={() => setShowCreateForm(false)}
            loading={formLoading}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedBounty}
        onClose={() => setSelectedBounty(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedBounty && (
          <>
            <DialogTitle>{selectedBounty.title}</DialogTitle>
            <DialogContent>
              <Stack direction="column" spacing={2} sx={{ mt: 2 }}>
                <Chip
                  label={selectedBounty.status.toUpperCase()}
                  sx={getStatusChipSx(selectedBounty.status, theme)}
                  variant="outlined"
                />

                <Typography>{selectedBounty.description || 'No description provided.'}</Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box
                    sx={{
                      padding: '16px',
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: '4px',
                      background: theme.palette.action.hover,
                    }}
                  >
                    <Typography sx={{ fontWeight: 'bold' }}>Type</Typography>
                    <Typography>
                      {React.createElement(getBountyTypeInfo(selectedBounty.bountyType).icon, {
                        sx: { fontSize: 16, mr: 0.5, verticalAlign: 'middle' },
                      })}{' '}
                      {selectedBounty.bountyType}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      padding: '16px',
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: '4px',
                      background: theme.palette.action.hover,
                    }}
                  >
                    <Typography sx={{ fontWeight: 'bold' }}>Reward</Typography>
                    <Typography>{formatCurrency(selectedBounty.rewardAmount)}</Typography>
                  </Box>
                </Box>

                {selectedBounty.targetName && (
                  <Box
                    sx={{
                      padding: '16px',
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: '4px',
                      background: theme.palette.action.hover,
                    }}
                  >
                    <Typography sx={{ fontWeight: 'bold' }}>Target</Typography>
                    <Typography>{selectedBounty.targetName}</Typography>
                  </Box>
                )}

                {selectedBounty.location && (
                  <Box
                    sx={{
                      padding: '16px',
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: '4px',
                      background: theme.palette.action.hover,
                    }}
                  >
                    <Typography sx={{ fontWeight: 'bold' }}>Location</Typography>
                    <Typography>{selectedBounty.location}</Typography>
                  </Box>
                )}

                <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                  ID: {selectedBounty.id}
                </Typography>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button variant="contained" onClick={() => setSelectedBounty(null)}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog
        open={showApprovalDialog}
        onClose={() => {
          setShowApprovalDialog(false);
          setSelectedClaim(null);
          setApprovalAction(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {approvalAction === 'approve' ? (
            <>
              <CheckCircleOutlineIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} />{' '}
              Approve Claim
            </>
          ) : (
            <>
              <CancelIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} /> Reject Claim
            </>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedClaim && (
            <Stack direction="column" spacing={2} sx={{ mt: 2 }}>
              <Typography>
                {approvalAction === 'approve'
                  ? `You are about to approve the claim for "${selectedClaim.bounty?.title}" by ${selectedClaim.hunterName || 'Unknown Hunter'}.`
                  : `You are about to reject the claim for "${selectedClaim.bounty?.title}" by ${selectedClaim.hunterName || 'Unknown Hunter'}.`}
              </Typography>

              {approvalAction === 'approve' && (
                <>
                  <Typography sx={{ fontWeight: 'bold' }}>
                    Reward: {selectedClaim.bounty?.rewardAmount?.toLocaleString() || 'Negotiable'}{' '}
                    aUEC
                  </Typography>
                  <TextField
                    label="Approval Notes (optional)"
                    value={approvalNotes}
                    onChange={e => setApprovalNotes(e.target.value)}
                    placeholder="Add any notes about this approval..."
                    multiline
                    rows={4}
                    fullWidth
                  />
                </>
              )}

              {approvalAction === 'reject' && (
                <TextField
                  label="Rejection Reason"
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  required
                  multiline
                  rows={4}
                  fullWidth
                />
              )}

              {!approvalAction && (
                <Stack direction="column" spacing={2} sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => setApprovalAction('approve')}
                  >
                    <Checkmark sx={{ mr: 1 }} />
                    Approve Claim
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={() => setApprovalAction('reject')}
                  >
                    <Close sx={{ mr: 1 }} />
                    Reject Claim
                  </Button>
                </Stack>
              )}
            </Stack>
          )}
        </DialogContent>
        {approvalAction && (
          <DialogActions>
            <Button
              variant="outlined"
              onClick={() => {
                setShowApprovalDialog(false);
                setSelectedClaim(null);
                setApprovalAction(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color={approvalAction === 'approve' ? 'success' : 'error'}
              onClick={approvalAction === 'approve' ? handleApproveClaim : handleRejectClaim}
              disabled={approvalAction === 'reject' && !rejectionReason}
            >
              {approvalAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </Box>
  );
};
