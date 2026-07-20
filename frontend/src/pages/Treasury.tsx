import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useCollectDues,
  useCommissaryItems,
  useCreateCommissaryItem,
  useCreateDues,
  useDeleteCommissaryItem,
  useDues,
  useEarnCredits,
  usePurchaseItem,
  useSpendCredits,
  useTreasuryBalance,
  useTreasuryLeaderboard,
  useTreasuryStatistics,
  useTreasuryTransactions,
  useUpdateCommissaryItem,
  useUpdateDues,
} from '@/hooks/queries/useTreasuryQueries';
import type {
  CommissaryItem as CommissaryItemType,
  CreditTransaction,
  OrgDues,
  TransactionType,
} from '@/types/apiV2';
import {
  AccountBalanceWallet,
  Add,
  ArrowDownward,
  ArrowUpward,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PlayArrow,
  ShoppingCart,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useState } from 'react';

// ============================================================================
// Helpers
// ============================================================================

const formatAmount = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null) return '0 aUEC';
  return `${Number(amount).toLocaleString()} aUEC`;
};

const formatDate = (date?: string): string => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString();
};

const txTypeColor = (type: TransactionType): 'success' | 'error' | 'info' | 'warning' => {
  switch (type) {
    case 'income':
    case 'reward':
      return 'success';
    case 'expense':
    case 'purchase':
      return 'error';
    case 'transfer':
      return 'info';
    case 'dues':
      return 'warning';
    default:
      return 'info';
  }
};

const txAmountColor = (type: TransactionType): string => {
  if (type === 'income' || type === 'reward') return 'success.main';
  if (type === 'expense' || type === 'purchase') return 'error.main';
  return 'text.primary';
};

// ============================================================================
// Treasury Page
// ============================================================================

const Treasury: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box width="100%">
      <PageHeader
        title="Treasury"
        description="Manage organization credits, dues, and commissary"
        helpTooltip="Track your organization's finances, manage recurring dues, and run a commissary store."
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Overview" />
          <Tab label="Transactions" />
          <Tab label="Dues" />
          <Tab label="Commissary" />
        </Tabs>
      </Box>

      <Box sx={{ mt: 2 }}>
        {activeTab === 0 && <OverviewTab />}
        {activeTab === 1 && <TransactionsTab />}
        {activeTab === 2 && <DuesTab />}
        {activeTab === 3 && <CommissaryTab />}
      </Box>
    </Box>
  );
};

// ============================================================================
// Overview Tab
// ============================================================================

const OverviewTab: React.FC = () => {
  const theme = useTheme();
  const { data: balance, isLoading: balLoading } = useTreasuryBalance();
  const { data: stats, isLoading: statsLoading } = useTreasuryStatistics();
  const { data: leaderboard = [] } = useTreasuryLeaderboard(5);
  const { data: txData } = useTreasuryTransactions({
    limit: 5,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  });

  const [showEarnDialog, setShowEarnDialog] = useState(false);
  const [showSpendDialog, setShowSpendDialog] = useState(false);
  const [earnForm, setEarnForm] = useState({ amount: '', source: '', category: '' });
  const [spendForm, setSpendForm] = useState({ amount: '', purpose: '', category: '' });
  const earnCredits = useEarnCredits();
  const spendCredits = useSpendCredits();

  if (balLoading || statsLoading) return <LoadingSpinner />;

  return (
    <Stack spacing={3}>
      {/* Balance + Quick Actions */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <AccountBalanceWallet
                sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 1 }}
              />
              <Typography
                variant="h3"
                sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}
              >
                {formatAmount(balance?.balance)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Organization Balance
              </Typography>
              <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<ArrowDownward />}
                  onClick={() => setShowEarnDialog(true)}
                >
                  Record Income
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<ArrowUpward />}
                  onClick={() => setShowSpendDialog(true)}
                >
                  Record Expense
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Statistics
              </Typography>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Total Income</Typography>
                  <Typography sx={{ color: theme.palette.success.main, fontWeight: 600 }}>
                    {formatAmount(stats?.totalIncome)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Total Expenses</Typography>
                  <Typography sx={{ color: theme.palette.error.main, fontWeight: 600 }}>
                    {formatAmount(stats?.totalExpenses)}
                  </Typography>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Transactions</Typography>
                  <Typography fontWeight={600}>{stats?.transactionCount ?? 0}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Transactions + Leaderboard */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Transactions
              </Typography>
              {txData && txData.items.length > 0 ? (
                <TransactionTable transactions={txData.items} compact />
              ) : (
                <Typography color="text.secondary" sx={{ py: 2 }}>
                  No transactions recorded yet.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Contributors
              </Typography>
              {leaderboard.length > 0 ? (
                <Stack spacing={1}>
                  {leaderboard.map((entry, idx) => (
                    <Stack
                      key={entry.userId}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={`#${idx + 1}`}
                          size="small"
                          color={idx === 0 ? 'primary' : 'default'}
                        />
                        <Typography variant="body2">
                          {entry.username ?? entry.userId.slice(0, 8)}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={600}>
                        {formatAmount(entry.totalContributed)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography color="text.secondary" sx={{ py: 2 }}>
                  No contributions yet.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Earn Dialog */}
      <CreditOperationDialog
        open={showEarnDialog}
        onClose={() => setShowEarnDialog(false)}
        title="Record Income"
        amountLabel="Amount"
        descriptionLabel="Source"
        descriptionValue={earnForm.source}
        amountValue={earnForm.amount}
        category={earnForm.category}
        isPending={earnCredits.isPending}
        onAmountChange={v => setEarnForm(f => ({ ...f, amount: v }))}
        onDescriptionChange={v => setEarnForm(f => ({ ...f, source: v }))}
        onCategoryChange={v => setEarnForm(f => ({ ...f, category: v }))}
        onSubmit={() => {
          earnCredits.mutate(
            {
              amount: Number(earnForm.amount),
              source: earnForm.source,
              category: earnForm.category || undefined,
            },
            {
              onSuccess: () => {
                setShowEarnDialog(false);
                setEarnForm({ amount: '', source: '', category: '' });
              },
            }
          );
        }}
      />

      {/* Spend Dialog */}
      <CreditOperationDialog
        open={showSpendDialog}
        onClose={() => setShowSpendDialog(false)}
        title="Record Expense"
        amountLabel="Amount"
        descriptionLabel="Purpose"
        descriptionValue={spendForm.purpose}
        amountValue={spendForm.amount}
        category={spendForm.category}
        isPending={spendCredits.isPending}
        onAmountChange={v => setSpendForm(f => ({ ...f, amount: v }))}
        onDescriptionChange={v => setSpendForm(f => ({ ...f, purpose: v }))}
        onCategoryChange={v => setSpendForm(f => ({ ...f, category: v }))}
        onSubmit={() => {
          spendCredits.mutate(
            {
              amount: Number(spendForm.amount),
              purpose: spendForm.purpose,
              category: spendForm.category || undefined,
            },
            {
              onSuccess: () => {
                setShowSpendDialog(false);
                setSpendForm({ amount: '', purpose: '', category: '' });
              },
            }
          );
        }}
      />
    </Stack>
  );
};

// ============================================================================
// Transactions Tab
// ============================================================================

const TransactionsTab: React.FC = () => {
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const params = {
    page,
    limit: 20,
    type: (typeFilter || undefined) as TransactionType | undefined,
    sortBy: 'createdAt' as const,
    sortOrder: 'DESC' as const,
  };

  const { data, isLoading, error } = useTreasuryTransactions(params);

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            label="Type"
            onChange={e => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="income">Income</MenuItem>
            <MenuItem value="expense">Expense</MenuItem>
            <MenuItem value="transfer">Transfer</MenuItem>
            <MenuItem value="dues">Dues</MenuItem>
            <MenuItem value="reward">Reward</MenuItem>
            <MenuItem value="purchase">Purchase</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {error && <Alert severity="error">Failed to load transactions</Alert>}
      {isLoading && <CircularProgress />}

      {data && (
        <>
          <TransactionTable transactions={data.items} />
          {data.total > 20 && (
            <Stack direction="row" justifyContent="center" spacing={2}>
              <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <Typography sx={{ lineHeight: '36px' }}>
                Page {page} of {Math.ceil(data.total / 20)}
              </Typography>
              <Button disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
};

// ============================================================================
// Dues Tab
// ============================================================================

const DuesTab: React.FC = () => {
  const theme = useTheme();
  const { data: dues = [], isLoading, error } = useDues();
  const createDues = useCreateDues();
  const updateDues = useUpdateDues();
  const collectDues = useCollectDues();
  const { openDialog, closeDialog, pendingData, dialogProps } = useConfirmDialog<string>();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [duesForm, setDuesForm] = useState({
    name: '',
    amount: '',
    frequency: 'monthly' as const,
    dueDay: '1',
    gracePeriodDays: '7',
  });

  const handleCreate = () => {
    createDues.mutate(
      {
        name: duesForm.name,
        amount: Number(duesForm.amount),
        frequency: duesForm.frequency,
        dueDay: Number(duesForm.dueDay),
        gracePeriodDays: Number(duesForm.gracePeriodDays),
      },
      {
        onSuccess: () => {
          setShowCreateDialog(false);
          setDuesForm({
            name: '',
            amount: '',
            frequency: 'monthly',
            dueDay: '1',
            gracePeriodDays: '7',
          });
        },
      }
    );
  };

  const handleCollect = () => {
    if (!pendingData) return;
    collectDues.mutate(pendingData, { onSuccess: closeDialog });
  };

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">Failed to load dues</Alert>;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" startIcon={<Add />} onClick={() => setShowCreateDialog(true)}>
          Create Dues Schedule
        </Button>
      </Stack>

      {dues.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No dues schedules configured. Create one to start collecting recurring payments.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {dues.map((d: OrgDues) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={d.id}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h6">{d.name}</Typography>
                    <Chip
                      label={d.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={d.isActive ? 'success' : 'default'}
                    />
                  </Stack>
                  <Typography
                    variant="h5"
                    sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}
                  >
                    {formatAmount(d.amount)}
                  </Typography>
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Frequency: {d.frequency}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Due day: {d.dueDay} | Grace: {d.gracePeriodDays} days
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button
                      size="small"
                      startIcon={<PlayArrow />}
                      onClick={() => openDialog(d.id)}
                      disabled={!d.isActive}
                    >
                      Collect
                    </Button>
                    <Button
                      size="small"
                      onClick={() =>
                        updateDues.mutate({ id: d.id, data: { isActive: !d.isActive } })
                      }
                    >
                      {d.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Dues Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Dues Schedule</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <TextField
              label="Name"
              value={duesForm.name}
              onChange={e => setDuesForm(f => ({ ...f, name: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Amount (aUEC)"
              type="number"
              value={duesForm.amount}
              onChange={e => setDuesForm(f => ({ ...f, amount: e.target.value }))}
              required
              fullWidth
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
            />
            <FormControl fullWidth>
              <InputLabel>Frequency</InputLabel>
              <Select
                value={duesForm.frequency}
                label="Frequency"
                onChange={e => setDuesForm(f => ({ ...f, frequency: e.target.value as 'monthly' }))}
              >
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="biweekly">Biweekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="quarterly">Quarterly</MenuItem>
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Due Day"
                type="number"
                value={duesForm.dueDay}
                onChange={e => setDuesForm(f => ({ ...f, dueDay: e.target.value }))}
                fullWidth
                slotProps={{ htmlInput: { min: 0, max: 31 } }}
              />
              <TextField
                label="Grace Period (days)"
                type="number"
                value={duesForm.gracePeriodDays}
                onChange={e => setDuesForm(f => ({ ...f, gracePeriodDays: e.target.value }))}
                fullWidth
                slotProps={{ htmlInput: { min: 0, max: 90 } }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!duesForm.name || !duesForm.amount || createDues.isPending}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        {...dialogProps}
        title="Collect Dues"
        message="This will collect dues from all eligible members. Continue?"
        confirmLabel="Collect"
        onConfirm={handleCollect}
      />
    </Stack>
  );
};

// ============================================================================
// Commissary Tab
// ============================================================================

const CommissaryTab: React.FC = () => {
  const { data: items = [], isLoading, error } = useCommissaryItems();
  const createItem = useCreateCommissaryItem();
  const updateItem = useUpdateCommissaryItem();
  const deleteItem = useDeleteCommissaryItem();
  const purchaseItem = usePurchaseItem();
  const {
    openDialog: openDeleteDialog,
    closeDialog: closeDeleteDialog,
    pendingData: deleteId,
    dialogProps: deleteDialogProps,
  } = useConfirmDialog<string>();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editItem, setEditItem] = useState<CommissaryItemType | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    stock: '-1',
  });

  const resetForm = () => {
    setItemForm({ name: '', description: '', price: '', category: '', stock: '-1' });
    setEditItem(null);
  };

  const handleSave = () => {
    if (editItem) {
      updateItem.mutate(
        {
          id: editItem.id,
          data: {
            name: itemForm.name,
            description: itemForm.description || undefined,
            price: Number(itemForm.price),
            category: itemForm.category,
            stock: Number(itemForm.stock),
          },
        },
        {
          onSuccess: () => {
            setShowCreateDialog(false);
            resetForm();
          },
        }
      );
    } else {
      createItem.mutate(
        {
          name: itemForm.name,
          description: itemForm.description || undefined,
          price: Number(itemForm.price),
          category: itemForm.category,
          stock: Number(itemForm.stock),
        },
        {
          onSuccess: () => {
            setShowCreateDialog(false);
            resetForm();
          },
        }
      );
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteId) return;
    deleteItem.mutate(deleteId, { onSuccess: closeDeleteDialog });
  };

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">Failed to load commissary items</Alert>;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            resetForm();
            setShowCreateDialog(true);
          }}
        >
          Add Item
        </Button>
      </Stack>

      {items.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No commissary items. Add items for organization members to purchase.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  Price
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  Stock
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item: CommissaryItemType) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Typography fontWeight={600}>{item.name}</Typography>
                    {item.description && (
                      <Typography variant="body2" color="text.secondary">
                        {item.description.slice(0, 80)}
                        {item.description.length > 80 ? '...' : ''}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={item.category} size="small" />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatAmount(item.price)}
                  </TableCell>
                  <TableCell align="right">
                    {item.stock === -1 ? 'Unlimited' : item.stock}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={item.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Button
                        size="small"
                        startIcon={<ShoppingCart />}
                        disabled={!item.isActive || item.stock === 0 || purchaseItem.isPending}
                        onClick={() => purchaseItem.mutate({ id: item.id, data: { quantity: 1 } })}
                      >
                        Buy
                      </Button>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => {
                          setEditItem(item);
                          setItemForm({
                            name: item.name,
                            description: item.description ?? '',
                            price: String(item.price),
                            category: item.category,
                            stock: String(item.stock),
                          });
                          setShowCreateDialog(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => openDeleteDialog(item.id)}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Item Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => {
          setShowCreateDialog(false);
          resetForm();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editItem ? 'Edit Item' : 'Add Commissary Item'}</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <TextField
              label="Name"
              value={itemForm.name}
              onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={itemForm.description}
              onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
              multiline
              rows={2}
              fullWidth
            />
            <TextField
              label="Price (aUEC)"
              type="number"
              value={itemForm.price}
              onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))}
              required
              fullWidth
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
            />
            <TextField
              label="Category"
              value={itemForm.category}
              onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Stock (-1 = unlimited)"
              type="number"
              value={itemForm.stock}
              onChange={e => setItemForm(f => ({ ...f, stock: e.target.value }))}
              fullWidth
              slotProps={{ htmlInput: { min: -1 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowCreateDialog(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={
              !itemForm.name ||
              !itemForm.price ||
              !itemForm.category ||
              createItem.isPending ||
              updateItem.isPending
            }
          >
            {editItem ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        {...deleteDialogProps}
        title="Delete Item"
        message="Are you sure you want to delete this commissary item?"
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
      />
    </Stack>
  );
};

// ============================================================================
// Shared Components
// ============================================================================

interface TransactionTableProps {
  transactions: CreditTransaction[];
  compact?: boolean;
}

const TransactionTable: React.FC<Readonly<TransactionTableProps>> = ({ transactions, compact }) => {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="right">
              Amount
            </TableCell>
            {!compact && (
              <TableCell sx={{ fontWeight: 600 }} align="right">
                Balance
              </TableCell>
            )}
            <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map(tx => (
            <TableRow key={tx.id}>
              <TableCell>
                <Chip label={tx.type} size="small" color={txTypeColor(tx.type)} />
              </TableCell>
              <TableCell>
                <Typography variant="body2">{tx.description}</Typography>
                {tx.category && (
                  <Typography variant="caption" color="text.secondary">
                    {tx.category}
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">
                <Typography
                  fontWeight={600}
                  sx={{
                    color: txAmountColor(tx.type),
                  }}
                >
                  {tx.type === 'income' || tx.type === 'reward' ? '+' : '-'}
                  {formatAmount(tx.amount)}
                </Typography>
              </TableCell>
              {!compact && (
                <TableCell align="right">
                  <Typography variant="body2">{formatAmount(tx.balance)}</Typography>
                </TableCell>
              )}
              <TableCell>
                <Typography variant="body2">{formatDate(tx.createdAt)}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

interface CreditOperationDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  amountLabel: string;
  descriptionLabel: string;
  amountValue: string;
  descriptionValue: string;
  category: string;
  isPending: boolean;
  onAmountChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onSubmit: () => void;
}

const CreditOperationDialog: React.FC<Readonly<CreditOperationDialogProps>> = ({
  open,
  onClose,
  title,
  amountLabel,
  descriptionLabel,
  amountValue,
  descriptionValue,
  category,
  isPending,
  onAmountChange,
  onDescriptionChange,
  onCategoryChange,
  onSubmit,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <Divider />
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 2 }}>
          <TextField
            label={amountLabel}
            type="number"
            value={amountValue}
            onChange={e => onAmountChange(e.target.value)}
            required
            fullWidth
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />
          <TextField
            label={descriptionLabel}
            value={descriptionValue}
            onChange={e => onDescriptionChange(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Category (optional)"
            value={category}
            onChange={e => onCategoryChange(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={!amountValue || !descriptionValue || isPending}
        >
          {isPending ? <CircularProgress size={20} /> : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// Export with Error Boundary
// ============================================================================

export const TreasuryWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Treasury"
    fallbackMessage="Unable to load treasury. Please try again later."
    showHomeButton={true}
  >
    <Treasury />
  </FeatureErrorBoundary>
);

export { Treasury };
