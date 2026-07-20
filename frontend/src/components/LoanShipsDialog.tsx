/**
 * LoanShipsDialog
 *
 * Dialog that lets participants loan multiple ships from their hangar
 * to an activity. Ships are marked as loaner (not crewed by the contributor).
 */

import { useUserShips } from '@/hooks/queries';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SearchIcon from '@mui/icons-material/Search';
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
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface LoanShipsResult {
  ships: Array<{
    shipId: string;
    shipType: string;
    shipName: string;
    crewCapacity?: number;
  }>;
}

interface LoanShipsDialogProps {
  open: boolean;
  onClose: () => void;
  onLoan: (data: LoanShipsResult) => void;
  isLoaning: boolean;
  activityTitle?: string;
  /** Ship types already assigned to the activity, to flag duplicates */
  existingShipIds?: string[];
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

export const LoanShipsDialog: React.FC<Readonly<LoanShipsDialogProps>> = ({
  open,
  onClose,
  onLoan,
  isLoaning,
  activityTitle,
  existingShipIds = [],
}) => {
  const user = useAuthStore(state => state.user);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const { data: userShips, isLoading: shipsLoading } = useUserShips(user?.id, {
    enabled: open && !!user?.id,
  });

  // Filter out ships already loaned/assigned to this activity
  const existingSet = useMemo(() => new Set(existingShipIds), [existingShipIds]);

  const eligibleShips = useMemo(() => {
    if (!userShips) return [];
    return userShips.filter(s => !isBundledShipName(s.shipName));
  }, [userShips]);

  const hasOnlyBundledShips = useMemo(
    () => (userShips?.length ?? 0) > 0 && eligibleShips.length === 0,
    [userShips, eligibleShips]
  );

  const emptyStateMessage = useMemo(() => {
    if (hasOnlyBundledShips) {
      return 'No eligible ships are available from your hangar for this selector.';
    }
    if (eligibleShips.length > 0) {
      return 'All your ships are already assigned to this activity.';
    }
    return 'No ships found in your hangar. Add ships to your hangar first.';
  }, [hasOnlyBundledShips, eligibleShips.length]);

  const availableShips = useMemo(() => {
    return eligibleShips.filter(s => !existingSet.has(s.id));
  }, [eligibleShips, existingSet]);

  const filteredShips = useMemo(() => {
    if (!searchQuery.trim()) return availableShips;
    const query = searchQuery.trim().toLowerCase();
    return availableShips.filter(
      s =>
        s.shipName?.toLowerCase().includes(query) || s.manufacturer?.toLowerCase().includes(query)
    );
  }, [availableShips, searchQuery]);

  const handleToggle = useCallback((shipId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(shipId)) {
        next.delete(shipId);
      } else {
        next.add(shipId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (filteredShips.every(s => selectedIds.has(s.id))) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const s of filteredShips) next.delete(s.id);
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const s of filteredShips) next.add(s.id);
        return next;
      });
    }
  }, [filteredShips, selectedIds]);

  const handleLoan = useCallback(() => {
    const ships = availableShips
      .filter(s => selectedIds.has(s.id))
      .map(s => ({
        shipId: s.id,
        shipType: s.shipName,
        shipName: s.shipName,
      }));

    if (ships.length === 0) return;

    logger.info(`Loaning ${String(ships.length)} ship(s) to activity`);
    onLoan({ ships });
  }, [availableShips, selectedIds, onLoan]);

  const handleClose = useCallback(() => {
    setSelectedIds(new Set());
    setSearchQuery('');
    onClose();
  }, [onClose]);

  const loanButtonLabel = `Loan ${String(selectedIds.size)} Ship${selectedIds.size === 1 ? '' : 's'}`;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <RocketLaunchIcon color="primary" />
          <Typography variant="h6">Loan Ships</Typography>
        </Stack>
        {activityTitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Select ships to loan to &quot;{activityTitle}&quot;
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {shipsLoading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}

        {!shipsLoading && availableShips.length === 0 && (
          <Alert severity="info">{emptyStateMessage}</Alert>
        )}

        {!shipsLoading && availableShips.length > 0 && (
          <>
            <TextField
              size="small"
              placeholder="Filter by name…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              fullWidth
              sx={{ mb: 1 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <Typography variant="body2" color="text.secondary">
                {selectedIds.size} of {availableShips.length} selected
              </Typography>
              <Button size="small" onClick={handleSelectAll}>
                {filteredShips.every(s => selectedIds.has(s.id)) && filteredShips.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </Stack>
            {filteredShips.length === 0 && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ py: 2, textAlign: 'center' }}
              >
                No ships match your filter.
              </Typography>
            )}
            <List dense disablePadding>
              {filteredShips.map(ship => (
                <ListItem key={ship.id} disablePadding>
                  <ListItemButton onClick={() => handleToggle(ship.id)} dense>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Checkbox
                        edge="start"
                        checked={selectedIds.has(ship.id)}
                        disableRipple
                        tabIndex={-1}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={ship.shipName}
                      secondary={ship.manufacturer || undefined}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isLoaning}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleLoan}
          disabled={isLoaning || selectedIds.size === 0}
          startIcon={isLoaning ? <CircularProgress size={16} /> : <RocketLaunchIcon />}
        >
          {isLoaning ? 'Loaning…' : loanButtonLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
