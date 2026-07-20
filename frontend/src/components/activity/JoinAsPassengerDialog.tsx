/**
 * JoinAsPassengerDialog
 *
 * Lets a user join a ship as a non-crew passenger (e.g. marine) by picking an
 * open passenger slot. Passengers do not count toward crew capacity.
 */

import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { ACTIVITY_PASSENGER_ROLE_LABELS } from '@sc-fleet-manager/shared-types';
import React, { useCallback, useMemo, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

/** One open passenger slot, as returned by getAvailablePassengerSlots. */
export interface AvailablePassengerSlot {
  shipId?: string;
  shipType: string;
  shipName?: string;
  ownerName: string;
  role: string;
  availableSlots: number;
}

export interface JoinAsPassengerResult {
  /** Ship identifier (shipId, or "shipType::shipName" composite as fallback). */
  shipId: string;
  passengerRole: string;
}

interface JoinAsPassengerDialogProps {
  open: boolean;
  onClose: () => void;
  onJoin: (data: JoinAsPassengerResult) => void;
  isJoining: boolean;
  /** Open passenger slots across the activity's ships. */
  slots: AvailablePassengerSlot[];
  isLoading?: boolean;
  activityTitle?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function roleLabel(role: string): string {
  return (
    ACTIVITY_PASSENGER_ROLE_LABELS[role as keyof typeof ACTIVITY_PASSENGER_ROLE_LABELS] ??
    role.charAt(0).toUpperCase() + role.slice(1)
  );
}

/** Stable identifier for a slot — prefers shipId, falls back to a composite key. */
function slotShipIdentifier(slot: AvailablePassengerSlot): string {
  return slot.shipId ?? `${slot.shipType}::${slot.shipName ?? ''}`;
}

function slotKey(slot: AvailablePassengerSlot): string {
  return `${slotShipIdentifier(slot)}::${slot.role}`;
}

// ============================================================================
// Component
// ============================================================================

export const JoinAsPassengerDialog: React.FC<Readonly<JoinAsPassengerDialogProps>> = ({
  open,
  onClose,
  onJoin,
  isJoining,
  slots,
  isLoading = false,
  activityTitle,
}) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const openSlots = useMemo(() => slots.filter(s => s.availableSlots > 0), [slots]);

  const selectedSlot = useMemo(
    () => openSlots.find(s => slotKey(s) === selectedKey) ?? null,
    [openSlots, selectedKey]
  );

  const handleClose = useCallback(() => {
    setSelectedKey(null);
    onClose();
  }, [onClose]);

  const handleJoin = useCallback(() => {
    if (!selectedSlot) return;
    onJoin({
      shipId: slotShipIdentifier(selectedSlot),
      passengerRole: selectedSlot.role,
    });
  }, [selectedSlot, onJoin]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <MilitaryTechIcon color="primary" />
          <Typography variant="h6" component="span">
            Join as Passenger
          </Typography>
        </Stack>
        {activityTitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Pick an open passenger seat on a ship in &quot;{activityTitle}&quot;
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {isLoading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}

        {!isLoading && openSlots.length === 0 && (
          <Alert severity="info">No open passenger seats are available on any ship yet.</Alert>
        )}

        {!isLoading && openSlots.length > 0 && (
          <List dense disablePadding>
            {openSlots.map(slot => {
              const key = slotKey(slot);
              return (
                <ListItem key={key} disablePadding>
                  <ListItemButton
                    selected={selectedKey === key}
                    onClick={() => setSelectedKey(key)}
                    dense
                  >
                    <ListItemText
                      primary={`${roleLabel(slot.role)} — ${slot.shipName ?? slot.shipType}`}
                      secondary={`${slot.availableSlots} open · ${slot.ownerName}`}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isJoining}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleJoin}
          disabled={isJoining || !selectedSlot}
          startIcon={isJoining ? <CircularProgress size={16} /> : <MilitaryTechIcon />}
        >
          {isJoining ? 'Joining…' : 'Join Seat'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
