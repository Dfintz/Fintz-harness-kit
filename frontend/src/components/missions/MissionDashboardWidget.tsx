/**
 * MissionDashboardWidget
 * Dashboard widget showing the next 3 upcoming missions for the user's organization.
 * Uses the DashboardWidget container for consistent styling.
 *
 * Sprint 1 — Wave 3.1
 */

import AssignmentIcon from '@mui/icons-material/Assignment';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Mission } from '@sc-fleet-manager/shared-types';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { DashboardWidget } from '@/components/dashboard/DashboardWidget';
import { MissionStatusBadge } from '@/components/missions/MissionStatusBadge';
import { MissionTypeBadge } from '@/components/missions/MissionTypeBadge';
import { useActiveMissions } from '@/hooks/queries/useMissionQueries';

// ============================================================================
// Helpers
// ============================================================================

function formatMissionDate(date?: string | Date): string {
  if (!date) return 'No date set';
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// Component
// ============================================================================

interface MissionDashboardWidgetProps {
  onHide?: (widgetId: string) => void;
}

export const MissionDashboardWidget: React.FC<Readonly<MissionDashboardWidgetProps>> = ({
  onHide,
}) => {
  const navigate = useNavigate();
  const { data: missions, isLoading, error } = useActiveMissions();

  const upcomingMissions = (missions ?? []).slice(0, 3);

  const handleMissionClick = (missionId: string) => {
    navigate(`/missions/${missionId}`);
  };

  return (
    <DashboardWidget
      widgetId="missions-upcoming"
      title="Upcoming Missions"
      icon={<RocketLaunchIcon />}
      onHide={onHide}
      headerActions={
        <Button size="small" endIcon={<ChevronRightIcon />} onClick={() => navigate('/missions')}>
          View All
        </Button>
      }
    >
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ m: 1 }}>
          Failed to load missions
        </Alert>
      )}

      {!isLoading && !error && upcomingMissions.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <AssignmentIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 0.5 }} />
          <Typography variant="body2" color="text.secondary">
            No upcoming missions
          </Typography>
          <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/missions')}>
            Create Mission
          </Button>
        </Box>
      )}

      {!isLoading && upcomingMissions.length > 0 && (
        <List disablePadding>
          {upcomingMissions.map((mission: Mission, index: number) => (
            <React.Fragment key={mission.id}>
              {index > 0 && <Divider component="li" />}
              <ListItem
                component="div"
                onClick={() => handleMissionClick(mission.id)}
                sx={{
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  borderRadius: 1,
                  py: 1.5,
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <AssignmentIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 200,
                      }}
                    >
                      {mission.title}
                    </Typography>
                  }
                  secondary={formatMissionDate(mission.startDate)}
                />
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <MissionTypeBadge missionType={mission.missionType} size="small" />
                  <MissionStatusBadge status={mission.status} size="small" />
                </Stack>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      )}
    </DashboardWidget>
  );
};
