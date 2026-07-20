import { Grid } from '@/components/ui/Grid';
import { activityServiceV2 } from '@/services/activityServiceV2';
import type { Activity } from '@/types/activity';
import { Badge, Box, Button, Divider, LinearProgress, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useState } from 'react';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';

import HardwareIcon from '@mui/icons-material/Hardware';
import Refresh from '@mui/icons-material/Refresh';
interface MiningResource {
  name: string;
  symbol: string;
  abundance?: number;
  rarity?: string;
  percentage: number;
  price?: number;
  sellLocations?: string[];
}

interface MiningDataDisplayProps {
  activity: Activity;
  onUpdate: () => void;
}

export const MiningDataDisplay: React.FC<MiningDataDisplayProps> = ({ activity, onUpdate }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEnrichMiningData = async () => {
    try {
      setError('');
      setLoading(true);
      await activityServiceV2.enrichWithMiningData(activity.id);
      onUpdate();
    } catch (err: unknown) {
      setError(
        (err as any)?.response?.data?.message ||
          (err instanceof Error ? err.message : 'Failed to fetch mining data')
      );
    } finally {
      setLoading(false);
    }
  };

  const getAccessibilityColor = (accessibility?: string): string => {
    const colors: Record<string, string> = {
      Easy: 'success.main',
      Moderate: 'warning.main',
      Difficult: 'error.main',
      Extreme: 'secondary.main',
    };
    return colors[accessibility || ''] || 'text.disabled';
  };

  const formatCurrency = (value?: number): string => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    })
      .format(value)
      .replace('$', 'aUEC ');
  };

  const formatDate = (date?: Date | string): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  if (!activity.isMiningOperation && !activity.miningData) {
    return (
      <Box sx={{ borderRadius: 1, p: 2 }}>
        <Stack direction="column" spacing={2} alignItems="center">
          <Typography><HardwareIcon sx={{ fontSize: '1rem', verticalAlign: 'middle', mr: 0.5 }} />Mining Data</Typography>
          <Typography sx={{ fontSize: '0.9em', color: 'text.secondary' }}>
            This activity is not marked as a mining operation
          </Typography>
          <Button variant="outlined" onClick={handleEnrichMiningData} disabled={loading}>
            <Refresh />
            <Typography>Fetch Mining Data</Typography>
          </Button>
        </Stack>
      </Box>
    );
  }

  if (loading && !activity.miningData) {
    return <LoadingSpinner />;
  }

  const miningData = activity.miningData;

  if (!miningData) {
    return (
      <Box sx={{ borderRadius: 1, p: 2 }}>
        <Stack direction="column" spacing={2} alignItems="center">
          <Typography>No mining data available</Typography>
          <Button variant="contained" onClick={handleEnrichMiningData} disabled={loading}>
            <Refresh />
            <Typography>Load Mining Data</Typography>
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="column" spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <HardwareIcon sx={{ fontSize: '1.5em', color: 'text.primary' }} />
            <Typography variant="h6">Mining Data</Typography>
          </Stack>
          <Button variant="outlined" onClick={handleEnrichMiningData} disabled={loading}>
            <Refresh />
            <Typography>Refresh Data</Typography>
          </Button>
        </Stack>

        {error && <ErrorMessage message={error} />}

        {/* Location Info */}
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Grid columns={['repeat(auto-fit, minmax(200px, 1fr))']} gap={2}>
            <div>
              <Typography sx={{ fontSize: '0.9em', color: 'text.secondary' }}>Location</Typography>
              <Typography variant="subtitle1">{miningData.location}</Typography>
            </div>
            <div>
              <Typography sx={{ fontSize: '0.9em', color: 'text.secondary' }}>System</Typography>
              <Typography variant="subtitle1">{miningData.system}</Typography>
            </div>
            <div>
              <Typography sx={{ fontSize: '0.9em', color: 'text.secondary' }}>
                Accessibility
              </Typography>
              <Badge sx={{ backgroundColor: getAccessibilityColor(miningData.accessibility) }}>
                {miningData.accessibility}
              </Badge>
            </div>
            {miningData.estimatedProfitPerHour && (
              <div>
                <Typography sx={{ fontSize: '0.9em', color: 'text.secondary' }}>
                  Est. Profit/Hour
                </Typography>
                <Typography variant="subtitle1">
                  {formatCurrency(miningData.estimatedProfitPerHour)}
                </Typography>
              </div>
            )}
          </Grid>
        </Box>

        {/* Resources */}
        {miningData.topResources && miningData.topResources.length > 0 && (
          <Box>
            <Typography variant="subtitle1" mb={2}>
              Available Resources
            </Typography>
            <Grid columns={['1fr']} gap={1.5}>
              {miningData.topResources.map((resource: MiningResource) => (
                <Box key={resource.name} sx={{ borderRadius: 1, p: 2 }}>
                  <Stack direction="column" spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <div>
                        <Typography variant="body1">{resource.name}</Typography>
                        <Typography sx={{ fontSize: '0.85em', color: 'text.secondary' }}>
                          {resource.symbol}
                        </Typography>
                      </div>
                      <Typography sx={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                        {resource.percentage.toFixed(1)}%
                      </Typography>
                    </Stack>

                    <Box sx={{ width: '100%', mt: 0.5 }}>
                      <LinearProgress
                        variant="determinate"
                        value={resource.percentage}
                        aria-label={`${resource.percentage.toFixed(1)}% abundance`}
                      />
                    </Box>

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ fontSize: '0.85em' }}>
                        Price: {formatCurrency(resource.price)}/unit
                      </Typography>
                      {resource.sellLocations && resource.sellLocations.length > 0 && (
                        <Typography sx={{ fontSize: '0.85em', color: 'text.secondary' }}>
                          Sell at: {resource.sellLocations.slice(0, 2).join(', ')}
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Grid>
          </Box>
        )}

        <Divider />

        {/* Recommended Ships */}
        {miningData.recommendedShips && miningData.recommendedShips.length > 0 && (
          <Box>
            <Typography variant="subtitle1" mb={2}>
              Recommended Ships
            </Typography>
            <Grid columns={['repeat(auto-fill, minmax(150px, 1fr))']} gap={1.5}>
              {miningData.recommendedShips.map((ship: string) => (
                <Box
                  key={ship}
                  p={1.5}
                  borderRadius="medium"
                  sx={{
                    backgroundColor: alpha(theme.palette.info.main, 0.08),
                    textAlign: 'center',
                  }}
                >
                  <Typography sx={{ fontWeight: 'bold' }}>{ship}</Typography>
                </Box>
              ))}
            </Grid>
          </Box>
        )}

        {/* Notes */}
        {miningData.notes && (
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography variant="body1" mb={1}>
              Notes
            </Typography>
            <Typography>{miningData.notes}</Typography>
          </Box>
        )}

        {/* Last Updated */}
        {miningData.lastUpdated && (
          <Typography sx={{ fontSize: '0.85em', color: 'text.secondary', textAlign: 'right' }}>
            Last updated: {formatDate(miningData.lastUpdated)}
          </Typography>
        )}

        {/* Target Resources */}
        {activity.targetResources && (
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography variant="body1" mb={1}>
              Target Resources
            </Typography>
            <Typography>{activity.targetResources}</Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
};
