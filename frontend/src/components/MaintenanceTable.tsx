/**
 * Maintenance Table Component
 * Displays ship maintenance records with sortable columns and status chips
 */

import { EmptyState } from '@/components/EmptyState';
import { ErrorMessage } from '@/components/ErrorMessage';
import { DataTable, type DataTableColumn } from '@/components/shared';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useMaintenanceList } from '@/hooks/queries/useShipMaintenanceQueries';
import { getStatusChipSx } from '@/utils/statusStyles';
import AddIcon from '@mui/icons-material/Add';
import BuildIcon from '@mui/icons-material/Build';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, Button, Chip, Stack, Typography, useTheme } from '@mui/material';
import type { ShipMaintenance } from '@sc-fleet-manager/shared-types';
import React from 'react';

interface MaintenanceTableProps {
  onSchedule?: () => void;
  onUpdateStatus?: (record: ShipMaintenance) => void;
}

export const MaintenanceTable: React.FC<Readonly<MaintenanceTableProps>> = ({
  onSchedule,
  onUpdateStatus,
}) => {
  const theme = useTheme();
  const {
    data: records = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useMaintenanceList();

  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return '–';
    return new Date(date).toLocaleDateString();
  };

  const formatCost = (cost: number | undefined): string => {
    if (cost == null) return '–';
    return cost.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const columns: DataTableColumn<ShipMaintenance>[] = [
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
      key: 'maintenanceType',
      header: 'Type',
      sortable: true,
      render: row => (
        <Chip label={row.maintenanceType.toUpperCase()} size="small" variant="outlined" />
      ),
    },
    {
      key: 'scheduledDate',
      header: 'Scheduled',
      sortable: true,
      render: row => formatDate(row.scheduledDate),
    },
    {
      key: 'completedDate',
      header: 'Completed',
      sortable: true,
      render: row => formatDate(row.completedDate),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: row => (
        <Chip
          label={row.status.replace('_', ' ').toUpperCase()}
          size="small"
          sx={{
            ...getStatusChipSx(row.status, theme),
            cursor: onUpdateStatus ? 'pointer' : 'default',
          }}
          onClick={onUpdateStatus ? () => onUpdateStatus(row) : undefined}
        />
      ),
    },
    {
      key: 'cost',
      header: 'Cost',
      sortable: true,
      render: row => formatCost(row.cost),
    },
    {
      key: 'performedBy',
      header: 'Performed By',
      sortable: true,
      render: row => row.performedBy || '–',
    },
  ];

  if (loading) {
    return <TableSkeleton rows={5} columns={7} />;
  }

  if (queryError) {
    return <ErrorMessage message="Failed to load maintenance records" onRetry={() => refetch()} />;
  }

  if (records.length === 0) {
    return (
      <EmptyState
        icon={BuildIcon}
        title="No maintenance records"
        description="No maintenance records found. Schedule maintenance to keep your fleet in top shape."
        actionLabel={onSchedule ? 'Schedule Maintenance' : undefined}
        onAction={onSchedule}
      />
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Maintenance Records</Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>
            Refresh
          </Button>
          {onSchedule && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={onSchedule}>
              Schedule Maintenance
            </Button>
          )}
        </Stack>
      </Stack>

      <DataTable<ShipMaintenance>
        columns={columns}
        data={records}
        getRowKey={row => row.id}
        sortBy="scheduledDate"
      />
    </Box>
  );
};
