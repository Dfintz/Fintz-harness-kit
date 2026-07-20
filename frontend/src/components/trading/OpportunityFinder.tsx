/**
 * OpportunityFinder Component
 *
 * Search form for finding profitable trading opportunities
 * Routing-independent presentational component
 */

import { TrendingUp as TrendingUpIcon } from '@mui/icons-material';
import { Button, Paper, Stack, TextField, Typography } from '@mui/material';
import React from 'react';

export interface OpportunityFinderProps {
  /** Current start location value */
  startLocation: string;
  /** Handler for start location changes */
  onStartLocationChange: (value: string) => void;
  /** Current minimum profit margin percentage */
  minProfitMargin: number;
  /** Handler for profit margin changes */
  onMinProfitMarginChange: (value: number) => void;
  /** Handler for finding opportunities */
  onFindOpportunities: () => void;
  /** Handler for optimizing route */
  onOptimizeRoute: () => void;
  /** Whether operations are currently loading */
  loading?: boolean;
}

/**
 * OpportunityFinder - Search form for trading opportunities
 *
 * Pure presentational component with no routing or external dependencies.
 * All business logic is handled via props callbacks.
 */
export const OpportunityFinder: React.FC<OpportunityFinderProps> = ({
  startLocation,
  onStartLocationChange,
  minProfitMargin,
  onMinProfitMarginChange,
  onFindOpportunities,
  onOptimizeRoute,
  loading = false,
}) => {
  const handleStartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onStartLocationChange(event.target.value);
  };

  const handleMarginChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    onMinProfitMarginChange(Number.isNaN(nextValue) ? 0 : nextValue);
  };

  return (
    <Paper elevation={1} sx={{ bgcolor: 'background.default', borderRadius: 2, p: 3 }}>
      <Typography variant="h6" mb={2}>
        Find Trade Opportunities
      </Typography>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems="flex-end"
        flexWrap="wrap"
      >
        <TextField
          label="Start Location"
          placeholder="Port Olisar"
          value={startLocation}
          onChange={handleStartChange}
          sx={{ minWidth: { xs: '100%', md: 260 } }}
        />
        <TextField
          label="Min Profit Margin %"
          type="number"
          inputProps={{ min: 0, max: 100 }}
          value={minProfitMargin}
          onChange={handleMarginChange}
          sx={{ minWidth: { xs: '100%', md: 200 } }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={onFindOpportunities}
          disabled={loading}
          startIcon={<TrendingUpIcon />}
        >
          Find Opportunities
        </Button>
        <Button variant="outlined" onClick={onOptimizeRoute} disabled={!startLocation || loading}>
          Optimize Route
        </Button>
      </Stack>
    </Paper>
  );
};
