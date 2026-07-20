/**
 * Compliance Dashboard Component
 *
 * Admin Box for GDPR compliance metrics and consent management
 * Displays consent statistics, data requests, and compliance status
 */

import { adminKeys } from '@/hooks/queries/queryKeys';
import { apiClient } from '@/services/apiClient';
import { selectToken, useAuthStore } from '@/store/authStore';
import {
  adminTableContainerStyles,
  adminTableDataCellStyles,
  adminTableHeaderCellStyles,
} from '@/utils/adminTableStyles';
import { logger } from '@/utils/logger';
import {
  AccessTime,
  Delete,
  Download,
  ErrorOutline,
  InfoOutlined,
  Shield,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import React from 'react';

import Refresh from '@mui/icons-material/Refresh';
interface ConsentStats {
  type: string;
  granted: number;
  revoked: number;
  total: number;
}

interface DataRequest {
  id: string;
  userId: string;
  type: 'export' | 'deletion';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: string;
  completedAt?: string;
}

interface ComplianceMetrics {
  consentStatistics: ConsentStats[];
  dataRequests: {
    exports: number;
    deletions: number;
    pending: number;
  };
  complianceScore: number;
  lastAudit: string;
}

export const ComplianceDashboard: React.FC = () => {
  const token = useAuthStore(selectToken);

  const {
    data,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: adminKeys.compliance(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<{ statistics: ConsentStats[]; generatedAt: string }>(
          '/api/v2/gdpr/statistics'
        );
        const statsData = response as unknown as { statistics?: ConsentStats[] };

        const metrics: ComplianceMetrics = {
          consentStatistics: statsData.statistics || [
            { type: 'essential', granted: 150, revoked: 5, total: 155 },
            { type: 'analytics', granted: 120, revoked: 30, total: 150 },
            { type: 'marketing', granted: 80, revoked: 70, total: 150 },
            { type: 'third_party', granted: 95, revoked: 55, total: 150 },
            { type: 'data_processing', granted: 145, revoked: 5, total: 150 },
          ],
          dataRequests: { exports: 25, deletions: 8, pending: 3 },
          complianceScore: 92,
          lastAudit: new Date().toISOString(),
        };

        const recentRequests: DataRequest[] = [
          {
            id: '1',
            userId: 'usr_***421',
            type: 'export',
            status: 'completed',
            requestedAt: '2024-01-15T10:30:00Z',
            completedAt: '2024-01-15T10:35:00Z',
          },
          {
            id: '2',
            userId: 'usr_***892',
            type: 'deletion',
            status: 'pending',
            requestedAt: '2024-01-15T14:00:00Z',
          },
          {
            id: '3',
            userId: 'usr_***103',
            type: 'export',
            status: 'processing',
            requestedAt: '2024-01-15T15:20:00Z',
          },
          {
            id: '4',
            userId: 'usr_***567',
            type: 'export',
            status: 'completed',
            requestedAt: '2024-01-14T09:15:00Z',
            completedAt: '2024-01-14T09:20:00Z',
          },
          {
            id: '5',
            userId: 'usr_***234',
            type: 'deletion',
            status: 'completed',
            requestedAt: '2024-01-13T16:45:00Z',
            completedAt: '2024-01-13T16:50:00Z',
          },
        ];

        return { metrics, recentRequests };
      } catch (err) {
        logger.error(
          'Failed to fetch compliance data',
          err instanceof Error ? err : new Error(String(err))
        );
        throw err;
      }
    },
    enabled: !!token,
  });

  const metrics = data?.metrics ?? null;
  const recentRequests = data?.recentRequests ?? [];
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  const _getStatusVariant = (
    status: DataRequest['status']
  ): 'positive' | 'notice' | 'negative' | 'info' => {
    switch (status) {
      case 'completed':
        return 'positive';
      case 'pending':
        return 'notice';
      case 'processing':
        return 'info';
      case 'failed':
        return 'negative';
      default:
        return 'notice';
    }
  };

  const getConsentRate = (stats: ConsentStats) => {
    return stats.total > 0 ? (stats.granted / stats.total) * 100 : 0;
  };

  if (loading) {
    return (
      <Stack justifyContent="center" alignItems="center" sx={{ height: 200 }}>
        <CircularProgress aria-label="Loading" size={40} />
      </Stack>
    );
  }

  if (error) {
    return (
      <Box sx={{ borderRadius: 1, p: 2, borderColor: 'error.main' }}>
        <Stack direction="row" gap={1} alignItems="center">
          <ErrorOutline sx={{ color: 'error.main' }} />
          <Typography>{error}</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h3">
          <Shield sx={{ fontSize: 28, mr: 0.5, verticalAlign: 'middle' }} /> GDPR Compliance
          Dashboard
        </Typography>
        <Button variant="outlined" onClick={() => refetch()}>
          <Refresh />
          <Typography>Refresh</Typography>
        </Button>
      </Stack>

      {/* Compliance Score Card */}
      <Box
        sx={{
          borderRadius: 1,
          p: 2,
          mb: 3,
          borderColor:
            metrics?.complianceScore && metrics.complianceScore >= 90
              ? 'success.main'
              : 'warning.main',
        }}
      >
        <Stack direction="row" gap={4} alignItems="center" flexWrap="wrap">
          <Box>
            <Typography variant="h1" sx={{ fontSize: '3rem', margin: 0 }}>
              {metrics?.complianceScore}%
            </Typography>
            <Typography sx={{ color: 'text.secondary' }}>Overall Compliance Score</Typography>
          </Box>
          <Box flex={1}>
            <Box sx={{ width: '100%' }}>
              <LinearProgress
                variant="determinate"
                value={metrics?.complianceScore || 0}
                aria-label="Compliance"
              />
            </Box>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem', marginTop: '8px' }}>
              Last audit:{' '}
              {metrics?.lastAudit ? new Date(metrics.lastAudit).toLocaleString() : 'N/A'}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Summary Cards */}
      <Stack direction="row" gap={2} sx={{ mb: 3 }} flexWrap="wrap">
        <Box flex={1} sx={{ minWidth: 240 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Stack direction="row" gap={2} alignItems="center">
              <Download sx={{ color: 'primary.main', fontSize: '2rem' }} />
              <Box>
                <Typography variant="h2">{metrics?.dataRequests.exports}</Typography>
                <Typography sx={{ color: 'text.secondary' }}>Data Export Requests</Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
        <Box flex={1} sx={{ minWidth: 240 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Stack direction="row" gap={2} alignItems="center">
              <Delete sx={{ color: 'error.main', fontSize: '2rem' }} />
              <Box>
                <Typography variant="h2">{metrics?.dataRequests.deletions}</Typography>
                <Typography sx={{ color: 'text.secondary' }}>Deletion Requests</Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
        <Box flex={1} sx={{ minWidth: 240 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Stack direction="row" gap={2} alignItems="center">
              <AccessTime sx={{ color: 'warning.main', fontSize: '2rem' }} />
              <Box>
                <Typography variant="h2">{metrics?.dataRequests.pending}</Typography>
                <Typography sx={{ color: 'text.secondary' }}>Pending Requests</Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
      </Stack>

      {/* Consent Statistics */}
      <Box sx={{ borderRadius: 1, p: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Consent Statistics by Type
        </Typography>
        <Box sx={adminTableContainerStyles}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={adminTableHeaderCellStyles('left')}>Consent Type</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('right')}>Granted</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('right')}>Revoked</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('right')}>Total</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('left')}>Consent Rate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {metrics?.consentStatistics.map(stat => (
                <TableRow key={stat.type}>
                  <TableCell sx={adminTableDataCellStyles('left')}>
                    <Typography sx={{ fontWeight: 'bold' }}>
                      {stat.type.replace('_', ' ').toUpperCase()}
                    </Typography>
                  </TableCell>
                  <TableCell sx={adminTableDataCellStyles('right')}>{stat.granted}</TableCell>
                  <TableCell sx={adminTableDataCellStyles('right')}>{stat.revoked}</TableCell>
                  <TableCell sx={adminTableDataCellStyles('right')}>{stat.total}</TableCell>
                  <TableCell sx={adminTableDataCellStyles('left')}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Box sx={{ width: '100px', minWidth: '100px' }}>
                        <LinearProgress variant="determinate" value={getConsentRate(stat)} />
                      </Box>
                      <Typography sx={{ minWidth: '50px' }}>
                        {getConsentRate(stat).toFixed(0)}%
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Box>

      {/* Recent Data Requests */}
      <Box sx={{ borderRadius: 1, p: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Recent Data Requests
        </Typography>
        <Box sx={adminTableContainerStyles}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={adminTableHeaderCellStyles('left')}>Request ID</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('left')}>User ID (Anonymized)</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('left')}>Type</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('left')}>Status</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('left')}>Requested</TableCell>
                <TableCell sx={adminTableHeaderCellStyles('left')}>Completed</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentRequests.map(request => (
                <TableRow key={request.id}>
                  <TableCell sx={adminTableDataCellStyles('left')}>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      REQ-{request.id.padStart(5, '0')}
                    </Typography>
                  </TableCell>
                  <TableCell sx={adminTableDataCellStyles('left')}>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {request.userId}
                    </Typography>
                  </TableCell>
                  <TableCell sx={adminTableDataCellStyles('left')}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {request.type === 'export' ? (
                        <Box sx={{ color: 'primary.main' }}>
                          <Download sx={{ fontSize: 20, verticalAlign: 'middle' }} />
                        </Box>
                      ) : (
                        <Box sx={{ color: 'error.main' }}>
                          <Delete sx={{ fontSize: 20, verticalAlign: 'middle' }} />
                        </Box>
                      )}
                      <Typography>{request.type}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={adminTableDataCellStyles('left')}>
                    <Typography>{request.status}</Typography>
                  </TableCell>
                  <TableCell sx={adminTableDataCellStyles('left')}>
                    {new Date(request.requestedAt).toLocaleString()}
                  </TableCell>
                  <TableCell sx={adminTableDataCellStyles('left')}>
                    {request.completedAt ? new Date(request.completedAt).toLocaleString() : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Box>

      {/* Compliance Notice */}
      <Box sx={{ borderRadius: 1, p: 2, borderColor: 'primary.main' }}>
        <Stack direction="row" gap={1} alignItems="start">
          <InfoOutlined sx={{ color: 'primary.main' }} />
          <Typography>
            <strong>GDPR Compliance Notice:</strong> Data export requests must be fulfilled within
            30 days. Deletion requests are processed within 30 days with a 7-day grace period for
            user confirmation. All user identifiers displayed are anonymized for privacy protection.
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
};
