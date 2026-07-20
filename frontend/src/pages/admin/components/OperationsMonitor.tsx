/**
 * Operations Monitor Component
 * Aggregated view of Discord bot commands, scheduled jobs, and data fetchers
 * with success/failure stats and error details.
 */

import { adminKeys } from '@/hooks/queries/queryKeys';
import { apiClient, isApiClientError } from '@/services/apiClient';
import {
  adminTableContainerStyles,
  adminTableDataCellCompactStyles,
  adminTableHeaderCellCompactStyles,
} from '@/utils/adminTableStyles';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import StorageIcon from '@mui/icons-material/Storage';
import SyncIcon from '@mui/icons-material/Sync';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import WorkIcon from '@mui/icons-material/Work';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BotCommandStats {
  totalCommands: number;
  totalSuccessful: number;
  totalFailed: number;
  successRate: number;
  averageExecutionTime: number;
  uniqueUsers: number;
  uniqueGuilds: number;
  topCommands: Array<{ command: string; count: number }>;
  recentErrors: Array<{ commandName: string; error: string; timestamp: string }>;
  perCommand: Array<{
    commandName: string;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    lastUsed: string;
  }>;
}

interface JobStatus {
  jobId: string;
  name: string;
  category: string;
  enabled: boolean;
  isRunning: boolean;
  health: string;
  description?: string;
  schedule?: string;
  lastExecution?: {
    status: string;
    startedAt: string;
    duration?: number;
    error?: string;
  };
  statistics: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRate: number;
    averageDuration: number;
  };
}

interface JobOverview {
  totalJobs: number;
  enabledJobs: number;
  runningJobs: number;
  healthSummary: { healthy: number; degraded: number; unhealthy: number; unknown: number };
  jobs: JobStatus[];
  recentExecutions: Array<{
    jobId: string;
    status: string;
    startedAt: string;
    duration?: number;
    error?: string;
  }>;
}

interface FetcherStatus {
  name: string;
  isRunning: boolean;
  lastRun?: {
    success: boolean;
    timestamp: string;
    error?: string;
    details?: Record<string, unknown>;
  };
  isStale: boolean;
}

interface OperationsOverviewData {
  botCommands: BotCommandStats;
  jobs: JobOverview;
  fetchers: { fetchers: FetcherStatus[] };
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number | undefined): string {
  if (ms === undefined || ms === null) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatRelativeTime(timestamp: string | undefined): string {
  if (!timestamp) return '-';
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function mapJobHealthToChipStatus(health: string): string {
  if (health === 'healthy') return 'success';
  if (health === 'degraded') return 'warning';
  if (health === 'unhealthy') return 'failed';
  if (health === 'disabled') return 'disabled';
  return 'unknown';
}

function mapExecutionStatusToChipStatus(status: string): string {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'failed';
  return status;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SummaryCard: React.FC<
  Readonly<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sublabel?: string;
    color: string;
  }>
> = ({ icon, label, value, sublabel, color }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 1,
        border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
        backgroundColor: alpha(color, 0.04),
        flex: 1,
        minWidth: 180,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ color }}>{icon}</Box>
        <Box>
          <Typography variant="h5" component="span" sx={{ display: 'block', fontWeight: 700 }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {label}
          </Typography>
          {sublabel && (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {sublabel}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const OperationsMonitor: React.FC = () => {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const {
    data: overview,
    isLoading,
    error,
  } = useQuery({
    queryKey: adminKeys.operationsOverview(),
    queryFn: async () => {
      try {
        return await apiClient.getData<OperationsOverviewData>('/api/v2/admin/operations/overview');
      } catch (err) {
        logger.error(
          'Failed to fetch operations overview:',
          err instanceof Error ? err : new Error(String(err))
        );
        throw err;
      }
    },
    refetchInterval: 30_000,
  });

  const triggerJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiClient.postData<{ jobId: string; execution?: Record<string, unknown> }>(
        `/api/v2/admin/operations/jobs/${encodeURIComponent(jobId)}/trigger`,
        {}
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.operationsOverview() });
    },
  });

  const toggleJobMutation = useMutation({
    mutationFn: async ({ jobId, enabled }: { jobId: string; enabled: boolean }) => {
      const action = enabled ? 'enable' : 'disable';
      return apiClient.postData(
        `/api/v2/admin/operations/jobs/${encodeURIComponent(jobId)}/${action}`,
        {}
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.operationsOverview() });
    },
  });

  const handleTriggerJob = (jobId: string) => {
    triggerJobMutation.mutate(jobId);
  };

  const handleToggleJob = (jobId: string, currentEnabled: boolean) => {
    toggleJobMutation.mutate({ jobId, enabled: !currentEnabled });
  };

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: adminKeys.operationsOverview() });
  };

  if (isLoading) {
    return (
      <Stack justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress aria-label="Loading operations data" size={40} />
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load operations overview. {error instanceof Error ? error.message : ''}
      </Alert>
    );
  }

  if (!overview) return null;

  const { botCommands, jobs, fetchers } = overview;

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" fontWeight={700}>
          Operations Monitor
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* ================================================================
          SECTION 1: Discord Bot Commands
          ================================================================ */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <SmartToyIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Discord Bot Commands
            </Typography>
            {botCommands.totalFailed > 0 && (
              <Chip
                label={`${botCommands.totalFailed} failed`}
                size="small"
                sx={getStatusChipSx('failed', theme)}
              />
            )}
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          {/* Summary row */}
          <Stack direction="row" spacing={2} flexWrap="wrap" mb={3}>
            <SummaryCard
              icon={<SmartToyIcon />}
              label="Total Commands"
              value={botCommands.totalCommands}
              sublabel={`${botCommands.uniqueUsers} users, ${botCommands.uniqueGuilds} guilds`}
              color={theme.palette.primary.main}
            />
            <SummaryCard
              icon={<CheckCircleOutlineIcon />}
              label="Success Rate"
              value={`${botCommands.successRate}%`}
              sublabel={`${botCommands.totalSuccessful} succeeded`}
              color={theme.palette.success.main}
            />
            <SummaryCard
              icon={<ErrorOutlineIcon />}
              label="Failed"
              value={botCommands.totalFailed}
              sublabel={`avg ${formatDuration(botCommands.averageExecutionTime)}`}
              color={theme.palette.error.main}
            />
          </Stack>

          {/* Per-command table */}
          {botCommands.perCommand.length > 0 && (
            <Box mb={3}>
              <Typography variant="subtitle2" mb={1} fontWeight={600}>
                Command Breakdown
              </Typography>
              <TableContainer sx={adminTableContainerStyles}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={adminTableHeaderCellCompactStyles()}>Command</TableCell>
                      <TableCell sx={adminTableHeaderCellCompactStyles('right')}>Total</TableCell>
                      <TableCell sx={adminTableHeaderCellCompactStyles('right')}>Success</TableCell>
                      <TableCell sx={adminTableHeaderCellCompactStyles('right')}>Failed</TableCell>
                      <TableCell sx={adminTableHeaderCellCompactStyles('right')}>
                        Avg Time
                      </TableCell>
                      <TableCell sx={adminTableHeaderCellCompactStyles('right')}>
                        Last Used
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {botCommands.perCommand.map(cmd => (
                      <TableRow key={cmd.commandName}>
                        <TableCell sx={adminTableDataCellCompactStyles()}>
                          <Typography variant="body2" fontFamily="monospace">
                            /{cmd.commandName}
                          </Typography>
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles('right')}>
                          {cmd.totalExecutions}
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles('right')}>
                          <Typography variant="body2" sx={{ color: 'success.main' }}>
                            {cmd.successfulExecutions}
                          </Typography>
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles('right')}>
                          <Typography
                            variant="body2"
                            sx={{
                              color: cmd.failedExecutions > 0 ? 'error.main' : 'text.secondary',
                            }}
                          >
                            {cmd.failedExecutions}
                          </Typography>
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles('right')}>
                          {formatDuration(cmd.averageExecutionTime)}
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles('right')}>
                          {formatRelativeTime(cmd.lastUsed)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Recent Errors */}
          {botCommands.recentErrors.length > 0 && (
            <Box>
              <Typography variant="subtitle2" mb={1} fontWeight={600} sx={{ color: 'error.main' }}>
                Recent Errors ({botCommands.recentErrors.length})
              </Typography>
              <TableContainer sx={adminTableContainerStyles}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={adminTableHeaderCellCompactStyles()}>Command</TableCell>
                      <TableCell sx={adminTableHeaderCellCompactStyles()}>Error</TableCell>
                      <TableCell sx={adminTableHeaderCellCompactStyles('right')}>When</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {botCommands.recentErrors.slice(0, 20).map((err, idx) => (
                      <TableRow key={`${err.commandName}-${idx}`}>
                        <TableCell sx={adminTableDataCellCompactStyles()}>
                          <Typography variant="body2" fontFamily="monospace">
                            /{err.commandName}
                          </Typography>
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles()}>
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'error.main',
                              maxWidth: 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {err.error}
                          </Typography>
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles('right')}>
                          {formatRelativeTime(err.timestamp)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {botCommands.totalCommands === 0 && (
            <Alert severity="info">No bot command data available yet.</Alert>
          )}
        </AccordionDetails>
      </Accordion>

      {/* ================================================================
          SECTION 2: Scheduled Jobs
          ================================================================ */}
      <Accordion defaultExpanded sx={{ mt: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <WorkIcon sx={{ color: 'secondary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Scheduled Jobs
            </Typography>
            {jobs.healthSummary.unhealthy > 0 && (
              <Chip
                label={`${jobs.healthSummary.unhealthy} unhealthy`}
                size="small"
                sx={getStatusChipSx('failed', theme)}
              />
            )}
            {jobs.healthSummary.degraded > 0 && (
              <Chip
                label={`${jobs.healthSummary.degraded} degraded`}
                size="small"
                sx={getStatusChipSx('warning', theme)}
              />
            )}
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          {/* Summary row */}
          <Stack direction="row" spacing={2} flexWrap="wrap" mb={3}>
            <SummaryCard
              icon={<WorkIcon />}
              label="Registered Jobs"
              value={jobs.totalJobs}
              sublabel={`${jobs.enabledJobs} enabled, ${jobs.runningJobs} running`}
              color={theme.palette.secondary.main}
            />
            <SummaryCard
              icon={<CheckCircleOutlineIcon />}
              label="Healthy"
              value={jobs.healthSummary.healthy}
              color={theme.palette.success.main}
            />
            <SummaryCard
              icon={<WarningAmberIcon />}
              label="Degraded / Unhealthy"
              value={jobs.healthSummary.degraded + jobs.healthSummary.unhealthy}
              color={
                jobs.healthSummary.unhealthy > 0
                  ? theme.palette.error.main
                  : theme.palette.warning.main
              }
            />
          </Stack>

          {/* Mutation feedback */}
          {triggerJobMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to trigger job.{' '}
              {isApiClientError(triggerJobMutation.error) ? triggerJobMutation.error.message : ''}
            </Alert>
          )}

          {/* Job table */}
          {jobs.jobs.length > 0 && (
            <TableContainer sx={adminTableContainerStyles}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={adminTableHeaderCellCompactStyles()}>Job</TableCell>
                    <TableCell sx={adminTableHeaderCellCompactStyles()}>Schedule</TableCell>
                    <TableCell sx={adminTableHeaderCellCompactStyles()}>Health</TableCell>
                    <TableCell sx={adminTableHeaderCellCompactStyles('right')}>
                      Success Rate
                    </TableCell>
                    <TableCell sx={adminTableHeaderCellCompactStyles('right')}>
                      Executions
                    </TableCell>
                    <TableCell sx={adminTableHeaderCellCompactStyles('right')}>Avg Time</TableCell>
                    <TableCell sx={adminTableHeaderCellCompactStyles()}>Last Run</TableCell>
                    <TableCell sx={adminTableHeaderCellCompactStyles()}>Enabled</TableCell>
                    <TableCell sx={adminTableHeaderCellCompactStyles()}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobs.jobs.map(job => {
                    const isTriggering =
                      triggerJobMutation.isPending && triggerJobMutation.variables === job.jobId;
                    const isToggling =
                      toggleJobMutation.isPending &&
                      toggleJobMutation.variables?.jobId === job.jobId;

                    return (
                      <TableRow key={job.jobId}>
                        <TableCell sx={adminTableDataCellCompactStyles()}>
                          <Stack spacing={0.25}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2">{job.name}</Typography>
                              {job.isRunning && <CircularProgress size={14} />}
                            </Stack>
                            {job.description && (
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                {job.description}
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles()}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {job.schedule ?? job.category}
                          </Typography>
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles()}>
                          <Chip
                            label={job.health}
                            size="small"
                            sx={getStatusChipSx(mapJobHealthToChipStatus(job.health), theme)}
                          />
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles('right')}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            justifyContent="flex-end"
                          >
                            <LinearProgress
                              variant="determinate"
                              value={job.statistics.successRate}
                              sx={{
                                width: 60,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: alpha(theme.palette.error.main, 0.15),
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor:
                                    job.statistics.successRate >= 90
                                      ? theme.palette.success.main
                                      : job.statistics.successRate >= 70
                                        ? theme.palette.warning.main
                                        : theme.palette.error.main,
                                },
                              }}
                            />
                            <Typography variant="body2">{job.statistics.successRate}%</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles('right')}>
                          <Tooltip
                            title={`${job.statistics.successfulExecutions} OK / ${job.statistics.failedExecutions} failed`}
                          >
                            <Typography variant="body2">
                              {job.statistics.totalExecutions}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles('right')}>
                          {formatDuration(job.statistics.averageDuration)}
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles()}>
                          <Stack>
                            {job.lastExecution ? (
                              <>
                                <Chip
                                  label={job.lastExecution.status}
                                  size="small"
                                  sx={getStatusChipSx(
                                    mapExecutionStatusToChipStatus(job.lastExecution.status),
                                    theme
                                  )}
                                />
                                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                  {formatRelativeTime(job.lastExecution.startedAt)}
                                  {job.lastExecution.duration
                                    ? ` (${formatDuration(job.lastExecution.duration)})`
                                    : ''}
                                </Typography>
                                {job.lastExecution.error && (
                                  <Tooltip title={job.lastExecution.error}>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: 'error.main',
                                        maxWidth: 200,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {job.lastExecution.error}
                                    </Typography>
                                  </Tooltip>
                                )}
                              </>
                            ) : (
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                Never run
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles()}>
                          <Tooltip title={job.enabled ? 'Disable this job' : 'Enable this job'}>
                            <Switch
                              size="small"
                              checked={job.enabled}
                              disabled={isToggling}
                              onChange={() => handleToggleJob(job.jobId, job.enabled)}
                            />
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={adminTableDataCellCompactStyles()}>
                          <Tooltip title="Manually trigger this job now">
                            <span>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={
                                  isTriggering || job.isRunning ? (
                                    <CircularProgress size={14} />
                                  ) : (
                                    <PlayArrowIcon />
                                  )
                                }
                                disabled={isTriggering || job.isRunning}
                                onClick={() => handleTriggerJob(job.jobId)}
                                sx={{ minWidth: 'auto', textTransform: 'none' }}
                              >
                                Run
                              </Button>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {jobs.jobs.length === 0 && (
            <Alert severity="info">No scheduled jobs registered in the job scheduler.</Alert>
          )}
        </AccordionDetails>
      </Accordion>

      {/* ================================================================
          SECTION 3: Data Fetchers
          ================================================================ */}
      <Accordion defaultExpanded sx={{ mt: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <SyncIcon sx={{ color: 'info.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Data Fetchers
            </Typography>
            {fetchers.fetchers.some(f => f.lastRun && !f.lastRun.success) && (
              <Chip label="errors" size="small" sx={getStatusChipSx('failed', theme)} />
            )}
            {fetchers.fetchers.some(f => f.isStale) && (
              <Chip label="stale data" size="small" sx={getStatusChipSx('warning', theme)} />
            )}
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {fetchers.fetchers.map(fetcher => (
              <Box
                key={fetcher.name}
                sx={{
                  p: 2,
                  borderRadius: 1,
                  border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
                  backgroundColor:
                    fetcher.lastRun?.success === false
                      ? alpha(theme.palette.error.main, 0.03)
                      : fetcher.isStale
                        ? alpha(theme.palette.warning.main, 0.03)
                        : alpha(theme.palette.success.main, 0.02),
                }}
              >
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <StorageIcon
                      sx={{
                        color:
                          fetcher.lastRun?.success === false
                            ? 'error.main'
                            : fetcher.isStale
                              ? 'warning.main'
                              : 'success.main',
                      }}
                    />
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" fontWeight={600}>
                          {fetcher.name}
                        </Typography>
                        {fetcher.isRunning && <CircularProgress size={14} />}
                      </Stack>
                      {fetcher.lastRun ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Last run: {formatRelativeTime(fetcher.lastRun.timestamp)}
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          Never run
                        </Typography>
                      )}
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center">
                    {fetcher.lastRun && (
                      <Chip
                        label={fetcher.lastRun.success ? 'success' : 'failed'}
                        size="small"
                        sx={getStatusChipSx(fetcher.lastRun.success ? 'success' : 'failed', theme)}
                      />
                    )}
                    {fetcher.isStale && (
                      <Chip label="stale" size="small" sx={getStatusChipSx('warning', theme)} />
                    )}
                  </Stack>
                </Stack>

                {/* Error message */}
                {fetcher.lastRun?.error && (
                  <Alert severity="error" sx={{ mt: 1 }} variant="outlined">
                    {fetcher.lastRun.error}
                  </Alert>
                )}

                {/* Details */}
                {fetcher.lastRun?.details && Object.keys(fetcher.lastRun.details).length > 0 && (
                  <Stack direction="row" spacing={2} mt={1} flexWrap="wrap">
                    {Object.entries(fetcher.lastRun.details).map(([key, value]) => (
                      <Typography key={key} variant="caption" sx={{ color: 'text.secondary' }}>
                        {key}: <strong>{String(value)}</strong>
                      </Typography>
                    ))}
                  </Stack>
                )}
              </Box>
            ))}

            {fetchers.fetchers.length === 0 && (
              <Alert severity="info">No data fetchers available.</Alert>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};
