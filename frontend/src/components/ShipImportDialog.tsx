import { Button, Button as UIButton } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Divider } from '@/components/ui/Divider';
import { Item } from '@/components/ui/Item';
import { SearchField } from '@/components/ui/SearchField';
import { Select } from '@/components/ui/Select';
import { ButtonGroup, Content, NumberField, TypographyField } from '@/components/ui/SpectrumCompat';
import { fleetViewService } from '@/services/fleetViewService';
import { ShipCatalogueItem, shipCatalogueService } from '@/services/shipCatalogueService';
import { shipServiceV2 as shipService } from '@/services/shipServiceV2';
import { useAuthStore } from '@/store/authStore';
import type { CreateShipInput } from '@/types/apiV2';
import { ParsedShip, parseShipCSV } from '@/utils/csvParser';
import { dedupeManufacturers, isSameManufacturer } from '@/utils/manufacturerMatching';
import { logger } from '@/utils/logger';
import { CheckCircle as CheckmarkCircle } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import UploadToCloudIcon from '@mui/icons-material/CloudUpload';
import EditIcon from '@mui/icons-material/Edit';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import StorageIcon from '@mui/icons-material/Storage';
import { Box, Chip, CircularProgress, Dialog as MuiDialog, Stack, Typography } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
/**
 * V2 Services
 * Ship CRUD uses /api/v2/ships via shipServiceV2 (tenant-scoped).
 * FleetView import/export uses /api/v2/fleet/* (org-aware where available).
 */

interface ShipImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type ImportMethod = 'catalogue' | 'file' | 'bulk' | 'rsi';

interface BulkShipForm {
  name: string;
  manufacturer: string;
  model: string;
  role: string;
  size: 'vehicle' | 'snub' | 'small' | 'medium' | 'large' | 'sub_capital' | 'capital';
  crew: number;
  cargoCapacity: number;
  location: string;
  quantity: number;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  duplicates: string[];
}

export const ShipImportDialog: React.FC<ShipImportDialogProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [importMethod, setImportMethod] = useState<ImportMethod>('catalogue');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const user = useAuthStore(state => state.user);
  const organizationId = user?.activeOrgId ?? user?.organizationId;

  // File import preBox state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreBox, setFilePreBox] = useState<ParsedShip[] | null>(null);

  // Ship catalogue state
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [catalogueShips, setCatalogueShips] = useState<ShipCatalogueItem[]>([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatalogueShips, setSelectedCatalogueShips] = useState<Set<string>>(new Set());
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);

  // Bulk add form state
  const [bulkShips, setBulkShips] = useState<BulkShipForm[]>([
    {
      name: '',
      manufacturer: '',
      model: '',
      role: 'combat',
      size: 'small',
      crew: 1,
      cargoCapacity: 0,
      location: '',
      quantity: 1,
    },
  ]);

  const roles = [
    { id: 'combat', name: 'Combat' },
    { id: 'cargo', name: 'Cargo' },
    { id: 'mining', name: 'Mining' },
    { id: 'exploration', name: 'Exploration' },
    { id: 'support', name: 'Support' },
    { id: 'multi-role', name: 'Multi-Role' },
  ];

  const sizes = [
    { id: 'small', name: 'Small' },
    { id: 'medium', name: 'Medium' },
    { id: 'large', name: 'Large' },
    { id: 'capital', name: 'Capital' },
  ];

  // Load ship catalogue data
  useEffect(() => {
    if (importMethod === 'catalogue') {
      loadManufacturers();
      loadCatalogueShips();
    }
  }, [importMethod]);

  useEffect(() => {
    if (importMethod === 'catalogue') {
      loadCatalogueShips();
    }
  }, [selectedManufacturer, searchQuery, importMethod]);

  const loadManufacturers = async () => {
    try {
      const manufacturerList = await shipCatalogueService.getManufacturers();
      setManufacturers(dedupeManufacturers(manufacturerList).sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      logger.error(
        'Failed to load manufacturers:',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const loadCatalogueShips = async () => {
    setLoadingCatalogue(true);
    try {
      const response = await shipCatalogueService.getShips({
        search: searchQuery || undefined,
        limit: 500,
      });

      const items = response.items;
      const filteredItems = selectedManufacturer
        ? items.filter(ship => isSameManufacturer(ship.manufacturer, selectedManufacturer))
        : items;

      setCatalogueShips(filteredItems);
    } catch (err) {
      logger.error('Failed to load ships:', err instanceof Error ? err : new Error(String(err)));
      setCatalogueShips([]);
    } finally {
      setLoadingCatalogue(false);
    }
  };

  const handleCatalogueShipSelect = (shipId: string) => {
    const newSelection = new Set(selectedCatalogueShips);
    if (newSelection.has(shipId)) {
      newSelection.delete(shipId);
    } else {
      newSelection.add(shipId);
    }
    setSelectedCatalogueShips(newSelection);
  };

  const handleCatalogueImport = async () => {
    const shipsToImport = catalogueShips.filter(ship => selectedCatalogueShips.has(ship.id));

    if (shipsToImport.length === 0) {
      setError('Please select at least one ship to import');
      return;
    }

    setLoading(true);
    setError(null);
    setImportResult(null);

    try {
      const parsedShips: ParsedShip[] = shipsToImport.map(ship => ({
        name: ship.name,
        manufacturer: ship.manufacturer,
        model: ship.name,
        role: ship.role || 'multi-role',
        size:
          (ship.size as
            | 'vehicle'
            | 'snub'
            | 'small'
            | 'medium'
            | 'large'
            | 'sub_capital'
            | 'capital') || 'small',
        crew: ship.crew || 1,
        cargoCapacity: ship.cargo || 0,
        status: 'operational',
      }));

      await importShips(parsedShips);
    } catch (err: unknown) {
      logger.error('Catalogue import failed:', err instanceof Error ? err : new Error(String(err)));
      const errorMessage =
        err && typeof err === 'object' && 'message' in err
          ? (err as Error).message
          : 'Failed to import ships';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setImportResult(null);
    setFilePreBox(null);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'json') {
        await handleJSONPreBox(file);
      } else if (fileExtension === 'csv') {
        await handleCSVPreBox(file);
      } else {
        setError('Please select a JSON or CSV file');
        setLoading(false);
        return;
      }

      setSelectedFile(file);
    } catch (err: unknown) {
      logger.error('File preBox failed:', err instanceof Error ? err : new Error(String(err)));
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const errorMessage = axiosErr.response?.data?.error
        ? axiosErr.response.data.error
        : err instanceof Error
          ? err.message
          : 'Failed to preBox file';
      setError(errorMessage);
      setSelectedFile(null);
      setFilePreBox(null);
    } finally {
      setLoading(false);
    }
  };

  const handleJSONPreBox = async (file: File) => {
    // Validate FleetBox schema
    const validation = await fleetViewService.validateSchema(file);

    if (!validation.valid) {
      setError(validation.error || 'Invalid FleetBox file format');
      return;
    }

    // Parse the file to show preBox
    const text = await file.text();
    const data = JSON.parse(text);

    // Extract ships from FleetBox format for preBox
    const ships: ParsedShip[] = [];
    if (Array.isArray(data)) {
      data.forEach(item => {
        if (item.type === 'ship' && item.name) {
          ships.push({
            name: item.shipname || item.name,
            manufacturer: item.manufacturer || 'Unknown',
            model: item.name,
            role: item.role || 'multi-role',
            size: item.size || 'small',
            crew: item.crew || 1,
            cargoCapacity: item.cargoCapacity || 0,
            location: item.location,
            status: 'operational',
          });
        }
      });
    }

    if (ships.length === 0) {
      setError('No valid ships found in file');
      return;
    }

    setFilePreBox(ships);
  };

  const handleCSVPreBox = async (file: File) => {
    const text = await file.text();
    const parseResult = parseShipCSV(text);

    if (!parseResult.success) {
      setError(parseResult.errors.join('\n'));
      return;
    }

    setFilePreBox(parseResult.ships);
  };

  const handleConfirmImport = async () => {
    if (!selectedFile || !filePreBox) return;

    setLoading(true);
    setError(null);
    setImportResult(null);

    try {
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'json') {
        await handleJSONImport(selectedFile);
      } else if (fileExtension === 'csv') {
        await importShips(filePreBox);
      }
    } catch (err: unknown) {
      logger.error('Import failed:', err instanceof Error ? err : new Error(String(err)));
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const errorMessage = axiosErr.response?.data?.error
        ? axiosErr.response.data.error
        : err instanceof Error
          ? err.message
          : 'Failed to import ships';
      setError(errorMessage);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleJSONImport = async (file: File) => {
    // Import using FleetView service (org-scoped when available)
    const result = organizationId
      ? await fleetViewService.importOrgFleet(organizationId, file, {
          merge: true,
          skipDuplicates,
        })
      : await fleetViewService.importUserFleet(file, {
          merge: true,
          skipDuplicates,
        });

    // Convert FleetBox result to our ImportResult format
    const importResult: ImportResult = {
      success: result.success,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
      duplicates: result.ships.filter(s => s.status === 'skipped').map(s => s.name),
    };

    setImportResult(importResult);

    if (result.success && result.imported > 0) {
      onImportComplete();
    }
  };

  // CSV import handler - reserved for future use
  const _handleCSVImport = async (file: File) => {
    const text = await file.text();
    const parseResult = parseShipCSV(text);

    if (!parseResult.success) {
      setError(parseResult.errors.join('\n'));
      return;
    }

    // Import parsed ships
    await importShips(parseResult.ships);
  };

  const importShips = async (ships: ParsedShip[]) => {
    const errors: string[] = [];
    const duplicates: string[] = [];
    let imported = 0;
    let skipped = 0;

    // Fetch existing ships to check for duplicates
    const existingShipsResult = await shipService.getShips({ page: 1, limit: 1000 });
    const existingShips = existingShipsResult.items || [];
    const existingShipNames = new Set(
      existingShips.map(s => `${s.manufacturer}-${s.model}-${s.name}`.toLowerCase())
    );

    for (const ship of ships) {
      const shipKey = `${ship.manufacturer}-${ship.model}-${ship.name}`.toLowerCase();

      // Check for duplicates
      if (existingShipNames.has(shipKey)) {
        if (skipDuplicates) {
          duplicates.push(ship.name);
          skipped++;
          continue;
        } else {
          // Import duplicate but add it to duplicates list for reporting
          duplicates.push(ship.name);
        }
      }

      try {
        const shipInput: CreateShipInput = {
          name: ship.name,
          manufacturer: ship.manufacturer,
          model: ship.model,
          role: ship.role,
          size: ship.size,
          crew: ship.crew || 1,
          cargoCapacity: ship.cargoCapacity || 0,
          location: ship.location,
          status: ship.status || 'operational',
        };

        await shipService.createShip(shipInput);
        imported++;
      } catch (err: unknown) {
        logger.error(
          `Failed to import ${ship.name}:`,
          err instanceof Error ? err : new Error(String(err))
        );
        const axiosErr = err as { response?: { data?: { error?: string } } };
        const errorMessage = axiosErr.response?.data?.error
          ? axiosErr.response.data.error
          : err instanceof Error
            ? err.message
            : 'Unknown error';
        errors.push(`${ship.name}: ${errorMessage}`);
      }
    }

    const result: ImportResult = {
      success: imported > 0,
      imported,
      skipped,
      errors,
      duplicates,
    };

    setImportResult(result);

    if (result.success) {
      onImportComplete();
    }
  };

  const handleBulkAdd = async () => {
    // Validate bulk form
    const validShips = bulkShips.filter(s => s.name && s.manufacturer && s.model);

    if (validShips.length === 0) {
      setError('Please fill in at least one ship with name, manufacturer, and model');
      return;
    }

    setLoading(true);
    setError(null);
    setImportResult(null);

    try {
      // Expand ships with quantity
      const expandedShips: ParsedShip[] = [];
      validShips.forEach(ship => {
        for (let i = 0; i < ship.quantity; i++) {
          const shipName = ship.quantity > 1 ? `${ship.name} #${i + 1}` : ship.name;
          expandedShips.push({
            name: shipName,
            manufacturer: ship.manufacturer,
            model: ship.model,
            role: ship.role,
            size: ship.size,
            crew: ship.crew,
            cargoCapacity: ship.cargoCapacity,
            location: ship.location || undefined,
            status: 'operational',
          });
        }
      });

      await importShips(expandedShips);
    } catch (err: unknown) {
      logger.error('Bulk add failed:', err instanceof Error ? err : new Error(String(err)));
      setError(err instanceof Error ? err.message : 'Failed to add ships');
    } finally {
      setLoading(false);
    }
  };

  const addBulkShipRow = () => {
    setBulkShips([
      ...bulkShips,
      {
        name: '',
        manufacturer: '',
        model: '',
        role: 'combat',
        size: 'small',
        crew: 1,
        cargoCapacity: 0,
        location: '',
        quantity: 1,
      },
    ]);
  };

  const removeBulkShipRow = (index: number) => {
    setBulkShips(bulkShips.filter((_, i) => i !== index));
  };

  const updateBulkShip = (index: number, field: keyof BulkShipForm, value: unknown) => {
    const updated = [...bulkShips];
    updated[index] = { ...updated[index], [field]: value };
    setBulkShips(updated);
  };

  const handleRSIImport = () => {
    setError(
      'RSI Hangar import is coming soon! This feature will allow you to automatically import your ships from your RSI account.'
    );
  };

  const handleClose = () => {
    setImportResult(null);
    setError(null);
    setSelectedFile(null);
    setFilePreBox(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <MuiDialog open={isOpen} onClose={onClose} maxWidth="lg" fullWidth>
      <Typography>
        <Stack alignItems="center" spacing={1}>
          <UploadToCloudIcon sx={{ fontSize: '2rem' }} />
          <Typography>Import Ships</Typography>
        </Stack>
      </Typography>
      <Divider />
      <Content>
        <Box sx={{ p: 2 }}>
          <Stack direction="column" spacing={3}>
            {/* Import Method Selector */}
            <Box sx={{ borderRadius: 1, p: 2 }}>
              <Stack direction="column" spacing={1.5}>
                <Typography variant="subtitle1">Choose Import Method</Typography>
                <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                  Select how you'd like to add ships to your hangar
                </Typography>
                <Select
                  label="Import method"
                  value={importMethod}
                  onChange={key => setImportMethod(key as ImportMethod)}
                  fullWidth
                >
                  <Item key="catalogue">
                    <Stack alignItems="center" spacing={1}>
                      <StorageIcon sx={{ fontSize: '1.25rem' }} />
                      <Typography>From Ship Catalogue</Typography>
                    </Stack>
                  </Item>
                  <Item key="file">
                    <Stack alignItems="center" spacing={1}>
                      <UploadToCloudIcon sx={{ fontSize: '1.25rem' }} />
                      <Typography>File Import (JSON/CSV)</Typography>
                    </Stack>
                  </Item>
                  <Item key="bulk">
                    <Stack alignItems="center" spacing={1}>
                      <EditIcon sx={{ fontSize: '1.25rem' }} />
                      <Typography>Manual Bulk Add</Typography>
                    </Stack>
                  </Item>
                  <Item key="rsi">RSI Hangar Import (Coming Soon)</Item>
                </Select>
              </Stack>
            </Box>

            {/* Ship Catalogue Selection */}
            {importMethod === 'catalogue' && (
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Stack direction="column" spacing={1}>
                    <Typography variant="subtitle1">Browse Ship Catalogue</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                      Select ships from the database to add to your hangar
                    </Typography>
                  </Stack>

                  <Checkbox checked={skipDuplicates} onChange={setSkipDuplicates}>
                    Skip duplicate ships
                  </Checkbox>

                  {/* Filters */}
                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <Select
                      label="Manufacturer"
                      value={selectedManufacturer}
                      onChange={key => setSelectedManufacturer(key as string)}
                      fullWidth
                    >
                      <Item key="">All Manufacturers</Item>
                      {manufacturers.map(mfr => (
                        <Item key={mfr}>{mfr}</Item>
                      ))}
                    </Select>

                    <SearchField
                      label="Search Ships"
                      value={searchQuery}
                      onChange={setSearchQuery}
                      width="size-3000"
                    />
                  </Stack>

                  {/* Ship List */}
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      minHeight: '300px',
                      maxHeight: '500px',
                      overflow: 'auto',
                      p: 1,
                    }}
                  >
                    {loadingCatalogue ? (
                      <Stack justifyContent="center" alignItems="center" sx={{ height: '300px' }}>
                        <CircularProgress size={60} aria-label="Loading ships" />
                      </Stack>
                    ) : catalogueShips.length === 0 ? (
                      <Stack
                        justifyContent="center"
                        alignItems="center"
                        sx={{ height: '300px' }}
                        direction="column"
                        spacing={1}
                      >
                        <Typography>No ships found</Typography>
                        <Typography
                          sx={{
                            fontSize: '0.85rem',
                            color: 'var(--spectrum-global-color-gray-600)',
                          }}
                        >
                          Try adjusting your filters
                        </Typography>
                      </Stack>
                    ) : (
                      <Stack direction="column" spacing={0.5}>
                        {catalogueShips.map(ship => (
                          <Box
                            key={ship.id}
                            sx={{
                              p: 1.5,
                              borderRadius: 1,
                              backgroundColor: selectedCatalogueShips.has(ship.id)
                                ? 'action.selected'
                                : 'grey.100',
                              cursor: 'pointer',
                              transition: theme =>
                                theme.transitions.create('background-color', { duration: 200 }),
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              onClick={() => handleCatalogueShipSelect(ship.id)}
                            >
                              <Checkbox
                                checked={selectedCatalogueShips.has(ship.id)}
                                onChange={() => handleCatalogueShipSelect(ship.id)}
                                aria-label={`Select ${ship.name}`}
                              />
                              <Stack direction="column" spacing={0.5} flex={1}>
                                <Typography>
                                  <strong>{ship.name}</strong>
                                </Typography>
                                <Typography
                                  sx={{
                                    fontSize: '0.85rem',
                                    color: 'var(--spectrum-global-color-gray-600)',
                                  }}
                                >
                                  {ship.manufacturer}
                                  {ship.size && ` • ${ship.size}`}
                                  {ship.role && ` • ${ship.role}`}
                                </Typography>
                              </Stack>
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>

                  {selectedCatalogueShips.size > 0 && (
                    <Box sx={{ borderRadius: 1, p: 2 }}>
                      <Chip
                        label={`${selectedCatalogueShips.size} ship${selectedCatalogueShips.size !== 1 ? 's' : ''} selected`}
                        color="success"
                        size="small"
                      />
                    </Box>
                  )}
                </Stack>
              </Box>
            )}

            {/* File Import */}
            {importMethod === 'file' && (
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Stack direction="column" spacing={1}>
                    <Typography variant="subtitle1">Import from File</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                      Upload a JSON (FleetBox format) or CSV file containing your ships
                    </Typography>
                  </Stack>

                  <Box sx={{ borderRadius: 1, p: 2 }}>
                    <Stack direction="column" spacing={1}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                        Supported Formats:
                      </Typography>
                      <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                        • <strong>JSON:</strong> FleetBox export format
                      </Typography>
                      <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                        • <strong>CSV:</strong>{' '}
                        name,manufacturer,model,role,size,crew,cargoCapacity,location,status
                      </Typography>
                    </Stack>
                  </Box>

                  <Checkbox checked={skipDuplicates} onChange={setSkipDuplicates}>
                    Skip duplicate ships
                  </Checkbox>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.csv,application/json,text/csv"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />

                  <Button variant="primary" onClick={handleFileSelect} disabled={loading}>
                    <UploadToCloudIcon />
                    <Typography>Select File to Import</Typography>
                  </Button>

                  {/* File PreBox */}
                  {filePreBox && filePreBox.length > 0 && (
                    <Box sx={{ borderRadius: 1, p: 2 }}>
                      <Stack direction="column" spacing={1.5}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <CheckmarkCircle color="success" />
                          <Typography variant="body1">
                            File Loaded: {filePreBox.length} ship
                            {filePreBox.length !== 1 ? 's' : ''} ready to import
                          </Typography>
                        </Stack>
                        <Box
                          sx={{
                            backgroundColor: 'grey.50',
                            p: 2,
                            borderRadius: 1,
                            maxHeight: '200px',
                            overflow: 'auto',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Stack direction="column" spacing={0.75}>
                            {filePreBox.slice(0, 10).map((ship, idx) => (
                              <Stack
                                key={idx}
                                direction="row"
                                alignItems="center"
                                spacing={1}
                                sx={{
                                  padding: '8px',
                                  backgroundColor:
                                    idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
                                  borderRadius: '4px',
                                }}
                              >
                                <Chip label={String(idx + 1)} size="small" />
                                <Stack direction="column" flex={1}>
                                  <Typography sx={{ fontWeight: 'bold' }}>{ship.name}</Typography>
                                  <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                                    {ship.manufacturer} {ship.model} • {ship.role} • {ship.size}
                                  </Typography>
                                </Stack>
                              </Stack>
                            ))}
                            {filePreBox.length > 10 && (
                              <Typography
                                sx={{
                                  fontStyle: 'italic',
                                  fontSize: '0.9rem',
                                  textAlign: 'center',
                                  padding: '8px',
                                  color: 'text.secondary',
                                }}
                              >
                                ... and {filePreBox.length - 10} more ship
                                {filePreBox.length - 10 !== 1 ? 's' : ''}
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Box>
            )}

            {/* Bulk Add */}
            {importMethod === 'bulk' && (
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Stack direction="column" spacing={1}>
                    <Typography variant="subtitle1">Manual Bulk Add</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                      Manually enter ship details to add multiple ships at once
                    </Typography>
                  </Stack>

                  <Checkbox checked={skipDuplicates} onChange={setSkipDuplicates}>
                    Skip duplicate ships
                  </Checkbox>

                  {bulkShips.map((ship, index) => (
                    <Box key={index} sx={{ borderRadius: 1, p: 2 }}>
                      <Stack direction="column" spacing={1.5}>
                        <Stack justifyContent="space-between" alignItems="center">
                          <Chip label={`Ship ${index + 1}`} size="small" />
                          {bulkShips.length > 1 && (
                            <UIButton onClick={() => removeBulkShipRow(index)} variant="danger">
                              Remove
                            </UIButton>
                          )}
                        </Stack>

                        <Stack direction="row" spacing={1.5} flexWrap="wrap">
                          <TypographyField
                            label="Name"
                            value={ship.name}
                            onChange={value => updateBulkShip(index, 'name', value)}
                            width="size-2400"
                            isRequired
                          />
                          <TypographyField
                            label="Manufacturer"
                            value={ship.manufacturer}
                            onChange={value => updateBulkShip(index, 'manufacturer', value)}
                            width="size-2400"
                            isRequired
                          />
                          <TypographyField
                            label="Model"
                            value={ship.model}
                            onChange={value => updateBulkShip(index, 'model', value)}
                            width="size-2400"
                            isRequired
                          />
                        </Stack>

                        <Stack direction="row" spacing={1.5} flexWrap="wrap">
                          <Select
                            label="Role"
                            value={ship.role}
                            onChange={key => updateBulkShip(index, 'role', key)}
                            fullWidth
                          >
                            {roles.map(role => (
                              <Item key={role.id}>{role.name}</Item>
                            ))}
                          </Select>
                          <Select
                            label="Size"
                            value={ship.size}
                            onChange={key => updateBulkShip(index, 'size', key)}
                            fullWidth
                          >
                            {sizes.map(size => (
                              <Item key={size.id}>{size.name}</Item>
                            ))}
                          </Select>
                          <NumberField
                            label="Crew"
                            value={ship.crew}
                            onChange={value => updateBulkShip(index, 'crew', value)}
                            minValue={1}
                            width="size-1200"
                          />
                          <NumberField
                            label="Cargo"
                            value={ship.cargoCapacity}
                            onChange={value => updateBulkShip(index, 'cargoCapacity', value)}
                            minValue={0}
                            width="size-1200"
                          />
                        </Stack>

                        <Stack direction="row" spacing={1.5}>
                          <TypographyField
                            label="Location"
                            value={ship.location}
                            onChange={value => updateBulkShip(index, 'location', value)}
                            width="size-2400"
                          />
                          <NumberField
                            label="Quantity"
                            value={ship.quantity}
                            onChange={value => updateBulkShip(index, 'quantity', value)}
                            minValue={1}
                            maxValue={100}
                            width="size-1200"
                          />
                        </Stack>
                      </Stack>
                    </Box>
                  ))}

                  <Button variant="secondary" onClick={addBulkShipRow} disabled={loading}>
                    Add Another Ship
                  </Button>
                </Stack>
              </Box>
            )}

            {/* RSI Import */}
            {importMethod === 'rsi' && (
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={1.5}>
                  <Typography variant="subtitle1">RSI Hangar Import</Typography>
                  <Typography>
                    This feature will allow you to automatically import ships from your Roberts
                    Space Industries account hangar.
                  </Typography>
                  <Typography sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                    Coming soon! This feature is currently in development.
                  </Typography>
                </Stack>
              </Box>
            )}

            {/* Loading State */}
            {loading && (
              <Stack justifyContent="center" sx={{ mt: 2 }}>
                <CircularProgress aria-label="Loading..." size={40} />
              </Stack>
            )}

            {/* Error Display */}
            {error && (
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack spacing={1} alignItems="center">
                  <ErrorOutlineIcon sx={{ color: 'error.main' }} />
                  <Typography>{error}</Typography>
                </Stack>
              </Box>
            )}

            {/* Import Result Display */}
            {importResult && (
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={1.5}>
                  <Stack spacing={1} alignItems="center">
                    {importResult.success ? (
                      <>
                        <CheckmarkCircle color="success" />
                        <Typography variant="subtitle1">Import Successful</Typography>
                      </>
                    ) : (
                      <>
                        <ErrorOutlineIcon sx={{ color: 'error.main' }} />
                        <Typography variant="subtitle1">Import Completed with Errors</Typography>
                      </>
                    )}
                  </Stack>

                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    {importResult.imported > 0 && (
                      <Chip
                        label={`${importResult.imported} imported`}
                        color="success"
                        size="small"
                      />
                    )}
                    {importResult.skipped > 0 && (
                      <Chip label={`${importResult.skipped} skipped`} size="small" />
                    )}
                    {importResult.errors.length > 0 && (
                      <Chip
                        label={`${importResult.errors.length} errors`}
                        color="error"
                        size="small"
                      />
                    )}
                  </Stack>

                  {importResult.duplicates.length > 0 && (
                    <Box>
                      <Typography sx={{ fontWeight: 'bold' }}>Duplicate ships skipped:</Typography>
                      <Typography>{importResult.duplicates.join(', ')}</Typography>
                    </Box>
                  )}

                  {importResult.errors.length > 0 && (
                    <Box>
                      <Typography sx={{ fontWeight: 'bold' }}>Errors:</Typography>
                      {importResult.errors.slice(0, 10).map((err: string, idx: number) => (
                        <Typography
                          key={idx}
                          sx={{
                            color: 'var(--spectrum-global-color-red-600)',
                            fontSize: '0.9rem',
                          }}
                        >
                          • {err}
                        </Typography>
                      ))}
                      {importResult.errors.length > 10 && (
                        <Typography>
                          ... and {importResult.errors.length - 10} more errors
                        </Typography>
                      )}
                    </Box>
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
        </Box>
      </Content>
      <Divider />
      <ButtonGroup
        align="end"
        sx={{ marginTop: '16px', marginRight: '16px', marginBottom: '16px' }}
      >
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        {/* Show action button based on import method and state */}
        {importMethod === 'catalogue' && selectedCatalogueShips.size > 0 && !importResult && (
          <Button variant="primary" onClick={handleCatalogueImport} disabled={loading}>
            {loading ? (
              <>
                <CircularProgress size={20} aria-label="Importing..." />
                <Typography>Importing...</Typography>
              </>
            ) : (
              <>
                <AddIcon />
                <Typography>
                  Add {selectedCatalogueShips.size} Ship
                  {selectedCatalogueShips.size !== 1 ? 's' : ''}
                </Typography>
              </>
            )}
          </Button>
        )}
        {importMethod === 'file' && filePreBox && filePreBox.length > 0 && !importResult && (
          <Button variant="primary" onClick={handleConfirmImport} disabled={loading}>
            {loading ? (
              <>
                <CircularProgress size={20} aria-label="Importing..." />
                <Typography>Importing...</Typography>
              </>
            ) : (
              <>
                <UploadToCloudIcon />
                <Typography>
                  Import {filePreBox.length} Ship{filePreBox.length !== 1 ? 's' : ''}
                </Typography>
              </>
            )}
          </Button>
        )}
        {importMethod === 'bulk' && (
          <Button
            variant="primary"
            onClick={handleBulkAdd}
            disabled={
              loading || bulkShips.filter(s => s.name && s.manufacturer && s.model).length === 0
            }
          >
            {loading ? (
              <>
                <CircularProgress size={20} aria-label="Importing..." />
                <Typography>Importing...</Typography>
              </>
            ) : (
              <>
                <UploadToCloudIcon />
                <Typography>
                  Import {bulkShips.filter(s => s.name && s.manufacturer && s.model).length} Ship
                  {bulkShips.filter(s => s.name && s.manufacturer && s.model).length !== 1
                    ? 's'
                    : ''}
                </Typography>
              </>
            )}
          </Button>
        )}
        {importMethod === 'rsi' && (
          <Button variant="primary" onClick={handleRSIImport} disabled={true}>
            <Typography>Connect RSI Account (Coming Soon)</Typography>
          </Button>
        )}
      </ButtonGroup>
    </MuiDialog>
  );
};
