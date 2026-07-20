/**
 * Security Logs Component
 * Displays security events with all user data obfuscated
 */

import { Item } from '@/components/ui/Item';
import { Select } from '@/components/ui/Select';
import { adminKeys } from '@/hooks/queries/queryKeys';
import { apiClient } from '@/services/apiClient';
import {
  adminTableContainerStyles,
  adminTableDataCellStyles,
  adminTableHeaderCellStyles,
} from '@/utils/adminTableStyles';
import { logger } from '@/utils/logger';
import { Info } from '@mui/icons-material';
import {
  Box,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  userHash: string;
  action: string;
  outcome: 'success' | 'failure';
  ipAddress?: string;
}

export const SecurityLogs: React.FC = () => {
  const [severityFilter, setSeverityFilter] = useState<'all' | 'info' | 'warning' | 'critical'>(
    'all'
  );
  const [typeFilter, setTypeFilter] = useState<'all' | 'login' | 'permission' | 'data' | 'admin'>(
    'all'
  );

  const {
    data: rawData,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: adminKeys.securityLogs(),
    queryFn: async () => {
      try {
        const response = await apiClient.get('/api/v2/admin/security/logs?limit=100');
        const data = response.data;
        return Array.isArray(data) ? (data as SecurityEvent[]) : [];
      } catch (err) {
        logger.error(
          'Failed to fetch security logs:',
          err instanceof Error ? err : new Error(String(err))
        );
        throw err;
      }
    },
  });

  const events = rawData ?? [];
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  const _getSeverityVariant = (severity: string): 'negative' | 'notice' | 'info' => {
    switch (severity) {
      case 'critical':
        return 'negative';
      case 'warning':
        return 'notice';
      default:
        return 'info';
    }
  };

  const filteredEvents = events.filter(event => {
    if (severityFilter !== 'all' && event.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && !event.type.includes(typeFilter)) return false;
    return true;
  });

  if (loading) {
    return (
      <Stack justifyContent="center" alignItems="center" height={200}>
        <CircularProgress aria-label="Loading security logs" size={24} />
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack justifyContent="center" alignItems="center" height={200}>
        <Typography color="error">{error}</Typography>
      </Stack>
    );
  }

  return (
    <Box>
      <Box sx={{ borderRadius: 1, p: 2, borderColor: 'primary.main', marginBottom: '24px' }}>
        <Stack direction="row" gap={1} alignItems="center">
          <Info sx={{ color: 'primary.main' }} />
          <Typography>
            <strong>Privacy Protected:</strong> All user identities are hashed. User hashes allow
            tracking patterns without revealing actual user information.
          </Typography>
        </Stack>
      </Box>

      <Stack direction="row" gap={2} sx={{ marginBottom: 3, flexWrap: 'wrap' }}>
        <Select
          label="Severity"
          value={severityFilter}
          onSelectionChange={key =>
            setSeverityFilter(key as 'all' | 'info' | 'warning' | 'critical')
          }
        >
          <Item key="all">All Severities</Item>
          <Item key="info">Info</Item>
          <Item key="warning">Warning</Item>
          <Item key="critical">Critical</Item>
        </Select>

        <Select
          label="Event Type"
          value={typeFilter}
          onSelectionChange={key =>
            setTypeFilter(key as 'all' | 'login' | 'permission' | 'data' | 'admin')
          }
        >
          <Item key="all">All Types</Item>
          <Item key="login">Login Events</Item>
          <Item key="permission">Permission Events</Item>
          <Item key="data">Data Access</Item>
          <Item key="admin">Admin Actions</Item>
        </Select>
      </Stack>

      <Box sx={{ borderRadius: 1, p: 2 }}>
        <Box sx={adminTableContainerStyles}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={adminTableHeaderCellStyles('left')}>Timestamp</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('left')}>Severity</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('left')}>Type</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('left')}>User Hash</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('left')}>Action</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('left')}>Outcome</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('left')}>IP Address</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEvents.map(event => (
                <TableRow key={event.id}>
                  <TableCell sx={adminTableDataCellStyles('left')}>
                    {new Date(event.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell sx={adminTableDataCellStyles('left')}>
                    <Typography>{event.severity}</Typography>
                  </TableCell>
                  <TableCell sx={adminTableDataCellStyles('left')}>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {event.type}
                    </Typography>
                  </TableCell>
                  <TableCell sx={adminTableDataCellStyles('left')}>
                    <Typography
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        color: 'text.secondary',
                      }}
                    >
                      {event.userHash.substring(0, 12)}...
                    </Typography>
                  </TableCell>
                  <TableCell sx={adminTableDataCellStyles('left')}>{event.action}</TableCell>
                  <TableCell sx={adminTableDataCellStyles('left')}>
                    <Typography>{event.outcome}</Typography>
                  </TableCell>
                  <TableCell sx={adminTableDataCellStyles('left')}>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {event.ipAddress || 'N/A'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Box>

      {filteredEvents.length === 0 && (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary' }}>
            No security events found matching the selected filters.
          </Typography>
        </Box>
      )}
    </Box>
  );
};
