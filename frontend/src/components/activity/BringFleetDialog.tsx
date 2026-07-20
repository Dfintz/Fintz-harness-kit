/**
 * BringFleetDialog
 *
 * Lets a fleet leader bring some or all of a fleet's ships into an activity.
 * The user picks a fleet, then either brings every ship or selects a subset.
 *
 * Presentational: the parent supplies the fleet list and the selected fleet's
 * ships (e.g. via useFleets / useFleetShips) and handles the mutation.
 */

import GroupsIcon from '@mui/icons-material/Groups';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface FleetOption {
  id: string;
  name: string;
}

export interface FleetShipOption {
  id: string;
  name: string;
}

export interface BringFleetResult {
  fleetId: string;
  /** Omitted when bringing all ships. */
  shipIds?: string[];
}

interface BringFleetDialogProps {
  open: boolean;
  onClose: () => void;
  onBring: (data: BringFleetResult) => void;
  isBringing: boolean;
  /** Fleets the leader can choose from. */
  fleets: FleetOption[];
  fleetsLoading?: boolean;
  /** The selected fleet's ships (loaded by the parent when selectedFleetId changes). */
  ships: FleetShipOption[];
  shipsLoading?: boolean;
  /** Controlled selected fleet — drives the parent's ship query. */
  selectedFleetId: string | null;
  onSelectFleet: (fleetId: string) => void;
  activityTitle?: string;
}

// ============================================================================
// Component
// ============================================================================

export const BringFleetDialog: React.FC<Readonly<BringFleetDialogProps>> = ({
  open,
  onClose,
  onBring,
  isBringing,
  fleets,
  fleetsLoading = false,
  ships,
  shipsLoading = false,
  selectedFleetId,
  onSelectFleet,
  activityTitle,
}) => {
  const [bringAll, setBringAll] = useState(true);
  const [selectedShipIds, setSelectedShipIds] = useState<Set<string>>(new Set());

  // Reset ship selection whenever the fleet changes.
  useEffect(() => {
    setSelectedShipIds(new Set());
    setBringAll(true);
  }, [selectedFleetId]);

  const handleToggleShip = useCallback((shipId: string) => {
    setSelectedShipIds(prev => {
      const next = new Set(prev);
      if (next.has(shipId)) next.delete(shipId);
      else next.add(shipId);
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    setSelectedShipIds(new Set());
    setBringAll(true);
    onClose();
  }, [onClose]);

  const canBring = useMemo(() => {
    if (!selectedFleetId) return false;
    if (bringAll) return ships.length > 0;
    return selectedShipIds.size > 0;
  }, [selectedFleetId, bringAll, ships.length, selectedShipIds.size]);

  const handleBring = useCallback(() => {
    if (!selectedFleetId || !canBring) return;
    onBring({
      fleetId: selectedFleetId,
      shipIds: bringAll ? undefined : Array.from(selectedShipIds),
    });
  }, [selectedFleetId, canBring, bringAll, selectedShipIds, onBring]);

  const bringLabel = bringAll
    ? `Bring ${ships.length} Ship${ships.length === 1 ? '' : 's'}`
    : `Bring ${selectedShipIds.size} Ship${selectedShipIds.size === 1 ? '' : 's'}`;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <GroupsIcon color="primary" />
          <Typography variant="h6" component="span">
            Bring a Fleet
          </Typography>
        </Stack>
        {activityTitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Add fleet ships to &quot;{activityTitle}&quot;
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {fleetsLoading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}

        {!fleetsLoading && fleets.length === 0 && (
          <Alert severity="info">You don&apos;t lead any fleets with ships to bring.</Alert>
        )}

        {!fleetsLoading && fleets.length > 0 && (
          <Stack spacing={2}>
            <TextField
              select
              size="small"
              label="Fleet"
              value={selectedFleetId ?? ''}
              onChange={e => onSelectFleet(e.target.value)}
              fullWidth
            >
              {fleets.map(fleet => (
                <MenuItem key={fleet.id} value={fleet.id}>
                  {fleet.name}
                </MenuItem>
              ))}
            </TextField>

            {selectedFleetId && (
              <>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={bringAll}
                      onChange={e => setBringAll(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Bring all ships in this fleet"
                />

                {shipsLoading && (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress size={24} />
                  </Box>
                )}

                {!shipsLoading && ships.length === 0 && (
                  <Alert severity="info">This fleet has no ships.</Alert>
                )}

                {!shipsLoading && !bringAll && ships.length > 0 && (
                  <List dense disablePadding>
                    {ships.map(ship => (
                      <ListItem key={ship.id} disablePadding>
                        <ListItemButton onClick={() => handleToggleShip(ship.id)} dense>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Checkbox
                              edge="start"
                              checked={selectedShipIds.has(ship.id)}
                              disableRipple
                              tabIndex={-1}
                            />
                          </ListItemIcon>
                          <ListItemText primary={ship.name} />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                )}
              </>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isBringing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleBring}
          disabled={isBringing || !canBring}
          startIcon={isBringing ? <CircularProgress size={16} /> : <RocketLaunchIcon />}
        >
          {isBringing ? 'Bringing…' : bringLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
