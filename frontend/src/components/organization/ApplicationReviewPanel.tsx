import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InboxIcon from '@mui/icons-material/Inbox';
import VerifiedIcon from '@mui/icons-material/Verified';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useState } from 'react';

import { useApplicationMode } from '@/hooks/queries/useApplicationQueries';
import { apiClient, getErrorMessage } from '@/services/apiClient';
import { orgApplicationService } from '@/services/orgApplicationService';
import { useNotification } from '@/store/uiStore';
import { getStatusChipSx } from '@/utils/statusStyles';

import { ApplicationStatus, type ApplicationDto } from '@sc-fleet-manager/shared-types';

interface ApplicantSCStats {
  hasData: boolean;
  metrics?: {
    totalHours: number | null;
    kdRatio: number | null;
    missionsCompleted: number | null;
    favoriteVehicle: string | null;
  } | null;
}

interface ApplicationWithApplicant extends ApplicationDto {
  applicant?: { id: string; username?: string };
}

const SOURCE_LABELS: Record<
  string,
  { label: string; color: 'default' | 'primary' | 'secondary' | 'info' }
> = {
  web: { label: 'Web', color: 'primary' },
  discord: { label: 'Discord', color: 'secondary' },
  api: { label: 'API', color: 'info' },
};

interface ApplicationReviewPanelProps {
  organizationId: string;
}

export const ApplicationReviewPanel: React.FC<ApplicationReviewPanelProps> = ({
  organizationId,
}) => {
  const theme = useTheme();
  const notification = useNotification();
  const [applications, setApplications] = useState<ApplicationWithApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>(
    ApplicationStatus.PENDING
  );

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectAppId, setRejectAppId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [scstatsCache, setScstatsCache] = useState<Record<string, ApplicantSCStats>>({});
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);

  // Fetch question definitions to map IDs → labels in form responses
  const { data: modeInfo } = useApplicationMode(organizationId);
  const questionLabels = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const q of modeInfo?.questions ?? []) {
      map[q.id] = q.label;
    }
    return map;
  }, [modeInfo?.questions]);

  const fetchApplicantSCStats = useCallback(
    async (apps: ApplicationWithApplicant[]) => {
      const userIds = apps
        .map(a => a.applicant?.id || a.applicantId)
        .filter((id): id is string => !!id && !scstatsCache[id]);

      if (userIds.length === 0) return;

      for (const userId of userIds) {
        try {
          const res = await apiClient.get<{ data: ApplicantSCStats }>(
            `/api/v2/users/${userId}/scstats`
          );
          const stats = res.data?.data || res.data;
          setScstatsCache(prev => ({ ...prev, [userId]: stats }));
        } catch {
          setScstatsCache(prev => ({ ...prev, [userId]: { hasData: false } }));
        }
      }
    },
    [scstatsCache]
  );

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const result = await orgApplicationService.getApplicationsForOrg(organizationId, {
        status: statusFilter || undefined,
        page: page + 1,
        limit: rowsPerPage,
      });
      setApplications(result.data);
      setTotal(result.meta.total);
    } catch (err) {
      notification.error(err instanceof Error ? err.message : 'Failed to load applications');
      setApplications([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [organizationId, statusFilter, page, rowsPerPage]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    if (applications.length > 0) {
      fetchApplicantSCStats(applications);
    }
  }, [applications]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async (appId: string) => {
    setActionLoading(appId);
    try {
      await orgApplicationService.reviewApplication(organizationId, appId, 'approved');
      await fetchApplications();
    } catch (err: unknown) {
      notification.error(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectClick = (appId: string) => {
    setRejectAppId(appId);
    setRejectNote('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectAppId) return;
    setActionLoading(rejectAppId);
    try {
      await orgApplicationService.reviewApplication(
        organizationId,
        rejectAppId,
        'rejected',
        rejectNote || undefined
      );
      setRejectDialogOpen(false);
      await fetchApplications();
    } catch (err: unknown) {
      notification.error(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const renderBody = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (applications.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <InboxIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 1 }} />
          <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
            No {statusFilter || ''} applications
          </Typography>
        </Box>
      );
    }

    return (
      <>
        <TableContainer>
          <Table size="small" aria-label="Join applications">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                  }}
                >
                  Applicant
                </TableCell>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                  }}
                >
                  Message
                </TableCell>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                  }}
                >
                  Submitted
                </TableCell>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                  }}
                >
                  Source
                </TableCell>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                  }}
                >
                  Status
                </TableCell>
                <TableCell
                  sx={{
                    color: theme.palette.text.secondary,
                    borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                  }}
                  align="right"
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {applications.map(app => (
                <React.Fragment key={app.id}>
                  <TableRow
                    sx={{
                      '&:hover': { bgcolor: theme.palette.background.paper },
                      cursor:
                        app.formResponses && Object.keys(app.formResponses).length > 0
                          ? 'pointer'
                          : 'default',
                    }}
                    onClick={() => {
                      if (app.formResponses && Object.keys(app.formResponses).length > 0) {
                        setExpandedAppId(expandedAppId === app.id ? null : app.id);
                      }
                    }}
                  >
                    <TableCell
                      sx={{
                        color: theme.palette.common.white,
                        borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography variant="body2">
                          {app.applicant?.username || app.applicantId}
                        </Typography>
                        {(() => {
                          const userId = app.applicant?.id ?? app.applicantId;
                          const stats = userId ? scstatsCache[userId] : undefined;
                          if (userId && stats?.hasData) {
                            const metrics = stats.metrics;
                            const tooltipParts = ['SCStats Verified'];
                            if (metrics?.totalHours !== undefined && metrics.totalHours !== null) {
                              tooltipParts.push(`${metrics.totalHours.toFixed(0)}h played`);
                            }
                            if (metrics?.kdRatio !== undefined && metrics.kdRatio !== null) {
                              tooltipParts.push(`K/D: ${metrics.kdRatio.toFixed(2)}`);
                            }
                            if (
                              metrics?.missionsCompleted !== undefined &&
                              metrics.missionsCompleted !== null
                            ) {
                              tooltipParts.push(`${metrics.missionsCompleted} missions`);
                            }
                            const tooltipLines = tooltipParts.join(' | ');
                            return (
                              <Tooltip title={tooltipLines}>
                                <VerifiedIcon
                                  sx={{ fontSize: 16, color: theme.palette.primary.main }}
                                  aria-label="SCStats verified"
                                />
                              </Tooltip>
                            );
                          }
                          return null;
                        })()}
                      </Stack>
                    </TableCell>
                    <TableCell
                      sx={{
                        color: theme.palette.text.secondary,
                        borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                        maxWidth: 200,
                      }}
                    >
                      <Tooltip title={app.message || ''}>
                        <Typography variant="body2" noWrap>
                          {app.message || '—'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        color: theme.palette.text.secondary,
                        borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                      }}
                    >
                      {formatDate(app.createdAt)}
                    </TableCell>
                    <TableCell
                      sx={{ borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}` }}
                    >
                      {(() => {
                        const src = app.source ?? 'web';
                        const info = SOURCE_LABELS[src] ?? SOURCE_LABELS.web;
                        return (
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Chip
                              label={info.label}
                              color={info.color}
                              size="small"
                              variant="outlined"
                            />
                            {app.formResponses && Object.keys(app.formResponses).length > 0 && (
                              <ExpandMoreIcon
                                fontSize="small"
                                sx={{
                                  color: theme.palette.text.secondary,
                                  transform: expandedAppId === app.id ? 'rotate(180deg)' : 'none',
                                  transition: 'transform 0.2s',
                                }}
                              />
                            )}
                          </Stack>
                        );
                      })()}
                    </TableCell>
                    <TableCell
                      sx={{ borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}` }}
                    >
                      <Chip
                        label={app.status}
                        sx={getStatusChipSx(app.status, theme)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell
                      sx={{ borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}` }}
                      align="right"
                    >
                      {app.status === 'pending' && (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Approve — adds as member">
                            <IconButton
                              size="small"
                              onClick={() => handleApprove(app.id)}
                              disabled={actionLoading === app.id}
                              sx={{ color: theme.palette.success.dark }}
                              aria-label="Approve application"
                            >
                              {actionLoading === app.id ? (
                                <CircularProgress size={16} />
                              ) : (
                                <CheckIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton
                              size="small"
                              onClick={() => handleRejectClick(app.id)}
                              disabled={actionLoading === app.id}
                              sx={{ color: theme.palette.error.light }}
                              aria-label="Reject application"
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                  {/* Expandable form responses row */}
                  {app.formResponses && Object.keys(app.formResponses).length > 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        sx={{
                          py: 0,
                          borderBottom:
                            expandedAppId === app.id
                              ? `1px solid ${alpha(theme.palette.common.white, 0.06)}`
                              : 'none',
                        }}
                      >
                        <Collapse in={expandedAppId === app.id} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, px: 1 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                              Form Responses
                            </Typography>
                            {Object.entries(app.formResponses).map(([questionId, answer]) => (
                              <Box key={questionId} sx={{ mb: 1 }}>
                                <Typography
                                  variant="caption"
                                  sx={{ color: theme.palette.text.secondary }}
                                >
                                  {questionLabels[questionId] ?? questionId}
                                </Typography>
                                <Typography variant="body2">{answer}</Typography>
                              </Box>
                            ))}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={e => {
            setRowsPerPage(Number.parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25]}
          sx={{
            color: theme.palette.text.secondary,
            '& .MuiTablePagination-selectIcon': { color: theme.palette.text.secondary },
          }}
        />
      </>
    );
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {(
          [
            ApplicationStatus.PENDING,
            ApplicationStatus.APPROVED,
            ApplicationStatus.REJECTED,
            ApplicationStatus.WITHDRAWN,
            '' as const,
          ] as const
        ).map(status => (
          <Chip
            key={status || 'all'}
            label={status || 'All'}
            variant={statusFilter === status ? 'filled' : 'outlined'}
            onClick={() => {
              setStatusFilter(status);
              setPage(0);
            }}
            sx={{ textTransform: 'capitalize', cursor: 'pointer' }}
          />
        ))}
      </Stack>

      {renderBody()}

      <Dialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: theme.palette.background.paper,
              color: theme.palette.common.white,
              borderRadius: 2,
            },
          },
        }}
      >
        <DialogTitle>Reject Application</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
            Are you sure you want to reject this application? You can provide an optional reason.
          </Typography>
          <TextField
            label="Rejection reason (optional)"
            multiline
            rows={3}
            fullWidth
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value.slice(0, 500))}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: theme.palette.common.white,
                '& fieldset': { borderColor: alpha(theme.palette.common.white, 0.12) },
              },
              '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRejectDialogOpen(false)}
            sx={{ color: theme.palette.text.secondary }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRejectConfirm}
            disabled={actionLoading !== null}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
