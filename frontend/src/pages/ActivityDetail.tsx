import type { AddNestedShipResult } from '@/components/AddNestedShipDialog';
import { AddNestedShipDialog } from '@/components/AddNestedShipDialog';
import { EditActivityDialog } from '@/components/EditActivityDialog';
import { ErrorMessage } from '@/components/ErrorMessage';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import type {
  ActivityShipWithPositions,
  JoinActivityResult,
} from '@/components/JoinActivityDialog';
import { JoinActivityDialog } from '@/components/JoinActivityDialog';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { LoanShipsResult } from '@/components/LoanShipsDialog';
import { LoanShipsDialog } from '@/components/LoanShipsDialog';
import { BringFleetDialog } from '@/components/activity/BringFleetDialog';
import type { AvailablePassengerSlot } from '@/components/activity/JoinAsPassengerDialog';
import { JoinAsPassengerDialog } from '@/components/activity/JoinAsPassengerDialog';
import type { SlotRow } from '@/components/activity/EditShipSlotsDialog';
import { EditShipSlotsDialog } from '@/components/activity/EditShipSlotsDialog';
// MiningDataDisplay temporarily disabled — pending regolith fetch fix
// import { MiningDataDisplay } from '@/components/MiningDataDisplay';
import { RoutePlanner } from '@/components/RoutePlanner';
import { AvailabilityGrid } from '@/components/calendar/AvailabilityGrid';
import { BestTimesPanel } from '@/components/calendar/BestTimesPanel';
import {
  useActivity,
  useAddNestedShip,
  useBringFleetAndInviteMembers,
  useCancelActivity,
  useCrewAssignments,
  useFleets,
  useFleetShips,
  useGenerateJoinLink,
  useJoinActivity,
  useJoinShipPassenger,
  useLeaveActivity,
  useLoanShips,
} from '@/hooks/queries';
import {
  useSetCrewPosition,
  useSetCrewSlots,
  useSetPassengerSlots,
  useSetShipNesting,
} from '@/hooks/queries/useActivityQueries';
import { useOrganization } from '@/hooks/queries/useOrganizationQueries';
import { useLfgSession } from '@/hooks/queries/useSocialLfgQueries';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import type { Activity } from '@/types/activity';
import type { ActivityV2 } from '@/types/apiV2';
import { calculateCrewRequirements } from '@/utils/crewCalculation';
import { getRoleBgColor, getRoleColor, getRoleLabel } from '@/utils/crewRoleHelpers';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';
import { getStatusChipSx } from '@/utils/statusStyles';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BuildIcon from '@mui/icons-material/Build';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FlightLandIcon from '@mui/icons-material/FlightLand';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import EventSeatIcon from '@mui/icons-material/EventSeat';
import GroupIcon from '@mui/icons-material/Group';
import GroupsIcon from '@mui/icons-material/Groups';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import MicIcon from '@mui/icons-material/Mic';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import PersonIcon from '@mui/icons-material/Person';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import TranslateIcon from '@mui/icons-material/Translate';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ACTIVITY_CREW_POSITION_LABELS,
  ACTIVITY_CREW_POSITIONS,
  ACTIVITY_PASSENGER_ROLE_LABELS,
  ACTIVITY_PASSENGER_ROLES,
  type ActivityCrewPosition,
} from '@sc-fleet-manager/shared-types';
import React, { useMemo, useState } from 'react';
import { useLoaderData, useNavigate, useParams } from 'react-router-dom';

type ActivityDetail = ActivityV2 &
  Partial<
    Pick<
      Activity,
      | 'participants'
      | 'roleRequirements'
      | 'organizations'
      | 'isMiningOperation'
      | 'activityType'
      | 'systemLocation'
      | 'startTime'
      | 'creatorName'
      | 'tags'
      | 'shipAssignments'
      | 'ships'
      | 'requiredShips'
      | 'totalCrewCapacity'
    >
  >;

function getUniqueShipCount(activity: ActivityDetail): number {
  const all = [...(activity.shipAssignments ?? []), ...(activity.ships ?? [])];
  const seen = new Set<string>();
  const assignedCount = all.filter(s => {
    const key = s.shipId || `${s.shipType}-${s.ownerId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).length;

  // Fall back to requiredShips total when no assigned ships exist
  if (assignedCount === 0 && activity.requiredShips?.length) {
    return activity.requiredShips.reduce((sum, r) => sum + (r.count || 1), 0);
  }
  return assignedCount;
}

const ActivityDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const loaderData: ActivityDetail | null = useLoaderData();
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set(['overview', 'ships']));
  const notification = useNotification();
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [nestedShipDialog, setNestedShipDialog] = useState<{
    open: boolean;
    parentShipId: string;
    parentShipName: string;
    transportType: 'hangar' | 'cargo';
    hangarSize?: string;
  }>({ open: false, parentShipId: '', parentShipName: '', transportType: 'hangar' });
  const [passengerDialogOpen, setPassengerDialogOpen] = useState(false);
  const [fleetDialogOpen, setFleetDialogOpen] = useState(false);
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  const theme = useTheme();

  // Use TanStack Query hook with initial data from loader
  const activityQuery = useActivity(id, {
    initialData: loaderData ?? undefined,
  });

  const { data: activityV2, isLoading, error } = activityQuery;
  const activity = activityV2 as ActivityDetail | undefined;

  const joinActivityMutation = useJoinActivity();
  const leaveActivityMutation = useLeaveActivity();
  const generateJoinLinkMutation = useGenerateJoinLink();
  const cancelActivityMutation = useCancelActivity();
  const loanShipsMutation = useLoanShips();
  const addNestedShipMutation = useAddNestedShip();
  const joinPassengerMutation = useJoinShipPassenger();
  const bringFleetAndInviteMutation = useBringFleetAndInviteMembers();
  const currentUser = useAuthStore(state => state.user);

  // Resolve organization name from ID
  const { data: orgData } = useOrganization(activity?.organizationId, {
    staleTime: 5 * 60 * 1000,
  });

  const isCreator = activity?.creatorId === currentUser?.id;
  const isCancelled = activity?.status === 'cancelled' || activity?.status === 'completed';
  const isParticipant = activity?.participants?.some(p => p.userId === currentUser?.id) ?? false;

  // Fleets in this org (for the "Bring Fleet" flow) + the selected fleet's ships.
  // Loaded whenever org + user are known so we can decide whether to surface the
  // "Bring Fleet" button to fleet leaders (not just the activity creator).
  const { data: fleetsData, isLoading: fleetsLoading } = useFleets(
    activity?.organizationId,
    undefined,
    { enabled: !!activity?.organizationId && !!currentUser?.id }
  );
  const { data: fleetShipsData, isLoading: fleetShipsLoading } = useFleetShips(
    selectedFleetId ?? undefined,
    undefined,
    { enabled: fleetDialogOpen && !!selectedFleetId }
  );

  // Fleets the current user leads (leader or second-in-command).
  const ledFleets = useMemo(
    () =>
      (fleetsData?.items ?? []).filter(
        f =>
          !!currentUser?.id &&
          (f.leaderId === currentUser.id || f.secondInCommandId === currentUser.id)
      ),
    [fleetsData, currentUser?.id]
  );

  // The activity creator may bring any org fleet; a fleet leader only their own.
  const fleetOptions = useMemo(() => {
    const source = isCreator ? (fleetsData?.items ?? []) : ledFleets;
    return source.map(f => ({ id: f.id, name: f.name }));
  }, [isCreator, fleetsData, ledFleets]);

  // Show the button to the creator or to anyone who leads at least one fleet.
  const canBringFleet = isCreator || ledFleets.length > 0;

  const fleetShipOptions = useMemo(
    () => (fleetShipsData?.items ?? []).map(s => ({ id: s.id, name: s.name ?? 'Unnamed ship' })),
    [fleetShipsData]
  );

  // Open passenger seats across the activity's ships, derived from loaded data.
  const availablePassengerSlots: AvailablePassengerSlot[] = useMemo(() => {
    const allShips = [...(activity?.shipAssignments ?? []), ...(activity?.ships ?? [])];
    const result: AvailablePassengerSlot[] = [];
    for (const ship of allShips) {
      for (const slot of ship.passengers ?? []) {
        const available = slot.capacity - slot.filled;
        if (available > 0) {
          result.push({
            shipId: ship.shipId,
            shipType: ship.shipType,
            shipName: ship.shipName,
            ownerName: ship.ownerName,
            role: slot.role,
            availableSlots: available,
          });
        }
      }
    }
    return result;
  }, [activity?.shipAssignments, activity?.ships]);

  // Collect existing ship IDs to prevent duplicate loaning
  const existingShipIds = useMemo(() => {
    const all = [...(activity?.shipAssignments ?? []), ...(activity?.ships ?? [])];
    return all.map(s => s.shipId).filter((id): id is string => !!id);
  }, [activity?.shipAssignments, activity?.ships]);

  // Compute ships with open crew positions for the "Crew a Position" join mode
  const availablePositions: ActivityShipWithPositions[] = useMemo(() => {
    const allShips = [...(activity?.shipAssignments ?? []), ...(activity?.ships ?? [])];
    const seen = new Set<string>();
    const result: ActivityShipWithPositions[] = [];

    for (const ship of allShips) {
      const key = ship.shipId || `${ship.shipType}-${ship.ownerId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const maxCrew = ship.maxCrew ?? ship.crewCapacity ?? 0;
      const currentCrew = ship.crewAssigned ?? ship.currentCrew ?? ship.crewMembers?.length ?? 0;
      const openSlots = Math.max(0, maxCrew - currentCrew);
      if (openSlots <= 0) continue;

      // Determine which positions are already taken
      const takenPositions = new Set<ActivityCrewPosition>();
      for (const member of ship.crewMembers ?? []) {
        const normalizedPosition = normalizeCrewPosition(member.position);
        if (normalizedPosition) {
          takenPositions.add(normalizedPosition);
        }
      }

      const openPositions = CREW_POSITIONS.filter(p => !takenPositions.has(p)).slice(0, openSlots);

      if (openPositions.length > 0) {
        result.push({
          shipId: ship.shipId || key,
          shipName: ship.shipName ?? ship.shipType ?? 'Unknown Ship',
          shipType: ship.shipType ?? '',
          openPositions,
        });
      }
    }
    return result;
  }, [activity?.shipAssignments, activity?.ships]);

  const handleCopyJoinLink = () => {
    if (!id) return;
    generateJoinLinkMutation.mutate(id, {
      onSuccess: data => {
        const url = `${globalThis.location.origin}/j/${data.token}`;
        navigator.clipboard
          .writeText(url)
          .then(() => {
            notification.success('Join link copied to clipboard!');
          })
          .catch(() => {
            notification.error('Failed to copy link');
          });
      },
      onError: () => {
        notification.error('Failed to generate join link');
      },
    });
  };

  const activityMeta = (activity as unknown as { metadata?: Record<string, unknown> })?.metadata;
  const isLfgActivity = !!activityMeta?.originatedFromLFG;

  const togglePanel = (panel: string) => {
    setExpandedPanels(prev => {
      const next = new Set(prev);
      if (next.has(panel)) {
        next.delete(panel);
      } else {
        next.add(panel);
      }
      return next;
    });
  };

  const handleJoinActivity = (data: JoinActivityResult) => {
    if (!id) return;
    joinActivityMutation.mutate(
      {
        activityId: id,
        role: data.role,
        shipId: data.shipId,
        shipType: data.shipType,
        shipName: data.shipName,
        crewPosition: data.crewPosition,
        crewShipId: data.crewShipId,
        notes: data.notes,
      },
      {
        onSuccess: () => {
          setJoinDialogOpen(false);
          const posMsg = data.crewPosition ? ` as ${data.crewPosition}` : '';
          const shipMsg = data.shipName ? ` with ${data.shipName}` : '';
          notification.success(`Successfully joined the activity${posMsg || shipMsg}!`);
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          logger.error(`Failed to join activity: ${message}`);
          notification.error(`Failed to join: ${message}`);
        },
      }
    );
  };

  const handleLeaveActivity = () => {
    if (!id) return;
    leaveActivityMutation.mutate(id, {
      onSuccess: () => {
        notification.success('You have left the activity.');
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to leave activity: ${message}`);
        notification.error(`Failed to leave: ${message}`);
      },
    });
  };

  const formatDate = (date?: Date | string): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error || !activity) {
    return (
      <Box p={3}>
        <Stack spacing={2}>
          <ErrorMessage message={error instanceof Error ? error.message : 'Activity not found'} />
          <Button
            variant="outlined"
            onClick={() => navigate('/activities')}
            startIcon={<ArrowBackIcon />}
          >
            Back to Activities
          </Button>
        </Stack>
      </Box>
    );
  }

  const renderOverview = () => (
    <Stack spacing={3} mt={3}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Activity Information</Typography>
          <Divider />
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                Activity ID
              </Typography>
              <Typography fontWeight={500} sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {activity.id}
              </Typography>
            </Stack>
            {activity.visibility && (
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Visibility
                </Typography>
                <Typography fontWeight={500}>{activity.visibility.toUpperCase()}</Typography>
              </Stack>
            )}
            {activity.organizationId && (
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Organization
                </Typography>
                <Typography fontWeight={500}>
                  {activity.organizationName ||
                    orgData?.name ||
                    activity.organizationId.slice(0, 8) + '…'}
                </Typography>
              </Stack>
            )}
            {activity.endDate && (
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  End Date
                </Typography>
                <Typography fontWeight={500}>{formatDate(activity.endDate)}</Typography>
              </Stack>
            )}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );

  const renderShips = () => (
    <ActivityShipsAndCrew
      activityId={activity.id}
      activity={activity}
      isParticipant={isParticipant}
      isCancelled={isCancelled}
      isCreator={isCreator}
      manageableShipIdentifiers={activity.manageableShipIdentifiers}
      onAddNestedShip={config => setNestedShipDialog({ open: true, ...config })}
      isAddingNestedShip={addNestedShipMutation.isPending}
    />
  );

  const renderRoute = () => (
    <Box mt={3}>
      <RoutePlanner
        activity={activity as unknown as Activity}
        onUpdate={() => void activityQuery.refetch()}
      />
    </Box>
  );

  // renderMining temporarily disabled — pending regolith fetch fix
  // const renderMining = () => (
  //   <Box mt={3}>
  //     <MiningDataDisplay
  //       activity={activity as unknown as Activity}
  //       onUpdate={() => void activityQuery.refetch()}
  //     />
  //   </Box>
  // );

  // Participants are now merged into the Ships & Crew tab

  const renderParticipants = () => {
    const participants = activity.participants ?? [];
    const accepted = participants.filter(p => p.status === 'accepted');
    const invited = participants.filter(p => p.status === 'invited');
    const standby = participants.filter(p => p.status === 'standby');
    const declined = participants.filter(p => p.status === 'declined');

    const renderList = (items: typeof participants, emptyMsg: string) => {
      if (items.length === 0) {
        return (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            {emptyMsg}
          </Typography>
        );
      }
      return (
        <List dense disablePadding>
          {items.map(p => (
            <ListItem key={p.userId} divider>
              <ListItemAvatar>
                <Avatar
                  src={sanitizeImageUrl(p.avatarUrl) || undefined}
                  sx={{ width: 32, height: 32 }}
                >
                  {!p.avatarUrl && <PersonIcon fontSize="small" />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight={600}>
                      {p.userName || p.userId.slice(0, 8) + '…'}
                    </Typography>
                    <Chip
                      label={prettifyRole(p.role)}
                      size="small"
                      sx={{
                        fontSize: '0.7rem',
                        height: 20,
                        backgroundColor: getRoleBgColor(p.role),
                        color: getRoleColor(p.role),
                      }}
                    />
                  </Stack>
                }
                secondary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    {p.shipName && (
                      <Typography variant="caption" color="text.secondary">
                        <RocketLaunchIcon sx={{ fontSize: 12, mr: 0.3, verticalAlign: 'middle' }} />{' '}
                        {p.shipName}
                      </Typography>
                    )}
                    {p.organizationName && (
                      <Typography variant="caption" color="text.secondary">
                        • {p.organizationName}
                      </Typography>
                    )}
                    {p.joinedAt && (
                      <Typography variant="caption" color="text.secondary">
                        • Joined {new Date(p.joinedAt).toLocaleDateString()}
                      </Typography>
                    )}
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
      );
    };

    return (
      <Stack spacing={3} mt={3}>
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                <GroupIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Participants ({participants.length}
                {activity.maxParticipants ? ` / ${activity.maxParticipants}` : ''})
              </Typography>
              {activity.maxParticipants && (
                <LinearProgress
                  variant="determinate"
                  value={Math.min((participants.length / activity.maxParticipants) * 100, 100)}
                  sx={{ width: 120, height: 8, borderRadius: 4 }}
                />
              )}
            </Stack>
            <Divider />
            {accepted.length > 0 && (
              <>
                <Typography variant="subtitle2" color="success.main">
                  Accepted ({accepted.length})
                </Typography>
                {renderList(accepted, '')}
              </>
            )}
            {invited.length > 0 && (
              <>
                <Typography variant="subtitle2" color="warning.main">
                  Invited ({invited.length})
                </Typography>
                {renderList(invited, '')}
              </>
            )}
            {standby.length > 0 && (
              <>
                <Typography variant="subtitle2" color="info.main">
                  Standby ({standby.length})
                </Typography>
                {renderList(standby, '')}
              </>
            )}
            {declined.length > 0 && (
              <>
                <Typography variant="subtitle2" color="text.secondary">
                  Declined ({declined.length})
                </Typography>
                {renderList(declined, '')}
              </>
            )}
            {participants.length === 0 && renderList([], 'No participants yet')}
          </Stack>
        </Paper>
      </Stack>
    );
  };

  // Tab content is now rendered inside Accordion panels below

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1280, mx: 'auto' }}>
      <Stack spacing={3}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={1.5}
        >
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/activities')}
          >
            Back
          </Button>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap rowGap={1}>
            {isCreator && !isCancelled && (
              <Button
                variant="outlined"
                color="info"
                startIcon={<EditIcon />}
                onClick={() => setEditDialogOpen(true)}
              >
                Edit Activity
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopyJoinLink}
              disabled={generateJoinLinkMutation.isPending}
            >
              {generateJoinLinkMutation.isPending ? 'Generating…' : 'Copy Join Link'}
            </Button>
            <Button
              variant="contained"
              onClick={() => setJoinDialogOpen(true)}
              disabled={joinActivityMutation.isPending}
            >
              {isParticipant ? 'Switch Ship' : 'Join Activity'}
            </Button>
            {isParticipant && !isCancelled && (
              <Button
                variant="outlined"
                color="info"
                startIcon={<RocketLaunchIcon />}
                onClick={() => setLoanDialogOpen(true)}
                disabled={loanShipsMutation.isPending}
              >
                {loanShipsMutation.isPending ? 'Loaning…' : 'Loan Ships'}
              </Button>
            )}
            {isParticipant && !isCancelled && availablePassengerSlots.length > 0 && (
              <Button
                variant="outlined"
                color="info"
                startIcon={<MilitaryTechIcon />}
                onClick={() => setPassengerDialogOpen(true)}
                disabled={joinPassengerMutation.isPending}
              >
                {joinPassengerMutation.isPending ? 'Joining…' : 'Join as Passenger'}
              </Button>
            )}
            {canBringFleet && !isCancelled && (
              <Button
                variant="outlined"
                color="info"
                startIcon={<GroupsIcon />}
                onClick={() => setFleetDialogOpen(true)}
                disabled={bringFleetAndInviteMutation.isPending}
              >
                {bringFleetAndInviteMutation.isPending ? 'Bringing…' : 'Bring Fleet'}
              </Button>
            )}
            <Button
              variant="outlined"
              color="error"
              onClick={handleLeaveActivity}
              disabled={leaveActivityMutation.isPending}
            >
              {leaveActivityMutation.isPending ? 'Leaving…' : 'Leave Activity'}
            </Button>
            {isCreator && !isCancelled && (
              <Button
                variant="outlined"
                color="warning"
                startIcon={<CancelIcon />}
                disabled={cancelActivityMutation.isPending}
                onClick={() => {
                  if (!id) return;
                  if (
                    !globalThis.confirm('Cancel this activity? All participants will be notified.')
                  )
                    return;
                  cancelActivityMutation.mutate(id, {
                    onSuccess: () => {
                      notification.success('Activity cancelled');
                    },
                    onError: (err: unknown) => {
                      const message = err instanceof Error ? err.message : String(err);
                      notification.error(`Failed to cancel: ${message}`);
                    },
                  });
                }}
              >
                {cancelActivityMutation.isPending ? 'Cancelling…' : 'Cancel Activity'}
              </Button>
            )}
          </Stack>
        </Stack>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h4">{activity.title}</Typography>
              <Chip
                label={activity.status.toUpperCase()}
                sx={getStatusChipSx(activity.status, theme)}
              />
            </Stack>

            <Typography>{activity.description}</Typography>

            <Box
              sx={{
                mt: 2,
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(auto-fill, minmax(160px, 1fr))',
                },
                gap: 2,
              }}
            >
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Type
                </Typography>
                <Typography fontWeight={700}>
                  {(activity.activityType || activity.type || 'N/A').toUpperCase()}
                </Typography>
              </Stack>
              {activity.location && (
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Location
                  </Typography>
                  <Typography fontWeight={700}>{activity.location}</Typography>
                </Stack>
              )}
              {(activity.scheduledStartDate || activity.startDate) && (
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Start Date
                  </Typography>
                  <Typography fontWeight={700}>
                    {formatDate(activity.scheduledStartDate || activity.startDate)}
                  </Typography>
                </Stack>
              )}
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Ships
                </Typography>
                <Typography fontWeight={700}>{getUniqueShipCount(activity)}</Typography>
              </Stack>
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Participants
                </Typography>
                <Typography fontWeight={700}>
                  {activity.currentParticipants ?? 0}
                  {activity.maxParticipants ? ` / ${activity.maxParticipants}` : ' / ∞'}
                </Typography>
              </Stack>
              {activity.creatorId && (
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Creator
                  </Typography>
                  <Typography fontWeight={700}>
                    {activity.creatorName || activity.creatorId.slice(0, 8) + '…'}
                  </Typography>
                </Stack>
              )}
            </Box>

            {/* Tags and other legacy features coming in V2 API update */}
          </Stack>
        </Paper>

        <Divider />

        {/* Two-column panel layout on wide screens; single column on mobile.
            Left: the core details (overview, ships, participants).
            Right: planning aids (route, availability, LFG). */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
            gap: { xs: 2, md: 3 },
            alignItems: 'start',
          }}
        >
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Accordion
              expanded={expandedPanels.has('overview')}
              onChange={() => togglePanel('overview')}
              disableGutters
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600}>Overview</Typography>
              </AccordionSummary>
              <AccordionDetails>{renderOverview()}</AccordionDetails>
            </Accordion>

            <Accordion
              expanded={expandedPanels.has('ships')}
              onChange={() => togglePanel('ships')}
              disableGutters
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600}>
                  Ships & Crew
                  {(() => {
                    const count = getUniqueShipCount(activity);
                    return count > 0 ? ` (${count})` : '';
                  })()}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>{renderShips()}</AccordionDetails>
            </Accordion>

            <Accordion
              expanded={expandedPanels.has('participants')}
              onChange={() => togglePanel('participants')}
              disableGutters
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600}>
                  Participants ({activity.participants?.length ?? 0}
                  {activity.maxParticipants ? ` / ${activity.maxParticipants}` : ''})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>{renderParticipants()}</AccordionDetails>
            </Accordion>
          </Stack>

          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Accordion
              expanded={expandedPanels.has('route')}
              onChange={() => togglePanel('route')}
              disableGutters
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600}>Route Plan</Typography>
              </AccordionSummary>
              <AccordionDetails>{renderRoute()}</AccordionDetails>
            </Accordion>

            <Accordion
              expanded={expandedPanels.has('availability')}
              onChange={() => togglePanel('availability')}
              disableGutters
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600}>Availability</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {activity.organizationId ? (
                  <Stack spacing={3}>
                    <AvailabilityGrid
                      orgId={activity.organizationId}
                      activityStartDate={
                        activity.scheduledStartDate || activity.startDate || undefined
                      }
                    />
                    <BestTimesPanel orgId={activity.organizationId} />
                  </Stack>
                ) : (
                  <Alert severity="info">
                    Availability is only available for organization-linked activities.
                  </Alert>
                )}
              </AccordionDetails>
            </Accordion>

            {isLfgActivity && (
              <Accordion
                expanded={expandedPanels.has('lfg')}
                onChange={() => togglePanel('lfg')}
                disableGutters
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={600}>LFG Participants</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <LfgTabContent activity={activity} activityMeta={activityMeta} />
                </AccordionDetails>
              </Accordion>
            )}
          </Stack>
        </Box>
      </Stack>

      <JoinActivityDialog
        open={joinDialogOpen}
        onClose={() => setJoinDialogOpen(false)}
        onJoin={handleJoinActivity}
        isJoining={joinActivityMutation.isPending}
        activityTitle={activity.title}
        availablePositions={availablePositions}
      />

      <LoanShipsDialog
        open={loanDialogOpen}
        onClose={() => setLoanDialogOpen(false)}
        onLoan={(data: LoanShipsResult) => {
          if (!id) return;
          loanShipsMutation.mutate(
            { activityId: id, ships: data.ships },
            {
              onSuccess: () => {
                setLoanDialogOpen(false);
                notification.success(
                  `Successfully loaned ${String(data.ships.length)} ship${data.ships.length === 1 ? '' : 's'} to the activity!`
                );
              },
              onError: (err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`Failed to loan ships: ${message}`);
                notification.error(`Failed to loan ships: ${message}`);
              },
            }
          );
        }}
        isLoaning={loanShipsMutation.isPending}
        activityTitle={activity.title}
        existingShipIds={existingShipIds}
      />

      <JoinAsPassengerDialog
        open={passengerDialogOpen}
        onClose={() => setPassengerDialogOpen(false)}
        onJoin={data => {
          if (!id) return;
          joinPassengerMutation.mutate(
            { activityId: id, shipId: data.shipId, passengerRole: data.passengerRole },
            {
              onSuccess: () => {
                setPassengerDialogOpen(false);
                notification.success('Joined as passenger!');
              },
              onError: (err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`Failed to join as passenger: ${message}`);
                notification.error(`Failed to join: ${message}`);
              },
            }
          );
        }}
        isJoining={joinPassengerMutation.isPending}
        slots={availablePassengerSlots}
        activityTitle={activity.title}
      />

      <BringFleetDialog
        open={fleetDialogOpen}
        onClose={() => setFleetDialogOpen(false)}
        onBring={data => {
          if (!id) return;
          bringFleetAndInviteMutation.mutate(
            { activityId: id, fleetId: data.fleetId, shipIds: data.shipIds },
            {
              onSuccess: result => {
                if (result.status === 'full') {
                  notification.success(
                    `Fleet brought in. Invited ${String(result.invited.length)} member(s).`
                  );
                } else {
                  notification.warning(
                    `Fleet ships were added, but invites failed: ${result.inviteError ?? 'Unknown error'}`
                  );
                }
                setFleetDialogOpen(false);
              },
              onError: (err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`Failed to bring fleet: ${message}`);
                notification.error(`Failed to bring fleet: ${message}`);
              },
            }
          );
        }}
        isBringing={bringFleetAndInviteMutation.isPending}
        fleets={fleetOptions}
        fleetsLoading={fleetsLoading}
        ships={fleetShipOptions}
        shipsLoading={fleetShipsLoading}
        selectedFleetId={selectedFleetId}
        onSelectFleet={setSelectedFleetId}
        activityTitle={activity.title}
      />

      <AddNestedShipDialog
        open={nestedShipDialog.open}
        onClose={() => setNestedShipDialog(prev => ({ ...prev, open: false }))}
        onAdd={(data: AddNestedShipResult) => {
          if (!id) return;
          addNestedShipMutation.mutate(
            { activityId: id, shipData: data },
            {
              onSuccess: () => {
                setNestedShipDialog(prev => ({ ...prev, open: false }));
                notification.success(
                  `${data.shipType} added to ${nestedShipDialog.parentShipName}!`
                );
              },
              onError: (err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`Failed to add nested ship: ${message}`);
                notification.error(`Failed to add ship: ${message}`);
              },
            }
          );
        }}
        isAdding={addNestedShipMutation.isPending}
        parentShipId={nestedShipDialog.parentShipId}
        parentShipName={nestedShipDialog.parentShipName}
        transportType={nestedShipDialog.transportType}
        hangarSize={nestedShipDialog.hangarSize}
      />

      {activity && (
        <EditActivityDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          activity={activity}
        />
      )}
    </Box>
  );
};

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Ships & Crew sub-component (uses crew assignment hooks)
// =============================================================================

interface ActivityShipsAndCrewProps {
  activityId: string;
  activity?: ActivityDetail;
  /** Whether current user is a participant (enables add buttons) */
  isParticipant?: boolean;
  /** Whether activity is cancelled/completed (disables add buttons) */
  isCancelled?: boolean;
  /** Whether current user is the activity creator (enables crew/nesting management) */
  isCreator?: boolean;
  /** Ship identifiers the backend allows the current actor to manage. */
  manageableShipIdentifiers?: string[];
  /** Callback to open the add nested ship dialog */
  onAddNestedShip?: (config: {
    parentShipId: string;
    parentShipName: string;
    transportType: 'hangar' | 'cargo';
    hangarSize?: string;
  }) => void;
  /** Whether a nested ship add operation is in progress */
  isAddingNestedShip?: boolean;
}

/** Prettify a ship role string for display. */
function prettifyRole(role?: string): string {
  if (!role) return '';
  return role
    .replaceAll('_', ' ')
    .toLowerCase()
    .replaceAll(/\b\w/g, c => c.toUpperCase());
}

/** Get transport type display label. */
function getTransportLabel(type?: string): string {
  switch (type) {
    case 'hangar':
      return 'Hangar';
    case 'cargo':
      return 'Cargo Bay';
    case 'docking_collar':
      return 'Docked';
    case 'tractor_beam':
      return 'Tractor Beam';
    default:
      return '';
  }
}

/** Canonical ordered crew-position values used across backend + frontend. */
const CREW_POSITIONS = ACTIVITY_CREW_POSITIONS;

/** Role options for the crew-slot editor (value + display label). */
const CREW_SLOT_ROLE_OPTIONS = ACTIVITY_CREW_POSITIONS.map(role => ({
  value: role,
  label: ACTIVITY_CREW_POSITION_LABELS[role],
}));

/** Role options for the passenger-slot editor (value + display label). */
const PASSENGER_SLOT_ROLE_OPTIONS = ACTIVITY_PASSENGER_ROLES.map(role => ({
  value: role,
  label: ACTIVITY_PASSENGER_ROLE_LABELS[role],
}));

/** Count how many crew members currently hold each (normalized) position. */
function countCrewByRole(crewMembers: ReadonlyArray<{ position: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const member of crewMembers) {
    const normalized = normalizeCrewPosition(member.position) ?? member.position.toLowerCase();
    counts[normalized] = (counts[normalized] ?? 0) + 1;
  }
  return counts;
}

/**
 * Normalize legacy or display-form position strings to canonical values.
 * Accepts historical variants like "co-pilot" and "medic".
 */
function normalizeCrewPosition(value?: string): ActivityCrewPosition | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase().replaceAll(/[^a-z]/g, '');
  switch (normalized) {
    case 'pilot':
      return 'pilot';
    case 'copilot':
      return 'copilot';
    case 'gunner':
      return 'gunner';
    case 'engineer':
      return 'engineer';
    case 'navigator':
      return 'navigator';
    case 'cargo':
      return 'cargo';
    case 'medical':
    case 'medic':
      return 'medical';
    default:
      return null;
  }
}

interface CrewPositionSlot {
  position: string;
  filled: boolean;
  assignee?: string;
}

/**
 * Build crew position slots for a ship.
 * Matches existing crew members to positions, then fills remaining
 * with default roles from the standard list.
 */
function buildCrewPositionSlots(
  maxCrew: number,
  crewMembers: Array<{ userName?: string; position?: string; crewPosition?: string }>
): CrewPositionSlot[] {
  if (maxCrew <= 0) return [];

  const slots: CrewPositionSlot[] = [];
  const usedDefaults = new Set<ActivityCrewPosition>();

  // 1. Create slots for existing crew members with their assigned position
  for (const member of crewMembers) {
    const position = member.crewPosition || member.position || 'Crew';
    const normalizedPosition = normalizeCrewPosition(position);
    slots.push({
      position: normalizedPosition
        ? ACTIVITY_CREW_POSITION_LABELS[normalizedPosition]
        : prettifyRole(position),
      filled: true,
      assignee: member.userName,
    });
    if (normalizedPosition) {
      usedDefaults.add(normalizedPosition);
    }
  }

  // 2. Fill remaining open slots with suggested positions
  const remaining = maxCrew - slots.length;
  if (remaining > 0) {
    // Suggest standard positions that aren't taken yet
    const available = CREW_POSITIONS.filter(p => !usedDefaults.has(p));
    for (let i = 0; i < remaining; i++) {
      const fallbackPosition = `Crew ${slots.length + 1 - crewMembers.length}`;
      const position = available[i]
        ? ACTIVITY_CREW_POSITION_LABELS[available[i]]
        : fallbackPosition;
      slots.push({ position, filled: false });
    }
  }

  return slots;
}

/** Determine crew bar color based on lean/conservative/full thresholds. */
function getCrewBarColor(
  filled: number,
  max: number,
  palette: {
    success: { main: string };
    info: { main: string };
    warning: { main: string };
    error: { main: string };
  }
): string {
  if (max <= 0) return palette.error.main;
  const lean = calculateCrewRequirements(max, 'lean');
  const cons = calculateCrewRequirements(max, 'conservative');
  if (filled >= max) return palette.success.main;
  if (filled >= cons.minCrew) return palette.info.main;
  if (filled >= lean.minCrew) return palette.warning.main;
  return palette.error.main;
}

/**
 * Drag handle for a ship card. Rendered in the ship header.
 * Only the handle is draggable so action buttons remain clickable.
 */
const DraggableShipHandle: React.FC<{
  shipAssignmentId: string;
  shipSize?: string;
  disabled?: boolean;
}> = ({ shipAssignmentId, shipSize, disabled = false }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ship:${shipAssignmentId}`,
    data: { type: 'ship', shipAssignmentId, shipSize },
    disabled,
  });
  return (
    <Tooltip title={disabled ? 'Only ship owner or activity creator can move' : 'Drag to nest'}>
      <span>
        <IconButton
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          size="small"
          disabled={disabled}
          sx={{
            cursor: disabled ? 'not-allowed' : 'grab',
            opacity: isDragging ? 0.4 : 1,
            touchAction: 'none',
          }}
          aria-label="Drag ship"
        >
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
};

/**
 * Drop zone for nesting child ships inside a carrier's hangar or cargo bay.
 */
const NestingDropZone: React.FC<{
  parentShipId: string;
  transportType: 'hangar' | 'cargo';
  label: string;
  children?: React.ReactNode;
}> = ({ parentShipId, transportType, label, children }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `drop:${parentShipId}:${transportType}`,
    data: { parentShipId, transportType },
  });
  return (
    <Box
      ref={setNodeRef}
      sx={{
        mt: 1,
        p: 1.5,
        borderRadius: 1,
        border: '1px dashed',
        borderColor: isOver ? 'primary.main' : 'divider',
        backgroundColor: isOver ? 'action.hover' : 'transparent',
        transition: 'background-color 0.15s, border-color 0.15s',
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        {label}
      </Typography>
      <Box sx={{ mt: children ? 1 : 0 }}>{children}</Box>
    </Box>
  );
};

/**
 * Top-level drop zone that un-nests a ship when dropped onto it.
 */
const UnNestDropZone: React.FC = () => {
  const { isOver, setNodeRef } = useDroppable({
    id: 'drop:root',
    data: { parentShipId: null, transportType: null },
  });
  return (
    <Box
      ref={setNodeRef}
      sx={{
        p: 1,
        borderRadius: 1,
        border: '1px dashed',
        borderColor: isOver ? 'warning.main' : 'transparent',
        backgroundColor: isOver ? 'action.hover' : 'transparent',
        textAlign: 'center',
        transition: 'background-color 0.15s, border-color 0.15s',
        minHeight: isOver ? 32 : 0,
        opacity: isOver ? 1 : 0,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        Drop here to un-nest
      </Typography>
    </Box>
  );
};

const ActivityShipsAndCrew: React.FC<ActivityShipsAndCrewProps> = ({
  activityId,
  activity,
  isParticipant = false,
  isCancelled = false,
  isCreator = false,
  manageableShipIdentifiers = [],
  onAddNestedShip,
  isAddingNestedShip = false,
}) => {
  const user = useAuthStore(state => state.user);
  const hasOrg = !!(user?.activeOrgId || user?.organizationId);
  const isPublic = activity?.visibility === 'public';
  const theme = useTheme();
  const notification = useNotification();
  const setCrewPositionMutation = useSetCrewPosition();
  const setShipNestingMutation = useSetShipNesting();
  const setCrewSlotsMutation = useSetCrewSlots();
  const setPassengerSlotsMutation = useSetPassengerSlots();
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // "Edit Slots" dialog — one per ship, opened from the ship header.
  const [slotsDialog, setSlotsDialog] = useState<{
    open: boolean;
    mode: 'crew' | 'passenger';
    shipIdentifier: string;
    shipName: string;
    initialSlots: SlotRow[];
    lockedMinimums: Record<string, number>;
  } | null>(null);

  // Fetch crew assignments — only when user has an org (endpoint is org-scoped).
  const { data, isLoading, error } = useCrewAssignments(
    { page: 1, limit: 50 },
    { enabled: hasOrg }
  );

  const assignments = useMemo(() => {
    if (!hasOrg || !data?.data) return [];
    const matched = data.data.filter(a => a.missionId === activityId);
    return matched.length > 0 ? matched : data.data;
  }, [data, activityId, hasOrg]);

  const manageableShipIdentifierSet = useMemo(
    () => new Set(manageableShipIdentifiers),
    [manageableShipIdentifiers]
  );

  const participants = useMemo(() => activity?.participants ?? [], [activity?.participants]);
  const roleRequirements = activity?.roleRequirements ?? [];
  // Merge shipAssignments + ships (deduplicated by shipId or index)
  const shipAssignments = useMemo(() => {
    const all = [...(activity?.shipAssignments ?? []), ...(activity?.ships ?? [])];
    const seen = new Set<string>();
    return all.filter(s => {
      const key = s.shipId || `${s.shipType}-${s.ownerId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [activity?.shipAssignments, activity?.ships]);

  // Group participants by ship
  const { shipParticipants, unassigned } = useMemo(() => {
    const ships = new Map<string, NonNullable<ActivityDetail['participants']>>();
    const noShip: NonNullable<ActivityDetail['participants']> = [];
    for (const p of participants) {
      const key = p.shipName || p.shipType;
      if (key) {
        const arr = ships.get(key) ?? [];
        arr.push(p);
        ships.set(key, arr);
      } else {
        noShip.push(p);
      }
    }
    return { shipParticipants: ships, unassigned: noShip };
  }, [participants]);

  const openPositions = roleRequirements.filter(
    (r: { filled?: number; count?: number }) => (r.filled ?? 0) < (r.count ?? 0)
  );

  // ---- Render helpers ----

  const renderParticipantItem = (
    p: NonNullable<ActivityDetail['participants']>[number],
    assignment?: NonNullable<ActivityDetail['shipAssignments']>[number]
  ) => {
    const isSelf = !!user?.id && user.id === p.userId;
    const canEditPosition = !isCancelled && !!assignment?.shipId && (isSelf || isCreator);
    const isUpdating =
      setCrewPositionMutation.isPending &&
      setCrewPositionMutation.variables?.targetUserId === p.userId &&
      setCrewPositionMutation.variables?.shipAssignmentId === assignment?.shipId;
    const selectedCrewPosition = normalizeCrewPosition(p.crewPosition) ?? '';
    const selectedCrewPositionLabel = selectedCrewPosition
      ? ACTIVITY_CREW_POSITION_LABELS[selectedCrewPosition]
      : null;

    return (
      <ListItem key={p.userId} sx={{ px: 0, alignItems: 'flex-start' }}>
        <ListItemAvatar>
          <Avatar src={sanitizeImageUrl(p.avatarUrl) || undefined} sx={{ width: 32, height: 32 }}>
            {!p.avatarUrl && <PersonIcon fontSize="small" />}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={p.userName || p.userId.slice(0, 8)}
          secondary={
            canEditPosition && assignment?.shipId ? (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                component="span"
                sx={{ mt: 0.5 }}
              >
                <FormControl size="small" sx={{ minWidth: 140 }} disabled={isUpdating}>
                  <Select
                    value={selectedCrewPosition}
                    displayEmpty
                    onChange={e => {
                      const value = e.target.value as ActivityCrewPosition;
                      if (!assignment.shipId) return;
                      const handleCrewError = (err: Error) =>
                        logger.error(
                          'Failed to set crew position',
                          err instanceof Error ? err : new Error(String(err))
                        );
                      setCrewPositionMutation.mutate(
                        {
                          activityId,
                          targetUserId: p.userId,
                          shipAssignmentId: assignment.shipId,
                          crewPosition: value,
                        },
                        { onError: handleCrewError }
                      );
                    }}
                  >
                    <MenuItem value="">
                      <em>Select position…</em>
                    </MenuItem>
                    {CREW_POSITIONS.map(pos => (
                      <MenuItem key={pos} value={pos}>
                        {ACTIVITY_CREW_POSITION_LABELS[pos]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {isUpdating && <CircularProgress size={16} />}
                {p.notes && (
                  <Typography component="span" variant="caption" color="text.secondary">
                    · {p.notes}
                  </Typography>
                )}
              </Stack>
            ) : (
              [selectedCrewPositionLabel && `Position: ${selectedCrewPositionLabel}`, p.notes]
                .filter(Boolean)
                .join(' · ') || undefined
            )
          }
          secondaryTypographyProps={{ component: 'div' }}
        />
        <Stack direction="row" spacing={0.5}>
          <Chip
            label={getRoleLabel(p.role)}
            size="small"
            sx={{
              color: getRoleColor(p.role),
              backgroundColor: getRoleBgColor(p.role),
              fontWeight: 600,
            }}
          />
          <Chip
            label={p.status}
            size="small"
            variant="outlined"
            sx={getStatusChipSx(p.status, theme)}
          />
        </Stack>
      </ListItem>
    );
  };

  const renderPositions = () => {
    if (roleRequirements.length === 0) return null;
    const totalOpen = openPositions.reduce(
      (s: number, r: { count?: number; filled?: number }) => s + ((r.count ?? 0) - (r.filled ?? 0)),
      0
    );
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <GroupIcon color="primary" />
            <Typography variant="h6">
              Positions{totalOpen > 0 ? ` — ${totalOpen} Open` : ' — All Filled'}
            </Typography>
          </Stack>
          <Divider />
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {roleRequirements.map((req: { role: string; count?: number; filled?: number }) => {
              const filled = req.filled ?? 0;
              const total = req.count ?? 0;
              const isFull = filled >= total;
              return (
                <Chip
                  key={`${req.role}-${req.count}`}
                  label={`${getRoleLabel(req.role)} (${filled}/${total})`}
                  size="small"
                  color={isFull ? 'success' : 'warning'}
                  variant={isFull ? 'outlined' : 'filled'}
                  sx={{ fontWeight: 600 }}
                />
              );
            })}
          </Stack>
        </Stack>
      </Paper>
    );
  };

  /** Render mini-cards for ships nested in a carrier's hangar or cargo bay. */
  const renderNestedChildren = (
    parentShipId: string,
    transportType: 'hangar' | 'cargo'
  ): React.ReactNode => {
    const children = shipAssignments.filter(
      s => s.parentShipId === parentShipId && s.transportType === transportType
    );
    if (children.length === 0) {
      return (
        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
          Drag ships here to nest
        </Typography>
      );
    }
    const handleNestError = (err: Error) => {
      const msg = err instanceof Error ? err.message : 'Failed to un-nest ship';
      notification.error(msg);
    };
    return (
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {children.map(child => {
          const childName = child.shipName ?? child.shipType ?? 'Ship';
          const sizeSuffix = child.metadata?.size ? ` (${child.metadata.size})` : '';
          const childId = child.id;
          const canUnNest =
            !isCancelled && !!childId && (isCreator || (!!user?.id && child.ownerId === user.id));
          const handleUnNest = () => {
            if (!childId) return;
            setShipNestingMutation.mutate(
              {
                activityId,
                shipAssignmentId: childId,
                parentShipId: null,
                transportType: null,
              },
              { onError: handleNestError }
            );
          };
          return (
            <Chip
              key={childId ?? `${childName}-${sizeSuffix}`}
              icon={<RocketLaunchIcon sx={{ fontSize: 14 }} />}
              label={`${childName}${sizeSuffix}`}
              size="small"
              variant="outlined"
              onDelete={canUnNest ? handleUnNest : undefined}
              deleteIcon={canUnNest ? <CloseIcon /> : undefined}
            />
          );
        })}
      </Stack>
    );
  };

  /** Handle drag-end events from the DnD context to nest a ship. */
  const handleDragEnd = (event: DragEndEvent) => {
    const activeData = event.active.data.current as
      | { type?: string; shipAssignmentId?: string }
      | undefined;
    const overData = event.over?.data.current as
      | { parentShipId: string | null; transportType: 'hangar' | 'cargo' | null }
      | undefined;
    if (!activeData?.shipAssignmentId || !overData) return;
    const shipAssignmentId = activeData.shipAssignmentId;
    // Prevent dropping ship onto itself
    if (overData.parentShipId === shipAssignmentId) return;
    const handleNestError = (err: Error) => {
      const msg = err instanceof Error ? err.message : 'Failed to move ship';
      notification.error(msg);
    };
    setShipNestingMutation.mutate(
      {
        activityId,
        shipAssignmentId,
        parentShipId: overData.parentShipId,
        transportType: overData.transportType,
      },
      { onError: handleNestError }
    );
  };

  /** Render a single ship card with specs, crew roster, and open positions. */
  const renderShipCard = (
    shipKey: string,
    crew: NonNullable<ActivityDetail['participants']>,
    assignment?: (typeof shipAssignments)[number]
  ) => {
    const maxCrew = assignment?.maxCrew ?? assignment?.crewCapacity ?? crew.length;
    const crewFilled = assignment?.crewAssigned ?? assignment?.currentCrew ?? crew.length;
    const openSlots = Math.max(0, maxCrew - crewFilled);
    const cargo = assignment?.metadata?.cargoCapacity ?? 0;
    const vehicleCargo = assignment?.metadata?.vehicleCargoCapacity ?? 0;
    const quantumFuel = assignment?.metadata?.quantumFuelCapacity ?? 0;
    const isRefuelCapable = assignment?.metadata?.isRefuelCapable ?? false;
    const isRearmCapable = assignment?.metadata?.isRearmCapable ?? false;
    const isRepairCapable = assignment?.metadata?.isRepairCapable ?? false;
    const hangarSize = assignment?.metadata?.hangarSize;
    const isLoaner = assignment?.isLoaner;
    const loanerShip = assignment?.metadata?.loanerShip;
    const transportType = assignment?.transportType;
    const shipRole = assignment?.role;

    // Backend-provided capability list is source-of-truth for slot management.
    const shipIdentifier = assignment?.id ?? assignment?.shipId ?? assignment?.ownerId ?? undefined;
    const canManageShip =
      !isCancelled && !!shipIdentifier && manageableShipIdentifierSet.has(shipIdentifier);

    return (
      <Paper key={shipKey} sx={{ p: 0, overflow: 'hidden' }}>
        {/* Ship header with accent bar */}
        <Box
          sx={{
            p: 2,
            pb: 1.5,
            borderLeft: '4px solid',
            borderLeftColor: 'info.main',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              {assignment?.id && (
                <DraggableShipHandle
                  shipAssignmentId={assignment.id}
                  shipSize={assignment?.metadata?.size}
                  disabled={
                    isCancelled || !(isCreator || (!!user?.id && assignment?.ownerId === user.id))
                  }
                />
              )}
              <RocketLaunchIcon color="info" />
              <Typography variant="h6" fontWeight={700}>
                {shipKey}
              </Typography>
              {shipRole && (
                <Chip label={prettifyRole(shipRole)} size="small" color="info" variant="outlined" />
              )}
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {isRefuelCapable && (
                <Tooltip title="This ship can refuel other ships in the fleet">
                  <Chip
                    icon={<LocalGasStationIcon sx={{ fontSize: 14 }} />}
                    label="Refuel"
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                </Tooltip>
              )}
              {isRearmCapable && (
                <Tooltip title="This ship can rearm other ships in the fleet">
                  <Chip
                    icon={<SecurityIcon sx={{ fontSize: 14 }} />}
                    label="Rearm"
                    size="small"
                    color="info"
                    variant="outlined"
                  />
                </Tooltip>
              )}
              {isRepairCapable && (
                <Tooltip title="This ship can repair other ships in the fleet">
                  <Chip
                    icon={<BuildIcon sx={{ fontSize: 14 }} />}
                    label="Repair"
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                </Tooltip>
              )}
              {isLoaner && (
                <Tooltip title={loanerShip ? `Loaner for ${loanerShip}` : 'Loaner ship'}>
                  <Chip
                    icon={<LocalOfferIcon sx={{ fontSize: 14 }} />}
                    label="Loaner"
                    size="small"
                    variant="outlined"
                    color="warning"
                  />
                </Tooltip>
              )}
              {transportType && (
                <Chip label={getTransportLabel(transportType)} size="small" variant="outlined" />
              )}
              {canManageShip && shipIdentifier && (
                <>
                  <Tooltip title="Edit crew slots (seats per role)">
                    <Button
                      size="small"
                      variant="outlined"
                      color="info"
                      startIcon={<EventSeatIcon sx={{ fontSize: 16 }} />}
                      onClick={() =>
                        setSlotsDialog({
                          open: true,
                          mode: 'crew',
                          shipIdentifier,
                          shipName: shipKey,
                          initialSlots: (assignment?.crewSlots ?? []).map(s => ({
                            role: s.role,
                            capacity: s.capacity,
                          })),
                          lockedMinimums: countCrewByRole(assignment?.crewMembers ?? []),
                        })
                      }
                    >
                      Crew
                    </Button>
                  </Tooltip>
                  <Tooltip title="Edit passenger seats (e.g. marines)">
                    <Button
                      size="small"
                      variant="outlined"
                      color="info"
                      startIcon={<MilitaryTechIcon sx={{ fontSize: 16 }} />}
                      onClick={() =>
                        setSlotsDialog({
                          open: true,
                          mode: 'passenger',
                          shipIdentifier,
                          shipName: shipKey,
                          initialSlots: (assignment?.passengers ?? []).map(s => ({
                            role: s.role,
                            capacity: s.capacity,
                          })),
                          lockedMinimums: Object.fromEntries(
                            (assignment?.passengers ?? []).map(s => [s.role, s.filled])
                          ),
                        })
                      }
                    >
                      Seats
                    </Button>
                  </Tooltip>
                </>
              )}
            </Stack>
          </Stack>
        </Box>

        {/* Ship specifications row */}
        <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
          <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
            <Tooltip title="Cargo capacity (SCU)">
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Inventory2Icon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  <strong>{cargo}</strong> SCU
                </Typography>
              </Stack>
            </Tooltip>
            {vehicleCargo > 0 && (
              <Tooltip title="Vehicle cargo capacity">
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <DirectionsCarIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    <strong>{vehicleCargo}</strong> vSCU
                  </Typography>
                </Stack>
              </Tooltip>
            )}
            {quantumFuel > 0 && (
              <Tooltip title="Quantum fuel capacity">
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <LocalGasStationIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    QF: <strong>{quantumFuel.toLocaleString()}</strong>
                  </Typography>
                </Stack>
              </Tooltip>
            )}
            <Tooltip title={hangarSize ? `Can carry ${hangarSize}-size ships` : 'No hangar'}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <FlightLandIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  Hangar: <strong>{hangarSize ?? '—'}</strong>
                </Typography>
              </Stack>
            </Tooltip>
            <Tooltip title="Maximum crew capacity">
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <GroupIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  Max Crew: <strong>{maxCrew}</strong>
                </Typography>
              </Stack>
            </Tooltip>
          </Stack>
        </Box>

        {/* SCU Cargo and Quantum Fuel visual bars */}
        {(cargo > 0 || quantumFuel > 0) && (
          <Box sx={{ px: 2, pt: 1.5 }}>
            <Stack spacing={1.5}>
              {cargo > 0 && (
                <Box>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 0.5 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Inventory2Icon sx={{ fontSize: 14 }} color="action" />
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Cargo (SCU)
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      <strong>{cargo.toLocaleString()}</strong> SCU
                      {vehicleCargo > 0 && (
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 0.5 }}
                        >
                          + {vehicleCargo} vSCU
                        </Typography>
                      )}
                    </Typography>
                  </Stack>
                  <Tooltip title={`Cargo capacity: ${cargo.toLocaleString()} SCU`}>
                    <LinearProgress
                      variant="determinate"
                      value={100}
                      color="warning"
                      sx={{
                        height: 8,
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 1,
                        },
                      }}
                    />
                  </Tooltip>
                </Box>
              )}
              {quantumFuel > 0 && (
                <Box>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 0.5 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <LocalGasStationIcon sx={{ fontSize: 14 }} color="action" />
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Quantum Fuel
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      <strong>{quantumFuel.toLocaleString()}</strong>
                    </Typography>
                  </Stack>
                  <Tooltip title={`Quantum fuel capacity: ${quantumFuel.toLocaleString()}`}>
                    <LinearProgress
                      variant="determinate"
                      value={100}
                      color="info"
                      sx={{
                        height: 8,
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 1,
                        },
                      }}
                    />
                  </Tooltip>
                </Box>
              )}
            </Stack>
          </Box>
        )}

        {/* Add Ship / Add Vehicle buttons for carriers */}
        {isParticipant && !isCancelled && onAddNestedShip && (hangarSize || vehicleCargo > 0) && (
          <Box sx={{ px: 2, py: 1 }}>
            <Stack direction="row" spacing={1}>
              {hangarSize && (
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  startIcon={<AddIcon />}
                  onClick={() =>
                    onAddNestedShip({
                      parentShipId: assignment?.shipId ?? shipKey,
                      parentShipName: shipKey,
                      transportType: 'hangar',
                      hangarSize,
                    })
                  }
                  disabled={isAddingNestedShip}
                >
                  Add Ship
                </Button>
              )}
              {vehicleCargo > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<AddIcon />}
                  onClick={() =>
                    onAddNestedShip({
                      parentShipId: assignment?.shipId ?? shipKey,
                      parentShipName: shipKey,
                      transportType: 'cargo',
                    })
                  }
                  disabled={isAddingNestedShip}
                >
                  Add Vehicle
                </Button>
              )}
            </Stack>
          </Box>
        )}

        {/* Drop zones for nesting child ships (hangar / cargo bay) */}
        {assignment?.shipId && (hangarSize || vehicleCargo > 0) && (
          <Box sx={{ px: 2, py: 1 }}>
            {hangarSize && (
              <NestingDropZone
                parentShipId={assignment.shipId}
                transportType="hangar"
                label={`Hangar (max ${hangarSize})`}
              >
                {renderNestedChildren(assignment.shipId, 'hangar')}
              </NestingDropZone>
            )}
            {vehicleCargo > 0 && (
              <NestingDropZone
                parentShipId={assignment.shipId}
                transportType="cargo"
                label={`Cargo Bay (${vehicleCargo} vSCU)`}
              >
                {renderNestedChildren(assignment.shipId, 'cargo')}
              </NestingDropZone>
            )}
          </Box>
        )}

        {/* Crew progress bar with lean/conservative/full gates */}
        <Box sx={{ px: 2, pt: 1.5 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Crew
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {crewFilled}/{maxCrew}
              {openSlots > 0 && (
                <Typography
                  component="span"
                  variant="caption"
                  color="warning.main"
                  sx={{ ml: 0.5 }}
                >
                  ({openSlots} open)
                </Typography>
              )}
            </Typography>
          </Stack>
          {renderCrewGateBar(crewFilled, maxCrew)}
        </Box>

        {/* Crew position slots */}
        {maxCrew > 0 &&
          (() => {
            const positionSlots = buildCrewPositionSlots(
              maxCrew,
              crew.map(c => ({
                userName: c.userName || c.userId?.slice(0, 8),
                position: c.role,
                crewPosition: c.crewPosition,
              }))
            );
            return (
              <Box sx={{ px: 2, pt: 1.5 }}>
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  {positionSlots.map((slot, idx) => (
                    <Tooltip
                      key={`${slot.position}-${String(idx)}`}
                      title={
                        slot.filled
                          ? `${slot.position}: ${slot.assignee}`
                          : `${slot.position} — Open`
                      }
                    >
                      <Chip
                        icon={slot.filled ? <PersonIcon fontSize="small" /> : undefined}
                        label={slot.filled ? `${slot.position}: ${slot.assignee}` : slot.position}
                        size="small"
                        color={slot.filled ? 'success' : 'default'}
                        variant={slot.filled ? 'filled' : 'outlined'}
                        sx={{
                          fontWeight: 500,
                          borderStyle: slot.filled ? 'solid' : 'dashed',
                          opacity: slot.filled ? 1 : 0.7,
                        }}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              </Box>
            );
          })()}

        {/* Crew roster */}
        <Box sx={{ px: 2, pb: 2, pt: 1 }}>
          {crew.length > 0 && (
            <List dense disablePadding>
              {crew.map(member => renderParticipantItem(member, assignment))}
            </List>
          )}
          {crew.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: 'center' }}>
              No crew assigned yet.
            </Typography>
          )}
        </Box>
      </Paper>
    );
  };

  /** Render fleet logistics summary bar — mirrors Discord embed format. */
  const renderFleetLogistics = () => {
    const act = activity as Record<string, unknown> | undefined;
    const totalCargo = (act?.totalCargoCapacity as number) ?? 0;
    const totalQF = (act?.totalQuantumFuel as number) ?? 0;
    const totalQFRequired = (act?.totalQuantumFuelRequired as number) ?? 0;
    const jumpRange = (act?.maxJumpRange as number) ?? 0;
    const hasRefuel = (act?.hasRefuelShip as boolean) ?? false;

    // Only show if any fleet data exists
    if (totalCargo === 0 && totalQF === 0 && jumpRange === 0 && !hasRefuel) return null;

    const fuelProgress = totalQF > 0 ? Math.min((totalQFRequired / totalQF) * 100, 100) : 0;

    return (
      <Paper sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <RocketLaunchIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>
              Fleet Logistics
            </Typography>
          </Stack>
          <Divider />
          <Stack
            direction="row"
            spacing={3}
            flexWrap="wrap"
            useFlexGap
            divider={<Divider orientation="vertical" flexItem />}
          >
            <Tooltip title="Total fleet cargo capacity">
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Inventory2Icon fontSize="small" color="action" />
                <Typography variant="body2">
                  <strong>{totalCargo}</strong> SCU
                </Typography>
              </Stack>
            </Tooltip>
            {totalQF > 0 && (
              <Tooltip
                title={`Quantum fuel: ${totalQFRequired}/${totalQF} SCU ${totalQFRequired > totalQF ? '(insufficient!)' : '(sufficient)'}`}
              >
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 120 }}>
                  <LocalGasStationIcon
                    fontSize="small"
                    color={totalQFRequired > totalQF ? 'error' : 'action'}
                  />
                  <Typography variant="body2">
                    Fuel: <strong>{totalQFRequired}</strong>/{totalQF}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={fuelProgress}
                    color={totalQFRequired > totalQF ? 'error' : 'success'}
                    sx={{ height: 4, borderRadius: 1, flexGrow: 1, minWidth: 40 }}
                  />
                </Stack>
              </Tooltip>
            )}
            {jumpRange > 0 && (
              <Tooltip title="Maximum single jump range (bottleneck ship)">
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="body2">
                    <GpsFixedIcon sx={{ fontSize: 14, mr: 0.3 }} /> Jump:{' '}
                    <strong>{jumpRange.toFixed(1)}</strong> Mkm
                  </Typography>
                </Stack>
              </Tooltip>
            )}
            <Tooltip
              title={
                hasRefuel
                  ? 'Fleet has a refuel-capable ship (unlimited effective range)'
                  : 'No refuel ship — range limited by quantum fuel'
              }
            >
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <LocalGasStationIcon fontSize="small" color={hasRefuel ? 'success' : 'disabled'} />
                <Typography variant="body2" color={hasRefuel ? 'success.main' : 'text.disabled'}>
                  Refuel:{' '}
                  {hasRefuel ? (
                    <CheckCircleIcon sx={{ fontSize: 14, ml: 0.3, color: 'success.main' }} />
                  ) : (
                    '—'
                  )}
                </Typography>
              </Stack>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>
    );
  };

  const renderShipsFromParticipants = () => {
    const requiredShips = activity?.requiredShips ?? [];
    if (shipParticipants.size === 0 && shipAssignments.length === 0 && requiredShips.length === 0)
      return null;

    const renderedShipKeys = new Set<string>();
    const cards: React.ReactNode[] = [];

    // Ships that have participants (skip nested children — rendered inside their carrier)
    for (const [shipKey, crew] of shipParticipants.entries()) {
      renderedShipKeys.add(shipKey.toLowerCase());
      const assignment = shipAssignments.find(
        s => (s.shipName ?? s.shipType ?? '').toLowerCase() === shipKey.toLowerCase()
      );
      if (assignment?.parentShipId) continue;
      cards.push(renderShipCard(shipKey, crew, assignment));
    }

    // Ships from assignments that had no participants yet
    renderUnassignedShipCards(renderedShipKeys, cards);

    // Required ships that aren't yet assigned
    renderRequiredShipCards(requiredShips, renderedShipKeys, cards);

    return (
      <DndContext sensors={dndSensors} onDragEnd={handleDragEnd}>
        <Stack spacing={2}>
          <UnNestDropZone />
          {cards}
        </Stack>
      </DndContext>
    );
  };

  /** Render ship-assignment cards that have no participants yet. */
  const renderUnassignedShipCards = (renderedShipKeys: Set<string>, cards: React.ReactNode[]) => {
    for (const assignment of shipAssignments) {
      // Skip nested children — they are rendered inside their carrier
      if (assignment.parentShipId) continue;
      const key = assignment.shipName ?? assignment.shipType ?? 'Unknown Ship';
      if (renderedShipKeys.has(key.toLowerCase())) continue;
      renderedShipKeys.add(key.toLowerCase());
      const crewFromAssignment: NonNullable<ActivityDetail['participants']> = (
        assignment.crewMembers ?? []
      ).map((cm: { userId: string; userName: string; position: string }) => ({
        userId: cm.userId,
        userName: cm.userName,
        role: cm.position as NonNullable<ActivityDetail['participants']>[number]['role'],
        status: 'accepted' as const,
        joinedAt: new Date(),
        crewPosition: cm.position,
        shipName: key,
        shipType: assignment.shipType,
      }));
      cards.push(renderShipCard(key, crewFromAssignment, assignment));
    }
  };

  /** Render a crew gate bar with lean/conservative/full markers. */
  const renderCrewGateBar = (filled: number, max: number) => {
    const progress = max > 0 ? Math.min((filled / max) * 100, 100) : 0;
    const leanReq = calculateCrewRequirements(max, 'lean');
    const consReq = calculateCrewRequirements(max, 'conservative');
    const leanPct = max > 0 ? (leanReq.minCrew / max) * 100 : 0;
    const consPct = max > 0 ? (consReq.minCrew / max) * 100 : 0;
    const barColor = getCrewBarColor(filled, max, theme.palette);
    return (
      <>
        <Tooltip
          title={`Lean (40%): ${leanReq.minCrew} · Conservative (50%): ${consReq.minCrew} · Full: ${max}`}
        >
          <Box
            sx={{
              position: 'relative',
              height: 10,
              borderRadius: 1,
              bgcolor: 'action.hover',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${progress}%`,
                bgcolor: barColor,
                borderRadius: 1,
                transition: 'width 0.3s ease',
              }}
            />
            {max > 1 && (
              <>
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${leanPct}%`,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    bgcolor: 'warning.main',
                    opacity: 0.7,
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${consPct}%`,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    bgcolor: 'info.main',
                    opacity: 0.7,
                  }}
                />
              </>
            )}
          </Box>
        </Tooltip>
        {max > 1 && (
          <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="warning.main">
              Lean 40%
            </Typography>
            <Typography variant="caption" color="info.main">
              Conservative 50%
            </Typography>
            <Typography variant="caption" color="success.main">
              Full
            </Typography>
          </Stack>
        )}
      </>
    );
  };

  /** Render unfilled required-ship cards into the cards array. */
  const renderRequiredShipCards = (
    requiredShips: NonNullable<ActivityDetail['requiredShips']>,
    renderedShipKeys: Set<string>,
    cards: React.ReactNode[]
  ) => {
    for (const req of requiredShips) {
      if (req.requirementType === 'specific') {
        renderSpecificShipRequirement(req, renderedShipKeys, cards);
      } else {
        renderRoleShipRequirement(req, renderedShipKeys, cards);
      }
    }
  };

  /** Push card(s) for a specific ship requirement if not already rendered. */
  const renderSpecificShipRequirement = (
    req: { shipName: string; count: number; crewPerShip: number },
    renderedShipKeys: Set<string>,
    cards: React.ReactNode[]
  ) => {
    if (renderedShipKeys.has(req.shipName.toLowerCase())) return;
    const count = req.count || 1;
    for (let i = 0; i < count; i++) {
      const label = count > 1 ? `${req.shipName} #${i + 1}` : req.shipName;
      renderedShipKeys.add(`${req.shipName.toLowerCase()}-req-${String(i)}`);
      cards.push(renderSpecificShipCard(label, req.shipName, i, req.crewPerShip));
    }
  };

  /** Push a card for a role-based ship requirement if not already rendered. */
  const renderRoleShipRequirement = (
    req: { role: string; count: number; avgCrewPerShip: number },
    renderedShipKeys: Set<string>,
    cards: React.ReactNode[]
  ) => {
    if (renderedShipKeys.has(`role-${req.role.toLowerCase()}`)) return;
    renderedShipKeys.add(`role-${req.role.toLowerCase()}`);
    cards.push(renderRoleShipCard(req));
  };

  /** Card for a specific unfilled required ship. */
  const renderSpecificShipCard = (
    label: string,
    name: string,
    index: number,
    crewPerShip: number
  ) => (
    <Paper key={`req-${name}-${String(index)}`} sx={{ p: 0, overflow: 'hidden', opacity: 0.85 }}>
      <Box sx={{ p: 2, pb: 1.5, borderLeft: '4px solid', borderLeftColor: 'warning.main' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <RocketLaunchIcon color="warning" />
            <Typography variant="h6" fontWeight={700}>
              {label}
            </Typography>
          </Stack>
          <Chip label="Required — Unfilled" size="small" color="warning" variant="outlined" />
        </Stack>
      </Box>
      <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
        <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
          <Tooltip title="Maximum crew capacity">
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <GroupIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Max Crew: <strong>{crewPerShip}</strong>
              </Typography>
            </Stack>
          </Tooltip>
        </Stack>
      </Box>
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Crew
          </Typography>
          <Typography variant="caption" color="text.secondary">
            0/{crewPerShip}
          </Typography>
        </Stack>
        {renderCrewGateBar(0, crewPerShip)}
      </Box>
      <Box sx={{ px: 2, pt: 1, pb: 2 }}>
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {buildCrewPositionSlots(crewPerShip, []).map((slot, idx) => (
            <Chip
              key={`${slot.position}-${String(idx)}`}
              label={slot.position}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 500, borderStyle: 'dashed', opacity: 0.7 }}
            />
          ))}
        </Stack>
      </Box>
    </Paper>
  );

  /** Card for a role-based unfilled requirement. */
  const renderRoleShipCard = (req: { role: string; count: number; avgCrewPerShip: number }) => (
    <Paper key={`req-role-${req.role}`} sx={{ p: 0, overflow: 'hidden', opacity: 0.85 }}>
      <Box sx={{ p: 2, pb: 1.5, borderLeft: '4px solid', borderLeftColor: 'warning.main' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <RocketLaunchIcon color="warning" />
            <Typography variant="h6" fontWeight={700}>
              {req.role} ×{req.count}
            </Typography>
          </Stack>
          <Chip label="Role Required — Unfilled" size="small" color="warning" variant="outlined" />
        </Stack>
      </Box>
      <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
        <Stack direction="row" spacing={3}>
          <Tooltip title="Average crew per ship">
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <GroupIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                ~<strong>{req.avgCrewPerShip}</strong> crew per ship
              </Typography>
            </Stack>
          </Tooltip>
          <Typography variant="body2" color="text.secondary">
            Total: <strong>{req.count * req.avgCrewPerShip}</strong> crew
          </Typography>
        </Stack>
      </Box>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          Awaiting {req.count} ship(s) matching role &quot;{req.role}&quot;
        </Typography>
      </Box>
    </Paper>
  );

  const renderParticipantSummary = () => {
    if (participants.length === 0 && !activity?.maxParticipants) return null;
    return (
      <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            Total Participants
          </Typography>
          <Typography fontWeight={700}>
            {activity?.currentParticipants || participants.length}
            {activity?.maxParticipants ? ` / ${activity.maxParticipants}` : ''}
          </Typography>
        </Stack>
      </Paper>
    );
  };

  // ---- Unified view: positions + ships + participants ----
  const renderUnifiedView = () => {
    const hasAny =
      participants.length > 0 ||
      roleRequirements.length > 0 ||
      shipAssignments.length > 0 ||
      (activity?.requiredShips?.length ?? 0) > 0;

    if (!hasAny) {
      return (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <RocketLaunchIcon color="primary" />
              <Typography variant="h6">Ships & Crew</Typography>
            </Stack>
            <Divider />
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              No ship or crew assignments for this activity yet.
            </Typography>
          </Stack>
        </Paper>
      );
    }

    return (
      <Stack spacing={2}>
        {renderFleetLogistics()}
        {renderPositions()}
        {renderShipsFromParticipants()}

        {/* Unassigned participants (no ship) */}
        {unassigned.length > 0 && (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <PersonIcon color="primary" />
                <Typography variant="h6">
                  {shipParticipants.size > 0 ? 'Crew Without Ship' : 'Crew Members'} (
                  {unassigned.filter(p => p.status === 'accepted').length})
                </Typography>
              </Stack>
              <Divider />
              <List dense disablePadding>
                {unassigned.map(p => renderParticipantItem(p))}
              </List>
            </Stack>
          </Paper>
        )}

        {renderParticipantSummary()}
      </Stack>
    );
  };

  // ---- Access control & loading ----

  if (!hasOrg) {
    if (isPublic) return <Box mt={3}>{renderUnifiedView()}</Box>;
    return (
      <Box mt={3}>
        <Alert severity="warning">Join an organization to view crew assignments.</Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box mt={3} display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box mt={3}>
        {!isPublic && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Failed to load crew assignments. You may not have permission to view them.
          </Alert>
        )}
        {renderUnifiedView()}
      </Box>
    );
  }

  // No org-scoped assignments — show unified view from activity data
  if (assignments.length === 0) {
    return <Box mt={3}>{renderUnifiedView()}</Box>;
  }

  // Show org-scoped assignments PLUS activity participant info
  return (
    <Box mt={3}>
      <Stack spacing={2}>
        {renderFleetLogistics()}

        {assignments.map(assignment => (
          <Paper key={assignment.id} sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <RocketLaunchIcon color="primary" />
                  <Typography variant="h6">Ship: {assignment.shipId.slice(0, 8)}</Typography>
                </Stack>
                <Chip
                  label={assignment.status.toUpperCase()}
                  size="small"
                  variant="outlined"
                  sx={getStatusChipSx(assignment.status, theme)}
                />
              </Stack>

              {assignment.notes && (
                <Typography variant="body2" color="text.secondary">
                  {assignment.notes}
                </Typography>
              )}

              <Divider />

              <Typography variant="subtitle2">Crew ({assignment.crew?.length || 0})</Typography>

              {assignment.crew && assignment.crew.length > 0 ? (
                <List dense disablePadding>
                  {assignment.crew.map(member => (
                    <ListItem key={member.userId} sx={{ px: 0 }}>
                      <ListItemAvatar>
                        <Avatar
                          src={sanitizeImageUrl(member.avatarUrl) || undefined}
                          sx={{ width: 32, height: 32 }}
                        >
                          {!member.avatarUrl && <PersonIcon fontSize="small" />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={member.username || member.userId.slice(0, 8)}
                        secondary={member.station ? `Station: ${member.station}` : undefined}
                      />
                      <Chip
                        label={getRoleLabel(member.role)}
                        size="small"
                        sx={{
                          color: getRoleColor(member.role),
                          backgroundColor: getRoleBgColor(member.role),
                          fontWeight: 600,
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: 'center', py: 2 }}
                >
                  No crew members assigned yet.
                </Typography>
              )}
            </Stack>
          </Paper>
        ))}

        {/* Also show role requirements & participants from activity */}
        {(roleRequirements.length > 0 || participants.length > 0) && (
          <>
            <Divider sx={{ my: 1 }} />
            {renderPositions()}
            {participants.length > 0 && (
              <Paper sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <GroupIcon color="primary" />
                    <Typography variant="h6">All Participants ({participants.length})</Typography>
                  </Stack>
                  <Divider />
                  <List dense disablePadding>
                    {participants.map(p => renderParticipantItem(p))}
                  </List>
                </Stack>
              </Paper>
            )}
            {renderParticipantSummary()}
          </>
        )}
      </Stack>

      {slotsDialog && (
        <EditShipSlotsDialog
          open={slotsDialog.open}
          onClose={() => setSlotsDialog(null)}
          onSave={slots => {
            const { mode, shipIdentifier } = slotsDialog;
            const mutation = mode === 'crew' ? setCrewSlotsMutation : setPassengerSlotsMutation;
            mutation.mutate(
              {
                activityId,
                shipId: shipIdentifier,
                // Crew roles are a narrower union; the editor only surfaces valid
                // options, so this cast is safe.
                slots: slots as { role: ActivityCrewPosition; capacity: number }[],
              },
              {
                onSuccess: () => {
                  setSlotsDialog(null);
                  notification.success(
                    mode === 'crew' ? 'Crew slots updated.' : 'Passenger seats updated.'
                  );
                },
                onError: (err: unknown) => {
                  const message = err instanceof Error ? err.message : String(err);
                  notification.error(`Failed to update slots: ${message}`);
                },
              }
            );
          }}
          isSaving={setCrewSlotsMutation.isPending || setPassengerSlotsMutation.isPending}
          title={slotsDialog.mode === 'crew' ? 'Edit Crew Slots' : 'Edit Passenger Seats'}
          roleOptions={
            slotsDialog.mode === 'crew' ? CREW_SLOT_ROLE_OPTIONS : PASSENGER_SLOT_ROLE_OPTIONS
          }
          initialSlots={slotsDialog.initialSlots}
          lockedMinimums={slotsDialog.lockedMinimums}
          shipName={slotsDialog.shipName}
        />
      )}
    </Box>
  );
};

// =============================================================================
// LFG Tab sub-component (uses linked session hook)
// =============================================================================

interface LfgTabContentProps {
  activity: ActivityDetail;
  activityMeta?: Record<string, unknown>;
}

const SESSION_STATUS_COLORS: Record<string, 'success' | 'warning' | 'info' | 'error' | 'default'> =
  {
    open: 'success',
    full: 'warning',
    in_progress: 'info',
    completed: 'default',
    cancelled: 'error',
  };

const LfgTabContent: React.FC<LfgTabContentProps> = ({ activity, activityMeta }) => {
  const theme = useTheme();
  const linkedSessionId = activityMeta?.linkedLfgSessionId as string | undefined;
  const { data: lfgSession, isLoading: lfgLoading } = useLfgSession(linkedSessionId);

  const requiresVoice =
    !!(activity as unknown as { requiresVoice?: boolean }).requiresVoice ||
    !!activityMeta?.requiresVoice;
  const languages =
    (activity as unknown as { languages?: string[] }).languages ??
    (activityMeta?.languages as string[] | undefined) ??
    [];

  return (
    <Box mt={3}>
      <Stack spacing={2}>
        <Alert severity="info">
          This activity was created with Looking-for-Group (LFG) enabled.
          {!!activityMeta?.quickJoin &&
            ' Quick Join is active — players can join without approval.'}
        </Alert>

        {/* Session status & details from linked Redis session */}
        {linkedSessionId && (
          <Paper sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle1" fontWeight={600}>
                  Session Details
                </Typography>
                {lfgLoading && <CircularProgress size={16} />}
                {lfgSession && (
                  <Chip
                    label={(lfgSession.status ?? 'unknown').toUpperCase().replaceAll('_', ' ')}
                    size="small"
                    color={SESSION_STATUS_COLORS[lfgSession.status ?? ''] ?? 'default'}
                  />
                )}
              </Stack>
              {lfgSession && (
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Typography variant="body2" color="text.secondary">
                    Players: {lfgSession.currentPlayers?.length ?? 0}
                    {lfgSession.maxPlayers ? ` / ${lfgSession.maxPlayers}` : ''}
                  </Typography>
                  {lfgSession.activityType && (
                    <Typography variant="body2" color="text.secondary">
                      Type: {lfgSession.activityType}
                    </Typography>
                  )}
                </Stack>
              )}
            </Stack>
          </Paper>
        )}

        {/* Voice & language requirements */}
        {(requiresVoice || languages.length > 0) && (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {requiresVoice && (
              <Chip
                icon={<MicIcon fontSize="small" />}
                label="Voice Required"
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
            {languages.map(lang => (
              <Chip
                key={lang}
                icon={<TranslateIcon fontSize="small" />}
                label={lang}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        )}

        {!!activityMeta?.lfgPostId && (
          <Typography variant="body2" color="text.secondary">
            Linked LFG Post ID: {String(activityMeta.lfgPostId)}
          </Typography>
        )}

        <Typography variant="h6">Participants</Typography>
        {activity.participants && activity.participants.length > 0 ? (
          <Stack spacing={1}>
            {activity.participants.map(p => (
              <Stack
                key={p.userId}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ p: 1, borderRadius: 1, bgcolor: 'action.hover' }}
              >
                <PersonIcon fontSize="small" />
                <Typography sx={{ flex: 1 }}>{p.userName || p.userId}</Typography>
                {p.role && (
                  <Chip
                    label={getRoleLabel(p.role)}
                    size="small"
                    sx={{
                      color: getRoleColor(p.role),
                      backgroundColor: getRoleBgColor(p.role),
                      fontWeight: 600,
                    }}
                  />
                )}
                {p.status && (
                  <Chip
                    label={p.status}
                    size="small"
                    variant="outlined"
                    sx={getStatusChipSx(p.status, theme)}
                  />
                )}
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">No participants have joined yet.</Typography>
        )}
      </Stack>
    </Box>
  );
};

export const ActivityDetailWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Activity Details"
    fallbackMessage="Unable to load activity details. Please try again later."
    showHomeButton={true}
  >
    <ActivityDetail />
  </FeatureErrorBoundary>
);
