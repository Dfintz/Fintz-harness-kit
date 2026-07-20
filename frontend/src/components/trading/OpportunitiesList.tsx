/**
 * OpportunitiesList Component
 *
 * Displays trading opportunities in a table format with profit margins
 * Routing-independent presentational component
 */

import { EmptyState } from '@/components/EmptyState';
import {
  Box,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React from 'react';
import type { OpportunityDisplay } from './types';

export interface OpportunitiesListProps {
  /** Array of opportunities to display */
  opportunities: OpportunityDisplay[];
  /** Handler when an opportunity is selected/clicked */
  onSelect?: (opportunity: OpportunityDisplay, index: number) => void;
  /** Whether opportunities are currently loading */
  loading?: boolean;
}

/**
 * OpportunitiesList - Display trading opportunities in a table
 *
 * Pure presentational component with no routing or external dependencies.
 * Shows commodity prices, profit margins with visual progress bars.
 */
export const OpportunitiesList: React.FC<OpportunitiesListProps> = ({
  opportunities,
  onSelect,
  loading: _loading = false,
}) => {
  if (opportunities.length === 0) {
    return (
      <EmptyState
        title="Find trade opportunities"
        description="Enter a start location above to discover profitable trades"
      />
    );
  }

  return (
    <Box sx={{ borderRadius: 1, p: 2 }}>
      <Box
        sx={{
          background: 'background.default',
          borderRadius: '8px',
          padding: '1rem',
        }}
      >
        <Typography variant="h6" mb={2}>
          Profitable Opportunities
        </Typography>

        <TableContainer>
          <Table aria-label="Trade opportunities" size="small">
            <TableHead>
              <TableRow>
                <TableCell>Commodity</TableCell>
                <TableCell>Buy From</TableCell>
                <TableCell align="right">Buy Price</TableCell>
                <TableCell>Sell To</TableCell>
                <TableCell align="right">Sell Price</TableCell>
                <TableCell align="right">Profit/Unit</TableCell>
                <TableCell align="right" width={200}>
                  Margin
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {opportunities.map((opp, idx) => (
                <TableRow
                  key={idx}
                  hover
                  onClick={() => onSelect?.(opp, idx)}
                  sx={{ cursor: onSelect ? 'pointer' : 'default' }}
                >
                  <TableCell>
                    <Typography sx={{ fontWeight: 'bold' }}>{opp.commodity}</Typography>
                  </TableCell>
                  <TableCell>{opp.buyLocation}</TableCell>
                  <TableCell align="right">
                    <Typography sx={{ color: 'error.light' }}>
                      {opp.buyPrice.toFixed(2)} aUEC
                    </Typography>
                  </TableCell>
                  <TableCell>{opp.sellLocation}</TableCell>
                  <TableCell align="right">
                    <Typography sx={{ color: 'success.light' }}>
                      {opp.sellPrice.toFixed(2)} aUEC
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography sx={{ color: 'success.main', fontWeight: 'bold' }}>
                      {opp.profitPerUnit.toFixed(2)} aUEC
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="column" spacing={0.5}>
                      <Box sx={{ width: '100%' }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(opp.profitMargin, 100)}
                          aria-label={`${opp.profitMargin.toFixed(1)}% profit margin`}
                        />
                      </Box>
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          color: 'success.main',
                          fontWeight: 'bold',
                        }}
                      >
                        {opp.profitMargin.toFixed(1)}%
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};
