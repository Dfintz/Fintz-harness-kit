import { logger } from '@/utils/logger';
import { Cancel, Delete, Send, FileUpload as Upload } from '@mui/icons-material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import BarChartIcon from '@mui/icons-material/BarChart';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LinkIcon from '@mui/icons-material/Link';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PublishIcon from '@mui/icons-material/Publish';
import VideocamIcon from '@mui/icons-material/Videocam';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { IconButton } from '@/components/ui/IconButton';
import { Item } from '@/components/ui/Item';
import { Select } from '@/components/ui/Select';
import { TypographyArea } from '@/components/ui/SpectrumCompat';
import {
  useDeleteBountyClaim,
  useSubmitBountyClaim,
  useSubmitClaimEvidence,
} from '@/hooks/queries/useBountyQueries';
import { BountyClaimStatus, bountyService } from '@/services/bountyService';
import { getStatusChipSx } from '@/utils/statusStyles';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * Claim Status Enum
 */
export enum ClaimStatus {
  ACTIVE = 'active',
  SUBMITTED = 'submitted',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
  REJECTED = 'rejected',
}

/**
 * Evidence Type Enum
 */
export enum EvidenceType {
  SCREENSHOT = 'screenshot',
  VIDEO = 'video',
  TEXT = 'text',
  LINK = 'link',
  FILE = 'file',
}

/**
 * Evidence Interface
 */
export interface Evidence {
  id: string;
  claimId: string;
  evidenceType: EvidenceType;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  submittedBy: string;
  submittedAt: string;
}

/**
 * Claim Interface
 */
export interface Claim {
  id: string;
  bountyId: string;
  hunterId: string;
  hunterName?: string;
  organizationId: string;
  status: ClaimStatus;
  notes?: string;
  claimedAt: string;
  submittedAt?: string;
  completedAt?: string;
  evidence?: Evidence[];
  bounty?: {
    id: string;
    title: string;
    description?: string;
    rewardAmount?: number;
    status: string;
  };
}

/**
 * Claim Statistics
 */
export interface ClaimStats {
  totalClaims: number;
  activeClaims: number;
  completedClaims: number;
  abandonedClaims: number;
  rejectedClaims: number;
}

interface ClaimManagementProps {
  userId?: string;
  organizationId?: string;
}

/**
 * Get evidence type emoji
 */
function getEvidenceTypeIcon(type: EvidenceType): React.ReactElement {
  const sx = { fontSize: 16, mr: 0.5, verticalAlign: 'middle' as const };
  switch (type) {
    case EvidenceType.SCREENSHOT:
      return <CameraAltIcon sx={sx} />;
    case EvidenceType.VIDEO:
      return <VideocamIcon sx={sx} />;
    case EvidenceType.TEXT:
      return <DescriptionIcon sx={sx} />;
    case EvidenceType.LINK:
      return <LinkIcon sx={sx} />;
    case EvidenceType.FILE:
      return <AttachFileIcon sx={sx} />;
    default:
      return <DescriptionIcon sx={sx} />;
  }
}

/**
 * Format date
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Evidence Card Component
 */
const EvidenceCard: React.FC<{
  evidence: Evidence;
  onDelete?: (evidenceId: string) => void;
  canDelete?: boolean;
}> = ({ evidence, onDelete, canDelete = false }) => {
  return (
    <Box sx={{ borderRadius: 1, p: 2, marginBottom: '8px', padding: '12px' }}>
      <Stack justifyContent="space-between" alignItems="center">
        <Stack alignItems="center" spacing={1}>
          <Typography sx={{ fontSize: '16px' }}>
            {getEvidenceTypeIcon(evidence.evidenceType)}
          </Typography>
          <Typography sx={{ fontWeight: 'bold' }}>
            {evidence.evidenceType.charAt(0).toUpperCase() + evidence.evidenceType.slice(1)}
          </Typography>
        </Stack>
        <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
          {formatDate(evidence.submittedAt)}
        </Typography>
      </Stack>

      {evidence.content && (
        <Typography sx={{ marginTop: '8px' }}>
          {evidence.content.substring(0, 200)}
          {evidence.content.length > 200 ? '...' : ''}
        </Typography>
      )}

      {evidence.fileUrl && (
        <Stack sx={{ mt: 1 }}>
          <Button variant="secondary" onClick={() => window.open(evidence.fileUrl, '_blank')}>
            Box {evidence.fileName || 'File'}
          </Button>
        </Stack>
      )}

      {canDelete && onDelete && (
        <Stack sx={{ mt: 1 }} justifyContent="end">
          <IconButton onClick={() => onDelete(evidence.id)} tooltip="Delete evidence">
            <Delete />
          </IconButton>
        </Stack>
      )}
    </Box>
  );
};

/**
 * Submit Evidence Form
 */
const SubmitEvidenceForm: React.FC<{
  onSubmit: (data: {
    evidenceType: EvidenceType;
    content?: string;
    fileUrl?: string;
  }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}> = ({ onSubmit, onCancel, loading }) => {
  const [evidenceType, setEvidenceType] = useState<EvidenceType>(EvidenceType.TEXT);
  const [content, setContent] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      evidenceType,
      content: content || undefined,
      fileUrl: fileUrl || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack direction="column" spacing={2}>
        <Select
          label="Evidence Type"
          value={evidenceType}
          onSelectionChange={(key: React.Key) => setEvidenceType(key as EvidenceType)}
          required
        >
          <Item key={EvidenceType.SCREENSHOT}>
            <CameraAltIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Screenshot
          </Item>
          <Item key={EvidenceType.VIDEO}>
            <VideocamIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Video
          </Item>
          <Item key={EvidenceType.TEXT}>
            <DescriptionIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Text
          </Item>
          <Item key={EvidenceType.LINK}>
            <LinkIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Link
          </Item>
          <Item key={EvidenceType.FILE}>
            <AttachFileIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> File
          </Item>
        </Select>

        <TypographyArea
          label="Description / Content"
          value={content}
          onChange={setContent}
          placeholder="Describe your evidence..."
        />

        {(evidenceType === EvidenceType.SCREENSHOT ||
          evidenceType === EvidenceType.VIDEO ||
          evidenceType === EvidenceType.LINK ||
          evidenceType === EvidenceType.FILE) && (
          <TypographyArea
            label="URL"
            value={fileUrl}
            onChange={setFileUrl}
            placeholder="https://..."
          />
        )}

        <Stack justifyContent="end" spacing={1} sx={{ mt: 2 }}>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading || (!content && !fileUrl)}>
            {loading ? 'Submitting...' : 'Submit Evidence'}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
};

/**
 * Claim Card Component
 */
const ClaimCard: React.FC<{
  claim: Claim;
  onSubmitEvidence?: (claimId: string) => void;
  onSubmitClaim?: (claimId: string) => void;
  onAbandonClaim?: (claimId: string) => void;
  userId?: string;
}> = ({ claim, onSubmitEvidence, onSubmitClaim, onAbandonClaim, userId }) => {
  const theme = useTheme();
  const isOwner = claim.hunterId === userId;
  const canAddEvidence =
    isOwner && (claim.status === ClaimStatus.ACTIVE || claim.status === ClaimStatus.SUBMITTED);
  const canSubmit =
    isOwner && claim.status === ClaimStatus.ACTIVE && (claim.evidence?.length || 0) > 0;
  const canAbandon = isOwner && claim.status === ClaimStatus.ACTIVE;

  return (
    <Box sx={{ borderRadius: 1, p: 2, marginBottom: '16px' }}>
      <Stack direction="column" spacing={1}>
        <Stack justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1" margin={0}>
            {claim.bounty?.title || `Bounty: ${claim.bountyId.substring(0, 8)}...`}
          </Typography>
          <Chip
            label={claim.status.toUpperCase()}
            size="small"
            sx={getStatusChipSx(claim.status, theme)}
          />
        </Stack>

        {claim.bounty?.description && (
          <Typography color="text.secondary">
            {claim.bounty.description.substring(0, 150)}
            {claim.bounty.description.length > 150 ? '...' : ''}
          </Typography>
        )}

        <Divider />

        <Stack spacing={2}>
          <Typography>
            <strong>Claimed:</strong> {formatDate(claim.claimedAt)}
          </Typography>
          {claim.submittedAt && (
            <Typography>
              <strong>Submitted:</strong> {formatDate(claim.submittedAt)}
            </Typography>
          )}
          {claim.completedAt && (
            <Typography>
              <strong>Completed:</strong> {formatDate(claim.completedAt)}
            </Typography>
          )}
        </Stack>

        {claim.bounty?.rewardAmount && (
          <Typography>
            <strong>Reward:</strong> {claim.bounty.rewardAmount.toLocaleString()} aUEC
          </Typography>
        )}

        <Divider />

        {/* Evidence Section */}
        <Typography variant="body1" margin={0}>
          Evidence ({claim.evidence?.length || 0})
        </Typography>

        {claim.evidence && claim.evidence.length > 0 ? (
          <Box>
            {claim.evidence.map(evidence => (
              <EvidenceCard key={evidence.id} evidence={evidence} canDelete={canAddEvidence} />
            ))}
          </Box>
        ) : (
          <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            No evidence submitted yet.
          </Typography>
        )}

        {/* Action Buttons */}
        <Stack spacing={1} sx={{ mt: 1 }}>
          {canAddEvidence && onSubmitEvidence && (
            <Button variant="secondary" onClick={() => onSubmitEvidence(claim.id)}>
              <Upload fontSize="small" />
              <Typography>Add Evidence</Typography>
            </Button>
          )}
          {canSubmit && onSubmitClaim && (
            <Button variant="primary" onClick={() => onSubmitClaim(claim.id)}>
              <Send fontSize="small" />
              <Typography>Submit for Review</Typography>
            </Button>
          )}
          {canAbandon && onAbandonClaim && (
            <Button variant="danger" onClick={() => onAbandonClaim(claim.id)}>
              <Cancel fontSize="small" />
              <Typography>Abandon Claim</Typography>
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

/**
 * Claim Statistics Card
 */
const ClaimStatsCard: React.FC<{ stats?: ClaimStats; loading?: boolean }> = ({
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
        <BarChartIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} /> Your Claim
        Statistics
      </Typography>
      <Stack spacing={4} sx={{ mt: 2, flexWrap: 'wrap' }} direction="row">
        <Stack direction="column" alignItems="center">
          <Typography sx={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.totalClaims}</Typography>
          <Typography color="text.secondary">Total Claims</Typography>
        </Stack>
        <Stack direction="column" alignItems="center">
          <Typography
            sx={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'warning.main',
            }}
          >
            {stats.activeClaims}
          </Typography>
          <Typography color="text.secondary">Active</Typography>
        </Stack>
        <Stack direction="column" alignItems="center">
          <Typography
            sx={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'success.main',
            }}
          >
            {stats.completedClaims}
          </Typography>
          <Typography color="text.secondary">Completed</Typography>
        </Stack>
        <Stack direction="column" alignItems="center">
          <Typography
            sx={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'error.main',
            }}
          >
            {stats.abandonedClaims + stats.rejectedClaims}
          </Typography>
          <Typography color="text.secondary">Failed</Typography>
        </Stack>
      </Stack>
    </Box>
  );
};

/**
 * Main Claim Management Component
 */
export const ClaimManagement: React.FC<ClaimManagementProps> = ({
  userId,
  organizationId: _organizationId,
}) => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState<ClaimStats | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedTab, setSelectedTab] = useState<React.Key>('active');
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const submitEvidenceMutation = useSubmitClaimEvidence();
  const submitClaimMutation = useSubmitBountyClaim();
  const deleteClaimMutation = useDeleteBountyClaim();

  // Fetch claims from backend
  const fetchClaims = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch claims and stats from backend
      let statusFilter: BountyClaimStatus | undefined;
      if (selectedTab === 'active') {
        statusFilter = BountyClaimStatus.ACTIVE;
      } else if (selectedTab === 'submitted') {
        statusFilter = BountyClaimStatus.SUBMITTED;
      } else if (selectedTab === 'completed') {
        statusFilter = BountyClaimStatus.COMPLETED;
      }

      const result = await bountyService.getMyClaims(statusFilter);

      // Filter for 'failed' tab (abandoned + rejected)
      const filteredClaims =
        selectedTab === 'failed'
          ? result.claims.filter(
              c =>
                c.status === BountyClaimStatus.ABANDONED || c.status === BountyClaimStatus.REJECTED
            )
          : result.claims;

      setClaims(filteredClaims as unknown as Claim[]);
      setStats(result.stats);
    } catch (err) {
      setError('Failed to fetch claims');
      logger.error('Error fetching claims:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTab]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleSubmitEvidence = async (data: {
    evidenceType: EvidenceType;
    content?: string;
    fileUrl?: string;
  }) => {
    if (!selectedClaimId) return;

    try {
      setFormLoading(true);

      // Find the claim to get bountyId
      const claim = claims.find(c => c.id === selectedClaimId);
      if (!claim) {
        throw new Error('Claim not found');
      }

      // Submit evidence to backend
      await submitEvidenceMutation.mutateAsync({
        bountyId: claim.bountyId,
        claimId: selectedClaimId,
        data: {
          evidenceType: data.evidenceType,
          content: data.content,
          fileUrl: data.fileUrl,
        },
      });

      setShowEvidenceForm(false);
      setSelectedClaimId(null);
      fetchClaims();
    } catch (err) {
      logger.error('Error submitting evidence:', err);
      setError('Failed to submit evidence');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubmitClaim = async (claimId: string) => {
    try {
      // Find the claim to get bountyId
      const claim = claims.find(c => c.id === claimId);
      if (!claim) {
        throw new Error('Claim not found');
      }

      // Submit claim for reBox
      await submitClaimMutation.mutateAsync({ bountyId: claim.bountyId, claimId });

      fetchClaims();
    } catch (err) {
      logger.error('Error submitting claim:', err);
      setError('Failed to submit claim');
    }
  };

  const handleAbandonClaim = async (claimId: string) => {
    try {
      // Find the claim to get bountyId
      const claim = claims.find(c => c.id === claimId);
      if (!claim) {
        throw new Error('Claim not found');
      }

      // Abandon claim
      await deleteClaimMutation.mutateAsync({ bountyId: claim.bountyId, claimId });

      fetchClaims();
    } catch (err) {
      logger.error('Error abandoning claim:', err);
      setError('Failed to abandon claim');
    }
  };

  const openEvidenceForm = (claimId: string) => {
    setSelectedClaimId(claimId);
    setShowEvidenceForm(true);
  };

  const renderClaimsContent = () => {
    if (loading) {
      return <LoadingSpinner message="Loading claims..." />;
    }

    if (claims.length === 0) {
      return (
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Typography>No claims found. Claim a bounty to get started!</Typography>
        </Box>
      );
    }

    return claims.map(claim => (
      <ClaimCard
        key={claim.id}
        claim={claim}
        onSubmitEvidence={openEvidenceForm}
        onSubmitClaim={handleSubmitClaim}
        onAbandonClaim={handleAbandonClaim}
        userId={userId}
      />
    ));
  };

  return (
    <Box p={4}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5">
          <GpsFixedIcon sx={{ fontSize: 22, mr: 0.5, verticalAlign: 'middle' }} /> My Bounty Claims
        </Typography>
      </Stack>

      {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}

      <ClaimStatsCard stats={stats} loading={loading && !stats} />

      <Box sx={{ mt: 3 }}>
        <Tabs value={selectedTab} onChange={(_e, newValue) => setSelectedTab(newValue)}>
          <Tab label="Active" value="active" />
          <Tab
            label="Submitted"
            value="submitted"
            icon={<PublishIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
          />
          <Tab
            label="Completed"
            value="completed"
            icon={<CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
          />
          <Tab
            label="Failed"
            value="failed"
            icon={<CancelOutlinedIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
          />
          <Tab
            label="All"
            value="all"
            icon={<ListAltIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
          />
        </Tabs>
        <Box sx={{ mt: 2 }}>{renderClaimsContent()}</Box>
      </Box>

      {/* Submit Evidence Dialog */}
      <Dialog
        open={showEvidenceForm}
        onClose={() => setShowEvidenceForm(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Submit Evidence</DialogTitle>
        <Divider />
        <DialogContent>
          <SubmitEvidenceForm
            onSubmit={handleSubmitEvidence}
            onCancel={() => {
              setShowEvidenceForm(false);
              setSelectedClaimId(null);
            }}
            loading={formLoading}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};
