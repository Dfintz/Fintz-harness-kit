/**
 * Organization Deletion Approvals Admin Component (simplified)
 * Displays pending deletion requests with a header, loading, error, and table.
 */

import { adminKeys } from '@/hooks/queries/queryKeys';
import { organizationDeletionService } from '@/services/organizationDeletionService';
import { logger } from '@/utils/logger';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import React from 'react';

export const OrganizationDeletionApprovals: React.FC = () => {
  const {
    data: rawData,
    isLoading: loading,
    error: queryError,
    refetch: fetchPendingRequests,
  } = useQuery({
    queryKey: adminKeys.deletionApprovals(),
    queryFn: async () => {
      try {
        const data = await organizationDeletionService.getPendingDeletionRequests();
        return data || [];
      } catch (err) {
        logger.error(
          'Failed to fetch deletion requests',
          err instanceof Error ? err : new Error(String(err))
        );
        throw err;
      }
    },
    refetchInterval: 30000,
  });

  const requests = rawData ?? [];
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : 'Failed to fetch deletion requests'
    : null;

  return (
    <Box>
      <Stack direction="column" gap={2}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Organization Deletion Requests</Typography>
          <Stack direction="row" gap={1} alignItems="center">
            <Typography>{requests.length}</Typography>
            <Typography>Pending Requests</Typography>
            <Button variant="outlined" onClick={() => fetchPendingRequests()} aria-label="Refresh">
              Refresh
            </Button>
          </Stack>
        </Stack>

        {/* Loading */}
        {loading && (
          <Stack alignItems="center">
            <CircularProgress />
          </Stack>
        )}

        {/* Error */}
        {error && (
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Stack direction="row" gap={2} alignItems="center">
              <Typography color="error">{error}</Typography>
              <Button variant="contained" onClick={() => fetchPendingRequests()} aria-label="Retry">
                Retry
              </Button>
            </Stack>
          </Box>
        )}

        {/* Empty State */}
        {!loading && !error && requests.length === 0 && (
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography>No Pending Requests</Typography>
            <Typography>All deletion requests have been processed</Typography>
          </Box>
        )}

        {/* Table */}
        {!loading && !error && requests.length > 0 && (
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <TableContainer>
              <Table size="small" aria-label="Organization deletion requests">
                <TableHead>
                  <TableRow>
                    <TableCell>Organization</TableCell>
                    <TableCell>Requested By</TableCell>
                    <TableCell>Requested</TableCell>
                    <TableCell>Grace Period</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map(req => (
                    <TableRow key={req.id}>
                      <TableCell>
                        {req.deletionPreview?.organizationName || req.organizationId}
                      </TableCell>
                      <TableCell>{req.requester?.username || req.requestedBy}</TableCell>
                      <TableCell>{new Date(req.requestedAt).toLocaleDateString()}</TableCell>
                      <TableCell>{req.gracePeriodDays} days</TableCell>
                      <TableCell>{(req.status || '').toUpperCase()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Stack>
    </Box>
  );
};
