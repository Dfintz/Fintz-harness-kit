/**
 * MissionDetailPage
 * Full detail view for a single mission with tabs:
 *   - Overview: mission info, objectives, status actions
 *   - Participants: member roster and role management
 *
 * Sprint 1 — Wave 3.1
 */

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupIcon from '@mui/icons-material/Group';
import HubIcon from '@mui/icons-material/Hub';
import InfoIcon from '@mui/icons-material/Info';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { MISSION_STATUS_TRANSITIONS, type MissionStatus } from '@sc-fleet-manager/shared-types';
import React, { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { MissionPriorityBadge } from '@/components/missions/MissionPriorityBadge';
import { MissionStatusBadge } from '@/components/missions/MissionStatusBadge';
import { MissionTypeBadge } from '@/components/missions/MissionTypeBadge';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useAdvanceMissionWorkflow,
  useDeleteMission,
  useMission,
  useMissionWorkflow,
  useUpdateMissionStatus,
} from '@/hooks/queries/useMissionQueries';
import type { MissionWorkflowPhase } from '@/services/missionService';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';

import { MissionParticipantsPanel } from './MissionParticipantsPanel';

// ============================================================================
// Helpers
// ============================================================================

function formatDateTime(date: string | Date | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const STATUS_TRANSITIONS = MISSION_STATUS_TRANSITIONS;

const STATUS_ACTION_LABELS: Partial<Record<MissionStatus, string>> = {
  planned: 'Mark as Planned',
  briefed: 'Mark Briefed',
  in_progress: 'Start Mission',
  completed: 'Complete',
  failed: 'Mark Failed',
  cancelled: 'Cancel Mission',
  draft: 'Revert to Draft',
};

function getStatusActionColor(nextStatus: MissionStatus): 'error' | 'success' | 'primary' {
  if (nextStatus === 'cancelled' || nextStatus === 'failed') {
    return 'error';
  }
  if (nextStatus === 'completed') {
    return 'success';
  }
  return 'primary';
}

// ============================================================================
// Tab Panel
// ============================================================================

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box
    role="tabpanel"
    hidden={value !== index}
    id={`mission-tabpanel-${index}`}
    aria-labelledby={`mission-tab-${index}`}
    sx={{ pt: 3 }}
  >
    {value === index && children}
  </Box>
);

// ============================================================================
// Component
// ============================================================================

const MissionDetailPage: React.FC = () => {
  const { missionId } = useParams<{ missionId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);

  const { data: mission, isLoading, error } = useMission(missionId);
  const { data: workflow, isLoading: isWorkflowLoading } = useMissionWorkflow(missionId);
  const updateStatus = useUpdateMissionStatus();
  const advanceWorkflow = useAdvanceMissionWorkflow();
  const deleteMission = useDeleteMission();
  const { openDialog, closeDialog, pendingData, dialogProps } = useConfirmDialog<string>();

  const [activeTab, setActiveTab] = useState(0);

  const handleStatusChange = useCallback(
    async (newStatus: MissionStatus) => {
      if (!missionId) return;
      try {
        await updateStatus.mutateAsync({ id: missionId, status: newStatus });
      } catch (err) {
        logger.error(
          'Failed to update mission status',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    },
    [missionId, updateStatus]
  );

  const handleDelete = useCallback(async () => {
    if (!pendingData) return;
    try {
      await deleteMission.mutateAsync(pendingData);
      closeDialog();
      navigate('/missions');
    } catch (err) {
      logger.error('Failed to delete mission', err instanceof Error ? err : new Error(String(err)));
    }
  }, [pendingData, deleteMission, closeDialog, navigate]);

  const handleAdvanceWorkflow = useCallback(
    async (phase: MissionWorkflowPhase) => {
      if (!missionId) return;
      try {
        await advanceWorkflow.mutateAsync({ id: missionId, phase });
      } catch (err) {
        logger.error(
          'Failed to advance mission workflow',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    },
    [missionId, advanceWorkflow]
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !mission) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4, px: 2 }}>
        <Alert severity="error">{error ? 'Failed to load mission.' : 'Mission not found.'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/missions')} sx={{ mt: 2 }}>
          Back to Missions
        </Button>
      </Box>
    );
  }

  const allowedTransitions = STATUS_TRANSITIONS[mission.status] ?? [];
  const completedObjectives = mission.objectives?.filter(o => o.completed).length ?? 0;
  const totalObjectives = mission.objectives?.length ?? 0;
  const objectiveProgress = totalObjectives > 0 ? (completedObjectives / totalObjectives) * 100 : 0;
  const isOwner = mission.createdBy === user?.id;

  const renderWorkflowTabContent = () => {
    if (isWorkflowLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (workflow == null) {
      return <Alert severity="warning">Workflow data is not available for this mission.</Alert>;
    }

    return (
      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Operations Progress</Typography>
              <Typography variant="body2" color="text.secondary">
                {workflow.completedPhases}/{workflow.totalPhases} phases complete
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={workflow.completionPercent}
              sx={{ mt: 2, height: 8, borderRadius: 4 }}
            />
          </CardContent>
        </Card>

        {workflow.phases.map(phase => (
          <Card key={phase.phase} variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6">{phase.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {phase.description}
                    </Typography>
                  </Box>
                  <Chip
                    label={phase.completed ? 'Completed' : 'Pending'}
                    color={phase.completed ? 'success' : 'default'}
                    variant={phase.completed ? 'filled' : 'outlined'}
                    size="small"
                  />
                </Stack>

                {phase.blockers.length > 0 && !phase.completed && (
                  <Alert severity="warning">{phase.blockers.join(' ')}</Alert>
                )}

                <Typography variant="caption" color="text.secondary">
                  Next actions: {phase.nextActions.join(' | ')}
                </Typography>

                <Box>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={
                      phase.completed || phase.blockers.length > 0 || advanceWorkflow.isPending
                    }
                    onClick={() => handleAdvanceWorkflow(phase.phase)}
                  >
                    {phase.completed ? 'Completed' : `Complete ${phase.title}`}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4, px: 2, pb: 4 }}>
      {/* Back + Actions */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/missions')} size="small">
          Back to Missions
        </Button>

        <Stack direction="row" spacing={1}>
          {allowedTransitions.map(nextStatus => (
            <Button
              key={nextStatus}
              variant={nextStatus === 'in_progress' ? 'contained' : 'outlined'}
              size="small"
              startIcon={nextStatus === 'in_progress' ? <PlayArrowIcon /> : undefined}
              color={getStatusActionColor(nextStatus)}
              onClick={() => handleStatusChange(nextStatus)}
              disabled={updateStatus.isPending}
            >
              {STATUS_ACTION_LABELS[nextStatus] ?? nextStatus}
            </Button>
          ))}

          {isOwner && mission.status === 'draft' && (
            <IconButton
              color="error"
              size="small"
              onClick={() => openDialog(mission.id)}
              title="Delete mission"
            >
              <DeleteIcon />
            </IconButton>
          )}
        </Stack>
      </Stack>

      {/* Mission Header Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ sm: 'center' }}
            >
              <Typography variant="h5" sx={{ fontWeight: 'bold', flex: 1 }}>
                {mission.title}
              </Typography>
              <Stack direction="row" spacing={0.5}>
                <MissionStatusBadge status={mission.status} size="medium" />
                <MissionTypeBadge missionType={mission.missionType} size="medium" />
                <MissionPriorityBadge priority={mission.priority} size="medium" />
              </Stack>
            </Stack>

            {mission.description && (
              <Typography variant="body1" color="text.secondary">
                {mission.description}
              </Typography>
            )}

            <Stack
              direction="row"
              spacing={3}
              sx={{ flexWrap: 'wrap', gap: 1 }}
              divider={<Divider orientation="vertical" flexItem />}
            >
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Difficulty:
                </Typography>
                <Chip
                  label={mission.difficulty.charAt(0).toUpperCase() + mission.difficulty.slice(1)}
                  size="small"
                  variant="outlined"
                />
              </Stack>

              {mission.location && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <LocationOnIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2">{mission.location}</Typography>
                </Stack>
              )}

              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Created:
                </Typography>
                <Typography variant="body2">{formatDateTime(mission.createdAt)}</Typography>
              </Stack>

              {mission.startDate && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    Start:
                  </Typography>
                  <Typography variant="body2">{formatDateTime(mission.startDate)}</Typography>
                </Stack>
              )}

              {mission.endDate && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    End:
                  </Typography>
                  <Typography variant="body2">{formatDateTime(mission.endDate)}</Typography>
                </Stack>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_e, v: number) => setActiveTab(v)}
          aria-label="Mission detail tabs"
        >
          <Tab
            icon={<InfoIcon />}
            iconPosition="start"
            label="Overview"
            id="mission-tab-0"
            aria-controls="mission-tabpanel-0"
          />
          <Tab
            icon={<GroupIcon />}
            iconPosition="start"
            label={`Participants (${mission.participants?.length ?? 0})`}
            id="mission-tab-1"
            aria-controls="mission-tabpanel-1"
          />
          <Tab
            icon={<HubIcon />}
            iconPosition="start"
            label="Command Workflow"
            id="mission-tab-2"
            aria-controls="mission-tabpanel-2"
          />
        </Tabs>
      </Box>

      {/* === Overview Tab === */}
      <TabPanel value={activeTab} index={0}>
        <Stack spacing={3}>
          {/* Objectives */}
          <Card>
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 2 }}
              >
                <Typography variant="h6">
                  <AssignmentIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
                  Objectives
                </Typography>
                {totalObjectives > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {completedObjectives} / {totalObjectives} completed
                  </Typography>
                )}
              </Stack>

              {totalObjectives > 0 && (
                <LinearProgress
                  variant="determinate"
                  value={objectiveProgress}
                  sx={{ mb: 2, height: 6, borderRadius: 3 }}
                  color={objectiveProgress === 100 ? 'success' : 'primary'}
                />
              )}

              {totalObjectives === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No objectives defined yet.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {mission.objectives.map(obj => (
                    <ListItem key={obj.id} disablePadding sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {obj.completed ? (
                          <CheckCircleIcon color="success" fontSize="small" />
                        ) : (
                          <RadioButtonUncheckedIcon color="disabled" fontSize="small" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography
                              variant="body2"
                              sx={{
                                textDecoration: obj.completed ? 'line-through' : 'none',
                                color: obj.completed ? 'text.disabled' : 'text.primary',
                              }}
                            >
                              {obj.title}
                            </Typography>
                            {obj.optional && (
                              <Chip
                                label="Optional"
                                size="small"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                              />
                            )}
                          </Stack>
                        }
                        secondary={obj.description}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          {/* Tags & Notes */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            {mission.tags && mission.tags.length > 0 && (
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Tags
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {mission.tags.map(tag => (
                      <Chip key={tag} label={tag} size="small" />
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {mission.notes && (
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Notes
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ whiteSpace: 'pre-wrap' }}
                  >
                    {mission.notes}
                  </Typography>
                </CardContent>
              </Card>
            )}

            {mission.reward && (
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Reward
                  </Typography>
                  <Typography variant="body2">{mission.reward}</Typography>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Stack>
      </TabPanel>

      {/* === Participants Tab === */}
      <TabPanel value={activeTab} index={1}>
        <MissionParticipantsPanel mission={mission} />
      </TabPanel>

      {/* === Command Workflow Tab === */}
      <TabPanel value={activeTab} index={2}>
        {renderWorkflowTabContent()}
      </TabPanel>

      {/* Delete Confirmation */}
      <ConfirmDialog
        {...dialogProps}
        title="Delete Mission"
        message="This will permanently delete this mission. This action cannot be undone."
        onConfirm={handleDelete}
      />
    </Box>
  );
};

export const MissionDetailPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Mission Detail">
    <MissionDetailPage />
  </FeatureErrorBoundary>
);

export { MissionDetailPage };
