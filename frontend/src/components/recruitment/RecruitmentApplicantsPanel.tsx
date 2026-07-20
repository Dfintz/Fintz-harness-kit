import {
  useRecruitmentApplications,
  useRecruitments,
  useReviewRecruitmentApplication,
} from '@/hooks/queries/useRecruitmentQueries';
import type { RecruitmentApplication } from '@/services/recruitmentService';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InboxIcon from '@mui/icons-material/Inbox';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useState } from 'react';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'interview_scheduled', label: 'Interview' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

interface RecruitmentApplicantsPanelProps {
  organizationId: string;
}

export const RecruitmentApplicantsPanel: React.FC<Readonly<RecruitmentApplicantsPanelProps>> = ({
  organizationId,
}) => {
  const theme = useTheme();
  const notification = useNotification();

  // State
  const [selectedRecruitmentId, setSelectedRecruitmentId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectAppId, setRejectAppId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Queries
  const { data: recruitments = [] } = useRecruitments();
  const orgRecruitments = recruitments.filter(r => r.organizationId === organizationId);

  const filters = statusFilter ? { status: statusFilter } : undefined;
  const {
    data: applicationsResponse,
    isLoading,
    error: queryError,
  } = useRecruitmentApplications(selectedRecruitmentId || undefined, filters);

  const reviewMutation = useReviewRecruitmentApplication();

  const applications = applicationsResponse?.data ?? [];

  // Handlers
  const handleAccept = async (app: RecruitmentApplication) => {
    try {
      await reviewMutation.mutateAsync({
        recruitmentId: selectedRecruitmentId,
        applicationId: app.applicationId,
        data: { action: 'accept' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept application';
      notification.error(message);
      logger.error(
        'Failed to accept application',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleRejectClick = (appId: string) => {
    setRejectAppId(appId);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectAppId) return;
    try {
      await reviewMutation.mutateAsync({
        recruitmentId: selectedRecruitmentId,
        applicationId: rejectAppId,
        data: { action: 'reject', rejectionReason: rejectReason || undefined },
      });
      setRejectDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject application';
      notification.error(message);
      logger.error(
        'Failed to reject application',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const borderColor = alpha(theme.palette.common.white, 0.06);

  const headerCellSx = {
    color: theme.palette.text.secondary,
    borderBottom: `1px solid ${borderColor}`,
  };

  const bodyCellSx = {
    borderBottom: `1px solid ${borderColor}`,
  };

  return (
    <Box>
      {/* Recruitment selector + status filter */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <InputLabel>Recruitment Post</InputLabel>
          <Select
            value={selectedRecruitmentId}
            label="Recruitment Post"
            onChange={e => {
              setSelectedRecruitmentId(e.target.value);
              setExpandedAppId(null);
            }}
          >
            {orgRecruitments.length === 0 ? (
              <MenuItem disabled value="">
                No recruitment posts
              </MenuItem>
            ) : (
              orgRecruitments.map(r => (
                <MenuItem key={r.id} value={r.id}>
                  {r.title} ({r.currentApplicants ?? 0} applicants)
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={e => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/* No recruitment selected */}
      {!selectedRecruitmentId && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <InboxIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 1 }} />
          <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
            Select a recruitment post to view applications
          </Typography>
        </Box>
      )}

      {/* Error */}
      {queryError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load applications
        </Alert>
      )}

      {/* Loading */}
      {selectedRecruitmentId && isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty state */}
      {selectedRecruitmentId && !isLoading && applications.length === 0 && !queryError && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <InboxIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 1 }} />
          <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
            No {statusFilter || ''} applications for this recruitment
          </Typography>
        </Box>
      )}

      {/* Applications table */}
      {selectedRecruitmentId && !isLoading && applications.length > 0 && (
        <TableContainer>
          <Table size="small" aria-label="Recruitment applications">
            <TableHead>
              <TableRow>
                <TableCell sx={headerCellSx}>Applicant</TableCell>
                <TableCell sx={headerCellSx}>Message</TableCell>
                <TableCell sx={headerCellSx}>Roles</TableCell>
                <TableCell sx={headerCellSx}>Applied</TableCell>
                <TableCell sx={headerCellSx}>Status</TableCell>
                <TableCell sx={headerCellSx} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {applications.map(app => {
                const hasDetails =
                  app.answers?.length ||
                  app.timezone ||
                  app.availablePlaytimes?.length ||
                  app.rsiHandle ||
                  app.discordId ||
                  (app.skills && app.skills.length > 0) ||
                  (app.careerHours && app.careerHours.length > 0);

                return (
                  <React.Fragment key={app.applicationId}>
                    <TableRow
                      sx={{
                        '&:hover': { bgcolor: theme.palette.background.paper },
                        cursor: hasDetails ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (hasDetails) {
                          setExpandedAppId(
                            expandedAppId === app.applicationId ? null : app.applicationId
                          );
                        }
                      }}
                    >
                      <TableCell sx={{ ...bodyCellSx, color: theme.palette.common.white }}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="body2">{app.applicantName}</Typography>
                          {hasDetails && (
                            <ExpandMoreIcon
                              sx={{
                                fontSize: 16,
                                transform:
                                  expandedAppId === app.applicationId ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.2s',
                              }}
                            />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, color: theme.palette.text.secondary }}>
                        <Tooltip title={app.message || ''}>
                          <Typography
                            variant="body2"
                            sx={{
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {app.message || '—'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, color: theme.palette.text.secondary }}>
                        {app.preferredRoles?.length ? (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {app.preferredRoles.map(role => (
                              <Chip key={role} label={role} size="small" variant="outlined" />
                            ))}
                          </Stack>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, color: theme.palette.text.secondary }}>
                        {formatDate(app.appliedAt)}
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        <Chip
                          label={app.status.replaceAll('_', ' ').toUpperCase()}
                          size="small"
                          sx={getStatusChipSx(app.status, theme)}
                        />
                      </TableCell>
                      <TableCell sx={bodyCellSx} align="right">
                        {app.status === 'pending' && (
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={e => {
                                e.stopPropagation();
                                void handleAccept(app);
                              }}
                              disabled={reviewMutation.isPending}
                              title="Accept"
                            >
                              <CheckIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={e => {
                                e.stopPropagation();
                                handleRejectClick(app.applicationId);
                              }}
                              disabled={reviewMutation.isPending}
                              title="Reject"
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded details */}
                    {hasDetails && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ py: 0, ...bodyCellSx }}>
                          <Collapse
                            in={expandedAppId === app.applicationId}
                            timeout="auto"
                            unmountOnExit
                          >
                            <Box sx={{ py: 2, px: 1 }}>
                              <Stack spacing={1}>
                                {app.rsiHandle && (
                                  <Typography variant="body2">
                                    <strong>RSI Handle:</strong> {app.rsiHandle}
                                  </Typography>
                                )}
                                {app.discordId && (
                                  <Typography variant="body2">
                                    <strong>Discord:</strong> {app.discordId}
                                  </Typography>
                                )}
                                {app.timezone && (
                                  <Typography variant="body2">
                                    <strong>Timezone:</strong> {app.timezone}
                                  </Typography>
                                )}
                                {app.availablePlaytimes?.length ? (
                                  <Typography variant="body2">
                                    <strong>Available:</strong> {app.availablePlaytimes.join(', ')}
                                  </Typography>
                                ) : null}
                                {app.screeningScore !== undefined && (
                                  <Typography variant="body2">
                                    <strong>Screening Score:</strong> {app.screeningScore}
                                    {app.screeningPassed !== undefined && (
                                      <Chip
                                        label={app.screeningPassed ? 'Passed' : 'Failed'}
                                        size="small"
                                        color={app.screeningPassed ? 'success' : 'error'}
                                        sx={{ ml: 1 }}
                                      />
                                    )}
                                  </Typography>
                                )}
                                {app.skills && app.skills.length > 0 && (
                                  <Box>
                                    <Divider sx={{ my: 1 }} />
                                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                      Skills
                                    </Typography>
                                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                      {app.skills.map(skill => (
                                        <Chip
                                          key={`${skill.name}-${skill.category}`}
                                          label={`${skill.name} (${skill.level})`}
                                          size="small"
                                          variant="outlined"
                                          sx={{
                                            borderColor: alpha(theme.palette.info.main, 0.4),
                                            color: theme.palette.text.primary,
                                          }}
                                        />
                                      ))}
                                    </Stack>
                                  </Box>
                                )}
                                {app.careerHours && app.careerHours.length > 0 && (
                                  <Box>
                                    <Divider sx={{ my: 1 }} />
                                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                      Flight Hours by Career
                                    </Typography>
                                    <Stack spacing={0.5}>
                                      {app.careerHours.map(ch => {
                                        const maxHours = Math.max(
                                          ...app.careerHours!.map(c => c.hours)
                                        );
                                        return (
                                          <Box key={ch.career}>
                                            <Stack
                                              direction="row"
                                              justifyContent="space-between"
                                              alignItems="center"
                                            >
                                              <Typography variant="body2" sx={{ minWidth: 100 }}>
                                                {ch.career}
                                              </Typography>
                                              <Box sx={{ flex: 1, mx: 1 }}>
                                                <LinearProgress
                                                  variant="determinate"
                                                  value={
                                                    maxHours > 0 ? (ch.hours / maxHours) * 100 : 0
                                                  }
                                                  sx={{
                                                    height: 6,
                                                    borderRadius: 3,
                                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                  }}
                                                />
                                              </Box>
                                              <Typography
                                                variant="body2"
                                                sx={{
                                                  color: theme.palette.text.secondary,
                                                  minWidth: 80,
                                                  textAlign: 'right',
                                                }}
                                              >
                                                {ch.hours}h ({ch.shipCount}{' '}
                                                {ch.shipCount === 1 ? 'ship' : 'ships'})
                                              </Typography>
                                            </Stack>
                                          </Box>
                                        );
                                      })}
                                    </Stack>
                                  </Box>
                                )}
                                {app.answers?.length ? (
                                  <Box>
                                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                      Application Answers
                                    </Typography>
                                    {app.answers.map(a => (
                                      <Box key={a.questionId} sx={{ mb: 0.5 }}>
                                        <Typography
                                          variant="body2"
                                          sx={{ color: theme.palette.text.secondary }}
                                        >
                                          {a.question}
                                        </Typography>
                                        <Typography variant="body2">{a.answer}</Typography>
                                      </Box>
                                    ))}
                                  </Box>
                                ) : null}
                              </Stack>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Reject dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Application</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Reason (optional)"
            fullWidth
            multiline
            rows={3}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => void handleRejectConfirm()}
            color="error"
            variant="contained"
            disabled={reviewMutation.isPending}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
