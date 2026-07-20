import { DataTable, type DataTableColumn } from '@/components/shared';
import { apiClient as api } from '@/services/apiClient';
import { useNotification } from '@/store/uiStore';
import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    Grid,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';

interface DeltaItem {
  name: string;
  manufacturer: string;
  shipId: string;
  changes?: Record<string, { old: string | null; new: string | null }>;
}

interface ShipDelta {
  added: DeltaItem[];
  updated: DeltaItem[];
  deleted: DeltaItem[];
  total: number;
}

interface CatalogShip {
  id: string;
  name: string;
  manufacturer: string;
  manufacturerCode?: string;
  description?: string;
  role?: string;
  career?: string;
  roles?: string[];
  size?: string;
  status: string;
  crew?: number;
  minCrew?: number;
  maxCrew?: number;
  length?: number;
  beam?: number;
  height?: number;
  mass?: number;
  cargo?: number;
  vehicleCargo?: number;
  price?: number;
  pledgePrice?: number;
  speed?: number;
  afterburnerSpeed?: number;
  quantumSpeed?: number;
  quantumFuelCapacity?: number;
  hydrogenFuelCapacity?: number;
  shields?: number;
  armor?: number;
  weapons?: { type: string; size: number; count: number }[];
  hardpoints?: { type: string; size: number; location: string }[];
  hangarSize?: string;
  storageUrl?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  brochureUrl?: string;
  isActive: boolean;
  loanerShip?: string;
  variants?: string[];
  isVehicle: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse {
  data: CatalogShip[];
  pagination: {
    total: number;
    count: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    totalPages: number;
  };
}

type ShipFormData = Omit<CatalogShip, 'id' | 'createdAt' | 'updatedAt'>;

const SHIP_SIZES = [
  'vehicle',
  'snub',
  'small',
  'medium',
  'large',
  'sub_capital',
  'capital',
] as const;
const SHIP_STATUSES = ['flight_ready', 'in_concept', 'in_production', 'announced'] as const;

const emptyForm: ShipFormData = {
  name: '',
  manufacturer: '',
  manufacturerCode: '',
  description: '',
  role: '',
  career: '',
  size: '',
  status: 'flight_ready',
  crew: undefined,
  minCrew: undefined,
  maxCrew: undefined,
  length: undefined,
  beam: undefined,
  height: undefined,
  mass: undefined,
  cargo: undefined,
  vehicleCargo: undefined,
  price: undefined,
  pledgePrice: undefined,
  speed: undefined,
  afterburnerSpeed: undefined,
  quantumSpeed: undefined,
  quantumFuelCapacity: undefined,
  hydrogenFuelCapacity: undefined,
  shields: undefined,
  armor: undefined,
  hangarSize: '',
  storageUrl: '',
  thumbnailUrl: '',
  imageUrl: '',
  brochureUrl: '',
  isActive: true,
  loanerShip: '',
  isVehicle: false,
};

// ==================== CSV Bulk Tab ====================
const CsvBulkTab: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [delta, setDelta] = useState<ShipDelta | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const notification = useNotification();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        notification.error('Please select a valid CSV file');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handlePreviewDelta = async () => {
    if (!file) {
      notification.error('Please select a CSV file');
      return;
    }
    setLoading(true);
    setDelta(null);
    try {
      const formData = new FormData();
      formData.append('csvFile', file);
      const response = await api.post<ShipDelta>('/api/v2/admin/ships/preview-delta', formData);
      setDelta(response.data);
      if (response.data.total === 0) {
        notification.success('No changes detected in the CSV file');
      }
    } catch (err) {
      notification.error(err instanceof Error ? err.message : 'Failed to preview delta');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDelta = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('csvFile', file);
      const response = await api.post<{
        success: boolean;
        results: { added: number; updated: number; deleted: number; errors: string[] };
        message: string;
      }>('/api/v2/admin/ships/apply-delta', formData);
      setConfirmDialogOpen(false);
      notification.success(response.data.message);
      setDelta(null);
      setFile(null);
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err) {
      notification.error(err instanceof Error ? err.message : 'Failed to apply delta');
    } finally {
      setLoading(false);
    }
  };

  const shipIdColumns: DataTableColumn<DeltaItem>[] = [
    { key: 'name', header: 'Name' },
    { key: 'manufacturer', header: 'Manufacturer' },
    {
      key: 'shipId',
      header: 'Ship ID',
      render: item => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {item.shipId}
        </Typography>
      ),
    },
  ];

  const updatedColumns: DataTableColumn<DeltaItem>[] = [
    { key: 'name', header: 'Name' },
    { key: 'manufacturer', header: 'Manufacturer' },
    {
      key: 'changes',
      header: 'Changed Fields',
      render: item => (
        <Stack spacing={0.5}>
          {item.changes &&
            Object.entries(item.changes).map(([field, change]) => (
              <Typography key={field} variant="caption" sx={{ fontFamily: 'monospace' }}>
                {field}: &quot;{change.old}&quot; → &quot;{change.new}&quot;
              </Typography>
            ))}
        </Stack>
      ),
    },
  ];

  return (
    <>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
            <Card>
              <CardHeader title="Upload CSV" />
              <CardContent>
                <Stack spacing={2}>
                  <Box sx={{ display: 'none' }}>
                    <input
                      id="csv-file-input"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      title="Select a CSV file to upload"
                      aria-label="CSV file input"
                    />
                  </Box>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<CloudUploadIcon />}
                    onClick={() => document.getElementById('csv-file-input')?.click()}
                    fullWidth
                  >
                    Select CSV File
                  </Button>
                  {file && (
                    <Typography variant="body2" color="success.main">
                      Selected: {file.name}
                    </Typography>
                  )}
                  <Button
                    variant="contained"
                    onClick={handlePreviewDelta}
                    disabled={!file || loading}
                    fullWidth
                  >
                    {loading ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        Analyzing...
                      </>
                    ) : (
                      'Preview Changes'
                    )}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          {delta && (
            <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
              <Card>
                <CardHeader title="Change Summary" />
                <CardContent>
                  <Stack spacing={2}>
                    <Paper sx={{ p: 2, bgcolor: 'success.light' }}>
                      <Typography variant="body2" color="success.dark">
                        <AddIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                        New Ships: {delta.added.length}
                      </Typography>
                    </Paper>
                    <Paper sx={{ p: 2, bgcolor: 'info.light' }}>
                      <Typography variant="body2" color="info.dark">
                        <EditIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                        Updated Ships: {delta.updated.length}
                      </Typography>
                    </Paper>
                    <Paper sx={{ p: 2, bgcolor: 'error.light' }}>
                      <Typography variant="body2" color="error.dark">
                        <DeleteIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                        Deleted Ships: {delta.deleted.length}
                      </Typography>
                    </Paper>
                    <Divider />
                    <Typography variant="h6">Total Changes: {delta.total}</Typography>
                    {delta.total > 0 && (
                      <Button
                        variant="contained"
                        color="warning"
                        onClick={() => setConfirmDialogOpen(true)}
                        fullWidth
                      >
                        Apply Changes
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>

        {delta && delta.added.length > 0 && (
          <Card>
            <CardHeader
              title={`New Ships (${delta.added.length})`}
              sx={{ bgcolor: 'success.light' }}
            />
            <DataTable<DeltaItem>
              columns={shipIdColumns}
              data={delta.added}
              getRowKey={(_, idx) => String(idx)}
              size="small"
              ariaLabel="New ships"
            />
          </Card>
        )}

        {delta && delta.updated.length > 0 && (
          <Card>
            <CardHeader
              title={`Updated Ships (${delta.updated.length})`}
              sx={{ bgcolor: 'info.light' }}
            />
            <DataTable<DeltaItem>
              columns={updatedColumns}
              data={delta.updated}
              getRowKey={(_, idx) => String(idx)}
              size="small"
              ariaLabel="Updated ships"
            />
          </Card>
        )}

        {delta && delta.deleted.length > 0 && (
          <Card>
            <CardHeader
              title={`Deleted Ships (${delta.deleted.length})`}
              sx={{ bgcolor: 'error.light' }}
            />
            <Box sx={{ '& tr': { opacity: 0.6 } }}>
              <DataTable<DeltaItem>
                columns={shipIdColumns}
                data={delta.deleted}
                getRowKey={(_, idx) => String(idx)}
                size="small"
                ariaLabel="Deleted ships"
              />
            </Box>
          </Card>
        )}
      </Stack>

      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Confirm Database Update</DialogTitle>
        <DialogContent>
          <Typography>
            This will apply all changes from the CSV file to the ship database:
          </Typography>
          {delta && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="body2">Add {delta.added.length} new ships</Typography>
              <Typography variant="body2">Update {delta.updated.length} existing ships</Typography>
              <Typography variant="body2">Delete {delta.deleted.length} ships</Typography>
            </Box>
          )}
          <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'warning.main' }}>
            This action cannot be undone. Ensure you have a backup of your database.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleApplyDelta} variant="contained" color="error" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Apply Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ==================== Ship Form Dialog ====================
interface ShipFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ShipFormData) => Promise<void>;
  initialData?: CatalogShip | null;
  loading: boolean;
}

const ShipFormDialog: React.FC<ShipFormDialogProps> = ({
  open,
  onClose,
  onSave,
  initialData,
  loading,
}) => {
  const [form, setForm] = useState<ShipFormData>(emptyForm);

  useEffect(() => {
    if (initialData) {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = initialData;
      setForm(rest);
    } else {
      setForm(emptyForm);
    }
  }, [initialData, open]);

  const handleChange = (field: keyof ShipFormData, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleNumberChange = (field: keyof ShipFormData, value: string) => {
    handleChange(field, value === '' ? undefined : Number(value));
  };

  const handleSubmit = async () => {
    // Strip empty strings to avoid sending blanks
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v !== '' && v !== undefined && v !== null) {
        cleaned[k] = v;
      }
    }
    await onSave(cleaned as ShipFormData);
  };

  const isEdit = !!initialData;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? `Edit Ship: ${initialData?.name}` : 'Create New Ship'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Basic Info */}
          <Typography variant="subtitle2" color="text.secondary">
            Basic Information
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Name"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Manufacturer"
                value={form.manufacturer}
                onChange={e => handleChange('manufacturer', e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Manufacturer Code"
                value={form.manufacturerCode ?? ''}
                onChange={e => handleChange('manufacturerCode', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Size</InputLabel>
                <Select
                  value={form.size ?? ''}
                  label="Size"
                  onChange={e => handleChange('size', e.target.value)}
                >
                  <MenuItem value="">None</MenuItem>
                  {SHIP_SIZES.map(s => (
                    <MenuItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={form.status}
                  label="Status"
                  onChange={e => handleChange('status', e.target.value)}
                >
                  {SHIP_STATUSES.map(s => (
                    <MenuItem key={s} value={s}>
                      {s.replaceAll('_', ' ').replaceAll(/\b\w/g, c => c.toUpperCase())}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Role"
                value={form.role ?? ''}
                onChange={e => handleChange('role', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Career"
                value={form.career ?? ''}
                onChange={e => handleChange('career', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Description"
                value={form.description ?? ''}
                onChange={e => handleChange('description', e.target.value)}
                fullWidth
                multiline
                rows={2}
              />
            </Grid>
          </Grid>

          <Divider />

          {/* Specs */}
          <Typography variant="subtitle2" color="text.secondary">
            Specifications
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Crew"
                type="number"
                value={form.crew ?? ''}
                onChange={e => handleNumberChange('crew', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Min Crew"
                type="number"
                value={form.minCrew ?? ''}
                onChange={e => handleNumberChange('minCrew', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Max Crew"
                type="number"
                value={form.maxCrew ?? ''}
                onChange={e => handleNumberChange('maxCrew', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Cargo (SCU)"
                type="number"
                value={form.cargo ?? ''}
                onChange={e => handleNumberChange('cargo', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Vehicle Cargo (SCU)"
                type="number"
                value={form.vehicleCargo ?? ''}
                onChange={e => handleNumberChange('vehicleCargo', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Length (m)"
                type="number"
                value={form.length ?? ''}
                onChange={e => handleNumberChange('length', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Beam (m)"
                type="number"
                value={form.beam ?? ''}
                onChange={e => handleNumberChange('beam', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Height (m)"
                type="number"
                value={form.height ?? ''}
                onChange={e => handleNumberChange('height', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Mass (kg)"
                type="number"
                value={form.mass ?? ''}
                onChange={e => handleNumberChange('mass', e.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>

          <Divider />

          {/* Performance */}
          <Typography variant="subtitle2" color="text.secondary">
            Performance
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Speed"
                type="number"
                value={form.speed ?? ''}
                onChange={e => handleNumberChange('speed', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Afterburner"
                type="number"
                value={form.afterburnerSpeed ?? ''}
                onChange={e => handleNumberChange('afterburnerSpeed', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="QT Speed"
                type="number"
                value={form.quantumSpeed ?? ''}
                onChange={e => handleNumberChange('quantumSpeed', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="QT Fuel"
                type="number"
                value={form.quantumFuelCapacity ?? ''}
                onChange={e => handleNumberChange('quantumFuelCapacity', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="H2 Fuel"
                type="number"
                value={form.hydrogenFuelCapacity ?? ''}
                onChange={e => handleNumberChange('hydrogenFuelCapacity', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Shields"
                type="number"
                value={form.shields ?? ''}
                onChange={e => handleNumberChange('shields', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Armor"
                type="number"
                value={form.armor ?? ''}
                onChange={e => handleNumberChange('armor', e.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>

          <Divider />

          {/* Pricing & Misc */}
          <Typography variant="subtitle2" color="text.secondary">
            Pricing & Extras
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Price (aUEC)"
                type="number"
                value={form.price ?? ''}
                onChange={e => handleNumberChange('price', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Pledge ($)"
                type="number"
                value={form.pledgePrice ?? ''}
                onChange={e => handleNumberChange('pledgePrice', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Loaner Ship"
                value={form.loanerShip ?? ''}
                onChange={e => handleChange('loanerShip', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Hangar Size"
                value={form.hangarSize ?? ''}
                onChange={e => handleChange('hangarSize', e.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>

          <Divider />

          {/* Flags */}
          <Typography variant="subtitle2" color="text.secondary">
            Flags
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Vehicle</InputLabel>
                <Select
                  value={form.isVehicle ? 'true' : 'false'}
                  label="Vehicle"
                  onChange={e => handleChange('isVehicle', e.target.value === 'true')}
                >
                  <MenuItem value="false">Ship</MenuItem>
                  <MenuItem value="true">Vehicle</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Active</InputLabel>
                <Select
                  value={form.isActive ? 'true' : 'false'}
                  label="Active"
                  onChange={e => handleChange('isActive', e.target.value === 'true')}
                >
                  <MenuItem value="true">Yes</MenuItem>
                  <MenuItem value="false">No</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Divider />

          {/* URLs */}
          <Typography variant="subtitle2" color="text.secondary">
            Media URLs
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Image URL"
                value={form.imageUrl ?? ''}
                onChange={e => handleChange('imageUrl', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Thumbnail URL"
                value={form.thumbnailUrl ?? ''}
                onChange={e => handleChange('thumbnailUrl', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Storage URL"
                value={form.storageUrl ?? ''}
                onChange={e => handleChange('storageUrl', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Brochure URL"
                value={form.brochureUrl ?? ''}
                onChange={e => handleChange('brochureUrl', e.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !form.name || !form.manufacturer}
        >
          {loading && <CircularProgress size={20} />}
          {!loading && (isEdit ? 'Save Changes' : 'Create Ship')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== Ship Roster Tab ====================
const ShipRosterTab: React.FC = () => {
  const [ships, setShips] = useState<CatalogShip[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const notification = useNotification();

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editShip, setEditShip] = useState<CatalogShip | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shipToDelete, setShipToDelete] = useState<CatalogShip | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchShips = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), limit: '25' });
        if (search) params.set('search', search);
        if (filterSize) params.set('size', filterSize);
        if (filterStatus) params.set('status', filterStatus);

        const response = await api.get<PaginatedResponse>(
          `/api/v2/admin/ships?${params.toString()}`
        );
        const result = response.data;
        setShips(result?.data ?? []);
        setPagination(
          result?.pagination ?? {
            total: 0,
            count: 0,
            page: 1,
            pageSize: 25,
            hasMore: false,
            totalPages: 0,
          }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load ships');
      } finally {
        setLoading(false);
      }
    },
    [search, filterSize, filterStatus]
  );

  useEffect(() => {
    fetchShips();
  }, [fetchShips]);

  const handleCreate = () => {
    setEditShip(null);
    setFormOpen(true);
  };

  const handleEdit = (ship: CatalogShip) => {
    setEditShip(ship);
    setFormOpen(true);
  };

  const handleSave = async (data: ShipFormData) => {
    setFormLoading(true);
    try {
      if (editShip) {
        await api.put(`/api/v2/admin/ships/${editShip.id}`, data);
        notification.success(`Ship "${data.name}" updated successfully`);
      } else {
        await api.post('/api/v2/admin/ships', data);
        notification.success(`Ship "${data.name}" created successfully`);
      }
      setFormOpen(false);
      fetchShips(pagination.page);
    } catch (err) {
      notification.error(err instanceof Error ? err.message : 'Failed to save ship');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteClick = (ship: CatalogShip) => {
    setShipToDelete(ship);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!shipToDelete) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/v2/admin/ships/${shipToDelete.id}`);
      notification.success(`Ship "${shipToDelete.name}" deleted`);
      setDeleteDialogOpen(false);
      setShipToDelete(null);
      fetchShips(pagination.page);
    } catch (err) {
      notification.error(err instanceof Error ? err.message : 'Failed to delete ship');
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: DataTableColumn<CatalogShip>[] = [
    { key: 'name', header: 'Name' },
    { key: 'manufacturer', header: 'Manufacturer' },
    {
      key: 'role',
      header: 'Role',
      render: item => (
        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>
          {item.role || '—'}
        </Typography>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      render: item =>
        item.size ? (
          <Chip label={item.size.replaceAll('_', ' ')} size="small" variant="outlined" />
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: item => (
        <Chip
          label={item.status.replaceAll('_', ' ')}
          size="small"
          color={item.status === 'flight_ready' ? 'success' : 'default'}
        />
      ),
    },
    {
      key: 'crew',
      header: 'Crew',
      render: item => (
        <Typography variant="body2" color="text.secondary">
          {item.crew ?? '—'}
        </Typography>
      ),
    },
    {
      key: 'cargo',
      header: 'SCU',
      render: item => (
        <Typography variant="body2" color="text.secondary">
          {item.cargo ?? '—'}
        </Typography>
      ),
    },
    {
      key: 'isVehicle',
      header: 'Type',
      render: item => (
        <Chip
          label={item.isVehicle ? 'Vehicle' : 'Ship'}
          size="small"
          variant="outlined"
          color={item.isVehicle ? 'warning' : 'primary'}
        />
      ),
    },
    {
      key: 'isActive',
      header: 'Active',
      render: item => (
        <Chip
          label={item.isActive ? 'Yes' : 'No'}
          size="small"
          color={item.isActive ? 'success' : 'default'}
        />
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      render: item => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleEdit(item)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDeleteClick(item)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <Stack spacing={2}>
        {/* Toolbar */}
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <TextField
            placeholder="Search ships..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="small"
            sx={{ minWidth: 220 }}
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
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Size</InputLabel>
            <Select value={filterSize} label="Size" onChange={e => setFilterSize(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {SHIP_SIZES.map(s => (
                <MenuItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              label="Status"
              onChange={e => setFilterStatus(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {SHIP_STATUSES.map(s => (
                <MenuItem key={s} value={s}>
                  {s.replaceAll('_', ' ').replaceAll(/\b\w/g, c => c.toUpperCase())}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Refresh">
            <IconButton onClick={() => fetchShips(pagination.page)}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            Add Ship
          </Button>
        </Stack>

        {/* Results info */}
        <Typography variant="body2" color="text.secondary">
          {pagination.total} ships total — Page {pagination.page} of {pagination.totalPages || 1}
        </Typography>

        {/* Table */}
        {loading ? (
          <Stack alignItems="center" py={4}>
            <CircularProgress />
          </Stack>
        ) : (
          <DataTable<CatalogShip>
            columns={columns}
            data={ships}
            getRowKey={item => item.id}
            size="small"
            ariaLabel="Ship catalog roster"
          />
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <Stack direction="row" spacing={1} justifyContent="center">
            <Button
              size="small"
              disabled={pagination.page <= 1}
              onClick={() => fetchShips(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              size="small"
              disabled={!pagination.hasMore}
              onClick={() => fetchShips(pagination.page + 1)}
            >
              Next
            </Button>
          </Stack>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Stack>

      {/* Create/Edit Dialog */}
      <ShipFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        initialData={editShip}
        loading={formLoading}
      />

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Ship</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{shipToDelete?.name}</strong> by{' '}
            {shipToDelete?.manufacturer}?
          </Typography>
          <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'warning.main' }}>
            This will remove the ship from the global catalog. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ==================== Main Component ====================

/**
 * Admin Ship Manager Component
 * Tabbed interface: Ship Roster (individual CRUD) + CSV Bulk Import
 */
export const AdminShipManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Ship Database Management
      </Typography>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Ship Roster" />
        <Tab label="CSV Bulk Import" />
      </Tabs>

      {activeTab === 0 && <ShipRosterTab />}
      {activeTab === 1 && <CsvBulkTab />}
    </Box>
  );
};
