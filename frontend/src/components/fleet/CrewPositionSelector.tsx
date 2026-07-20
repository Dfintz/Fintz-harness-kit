/**
 * CrewPositionSelector
 *
 * Lets team members assigned to a fleet's crew team select their
 * preferred ship and crew role.  Shows per-ship assignments with
 * available/filled slots so the user can make an informed choice.
 */

import {
  useFleetCrewPositions,
  useSelectCrewPosition,
  useUnselectCrewPosition,
} from '@/hooks/queries/useFleetQueries';
import type { CrewPositionShip } from '@/services/fleetServiceV2';
import { useNotification } from '@/store/uiStore';
import {
  CREW_ROLE_OPTIONS,
  getRoleBgColor,
  getRoleColor,
  getRoleLabel,
} from '@/utils/crewRoleHelpers';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useMemo, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface CrewPositionSelectorProps {
  fleetId: string;
  currentUserId: string;
}

// ============================================================================
// Sub-components
// ============================================================================

const ShipPositionCard: React.FC<
  Readonly<{
    ship: CrewPositionShip;
    currentUserId: string;
    onSelect: (shipId: string) => void;
  }>
> = ({ ship, currentUserId, onSelect }) => {
  const theme = useTheme();
  const fillPct = ship.maxCrew > 0 ? (ship.crew.length / ship.maxCrew) * 100 : 0;
  const isFull = ship.crew.length >= ship.maxCrew;
  const userOnShip = ship.crew.find(c => c.userId === currentUserId);

  let borderColor = alpha(theme.palette.divider, 1);
  if (userOnShip) borderColor = alpha(theme.palette.success.main, 0.5);
  else if (isFull) borderColor = alpha(theme.palette.error.main, 0.3);

  let barColor = 'primary.main';
  if (isFull) barColor = 'success.main';
  else if (fillPct >= 50) barColor = 'warning.main';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderColor,
        bgcolor: userOnShip ? alpha(theme.palette.success.main, 0.04) : 'background.paper',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {ship.shipName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {ship.crew.length}/{ship.maxCrew} crew
        </Typography>
      </Stack>

      <LinearProgress
        variant="determinate"
        value={Math.min(fillPct, 100)}
        sx={{
          height: 4,
          borderRadius: 2,
          mb: 1,
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          '& .MuiLinearProgress-bar': {
            borderRadius: 2,
            bgcolor: barColor,
          },
        }}
      />

      {/* Assigned crew */}
      {ship.crew.length > 0 && (
        <Stack spacing={0.5} sx={{ mb: 1 }}>
          {ship.crew.map((member, index) => (
            <Stack
              key={member.userId}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ pl: 0.5 }}
            >
              <Typography
                variant="caption"
                sx={{
                  width: 18,
                  textAlign: 'right',
                  color: 'text.disabled',
                  fontWeight: 500,
                  fontSize: '0.65rem',
                }}
              >
                {index + 1}.
              </Typography>
              <Avatar
                src={sanitizeImageUrl(member.avatar) || undefined}
                sx={{ width: 20, height: 20, fontSize: '0.7rem' }}
              >
                {member.username.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="caption" sx={{ flex: 1 }}>
                {member.username}
                {member.userId === currentUserId && ' (you)'}
              </Typography>
              <Chip
                size="small"
                label={getRoleLabel(member.role)}
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  bgcolor: getRoleBgColor(member.role),
                  color: getRoleColor(member.role),
                }}
              />
            </Stack>
          ))}
        </Stack>
      )}

      {/* Action */}
      {userOnShip ? (
        <Chip
          size="small"
          icon={<CheckCircleIcon />}
          label="Your Position"
          color="success"
          variant="outlined"
          sx={{ fontSize: '0.75rem' }}
        />
      ) : (
        <Button
          size="small"
          variant="outlined"
          startIcon={<PersonAddIcon />}
          onClick={() => onSelect(ship.shipId)}
          disabled={isFull}
          sx={{ fontSize: '0.75rem', py: 0.25 }}
        >
          {isFull ? 'Full' : 'Select This Ship'}
        </Button>
      )}
    </Paper>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const CrewPositionSelector: React.FC<Readonly<CrewPositionSelectorProps>> = ({
  fleetId,
  currentUserId,
}) => {
  const theme = useTheme();
  const { data: positionsData, isLoading, error } = useFleetCrewPositions(fleetId);
  const selectMutation = useSelectCrewPosition();
  const unselectMutation = useUnselectCrewPosition();

  const positions = positionsData?.ships;
  const joinPolicy = positionsData?.joinPolicy ?? 'closed';

  const [selectDialogShipId, setSelectDialogShipId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('crew');
  const notification = useNotification();

  // Find current user's assignment across all ships
  const currentAssignment = useMemo(() => {
    if (!positions) return null;
    for (const ship of positions) {
      const member = ship.crew.find(c => c.userId === currentUserId);
      if (member) return { shipId: ship.shipId, shipName: ship.shipName, role: member.role };
    }
    return null;
  }, [positions, currentUserId]);

  const selectedShip = positions?.find(s => s.shipId === selectDialogShipId);

  const handleOpenSelect = (shipId: string) => {
    setSelectDialogShipId(shipId);
    setSelectedRole('crew');
  };

  const handleConfirmSelect = async () => {
    if (!selectDialogShipId) return;
    try {
      const result = await selectMutation.mutateAsync({
        fleetId,
        shipId: selectDialogShipId,
        role: selectedRole,
      });
      setSelectDialogShipId(null);
      if (result.pending) {
        notification.success('Position request submitted — awaiting approval');
      } else {
        notification.success('Crew position selected!');
      }
    } catch (err) {
      logger.error(
        'Failed to select crew position',
        err instanceof Error ? err : new Error(String(err))
      );
      notification.error(err instanceof Error ? err.message : 'Failed to select position');
    }
  };

  const handleVacate = async () => {
    try {
      await unselectMutation.mutateAsync(fleetId);
      notification.success('Crew position vacated');
    } catch (err) {
      logger.error(
        'Failed to vacate crew position',
        err instanceof Error ? err : new Error(String(err))
      );
      notification.error(err instanceof Error ? err.message : 'Failed to vacate position');
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load crew positions</Alert>;
  }

  if (!positions || positions.length === 0) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        No ships in this fleet yet. Add ships to enable crew position selection.
      </Alert>
    );
  }

  return (
    <>
      <Stack spacing={2}>
        {/* Join policy indicator */}
        <Stack direction="row" spacing={1} alignItems="center">
          {joinPolicy === 'open' ? (
            <Chip
              size="small"
              icon={<LockOpenIcon />}
              label="Open Team — join directly"
              color="success"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          ) : (
            <Chip
              size="small"
              icon={<LockIcon />}
              label="Closed Team — requires approval"
              color="warning"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          )}
        </Stack>

        {/* Current assignment banner */}
        {currentAssignment && (
          <Paper
            sx={{
              p: 1.5,
              bgcolor: alpha(theme.palette.success.main, 0.06),
              border: '1px solid',
              borderColor: alpha(theme.palette.success.main, 0.3),
              borderRadius: 2,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                <Typography variant="body2">
                  You are assigned to <strong>{currentAssignment.shipName}</strong> as{' '}
                  <Chip
                    size="small"
                    label={getRoleLabel(currentAssignment.role)}
                    sx={{
                      height: 18,
                      fontSize: '0.7rem',
                      bgcolor: getRoleBgColor(currentAssignment.role),
                      color: getRoleColor(currentAssignment.role),
                    }}
                  />
                </Typography>
              </Stack>
              <Button
                size="small"
                color="warning"
                variant="outlined"
                startIcon={<ExitToAppIcon />}
                onClick={handleVacate}
                disabled={unselectMutation.isPending}
                sx={{ fontSize: '0.75rem' }}
              >
                {unselectMutation.isPending ? 'Leaving...' : 'Leave Position'}
              </Button>
            </Stack>
          </Paper>
        )}

        {/* Ship cards */}
        <Typography variant="subtitle2" color="text.secondary">
          Select your ship and crew role
        </Typography>
        <Stack spacing={1}>
          {positions.map(ship => (
            <ShipPositionCard
              key={ship.shipId}
              ship={ship}
              currentUserId={currentUserId}
              onSelect={handleOpenSelect}
            />
          ))}
        </Stack>
      </Stack>

      {/* Role selection dialog */}
      <Dialog
        open={!!selectDialogShipId}
        onClose={() => setSelectDialogShipId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Select Crew Position</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Choose your crew role on <strong>{selectedShip?.shipName}</strong>
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Crew Role</InputLabel>
            <Select
              value={selectedRole}
              label="Crew Role"
              onChange={(e: SelectChangeEvent) => setSelectedRole(e.target.value)}
            >
              {CREW_ROLE_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: getRoleColor(opt.value),
                      }}
                    />
                    <span>{opt.label}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectDialogShipId(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmSelect}
            disabled={selectMutation.isPending}
            startIcon={joinPolicy === 'closed' ? <HourglassEmptyIcon /> : undefined}
          >
            {selectMutation.isPending
              ? 'Selecting...'
              : joinPolicy === 'closed'
                ? 'Request Position'
                : 'Confirm Selection'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
