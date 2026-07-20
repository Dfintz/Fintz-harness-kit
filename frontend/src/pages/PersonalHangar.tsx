import { AddShipDialog } from '@/components/AddShipDialog';
import { ErrorMessage } from '@/components/ErrorMessage';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { FleetBreakdownPanel } from '@/components/fleet/FleetBreakdownPanel';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { DataTable, type DataTableColumn } from '@/components/shared';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { userShipKeys } from '@/hooks/queries/queryKeys';
import {
  type PersonalShip,
  useCreateUserShip,
  useDeleteUserShip,
  useImportUserShips,
  useLoanUserShip,
  useUpdateUserShip,
  useUserShips,
  useUserShipSummary,
} from '@/hooks/queries/useUserShipQueries';
import { useDebounce } from '@/hooks/useDebounce';
import { isApiClientError } from '@/services/apiClient';
import { organizationServiceV2 } from '@/services/organizationServiceV2';
import { userShipService } from '@/services/userShipService';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import {
  getSharingLevelColors,
  mapSemanticToThemeBgColor,
  mapSemanticToThemeColor,
} from '@/utils/semanticColorUtils';
import {
  formatShipLabel,
  getCareerColor,
  getConditionColor,
  getRoleColor,
  getSharingLevelColor,
  getSizeColor,
  getStatusColor,
} from '@/utils/shipColorUtils';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupsIcon from '@mui/icons-material/Groups';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import LockIcon from '@mui/icons-material/Lock';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PublicIcon from '@mui/icons-material/Public';
import SearchIcon from '@mui/icons-material/Search';
import ShareIcon from '@mui/icons-material/Share';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pie, PieChart, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

import { useUrlFilters } from '@/hooks/useUrlFilters';

import {
  buildPersonalHangarQueryFilters,
  parsePersonalHangarFilters,
  PERSONAL_HANGAR_FILTER_DEFAULTS,
} from './personalHangarFilters';

/**
 * PersonalHangar - User ship inventory management
 *
 * Displays and manages user's personal ship collection:
 * - Ship list with filtering and sorting
 * - Ship details and modifications
 * - Insurance tracking
 * - Loan management
 * - Availability for org use
 */

/** Shape of a user option for the share autocomplete */
interface ShareUserOption {
  id: string;
  displayName: string;
  username: string;
}

const SHARING_LEVELS = [
  {
    value: 'private',
    label: 'Private',
    icon: LockIcon,
  },
  {
    value: 'personal',
    label: 'Personal',
    icon: LockIcon,
  },
  {
    value: 'shared_users',
    label: 'Shared with Users',
    icon: ShareIcon,
  },
  {
    value: 'organization',
    label: 'Organization',
    icon: GroupsIcon,
  },
  {
    value: 'alliance',
    label: 'Alliance',
    icon: GroupsIcon,
  },
  {
    value: 'public',
    label: 'Public',
    icon: PublicIcon,
  },
] as const;

const getSharingLevelConfig = (level: string) => {
  return SHARING_LEVELS.find(sl => sl.value === level) ?? SHARING_LEVELS[0];
};

/** Tags/prefixes that should always be fully uppercased */
const UPPER_TAGS = new Set([
  'es',
  'xl',
  'mr',
  'lx',
  'cl',
  'rn',
  'sm',
  'lti',
  'bis',
  'c1',
  'c2',
  'c8',
  'p52',
  'p72',
  'sx',
  'st',
  'ii',
  'iii',
  'iv',
  'f7a',
  'f7c',
  'f8c',
  'csv',
  'mtc',
  'atls',
]);

/** Format a ship name with proper title case and uppercase tags */
function formatShipName(name: string): string {
  return name
    .split(/(\s+|-)/g)
    .map(part => {
      const lower = part.toLowerCase();
      if (UPPER_TAGS.has(lower)) return part.toUpperCase();
      if (lower === 'mk') return 'Mk';
      if (/^\s+$/.test(part) || part === '-') return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

/* ---------- chart data builder ---------- */

type ColorGetter = (key: string, theme: Theme) => string;

function toChartData(
  record: Record<string, number> | undefined,
  colorFn: ColorGetter,
  theme: Theme
) {
  if (!record) return [];
  return Object.entries(record)
    .filter(([key, v]) => v > 0 && key.toLowerCase() !== 'unknown')
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => ({
      name: formatShipLabel(key),
      value,
      fill: colorFn(key, theme),
    }));
}

/* ---------- mini chart card ---------- */

interface ChartCardProps {
  readonly title: string;
  readonly data: Array<{ name: string; value: number; fill: string }>;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, data }) => {
  const theme = useTheme();

  if (data.length === 0) return null;

  return (
    <Card
      sx={{
        flex: '1 1 300px',
        minWidth: 280,
        maxWidth: 420,
        backgroundColor: alpha(theme.palette.background.paper, 0.6),
      }}
    >
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          {title}
        </Typography>
        <Box sx={{ width: '100%', height: 180 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
                stroke="none"
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 4,
                  color: theme.palette.text.primary,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: data.length > 6 ? 'repeat(2, 1fr)' : '1fr',
            gap: 0.25,
            mt: 1,
            maxHeight: data.length > 10 ? 120 : 'none',
            overflow: data.length > 10 ? 'auto' : 'visible',
          }}
        >
          {data.map(entry => (
            <Box
              key={entry.name}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                py: 0.125,
                minWidth: 0,
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: entry.fill,
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.name}
                <Box component="span" sx={{ fontWeight: 600, ml: 0.5, color: 'text.primary' }}>
                  {entry.value}
                </Box>
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

/* ---------- hangar charts wrapper ---------- */

interface HangarChartsProps {
  readonly summary: {
    byCareer?: Record<string, number>;
    byRole?: Record<string, number>;
    bySize?: Record<string, number>;
    byStatus?: Record<string, number>;
    byCondition?: Record<string, number>;
    bySharingLevel?: Record<string, number>;
  };
}

const HangarCharts: React.FC<HangarChartsProps> = ({ summary }) => {
  const theme = useTheme();
  const careerData = useMemo(
    () => toChartData(summary.byCareer, getCareerColor, theme),
    [summary.byCareer, theme]
  );
  const roleData = useMemo(
    () => toChartData(summary.byRole, getRoleColor, theme),
    [summary.byRole, theme]
  );
  const sizeData = useMemo(
    () => toChartData(summary.bySize, getSizeColor, theme),
    [summary.bySize, theme]
  );
  const statusData = useMemo(
    () => toChartData(summary.byStatus, getStatusColor, theme),
    [summary.byStatus, theme]
  );
  const conditionData = useMemo(
    () => toChartData(summary.byCondition, getConditionColor, theme),
    [summary.byCondition, theme]
  );
  const sharingData = useMemo(
    () => toChartData(summary.bySharingLevel, getSharingLevelColor, theme),
    [summary.bySharingLevel, theme]
  );

  const hasAnyData =
    statusData.length > 0 ||
    conditionData.length > 0 ||
    sharingData.length > 0 ||
    careerData.length > 0 ||
    roleData.length > 0 ||
    sizeData.length > 0;

  if (!hasAnyData) return null;

  return (
    <Stack direction="row" gap={2} flexWrap="wrap" alignItems="flex-start">
      <ChartCard title="Ships by Status" data={statusData} />
      <ChartCard title="Ships by Condition" data={conditionData} />
      <ChartCard title="Ships by Visibility" data={sharingData} />
      <ChartCard title="Ships by Career" data={careerData} />
      <ChartCard title="Ships by Role" data={roleData} />
      <ChartCard title="Ships by Size" data={sizeData} />
    </Stack>
  );
};

/** Execute ship deletion with error handling */
async function executeDeleteShip(
  userId: string,
  shipId: string,
  mutateAsync: (args: { userId: string; shipId: string }) => Promise<unknown>,
  setDeleteShip: (ship: null) => void
): Promise<void> {
  try {
    await mutateAsync({ userId, shipId });
    setDeleteShip(null);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to delete ship', err instanceof Error ? err : new Error(msg));
  }
}

/** Execute bulk ship deletion with cache invalidation and error surfacing */
async function executeClearAllShips(
  userId: string,
  setShowConfirm: (v: boolean) => void,
  setProgress: (v: number) => void,
  setPending: (v: boolean) => void,
  setError: (v: string | null) => void,
  invalidate: () => void
): Promise<void> {
  setError(null);
  setPending(true);
  try {
    await userShipService.clearAllUserShips(userId);
    setShowConfirm(false);
    setProgress(0);
    invalidate();
  } catch (err: unknown) {
    let message = 'Failed to delete ships';
    if (isApiClientError(err) || err instanceof Error) {
      message = err.message;
    }
    setError(message);
    logger.error('Failed to delete ships', err instanceof Error ? err : new Error(String(err)));
    invalidate();
  } finally {
    setPending(false);
  }
}

/** Execute ship edit save with error handling */
async function executeSaveEdit(
  userId: string,
  shipId: string,
  data: Record<string, unknown>,
  mutateAsync: (args: {
    userId: string;
    shipId: string;
    data: Record<string, unknown>;
  }) => Promise<unknown>,
  setEditShip: (ship: null) => void
): Promise<void> {
  try {
    await mutateAsync({ userId, shipId, data });
    setEditShip(null);
  } catch (err: unknown) {
    logger.error('Failed to update ship', err instanceof Error ? err : new Error(String(err)));
  }
}

/** Map ship status to semantic color key */
function getSemanticStatusColor(status: string): string {
  switch (status) {
    case 'owned':
    case 'gifted':
      return 'positive';
    case 'pledged':
      return 'info';
    case 'loaned':
      return 'yellow';
    case 'lost':
    case 'destroyed':
      return 'negative';
    default:
      return 'neutral';
  }
}

/** Map ship condition to semantic color key */
function getConditionSemantic(condition: string): string {
  switch (condition) {
    case 'pristine':
    case 'excellent':
      return 'positive';
    case 'good':
      return 'neutral';
    case 'fair':
    case 'poor':
      return 'yellow';
    case 'damaged':
    case 'critical':
      return 'negative';
    default:
      return 'neutral';
  }
}

/** Map catalog production status to display label */
function getProductionStatusLabel(status?: string): string {
  switch (status) {
    case 'flight_ready':
      return 'Released';
    case 'in_concept':
      return 'Concept';
    case 'in_production':
      return 'In Production';
    case 'announced':
      return 'Announced';
    default:
      return '';
  }
}

/** Map catalog production status to semantic color */
function getProductionStatusSemantic(status?: string): string {
  switch (status) {
    case 'flight_ready':
      return 'positive';
    case 'in_concept':
      return 'info';
    case 'in_production':
      return 'yellow';
    case 'announced':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** Keyboard handler for toggle buttons (Enter/Space) */
function handleToggleKeyDown(
  e: React.KeyboardEvent,
  toggle: React.Dispatch<React.SetStateAction<boolean>>
): void {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggle(prev => !prev);
  }
}

/** Debounced user search for sharing autocomplete */
function executeUserSearch(
  timer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  query: string,
  organizationId: string | undefined,
  currentUserId: string,
  setOptions: (opts: ShareUserOption[]) => void,
  setLoading: (loading: boolean) => void
): void {
  if (timer.current) clearTimeout(timer.current);
  if (!query || query.length < 2 || !organizationId) {
    setOptions([]);
    return;
  }
  setLoading(true);
  timer.current = setTimeout(
    () => fetchUserSearchResults(organizationId, currentUserId, query, setOptions, setLoading),
    300
  );
}

/** Convert a date string to ISO format, or undefined if empty */
function toOptionalISO(dateStr: string): string | undefined {
  return dateStr ? new Date(dateStr).toISOString() : undefined;
}

/** Extract error message from query error */
function getErrorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to load ships';
}

/** Execute loan offer with error handling */
async function executeLoanShip(
  userId: string,
  shipId: string,
  data: Record<string, unknown>,
  mutateAsync: (args: {
    userId: string;
    shipId: string;
    data: Record<string, unknown>;
  }) => Promise<unknown>,
  setDialogOpen: (v: boolean) => void,
  setLoanShip: (ship: null) => void,
  setLoanError: (msg: string | null) => void
): Promise<void> {
  setLoanError(null);
  try {
    await mutateAsync({ userId, shipId, data });
    setDialogOpen(false);
    setLoanShip(null);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to offer ship for loan';
    setLoanError(message);
    logger.error(
      'Failed to offer ship for loan',
      err instanceof Error ? err : new Error(String(err))
    );
  }
}

/** Fetch org member search results for user sharing */
async function fetchUserSearchResults(
  orgId: string,
  currentUserId: string,
  query: string,
  setOptions: (opts: Array<{ id: string; displayName: string; username: string }>) => void,
  setLoading: (v: boolean) => void
): Promise<void> {
  try {
    const result = await organizationServiceV2.getOrganizationMembers(orgId, {
      search: query,
      page: 1,
      limit: 10,
    });
    const members = (result.items ?? [])
      .filter(m => m.userId !== currentUserId)
      .map(m => ({
        id: m.userId,
        displayName: m.displayName ?? m.username ?? m.userId,
        username: m.username ?? m.userId,
      }));
    setOptions(members);
  } catch {
    setOptions([]);
  } finally {
    setLoading(false);
  }
}

/** Resolve shared user IDs for the current sharing level */
function resolveSharedUserIds(
  sharingLevel: string,
  sharedUsers: ShareUserOption[]
): string[] | undefined {
  return sharingLevel === 'shared_users' ? sharedUsers.map(u => u.id) : undefined;
}

/** Initialize edit form state from ship data */
function initEditForm(
  ship: PersonalShip,
  setters: {
    setEditShip: (s: PersonalShip) => void;
    setEditCustomName: (v: string) => void;
    setEditStatus: (v: string) => void;
    setEditDescription: (v: string) => void;
    setEditLocation: (v: string) => void;
    setEditInsuranceLevel: (v: string) => void;
    setEditCondition: (v: string) => void;
    setEditSharingLevel: (v: string) => void;
    setEditErkulLoadoutUrl: (v: string) => void;
    setEditSharedUsers: (v: Array<{ id: string; displayName: string; username: string }>) => void;
    setUserSearchOptions: (v: Array<{ id: string; displayName: string; username: string }>) => void;
  }
): void {
  setters.setEditShip(ship);
  setters.setEditCustomName(ship.customName ?? '');
  setters.setEditStatus(ship.status ?? 'owned');
  setters.setEditDescription(ship.description ?? '');
  setters.setEditLocation(ship.location ?? '');
  setters.setEditInsuranceLevel(ship.insuranceLevel ?? '');
  setters.setEditCondition(ship.condition ?? '');
  setters.setEditSharingLevel(ship.sharingLevel ?? 'private');
  setters.setEditErkulLoadoutUrl(ship.erkulLoadoutUrl ?? '');
  const sharedUsers = ship.sharedWithUsers?.length
    ? ship.sharedWithUsers.map(id => ({ id, displayName: id, username: id }))
    : [];
  setters.setEditSharedUsers(sharedUsers);
  setters.setUserSearchOptions([]);
}

/** Summary stat cards extracted to reduce component complexity */
interface HangarStatCardsProps {
  readonly shipSummary: ReturnType<typeof useUserShipSummary>['data'];
  readonly totalShips: number;
}

const HangarStatCards: React.FC<HangarStatCardsProps> = ({ shipSummary, totalShips }) => {
  const operational = shipSummary
    ? (shipSummary.byCondition?.good ?? 0) +
      (shipSummary.byCondition?.excellent ?? 0) +
      (shipSummary.byCondition?.pristine ?? 0)
    : null;
  const needsRepair = shipSummary
    ? (shipSummary.byCondition?.damaged ?? 0) +
      (shipSummary.byCondition?.critical ?? 0) +
      (shipSummary.byCondition?.poor ?? 0)
    : null;
  const sharedWithOrg = shipSummary
    ? (shipSummary.bySharingLevel?.organization ?? 0) + (shipSummary.bySharingLevel?.alliance ?? 0)
    : null;

  return (
    <Stack direction="row" gap={4} flexWrap="wrap">
      <Box sx={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', p: 2, borderRadius: 1 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Total Ships
        </Typography>
        <Typography sx={{ fontSize: '2rem', fontWeight: 'bold' }}>
          {shipSummary?.totalShips ?? totalShips}
        </Typography>
      </Box>
      <Box sx={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', p: 2, borderRadius: 1 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Operational
        </Typography>
        <Typography sx={{ fontSize: '2rem', fontWeight: 'bold', color: 'success.main' }}>
          {operational ?? '\u2014'}
        </Typography>
      </Box>
      <Box sx={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', p: 2, borderRadius: 1 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Needs Repair
        </Typography>
        <Typography sx={{ fontSize: '2rem', fontWeight: 'bold', color: 'warning.main' }}>
          {needsRepair ?? '\u2014'}
        </Typography>
      </Box>
      <Box sx={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', p: 2, borderRadius: 1 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Shared with Org
        </Typography>
        <Typography sx={{ fontSize: '2rem', fontWeight: 'bold', color: 'info.main' }}>
          {sharedWithOrg ?? '\u2014'}
        </Typography>
      </Box>
    </Stack>
  );
};

const PersonalHangar: React.FC = () => {
  const { user } = useAuthStore();
  const theme = useTheme();
  const queryClient = useQueryClient();

  // URL-backed filter & pagination state (Phase 3 of architectural rework).
  // Filters live in the query string so they survive refresh, deep-link, and
  // back/forward navigation. See personalHangarFilters.ts for the schema.
  const { filters, updateFilters } = useUrlFilters({
    parse: parsePersonalHangarFilters,
    defaults: PERSONAL_HANGAR_FILTER_DEFAULTS,
    paginationKeys: ['page', 'pageSize'] as const,
  });
  const {
    status: filterStatus,
    condition: filterCondition,
    sharingLevel: filterSharingLevel,
    productionStatus: filterProductionStatus,
    sortBy,
    sortOrder,
    page,
    pageSize,
  } = filters;

  // Search is debounced: the input is local so typing isn't laggy, and only
  // the debounced value is mirrored to the URL (which also resets pagination).
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    if (debouncedSearch === filters.search) return;
    updateFilters({ search: debouncedSearch });
  }, [debouncedSearch, filters.search, updateFilters]);

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editShip, setEditShip] = useState<PersonalShip | null>(null);
  const [editCustomName, setEditCustomName] = useState('');
  const [editStatus, setEditStatus] = useState('owned');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editInsuranceLevel, setEditInsuranceLevel] = useState('');
  const [editCondition, setEditCondition] = useState('');
  const [editSharingLevel, setEditSharingLevel] = useState('');
  const [editErkulLoadoutUrl, setEditErkulLoadoutUrl] = useState('');
  const [editSharedUsers, setEditSharedUsers] = useState<ShareUserOption[]>([]);
  const [userSearchOptions, setUserSearchOptions] = useState<ShareUserOption[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const userSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteShip, setDeleteShip] = useState<PersonalShip | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [statsOpen, setStatsOpen] = useState(true);
  const [clearAllProgress, setClearAllProgress] = useState(0);
  const [clearAllPending, setClearAllPending] = useState(false);
  const [clearAllError, setClearAllError] = useState<string | null>(null);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [loanShip, setLoanShip] = useState<PersonalShip | null>(null);
  const [loanScope, setLoanScope] = useState<'organization' | 'alliance'>('organization');
  const [loanStartDate, setLoanStartDate] = useState('');
  const [loanReturnDate, setLoanReturnDate] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [loanError, setLoanError] = useState<string | null>(null);

  // Build filters object for the query (includes pagination)
  const queryFilters = useMemo(() => buildPersonalHangarQueryFilters(filters), [filters]);

  // React Query: fetch ships
  const {
    data: shipsResult,
    isLoading,
    isFetching,
    error: queryError,
  } = useUserShips(queryFilters);
  const ships = shipsResult?.items ?? [];
  const totalShips = shipsResult?.total ?? 0;

  // Compute breakdown from server-side summary (enriched with Ship catalog data)
  const { data: shipSummary } = useUserShipSummary();

  // Mutations
  const createShip = useCreateUserShip();
  const importShips = useImportUserShips();
  const updateShip = useUpdateUserShip();
  const deleteShipMutation = useDeleteUserShip();
  const loanShipMutation = useLoanUserShip();

  const ensureUserId = (): string => {
    if (!user?.id) throw new Error('User not authenticated');
    return user.id;
  };

  const handleAddShip = async (shipData: Record<string, unknown>) => {
    await createShip.mutateAsync({ userId: ensureUserId(), data: shipData });
  };

  const handleImportShips = async (importList: Record<string, unknown>[]) => {
    await importShips.mutateAsync({ userId: ensureUserId(), ships: importList });
  };

  const handleEditShip = (ship: PersonalShip) => {
    initEditForm(ship, {
      setEditShip,
      setEditCustomName,
      setEditStatus,
      setEditDescription,
      setEditLocation,
      setEditInsuranceLevel,
      setEditCondition,
      setEditSharingLevel,
      setEditErkulLoadoutUrl,
      setEditSharedUsers,
      setUserSearchOptions,
    });
  };

  const handleSearchUsers = useCallback(
    (query: string) =>
      executeUserSearch(
        userSearchTimer,
        query,
        user?.organizationId,
        user?.id ?? '',
        setUserSearchOptions,
        setUserSearchLoading
      ),
    [user?.organizationId, user?.id]
  );

  const handleSaveEdit = async () => {
    if (!user?.id || !editShip) return;
    const sharedUserIds = resolveSharedUserIds(editSharingLevel, editSharedUsers);
    await executeSaveEdit(
      user.id,
      editShip.id,
      {
        customName: editCustomName,
        status: editStatus,
        description: editDescription,
        location: editLocation,
        insuranceLevel: editInsuranceLevel,
        condition: editCondition,
        erkulLoadoutUrl: editErkulLoadoutUrl,
        sharingLevel: editSharingLevel,
        sharedWithUsers: sharedUserIds,
      },
      updateShip.mutateAsync,
      setEditShip
    );
  };

  const handleDeleteShip = async () => {
    if (!user?.id || !deleteShip) return;
    await executeDeleteShip(user.id, deleteShip.id, deleteShipMutation.mutateAsync, setDeleteShip);
  };

  /** Delete all ships in the current view (bulk operation) */
  const handleDeleteAllShips = async () => {
    if (!user?.id || ships.length === 0) return;
    const invalidate = () => queryClient.invalidateQueries({ queryKey: userShipKeys.all });
    await executeClearAllShips(
      user.id,
      setShowClearAllConfirm,
      setClearAllProgress,
      setClearAllPending,
      setClearAllError,
      invalidate
    );
  };

  const handleSubmitLoan = async () => {
    if (!user?.id || !loanShip) return;
    await executeLoanShip(
      user.id,
      loanShip.id,
      {
        scope: loanScope,
        startDate: toOptionalISO(loanStartDate),
        endDate: toOptionalISO(loanReturnDate),
        purpose: loanPurpose.trim() || undefined,
      },
      loanShipMutation.mutateAsync,
      setLoanDialogOpen,
      setLoanShip,
      setLoanError
    );
  };

  const columns: DataTableColumn<PersonalShip>[] = [
    {
      key: 'shipName',
      header: 'Ship Name',
      render: ship => {
        const label = getProductionStatusLabel(ship.productionStatus);
        const semantic = getProductionStatusSemantic(ship.productionStatus);
        return (
          <Stack direction="row" alignItems="center" spacing={1}>
            <span>{formatShipName(ship.shipName)}</span>
            {label && (
              <Box
                component="span"
                sx={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  background: mapSemanticToThemeBgColor(semantic, theme),
                  color: mapSemanticToThemeColor(semantic, theme),
                }}
              >
                {label}
              </Box>
            )}
          </Stack>
        );
      },
    },
    { key: 'customName', header: 'Custom Name', render: ship => ship.customName || '-' },
    {
      key: 'description',
      header: 'Description',
      render: ship =>
        ship.description ? (
          <Tooltip title={ship.description}>
            <Typography
              variant="body2"
              tabIndex={0}
              sx={{
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ship.description}
            </Typography>
          </Tooltip>
        ) : (
          '-'
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: ship => {
        const semantic = getSemanticStatusColor(ship.status);
        return (
          <Box
            sx={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.875rem',
              background: mapSemanticToThemeBgColor(semantic, theme),
              color: mapSemanticToThemeColor(semantic, theme),
            }}
          >
            {ship.status}
          </Box>
        );
      },
    },
    {
      key: 'condition',
      header: 'Condition',
      render: ship => {
        const semantic = getConditionSemantic(ship.condition);
        return (
          <Box
            sx={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.875rem',
              background: mapSemanticToThemeBgColor(semantic, theme),
              color: mapSemanticToThemeColor(semantic, theme),
            }}
          >
            {ship.condition}
          </Box>
        );
      },
    },
    { key: 'location', header: 'Location', render: ship => ship.location || 'Unknown' },
    {
      key: 'insuranceLevel',
      header: 'Insurance',
      render: ship => {
        const semantic = ship.needsInsuranceRenewal ? 'negative' : 'positive';
        return ship.insuranceLevel ? (
          <Box
            sx={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.875rem',
              background: mapSemanticToThemeBgColor(semantic, theme),
              color: mapSemanticToThemeColor(semantic, theme),
            }}
          >
            {ship.insuranceLevel}
          </Box>
        ) : (
          '-'
        );
      },
    },
    {
      key: 'sharingLevel',
      header: 'Visibility',
      render: ship => {
        const config = getSharingLevelConfig(ship.sharingLevel);
        const colors = getSharingLevelColors(ship.sharingLevel, theme);
        const Icon = config.icon;
        return (
          <Chip
            icon={<Icon sx={{ fontSize: '1rem' }} />}
            label={config.label}
            size="small"
            sx={{
              backgroundColor: colors.backgroundColor,
              color: colors.color,
              fontWeight: 500,
              '& .MuiChip-icon': { color: colors.color },
            }}
          />
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: ship => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit ship">
            <IconButton
              size="small"
              aria-label="Edit ship"
              onClick={e => {
                e.stopPropagation();
                handleEditShip(ship);
              }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete ship">
            <IconButton
              size="small"
              aria-label="Delete ship"
              onClick={e => {
                e.stopPropagation();
                setDeleteShip(ship);
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Loan ship">
            <IconButton
              size="small"
              aria-label="Loan ship"
              onClick={e => {
                e.stopPropagation();
                setLoanShip(ship);
                setLoanScope('organization');
                setLoanStartDate('');
                setLoanReturnDate('');
                setLoanPurpose('');
                setLoanError(null);
                setLoanDialogOpen(true);
              }}
              disabled={ship.status === 'loaned'}
            >
              <LocalOfferIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={ship.erkulLoadoutUrl ? 'View saved Erkul loadout' : 'Look up on Erkul'}>
            <IconButton
              size="small"
              aria-label="View on Erkul Games"
              component="a"
              href={
                ship.erkulLoadoutUrl ??
                `https://www.erkul.games/ship/${encodeURIComponent(ship.shipName)}`
              }
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
            >
              <OpenInNewIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  if (isLoading && !shipsResult) return <LoadingSpinner />;
  if (queryError) return <ErrorMessage message={getErrorText(queryError)} />;

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="column" gap={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h4" component="h1">
              Personal Hangar
            </Typography>
            <HelpTooltip
              content="Your private ship collection. Add ships, track insurance and modifications. Use the search bar to find ships by name, custom name, description, or notes. Filter by Status (Owned, Pledged, Loaned, Gifted) or Condition (Pristine through Critical) using the dropdown menus. Each ship can have a description visible in the table — hover or focus the truncated text to read the full note. Breakdown chips show career, role, size, and manufacturer counts — click to filter. Distribution charts display color-coded pie charts with labeled legends below each chart. Click the Fleet Statistics header to collapse or expand the charts and breakdowns. Ships here can be loaned to org fleets later."
              icon
              iconSize="sm"
              position="right"
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            {ships.length > 0 && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => setShowClearAllConfirm(true)}
              >
                Clear All
              </Button>
            )}
            <Button variant="contained" onClick={() => setIsAddDialogOpen(true)}>
              Add Ship
            </Button>
          </Stack>
        </Stack>

        {/* Hangar Stats Summary */}
        {shipSummary && (
          <>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              role="button"
              tabIndex={0}
              aria-expanded={statsOpen}
              aria-label={statsOpen ? 'Collapse fleet statistics' : 'Expand fleet statistics'}
              onClick={() => setStatsOpen(prev => !prev)}
              onKeyDown={e => handleToggleKeyDown(e, setStatsOpen)}
              sx={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Fleet Statistics
              </Typography>
              {statsOpen ? (
                <ExpandLessIcon fontSize="small" />
              ) : (
                <ExpandMoreIcon fontSize="small" />
              )}
            </Stack>
            <Collapse in={statsOpen} timeout="auto">
              <Stack direction="column" gap={3}>
                <FleetBreakdownPanel
                  data={{
                    byCareer: shipSummary.byCareer,
                    byRole: shipSummary.byRole,
                    bySize: shipSummary.bySize,
                    byManufacturer: shipSummary.byManufacturer,
                  }}
                />
                <HangarCharts summary={shipSummary} />
              </Stack>
            </Collapse>
          </>
        )}

        {/* Add Ship Dialog */}
        <AddShipDialog
          isOpen={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
          onAddShip={handleAddShip}
          onImportShips={handleImportShips}
        />

        {/* Filters */}
        <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            size="small"
            placeholder="Search ships..."
            value={searchInput}
            onChange={e => {
              setSearchInput(e.target.value);
            }}
            sx={{ minWidth: 200 }}
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
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={filterStatus}
              onChange={e => {
                updateFilters({ status: e.target.value });
              }}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="owned">Owned</MenuItem>
              <MenuItem value="pledged">Pledged</MenuItem>
              <MenuItem value="loaned">Loaned</MenuItem>
              <MenuItem value="gifted">Gifted</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Condition</InputLabel>
            <Select
              label="Condition"
              value={filterCondition}
              onChange={e => {
                updateFilters({
                  condition: e.target.value,
                });
              }}
            >
              <MenuItem value="all">All Conditions</MenuItem>
              <MenuItem value="pristine">Pristine</MenuItem>
              <MenuItem value="excellent">Excellent</MenuItem>
              <MenuItem value="good">Good</MenuItem>
              <MenuItem value="fair">Fair</MenuItem>
              <MenuItem value="poor">Poor</MenuItem>
              <MenuItem value="damaged">Damaged</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Production</InputLabel>
            <Select
              label="Production"
              value={filterProductionStatus}
              onChange={e => {
                updateFilters({ productionStatus: e.target.value, page: 1 });
              }}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="flight_ready">Released</MenuItem>
              <MenuItem value="in_concept">Concept</MenuItem>
              <MenuItem value="in_production">In Production</MenuItem>
              <MenuItem value="announced">Announced</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Visibility</InputLabel>
            <Select
              label="Visibility"
              value={filterSharingLevel}
              onChange={e => {
                updateFilters({ sharingLevel: e.target.value, page: 1 });
              }}
            >
              <MenuItem value="all">All Visibilities</MenuItem>
              {SHARING_LEVELS.map(sl => (
                <MenuItem key={sl.value} value={sl.value}>
                  {sl.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              label="Sort By"
              value={`${sortBy}_${sortOrder}`}
              onChange={e => {
                const selected = e.target.value;
                const nextSort = (() => {
                  switch (selected) {
                    case 'createdAt_ASC':
                      return { sortBy: 'createdAt', sortOrder: 'ASC' } as const;
                    case 'shipName_ASC':
                      return { sortBy: 'shipName', sortOrder: 'ASC' } as const;
                    case 'shipName_DESC':
                      return { sortBy: 'shipName', sortOrder: 'DESC' } as const;
                    case 'createdAt_DESC':
                    default:
                      return { sortBy: 'createdAt', sortOrder: 'DESC' } as const;
                  }
                })();

                updateFilters({ ...nextSort, page: 1 });
              }}
            >
              <MenuItem value="createdAt_DESC">Date Added (Newest)</MenuItem>
              <MenuItem value="createdAt_ASC">Date Added (Oldest)</MenuItem>
              <MenuItem value="shipName_ASC">Name (A → Z)</MenuItem>
              <MenuItem value="shipName_DESC">Name (Z → A)</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Divider />

        {/* Ship Statistics */}
        <HangarStatCards shipSummary={shipSummary} totalShips={totalShips} />

        <Divider />

        {/* Refresh indicator */}
        {isFetching && !isLoading && <LinearProgress />}

        {/* Ship Table */}
        <DataTable<PersonalShip>
          columns={columns}
          data={ships}
          getRowKey={ship => ship.id}
          onRowClick={() => {
            /* reserved for future ship detail panel */
          }}
          emptyMessage="No ships found. Add your first ship to get started!"
          size="small"
          sortable
          paginated
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          totalCount={totalShips}
          page={page - 1}
          onPageChange={(newPage, newPageSize) => {
            updateFilters({ page: newPage + 1, pageSize: newPageSize });
          }}
        />

        {/* Edit Ship Dialog */}
        <Dialog open={!!editShip} onClose={() => setEditShip(null)} maxWidth="sm" fullWidth>
          <DialogTitle>
            Edit Ship — {editShip?.shipName ? formatShipName(editShip.shipName) : ''}
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Custom Name"
              fullWidth
              variant="outlined"
              value={editCustomName}
              onChange={e => setEditCustomName(e.target.value)}
              sx={{ mt: 1 }}
            />
            <FormControl fullWidth margin="dense">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
              >
                <MenuItem value="owned">Owned</MenuItem>
                <MenuItem value="pledged">Pledged</MenuItem>
                <MenuItem value="loaned">Loaned</MenuItem>
                <MenuItem value="gifted">Gifted</MenuItem>
                <MenuItem value="lost">Lost</MenuItem>
                <MenuItem value="destroyed">Destroyed</MenuItem>
                <MenuItem value="sold">Sold</MenuItem>
              </Select>
            </FormControl>
            <TextField
              margin="dense"
              label="Description"
              fullWidth
              variant="outlined"
              multiline
              minRows={2}
              maxRows={4}
              placeholder="Add a description for this ship..."
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              helperText={`${editDescription.length}/2000`}
            />
            <TextField
              margin="dense"
              label="Location"
              fullWidth
              variant="outlined"
              value={editLocation}
              onChange={e => setEditLocation(e.target.value)}
            />
            <TextField
              margin="dense"
              label="Insurance Level"
              fullWidth
              variant="outlined"
              value={editInsuranceLevel}
              onChange={e => setEditInsuranceLevel(e.target.value)}
              helperText="e.g., LTI, 6 months, 12 months"
              slotProps={{ htmlInput: { maxLength: 100 } }}
            />
            <FormControl fullWidth margin="dense">
              <InputLabel>Condition</InputLabel>
              <Select
                label="Condition"
                value={editCondition}
                onChange={e => setEditCondition(e.target.value)}
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

            <TextField
              margin="dense"
              label="Erkul Loadout URL"
              fullWidth
              variant="outlined"
              placeholder="https://www.erkul.games/loadout/..."
              value={editErkulLoadoutUrl}
              onChange={e => setEditErkulLoadoutUrl(e.target.value)}
              error={!!editErkulLoadoutUrl && !editErkulLoadoutUrl.startsWith('https://')}
              helperText={
                editErkulLoadoutUrl && !editErkulLoadoutUrl.startsWith('https://')
                  ? 'URL must start with https://'
                  : 'Paste your erkul.games loadout link'
              }
            />

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Visibility &amp; Sharing
            </Typography>
            <FormControl fullWidth margin="dense">
              <InputLabel>Visibility Level</InputLabel>
              <Select
                label="Visibility Level"
                value={editSharingLevel}
                onChange={e => setEditSharingLevel(e.target.value)}
              >
                {SHARING_LEVELS.map(sl => {
                  const colors = getSharingLevelColors(sl.value, theme);
                  return (
                    <MenuItem key={sl.value} value={sl.value}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <sl.icon sx={{ fontSize: '1.1rem', color: colors.color }} />
                        <span>{sl.label}</span>
                      </Stack>
                    </MenuItem>
                  );
                })}
              </Select>
              <FormHelperText>
                {editSharingLevel === 'private' && 'Only you can see this ship'}
                {editSharingLevel === 'personal' && 'Only you can see this ship (legacy)'}
                {editSharingLevel === 'shared_users' && 'Visible to specific users you choose'}
                {editSharingLevel === 'organization' &&
                  'Visible to all members of your organization'}
                {editSharingLevel === 'alliance' && 'Visible to your organization and allied orgs'}
                {editSharingLevel === 'public' && 'Visible to everyone'}
              </FormHelperText>
            </FormControl>

            {editSharingLevel === 'shared_users' && (
              <Autocomplete
                multiple
                options={userSearchOptions}
                value={editSharedUsers}
                getOptionLabel={option => option.displayName || option.username}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                filterSelectedOptions
                loading={userSearchLoading}
                onInputChange={(_event, value) => handleSearchUsers(value)}
                onChange={(_event, newValue) => setEditSharedUsers(newValue)}
                slotProps={{
                  chip: { size: 'small' },
                }}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Share with users"
                    placeholder="Search org members..."
                    margin="dense"
                    helperText="Type at least 2 characters to search"
                    slotProps={{
                      input: {
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {userSearchLoading ? <CircularProgress size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      },
                    }}
                  />
                )}
                noOptionsText="No users found"
                sx={{ mt: 1 }}
              />
            )}

            <Divider sx={{ my: 2 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditShip(null)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveEdit}>
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={!!deleteShip}
          onClose={() => {
            setDeleteShip(null);
            deleteShipMutation.reset();
          }}
        >
          <DialogTitle>Delete Ship</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete{' '}
              <strong>
                {deleteShip?.customName ||
                  (deleteShip?.shipName ? formatShipName(deleteShip.shipName) : '')}
              </strong>{' '}
              ? This action cannot be undone.
            </DialogContentText>
            {deleteShipMutation.error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Failed to delete ship. Please try again.
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setDeleteShip(null);
                deleteShipMutation.reset();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeleteShip}
              disabled={deleteShipMutation.isPending}
              startIcon={deleteShipMutation.isPending ? <CircularProgress size={16} /> : undefined}
            >
              {deleteShipMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Clear All Ships Dialog */}
        <Dialog
          open={showClearAllConfirm}
          onClose={() => !clearAllPending && setShowClearAllConfirm(false)}
        >
          <DialogTitle>Clear All Ships</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete <strong>all {totalShips} ships</strong> from your
              hangar? This action cannot be undone.
            </DialogContentText>
            {clearAllProgress > 0 && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={(clearAllProgress / totalShips) * 100}
                />
                <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                  Deleted {clearAllProgress} of {totalShips} ships...
                </Typography>
              </Box>
            )}
            {clearAllError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {clearAllError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setShowClearAllConfirm(false);
                setClearAllProgress(0);
                setClearAllError(null);
              }}
              disabled={clearAllPending}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeleteAllShips}
              disabled={clearAllPending}
              startIcon={clearAllPending ? <CircularProgress size={16} /> : undefined}
            >
              {clearAllPending ? 'Deleting...' : `Delete All ${totalShips} Ships`}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Ship Loan Dialog */}
        <Dialog
          open={loanDialogOpen}
          onClose={() => {
            setLoanDialogOpen(false);
            setLoanShip(null);
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Offer Ship for Loan —{' '}
            {loanShip?.customName ?? (loanShip?.shipName ? formatShipName(loanShip.shipName) : '')}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Make this ship available for loan. Members of the selected scope will be able to see
                and request this ship.
              </Typography>

              <FormControl fullWidth>
                <InputLabel>Loan Scope</InputLabel>
                <Select<'organization' | 'alliance'>
                  label="Loan Scope"
                  value={loanScope}
                  onChange={e => setLoanScope(e.target.value)}
                >
                  <MenuItem value="organization">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <GroupsIcon sx={{ fontSize: '1.1rem' }} />
                      <span>Organization</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="alliance">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <PublicIcon sx={{ fontSize: '1.1rem' }} />
                      <span>Federation / Alliance</span>
                    </Stack>
                  </MenuItem>
                </Select>
                <FormHelperText>
                  {loanScope === 'organization'
                    ? 'Available to members of your organization only'
                    : 'Available to your organization and allied orgs'}
                </FormHelperText>
              </FormControl>

              <TextField
                label="Start Date"
                type="date"
                fullWidth
                variant="outlined"
                value={loanStartDate}
                onChange={e => setLoanStartDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Optional: when the loan period begins"
              />
              <TextField
                label="End Date"
                type="date"
                fullWidth
                variant="outlined"
                value={loanReturnDate}
                onChange={e => setLoanReturnDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Optional: when the loan period ends"
              />
              <TextField
                label="Purpose / Notes"
                fullWidth
                variant="outlined"
                multiline
                minRows={2}
                value={loanPurpose}
                onChange={e => setLoanPurpose(e.target.value)}
                helperText="Optional: reason or conditions for the loan"
              />
              {loanError && (
                <Typography color="error" variant="body2">
                  {loanError}
                </Typography>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setLoanDialogOpen(false);
                setLoanShip(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={loanShipMutation.isPending}
              onClick={handleSubmitLoan}
            >
              {loanShipMutation.isPending ? (
                <CircularProgress size={20} />
              ) : (
                'Make Available for Loan'
              )}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Box>
  );
};

export const PersonalHangarWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Personal Hangar"
    fallbackMessage="Unable to load your personal hangar. Please try again later."
    showHomeButton={true}
  >
    <PersonalHangar />
  </FeatureErrorBoundary>
);
