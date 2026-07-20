/**
 * EditShipSlotsDialog
 *
 * Generic editor for a ship's role-based slots — used for both typed crew slots
 * (seats per crew position) and passenger slots (e.g. marines). The organizer
 * adds/removes rows and sets a capacity per role, then saves.
 *
 * A slot's capacity cannot be set below the number already filled (the backend
 * enforces this too); `lockedMinimums` lets the caller surface that in the UI.
 */

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface SlotRow {
  role: string;
  capacity: number;
}

interface EditShipSlotsDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (slots: SlotRow[]) => void;
  isSaving: boolean;
  /** Dialog title, e.g. "Edit Crew Slots" or "Edit Passenger Slots". */
  title: string;
  /** Selectable roles as `{ value, label }`. */
  roleOptions: ReadonlyArray<{ value: string; label: string }>;
  /** Current slots for the ship. */
  initialSlots: SlotRow[];
  /** Per-role minimum capacity (already-filled count) the user cannot go below. */
  lockedMinimums?: Record<string, number>;
  shipName?: string;
}

// ============================================================================
// Component
// ============================================================================

export const EditShipSlotsDialog: React.FC<Readonly<EditShipSlotsDialogProps>> = ({
  open,
  onClose,
  onSave,
  isSaving,
  title,
  roleOptions,
  initialSlots,
  lockedMinimums = {},
  shipName,
}) => {
  const [rows, setRows] = useState<SlotRow[]>(initialSlots);

  // Re-seed when the dialog (re)opens for a different ship/slot set.
  React.useEffect(() => {
    if (open) {
      setRows(initialSlots);
    }
  }, [open, initialSlots]);

  const usedRoles = useMemo(() => new Set(rows.map(r => r.role)), [rows]);

  const firstUnusedRole = useMemo(
    () => roleOptions.find(o => !usedRoles.has(o.value))?.value,
    [roleOptions, usedRoles]
  );

  const handleAddRow = useCallback(() => {
    if (!firstUnusedRole) return;
    setRows(prev => [...prev, { role: firstUnusedRole, capacity: 1 }]);
  }, [firstUnusedRole]);

  const handleRemoveRow = useCallback((index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleRoleChange = useCallback((index: number, role: string) => {
    setRows(prev => prev.map((row, i) => (i === index ? { ...row, role } : row)));
  }, []);

  const handleCapacityChange = useCallback((index: number, raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const capacity = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setRows(prev => prev.map((row, i) => (i === index ? { ...row, capacity } : row)));
  }, []);

  // Validation: no duplicate roles, and every row respects its locked minimum.
  const duplicateRole = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.role)) return row.role;
      seen.add(row.role);
    }
    return null;
  }, [rows]);

  const belowMinimum = useMemo(
    () => rows.find(row => row.capacity < (lockedMinimums[row.role] ?? 0)) ?? null,
    [rows, lockedMinimums]
  );

  const isValid = !duplicateRole && !belowMinimum;

  const handleClose = useCallback(() => {
    setRows(initialSlots);
    onClose();
  }, [initialSlots, onClose]);

  const handleSave = useCallback(() => {
    if (!isValid) return;
    onSave(rows.filter(r => r.capacity > 0 || (lockedMinimums[r.role] ?? 0) > 0));
  }, [isValid, onSave, rows, lockedMinimums]);

  const labelFor = useCallback(
    (value: string) => roleOptions.find(o => o.value === value)?.label ?? value,
    [roleOptions]
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Typography variant="h6" component="span">
          {title}
        </Typography>
        {shipName && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {shipName}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={1.5}>
          {rows.length === 0 && (
            <Alert severity="info">No slots defined. Add a role to get started.</Alert>
          )}

          {rows.map((row, index) => {
            const min = lockedMinimums[row.role] ?? 0;
            return (
              <Stack key={`${row.role}-${index}`} direction="row" spacing={1} alignItems="center">
                <TextField
                  select
                  size="small"
                  label="Role"
                  value={row.role}
                  onChange={e => handleRoleChange(index, e.target.value)}
                  sx={{ flex: 1 }}
                >
                  {roleOptions.map(option => (
                    <MenuItem
                      key={option.value}
                      value={option.value}
                      disabled={option.value !== row.role && usedRoles.has(option.value)}
                    >
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  type="number"
                  label="Seats"
                  value={row.capacity}
                  onChange={e => handleCapacityChange(index, e.target.value)}
                  error={row.capacity < min}
                  helperText={min > 0 ? `${min} filled` : undefined}
                  slotProps={{ htmlInput: { min, max: 100 } }}
                  sx={{ width: 96 }}
                />
                <IconButton
                  aria-label={`Remove ${labelFor(row.role)} slot`}
                  size="small"
                  onClick={() => handleRemoveRow(index)}
                  disabled={min > 0}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            );
          })}

          <Button
            startIcon={<AddIcon />}
            onClick={handleAddRow}
            disabled={!firstUnusedRole}
            size="small"
            sx={{ alignSelf: 'flex-start' }}
          >
            Add Role
          </Button>

          {duplicateRole && (
            <Alert severity="error">Duplicate role: {labelFor(duplicateRole)}</Alert>
          )}
          {belowMinimum && (
            <Alert severity="error">
              {labelFor(belowMinimum.role)} can&apos;t be below {lockedMinimums[belowMinimum.role]}{' '}
              (already filled).
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving || !isValid}
          startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
        >
          {isSaving ? 'Saving…' : 'Save Slots'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
