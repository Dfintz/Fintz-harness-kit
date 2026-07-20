import { ShipCatalogueItem, shipCatalogueService } from '@/services/shipCatalogueService';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { Well } from './ui';

interface AddShipDialogProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  onAddShip: (shipData: Record<string, unknown>) => Promise<void>;
  onImportShips: (ships: Record<string, unknown>[]) => Promise<void>;
}

interface FleetBoxShip {
  name: string;
  shipname?: string;
  type?: string;
  manufacturer?: string;
  notes?: string;
  tags?: string[];
}

export const AddShipDialog: React.FC<AddShipDialogProps> = ({
  isOpen,
  open,
  onClose,
  onAddShip,
  onImportShips,
}) => {
  const theme = useTheme();
  const dialogOpen = isOpen ?? open ?? false;
  // Ship catalogue state
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [ships, setShips] = useState<ShipCatalogueItem[]>([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShip, setSelectedShip] = useState<ShipCatalogueItem | null>(null);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);

  // Manual entry form state
  const [shipName, setShipName] = useState('');
  const [customName, setCustomName] = useState('');
  const [status, setStatus] = useState<string>('owned');
  const [condition, setCondition] = useState<string>('good');
  const [location, setLocation] = useState('');
  const [insuranceLevel, setInsuranceLevel] = useState('');
  const [sharingLevel, setSharingLevel] = useState<string>('personal');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  // Import state
  const [_importFile, setImportFile] = useState<File | null>(null);
  const [importPreBox, setImportPreBox] = useState<FleetBoxShip[]>([]);
  const [importError, setImportError] = useState<string>('');

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedTab, setSelectedTab] = useState('manual');
  const notification = useNotification();

  // Track latest in-flight ship request to discard stale responses that would
  // otherwise overwrite freshly filtered results (race condition when filter
  // changes faster than the network round-trip).
  const shipRequestIdRef = useRef(0);

  // Load manufacturers once when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      loadManufacturers();
    }
  }, [dialogOpen]);

  // Load ships when dialog opens or filters change. Debounce the search query
  // so each keystroke does not trigger a new request.
  useEffect(() => {
    if (!dialogOpen) return;
    const timer = setTimeout(() => {
      loadShips();
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, selectedManufacturer, searchQuery]);

  const loadManufacturers = async () => {
    try {
      const manufacturerList = await shipCatalogueService.getManufacturers();
      setManufacturers(manufacturerList.sort((a, b) => a.localeCompare(b)));
    } catch (error) {
      logger.error(
        'Failed to load manufacturers:',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  };

  const loadShips = async () => {
    const requestId = ++shipRequestIdRef.current;
    setLoadingCatalogue(true);
    try {
      const response = await shipCatalogueService.getShips({
        manufacturer: selectedManufacturer || undefined,
        search: searchQuery || undefined,
        limit: 500,
      });
      // Discard stale responses — only the latest request may update state.
      if (requestId !== shipRequestIdRef.current) return;
      setShips(response?.items ?? []);
    } catch (error) {
      if (requestId !== shipRequestIdRef.current) return;
      logger.error(
        'Failed to load ships:',
        error instanceof Error ? error : new Error(String(error))
      );
      setShips([]);
    } finally {
      if (requestId === shipRequestIdRef.current) {
        setLoadingCatalogue(false);
      }
    }
  };

  const handleShipSelect = (ship: ShipCatalogueItem) => {
    setSelectedShip(ship);
    setShipName(ship.name);
  };

  const handleManualSubmit = async () => {
    if (!shipName.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddShip({
        ...(selectedShip?.id ? { shipId: selectedShip.id } : {}),
        shipName: shipName.trim(),
        ...(selectedShip?.manufacturer ? { manufacturer: selectedShip.manufacturer } : {}),
        customName: customName.trim() || undefined,
        status,
        condition,
        location: location.trim() || undefined,
        insuranceLevel: insuranceLevel.trim() || undefined,
        sharingLevel,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      // Reset form
      setShipName('');
      setCustomName('');
      setStatus('owned');
      setCondition('good');
      setLocation('');
      setInsuranceLevel('');
      setSharingLevel('personal');
      setDescription('');
      setNotes('');

      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to add ship';
      notification.error(message);
      logger.error(
        'Failed to add ship:',
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError('');
    setImportPreBox([]);

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Accept both raw array format and wrapped { ships: [...] } format (FleetView)
        let items: unknown[];
        if (Array.isArray(data)) {
          items = data;
        } else if (data && typeof data === 'object' && Array.isArray(data.ships)) {
          items = data.ships;
        } else {
          setImportError(
            'Invalid format: JSON must be an array of ships or an object with a "ships" array'
          );
          return;
        }

        // Filter for valid ship entries (require name, optionally filter by type)
        const ships = items.filter((item: unknown) => {
          if (!item || typeof item !== 'object') return false;
          const obj = item as Record<string, unknown>;
          if (!obj.name || typeof obj.name !== 'string') return false;
          // If type is present, only accept "ship" (skip vehicles, etc.)
          if (obj.type && obj.type !== 'ship') return false;
          return true;
        }) as FleetBoxShip[];

        if (ships.length === 0) {
          setImportError('No valid ships found in file. Each entry must have a "name" field.');
          return;
        }

        setImportPreBox(ships);
      } catch (error: unknown) {
        setImportError(
          `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (importPreBox.length === 0) {
      return;
    }

    setIsImporting(true);
    try {
      // Convert fleetBox/fleetView format to our ship format
      const shipsToImport = importPreBox.map(ship => ({
        shipName: ship.name,
        customName: ship.shipname || undefined,
        manufacturer: ship.manufacturer || undefined,
        notes: ship.notes || undefined,
        tags: ship.tags?.length ? ship.tags : undefined,
        status: 'owned',
        condition: 'good',
        sharingLevel: 'personal',
      }));

      await onImportShips(shipsToImport);

      // Reset import state
      setImportFile(null);
      setImportPreBox([]);
      setImportError('');

      onClose();
    } catch (error: unknown) {
      setImportError(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    // Reset all state
    setSelectedShip(null);
    setSelectedManufacturer('');
    setSearchQuery('');
    setShipName('');
    setCustomName('');
    setStatus('owned');
    setCondition('good');
    setLocation('');
    setInsuranceLevel('');
    setSharingLevel('personal');
    setDescription('');
    setNotes('');
    setImportFile(null);
    setImportPreBox([]);
    setImportError('');
    onClose();
  };

  return (
    <Dialog open={dialogOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Add Ships to Hangar</DialogTitle>
      <Divider />
      <DialogContent sx={{ maxHeight: '60vh', overflow: 'auto' }}>
        <Tabs value={selectedTab} onChange={(_e, newValue) => setSelectedTab(newValue)}>
          <Tab label="Add Manually" value="manual" icon={<AddIcon />} iconPosition="start" />
          <Tab
            label="Import from JSON"
            value="import"
            icon={<UploadFileIcon />}
            iconPosition="start"
          />
        </Tabs>

        <Box sx={{ mt: 2 }}>
          {/* Manual Tab */}
          {selectedTab === 'manual' && (
            <Stack direction="column" spacing={2}>
              {/* Filters */}
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel>Manufacturer</InputLabel>
                  <Select
                    value={selectedManufacturer}
                    onChange={e => setSelectedManufacturer(e.target.value)}
                    label="Manufacturer"
                  >
                    <MenuItem value="">All Manufacturers</MenuItem>
                    {manufacturers.map(mfr => (
                      <MenuItem key={mfr} value={mfr}>
                        {mfr}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Search Ships"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  sx={{ minWidth: 200 }}
                  helperText="Search by ship name"
                />
              </Stack>

              {/* Ship List */}
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  minHeight: 300,
                  maxHeight: 400,
                  overflow: 'auto',
                }}
              >
                {loadingCatalogue ? (
                  <Stack justifyContent="center" alignItems="center" height={300}>
                    <LoadingSpinner message="Loading ships..." />
                  </Stack>
                ) : ships.length === 0 ? (
                  <Stack justifyContent="center" alignItems="center" height={300} spacing={1}>
                    <Typography>No ships found</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Try adjusting your filters
                    </Typography>
                  </Stack>
                ) : (
                  <List>
                    {ships.map(ship => (
                      <ListItem key={ship.id} disablePadding>
                        <ListItemButton onClick={() => handleShipSelect(ship)}>
                          <ListItemText
                            primary={<strong>{ship.name}</strong>}
                            secondary={`${ship.manufacturer}${ship.size ? ` • ${ship.size}` : ''}${ship.role ? ` • ${ship.role}` : ''}`}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>

              {/* Selected Ship Details Form */}
              {selectedShip && (
                <Stack direction="column" spacing={2}>
                  <Well>
                    <Typography variant="subtitle1">
                      {selectedShip.name} - {selectedShip.manufacturer}
                    </Typography>
                    {selectedShip.size && <Typography>Size: {selectedShip.size}</Typography>}
                  </Well>

                  <TextField
                    label="Custom Name"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    helperText="Give your ship a personal name (optional)"
                    fullWidth
                  />

                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <FormControl sx={{ minWidth: 200 }}>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={status}
                        onChange={e => setStatus(e.target.value)}
                        label="Status"
                      >
                        <MenuItem value="owned">Owned</MenuItem>
                        <MenuItem value="pledged">Pledged</MenuItem>
                        <MenuItem value="loaned">Loaned</MenuItem>
                        <MenuItem value="gifted">Gifted</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl sx={{ minWidth: 200 }}>
                      <InputLabel>Condition</InputLabel>
                      <Select
                        value={condition}
                        onChange={e => setCondition(e.target.value)}
                        label="Condition"
                      >
                        <MenuItem value="pristine">Pristine</MenuItem>
                        <MenuItem value="excellent">Excellent</MenuItem>
                        <MenuItem value="good">Good</MenuItem>
                        <MenuItem value="fair">Fair</MenuItem>
                        <MenuItem value="poor">Poor</MenuItem>
                        <MenuItem value="damaged">Damaged</MenuItem>
                        <MenuItem value="critical">Critical</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>

                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <TextField
                      label="Location"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      helperText="e.g., Area 18, Port Olisar"
                      sx={{ minWidth: 200 }}
                    />

                    <TextField
                      label="Insurance Level"
                      value={insuranceLevel}
                      onChange={e => setInsuranceLevel(e.target.value)}
                      helperText="e.g., LTI, 6 months, 12 months"
                      sx={{ minWidth: 200 }}
                    />
                  </Stack>

                  <FormControl fullWidth>
                    <InputLabel>Sharing Level</InputLabel>
                    <Select
                      value={sharingLevel}
                      onChange={e => setSharingLevel(e.target.value)}
                      label="Sharing Level"
                    >
                      <MenuItem value="personal">Personal (Not Shared)</MenuItem>
                      <MenuItem value="shared_users">Shared with Specific Users</MenuItem>
                      <MenuItem value="organization">Shared with Organization</MenuItem>
                      <MenuItem value="alliance">Shared with Alliance</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    label="Description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    multiline
                    rows={3}
                    placeholder="Add a description for this ship..."
                    slotProps={{ htmlInput: { maxLength: 2000 } }}
                    helperText={`${description.length}/2000`}
                    fullWidth
                  />

                  <TextField
                    label="Notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    multiline
                    rows={4}
                    helperText="Additional internal notes about this ship"
                    fullWidth
                  />
                </Stack>
              )}
            </Stack>
          )}

          {/* Import Tab */}
          {selectedTab === 'import' && (
            <Stack direction="column" spacing={3}>
              <Well>
                <Typography variant="subtitle1">Import from FleetBox / FleetView JSON</Typography>
                <Typography>
                  Upload a JSON file exported from FleetBox, FleetView (hangar.link), or in similar
                  format. Supported formats:
                </Typography>
                <Box
                  sx={{
                    bgcolor: 'common.black',
                    color: 'common.white',
                    p: 2,
                    borderRadius: 1,
                    mt: 1,
                  }}
                >
                  <Typography component="pre" sx={{ m: 0, fontSize: '0.85rem', color: 'inherit' }}>
                    {`[
  {
    "name": "Cutlass Black",
    "shipname": "Black Pearl",
    "type": "ship"
  }
]

or

{
  "ships": [
    { "name": "Cutlass Black", "manufacturer": "Drake" }
  ]
}`}
                  </Typography>
                </Box>
              </Well>

              <Stack direction="column" spacing={2}>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  aria-label="Upload JSON file"
                  style={{
                    padding: '10px',
                    border: `2px dashed ${theme.palette.divider}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                />

                {importError && <Alert severity="error">{importError}</Alert>}

                {importPreBox.length > 0 && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      Preview ({importPreBox.length} ships)
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: 'common.black',
                        color: 'common.white',
                        p: 2,
                        borderRadius: 1,
                        maxHeight: 200,
                        overflow: 'auto',
                      }}
                    >
                      {importPreBox.slice(0, 10).map((ship, index) => (
                        <Stack key={index} justifyContent="space-between" sx={{ mb: 0.5 }}>
                          <Typography>
                            <strong>{ship.name}</strong>
                            {ship.shipname && ` - "${ship.shipname}"`}
                          </Typography>
                        </Stack>
                      ))}
                      {importPreBox.length > 10 && (
                        <Typography>
                          <em>... and {importPreBox.length - 10} more ships</em>
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
              </Stack>
            </Stack>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleClose} startIcon={<CloseIcon />}>
          Cancel
        </Button>
        {importPreBox.length > 0 ? (
          <Button
            variant="contained"
            onClick={handleImportSubmit}
            disabled={isImporting}
            startIcon={isImporting ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {isImporting ? 'Importing...' : `Import ${importPreBox.length} Ships`}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleManualSubmit}
            disabled={!shipName.trim() || isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {isSubmitting ? 'Adding Ship...' : 'Add Ship to Hangar'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
