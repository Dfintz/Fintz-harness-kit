/**
 * ShipPickerDialog
 *
 * Reusable dialog that displays available ships from the organization fleet
 * and member-shared ships. Supports search, role/size filtering, and multi-select.
 * Returns selected ship IDs — does NOT create ships.
 */

import { AvailableShip, useAvailableShips } from '@/hooks/queries/useAvailableShipQueries';
import { useAuthStore } from '@/store/authStore';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface ShipPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (shipIds: string[]) => void;
  excludeShipIds?: string[];
  title?: string;
  loading?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const IN_CONCEPT = 'in_concept';

const STATUS_LABELS: Record<string, string> = {
  in_concept: 'In Concept',
  in_production: 'In Production',
  announced: 'Announced',
};

const ROLE_FILTERS = [
  { value: 'all', label: 'All Roles' },
  { value: 'command', label: 'Command' },
  { value: 'combat', label: 'Combat' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'mining', label: 'Mining' },
  { value: 'exploration', label: 'Exploration' },
  { value: 'medical', label: 'Medical' },
  { value: 'transport', label: 'Transport' },
  { value: 'support', label: 'Support' },
];

const SIZE_FILTERS = [
  { value: 'all', label: 'All Sizes' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'capital', label: 'Capital' },
];

// ============================================================================
// Ship Row — extracted to reduce cognitive complexity of the main component
// ============================================================================

interface ShipRowProps {
  ship: AvailableShip;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

const ShipRow: React.FC<Readonly<ShipRowProps>> = ({ ship, isSelected, onToggle }) => {
  const theme = useTheme();
  const isConcept = ship.status === IN_CONCEPT;

  const rowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    px: 1.5,
    py: 1,
    borderRadius: 1,
    cursor: isConcept ? 'default' : 'pointer',
    opacity: isConcept ? 0.5 : 1,
    bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
    '&:hover': isConcept ? {} : { bgcolor: alpha(theme.palette.primary.main, 0.04) },
    borderBottom: '1px solid',
    borderColor: 'divider',
  };

  const subtitle = [
    ship.manufacturer ?? 'Unknown',
    ship.size,
    ship.ownerName ? `Owner: ${ship.ownerName}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Box onClick={isConcept ? undefined : () => onToggle(ship.id)} sx={rowSx}>
      <Checkbox checked={isSelected} disabled={isConcept} size="small" tabIndex={-1} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
          {ship.shipName}
          {ship.customName && (
            <Typography component="span" variant="body2" color="text.secondary">
              {' '}
              ({ship.customName})
            </Typography>
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {subtitle}
        </Typography>
      </Box>
      <Stack direction="row" spacing={0.5} flexShrink={0}>
        {isConcept && (
          <Chip
            label={STATUS_LABELS[ship.status] ?? ship.status}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}
        {ship.role && <Chip label={ship.role} size="small" sx={{ textTransform: 'capitalize' }} />}
        <Chip
          label={ship.source === 'org' ? 'Org' : 'Member'}
          size="small"
          color={ship.source === 'org' ? 'primary' : 'info'}
          variant="outlined"
        />
      </Stack>
    </Box>
  );
};

// ============================================================================
// Component
// ============================================================================

export const ShipPickerDialog: React.FC<Readonly<ShipPickerDialogProps>> = ({
  open,
  onClose,
  onSelect,
  excludeShipIds = [],
  title = 'Add Ships to Fleet',
  loading: externalLoading = false,
}) => {
  const user = useAuthStore(state => state.user);
  const orgId = user?.activeOrgId;

  const {
    data: ships = [],
    isLoading: loadingShips,
    error: shipsError,
  } = useAvailableShips(orgId, open);
  let error: string | null = null;
  if (shipsError instanceof Error) {
    error = shipsError.message;
  } else if (shipsError) {
    error = 'Failed to load available ships';
  }
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterSize, setFilterSize] = useState('all');
  const [filterSource, setFilterSource] = useState<'all' | 'org' | 'member'>('all');

  // Reset filters when dialog opens
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setSearchTerm('');
      setFilterRole('all');
      setFilterSize('all');
      setFilterSource('all');
    }
  }, [open]);

  const filteredShips = useMemo(() => {
    const excludeSet = new Set(excludeShipIds);
    return ships.filter(ship => {
      // Exclude by entity ID or catalog ship ID (fleet ships use catalog IDs)
      if (excludeSet.has(ship.id)) return false;
      if (ship.catalogShipId && excludeSet.has(ship.catalogShipId)) return false;
      if (filterRole !== 'all' && ship.role?.toLowerCase() !== filterRole) return false;
      if (filterSize !== 'all' && ship.size?.toLowerCase() !== filterSize) return false;
      if (filterSource !== 'all' && ship.source !== filterSource) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches =
          (ship.shipName ?? '').toLowerCase().includes(term) ||
          (ship.customName ?? '').toLowerCase().includes(term) ||
          (ship.manufacturer ?? '').toLowerCase().includes(term);
        if (!matches) return false;
      }
      return true;
    });
  }, [ships, excludeShipIds, filterRole, filterSize, filterSource, searchTerm]);

  const handleToggle = useCallback((shipId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(shipId)) {
        next.delete(shipId);
      } else {
        next.add(shipId);
      }
      return next;
    });
  }, []);

  const selectableShips = useMemo(
    () => filteredShips.filter(s => s.status !== IN_CONCEPT),
    [filteredShips]
  );

  const handleSelectAll = useCallback(() => {
    setSelected(prev => {
      if (prev.size === selectableShips.length) {
        return new Set();
      }
      return new Set(selectableShips.map(s => s.id));
    });
  }, [selectableShips]);

  const handleConfirm = useCallback(() => {
    onSelect(Array.from(selected));
    onClose();
  }, [selected, onSelect, onClose]);

  const isLoading = loadingShips || externalLoading;
  const shipPlural = selected.size === 1 ? 'Ship' : 'Ships';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth disableRestoreFocus>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Filters */}
          <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
            <TextField
              size="small"
              placeholder="Search ships..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              sx={{ minWidth: 180 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: '1.2rem', color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Role</InputLabel>
              <Select label="Role" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                {ROLE_FILTERS.map(r => (
                  <MenuItem key={r.value} value={r.value}>
                    {r.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Size</InputLabel>
              <Select label="Size" value={filterSize} onChange={e => setFilterSize(e.target.value)}>
                {SIZE_FILTERS.map(s => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Source</InputLabel>
              <Select<'all' | 'org' | 'member'>
                label="Source"
                value={filterSource}
                onChange={e => setFilterSource(e.target.value)}
              >
                <MenuItem value="all">All Sources</MenuItem>
                <MenuItem value="org">Org-Owned</MenuItem>
                <MenuItem value="member">Member Ships</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {/* Select all / count */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button size="small" onClick={handleSelectAll}>
              {selected.size === selectableShips.length && selectableShips.length > 0
                ? 'Deselect All'
                : 'Select All'}
            </Button>
            <Typography variant="body2" color="text.secondary">
              {selected.size} selected / {filteredShips.length} available
            </Typography>
          </Stack>

          <Divider />

          {/* Ship list */}
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {!isLoading && filteredShips.length === 0 && (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              No available ships found.
            </Typography>
          )}
          {!isLoading && filteredShips.length > 0 && (
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {filteredShips.map(ship => (
                <ShipRow
                  key={ship.id}
                  ship={ship}
                  isSelected={selected.has(ship.id)}
                  onToggle={handleToggle}
                />
              ))}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={selected.size === 0 || isLoading}
        >
          {selected.size === 0 ? 'Add Ships' : `Add ${selected.size} ${shipPlural}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
