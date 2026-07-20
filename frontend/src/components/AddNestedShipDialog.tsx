/**
 * AddNestedShipDialog
 *
 * Dialog that lets participants add a ship or vehicle into a parent ship's
 * hangar or cargo bay. Filters the ship catalogue by size compatibility.
 */

import { useShipCatalogue } from '@/hooks/queries/useShipCatalogueQueries';
import type { ShipCatalogueItem } from '@/services/shipCatalogueService';
import {
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface AddNestedShipResult {
  shipType: string;
  shipName: string;
  role: string;
  crewCapacity: number;
  parentShipId: string;
  transportType: 'hangar' | 'cargo';
}

interface AddNestedShipDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onAdd: (data: AddNestedShipResult) => void;
  readonly isAdding: boolean;
  /** Parent ship identifier (shipId or shipName) */
  readonly parentShipId: string;
  /** Parent ship display name */
  readonly parentShipName: string;
  /** Transport mode: 'hangar' for ships, 'cargo' for vehicles */
  readonly transportType: 'hangar' | 'cargo';
  /** Hangar size limit (e.g., "Small", "Medium", "Large") — used for hangar mode */
  readonly hangarSize?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Map hangar size strings to numeric tiers for comparison */
const SIZE_TIER: Record<string, number> = {
  xs: 0,
  snub: 0,
  small: 1,
  medium: 2,
  large: 3,
  sub_capital: 4,
  capital: 5,
};

function sizeFits(shipSize: string | undefined, hangarSize: string | undefined): boolean {
  if (!hangarSize) return true; // no limit
  if (!shipSize) return true; // unknown ship size — allow
  const shipTier = SIZE_TIER[shipSize.toLowerCase()] ?? 1;
  const hangarTier = SIZE_TIER[hangarSize.toLowerCase()] ?? 1;
  return shipTier <= hangarTier;
}

function getDefaultRole(ship: ShipCatalogueItem): string {
  const r = ship.role?.toLowerCase() ?? '';
  if (r.includes('combat') || r.includes('fighter')) return 'combat';
  if (r.includes('mining')) return 'mining';
  if (r.includes('cargo') || r.includes('freight') || r.includes('hauling')) return 'cargo';
  if (r.includes('medical') || r.includes('rescue')) return 'medical';
  if (r.includes('support') || r.includes('repair') || r.includes('refuel')) return 'support';
  if (r.includes('scout') || r.includes('exploration') || r.includes('pathfinder')) return 'scout';
  return 'other';
}

// ============================================================================
// Component
// ============================================================================

export const AddNestedShipDialog: React.FC<Readonly<AddNestedShipDialogProps>> = ({
  open,
  onClose,
  onAdd,
  isAdding,
  parentShipId,
  parentShipName,
  transportType,
  hangarSize,
}) => {
  const [selected, setSelected] = useState<ShipCatalogueItem | null>(null);

  const { data: catalogue, isLoading: catalogueLoading } = useShipCatalogue(undefined, open);

  const filteredShips = useMemo(() => {
    if (!catalogue?.items) return [];
    const items = catalogue.items;

    if (transportType === 'cargo') {
      // Vehicle cargo — show only vehicles
      return items.filter(s => s.isVehicle);
    }
    // Hangar — show ships that fit the hangar size
    return items.filter(s => !s.isVehicle && sizeFits(s.size, hangarSize));
  }, [catalogue, transportType, hangarSize]);

  const handleAdd = () => {
    if (!selected) return;
    onAdd({
      shipType: selected.name,
      shipName: selected.name,
      role: getDefaultRole(selected),
      crewCapacity: selected.maxCrew ?? selected.crew ?? 1,
      parentShipId,
      transportType,
    });
  };

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  const title =
    transportType === 'hangar'
      ? `Add Ship to ${parentShipName} Hangar`
      : `Add Vehicle to ${parentShipName}`;

  const getDescription = (): string => {
    if (transportType === 'cargo') {
      return `Select a ground vehicle to load into ${parentShipName}'s cargo bay.`;
    }
    if (hangarSize) {
      return `Select a ship to carry in ${parentShipName}'s hangar (fits up to ${hangarSize} size).`;
    }
    return `Select a ship to carry in ${parentShipName}'s hangar.`;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {getDescription()}
          </Typography>

          {catalogueLoading ? (
            <Stack alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={32} />
            </Stack>
          ) : (
            <Autocomplete
              options={filteredShips}
              getOptionLabel={o => `${o.name} (${o.manufacturer ?? 'Unknown'})`}
              value={selected}
              onChange={(_, v) => setSelected(v)}
              renderInput={params => (
                <TextField
                  {...params}
                  label={transportType === 'hangar' ? 'Ship' : 'Vehicle'}
                  placeholder={transportType === 'hangar' ? 'Search ships…' : 'Search vehicles…'}
                />
              )}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              noOptionsText={
                transportType === 'hangar' ? 'No ships fit this hangar size' : 'No vehicles found'
              }
            />
          )}

          {selected && (
            <Stack spacing={0.5}>
              <Typography variant="body2">
                <strong>Crew:</strong> {selected.maxCrew ?? selected.crew ?? 1}
              </Typography>
              {selected.cargo != null && selected.cargo > 0 && (
                <Typography variant="body2">
                  <strong>Cargo:</strong> {selected.cargo} SCU
                </Typography>
              )}
              {selected.role && (
                <Typography variant="body2">
                  <strong>Role:</strong> {selected.role}
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isAdding}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={!selected || isAdding}
          startIcon={isAdding ? <CircularProgress size={16} /> : undefined}
        >
          {isAdding ? 'Adding…' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
