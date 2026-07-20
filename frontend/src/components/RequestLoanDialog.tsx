/**
 * Request Ship Loan Dialog
 * Allows users to request loans for ships shared with their organization,
 * alliance, or directly with them.
 */

import { extractArrayFromEnvelope } from '@/services/baseService';
import { shipLoanService } from '@/services/shipLoanService';
import { type AvailableShipDto, userShipService } from '@/services/userShipService';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { CreateShipLoanRequest } from '@sc-fleet-manager/shared-types';
import React, { useCallback, useEffect, useState } from 'react';

/** Shape of a loanable ship option */
interface LoanableShip {
  id: string;
  shipName: string;
  customName?: string;
  ownerName?: string;
  ownerId?: string;
  sharingLevel: string;
  condition?: string;
  location?: string;
}

interface RequestLoanDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedShipId?: string;
}

export const RequestLoanDialog: React.FC<RequestLoanDialogProps> = ({
  open,
  onClose,
  onSuccess,
  preselectedShipId,
}) => {
  const user = useAuthStore(state => state.user);

  // Available ships state
  const [availableShips, setAvailableShips] = useState<LoanableShip[]>([]);
  const [shipsLoading, setShipsLoading] = useState(false);
  const [selectedShip, setSelectedShip] = useState<LoanableShip | null>(null);

  // Form state
  const [startDate, setStartDate] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [insuranceRequired, setInsuranceRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const sharingLabel = (level: string) => {
    switch (level) {
      case 'organization':
        return 'Org';
      case 'alliance':
        return 'Alliance';
      case 'shared_users':
        return 'Shared';
      case 'public':
        return 'Public';
      default:
        return level;
    }
  };

  const sharingColor = (level: string): 'primary' | 'secondary' | 'info' | 'default' => {
    switch (level) {
      case 'organization':
        return 'primary';
      case 'alliance':
        return 'secondary';
      case 'shared_users':
        return 'info';
      default:
        return 'default';
    }
  };

  // Load available ships when dialog opens
  const loadAvailableShips = useCallback(async () => {
    if (!user?.activeOrgId) return;
    setShipsLoading(true);
    try {
      const result = await userShipService.getOrgAvailableShips(user.activeOrgId);
      const rawShips = extractArrayFromEnvelope<AvailableShipDto>(result);
      const ships: LoanableShip[] = rawShips
        .filter(
          s =>
            s.userId !== user.id && // Exclude own ships
            ['organization', 'alliance', 'shared_users', 'public'].includes(s.sharingLevel ?? '')
        )
        .map(s => ({
          id: s.id,
          shipName: s.shipName ?? s.name ?? 'Unknown Ship',
          customName: s.customName || undefined,
          ownerName: s.ownerUsername ?? s.ownerName ?? 'Unknown',
          ownerId: s.userId ?? '',
          sharingLevel: s.sharingLevel ?? 'organization',
          condition: s.condition || undefined,
          location: s.location || undefined,
        }));
      setAvailableShips(ships);

      // Auto-select preselected ship
      if (preselectedShipId) {
        const match = ships.find(s => s.id === preselectedShipId);
        if (match) setSelectedShip(match);
      }
    } catch (err) {
      logger.error(
        'Failed to load available ships',
        err instanceof Error ? err : new Error(String(err))
      );
      setAvailableShips([]);
    } finally {
      setShipsLoading(false);
    }
  }, [user?.activeOrgId, user?.id, preselectedShipId]);

  useEffect(() => {
    if (open) {
      loadAvailableShips();
    }
  }, [open, loadAvailableShips]);

  const resetForm = () => {
    setSelectedShip(null);
    setStartDate('');
    setExpectedReturnDate('');
    setTerms('');
    setNotes('');
    setInsuranceRequired(false);
    setError('');
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError('');

      if (!selectedShip || !user?.id || !startDate || !expectedReturnDate) {
        setError('Please select a ship and fill in the required dates');
        return;
      }

      const payload: CreateShipLoanRequest = {
        shipId: selectedShip.id,
        borrowerId: user.id,
        startDate,
        expectedReturnDate,
        terms: terms || undefined,
        notes: notes || undefined,
        insuranceRequired,
      };

      await shipLoanService.create(payload);
      onSuccess?.();
      onClose();
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create loan request';
      setError(message);
      logger.error(
        'Failed to create loan request',
        err instanceof Error ? err : new Error(String(err))
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
        resetForm();
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Request Ship Loan</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {/* Ship Selector */}
          <Autocomplete
            options={availableShips}
            value={selectedShip}
            onChange={(_, val) => {
              setSelectedShip(val);
              setError('');
            }}
            loading={shipsLoading}
            getOptionLabel={option =>
              option.customName ? `${option.customName} (${option.shipName})` : option.shipName
            }
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
            groupBy={option => sharingLabel(option.sharingLevel)}
            renderOption={(props, option) => {
              const { key, ...rest } = props;
              return (
                <Box component="li" key={key} {...rest}>
                  <Stack direction="column" sx={{ width: '100%' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {option.customName || option.shipName}
                      </Typography>
                      {option.customName && (
                        <Typography variant="caption" color="text.secondary">
                          ({option.shipName})
                        </Typography>
                      )}
                      <Chip
                        label={sharingLabel(option.sharingLevel)}
                        size="small"
                        color={sharingColor(option.sharingLevel)}
                        sx={{ height: 18, fontSize: '0.65rem' }}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Owner: {option.ownerName}
                      {option.location ? ` · ${option.location}` : ''}
                      {option.condition ? ` · ${option.condition}` : ''}
                    </Typography>
                  </Stack>
                </Box>
              );
            }}
            renderInput={params => (
              <TextField
                {...params}
                label="Ship to Borrow"
                required
                helperText={
                  availableShips.length === 0 && !shipsLoading
                    ? 'No ships available for loan in your organization'
                    : 'Ships shared with your org, alliance, or directly with you'
                }
                slotProps={{
                  input: {
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {shipsLoading ? <CircularProgress size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
            noOptionsText={shipsLoading ? 'Loading ships...' : 'No ships available'}
          />

          {/* Borrower (auto-filled) */}
          <TextField
            label="Borrower"
            value={user?.username || user?.email || ''}
            fullWidth
            disabled
            helperText="You are requesting this loan for yourself"
          />

          <TextField
            label="Start Date"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            required
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Expected Return Date"
            type="date"
            value={expectedReturnDate}
            onChange={e => setExpectedReturnDate(e.target.value)}
            required
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Terms"
            value={terms}
            onChange={e => setTerms(e.target.value)}
            multiline
            rows={2}
            fullWidth
            helperText="Optional loan terms and conditions"
          />
          <TextField
            label="Notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            multiline
            rows={2}
            fullWidth
            helperText="Optional additional notes"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={insuranceRequired}
                onChange={e => setInsuranceRequired(e.target.checked)}
              />
            }
            label="Insurance Required"
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            onClose();
            resetForm();
          }}
        >
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting || !selectedShip}>
          {submitting ? 'Submitting...' : 'Request Loan'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
