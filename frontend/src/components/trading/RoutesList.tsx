/**
 * RoutesList Component
 *
 * Displays trading routes in a table format
 * Routing-independent presentational component
 */

import { EmptyState } from '@/components/EmptyState';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React from 'react';
// Import directly from the source files instead of the barrel ('./') to
// avoid a circular dependency: index.ts re-exports RoutesList, so importing
// from './' here would create index.ts ↔ RoutesList.tsx cycle.
import { getStatusChipSx } from '@/utils/statusStyles';
import type { RouteDisplay } from './types';

export interface RoutesListProps {
  /** Array of routes to display */
  routes: RouteDisplay[];
  /** Handler when edit button is clicked */
  onEdit: (route: RouteDisplay) => void;
  /** Handler when delete button is clicked */
  onDelete: (route: RouteDisplay) => void;
  /** Handler when Box/details button is clicked */
  onBox: (route: RouteDisplay) => void;
  /** Handler when "Create First Route" is clicked in empty state */
  onCreateFirst?: () => void;
  /** Whether operations are currently loading */
  loading?: boolean;
}

/**
 * RoutesList - Display trading routes in a table
 *
 * Pure presentational component with no routing or external dependencies.
 * All business logic is handled via props callbacks.
 */
export const RoutesList: React.FC<RoutesListProps> = ({
  routes,
  onEdit,
  onDelete,
  onBox,
  onCreateFirst,
  loading = false,
}) => {
  const theme = useTheme();
  if (routes.length === 0) {
    return (
      <EmptyState
        title="No trading routes yet"
        description="Create your first trading route to start optimizing your profits"
        actionLabel="Create First Route"
        onAction={onCreateFirst}
      />
    );
  }

  return (
    <Box sx={{ borderRadius: 1, p: 2 }}>
      <TableContainer
        sx={{
          background: 'background.default',
          borderRadius: '8px',
        }}
      >
        <Table aria-label="Trading routes">
          <TableHead>
            <TableRow>
              <TableCell>Route Name</TableCell>
              <TableCell align="right">Stops</TableCell>
              <TableCell align="right">Est. Profit</TableCell>
              <TableCell align="right">Duration</TableCell>
              <TableCell align="right">Runs</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {routes.map(route => (
              <TableRow key={route.id} hover>
                <TableCell>
                  <Stack direction="column">
                    <Typography sx={{ fontWeight: 'bold' }}>{route.name}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                      {route.description}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell align="right">{route.stops}</TableCell>
                <TableCell align="right">
                  <Typography sx={{ color: 'success.main', fontWeight: 'bold' }}>
                    {route.estimatedProfit.toLocaleString()} aUEC
                  </Typography>
                </TableCell>
                <TableCell align="right">{route.duration} min</TableCell>
                <TableCell align="right">{route.runCount}</TableCell>
                <TableCell>
                  <Chip
                    label={route.status}
                    size="small"
                    sx={getStatusChipSx(route.status, theme)}
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Tooltip title="Box details" arrow>
                      <IconButton
                        onClick={() => onBox(route)}
                        sx={{ color: 'primary.main' }}
                        aria-label="Box details"
                        disabled={loading}
                        size="small"
                      >
                        <TrendingUpIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit route" arrow>
                      <IconButton
                        onClick={() => onEdit(route)}
                        sx={{ color: 'primary.main' }}
                        aria-label="Edit route"
                        disabled={loading}
                        size="small"
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete route" arrow>
                      <IconButton
                        onClick={() => onDelete(route)}
                        sx={{ color: 'error.main' }}
                        aria-label="Delete route"
                        disabled={loading}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
