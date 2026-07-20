import { ErrorMessage } from '@/components/ErrorMessage';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { Item } from '@/components/ui/Item';
import { SearchField } from '@/components/ui/SearchField';
import { Select } from '@/components/ui/Select';
import {
  useCreateInventoryItem,
  useDeleteInventoryItem,
  useInventory,
  useMarketPrices,
  useUpdateAllPrices,
  useUpdateItemPrices,
} from '@/hooks/queries/useInventoryQueries';
import type { InventoryItem } from '@/types/apiV2';
import {
  Add,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select as MuiSelect,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useState } from 'react';

const Logistics: React.FC = () => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showMarketDialog, setShowMarketDialog] = useState(false);
  const [marketPriceItemName, setMarketPriceItemName] = useState<string | undefined>();

  const {
    openDialog: openDeleteConfirm,
    closeDialog: closeDeleteConfirm,
    pendingData: pendingDeleteId,
    dialogProps: deleteDialogProps,
  } = useConfirmDialog<string>();

  const [formData, setFormData] = useState({
    itemName: '',
    category: 'equipment',
    quantity: 0,
    unit: 'units',
    minStock: 0,
    location: '',
    notes: '',
  });

  const categories = [
    { id: 'all', name: 'All Categories' },
    { id: 'equipment', name: 'Equipment' },
    { id: 'fuel', name: 'Fuel' },
    { id: 'ammunition', name: 'Ammunition' },
    { id: 'medical', name: 'Medical' },
    { id: 'food', name: 'Food' },
    { id: 'trade', name: 'Trade Goods' },
    { id: 'components', name: 'Components' },
  ];

  const units = ['units', 'scu', 'liters', 'kilograms', 'tonnes'];

  // React Query hooks
  const inventoryParams = {
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    search: searchTerm || undefined,
  };
  const {
    data: inventory = [],
    isLoading: loading,
    error: inventoryError,
    refetch: refetchInventory,
  } = useInventory(inventoryParams);

  const { data: marketData } = useMarketPrices(showMarketDialog ? marketPriceItemName : undefined);

  const createItem = useCreateInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const updateAllPrices = useUpdateAllPrices();
  const updateItemPrices = useUpdateItemPrices();

  const handleAddItem = () => {
    createItem.mutate(
      {
        itemName: formData.itemName,
        category: formData.category,
        quantity: formData.quantity,
        unit: formData.unit,
        location: formData.location || undefined,
        minStock: formData.minStock,
      },
      {
        onSuccess: () => {
          setShowAddDialog(false);
          resetForm();
        },
      }
    );
  };

  const handleDeleteItemClick = (id: string) => {
    openDeleteConfirm(id);
  };

  const handleDeleteItemConfirm = () => {
    const id = pendingDeleteId;
    closeDeleteConfirm();
    if (!id) return;
    deleteItem.mutate(id);
  };

  const handleUpdatePrices = () => {
    updateAllPrices.mutate(inventory);
  };

  const handleBoxMarketPrices = (item: InventoryItem) => {
    setMarketPriceItemName(item.itemName);
    setSelectedItem(item);
    setShowMarketDialog(true);
  };

  const resetForm = () => {
    setFormData({
      itemName: '',
      category: 'equipment',
      quantity: 0,
      unit: 'units',
      minStock: 0,
      location: '',
      notes: '',
    });
    setSelectedItem(null);
  };

  const formatPrice = (price?: number | null) => {
    if (price === undefined || price === null) return 'N/A';
    return `${price.toLocaleString()} aUEC`;
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  return (
    <Box width="100%">
      {/* Page Header */}
      <PageHeader
        title="Inventory"
        description="Manage organizational inventory and stock levels"
        helpTooltip="Track inventory items, stock levels, and supply chain data for your organization. Add items, update prices, and monitor availability."
        primaryAction={{
          label: 'Add Item',
          icon: Add,
          onPress: () => setShowAddDialog(true),
        }}
        secondaryAction={{
          label: 'Update All Prices',
          icon: Refresh,
          onPress: () => {
            handleUpdatePrices();
          },
        }}
      />

      {/* Error Display */}
      {inventoryError && (
        <Box marginTop="size-200">
          <ErrorMessage
            message={
              inventoryError instanceof Error ? inventoryError.message : 'Failed to load inventory'
            }
            onRetry={() => {
              refetchInventory().catch(() => {});
            }}
          />
        </Box>
      )}

      {/* Search and Filter Bar */}
      <Box marginTop="size-300">
        <Stack direction="row" gap="size-200" alignItems="end">
          <SearchField
            label="Search inventory"
            value={searchTerm}
            onChange={setSearchTerm}
            width="size-5000"
            placeholder="Search by item name..."
          />
          <Select
            label="Category"
            value={selectedCategory}
            onSelectionChange={key => setSelectedCategory(key as string)}
          >
            {categories.map(cat => (
              <Item key={cat.id}>{cat.name}</Item>
            ))}
          </Select>
        </Stack>
      </Box>

      {/* Inventory Table */}
      <Box marginTop="size-300">
        <Box
          sx={{
            backgroundColor: theme.palette.background.default,
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            marginBottom="size-200"
          >
            <Typography
              variant="h6"
              sx={{ color: theme.palette.primary.main, fontSize: '1.25rem' }}
            >
              Inventory ({inventory.length})
            </Typography>
          </Stack>

          {loading && <LoadingSpinner />}

          {!loading && inventory.length === 0 && (
            <Box padding="size-400">
              <Typography sx={{ color: theme.palette.text.secondary, textAlign: 'center' }}>
                No inventory items found. Add your first item to get started.
              </Typography>
            </Box>
          )}

          {!loading && inventory.length > 0 && (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table
                size="small"
                aria-label="Inventory table"
                sx={{ color: theme.palette.text.primary }}
              >
                <TableHead>
                  <TableRow sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                    <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                      Item Name
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                      Category
                    </TableCell>
                    <TableCell
                      sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}
                      align="right"
                    >
                      Quantity
                    </TableCell>
                    <TableCell
                      sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}
                      align="right"
                    >
                      Avg. Buy
                    </TableCell>
                    <TableCell
                      sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}
                      align="right"
                    >
                      Avg. Sell
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                      Location
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                      Validated
                    </TableCell>
                    <TableCell
                      sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}
                      align="center"
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inventory.map(item => (
                    <TableRow
                      key={item.id}
                      sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
                    >
                      <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                        {item.itemName}
                      </TableCell>
                      <TableCell sx={{ color: theme.palette.text.primary }}>
                        <Box
                          component="span"
                          sx={{
                            backgroundColor: alpha(theme.palette.primary.main, 0.15),
                            color: theme.palette.primary.main,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                          }}
                        >
                          {item.category}
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ color: theme.palette.text.primary }}>
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell align="right" sx={{ color: theme.palette.text.primary }}>
                        {formatPrice(item.avgBuyPrice)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: theme.palette.text.primary }}>
                        {formatPrice(item.avgSellPrice)}
                      </TableCell>
                      <TableCell sx={{ color: theme.palette.text.secondary }}>
                        {item.location || 'N/A'}
                      </TableCell>
                      <TableCell sx={{ color: theme.palette.text.secondary, fontSize: '0.75rem' }}>
                        {formatDate(item.lastValidated)}
                      </TableCell>
                      <TableCell>
                        <Stack gap="size-100" justifyContent="center">
                          <IconButton
                            tooltip="Box market prices"
                            isQuiet
                            onClick={() => handleBoxMarketPrices(item)}
                            sx={{ color: theme.palette.primary.main }}
                          >
                            <VisibilityIcon />
                          </IconButton>
                          <IconButton
                            tooltip="Edit item"
                            isQuiet
                            onClick={() => {
                              setSelectedItem(item);
                              setFormData({
                                itemName: item.itemName,
                                category: item.category,
                                quantity: item.quantity,
                                unit: item.unit,
                                minStock: item.minStock || 0,
                                location: item.location || '',
                                notes: '',
                              });
                              setShowAddDialog(true);
                            }}
                            sx={{ color: theme.palette.primary.main }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            tooltip="Delete item"
                            isQuiet
                            onClick={() => handleDeleteItemClick(item.id)}
                            sx={{ color: theme.palette.error.main }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Box>

      {/* Add/Edit Item Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedItem ? 'Edit Item' : 'Add Inventory Item'}</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack direction="column" spacing={2} sx={{ pt: 2 }}>
            <TextField
              label="Item Name"
              value={formData.itemName}
              onChange={e => setFormData({ ...formData, itemName: e.target.value })}
              required
              fullWidth
            />
            <FormControl fullWidth required>
              <InputLabel>Category</InputLabel>
              <MuiSelect
                value={formData.category}
                label="Category"
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                {categories
                  .filter(c => c.id !== 'all')
                  .map(cat => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </MenuItem>
                  ))}
              </MuiSelect>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Quantity"
                type="number"
                value={formData.quantity}
                onChange={e =>
                  setFormData({ ...formData, quantity: Number.parseInt(e.target.value) || 0 })
                }
                slotProps={{ htmlInput: { min: 0 } }}
                fullWidth
              />
              <TextField
                label="Min. Stock"
                type="number"
                value={formData.minStock}
                onChange={e =>
                  setFormData({ ...formData, minStock: Number.parseInt(e.target.value) || 0 })
                }
                slotProps={{ htmlInput: { min: 0 } }}
                fullWidth
              />
            </Stack>
            <FormControl fullWidth>
              <InputLabel>Unit</InputLabel>
              <MuiSelect
                value={formData.unit}
                label="Unit"
                onChange={e => setFormData({ ...formData, unit: e.target.value })}
              >
                {units.map(unit => (
                  <MenuItem key={unit} value={unit}>
                    {unit}
                  </MenuItem>
                ))}
              </MuiSelect>
            </FormControl>
            <TextField
              label="Location"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              fullWidth
            />
            <TextField
              label="Notes"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={() => {
              setShowAddDialog(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAddItem}>
            {selectedItem ? 'Update Item' : 'Add Item'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Market Prices Dialog */}
      <Dialog
        open={showMarketDialog}
        onClose={() => setShowMarketDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Market Prices - {selectedItem?.itemName}</DialogTitle>
        <Divider />
        <DialogContent>
          {marketData && !marketData.available && (
            <Box sx={{ pt: 2, textAlign: 'center' }}>
              <Typography sx={{ color: theme.palette.text.secondary }}>
                No market data available for this item. UEX Corp may not track this commodity, or
                the price feed may be temporarily unavailable.
              </Typography>
            </Box>
          )}
          {marketData && marketData.available && (
            <Stack direction="column" spacing={3} sx={{ pt: 2 }}>
              <Stack direction="row" spacing={3} justifyContent="space-around">
                <Box>
                  <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                    Min Price
                  </Typography>
                  <Typography
                    sx={{
                      color: theme.palette.success.main,
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                    }}
                  >
                    {formatPrice(marketData.minPrice)}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                    Average
                  </Typography>
                  <Typography
                    sx={{
                      color: theme.palette.primary.main,
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                    }}
                  >
                    {formatPrice(marketData.avgPrice)}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                    Max Price
                  </Typography>
                  <Typography
                    sx={{
                      color: theme.palette.warning.main,
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                    }}
                  >
                    {formatPrice(marketData.maxPrice)}
                  </Typography>
                </Box>
              </Stack>

              <Divider />

              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Available Locations
                </Typography>
                {marketData.locations?.map(
                  (loc: { location: string; type: string; price: number }) => (
                    <Box key={`${loc.location}-${loc.type}`} sx={{ borderRadius: 1, p: 2, mb: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography>{loc.location}</Typography>
                        <Chip
                          label={`[${loc.type}] ${formatPrice(loc.price)}`}
                          color={loc.type === 'buy' ? 'success' : 'info'}
                          size="small"
                        />
                      </Stack>
                    </Box>
                  )
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setShowMarketDialog(false)}>
            Close
          </Button>
          <Button
            variant="contained"
            disabled={updateItemPrices.isPending}
            onClick={() => {
              if (selectedItem && marketData?.available) {
                const buyLocs = marketData.locations.filter(l => l.type === 'buy');
                const sellLocs = marketData.locations.filter(l => l.type === 'sell');
                const avgBuyPrice =
                  buyLocs.length > 0
                    ? buyLocs.reduce((sum, l) => sum + l.price, 0) / buyLocs.length
                    : undefined;
                const avgSellPrice =
                  sellLocs.length > 0
                    ? sellLocs.reduce((sum, l) => sum + l.price, 0) / sellLocs.length
                    : undefined;
                updateItemPrices.mutate(
                  { id: selectedItem.id, marketData: { avgBuyPrice, avgSellPrice } },
                  {
                    onSuccess: () => {
                      setShowMarketDialog(false);
                    },
                  }
                );
              }
            }}
          >
            Update Item Price
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        {...deleteDialogProps}
        title="Delete Item"
        message="Are you sure you want to delete this item?"
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDeleteItemConfirm}
      />
    </Box>
  );
};

export const LogisticsWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Logistics"
    fallbackMessage="Unable to load logistics inventory. Please try again later."
    showHomeButton={true}
  >
    <Logistics />
  </FeatureErrorBoundary>
);
