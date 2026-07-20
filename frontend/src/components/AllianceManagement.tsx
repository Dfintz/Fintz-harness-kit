import { IconButton } from '@/components/ui/IconButton';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useLoading } from '@/hooks/useLoading';
import { organizationServiceV2 } from '@/services/organizationServiceV2';
import CheckmarkCircleIcon from '@mui/icons-material/CheckCircle';
import OrganisationsIcon from '@mui/icons-material/Group';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  alpha,
  Box,
  Chip,
  LinearProgress,
  List,
  ListItem,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';

interface AllianceDetail {
  relationship: {
    id: string;
    targetOrganizationId: string;
    trustScore: number;
    relationshipStrength: number;
    isMutual: boolean;
    establishedDate?: string;
  };
  targetOrganizationName?: string;
  diplomacy?: {
    allianceType: string;
    status: string;
  };
  healthScore: number;
  trustLevel: string;
}

interface AllianceStatistics {
  total: number;
  averageHealth: number;
  strong: number;
  needingReBox: number;
  mutual: number;
  mutualPercentage: number;
}

interface AllianceManagementProps {
  organizationId: string;
  onRefresh?: () => void;
}

export const AllianceManagement: React.FC<AllianceManagementProps> = ({
  organizationId,
  onRefresh,
}) => {
  const theme = useTheme();
  const { error, handleError, clearError } = useErrorHandler();
  const { loading, withLoading } = useLoading();
  const [alliances, setAlliances] = useState<AllianceDetail[]>([]);
  const [statistics, setStatistics] = useState<AllianceStatistics | null>(null);

  const loadAllianceData = async () => {
    try {
      clearError();
      const [allianceData, statsData] = await Promise.all([
        organizationServiceV2.getAlliances(organizationId),
        organizationServiceV2.getAllianceStatistics(organizationId),
      ]);

      const allianceResponse = allianceData as { alliances?: AllianceDetail[] } | undefined;
      if (allianceResponse?.alliances) {
        setAlliances(allianceResponse.alliances);
      }

      const statsResponse = statsData as { statistics?: AllianceStatistics } | undefined;
      if (statsResponse?.statistics) {
        setStatistics(statsResponse.statistics);
      }
    } catch (err) {
      handleError(err as Error);
    }
  };

  useEffect(() => {
    withLoading(() => loadAllianceData());
  }, [organizationId]);

  const handleRefresh = () => {
    withLoading(() => loadAllianceData());
    if (onRefresh) {
      onRefresh();
    }
  };

  const _getHealthColor = (health: number) => {
    if (health >= 80) return 'positive';
    if (health >= 60) return 'informative';
    if (health >= 40) return 'notice';
    return 'negative';
  };

  const _getTrustScoreColor = (trust: number) => {
    if (trust >= 75) return 'positive';
    if (trust >= 50) return 'informative';
    return 'notice';
  };

  if (loading && !alliances.length) {
    return (
      <Box p={4}>
        <LoadingSpinner message="Loading alliances..." />
      </Box>
    );
  }

  if (error.hasError) {
    return (
      <Box p={4}>
        <ErrorMessage message={error.message || 'An error occurred'} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Statistics Banner */}
      {statistics && (
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Paper
            sx={{
              p: 1.5,
              flex: 1,
              textAlign: 'center',
              bgcolor: alpha(theme.palette.info.main, 0.04),
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
              {statistics.total}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Alliances
            </Typography>
          </Paper>
          <Paper
            sx={{
              p: 1.5,
              flex: 1,
              textAlign: 'center',
              bgcolor: alpha(theme.palette.success.main, 0.04),
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
              {statistics.averageHealth}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Average Health
            </Typography>
          </Paper>
          <Paper
            sx={{
              p: 1.5,
              flex: 1,
              textAlign: 'center',
              bgcolor: alpha(theme.palette.warning.main, 0.04),
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
              {statistics.strong}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Strong
            </Typography>
          </Paper>
          <Paper
            sx={{
              p: 1.5,
              flex: 1,
              textAlign: 'center',
              bgcolor: alpha(theme.palette.secondary.main, 0.04),
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'secondary.main' }}>
              {statistics.mutual} ({statistics.mutualPercentage}%)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Mutual
            </Typography>
          </Paper>
          {statistics.needingReBox > 0 && (
            <Paper
              sx={{
                p: 1.5,
                flex: 1,
                textAlign: 'center',
                bgcolor: alpha(theme.palette.error.main, 0.04),
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
                {statistics.needingReBox}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Need Review
              </Typography>
            </Paper>
          )}
        </Stack>
      )}

      {/* Alliance List Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Allied Organizations</Typography>
        <IconButton onClick={handleRefresh} isQuiet aria-label="Refresh">
          <RefreshIcon />
        </IconButton>
      </Stack>

      {/* Alliance List */}
      {alliances.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <OrganisationsIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
          <Typography variant="h6">No Alliances</Typography>
          <Typography color="text.secondary">
            This organization doesn&apos;t have any active alliances yet.
          </Typography>
        </Box>
      ) : (
        <List aria-label="Alliance list">
          {alliances.map(alliance => (
            <ListItem key={alliance.relationship.id} sx={{ display: 'block', p: 0, mb: 1 }}>
              <Paper
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.common.white, 0.02),
                }}
              >
                <Stack direction="column" spacing={1}>
                  {/* Alliance Header */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {alliance.targetOrganizationName ?? 'Unknown Organization'}
                      </Typography>
                    </Box>
                    {alliance.relationship.isMutual && (
                      <Chip
                        icon={<CheckmarkCircleIcon />}
                        label="Mutual"
                        color="success"
                        size="small"
                      />
                    )}
                  </Stack>

                  {/* Health Score */}
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Health Score: {alliance.healthScore}%
                    </Typography>
                    <Box sx={{ width: '100%', mt: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={alliance.healthScore}
                        color={
                          alliance.healthScore >= 80
                            ? 'success'
                            : alliance.healthScore >= 60
                              ? 'info'
                              : alliance.healthScore >= 40
                                ? 'warning'
                                : 'error'
                        }
                      />
                    </Box>
                  </Box>

                  {/* Trust Score */}
                  <Stack direction="row" spacing={4}>
                    <Box>
                      <Chip label={`Trust: ${alliance.relationship.trustScore}`} size="small" />
                    </Box>
                    <Box>
                      <Chip label={alliance.trustLevel} color="info" size="small" />
                    </Box>
                  </Stack>

                  {/* Diplomacy Info */}
                  {alliance.diplomacy && (
                    <Stack direction="row" spacing={2}>
                      <Typography variant="body2">
                        <Typography component="span" variant="subtitle2" color="text.secondary">
                          Type:
                        </Typography>{' '}
                        {alliance.diplomacy.allianceType}
                      </Typography>
                      <Typography variant="body2">
                        <Typography component="span" variant="subtitle2" color="text.secondary">
                          Status:
                        </Typography>{' '}
                        {alliance.diplomacy.status}
                      </Typography>
                    </Stack>
                  )}

                  {/* Established Date */}
                  {alliance.relationship.establishedDate && (
                    <Typography variant="caption" color="text.secondary" fontStyle="italic">
                      Established:{' '}
                      {new Date(alliance.relationship.establishedDate).toLocaleDateString()}
                    </Typography>
                  )}
                </Stack>
              </Paper>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};
