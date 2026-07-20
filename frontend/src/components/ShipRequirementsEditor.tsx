/**
 * ShipRequirementsEditor — Reusable ship & crew requirements editor.
 *
 * Supports two modes:
 * 1. Specific Ship: select ships from catalogue, set quantity per ship
 * 2. Ship Role: select roles (e.g. "Light Fighter"), set quantity per role
 *
 * Auto-calculates total crew spots from selected ships/roles × quantity.
 */
import { useShipCatalogue, useShipRoles } from '@/hooks/queries/useShipCatalogueQueries';
import { type ShipCatalogueItem } from '@/services/shipCatalogueService';
import { calculateCrewRequirements, resolveShipCrew, type CrewMode } from '@/utils/crewCalculation';
import {
  AbcOutlined as AbcIcon,
  Add as AddIcon,
  CategoryOutlined as CategoryIcon,
  Close as CloseIcon,
  EditOutlined as EditIcon,
  Remove as RemoveIcon,
  SearchOutlined as SearchIcon,
} from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

// ─── Ship Grouping Helpers ───────────────────────────────────────────────────

type ShipGroupMode = 'role' | 'alpha';

type AlphaRange = 'A-E' | 'F-K' | 'L-P' | 'Q-U' | 'V-Z';

function getAlphaRange(name: string): AlphaRange {
  const first = name.charAt(0).toUpperCase();
  if (first >= 'A' && first <= 'E') return 'A-E';
  if (first >= 'F' && first <= 'K') return 'F-K';
  if (first >= 'L' && first <= 'P') return 'L-P';
  if (first >= 'Q' && first <= 'U') return 'Q-U';
  return 'V-Z';
}

function getShipGroup(ship: ShipCatalogueItem, mode: ShipGroupMode): string {
  if (mode === 'role') {
    return ship.role || 'Unknown Role';
  }
  return getAlphaRange(ship.name);
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface SpecificEntry {
  requirementType: 'specific';
  ship: ShipCatalogueItem;
  count: number;
  crewPerShip: number;
}

interface RoleEntry {
  requirementType: 'role';
  role: string;
  count: number;
  avgCrewPerShip: number;
}

export type ShipRequirementMode = 'none' | 'required' | 'preferred';

/** Output format matching the API contract */
export interface ShipRequirementOutput {
  requirementType: 'specific' | 'role';
  shipName?: string;
  shipId?: string;
  role?: string;
  count: number;
  crewPerShip?: number;
  avgCrewPerShip?: number;
}

export interface ShipRequirementsEditorProps {
  readonly shipRequirementType: ShipRequirementMode;
  readonly onShipRequirementTypeChange: (type: ShipRequirementMode) => void;
  readonly onRequirementsChange: (requirements: ShipRequirementOutput[]) => void;
  readonly onCrewTotalChange: (total: number) => void;
  readonly onMinCrewChange?: (minCrew: number) => void;
  readonly onCrewModeChange?: (mode: CrewMode) => void;
  readonly crewMode?: CrewMode;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ShipRequirementsEditor: React.FC<Readonly<ShipRequirementsEditorProps>> = ({
  shipRequirementType,
  onShipRequirementTypeChange,
  onRequirementsChange,
  onCrewTotalChange,
  onMinCrewChange,
  onCrewModeChange,
  crewMode = 'lean',
}) => {
  const theme = useTheme();

  // ── Catalogue data (React Query — cached, deduplicated) ──
  const catalogueEnabled = shipRequirementType !== 'none';
  const { data: shipsData, error: shipsError } = useShipCatalogue({ limit: 500 }, catalogueEnabled);
  const { data: rolesData, error: rolesError } = useShipRoles(catalogueEnabled);
  const shipCatalogue = shipsData?.items ?? [];
  const roleCatalogue = rolesData ?? [];
  const catalogueError =
    shipsError || rolesError ? 'Failed to load ship catalogue. Please try again.' : null;

  // ── Selection mode ──
  const [selectionMode, setSelectionMode] = useState<'specific' | 'role'>('specific');

  // ── Ship grouping mode ──
  const [shipGroupMode, setShipGroupMode] = useState<ShipGroupMode>('role');

  // ── Manual entry mode ──
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCrew, setManualCrew] = useState(1);

  // ── Entries ──
  const [specificEntries, setSpecificEntries] = useState<SpecificEntry[]>([]);
  const [roleEntries, setRoleEntries] = useState<RoleEntry[]>([]);

  // ── Autocomplete inputs ──
  const [shipSearchInput, setShipSearchInput] = useState('');
  const [roleSearchInput, setRoleSearchInput] = useState('');

  // ── Compute total crew ──
  const totalCrew = useMemo(() => {
    let crew = 0;
    for (const entry of specificEntries) {
      crew += entry.count * entry.crewPerShip;
    }
    for (const entry of roleEntries) {
      crew += entry.count * entry.avgCrewPerShip;
    }
    return crew;
  }, [specificEntries, roleEntries]);

  // ── Compute min crew from total using multiplier ──
  const crewReqs = useMemo(
    () => calculateCrewRequirements(totalCrew, crewMode),
    [totalCrew, crewMode]
  );

  // Emit min crew when it changes
  useEffect(() => {
    onMinCrewChange?.(crewReqs.minCrew);
  }, [crewReqs.minCrew, onMinCrewChange]);

  // ── Emit changes ──
  const emitChanges = useCallback(
    (specific: SpecificEntry[], roles: RoleEntry[]) => {
      const output: ShipRequirementOutput[] = [
        ...specific.map(e => ({
          requirementType: 'specific' as const,
          shipName: e.ship.name,
          shipId: e.ship.id,
          count: e.count,
          crewPerShip: e.crewPerShip,
        })),
        ...roles.map(e => ({
          requirementType: 'role' as const,
          role: e.role,
          count: e.count,
          avgCrewPerShip: e.avgCrewPerShip,
        })),
      ];
      onRequirementsChange(output);
    },
    [onRequirementsChange]
  );

  // Update parent crew total when it changes
  useEffect(() => {
    onCrewTotalChange(totalCrew);
  }, [totalCrew, onCrewTotalChange]);

  // ── Ship handlers ──
  const handleAddShip = useCallback(
    (_e: React.SyntheticEvent, ship: ShipCatalogueItem | null) => {
      if (!ship) return;
      // Prevent duplicates
      if (specificEntries.some(e => e.ship.id === ship.id)) return;

      const crewPerShip = resolveShipCrew(ship);
      const updated = [
        ...specificEntries,
        { requirementType: 'specific' as const, ship, count: 1, crewPerShip },
      ];
      setSpecificEntries(updated);
      setShipSearchInput('');
      emitChanges(updated, roleEntries);
    },
    [specificEntries, roleEntries, emitChanges]
  );

  const handleRemoveShip = useCallback(
    (shipId: string) => {
      const updated = specificEntries.filter(e => e.ship.id !== shipId);
      setSpecificEntries(updated);
      emitChanges(updated, roleEntries);
    },
    [specificEntries, roleEntries, emitChanges]
  );

  const handleShipCountChange = useCallback(
    (shipId: string, delta: number) => {
      const updated = specificEntries.map(e => {
        if (e.ship.id !== shipId) return e;
        const newCount = Math.max(1, Math.min(99, e.count + delta));
        return { ...e, count: newCount };
      });
      setSpecificEntries(updated);
      emitChanges(updated, roleEntries);
    },
    [specificEntries, roleEntries, emitChanges]
  );

  // ── Role handlers ──
  const handleAddRole = useCallback(
    (_e: React.SyntheticEvent, role: string | null) => {
      if (!role) return;
      if (roleEntries.some(e => e.role === role)) return;

      // Find average crew for ships with this role
      const shipsWithRole = shipCatalogue.filter(s => s.role?.toLowerCase() === role.toLowerCase());
      const avgCrew =
        shipsWithRole.length > 0
          ? Math.ceil(
              shipsWithRole.reduce((sum, s) => sum + resolveShipCrew(s), 0) / shipsWithRole.length
            )
          : 1;

      const updated = [
        ...roleEntries,
        { requirementType: 'role' as const, role, count: 1, avgCrewPerShip: avgCrew },
      ];
      setRoleEntries(updated);
      setRoleSearchInput('');
      emitChanges(specificEntries, updated);
    },
    [roleEntries, specificEntries, shipCatalogue, emitChanges]
  );

  const handleRemoveRole = useCallback(
    (role: string) => {
      const updated = roleEntries.filter(e => e.role !== role);
      setRoleEntries(updated);
      emitChanges(specificEntries, updated);
    },
    [roleEntries, specificEntries, emitChanges]
  );

  const handleRoleCountChange = useCallback(
    (role: string, delta: number) => {
      const updated = roleEntries.map(e => {
        if (e.role !== role) return e;
        const newCount = Math.max(1, Math.min(99, e.count + delta));
        return { ...e, count: newCount };
      });
      setRoleEntries(updated);
      emitChanges(specificEntries, updated);
    },
    [roleEntries, specificEntries, emitChanges]
  );

  // ── Filter options to exclude already-selected ──
  const availableShips = useMemo(
    () => shipCatalogue.filter(s => !specificEntries.some(e => e.ship.id === s.id)),
    [shipCatalogue, specificEntries]
  );

  const availableRoles = useMemo(
    () => roleCatalogue.filter(r => !roleEntries.some(e => e.role === r)),
    [roleCatalogue, roleEntries]
  );

  // ── Grouped ship options for Autocomplete ──
  const groupedAvailableShips = useMemo(() => {
    const sorted = [...availableShips].sort((a, b) => {
      const groupA = getShipGroup(a, shipGroupMode);
      const groupB = getShipGroup(b, shipGroupMode);
      const groupCmp = groupA.localeCompare(groupB);
      if (groupCmp !== 0) return groupCmp;
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [availableShips, shipGroupMode]);

  // ── Manual entry autofill: match typed name against catalogue ──
  const manualMatch = useMemo(() => {
    if (!manualName.trim()) return null;
    const lower = manualName.trim().toLowerCase();
    return (
      shipCatalogue.find(s => s.name.toLowerCase() === lower) ??
      shipCatalogue.find(s => `${s.manufacturer ?? ''} ${s.name}`.toLowerCase() === lower) ??
      null
    );
  }, [manualName, shipCatalogue]);

  // Autofill crew when a manual match is found
  useEffect(() => {
    if (manualMatch) {
      setManualCrew(resolveShipCrew(manualMatch));
    }
  }, [manualMatch]);

  // ── Manual entry submit ──
  const handleManualAdd = useCallback(() => {
    const trimmed = manualName.trim();
    if (!trimmed) return;

    if (manualMatch) {
      // We found a catalogue match — use it as a specific entry
      if (specificEntries.some(e => e.ship.id === manualMatch.id)) return;
      const crewPerShip = resolveShipCrew(manualMatch);
      const updated = [
        ...specificEntries,
        { requirementType: 'specific' as const, ship: manualMatch, count: 1, crewPerShip },
      ];
      setSpecificEntries(updated);
      emitChanges(updated, roleEntries);
    } else {
      // No match — create a manual catalogue-like entry
      const manualShip: ShipCatalogueItem = {
        id: `manual-${Date.now()}`,
        name: trimmed,
        manufacturer: '',
        crew: manualCrew,
      };
      if (specificEntries.some(e => e.ship.name.toLowerCase() === trimmed.toLowerCase())) return;
      const updated = [
        ...specificEntries,
        {
          requirementType: 'specific' as const,
          ship: manualShip,
          count: 1,
          crewPerShip: manualCrew,
        },
      ];
      setSpecificEntries(updated);
      emitChanges(updated, roleEntries);
    }

    setManualName('');
    setManualCrew(1);
    setShowManualEntry(false);
  }, [manualName, manualMatch, manualCrew, specificEntries, roleEntries, emitChanges]);

  // ── Catalogue names for manual entry autocomplete suggestions ──
  const catalogueNames = useMemo(
    () => shipCatalogue.map(s => (s.manufacturer ? `${s.manufacturer} ${s.name}` : s.name)),
    [shipCatalogue]
  );

  const hasEntries = specificEntries.length > 0 || roleEntries.length > 0;

  if (shipRequirementType === 'none') {
    return (
      <Box sx={{ pt: 1 }}>
        <Typography variant="subtitle2" sx={{ color: theme.palette.info.light, mb: 1 }}>
          Ship & Crew Requirements
        </Typography>
        <FormControl size="small" fullWidth sx={{ mb: 2 }}>
          <InputLabel>Ship Requirement</InputLabel>
          <Select
            value={shipRequirementType}
            label="Ship Requirement"
            onChange={e => onShipRequirementTypeChange(e.target.value as ShipRequirementMode)}
          >
            <MenuItem value="none">No ship requirement</MenuItem>
            <MenuItem value="preferred">Ships preferred</MenuItem>
            <MenuItem value="required">Ships required</MenuItem>
          </Select>
          <FormHelperText sx={{ color: theme.palette.text.secondary }}>
            Do participants need to bring a ship?
          </FormHelperText>
        </FormControl>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 1 }}>
      <Typography variant="subtitle2" sx={{ color: theme.palette.info.light, mb: 1 }}>
        Ship & Crew Requirements
      </Typography>

      {/* Requirement type selector */}
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Ship Requirement</InputLabel>
        <Select
          value={shipRequirementType}
          label="Ship Requirement"
          onChange={e => onShipRequirementTypeChange(e.target.value as ShipRequirementMode)}
        >
          <MenuItem value="none">No ship requirement</MenuItem>
          <MenuItem value="preferred">Ships preferred</MenuItem>
          <MenuItem value="required">Ships required</MenuItem>
        </Select>
        <FormHelperText sx={{ color: theme.palette.text.secondary }}>
          Do participants need to bring a ship?
        </FormHelperText>
      </FormControl>

      {catalogueError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {catalogueError}
        </Alert>
      )}

      {/* Selection mode toggle */}
      <RadioGroup
        row
        value={selectionMode}
        onChange={e => setSelectionMode(e.target.value as 'specific' | 'role')}
        sx={{ mb: 2 }}
      >
        <FormControlLabel
          value="specific"
          control={<Radio size="small" />}
          label="By Ship"
          sx={{ color: theme.palette.text.primary }}
        />
        <FormControlLabel
          value="role"
          control={<Radio size="small" />}
          label="By Role"
          sx={{ color: theme.palette.text.primary }}
        />
      </RadioGroup>

      {/* Ship search with grouping */}
      {selectionMode === 'specific' && !showManualEntry && (
        <Box>
          {/* Group mode toggle */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <ToggleButtonGroup
              value={shipGroupMode}
              exclusive
              onChange={(_e, val) => val && setShipGroupMode(val as ShipGroupMode)}
              size="small"
              sx={{ flexShrink: 0 }}
            >
              <ToggleButton value="role" aria-label="Group by role">
                <CategoryIcon fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="caption">By Role</Typography>
              </ToggleButton>
              <ToggleButton value="alpha" aria-label="Group alphabetically">
                <AbcIcon fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="caption">A-Z</Typography>
              </ToggleButton>
            </ToggleButtonGroup>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon fontSize="small" />}
              onClick={() => setShowManualEntry(true)}
              sx={{ ml: 'auto', textTransform: 'none' }}
            >
              Enter Manually
            </Button>
          </Stack>

          {/* Grouped Autocomplete */}
          <Autocomplete
            options={groupedAvailableShips}
            groupBy={ship => getShipGroup(ship, shipGroupMode)}
            getOptionLabel={ship =>
              `${ship.manufacturer ? ship.manufacturer + ' ' : ''}${ship.name}`
            }
            value={null}
            onChange={handleAddShip}
            inputValue={shipSearchInput}
            onInputChange={(_e, val) => setShipSearchInput(val)}
            renderOption={(props, ship) => (
              <li {...props} key={ship.id}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Typography variant="body2">
                    {ship.manufacturer} {ship.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary, ml: 1 }}>
                    Crew: {resolveShipCrew(ship)}
                    {ship.role ? ` · ${ship.role}` : ''}
                  </Typography>
                </Box>
              </li>
            )}
            renderGroup={params => (
              <li key={params.key}>
                <Box
                  sx={{
                    position: 'sticky',
                    top: -8,
                    px: 1.5,
                    py: 0.5,
                    bgcolor: theme.palette.background.paper,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    zIndex: 1,
                  }}
                >
                  <Chip
                    label={params.group}
                    size="small"
                    color={shipGroupMode === 'role' ? 'primary' : 'default'}
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
                <Box component="ul" sx={{ p: 0 }}>
                  {params.children}
                </Box>
              </li>
            )}
            renderInput={params => (
              <TextField
                {...params}
                label="Search ships…"
                placeholder="Type to search or scroll grouped list"
                size="small"
                slotProps={{
                  input: {
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <SearchIcon
                          fontSize="small"
                          sx={{ color: theme.palette.text.secondary, mr: 0.5 }}
                        />
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
            sx={{ mb: 1 }}
            clearOnBlur
            blurOnSelect
            slotProps={{ listbox: { sx: { maxHeight: 320 } } }}
          />
        </Box>
      )}

      {/* Manual entry form */}
      {selectionMode === 'specific' && showManualEntry && (
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.action.hover,
            mb: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: theme.palette.text.secondary, mb: 1, display: 'block' }}
          >
            Enter a ship name — it will autofill details if it matches the catalogue.
          </Typography>
          <Autocomplete
            freeSolo
            options={catalogueNames}
            inputValue={manualName}
            onInputChange={(_e, val) => setManualName(val)}
            onChange={(_e, val) => {
              if (typeof val === 'string') setManualName(val);
            }}
            renderInput={params => (
              <TextField
                {...params}
                label="Ship Name"
                placeholder="e.g. Carrack, Hammerhead…"
                size="small"
                fullWidth
              />
            )}
            size="small"
            sx={{ mb: 1 }}
          />

          {manualMatch && (
            <Box sx={{ mb: 1 }}>
              <Chip
                label={`✓ Matched: ${manualMatch.manufacturer} ${manualMatch.name}`}
                size="small"
                color="success"
                variant="outlined"
                sx={{ mr: 0.5 }}
              />
              {manualMatch.role && (
                <Chip label={manualMatch.role} size="small" variant="outlined" sx={{ mr: 0.5 }} />
              )}
              <Chip
                label={`Crew: ${resolveShipCrew(manualMatch)}`}
                size="small"
                variant="outlined"
              />
            </Box>
          )}

          {!manualMatch && manualName.trim() && (
            <TextField
              label="Crew per ship"
              type="number"
              value={manualCrew}
              onChange={e => setManualCrew(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              size="small"
              sx={{ mb: 1, width: 140 }}
              slotProps={{ htmlInput: { min: 1, max: 99 } }}
            />
          )}

          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              onClick={handleManualAdd}
              disabled={!manualName.trim()}
              startIcon={<AddIcon />}
            >
              Add Ship
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={() => {
                setShowManualEntry(false);
                setManualName('');
                setManualCrew(1);
              }}
            >
              Cancel
            </Button>
          </Stack>
        </Box>
      )}

      {/* Role search */}
      {selectionMode === 'role' && (
        <Autocomplete
          options={availableRoles}
          value={null}
          onChange={handleAddRole}
          inputValue={roleSearchInput}
          onInputChange={(_e, val) => setRoleSearchInput(val)}
          renderInput={params => (
            <TextField
              {...params}
              label="Search roles…"
              placeholder="e.g. Light Fighter, Medium Mining"
              size="small"
            />
          )}
          sx={{ mb: 1 }}
          clearOnBlur
          blurOnSelect
        />
      )}

      {/* Selected ships list */}
      {specificEntries.length > 0 && (
        <Stack spacing={1} sx={{ mb: 1 }}>
          {specificEntries.map(entry => (
            <Box
              key={entry.ship.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1,
                borderRadius: 1,
                bgcolor: theme.palette.action.hover,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {entry.ship.manufacturer} {entry.ship.name}
                </Typography>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                  Crew: {entry.crewPerShip} per ship → {entry.count * entry.crewPerShip} total
                </Typography>
              </Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ ml: 1 }}>
                <IconButton
                  size="small"
                  onClick={() => handleShipCountChange(entry.ship.id, -1)}
                  disabled={entry.count <= 1}
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <Typography
                  variant="body2"
                  sx={{ minWidth: 24, textAlign: 'center', fontWeight: 'bold' }}
                >
                  {entry.count}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => handleShipCountChange(entry.ship.id, 1)}
                  disabled={entry.count >= 99}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleRemoveShip(entry.ship.id)}
                  aria-label={`Remove ${entry.ship.name}`}
                  sx={{
                    ml: 0.5,
                    color: theme.palette.error.light,
                    '&:hover': { color: theme.palette.error.main },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {/* Selected roles list */}
      {roleEntries.length > 0 && (
        <Stack spacing={1} sx={{ mb: 1 }}>
          {roleEntries.map(entry => (
            <Box
              key={entry.role}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1,
                borderRadius: 1,
                bgcolor: theme.palette.action.hover,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {entry.role}
                </Typography>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                  Avg crew: {entry.avgCrewPerShip} per ship → {entry.count * entry.avgCrewPerShip}{' '}
                  total
                </Typography>
              </Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ ml: 1 }}>
                <IconButton
                  size="small"
                  onClick={() => handleRoleCountChange(entry.role, -1)}
                  disabled={entry.count <= 1}
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <Typography
                  variant="body2"
                  sx={{ minWidth: 24, textAlign: 'center', fontWeight: 'bold' }}
                >
                  {entry.count}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => handleRoleCountChange(entry.role, 1)}
                  disabled={entry.count >= 99}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleRemoveRole(entry.role)}
                  aria-label={`Remove ${entry.role}`}
                  sx={{
                    ml: 0.5,
                    color: theme.palette.error.light,
                    '&:hover': { color: theme.palette.error.main },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {/* Total crew summary with min/max crew mode */}
      {hasEntries && (
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1,
            bgcolor: `${theme.palette.info.main}14`,
            border: `1px solid ${theme.palette.info.dark}`,
            mt: 1,
          }}
        >
          <Typography variant="body2" sx={{ color: theme.palette.info.light, mb: 0.5 }}>
            Max Crew:{' '}
            <Typography component="span" variant="body2" fontWeight="bold">
              {totalCrew}
            </Typography>
            {' — '}
            {specificEntries.reduce((s, e) => s + e.count, 0) +
              roleEntries.reduce((s, e) => s + e.count, 0)}{' '}
            ship(s)
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.info.light }}>
            Min Crew ({crewMode === 'lean' ? '40%' : '50%'}):{' '}
            <Typography component="span" variant="body2" fontWeight="bold">
              {crewReqs.minCrew}
            </Typography>
          </Typography>
          {onCrewModeChange && (
            <FormControl size="small" sx={{ mt: 1, minWidth: 180 }}>
              <Select
                value={crewMode}
                onChange={e => onCrewModeChange(e.target.value as CrewMode)}
                size="small"
              >
                <MenuItem value="lean">Lean crew (40%)</MenuItem>
                <MenuItem value="conservative">Conservative crew (50%)</MenuItem>
              </Select>
              <FormHelperText sx={{ color: theme.palette.text.secondary }}>
                {crewMode === 'lean'
                  ? 'Pilot + critical specialists only'
                  : 'Most roles filled for best performance'}
              </FormHelperText>
            </FormControl>
          )}
        </Box>
      )}
    </Box>
  );
};
