/**
 * Ship Loans Table Component
 * Displays active and pending ship loans with status chips
 */

import { EmptyState } from '@/components/EmptyState';
import { ErrorMessage } from '@/components/ErrorMessage';
import { DataTable, type DataTableColumn } from '@/components/shared';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { shipLoanService } from '@/services/shipLoanService';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { Box, Button, Chip, Stack, Typography, useTheme } from '@mui/material';
import type { ShipLoan } from '@sc-fleet-manager/shared-types';
import React, { useCallback, useEffect, useState } from 'react';

interface ShipLoansTableProps {
  onRequestLoan?: () => void;
}

export const ShipLoansTable: React.FC<ShipLoansTableProps> = ({ onRequestLoan }) => {
  const theme = useTheme();
  const [loans, setLoans] = useState<ShipLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLoans = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await shipLoanService.list();
      setLoans(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load ship loans';
      setError(message);
      logger.error(
        'Failed to fetch ship loans',
        err instanceof Error ? err : new Error(String(err))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const columns: DataTableColumn<ShipLoan>[] = [
    {
      key: 'shipId',
      header: 'Ship ID',
      sortable: true,
      render: row => (
        <Typography variant="body2" fontWeight="medium">
          {row.shipId}
        </Typography>
      ),
    },
    {
      key: 'borrowerId',
      header: 'Borrower ID',
      sortable: true,
      render: row => <Typography variant="body2">{row.borrowerId}</Typography>,
    },
    {
      key: 'lenderId',
      header: 'Lender ID',
      sortable: true,
      render: row => <Typography variant="body2">{row.lenderId}</Typography>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: row => (
        <Chip
          label={row.status.toUpperCase()}
          size="small"
          sx={getStatusChipSx(row.status, theme)}
        />
      ),
    },
    {
      key: 'startDate',
      header: 'Start Date',
      sortable: true,
      render: row => (row.startDate ? new Date(row.startDate).toLocaleDateString() : 'Not started'),
    },
    {
      key: 'expectedReturnDate',
      header: 'Expected Return',
      sortable: true,
      render: row => new Date(row.expectedReturnDate).toLocaleDateString(),
    },
    {
      key: 'actualReturnDate',
      header: 'Returned',
      render: row =>
        row.actualReturnDate ? new Date(row.actualReturnDate).toLocaleDateString() : '–',
    },
  ];

  if (loading) {
    return <TableSkeleton rows={5} columns={7} />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchLoans} />;
  }

  if (loans.length === 0) {
    return (
      <EmptyState
        icon={RocketLaunchIcon}
        title="No ship loans"
        description="No ship loans have been created yet. Request a loan to get started."
        actionLabel={onRequestLoan ? 'Request Loan' : undefined}
        onAction={onRequestLoan}
      />
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Ship Loans</Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchLoans}>
            Refresh
          </Button>
          {onRequestLoan && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={onRequestLoan}>
              Request Loan
            </Button>
          )}
        </Stack>
      </Stack>

      <DataTable<ShipLoan>
        columns={columns}
        data={loans}
        getRowKey={row => row.id}
        sortBy="startDate"
      />
    </Box>
  );
};
