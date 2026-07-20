/**
 * Audit Log Viewer Component
 * Displays platform-wide audit events with filtering, statistics, and export.
 * Uses the /api/v2/audit/* endpoints (distinct from SecurityLogs which uses /admin/security/logs).
 */

import { Item } from '@/components/ui/Item';
import { Select } from '@/components/ui/Select';
import { useAuditLogs, useAuditStatistics } from '@/hooks/queries/useAuditQueries';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import {
  AUDIT_LOG_FILTER_DEFAULTS,
  buildAuditLogQueryFilters,
  parseAuditLogFilters,
} from '@/pages/admin/components/auditLogFilters';
import {
  AuditCategory,
  auditService,
  AuditSeverity,
  type AuditLogEntry,
} from '@/services/auditService';
import {
  adminTableContainerStyles,
  adminTableDataCellStyles,
  adminTableHeaderCellStyles,
} from '@/utils/adminTableStyles';
import { logger } from '@/utils/logger';
import {
  Close,
  Download,
  FilterList,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Search,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useCallback, useMemo, useState } from 'react';

const PAGE_SIZE = 25;

const severityColorMap: Record<string, 'error' | 'warning' | 'info' | 'success'> = {
  CRITICAL: 'error',
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'info',
};

export const AuditLogViewer: React.FC = () => {
  const theme = useTheme();
  const { filters: urlFilters, updateFilters } = useUrlFilters({
    parse: parseAuditLogFilters,
    defaults: AUDIT_LOG_FILTER_DEFAULTS,
    paginationKeys: ['offset'] as const,
  });
  const apiFilters = useMemo(() => buildAuditLogQueryFilters(urlFilters), [urlFilters]);
  const [draftUserId, setDraftUserId] = useState(urlFilters.userId);
  const [draftAction, setDraftAction] = useState(urlFilters.action);
  const [draftCorrelationId, setDraftCorrelationId] = useState(urlFilters.correlationId);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: logs, isLoading, error } = useAuditLogs(apiFilters);
  const { data: statistics } = useAuditStatistics();

  const handleApplyFilters = useCallback(() => {
    updateFilters({
      userId: draftUserId,
      action: draftAction,
      correlationId: draftCorrelationId,
    });
  }, [draftUserId, draftAction, draftCorrelationId, updateFilters]);

  const handleCategoryChange = useCallback(
    (key: React.Key) => {
      updateFilters({ category: String(key) as typeof urlFilters.category });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- urlFilters used only in type position
    [updateFilters]
  );

  const handleSeverityChange = useCallback(
    (key: React.Key) => {
      updateFilters({ severity: String(key) as typeof urlFilters.severity });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- urlFilters used only in type position
    [updateFilters]
  );

  const handleNextPage = useCallback(() => {
    updateFilters({ offset: urlFilters.offset + PAGE_SIZE });
  }, [updateFilters, urlFilters.offset]);

  const handlePrevPage = useCallback(() => {
    updateFilters({ offset: Math.max(0, urlFilters.offset - PAGE_SIZE) });
  }, [updateFilters, urlFilters.offset]);

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      const result = await auditService.exportLogs({
        startDate: apiFilters.startDate,
        endDate: apiFilters.endDate,
        category: apiFilters.category,
      });
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error(
        'Failed to export audit logs',
        err instanceof Error ? err : new Error(String(err))
      );
    } finally {
      setExporting(false);
    }
  }, [apiFilters.startDate, apiFilters.endDate, apiFilters.category]);

  const currentPage = Math.floor(urlFilters.offset / PAGE_SIZE) + 1;
  const hasMore = (logs?.length ?? 0) === PAGE_SIZE;

  return (
    <Box>
      {/* Statistics Summary */}
      {statistics?.total != null && (
        <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mb: 3 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography variant="h5" component="span" sx={{ display: 'block' }}>
              {statistics.total.toLocaleString()}
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
              Total Events
            </Typography>
          </Box>
          {Object.entries(statistics.bySeverity).map(([severity, count]) => (
            <Box sx={{ borderRadius: 1, p: 2 }} key={severity}>
              <Stack direction="row" gap={1} alignItems="center">
                <Chip
                  label={severity}
                  color={severityColorMap[severity] ?? 'default'}
                  size="small"
                />
                <Typography variant="h6" component="span">
                  {(count as number).toLocaleString()}
                </Typography>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {/* Filter Bar */}
      <Box sx={{ borderRadius: 1, p: 2, mb: 3 }}>
        <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 2 }}>
          <FilterList sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle2" fontWeight={600}>
            Filters
          </Typography>
        </Stack>
        <Stack direction="row" gap={2} flexWrap="wrap" alignItems="flex-end">
          <Select
            label="Category"
            value={urlFilters.category}
            onSelectionChange={handleCategoryChange}
          >
            <Item key="all">All Categories</Item>
            {Object.values(AuditCategory).map(cat => (
              <Item key={cat}>{cat.replace(/_/g, ' ')}</Item>
            ))}
          </Select>

          <Select
            label="Severity"
            value={urlFilters.severity}
            onSelectionChange={handleSeverityChange}
          >
            <Item key="all">All Severities</Item>
            {Object.values(AuditSeverity).map(sev => (
              <Item key={sev}>{sev}</Item>
            ))}
          </Select>

          <TextField
            label="User ID"
            size="small"
            value={draftUserId}
            onChange={e => setDraftUserId(e.target.value)}
            sx={{ minWidth: 160 }}
          />
          <TextField
            label="Action"
            size="small"
            value={draftAction}
            onChange={e => setDraftAction(e.target.value)}
            sx={{ minWidth: 160 }}
          />
          <TextField
            label="Correlation ID"
            size="small"
            value={draftCorrelationId}
            onChange={e => setDraftCorrelationId(e.target.value)}
            sx={{ minWidth: 200 }}
          />

          <Button variant="contained" startIcon={<Search />} onClick={handleApplyFilters}>
            Search
          </Button>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </Stack>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load audit logs
        </Alert>
      )}

      {/* Loading */}
      {isLoading && (
        <Stack justifyContent="center" alignItems="center" sx={{ py: 6 }}>
          <CircularProgress aria-label="Loading audit logs" size={40} />
        </Stack>
      )}

      {/* Results Table */}
      {!isLoading && logs && (
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Box sx={adminTableContainerStyles}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={adminTableHeaderCellStyles('left')}>Timestamp</TableCell>
                  <TableCell sx={adminTableHeaderCellStyles('left')}>Severity</TableCell>
                  <TableCell sx={adminTableHeaderCellStyles('left')}>Category</TableCell>
                  <TableCell sx={adminTableHeaderCellStyles('left')}>Action</TableCell>
                  <TableCell sx={adminTableHeaderCellStyles('left')}>User</TableCell>
                  <TableCell sx={adminTableHeaderCellStyles('left')}>Message</TableCell>
                  <TableCell sx={adminTableHeaderCellStyles('left')}>Resource</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map(entry => (
                  <TableRow
                    key={entry.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <TableCell sx={adminTableDataCellStyles('left')}>
                      <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell sx={adminTableDataCellStyles('left')}>
                      <Chip
                        label={entry.severity}
                        color={severityColorMap[entry.severity] ?? 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={adminTableDataCellStyles('left')}>
                      <Typography sx={{ fontSize: '0.85rem' }}>
                        {entry.category.replace(/_/g, ' ')}
                      </Typography>
                    </TableCell>
                    <TableCell sx={adminTableDataCellStyles('left')}>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {entry.action}
                      </Typography>
                    </TableCell>
                    <TableCell sx={adminTableDataCellStyles('left')}>
                      <Typography
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          color: 'text.secondary',
                        }}
                      >
                        {entry.username ?? entry.userId?.slice(0, 12) ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={adminTableDataCellStyles('left')}>
                      <Typography
                        sx={{
                          fontSize: '0.85rem',
                          maxWidth: 300,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.message}
                      </Typography>
                    </TableCell>
                    <TableCell sx={adminTableDataCellStyles('left')}>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {entry.resource ?? '—'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          {/* Pagination */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mt: 2, px: 1 }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Page {currentPage} &bull; Showing {logs.length} entries
            </Typography>
            <Stack direction="row" gap={1}>
              <IconButton size="small" onClick={handlePrevPage} disabled={urlFilters.offset === 0}>
                <KeyboardArrowLeft />
              </IconButton>
              <IconButton size="small" onClick={handleNextPage} disabled={!hasMore}>
                <KeyboardArrowRight />
              </IconButton>
            </Stack>
          </Stack>
        </Box>
      )}

      {/* Empty State */}
      {!isLoading && logs?.length === 0 && (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary' }}>
            No audit events found matching the selected filters.
          </Typography>
        </Box>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onClose={() => setSelectedEntry(null)} maxWidth="md" fullWidth>
        {selectedEntry && (
          <>
            <DialogTitle>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Audit Event Detail</Typography>
                <IconButton size="small" onClick={() => setSelectedEntry(null)}>
                  <Close />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Stack gap={2}>
                <DetailRow label="ID" value={selectedEntry.id} mono />
                <DetailRow
                  label="Timestamp"
                  value={new Date(selectedEntry.timestamp).toLocaleString()}
                />
                <DetailRow label="Correlation ID" value={selectedEntry.correlationId} mono />
                <DetailRow label="Category" value={selectedEntry.category} />
                <DetailRow label="Severity" value={selectedEntry.severity} />
                <DetailRow label="Action" value={selectedEntry.action} mono />
                <DetailRow label="Message" value={selectedEntry.message} />
                <DetailRow label="User ID" value={selectedEntry.userId} mono />
                <DetailRow label="Username" value={selectedEntry.username} />
                <DetailRow label="Organization ID" value={selectedEntry.organizationId} mono />
                <DetailRow label="Resource" value={selectedEntry.resource} mono />
                <DetailRow label="IP Address" value={selectedEntry.ipAddress} mono />
                <DetailRow label="User Agent" value={selectedEntry.userAgent} />
                {selectedEntry.metadata && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      Metadata
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        backgroundColor: theme.palette.action.hover,
                        fontSize: '0.8rem',
                        fontFamily: 'monospace',
                        overflow: 'auto',
                        maxHeight: 300,
                      }}
                    >
                      {JSON.stringify(selectedEntry.metadata, null, 2)}
                    </Box>
                  </Box>
                )}
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
};

interface DetailRowProps {
  label: string;
  value?: string | null;
  mono?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, mono }) => {
  if (!value) return null;
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '0.9rem',
          ...(mono && { fontFamily: 'monospace', fontSize: '0.85rem' }),
        }}
      >
        {value}
      </Typography>
    </Box>
  );
};
