/**
 * JoinActivityDialog
 *
 * Dialog that lets users choose how to join an activity:
 * - "Join as Crew" — joins without bringing a ship
 * - "Join with Ship" — picks a ship from their hangar
 * - "Crew a Position" — picks a specific crew position on an existing ship
 *
 * Mirrors the Jobs apply pattern (JobPreviewModal UncappedApplyButtons).
 */

import { useUserShips } from '@/hooks/queries';
import type { UserShip } from '@/services/userProfileService';
import { useAuthStore } from '@/store/authStore';
import { getRoleBgColor, getRoleColor, getRoleLabel } from '@/utils/crewRoleHelpers';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import GroupIcon from '@mui/icons-material/Group';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ACTIVITY_CREW_POSITION_LABELS,
  type ActivityCrewPosition,
} from '@sc-fleet-manager/shared-types';
import React, { useCallback, useMemo, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface JoinActivityResult {
  role: string;
  shipId?: string;
  shipType?: string;
  shipName?: string;
  crewPosition?: ActivityCrewPosition;
  crewShipId?: string;
  notes?: string;
}

/** Ship with open crew positions for the "Crew a Position" mode. */
export interface ActivityShipWithPositions {
  shipId: string;
  shipName: string;
  shipType: string;
  openPositions: ActivityCrewPosition[];
}

interface JoinActivityDialogProps {
  open: boolean;
  onClose: () => void;
  onJoin: (data: JoinActivityResult) => void;
  isJoining: boolean;
  activityTitle?: string;
  /** Ships with open crew positions — enables "Crew a Position" mode */
  availablePositions?: ActivityShipWithPositions[];
}

// ============================================================================
// Helpers
// ============================================================================

function getConfirmLabel(
  mode: 'select' | 'crew' | 'ship' | 'position',
  isJoining: boolean
): string {
  if (isJoining) return 'Joining…';
  if (mode === 'crew') return 'Join as Crew';
  if (mode === 'position') return 'Join Position';
  return 'Join with Ship';
}

const BUNDLED_SHIP_NAME_TOKEN = ' with ';

function isBundledShipName(shipName: string | undefined): boolean {
  if (!shipName) {
    return false;
  }
  return shipName.toLowerCase().includes(BUNDLED_SHIP_NAME_TOKEN);
}

// ============================================================================
// Component
// ============================================================================

export const JoinActivityDialog: React.FC<Readonly<JoinActivityDialogProps>> = ({
  open,
  onClose,
  onJoin,
  isJoining,
  activityTitle,
  availablePositions = [],
}) => {
  const user = useAuthStore(state => state.user);

  // Fetch user's ships from hangar
  const { data: userShips, isLoading: shipsLoading } = useUserShips(user?.id, {
    enabled: open && !!user?.id,
  });

  // Local state
  const [mode, setMode] = useState<'select' | 'crew' | 'ship' | 'position'>('select');
  const [selectedShip, setSelectedShip] = useState<UserShip | null>(null);
  const [selectedPositionShip, setSelectedPositionShip] =
    useState<ActivityShipWithPositions | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<ActivityCrewPosition | ''>('');
  const [notes, setNotes] = useState('');

  // Build autocomplete options, deduplicating by ship model
  const shipOptions = useMemo(() => {
    if (!userShips) return [];
    return userShips.filter(ship => !isBundledShipName(ship.shipName));
  }, [userShips]);

  const handleReset = useCallback(() => {
    setMode('select');
    setSelectedShip(null);
    setSelectedPositionShip(null);
    setSelectedPosition('');
    setNotes('');
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [onClose, handleReset]);

  const handleJoinAsCrew = useCallback(() => {
    onJoin({ role: 'member', notes: notes || undefined });
    handleReset();
  }, [onJoin, notes, handleReset]);

  const handleJoinWithShip = useCallback(() => {
    if (!selectedShip) return;
    onJoin({
      role: 'member',
      shipId: selectedShip.id,
      shipType: selectedShip.shipName,
      shipName: selectedShip.shipName,
      notes: notes || undefined,
    });
    handleReset();
  }, [onJoin, selectedShip, notes, handleReset]);

  const handleJoinPosition = useCallback(() => {
    if (!selectedPositionShip || !selectedPosition) return;
    onJoin({
      role: 'member',
      crewPosition: selectedPosition,
      crewShipId: selectedPositionShip.shipId,
      shipName: selectedPositionShip.shipName,
      shipType: selectedPositionShip.shipType,
      notes: notes || undefined,
    });
    handleReset();
  }, [onJoin, selectedPositionShip, selectedPosition, notes, handleReset]);

  // ---- Render: mode selection ----
  const renderModeSelection = () => (
    <Stack spacing={2} sx={{ pt: 1 }}>
      <Typography variant="body2" color="text.secondary">
        How would you like to join this activity?
      </Typography>

      <Button
        variant="contained"
        color="success"
        size="large"
        startIcon={<GroupIcon />}
        onClick={() => setMode('crew')}
        fullWidth
        sx={{ justifyContent: 'flex-start', py: 1.5, textTransform: 'none', fontWeight: 600 }}
      >
        Join as Crew
      </Button>

      <Button
        variant="contained"
        color="primary"
        size="large"
        startIcon={<RocketLaunchIcon />}
        onClick={() => setMode('ship')}
        fullWidth
        sx={{ justifyContent: 'flex-start', py: 1.5, textTransform: 'none', fontWeight: 600 }}
      >
        Join with Ship
      </Button>

      <Button
        variant="contained"
        color="info"
        size="large"
        startIcon={<AssignmentIndIcon />}
        onClick={() => setMode('position')}
        fullWidth
        disabled={availablePositions.length === 0}
        sx={{ justifyContent: 'flex-start', py: 1.5, textTransform: 'none', fontWeight: 600 }}
      >
        Crew a Position
        {availablePositions.length === 0 && (
          <Typography variant="caption" sx={{ ml: 1, opacity: 0.7 }}>
            (no open positions)
          </Typography>
        )}
      </Button>
    </Stack>
  );

  // ---- Render: join as crew form ----
  const renderCrewForm = () => (
    <Stack spacing={2} sx={{ pt: 1 }}>
      <Typography variant="body2" color="text.secondary">
        You will join this activity as a crew member without bringing a ship.
      </Typography>

      <TextField
        label="Message (optional)"
        placeholder="Add a note for the activity leader..."
        multiline
        minRows={2}
        maxRows={4}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        fullWidth
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />
    </Stack>
  );

  // ---- Render: join with ship form ----
  const renderShipForm = () => {
    let shipContent: React.ReactNode;
    if (shipsLoading) {
      shipContent = (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={24} />
        </Box>
      );
    } else if (shipOptions.length === 0) {
      const hasShipsInHangar = (userShips?.length ?? 0) > 0;
      shipContent = (
        <Typography variant="body2" color="warning.main" sx={{ py: 1 }}>
          {hasShipsInHangar
            ? 'No eligible ships are available from your hangar for this selector.'
            : "You don't have any ships in your hangar. You can still join as crew."}
        </Typography>
      );
    } else {
      shipContent = (
        <Autocomplete<UserShip>
          options={shipOptions}
          value={selectedShip}
          onChange={(_, value) => setSelectedShip(value)}
          getOptionLabel={option => {
            return option.manufacturer
              ? `${option.shipName} (${option.manufacturer})`
              : option.shipName;
          }}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.id}>
              <Stack>
                <Typography variant="body2" fontWeight={600}>
                  {option.shipName}
                </Typography>
                {option.manufacturer && (
                  <Typography variant="caption" color="text.secondary">
                    {option.manufacturer}
                  </Typography>
                )}
              </Stack>
            </Box>
          )}
          renderInput={params => (
            <TextField {...params} label="Select Ship" placeholder="Search your ships..." />
          )}
          fullWidth
          isOptionEqualToValue={(option, value) => option.id === value.id}
        />
      );
    }

    return (
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Select a ship from your hangar to bring to this activity.
        </Typography>

        {shipContent}

        <TextField
          label="Message (optional)"
          placeholder="Add a note for the activity leader..."
          multiline
          minRows={2}
          maxRows={4}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          fullWidth
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
      </Stack>
    );
  };

  // ---- Render: crew a position form ----
  const renderPositionForm = () => {
    const positionsForShip = selectedPositionShip?.openPositions ?? [];

    return (
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Select a ship and an open crew position to fill.
        </Typography>

        <FormControl fullWidth>
          <InputLabel>Ship</InputLabel>
          <Select
            value={selectedPositionShip?.shipId ?? ''}
            label="Ship"
            onChange={e => {
              const ship = availablePositions.find(s => s.shipId === e.target.value);
              setSelectedPositionShip(ship ?? null);
              setSelectedPosition('');
            }}
          >
            {availablePositions.map(ship => (
              <MenuItem key={ship.shipId} value={ship.shipId}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" fontWeight={600}>
                    {ship.shipName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ({ship.shipType})
                  </Typography>
                  <Chip
                    label={`${String(ship.openPositions.length)} open`}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ ml: 'auto' }}
                  />
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedPositionShip && (
          <FormControl fullWidth>
            <InputLabel>Position</InputLabel>
            <Select
              value={selectedPosition}
              label="Position"
              onChange={e => setSelectedPosition(e.target.value)}
            >
              {positionsForShip.map(pos => (
                <MenuItem key={pos} value={pos}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={ACTIVITY_CREW_POSITION_LABELS[pos] ?? getRoleLabel(pos)}
                      size="small"
                      sx={{
                        backgroundColor: getRoleBgColor(pos),
                        color: getRoleColor(pos),
                        fontWeight: 600,
                      }}
                    />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <TextField
          label="Message (optional)"
          placeholder="Add a note for the activity leader..."
          multiline
          minRows={2}
          maxRows={4}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          fullWidth
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
      </Stack>
    );
  };

  // ---- Determine confirm action based on mode ----
  const canConfirm =
    mode === 'crew' ||
    (mode === 'ship' && selectedShip !== null) ||
    (mode === 'position' && selectedPositionShip !== null && selectedPosition !== '');

  const confirmActions: Record<string, () => void> = {
    crew: handleJoinAsCrew,
    position: handleJoinPosition,
    ship: handleJoinWithShip,
  };
  const handleConfirm = confirmActions[mode] ?? handleJoinWithShip;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Join Activity
        {activityTitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {activityTitle}
          </Typography>
        )}
      </DialogTitle>

      <Divider />

      <DialogContent>
        {mode === 'select' && renderModeSelection()}
        {mode === 'crew' && renderCrewForm()}
        {mode === 'ship' && renderShipForm()}
        {mode === 'position' && renderPositionForm()}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {mode !== 'select' && (
          <Button onClick={handleReset} disabled={isJoining}>
            Back
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={handleClose} disabled={isJoining}>
          Cancel
        </Button>
        {mode !== 'select' && (
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={!canConfirm || isJoining}
            startIcon={isJoining ? <CircularProgress size={16} /> : undefined}
          >
            {getConfirmLabel(mode, isJoining)}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
