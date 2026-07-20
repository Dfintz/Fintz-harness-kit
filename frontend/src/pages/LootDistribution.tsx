import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { PageHeader } from '@/components/PageHeader';
import {
  useAddLootItem,
  useAddLootItemsBulk,
  useCancelLootPool,
  useClaimLootItem,
  useCreateLootPool,
  useDistributeLootPool,
  useLockLootPool,
  useLootPool,
  useLootPools,
  useRetryLootDistribution,
  useRemoveLootItem,
  useScanLootPoolImage,
  useUpdateLootPool,
  useWithdrawLootClaim,
} from '@/hooks/queries/useLootQueries';
import { useAuthStore } from '@/store/authStore';
import type {
  LootClaimType,
  LootDistributionMethod,
  LootDistributionResult,
  LootPool,
  LootPoolStatus,
} from '@sc-fleet-manager/shared-types';
import { Add, DocumentScanner, Delete, EmojiEvents, Lock } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';

// ==================== Static maps ====================

const METHOD_LABELS: Record<LootDistributionMethod, string> = {
  need_greed: 'Need / Greed',
  random_roll: 'Random Roll',
  auec_bid: 'aUEC Bid',
  even_split: 'Even Split by Value',
  leader_assign: 'Leader Assigns',
};

const STATUS_COLORS: Record<LootPoolStatus, 'default' | 'info' | 'success' | 'warning'> = {
  open: 'warning',
  locked: 'info',
  distributed: 'success',
  partially_distributed: 'warning',
  cancelled: 'default',
};

const formatAuec = (value: number | string): string =>
  `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} aUEC`;

const parseAssistantUserIds = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(',')
        .map(candidate => candidate.trim())
        .filter(candidate => candidate.length > 0)
    )
  );

const formatAssistantUserIds = (assistantUserIds: string[]): string => assistantUserIds.join(', ');

// ==================== Create Pool Dialog ====================

interface CreatePoolDialogProps {
  open: boolean;
  onClose: () => void;
}

const CreatePoolDialog: React.FC<CreatePoolDialogProps> = ({ open, onClose }) => {
  const createPool = useCreateLootPool();
  const [name, setName] = useState('');
  const [activityId, setActivityId] = useState('');
  const [method, setMethod] = useState<LootDistributionMethod>('need_greed');
  const [maxItems, setMaxItems] = useState('');
  const [shareTotalPayout, setShareTotalPayout] = useState(false);
  const [notes, setNotes] = useState('');
  const [assistantUserIdsInput, setAssistantUserIdsInput] = useState('');

  const reset = (): void => {
    setName('');
    setActivityId('');
    setMethod('need_greed');
    setMaxItems('');
    setShareTotalPayout(false);
    setNotes('');
    setAssistantUserIdsInput('');
  };

  const handleSubmit = async (): Promise<void> => {
    const assistantUserIds = parseAssistantUserIds(assistantUserIdsInput);
    await createPool.mutateAsync({
      name,
      activityId,
      distributionMethod: method,
      rules: {
        ...(maxItems ? { maxItemsPerParticipant: Number(maxItems) } : {}),
        ...(method === 'even_split' ? { shareTotalPayout } : {}),
        ...(notes ? { notes } : {}),
      },
      ...(assistantUserIds.length > 0 ? { assistantUserIds } : {}),
    });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Loot Pool</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Pool name"
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Activity ID"
            helperText="The mission/activity this loot came from (defines who can claim)"
            value={activityId}
            onChange={e => setActivityId(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Distribution method"
            select
            value={method}
            onChange={e => setMethod(e.target.value as LootDistributionMethod)}
            fullWidth
          >
            {(Object.keys(METHOD_LABELS) as LootDistributionMethod[]).map(m => (
              <MenuItem key={m} value={m}>
                {METHOD_LABELS[m]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Max items per participant (optional)"
            helperText="e.g. 1 to give everyone one item from the pool"
            type="number"
            value={maxItems}
            onChange={e => setMaxItems(e.target.value)}
            fullWidth
          />
          {method === 'even_split' && (
            <FormControlLabel
              control={
                <Switch
                  checked={shareTotalPayout}
                  onChange={e => setShareTotalPayout(e.target.checked)}
                />
              }
              label="Pay out total value, shared between participants"
            />
          )}
          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            label="Assistant manager user IDs (optional)"
            helperText="Comma-separated user IDs that can manage this specific pool"
            value={assistantUserIdsInput}
            onChange={e => setAssistantUserIdsInput(e.target.value)}
            fullWidth
          />
          {createPool.isError && (
            <Alert severity="error">
              Failed to create pool. Check the activity ID and try again.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!name || !activityId || createPool.isPending}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== OCR Dialog ====================

interface OcrDialogProps {
  open: boolean;
  poolId: string;
  onClose: () => void;
}

const OcrDialog: React.FC<OcrDialogProps> = ({ open, poolId, onClose }) => {
  const scan = useScanLootPoolImage();
  const bulkAdd = useAddLootItemsBulk();
  const [file, setFile] = useState<File | null>(null);

  const handleScan = async (): Promise<void> => {
    if (file) {
      await scan.mutateAsync({ poolId, file });
    }
  };

  const handleConfirm = async (): Promise<void> => {
    const suggestions = scan.data?.suggestions ?? [];
    if (suggestions.length > 0) {
      await bulkAdd.mutateAsync({
        poolId,
        items: suggestions.map(s => ({
          name: s.name,
          quantity: s.quantity,
          category: s.category,
          source: 'ocr' as const,
        })),
      });
    }
    setFile(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Scan inventory screenshot</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Button variant="outlined" component="label">
            {file ? file.name : 'Choose image'}
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </Button>
          <Button variant="contained" onClick={handleScan} disabled={!file || scan.isPending}>
            {scan.isPending ? 'Scanning…' : 'Scan'}
          </Button>
          {scan.data && !scan.data.enabled && (
            <Alert severity="info">
              OCR is not configured on this server. You can still add items manually.
            </Alert>
          )}
          {scan.data?.enabled && (
            <Alert severity={scan.data.suggestions.length ? 'success' : 'warning'}>
              {scan.data.suggestions.length} item(s) detected.
            </Alert>
          )}
          {(scan.data?.suggestions.length ?? 0) > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell>Category</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scan.data?.suggestions.map((s, i) => (
                  <TableRow key={`${s.name}-${i}`}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell align="right">{s.quantity}</TableCell>
                    <TableCell>{s.category ?? 'other'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!scan.data?.suggestions.length || bulkAdd.isPending}
        >
          Add {scan.data?.suggestions.length ?? 0} items
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface PoolManagerActionsProps {
  status: LootPoolStatus;
  itemCount: number;
  onOpenOcr: () => void;
  onLock: () => void;
  onDistribute: () => void;
  onRetryDistribution: () => void;
  onCancel: () => void;
  lockPending: boolean;
  distributePending: boolean;
  retryPending: boolean;
}

const PoolManagerActions: React.FC<PoolManagerActionsProps> = ({
  status,
  itemCount,
  onOpenOcr,
  onLock,
  onDistribute,
  onRetryDistribution,
  onCancel,
  lockPending,
  distributePending,
  retryPending,
}) => {
  const isOpen = status === 'open';
  const isLocked = status === 'locked';
  const isPartiallyDistributed = status === 'partially_distributed';

  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
      {isOpen && (
        <>
          <Button size="small" startIcon={<DocumentScanner />} onClick={onOpenOcr}>
            Scan screenshot
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<Lock />}
            onClick={onLock}
            disabled={itemCount === 0 || lockPending}
          >
            Lock & open claims
          </Button>
        </>
      )}
      {isLocked && (
        <Button
          size="small"
          variant="contained"
          color="success"
          startIcon={<EmojiEvents />}
          onClick={onDistribute}
          disabled={distributePending}
        >
          Distribute
        </Button>
      )}
      {isPartiallyDistributed && (
        <Button
          size="small"
          variant="contained"
          color="warning"
          onClick={onRetryDistribution}
          disabled={retryPending}
        >
          Retry distribution
        </Button>
      )}
      {status !== 'distributed' && status !== 'partially_distributed' && status !== 'cancelled' && (
        <Button size="small" color="error" onClick={onCancel}>
          Cancel pool
        </Button>
      )}
    </Stack>
  );
};

// ==================== Pool Detail ====================

interface PoolDetailProps {
  poolId: string;
  currentUserId?: string;
}

const PoolDetail: React.FC<PoolDetailProps> = ({ poolId, currentUserId }) => {
  const { data: pool, isLoading } = useLootPool(poolId);
  const addItem = useAddLootItem();
  const removeItem = useRemoveLootItem();
  const lockPool = useLockLootPool();
  const updatePool = useUpdateLootPool();
  const cancelPool = useCancelLootPool();
  const distribute = useDistributeLootPool();
  const retryDistribution = useRetryLootDistribution();
  const claim = useClaimLootItem();
  const withdraw = useWithdrawLootClaim();

  const [ocrOpen, setOcrOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', quantity: '1', unitValue: '0' });
  const [assistantUserIdsInput, setAssistantUserIdsInput] = useState('');
  const [result, setResult] = useState<LootDistributionResult | null>(null);

  const assistantUserIds = useMemo(() => {
    const assistantIds = pool?.metadata?.assistantUserIds;
    if (!Array.isArray(assistantIds)) {
      return [];
    }
    return assistantIds.filter(
      (assistantId): assistantId is string => typeof assistantId === 'string'
    );
  }, [pool]);

  const isManager = useMemo(
    () =>
      Boolean(
        pool &&
        currentUserId &&
        (pool.leaderId === currentUserId ||
          pool.createdBy === currentUserId ||
          assistantUserIds.includes(currentUserId))
      ),
    [pool, currentUserId, assistantUserIds]
  );

  useEffect(() => {
    setAssistantUserIdsInput(formatAssistantUserIds(assistantUserIds));
  }, [assistantUserIds]);

  if (isLoading || !pool) {
    return <CircularProgress sx={{ m: 4 }} />;
  }

  const isOpen = pool.status === 'open';
  const isLocked = pool.status === 'locked';
  const isPartiallyDistributed = pool.status === 'partially_distributed';

  const handleAddItem = async (): Promise<void> => {
    if (!newItem.name) {
      return;
    }
    await addItem.mutateAsync({
      poolId,
      data: {
        name: newItem.name,
        quantity: Number(newItem.quantity) || 1,
        unitValue: Number(newItem.unitValue) || 0,
      },
    });
    setNewItem({ name: '', quantity: '1', unitValue: '0' });
  };

  const handleDistribute = async (): Promise<void> => {
    const res = await distribute.mutateAsync(poolId);
    setResult(res);
  };

  const handleRetryDistribution = async (): Promise<void> => {
    const res = await retryDistribution.mutateAsync(poolId);
    setResult(res);
  };

  const handleSaveAssistantManagers = async (): Promise<void> => {
    const nextAssistantUserIds = parseAssistantUserIds(assistantUserIdsInput);
    await updatePool.mutateAsync({
      poolId,
      data: { assistantUserIds: nextAssistantUserIds },
    });
  };

  const claimTypesFor = (method: LootDistributionMethod): LootClaimType[] => {
    if (method === 'need_greed') {
      return ['need', 'greed'];
    }
    if (method === 'random_roll') {
      return ['roll'];
    }
    if (method === 'auec_bid') {
      return ['bid'];
    }
    return [];
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
        <Typography variant="h6">{pool.name}</Typography>
        <Chip size="small" color={STATUS_COLORS[pool.status]} label={pool.status} />
        <Chip size="small" variant="outlined" label={METHOD_LABELS[pool.distributionMethod]} />
        <Box flexGrow={1} />
        <Typography variant="subtitle1" fontWeight={600}>
          Total: {formatAuec(pool.totalValue)}
        </Typography>
      </Stack>

      {pool.rules?.maxItemsPerParticipant ? (
        <Typography variant="caption" color="text.secondary">
          Rule: max {pool.rules.maxItemsPerParticipant} item(s) per participant
          {pool.rules.shareTotalPayout ? ' • total payout shared between participants' : ''}
        </Typography>
      ) : null}

      <Divider sx={{ my: 2 }} />

      {isPartiallyDistributed && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This pool is partially distributed. Review any failed settlements and retry distribution
          to process remaining items.
        </Alert>
      )}

      {/* Manager controls */}
      {isManager && (
        <PoolManagerActions
          status={pool.status}
          itemCount={pool.items.length}
          onOpenOcr={() => setOcrOpen(true)}
          onLock={() => lockPool.mutate(poolId)}
          onDistribute={handleDistribute}
          onRetryDistribution={handleRetryDistribution}
          onCancel={() => cancelPool.mutate(poolId)}
          lockPending={lockPool.isPending}
          distributePending={distribute.isPending}
          retryPending={retryDistribution.isPending}
        />
      )}

      {isOpen && isManager && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          <TextField
            size="small"
            label="Assistant manager user IDs"
            helperText="Comma-separated IDs allowed to manage only this loot pool"
            value={assistantUserIdsInput}
            onChange={e => setAssistantUserIdsInput(e.target.value)}
            fullWidth
          />
          <Box>
            <Button
              size="small"
              variant="outlined"
              onClick={handleSaveAssistantManagers}
              disabled={updatePool.isPending}
            >
              Save assistants
            </Button>
          </Box>
          {updatePool.isError && (
            <Alert severity="error">Failed to update assistant managers for this pool.</Alert>
          )}
        </Stack>
      )}

      {/* Items */}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Item</TableCell>
            <TableCell>Category</TableCell>
            <TableCell align="right">Qty</TableCell>
            <TableCell align="right">Unit value</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pool.items.map(item => {
            const myClaim = (pool.claims ?? []).find(
              c => c.lootItemId === item.id && c.userId === currentUserId
            );
            const claimLabel = myClaim
              ? [
                  myClaim.claimType,
                  myClaim.bidAmount === undefined ? null : String(myClaim.bidAmount),
                ]
                  .filter((part): part is string => Boolean(part))
                  .join(' ')
              : undefined;
            return (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell align="right">{item.quantity}</TableCell>
                <TableCell align="right">{formatAuec(item.unitValue)}</TableCell>
                <TableCell align="right">{formatAuec(item.totalValue)}</TableCell>
                <TableCell>
                  {item.status === 'awarded' ? (
                    <Chip size="small" color="success" label="awarded" />
                  ) : (
                    item.status
                  )}
                </TableCell>
                <TableCell align="right">
                  {isOpen && isManager && (
                    <IconButton
                      size="small"
                      onClick={() => removeItem.mutate({ poolId, itemId: item.id })}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  )}
                  {isLocked && claimTypesFor(pool.distributionMethod).length > 0 && (
                    <ClaimControls
                      method={pool.distributionMethod}
                      hasClaim={Boolean(myClaim)}
                      claimLabel={claimLabel}
                      onClaim={(claimType, bidAmount) =>
                        claim.mutate({ poolId, itemId: item.id, data: { claimType, bidAmount } })
                      }
                      onWithdraw={() => withdraw.mutate({ poolId, itemId: item.id })}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {pool.items.length === 0 && (
            <TableRow>
              <TableCell colSpan={7}>
                <Typography variant="body2" color="text.secondary">
                  No items yet.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Add item row (leader, open) */}
      {isOpen && isManager && (
        <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center">
          <TextField
            size="small"
            label="Item name"
            value={newItem.name}
            onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
          />
          <TextField
            size="small"
            label="Qty"
            type="number"
            sx={{ width: 90 }}
            value={newItem.quantity}
            onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))}
          />
          <TextField
            size="small"
            label="Unit value"
            type="number"
            sx={{ width: 140 }}
            value={newItem.unitValue}
            onChange={e => setNewItem(p => ({ ...p, unitValue: e.target.value }))}
          />
          <Button startIcon={<Add />} onClick={handleAddItem} disabled={addItem.isPending}>
            Add
          </Button>
        </Stack>
      )}

      {/* Distribution result */}
      {result && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Distribution result
          </Typography>
          {(result.failures?.length ?? 0) > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {result.failures?.length} payout/settlement operation(s) failed. The pool was marked
              partially distributed.
            </Alert>
          )}
          {result.payouts && result.payouts.length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Participant</TableCell>
                  <TableCell align="right">Payout</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.payouts.map(p => (
                  <TableRow key={p.userId}>
                    <TableCell>{p.userName ?? p.userId}</TableCell>
                    <TableCell align="right">{formatAuec(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Winner</TableCell>
                  <TableCell align="right">Roll / Bid</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.awards.map(a => (
                  <TableRow key={a.lootItemId}>
                    <TableCell>{a.itemName}</TableCell>
                    <TableCell>{a.userName ?? a.userId ?? '—'}</TableCell>
                    <TableCell align="right">
                      {a.amount ? formatAuec(a.amount) : (a.rollValue ?? '—')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      )}

      <OcrDialog open={ocrOpen} poolId={poolId} onClose={() => setOcrOpen(false)} />
    </Box>
  );
};

// ==================== Claim Controls ====================

interface ClaimControlsProps {
  method: LootDistributionMethod;
  hasClaim: boolean;
  claimLabel?: string;
  onClaim: (claimType: LootClaimType, bidAmount?: number) => void;
  onWithdraw: () => void;
}

const ClaimControls: React.FC<ClaimControlsProps> = ({
  method,
  hasClaim,
  claimLabel,
  onClaim,
  onWithdraw,
}) => {
  const [bid, setBid] = useState('');

  if (hasClaim) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
        <Chip size="small" color="primary" label={claimLabel} />
        <Button size="small" onClick={onWithdraw}>
          Withdraw
        </Button>
      </Stack>
    );
  }

  if (method === 'need_greed') {
    return (
      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
        <Button size="small" onClick={() => onClaim('need')}>
          Need
        </Button>
        <Button size="small" onClick={() => onClaim('greed')}>
          Greed
        </Button>
      </Stack>
    );
  }

  if (method === 'random_roll') {
    return (
      <Button size="small" onClick={() => onClaim('roll')}>
        Roll
      </Button>
    );
  }

  // auec_bid
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
      <TextField
        size="small"
        type="number"
        placeholder="Bid"
        sx={{ width: 110 }}
        value={bid}
        onChange={e => setBid(e.target.value)}
      />
      <Button size="small" disabled={!bid} onClick={() => onClaim('bid', Number(bid))}>
        Bid
      </Button>
    </Stack>
  );
};

// ==================== Page ====================

export const LootDistribution: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { data: pools, isLoading } = useLootPools();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Loot Distribution"
        description="Collect mission loot, set the rules, and let active participants claim or bid"
        primaryAction={{
          label: 'New Loot Pool',
          icon: Add,
          onPress: () => setCreateOpen(true),
        }}
      />

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          {isLoading ? (
            <CircularProgress />
          ) : (
            <Stack spacing={1}>
              {(pools ?? []).map((pool: LootPool) => (
                <Card key={pool.id} variant={selectedId === pool.id ? 'elevation' : 'outlined'}>
                  <CardActionArea onClick={() => setSelectedId(pool.id)}>
                    <CardContent>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                          {pool.name}
                        </Typography>
                        <Chip size="small" color={STATUS_COLORS[pool.status]} label={pool.status} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {METHOD_LABELS[pool.distributionMethod]} • {formatAuec(pool.totalValue)}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
              {(pools ?? []).length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No loot pools yet. Create one to get started.
                </Typography>
              )}
            </Stack>
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card variant="outlined">
            <CardContent>
              {selectedId ? (
                <PoolDetail poolId={selectedId} currentUserId={user?.id} />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Select a loot pool to view and manage it.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <CreatePoolDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Box>
  );
};

export const LootDistributionWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Loot Distribution"
    fallbackMessage="Unable to load loot distribution. Please try again later."
    showHomeButton={true}
  >
    <LootDistribution />
  </FeatureErrorBoundary>
);
